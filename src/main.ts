import {
	Notice,
	Plugin,
	TFile,
	TFolder,
	MenuItem,
	Menu,
	FileSystemAdapter,
	setIcon,
	EventRef,
} from "obsidian";
import { GinkgoBackupClient } from "./api";
import {
	DEFAULT_SETTINGS,
	type GinkgoBackupSettings,
} from "./types";
import { GinkgoBackupSettingTab } from "./settings-tab";
import { FileHistoryView, TIMELINE_VIEW_TYPE } from "./timeline-view";
import { t, setActiveLocale } from "./i18n";
import { ConnectionManager } from "./connection-manager";
import { StagingManager } from "./staging-manager";
import { formatBytes, logError as utilLogError, defaultSchemeForHost } from "./utils";
import { handleError as utilHandleError } from "./ui-utils";

export default class GinkgoBackupPlugin extends Plugin {
	settings!: GinkgoBackupSettings;
	client!: GinkgoBackupClient;
	statusBarItem!: HTMLElement;
	connectionManager!: ConnectionManager;
	stagingManager!: StagingManager;

	vaultPath: string = "";

	async onload() {
		await this.loadSettings();
		setActiveLocale(this.settings.language);

		this.client = new GinkgoBackupClient(
			this.settings.apiHost,
			this.settings.apiPort,
			this.settings.apiToken
		);

		this.registerView(TIMELINE_VIEW_TYPE, (leaf) => new FileHistoryView(leaf, this));

		this.statusBarItem = this.addStatusBarItem();
		this.statusBarItem.addClass("ginkgo-status-bar");
		this.statusBarItem.addEventListener("click", (e) => this.showStatusBarMenu(e));
		this.updateStatusBar("connecting");
		this.applyStatusBarVisibility();

		this.addSettingTab(new GinkgoBackupSettingTab(this.app, this));

		this.addRibbonIcon("hard-drive", "Ginkgo Backup", () => this.openTimeline());
		this.addCommands();
		this.addFileContextMenu();
		this.addEditorContextMenu();

		this.connectionManager = new ConnectionManager(
			this.app,
			this.settings,
			this.client,
			() => this.getVaultPath(),
			(state, detail) => this.updateStatusBar(state, detail),
			() => this.saveSettings(),
			() => this.onReconnected()
		);

		this.stagingManager = new StagingManager(
			this.app,
			this.client,
			this.settings,
			() => this.connectionManager.vaultSourceId,
			() => this.backupVault(),
			(ref: EventRef) => this.registerEvent(ref)
		);

		await this.connectionManager.initialize();
		await this.stagingManager.initialize();
		this.connectionManager.startStatusRefresh();

		// 首次启用 / Token 未配置时弹出引导
		this.maybeShowSetupGuide();
	}

	/**
	 * 检测是否需要弹出首次引导：
	 * 1. 没有保存过 "已看过引导" 标记，且
	 * 2. API Token 为空 或 与服务端无连接
	 */
	private maybeShowSetupGuide() {
		const seen = this.settings.setupGuideSeen === true;
		const needsSetup = !this.settings.apiToken || !this.connectionManager.connected;
		if (seen || !needsSetup) return;

		// 标记已展示，避免每次启动都弹
		this.settings.setupGuideSeen = true;
		this.saveSettings().catch((err) => utilLogError("persist setupGuideSeen failed", err));

		import("./setup-guide-modal").then(({ SetupGuideModal }) => {
			new SetupGuideModal(this.app, this.client, this).open();
		}).catch((err) => utilLogError("load setup guide modal failed", err));
	}

