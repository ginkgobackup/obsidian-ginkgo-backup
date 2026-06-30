import { App, Modal } from "obsidian";
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

		// 操作行：测试连接 | 打开设置 | 取消
		const actionsEl = contentEl.createEl("div", { cls: "ginkgo-setup-actions" });
		const checkBtn = actionsEl.createEl("button", {
			text: t("setup.checkConnection"),
			cls: "ginkgo-setup-check-btn",
		});
		const openSettingsBtn = actionsEl.createEl("button", {
			text: t("setup.openSettings"),
			cls: "ginkgo-setup-secondary-btn",
		});
		actionsEl.createEl("button", { text: t("btn.cancel"), cls: "ginkgo-close-btn" })
			.addEventListener("click", () => this.close());

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

		openSettingsBtn.addEventListener("click", () => {
			this.close();
			if (this.plugin) {
				// Obsidian 运行时提供 app.setting.open / openTabById，类型定义未暴露
				const app = this.app as unknown as { setting: { open: () => void; openTabById: (id: string) => void } };
				app.setting.open();
				app.setting.openTabById(this.plugin.manifest.id);
			}
		});
	}

	onClose() {
		this.contentEl.empty();
	}
}
