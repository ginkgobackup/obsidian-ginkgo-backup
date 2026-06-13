import {
	Notice,
	Plugin,
	TFile,
	TFolder,
	MenuItem,
	Menu,
	debounce,
	FileSystemAdapter,
	setIcon,
	EventRef,
} from "obsidian";
import { GinkgoBackupClient } from "./api";
import {
	DEFAULT_SETTINGS,
	type GinkgoBackupSettings,
	type FilePush,
	GinkgoApiError,
	GinkgoErrorType,
} from "./types";
import { GinkgoBackupSettingTab } from "./settings-tab";
import { FileHistoryView, TIMELINE_VIEW_TYPE } from "./timeline-view";

export default class GinkgoBackupPlugin extends Plugin {
	settings!: GinkgoBackupSettings;
	client!: GinkgoBackupClient;
	statusBarItem!: HTMLElement;
	refreshTimer?: number;
	progressTimer?: number;
	debouncedAutoBackup?: () => void;
	debouncedSavePending?: () => void;
	vaultSourceId: number = 0;
	vaultRepoPath: string = "";
	vaultPath: string = "";
	modifyEventRef?: EventRef;
	connected: boolean = false;
	consecutiveFailures: number = 0;
	pendingModifiedFiles: Set<string> = new Set();
	private lastPushedHashes: Map<string, string> = new Map();

	async onload() {
		await this.loadSettings();

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

		this.startStatusRefresh();
		await this.loadHashCache();
		this.setupAutoBackup();
		this.debouncedSavePending = debounce(() => this.savePendingCache(), 5000);
		await this.loadPendingCache();
		if (this.pendingModifiedFiles.size > 0) {
			new Notice(`Ginkgo: 恢复 ${this.pendingModifiedFiles.size} 个待推送文件`, 5000);
		}
		this.initializeConnection();
	}

	onunload() {
		if (this.refreshTimer) window.clearInterval(this.refreshTimer);
		if (this.progressTimer) window.clearInterval(this.progressTimer);
		this.app.workspace.detachLeavesOfType(TIMELINE_VIEW_TYPE);
		this.saveHashCache();
		if (this.pendingModifiedFiles.size > 0 && this.connected && this.vaultSourceId > 0) {
			this.stagingPushPendingFiles();
		} else if (this.pendingModifiedFiles.size > 0) {
			this.savePendingCache();
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
		this.client.updateConfig(
			this.settings.apiHost,
			this.settings.apiPort,
			this.settings.apiToken
		);
		this.setupAutoBackup();
		this.applyStatusBarVisibility();
	}

	private applyStatusBarVisibility() {
		this.statusBarItem.style.display = this.settings.showStatusBar ? "" : "none";
	}

	private addCommands() {
		this.addCommand({
			id: "ginkgo-backup-now",
			name: "立即备份",
			callback: () => this.backupVault(),
		});

		this.addCommand({
			id: "ginkgo-staging-push",
			name: "推送当前文件变更 (Staging Push)",
			editorCallback: (_editor, view) => {
				if (view.file) this.stagingPushFile(view.file);
			},
		});

		this.addCommand({
			id: "ginkgo-check-status",
			name: "检查备份状态",
			callback: () => this.checkStatus(),
		});

		this.addCommand({
			id: "ginkgo-setup-source",
			name: "配置备份源",
			callback: () => this.setupSource(),
		});

		this.addCommand({
			id: "ginkgo-timeline",
			name: "打开备份时间线",
			callback: () => this.openTimeline(),
		});

		this.addCommand({
			id: "ginkgo-file-history",
			name: "查看当前文件历史版本",
			editorCallback: (_editor, view) => {
				if (view.file) this.showFileHistory(view.file);
			},
		});

		this.addCommand({
			id: "ginkgo-open-app",
			name: "打开 Ginkgo Backup 应用",
			callback: () => this.openGinkgoApp(),
		});

		this.addCommand({
			id: "ginkgo-cancel-backup",
			name: "取消当前备份",
			callback: () => this.cancelBackup(),
		});
	}

	private addFileContextMenu() {
		this.registerEvent(
			this.app.workspace.on("file-menu", (menu, file) => {
				if (file instanceof TFolder) return;
				menu.addItem((item: MenuItem) => {
					item.setTitle("历史版本")
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
						item.setTitle("历史版本")
							.setIcon("history")
							.onClick(() => this.showFileHistory(view.file!));
					});
				}
			})
		);
	}

	private async initializeConnection() {
		const connected = await this.client.isConnected();
		if (connected) {
			this.connected = true;
			this.consecutiveFailures = 0;
			await this.detectSourceId();
			this.updateStatusBar("connected");
		} else {
			this.connected = false;
			this.updateStatusBar("disconnected");
		}
	}