	onunload() {
		// 同步清理 + 异步落地 pending 数据；Obsidian 不会 await onunload，
		// 但 setTimeout(0) 让落地任务先排队进入事件循环，争取在卸载完成前写出。
		this.connectionManager.stopStatusRefresh();
		this.connectionManager.stopProgressPolling();
		this.stagingManager.teardown();
		const finalize = async () => {
			try {
				if (this.connectionManager.connected && this.connectionManager.vaultSourceId > 0 && this.stagingManager.pendingModifiedFiles.size > 0) {
					await this.stagingManager.stagingPushPendingFiles();
				}
				await this.stagingManager.persist();
			} catch (err) {
				utilLogError("finalize on unload failed", err);
			}
		};
		void finalize();
		this.app.workspace.detachLeavesOfType(TIMELINE_VIEW_TYPE);
	}

	async loadSettings() {
		const data = await this.loadData();
		this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
		if (data && typeof data.autoBackupOnSave === "boolean") {
			this.settings.autoBackup = data.autoBackupOnSave;
			delete (this.settings as unknown as Record<string, unknown>).autoBackupOnSave;
		}
	}

	async saveSettings() {
		await this.saveData(this.settings);
		this.client.updateConfig(
			this.settings.apiHost,
			this.settings.apiPort,
			this.settings.apiToken
		);
		this.connectionManager.updateSettings(this.settings);
		this.stagingManager.updateSettings(this.settings);
		this.applyStatusBarVisibility();
	}

	get vaultSourceId(): number {
		return this.connectionManager.vaultSourceId;
	}

	set vaultSourceId(value: number) {
		this.connectionManager.vaultSourceId = value;
	}

	get vaultRepoPath(): string {
		return this.connectionManager.vaultRepoPath;
	}

	get connected(): boolean {
		return this.connectionManager.connected;
	}

	private applyStatusBarVisibility() {
		this.statusBarItem.style.display = this.settings.showStatusBar ? "" : "none";
	}

	private addCommands() {
		this.addCommand({
			id: "ginkgo-backup-now",
			name: t("command.backupNow"),
			callback: () => this.backupVault(),
		});

		this.addCommand({
			id: "ginkgo-staging-push",
			name: t("command.pushCurrentFile"),
			editorCallback: (_editor, view) => {
				if (view.file) this.stagingManager.stagingPushFile(view.file);
			},
		});

		this.addCommand({
			id: "ginkgo-check-status",
			name: t("command.checkStatus"),
			callback: () => this.checkStatus(),
		});

		this.addCommand({
			id: "ginkgo-setup-source",
			name: t("command.setupSource"),
			callback: () => this.setupSource(),
		});

		this.addCommand({
			id: "ginkgo-timeline",
			name: t("command.openTimeline"),
			callback: () => this.openTimeline(),
		});

		this.addCommand({
			id: "ginkgo-file-history",
			name: t("command.fileHistory"),
			editorCallback: (_editor, view) => {
				if (view.file) this.showFileHistory(view.file);
			},
		});

		this.addCommand({
			id: "ginkgo-open-app",
			name: t("command.openApp"),
			callback: () => this.openGinkgoApp(),
		});

		this.addCommand({
			id: "ginkgo-cancel-backup",
			name: t("command.cancelBackup"),
			callback: () => this.cancelBackup(),
		});
	}

	private addFileContextMenu() {
		this.registerEvent(
			this.app.workspace.on("file-menu", (menu, file) => {
				if (file instanceof TFolder) return;
				menu.addItem((item: MenuItem) => {
					item.setTitle(t("menu.fileHistory"))
						.setIcon("history")
						.onClick(() => this.showFileHistory(file as TFile));
				});
			})
		);
	}

	private addEditorContextMenu() {
		this.registerEvent(
			this.app.workspace.on("editor-menu", (menu, _editor, view) => {
				if (view.file) {
					menu.addItem((item: MenuItem) => {
						item.setTitle(t("menu.fileHistory"))
							.setIcon("history")
							.onClick(() => this.showFileHistory(view.file!));
					});
				}
			})
		);
	}

