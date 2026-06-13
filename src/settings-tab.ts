import { App, Modal, Notice, PluginSettingTab, Setting, setIcon } from "obsidian";
import GinkgoBackupPlugin from "./main";
import type { Repository } from "./types";

class RepoMultiSelectModal extends Modal {
	private repos: Repository[];
	private selected: Set<number> = new Set();
	private onConfirm: (repos: Repository[]) => void;
	private listEl!: HTMLElement;
	private countEl!: HTMLElement;
	private confirmBtn!: HTMLButtonElement;

	constructor(app: App, repos: Repository[], preselectedPaths: string[], onConfirm: (repos: Repository[]) => void) {
		super(app);
		this.repos = repos;
		this.onConfirm = onConfirm;
		for (const repo of repos) {
			if (preselectedPaths.some((p) => p.replace(/\\/g, "/") === repo.path.replace(/\\/g, "/"))) {
				this.selected.add(repo.id);
			}
		}
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("ginkgo-repo-select-modal");

		const headerEl = contentEl.createEl("div", { cls: "ginkgo-repo-header" });
		headerEl.createEl("h2", { text: "配置备份源" });
		this.countEl = headerEl.createEl("span", { cls: "ginkgo-repo-count", text: `已选 ${this.selected.size} 个` });

		this.listEl = contentEl.createEl("div", { cls: "ginkgo-repo-list" });
		this.renderList();

		const footerEl = contentEl.createEl("div", { cls: "ginkgo-modal-footer" });
		this.confirmBtn = footerEl.createEl("button", {
			cls: "ginkgo-btn-restore",
			text: "确认配置",
		});
		this.confirmBtn.disabled = this.selected.size === 0;
		this.confirmBtn.addEventListener("click", () => {
			const selectedRepos = this.repos.filter((r) => this.selected.has(r.id));
			if (selectedRepos.length === 0) return;
			this.onConfirm(selectedRepos);
			this.close();
		});

		const cancelBtn = footerEl.createEl("button", { text: "取消", cls: "ginkgo-close-btn" });
		cancelBtn.addEventListener("click", () => this.close());
	}

	private updateSelection() {
		this.countEl.setText(`已选 ${this.selected.size} 个`);
		this.confirmBtn.disabled = this.selected.size === 0;
	}

	private renderList() {
		this.listEl.empty();

		for (const repo of this.repos) {
			const isSelected = this.selected.has(repo.id);
			const itemEl = this.listEl.createEl("div", {
				cls: `ginkgo-repo-card ${isSelected ? "is-selected" : ""}`,
			});

			itemEl.addEventListener("click", () => {
				if (this.selected.has(repo.id)) {
					this.selected.delete(repo.id);
				} else {
					this.selected.add(repo.id);
				}
				this.renderList();
				this.updateSelection();
			});

			const checkEl = itemEl.createEl("div", { cls: "ginkgo-repo-check" });
			const checkbox = checkEl.createEl("input", { type: "checkbox" });
			checkbox.checked = isSelected;
			checkbox.addEventListener("click", (e) => {
				e.stopPropagation();
				if (checkbox.checked) {
					this.selected.add(repo.id);
				} else {
					this.selected.delete(repo.id);
				}
				this.renderList();
				this.updateSelection();
			});

			const bodyEl = itemEl.createEl("div", { cls: "ginkgo-repo-body" });
			const nameRow = bodyEl.createEl("div", { cls: "ginkgo-repo-name-row" });
			nameRow.createEl("span", { cls: "ginkgo-repo-name", text: repo.display_name || repo.path });

			const badgesEl = nameRow.createEl("span", { cls: "ginkgo-repo-badges" });
			if (repo.type === "cloud" || repo.type === "s3") {
				badgesEl.createEl("span", { cls: "ginkgo-repo-badge ginkgo-badge-cloud", text: "云端" });
			} else if (repo.type === "webdav") {
				badgesEl.createEl("span", { cls: "ginkgo-repo-badge ginkgo-badge-cloud", text: "WebDAV" });
			} else {
				badgesEl.createEl("span", { cls: "ginkgo-repo-badge ginkgo-badge-local", text: "本地" });
			}

			if (repo.encrypted) {
				badgesEl.createEl("span", { cls: "ginkgo-repo-badge ginkgo-badge-encrypted", text: "加密" });
			}

			bodyEl.createEl("div", { cls: "ginkgo-repo-path", text: repo.path });
		}
	}