	private async detectSourceId() {
		if (this.settings.sourceId > 0) {
			this.vaultSourceId = this.settings.sourceId;
			try {
				const source = await this.client.getSourceById(this.vaultSourceId);
				if (source && source.repo_paths.length > 0) {
					this.vaultRepoPath = source.repo_paths[0];
				}
			} catch {
				// ignore
			}
			return;
		}

		const vaultPath = this.getVaultPath();
		if (!vaultPath) return;

		try {
			const source = await this.client.findSourceByPath(vaultPath);
			if (source) {
				this.vaultSourceId = source.id;
				this.vaultRepoPath = source.repo_paths.length > 0 ? source.repo_paths[0] : "";
				this.settings.sourceId = source.id;
				await this.saveSettings();
			}
		} catch {
			// ignore
		}
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

	private isExcluded(filePath: string): boolean {
		for (const pattern of this.settings.excludePaths) {
			if (filePath.startsWith(pattern) || filePath.includes("/" + pattern + "/") || filePath.includes("\\" + pattern + "\\")) {
				return true;
			}
		}
		return false;
	}

	private isWatchedExtension(file: TFile): boolean {
		return this.settings.watchExtensions.includes(file.extension);
	}

	private async contentHash(str: string): Promise<string> {
		const data = new TextEncoder().encode(str);
		const hashBuffer = await crypto.subtle.digest("SHA-256", data);
		const hashArray = Array.from(new Uint8Array(hashBuffer));
		return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
	}

	private async hasContentChanged(file: TFile): Promise<boolean> {
		try {
			const content = await this.app.vault.read(file);
			const hash = await this.contentHash(content);
			const lastHash = this.lastPushedHashes.get(file.path);
			if (!lastHash) {
				this.lastPushedHashes.set(file.path, hash);
				return false;
			}
			if (hash === lastHash) return false;
			this.lastPushedHashes.set(file.path, hash);
			return true;
		} catch {
			return true;
		}
	}

	private async savePendingCache() {
		try {
			const data = Array.from(this.pendingModifiedFiles);
			await this.saveData({ ...this.settings, _pendingFiles: data });
		} catch {
			// ignore write errors
		}
	}

	private async loadPendingCache() {
		try {
			const data = await this.loadData();
			const paths: string[] = data?._pendingFiles ?? [];
			if (Array.isArray(paths)) {
				for (const p of paths) {
					if (!this.isExcluded(p)) {
						this.pendingModifiedFiles.add(p);
					}
				}
			}
		} catch {
			// ignore read errors
		}
	}

	private async clearPendingCache() {
		try {
			const data = await this.loadData();
			if (data?._pendingFiles) {
				delete data._pendingFiles;
				await this.saveData(data);
			}
		} catch {
			// ignore
		}
	}

	private async saveHashCache() {
		try {
			const data: Record<string, string> = {};
			for (const [path, hash] of this.lastPushedHashes) {
				const file = this.app.vault.getAbstractFileByPath(path);
				if (file instanceof TFile) {
					data[path] = hash;
				}
			}
			this.lastPushedHashes = new Map(Object.entries(data));
			const stored = await this.loadData();
			await this.saveData({ ...stored, _hashCache: data });
		} catch {
			// ignore
		}
	}

	private async loadHashCache() {
		try {
			const data = await this.loadData();
			const cache: Record<string, string> = data?._hashCache ?? {};
			for (const [path, hash] of Object.entries(cache)) {
				this.lastPushedHashes.set(path, hash);
			}
		} catch {
			// ignore
		}
	}

	setupAutoBackup() {
		if (this.modifyEventRef) {
			this.app.vault.offref(this.modifyEventRef);
			this.modifyEventRef = undefined;
		}

		this.debouncedAutoBackup = debounce(
			async () => {
				if (!this.connected || this.vaultSourceId === 0) return;
				if (this.settings.stagingPushOnSave) {
					await this.stagingPushPendingFiles();
				} else if (this.settings.autoBackupOnSave) {
					await this.backupVault();
				}
			},
			this.settings.autoBackupDebounceMs
		);

		if (this.settings.stagingPushOnSave || this.settings.autoBackupOnSave) {
			this.modifyEventRef = this.app.vault.on("modify", async (file) => {
				if (!(file instanceof TFile)) return;
				if (this.isExcluded(file.path)) return;
				if (!this.isWatchedExtension(file)) return;
				if (!(await this.hasContentChanged(file))) return;
				this.pendingModifiedFiles.add(file.path);
				if (this.debouncedSavePending) {
					this.debouncedSavePending();
				}
				if (this.debouncedAutoBackup) {
					this.debouncedAutoBackup();
				}
			});
			this.registerEvent(this.modifyEventRef);
		}
	}

	private isBinaryFile(file: TFile): boolean {
		const binaryExtensions = new Set(["png", "jpg", "jpeg", "gif", "bmp", "svg", "webp", "ico", "pdf", "mp3", "wav", "ogg", "m4a", "flac", "mp4", "webm", "mov", "zip", "gz", "tar", "7z", "rar"]);
		return binaryExtensions.has(file.extension.toLowerCase());
	}

	private async encodeFileContent(file: TFile): Promise<string> {
		if (this.isBinaryFile(file)) {
			const data = await this.app.vault.readBinary(file);
			const bytes = new Uint8Array(data);
			let binary = "";
			for (let i = 0; i < bytes.length; i++) {
				binary += String.fromCharCode(bytes[i]);
			}
			return btoa(binary);
		}
		const content = await this.app.vault.read(file);
		return btoa(unescape(encodeURIComponent(content)));
	}

	private async stagingPushPendingFiles() {
		if (this.vaultSourceId === 0) return;

		const filePaths = Array.from(this.pendingModifiedFiles);
		this.pendingModifiedFiles.clear();
		await this.clearPendingCache();
		if (filePaths.length === 0) return;

		const files: FilePush[] = [];
		const failedPaths: string[] = [];
		for (const filePath of filePaths) {
			try {
				const file = this.app.vault.getAbstractFileByPath(filePath);
				if (!(file instanceof TFile)) continue;

				const encoded = await this.encodeFileContent(file);
				const stat = await this.app.vault.adapter.stat(file.path);

				files.push({
					rel_path: file.path.replace(/\\/g, "/"),
					action: "modify",
					content: encoded,
					size: stat?.size ?? 0,
					mtime: stat?.mtime ?? Date.now() * 1000,
				});
			} catch {
				failedPaths.push(filePath);
			}
		}

		if (files.length === 0) {
			for (const p of failedPaths) this.pendingModifiedFiles.add(p);
			if (failedPaths.length > 0) await this.savePendingCache();
			return;
		}

		try {
			const result = await this.client.stagingPush({
				source_id: this.vaultSourceId,
				message: `Obsidian: ${files.length} file${files.length > 1 ? "s" : ""}`,
				files,
				trigger: "api",
			});
			const names = files.map((f) => f.rel_path.split("/").pop()).join(", ");
			new Notice(`Ginkgo: 已推送 ${files.length} 个文件 (${names})`, 4000);
			this.saveHashCache();
			if (failedPaths.length > 0) {
				for (const p of failedPaths) this.pendingModifiedFiles.add(p);
				await this.savePendingCache();
			}
		} catch (err) {
			this.handleError(err, "推送失败");
			for (const p of filePaths) this.pendingModifiedFiles.add(p);
			await this.savePendingCache();
		}
	}

	async stagingPushFile(file: TFile) {
		if (this.vaultSourceId === 0) {
			new Notice("Ginkgo: 请先配置备份源");
			return;
		}

		try {
			if (!(await this.hasContentChanged(file))) {
				new Notice("Ginkgo: 文件内容未变化，跳过推送");
				return;
			}

			const encoded = await this.encodeFileContent(file);
			const relPath = file.path.replace(/\\/g, "/");
			const stat = await this.app.vault.adapter.stat(file.path);

			const filePush: FilePush = {
				rel_path: relPath,
				action: "modify",
				content: encoded,
				size: stat?.size ?? 0,
				mtime: stat?.mtime ?? Date.now() * 1000,
			};

			const result = await this.client.stagingPush({
				source_id: this.vaultSourceId,
				message: `Obsidian: ${file.name}`,
				files: [filePush],
				trigger: "api",
			});

			new Notice(`Ginkgo: 已推送 ${file.name} (session: ${result.session_id.slice(0, 8)})`);
			if (!this.isBinaryFile(file)) {
				const content = await this.app.vault.read(file);
				this.lastPushedHashes.set(file.path, await this.contentHash(content));
			}
			this.saveHashCache();
		} catch (err) {
			this.handleError(err, "推送失败");
		}
	}

	async backupVault() {
		if (this.vaultSourceId === 0) {
			await this.setupSource();
			if (this.vaultSourceId === 0) return;
		}

		this.updateStatusBar("backing_up");
		new Notice("Ginkgo: 备份已开始");

		try {
			await this.client.triggerBackup(this.vaultSourceId);
			this.startProgressPolling();
		} catch (err) {
			this.handleError(err, "备份失败");
			this.updateStatusBar("error");
		}
	}

	private async cancelBackup() {
		try {
			await this.client.cancelBackup(this.vaultSourceId);
			new Notice("Ginkgo: 备份已取消");
			this.updateStatusBar("connected");
		} catch (err) {
			this.handleError(err, "取消备份失败");
		}
	}

	private startProgressPolling() {
		if (this.progressTimer) window.clearInterval(this.progressTimer);

		this.progressTimer = window.setInterval(async () => {
			try {
				const progress = await this.client.getProgress(this.vaultSourceId) as BackupProgress;
				if (!progress || progress.phase === "complete" || progress.phase === "error" || progress.phase === "cancelled") {
					window.clearInterval(this.progressTimer);
					this.progressTimer = undefined;

					if (progress?.phase === "complete") {
						new Notice("Ginkgo: 备份完成");
						this.updateStatusBar("connected");
					} else if (progress?.phase === "error") {
						new Notice("Ginkgo: 备份出错");
						this.updateStatusBar("error");
					} else {
						this.updateStatusBar("connected");
					}
					return;
				}

				const pct = progress.total_files > 0
					? Math.round((progress.processed_files / progress.total_files) * 100)
					: 0;
				this.updateStatusBar("backing_up", `${pct}%`);
			} catch {
				// continue polling
			}
		}, 3000);
	}

	async setupSource(repoPaths?: string[]) {
		const vaultPath = this.getVaultPath();
		if (!vaultPath) {
			new Notice("Ginkgo: 无法确定 Vault 路径");
			return;
		}
		if (!repoPaths || repoPaths.length === 0) {
			new Notice("Ginkgo: 请先选择备份仓库");
			return;
		}

		const vaultName = this.app.vault.getName();
		new Notice("Ginkgo: 正在配置备份源...");

		try {
			const source = await this.client.ensureSourceExists(
				vaultPath,
				vaultName,
				repoPaths,
				this.settings.excludePaths
			);
			if (source) {
				this.vaultSourceId = source.id;
				this.vaultRepoPath = source.repo_paths.length > 0 ? source.repo_paths[0] : "";
				this.settings.sourceId = source.id;
				await this.saveSettings();
				const repoList = (source.repo_paths || []).join(", ");
				new Notice(`Ginkgo: ${vaultName} 已配置（仓库: ${repoList}）`, 6000);
				this.updateStatusBar("connected");
			} else {
				new Notice("Ginkgo: 创建备份源失败");
			}
		} catch (err) {
			this.handleError(err, "配置备份源失败");
		}
	}

	private async checkStatus() {
		try {
			const status = await this.client.getStatus();
			const lines = [
				`备份源: ${status.source_count} 个`,
				`快照: ${status.snapshot_count} 个`,
				`存储: ${this.formatBytes(status.storage_used)}`,
				`状态: ${status.backup_running ? "备份中" : "空闲"}`,
			];
			new Notice(`Ginkgo 状态\n${lines.join("\n")}`, 8000);
		} catch (err) {
			this.handleError(err, "获取状态失败");
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
		if (this.vaultSourceId === 0) {
			new Notice("Ginkgo: 当前 Vault 未配置备份源");
			return;
		}

		const { FileHistoryModal } = await import("./file-history-modal");
		const modal = new FileHistoryModal(this.app, this.client, this.vaultSourceId, file.path, this.vaultRepoPath);
		modal.open();
	}

	async showFileHistoryByPath(filePath: string) {
		if (this.vaultSourceId === 0) {
			new Notice("Ginkgo: 当前 Vault 未配置备份源");
			return;
		}

		const { FileHistoryModal } = await import("./file-history-modal");
		const modal = new FileHistoryModal(this.app, this.client, this.vaultSourceId, filePath, this.vaultRepoPath);
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
			url = `http://${host}:${port}`;
		}
		window.open(url, "_blank");
	}

	startStatusRefresh() {
		if (this.refreshTimer) window.clearInterval(this.refreshTimer);

		const interval = this.connected
			? this.settings.refreshInterval * 1000
			: 10000;

		this.refreshTimer = window.setInterval(() => this.refreshStatus(), interval);
	}

	private async refreshStatus() {
		try {
			const connected = await this.client.isConnected();
			if (!connected) {
				this.connected = false;
				this.consecutiveFailures++;
				this.updateStatusBar("disconnected");

				if (this.consecutiveFailures === 1 && this.settings.stagingPushOnSave) {
					new Notice("Ginkgo: 未连接，自动备份已暂停", 5000);
				}
				return;
			}

			const wasDisconnected = !this.connected;
			this.connected = true;
			this.consecutiveFailures = 0;

			if (wasDisconnected && this.settings.stagingPushOnSave && this.pendingModifiedFiles.size > 0 && this.vaultSourceId > 0) {
				this.stagingPushPendingFiles();
			}

			const progressArr = await this.client.getProgress() as BackupProgress | BackupProgress[];
			const progress = Array.isArray(progressArr) ? progressArr[0] : progressArr;

			if (progress && progress.phase && progress.phase !== "complete" && progress.phase !== "error" && progress.phase !== "cancelled") {
				const pct = progress.total_files > 0
					? Math.round((progress.processed_files / progress.total_files) * 100)
					: 0;
				this.updateStatusBar("backing_up", `${pct}%`);
				return;
			}

			if (this.vaultSourceId > 0) {
				const sources = await this.client.getSources();
				const vaultSource = sources.find((s) => s.id === this.vaultSourceId);
				if (vaultSource) {
					const fileCount = vaultSource.file_count ?? 0;
					const lastBackup = vaultSource.last_backup > 0
						? this.formatRelativeTime(new Date(vaultSource.last_backup / 1000000))
						: "从未";
					this.updateStatusBar("connected", `${fileCount} 文件 | ${lastBackup}`);
					return;
				}
			}

			this.updateStatusBar("connected");
		} catch {
			this.connected = false;
			this.updateStatusBar("disconnected");
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
				textSpan.setText(detail ? ` ${detail}` : " 已连接");
				this.statusBarItem.setAttribute("aria-label", "Ginkgo Backup 已连接");
				break;
			case "disconnected":
				icon.addClass("ginkgo-status-err");
				textSpan.setText(" 未连接");
				this.statusBarItem.setAttribute("aria-label", "Ginkgo Backup 未连接");
				break;
			case "backing_up":
				icon.addClass("ginkgo-status-active");
				textSpan.setText(detail ? ` 备份中 ${detail}` : " 备份中...");
				this.statusBarItem.setAttribute("aria-label", "正在备份");
				break;
			case "error":
				icon.addClass("ginkgo-status-err");
				textSpan.setText(" 错误");
				this.statusBarItem.setAttribute("aria-label", "备份出错");
				break;
			default:
				textSpan.setText(" 连接中...");
				break;
		}
	}

	private showStatusBarMenu(event: MouseEvent) {
		const menu = new Menu();

		menu.addItem((item) => {
			item.setTitle("立即备份").setIcon("upload").onClick(() => this.backupVault());
		});

		menu.addItem((item) => {
			item.setTitle("取消备份").setIcon("x").onClick(() => this.cancelBackup());
		});

		menu.addItem((item) => {
			item.setTitle("推送当前文件").setIcon("file-plus").onClick(() => {
				const file = this.app.workspace.getActiveFile();
				if (file) this.stagingPushFile(file);
			});
		});

		menu.addItem((item) => {
			item.setTitle("查看时间线").setIcon("calendar").onClick(() => this.openTimeline());
		});

		menu.addSeparator();

		menu.addItem((item) => {
			item.setTitle("检查状态").setIcon("activity").onClick(() => this.checkStatus());
		});

		if (this.vaultSourceId === 0) {
			menu.addItem((item) => {
				item.setTitle("配置备份").setIcon("settings").onClick(() => this.setupSource());
			});
		}

		menu.addSeparator();

		menu.addItem((item) => {
			item.setTitle("打开应用").setIcon("globe").onClick(() => this.openGinkgoApp());
		});

		menu.showAtMouseEvent(event);
	}

	private handleError(err: unknown, prefix: string) {
		if (err instanceof GinkgoApiError) {
			new Notice(`Ginkgo: ${prefix} — ${err.userMessage}`, 8000);
		} else {
			const msg = err instanceof Error ? err.message : String(err);
			new Notice(`Ginkgo: ${prefix} — ${msg}`, 8000);
		}
	}

	formatBytes(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
		if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
		return `${(bytes / 1073741824).toFixed(1)} GB`;
	}

	formatRelativeTime(date: Date): string {
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffMins = Math.floor(diffMs / 60000);
		if (diffMins < 1) return "刚刚";
		if (diffMins < 60) return `${diffMins}分钟前`;
		const diffHours = Math.floor(diffMins / 60);
		if (diffHours < 24) return `${diffHours}小时前`;
		const diffDays = Math.floor(diffHours / 24);
		return `${diffDays}天前`;
	}
}

type BackupProgress = import("./types").BackupProgress;
