import { App, Modal, Notice, PluginSettingTab, Setting } from "obsidian";
import GinkgoBackupPlugin from "./main";
import { t, setStoredLocale, setActiveLocale } from "./i18n";
import type { Repository } from "./types";

class RepoMultiSelectModal extends Modal {
	private repos: Repository[];
	private selected: Set<number> = new Set();
	private onConfirm: (repos: Repository[]) => void | Promise<void>;
	private listEl!: HTMLElement;
	private countEl!: HTMLElement;
	private confirmBtn!: HTMLButtonElement;

	constructor(app: App, repos: Repository[], preselectedPaths: string[], onConfirm: (repos: Repository[]) => void | Promise<void>) {
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
		headerEl.createEl("h2", { text: t("setting.configureBackup") });
		this.countEl = headerEl.createEl("span", { cls: "ginkgo-repo-count", text: t("setting.selectedCount", { count: this.selected.size }) });

		this.listEl = contentEl.createEl("div", { cls: "ginkgo-repo-list" });
		this.renderList();

		const footerEl = contentEl.createEl("div", { cls: "ginkgo-modal-footer" });
		this.confirmBtn = footerEl.createEl("button", {
			cls: "ginkgo-btn-restore",
			text: t("btn.confirm"),
		});
		this.confirmBtn.disabled = this.selected.size === 0;
		this.confirmBtn.addEventListener("click", () => {
			const selectedRepos = this.repos.filter((r) => this.selected.has(r.id));
			if (selectedRepos.length === 0) return;
			this.onConfirm(selectedRepos);
			this.close();
		});

		const cancelBtn = footerEl.createEl("button", { text: t("btn.cancel"), cls: "ginkgo-close-btn" });
		cancelBtn.addEventListener("click", () => this.close());
	}

	private updateSelection() {
		this.countEl.setText(t("setting.selectedCount", { count: this.selected.size }));
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
				badgesEl.createEl("span", { cls: "ginkgo-repo-badge ginkgo-badge-cloud", text: t("repo.cloud") });
			} else if (repo.type === "webdav") {
				badgesEl.createEl("span", { cls: "ginkgo-repo-badge ginkgo-badge-cloud", text: t("repo.webdav") });
			} else {
				badgesEl.createEl("span", { cls: "ginkgo-repo-badge ginkgo-badge-local", text: t("repo.local") });
			}

			if (repo.encrypted) {
				badgesEl.createEl("span", { cls: "ginkgo-repo-badge ginkgo-badge-encrypted", text: t("repo.encrypted") });
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
		const titleEl = bannerLeft.createEl("div", { cls: "ginkgo-settings-banner-text" });
		titleEl.createEl("div", { cls: "ginkgo-settings-banner-title", text: t("plugin.name") });
		titleEl.createEl("div", { cls: "ginkgo-settings-banner-version", text: `Ginkgo Backup · Obsidian Plugin v${this.plugin.manifest.version}` });
		const statusEl = bannerEl.createEl("div", { cls: "ginkgo-settings-status" });
		void this.checkAndDisplayStatus(statusEl);

		this.renderConnectionSection(containerEl);
		this.renderAutoBackupSection(containerEl);
		this.renderFilterSection(containerEl);
		this.renderActionsSection(containerEl);
		this.renderHelpSection(containerEl);
	}