	onClose() {
		this.contentEl.empty();
	}
}

export class GinkgoBackupSettingTab extends PluginSettingTab {
	plugin: GinkgoBackupPlugin;

	constructor(app: App, plugin: GinkgoBackupPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		const bannerEl = containerEl.createEl("div", { cls: "ginkgo-settings-banner" });
		const bannerLeft = bannerEl.createEl("div", { cls: "ginkgo-settings-banner-left" });
		const iconEl = bannerLeft.createEl("span", { cls: "ginkgo-settings-banner-icon" });
		setIcon(iconEl, "leaf");
		const titleEl = bannerLeft.createEl("div", { cls: "ginkgo-settings-banner-text" });
		titleEl.createEl("div", { cls: "ginkgo-settings-banner-title", text: "Ginkgo Backup" });
		titleEl.createEl("div", { cls: "ginkgo-settings-banner-version", text: "银杏时光备份 · Obsidian 插件 v0.2.0" });
		const statusDot = bannerEl.createEl("div", { cls: "ginkgo-settings-banner-status" });
		this.checkBannerStatus(statusDot);

		this.renderConnectionSection(containerEl);
		this.renderAutoBackupSection(containerEl);
		this.renderFilterSection(containerEl);
		this.renderActionsSection(containerEl);
		this.renderHelpSection(containerEl);
	}