	getVaultPath(): string {
		if (this.vaultPath) return this.vaultPath;
		if (this.settings.vaultIdentifier) {
			this.vaultPath = this.settings.vaultIdentifier;
			return this.vaultPath;
		}
		const adapter = this.app.vault.adapter;
		if (adapter instanceof FileSystemAdapter) {
			this.vaultPath = adapter.getBasePath();
		} else {
			this.vaultPath = this.app.vault.getName();
		}
		return this.vaultPath;
	}

	logError(context: string, err: unknown) {
		utilLogError(context, err);
	}

	async backupVault() {
		if (this.connectionManager.vaultSourceId === 0) {
			await this.setupSource();
			if (this.connectionManager.vaultSourceId === 0) return;
		}

		this.updateStatusBar("backing_up");
		new Notice(t("notice.backupStarted"));

		try {
			await this.client.triggerBackup(this.connectionManager.vaultSourceId);
			this.connectionManager.startProgressPolling();
		} catch (err) {
			this.handleError(err, t("error.backupFailed"));
			this.updateStatusBar("error");
		}
	}

	private async cancelBackup() {
		try {
			await this.client.cancelBackup(this.connectionManager.vaultSourceId);
			new Notice(t("notice.backupCancelled"));
			this.updateStatusBar("connected");
		} catch (err) {
			this.handleError(err, t("error.cancelBackupFailed"));
		}
	}

	async setupSource(repoPaths?: string[]) {
		const source = await this.connectionManager.setupSource(repoPaths);
		if (source) {
			this.vaultPath = this.getVaultPath();
			await this.saveSettings();
			// 配置完成后立即触发一次全量备份，避免用户等待下一个调度周期。
			this.backupVault().catch((err) => {
				this.handleError(err, t("error.backupFailed"));
			});
		}
	}

	private async checkStatus() {
		try {
			const status = await this.client.getStatus();
			const lines = [
				t("status.sources", { count: status.source_count }),
				t("status.snapshots", { count: status.snapshot_count }),
				t("status.storage", { size: this.formatBytes(status.storage_used) }),
				t("status.state", { state: status.backup_running ? t("status.backingUp") : t("status.idle") }),
			];
			new Notice(t("status.notice", { lines: lines.join("\n") }), 8000);
		} catch (err) {
			this.handleError(err, t("error.getStatusFailed"));
		}
	}

	private openTimeline() {
		const existing = this.app.workspace.getLeavesOfType(TIMELINE_VIEW_TYPE);
		if (existing.length > 0) {
			this.app.workspace.revealLeaf(existing[0]);
			return;
		}
		const rightLeaf = this.app.workspace.getRightLeaf(false);
		if (rightLeaf) {
			rightLeaf.setViewState({ type: TIMELINE_VIEW_TYPE, active: true });
			this.app.workspace.revealLeaf(rightLeaf);
		}
	}

	async showFileHistory(file: TFile) {
		if (this.connectionManager.vaultSourceId === 0) {
			new Notice(t("notice.sourceNotConfigured"));
			return;
		}

		const { FileHistoryModal } = await import("./file-history-modal");
		const modal = new FileHistoryModal(this.app, this.client, this.connectionManager.vaultSourceId, file.path, this.connectionManager.vaultRepoPath, this);
		modal.open();
	}

	async showFileHistoryByPath(filePath: string) {
		if (this.connectionManager.vaultSourceId === 0) {
			new Notice(t("notice.sourceNotConfigured"));
			return;
		}

		const { FileHistoryModal } = await import("./file-history-modal");
		const modal = new FileHistoryModal(this.app, this.client, this.connectionManager.vaultSourceId, filePath, this.connectionManager.vaultRepoPath, this);
		modal.open();
	}

