import { App, Modal, setIcon } from "obsidian";
import { GinkgoBackupClient } from "./api";
import { t } from "./i18n";
import { logError } from "./utils";
import type GinkgoBackupPlugin from "./main";

export class SetupGuideModal extends Modal {
	private client: GinkgoBackupClient;
	private plugin: GinkgoBackupPlugin | null;

	constructor(app: App, client: GinkgoBackupClient, plugin: GinkgoBackupPlugin | null = null) {
		super(app);
		this.client = client;
		this.plugin = plugin;
	}

	async onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("ginkgo-setup-modal");

		const headerEl = contentEl.createEl("div", { cls: "ginkgo-setup-header" });
		const iconSpan = headerEl.createEl("span", { cls: "ginkgo-setup-header-icon" });
		setIcon(iconSpan, "leaf");
		headerEl.createEl("h2", { text: t("setup.title") });
		headerEl.createEl("p", { cls: "ginkgo-setup-subtitle", text: t("setup.subtitle") });

		const steps = [
			{ title: t("setup.step1Title"), desc: t("setup.step1Desc"), link: { text: t("setup.download"), href: "https://ginkgobackup.com/#download" } },
			{ title: t("setup.step2Title"), desc: t("setup.step2Desc") },
			{ title: t("setup.step3Title"), desc: t("setup.step3Desc") },
			{ title: t("setup.step4Title"), desc: t("setup.step4Desc") },
		];

		for (const step of steps) {
			const stepEl = contentEl.createEl("div", { cls: "ginkgo-setup-step" });
			stepEl.createEl("h3", { text: step.title });
			stepEl.createEl("p", { text: step.desc });
			if (step.link) {
				const linkEl = stepEl.createEl("a", {
					text: step.link.text,
					cls: "ginkgo-setup-link",
				});
				linkEl.href = step.link.href;
				linkEl.target = "_blank";
			}
		}

		const statusEl = contentEl.createEl("div", { cls: "ginkgo-setup-status" });
		const checkBtn = contentEl.createEl("button", {
			text: t("setup.checkConnection"),
			cls: "ginkgo-setup-check-btn",
		});

		checkBtn.addEventListener("click", async () => {
			checkBtn.disabled = true;
			checkBtn.textContent = t("setup.checking");
			statusEl.empty();

			try {
				const health = await this.client.health();
				statusEl.createEl("div", {
					cls: "ginkgo-setup-ok",
					text: t("setup.connected", { version: health.version }),
				});
			} catch (err) {
				logError("setup guide connection check failed", err);
				statusEl.createEl("div", {
					cls: "ginkgo-setup-err",
					text: t("setup.connectFailed"),
				});
			}

			checkBtn.disabled = false;
			checkBtn.textContent = t("setup.checkConnection");
		});

		const footerEl = contentEl.createEl("div", { cls: "ginkgo-modal-footer" });
		const openSettingsBtn = footerEl.createEl("button", {
			text: t("setup.openSettings"),
			cls: "ginkgo-btn-restore",
		});
		openSettingsBtn.addEventListener("click", () => {
			this.close();
			if (this.plugin) {
				// Obsidian 的 Setting 面板可通过 app.setting.open() 打开；
				// 打开后会自动选中已注册的 tab，无需手动 openTabById（该 API 非公开）。
				const appWithSetting = this.app as unknown as { setting?: { open: () => void } };
				appWithSetting.setting?.open();
			}
		});

		footerEl.createEl("button", { text: t("btn.cancel"), cls: "ginkgo-close-btn" })
			.addEventListener("click", () => this.close());
	}

	onClose() {
		this.contentEl.empty();
	}
}