	private renderConnectionSection(containerEl: HTMLElement) {

		new Setting(containerEl)
			.setName(t("setting.serverUrl"))
			.setDesc(t("setting.apiHostDesc"))
			.addText((text) =>
				text
					.setPlaceholder("127.0.0.1 " + t("setting.apiHostDesc"))
					.setValue(this.plugin.settings.apiHost)
					.onChange(async (value) => {
						this.plugin.settings.apiHost = value.trim();
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName(t("setting.apiPort"))
			.setDesc(t("setting.apiPortDesc"))
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
			.setName(t("setting.apiToken"))
			.setDesc(t("setting.apiTokenDesc2"))
			.addText((text) => {
				text.setPlaceholder(t("setting.apiToken"))
					.setValue(this.plugin.settings.apiToken)
					.onChange(async (value) => {
						this.plugin.settings.apiToken = value;
						await this.plugin.saveSettings();
					});
				text.inputEl.type = "password";
			});

		new Setting(containerEl)
			.setName(t("setting.language"))
			.setDesc(t("setting.language"))
			.addDropdown((dropdown) => {
				dropdown.addOption("auto", t("setting.languageAuto"));
				dropdown.addOption("zh-CN", t("setting.languageZh"));
				dropdown.addOption("en", t("setting.languageEn"));
				dropdown.setValue(this.plugin.settings.language);
				dropdown.onChange(async (value) => {
					const locale = value as "auto" | "zh-CN" | "en";
					this.plugin.settings.language = locale;
					setStoredLocale(locale);
					setActiveLocale(locale);
					await this.plugin.saveSettings();
					this.display();
				});
			});

		new Setting(containerEl)
			.setName(t("setting.vaultIdentifier"))
			.setDesc(t("setting.vaultIdentifierDesc"))
			.addText((text) =>
				text
					.setPlaceholder(t("setting.vaultIdentifier"))
					.setValue(this.plugin.settings.vaultIdentifier)
					.onChange(async (value) => {
						this.plugin.settings.vaultIdentifier = value.trim();
						this.plugin.vaultPath = "";
						await this.plugin.saveSettings();
					})
			);

		const sourceDesc = this.plugin.settings.sourceId > 0
			? t("setting.sourceConfigured", { id: this.plugin.settings.sourceId })
			: t("setting.sourceNotConfigured");
		const sourceBtnText = this.plugin.settings.sourceId > 0
			? t("setting.reconfigure")
			: t("setting.oneClickConfig");

		new Setting(containerEl)
			.setName(t("setting.backupSource"))
			.setDesc(sourceDesc)
			.addButton((button) =>
				button.setButtonText(sourceBtnText).setCta().onClick(async () => {
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
		new Setting(containerEl).setName(t("setting.backupStrategy")).setHeading();

		new Setting(containerEl)
			.setName(t("setting.stagingPushOnSave"))
			.setDesc(t("setting.stagingPushOnSaveDesc"))
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.stagingPushOnSave)
					.onChange(async (value) => {
						this.plugin.settings.stagingPushOnSave = value;
						await this.plugin.saveSettings();
						this.display();
					})
			);

		new Setting(containerEl)
			.setName(t("setting.debounceDelay"))
			.setDesc(t("setting.debounceDelayDesc"))
			.setDisabled(!this.plugin.settings.stagingPushOnSave)
			.addSlider((slider) =>
				slider
					.setLimits(5000, 120000, 5000)
					.setValue(this.plugin.settings.autoBackupDebounceMs)
					.onChange(async (value) => {
						this.plugin.settings.autoBackupDebounceMs = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName(t("setting.autoBackup"))
			.setDesc(t("setting.autoBackupDesc"))
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.autoBackup)
					.onChange(async (value) => {
						this.plugin.settings.autoBackup = value;
						await this.plugin.saveSettings();
						this.display();
					})
			);

		new Setting(containerEl)
			.setName(t("setting.autoBackupInterval"))
			.setDesc(t("setting.autoBackupIntervalDesc"))
			.setDisabled(!this.plugin.settings.autoBackup)
			.addSlider((slider) =>
				slider
					.setLimits(5, 1440, 5)
					.setValue(this.plugin.settings.autoBackupIntervalMinutes)
					.onChange(async (value) => {
						this.plugin.settings.autoBackupIntervalMinutes = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName(t("setting.watchExtensions"))
			.setDesc(t("setting.watchExtensionsDesc2"))
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
		new Setting(containerEl).setName(t("setting.filterAndDisplay")).setHeading();

		new Setting(containerEl)
			.setName(t("setting.excludePaths"))
			.setDesc(t("setting.excludePathsDesc2"))
			.addTextArea((text) =>
				text
					.setPlaceholder(`${this.app.vault.configDir}\n.trash\n.DS_Store`)
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
			.setName(t("setting.showStatusBar"))
			.setDesc(t("setting.showStatusBarDesc"))
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.showStatusBar)
					.onChange(async (value) => {
						this.plugin.settings.showStatusBar = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName(t("setting.refreshInterval"))
			.setDesc(t("setting.refreshIntervalDesc2"))
			.addSlider((slider) =>
				slider
					.setLimits(10, 300, 10)
					.setValue(this.plugin.settings.refreshInterval)
					.onChange(async (value) => {
						this.plugin.settings.refreshInterval = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName(t("setting.largeFileThreshold"))
			.setDesc(t("setting.largeFileThresholdDesc"))
			.addSlider((slider) =>
				slider
					.setLimits(1, 50, 1)
					.setValue(Math.round(this.plugin.settings.largeFileThresholdBytes / 1024 / 1024))
					.onChange(async (value) => {
						this.plugin.settings.largeFileThresholdBytes = value * 1024 * 1024;
						await this.plugin.saveSettings();
					})
			);
	}

	private renderActionsSection(containerEl: HTMLElement) {
		new Setting(containerEl).setName(t("setting.quickActions")).setHeading();

		new Setting(containerEl)
			.setName(t("setting.testConnection"))
			.setDesc(t("setting.testConnectionDesc"))
			.addButton((button) =>
				button.setButtonText(t("setting.testConnection")).onClick(async () => {
					button.setDisabled(true);
					try {
						const health = await this.plugin.client.health();
						new Notice(t("status.connected") + ` (v${health.version})`);
					} catch {
						new Notice(t("error.getStatusFailed"));
					}
					button.setDisabled(false);
				})
			);

		new Setting(containerEl)
			.setName(t("btn.backupNow"))
			.setDesc(t("setting.backupNowDesc"))
			.addButton((button) =>
				button.setButtonText(t("btn.backupNow")).onClick(() => this.plugin.backupVault())
			);

		new Setting(containerEl)
			.setName(t("menu.openApp"))
			.setDesc(t("setting.openAppDesc"))
			.addButton((button) =>
				button.setButtonText(t("menu.openApp")).onClick(() => this.plugin.openGinkgoApp())
			);
	}

	private renderHelpSection(containerEl: HTMLElement) {
		new Setting(containerEl).setName(t("setting.help")).setHeading();
		const helpEl = containerEl.createEl("div", { cls: "ginkgo-settings-help" });
		helpEl.createEl("p", { text: t("setting.helpLine1") });
		helpEl.createEl("p", { text: t("setting.helpLine2") });
		helpEl.createEl("p", { text: t("setting.helpLine3") });
	}

	private async showRepoSelector() {
		try {
			const repos = await this.plugin.client.getRepositories();
			if (repos.length === 0) {
				new Notice(t("notice.createSourceFailed"));
				return;
			}

			let preselectedPaths: string[] = [];
			if (this.plugin.vaultSourceId > 0) {
				try {
					const source = await this.plugin.client.getSourceById(this.plugin.vaultSourceId);
					if (source) preselectedPaths = source.repo_paths || [];
				} catch (err) {
					this.plugin.logError("load preselected repos failed", err);
				}
			}

			const modal = new RepoMultiSelectModal(this.app, repos, preselectedPaths, async (selectedRepos) => {
				const repoPaths = selectedRepos.map((r) => r.path);
				const names = selectedRepos.map((r) => r.display_name || r.path).join(", ");
				new Notice(t("setting.reposSelected", { names }));
				await this.plugin.setupSource(repoPaths);
				this.display();
			});
			modal.open();
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			new Notice(t("setting.loadReposFailed", { message: msg }));
		}
	}

	private async checkAndDisplayStatus(el: HTMLElement | null) {
		if (!el) return;
		el.empty();
		el.removeClass("ginkgo-status-ok", "ginkgo-status-err", "ginkgo-status-warn");

		try {
			const connected = await this.plugin.client.isConnected();
			if (!connected) {
				el.setText(t("setting.statusError"));
				el.addClass("ginkgo-status-err");
				return;
			}

			const vaultPath = this.plugin.getVaultPath();
			const source = vaultPath ? await this.plugin.client.findSourceByPath(vaultPath) : null;

			if (source) {
				el.setText(t("setting.statusConnected"));
				el.addClass("ginkgo-status-ok");
			} else {
				el.setText(t("setting.statusNotConfigured"));
				el.addClass("ginkgo-status-warn");
			}
		} catch (err) {
			this.plugin.logError("check settings status failed", err);
			el.setText(t("setting.statusError"));
			el.addClass("ginkgo-status-err");
		}
	}
}