	private renderConnectionSection(containerEl: HTMLElement) {
		containerEl.createEl("h3", { text: "连接" });

		const statusEl = containerEl.createEl("div", { cls: "ginkgo-settings-status" });
		this.checkAndDisplayStatus(statusEl);

		new Setting(containerEl)
			.setName("API 主机")
			.setDesc("支持 IP、域名或完整 URL（如 https://ginkgo.example.com）")
			.addText((text) =>
				text
					.setPlaceholder("127.0.0.1 或 https://ginkgo.example.com")
					.setValue(this.plugin.settings.apiHost)
					.onChange(async (value) => {
						this.plugin.settings.apiHost = value.trim();
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("API 端口")
			.setDesc("API 服务端口（默认 9275）")
			.addText((text) =>
				text
					.setPlaceholder("9275")
					.setValue(String(this.plugin.settings.apiPort))
					.onChange(async (value) => {
						const port = parseInt(value, 10);
						if (!isNaN(port) && port > 0 && port < 65536) {
							this.plugin.settings.apiPort = port;
							await this.plugin.saveSettings();
						}
					})
			);

		new Setting(containerEl)
			.setName("API Token")
			.setDesc("在 Ginkgo Backup 桌面应用的设置页面获取")
			.addText((text) => {
				text.setPlaceholder("输入 API Token")
					.setValue(this.plugin.settings.apiToken)
					.onChange(async (value) => {
						this.plugin.settings.apiToken = value;
						await this.plugin.saveSettings();
					});
				text.inputEl.type = "password";
			});

		new Setting(containerEl)
			.setName("Vault 标识符")
			.setDesc("留空则自动检测。多设备同名 Vault 时需设置唯一标识（如 MyVault-iPhone），确保每个设备对应独立备份源")
			.addText((text) =>
				text
					.setPlaceholder("自动检测")
					.setValue(this.plugin.settings.vaultIdentifier)
					.onChange(async (value) => {
						this.plugin.settings.vaultIdentifier = value.trim();
						this.plugin.vaultPath = "";
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("备份源")
			.setDesc(this.plugin.settings.sourceId > 0 ? `已配置（ID: ${this.plugin.settings.sourceId}）` : "未配置，点击一键配置选择仓库")
			.addButton((button) =>
				button.setButtonText(this.plugin.settings.sourceId > 0 ? "重新配置" : "一键配置").setCta().onClick(async () => {
					await this.showRepoSelector();
				})
			)
			.addText((text) =>
				text
					.setPlaceholder("ID")
					.setValue(String(this.plugin.settings.sourceId))
					.onChange(async (value) => {
						const id = parseInt(value, 10);
						if (!isNaN(id) && id >= 0) {
							this.plugin.settings.sourceId = id;
							this.plugin.vaultSourceId = id;
							await this.plugin.saveSettings();
						}
					})
			);
	}

	private renderAutoBackupSection(containerEl: HTMLElement) {
		containerEl.createEl("h3", { text: "备份策略" });

		new Setting(containerEl)
			.setName("即时推送")
			.setDesc("文件保存后自动推送到暂存区（推荐，即时完成，后台备份）")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.stagingPushOnSave)
					.onChange(async (value) => {
						this.plugin.settings.stagingPushOnSave = value;
						if (value) {
							this.plugin.settings.autoBackupOnSave = false;
						}
						await this.plugin.saveSettings();
						this.display();
					})
			);

		new Setting(containerEl)
			.setName("全量备份")
			.setDesc("文件保存后触发全量备份（较慢，与即时推送互斥）")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.autoBackupOnSave)
					.setDisabled(this.plugin.settings.stagingPushOnSave)
					.onChange(async (value) => {
						this.plugin.settings.autoBackupOnSave = value;
						if (value) {
							this.plugin.settings.stagingPushOnSave = false;
						}
						await this.plugin.saveSettings();
						this.display();
					})
			);

		new Setting(containerEl)
			.setName("防抖延迟")
			.setDesc("文件保存后等待多久再触发推送（毫秒）")
			.addSlider((slider) =>
				slider
					.setLimits(5000, 120000, 5000)
					.setValue(this.plugin.settings.autoBackupDebounceMs)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.autoBackupDebounceMs = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("监控文件类型")
			.setDesc("即时推送的文件扩展名，逗号或换行分隔（如 md, canvas, base）。其他文件由兜底备份覆盖")
			.addTextArea((text) =>
				text
					.setPlaceholder("md, canvas, base")
					.setValue(this.plugin.settings.watchExtensions.join(", "))
					.onChange(async (value) => {
						this.plugin.settings.watchExtensions = value
							.split(/[,\n]/)
							.map((s) => s.trim().replace(/^\./, ""))
							.filter((s) => s.length > 0);
						await this.plugin.saveSettings();
					})
			);
	}

	private renderFilterSection(containerEl: HTMLElement) {
		containerEl.createEl("h3", { text: "过滤与显示" });

		new Setting(containerEl)
			.setName("排除路径列表")
			.setDesc("不备份的路径前缀，每行一个（如 .obsidian, .trash）")
			.addTextArea((text) =>
				text
					.setPlaceholder(".obsidian\n.trash\n.DS_Store")
					.setValue(this.plugin.settings.excludePaths.join("\n"))
					.onChange(async (value) => {
						this.plugin.settings.excludePaths = value
							.split("\n")
							.map((s) => s.trim())
							.filter((s) => s.length > 0);
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("显示状态栏")
			.setDesc("在状态栏显示备份状态")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.showStatusBar)
					.onChange(async (value) => {
						this.plugin.settings.showStatusBar = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("刷新间隔")
			.setDesc("状态栏刷新间隔（秒）")
			.addSlider((slider) =>
				slider
					.setLimits(10, 300, 10)
					.setValue(this.plugin.settings.refreshInterval)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.refreshInterval = value;
						await this.plugin.saveSettings();
					})
			);
	}

	private renderActionsSection(containerEl: HTMLElement) {
		containerEl.createEl("h3", { text: "快捷操作" });

		new Setting(containerEl)
			.setName("测试连接")
			.setDesc("验证与 Ginkgo Backup 的连接")
			.addButton((button) =>
				button.setButtonText("测试").onClick(async () => {
					button.setDisabled(true);
					try {
						const health = await this.plugin.client.health();
						new Notice(`Ginkgo: 已连接 (v${health.version})`);
					} catch {
						new Notice("Ginkgo: 连接失败，请检查主机、端口和 Token");
					}
					button.setDisabled(false);
				})
			);

		new Setting(containerEl)
			.setName("立即备份")
			.setDesc("触发全量备份")
			.addButton((button) =>
				button.setButtonText("备份").onClick(() => this.plugin.backupVault())
			);

		new Setting(containerEl)
			.setName("打开应用")
			.setDesc("在浏览器中打开 Ginkgo Backup")
			.addButton((button) =>
				button.setButtonText("打开").onClick(() => this.plugin.openGinkgoApp())
			);
	}

	private renderHelpSection(containerEl: HTMLElement) {
		containerEl.createEl("h3", { text: "帮助" });
		const helpEl = containerEl.createEl("div", { cls: "ginkgo-settings-help" });
		helpEl.createEl("p", {
			text: "确保 Ginkgo Backup 桌面应用正在运行，并且当前 Vault 已添加到备份源。",
		});
		helpEl.createEl("p", {
			text: "使用命令面板（Ctrl/Cmd + P）搜索 Ginkgo 查看所有可用命令。",
		});
		helpEl.createEl("p", {
			text: "即时推送模式：笔记保存后即时推送到暂存区，后台自动完成备份，不阻塞编辑。图片等附件由兜底备份覆盖。",
		});
	}

	private async showRepoSelector() {
		try {
			const repos = await this.plugin.client.getRepositories();
			if (repos.length === 0) {
				new Notice("Ginkgo: 没有可用的备份仓库，请先在 Ginkgo Backup 中创建仓库");
				return;
			}

			let preselectedPaths: string[] = [];
			if (this.plugin.vaultSourceId > 0) {
				try {
					const source = await this.plugin.client.getSourceById(this.plugin.vaultSourceId);
					if (source) preselectedPaths = source.repo_paths || [];
				} catch {
					// ignore
				}
			}

			const modal = new RepoMultiSelectModal(this.app, repos, preselectedPaths, async (selectedRepos) => {
				const repoPaths = selectedRepos.map((r) => r.path);
				const names = selectedRepos.map((r) => r.display_name || r.path).join(", ");
				new Notice(`Ginkgo: 已选择仓库 ${names}`);
				await this.plugin.setupSource(repoPaths);
				this.display();
			});
			modal.open();
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			new Notice(`Ginkgo: 获取仓库列表失败 — ${msg}`);
		}
	}

	private async checkBannerStatus(el: HTMLElement) {
		try {
			const connected = await this.plugin.client.isConnected();
			if (connected) {
				el.addClass("ginkgo-banner-connected");
				el.setAttribute("aria-label", "已连接");
			} else {
				el.addClass("ginkgo-banner-disconnected");
				el.setAttribute("aria-label", "未连接");
			}
		} catch {
			el.addClass("ginkgo-banner-disconnected");
		}
	}

	private async checkAndDisplayStatus(el: HTMLElement | null) {
		if (!el) return;
		el.empty();
		el.removeClass("ginkgo-status-ok", "ginkgo-status-err", "ginkgo-status-warn");

		try {
			const connected = await this.plugin.client.isConnected();
			if (!connected) {
				el.setText("❌ 未连接到 Ginkgo Backup");
				el.addClass("ginkgo-status-err");
				return;
			}

			const vaultPath = this.plugin.getVaultPath();
			const source = vaultPath ? await this.plugin.client.findSourceByPath(vaultPath) : null;

			if (source) {
				el.setText("✅ 已连接 — 当前 Vault 已配置备份");
				el.addClass("ginkgo-status-ok");
			} else {
				el.setText("⚠️ 已连接 — 当前 Vault 未配置备份");
				el.addClass("ginkgo-status-warn");
			}
		} catch {
			el.setText("❌ 连接错误");
			el.addClass("ginkgo-status-err");
		}
	}
}