	openGinkgoApp() {
		const host = this.settings.apiHost;
		const port = this.settings.apiPort;
		let url: string;
		if (host.startsWith("http://") || host.startsWith("https://")) {
			const u = new URL(host);
			if (port && !host.includes(":" + port)) {
				u.port = String(port);
			}
			url = u.origin;
		} else {
			// 与 API 客户端保持一致的 scheme 选择，避免打开 http 页面而 API 走 https
			const scheme = defaultSchemeForHost(host);
			url = `${scheme}://${host}:${port}`;
		}
		window.open(url, "_blank");
	}

	private onReconnected() {
		if (this.settings.stagingPushOnSave && this.stagingManager.pendingModifiedFiles.size > 0) {
			this.stagingManager.stagingPushPendingFiles();
		}
	}

	updateStatusBar(state: string, detail?: string) {
		this.statusBarItem.empty();
		const icon = this.statusBarItem.createSpan({ cls: "ginkgo-status-icon" });
		setIcon(icon, "hard-drive");

		const textSpan = this.statusBarItem.createSpan();

		switch (state) {
			case "connected":
				icon.addClass("ginkgo-status-ok");
				textSpan.setText(detail ? ` ${detail}` : ` ${t("status.connected")}`);
				this.statusBarItem.setAttribute("aria-label", t("status.connectedAria"));
				break;
			case "disconnected":
				icon.addClass("ginkgo-status-err");
				textSpan.setText(` ${t("status.disconnected")}`);
				this.statusBarItem.setAttribute("aria-label", t("status.disconnectedAria"));
				break;
			case "backing_up":
				icon.addClass("ginkgo-status-active");
				textSpan.setText(detail ? ` ${t("status.backingUp")} ${detail}` : ` ${t("status.backingUp")}...`);
				this.statusBarItem.setAttribute("aria-label", t("status.backingUpAria"));
				break;
			case "error":
				icon.addClass("ginkgo-status-err");
				textSpan.setText(` ${t("status.error")}`);
				this.statusBarItem.setAttribute("aria-label", t("status.errorAria"));
				break;
			default:
				textSpan.setText(` ${t("status.connecting")}...`);
				break;
		}
	}

	private showStatusBarMenu(event: MouseEvent) {
		const menu = new Menu();

		menu.addItem((item) => {
			item.setTitle(t("menu.backupNow")).setIcon("upload").onClick(() => this.backupVault());
		});

		menu.addItem((item) => {
			item.setTitle(t("menu.cancelBackup")).setIcon("x").onClick(() => this.cancelBackup());
		});

		menu.addItem((item) => {
			item.setTitle(t("menu.pushCurrentFile")).setIcon("file-plus").onClick(() => {
				const file = this.app.workspace.getActiveFile();
				if (file) this.stagingManager.stagingPushFile(file);
			});
		});

		menu.addItem((item) => {
			item.setTitle(t("menu.openTimeline")).setIcon("calendar").onClick(() => this.openTimeline());
		});

		menu.addSeparator();

		menu.addItem((item) => {
			item.setTitle(t("menu.checkStatus")).setIcon("activity").onClick(() => this.checkStatus());
		});

		if (this.connectionManager.vaultSourceId === 0) {
			menu.addItem((item) => {
				item.setTitle(t("menu.configureBackup")).setIcon("settings").onClick(() => this.setupSource());
			});
		}

		menu.addSeparator();

		menu.addItem((item) => {
			item.setTitle(t("menu.openApp")).setIcon("globe").onClick(() => this.openGinkgoApp());
		});

		menu.addItem((item) => {
			item.setTitle(t("menu.openSettings")).setIcon("gear").onClick(() => {
				// Obsidian 运行时提供 app.setting.open / openTabById，类型定义未暴露
				const app = this.app as unknown as { setting: { open: () => void; openTabById: (id: string) => void } };
				app.setting.open();
				app.setting.openTabById(this.manifest.id);
			});
		});

		menu.showAtMouseEvent(event);
	}

	private handleError(err: unknown, prefix: string) {
		utilHandleError(err, prefix);
	}

	formatBytes(bytes: number): string {
		return formatBytes(bytes);
	}
}
