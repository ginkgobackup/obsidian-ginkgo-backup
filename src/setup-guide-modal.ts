import { App, Modal, Notice } from "obsidian";
import { GinkgoBackupClient } from "./api";

export class SetupGuideModal extends Modal {
	private client: GinkgoBackupClient;
	private onSetupComplete?: () => void;

	constructor(app: App, client: GinkgoBackupClient, onSetupComplete?: () => void) {
		super(app);
		this.client = client;
		this.onSetupComplete = onSetupComplete;
	}

	async onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("ginkgo-setup-modal");

		contentEl.createEl("h2", { text: "Ginkgo Backup 设置向导" });

		const step1 = contentEl.createEl("div", { cls: "ginkgo-setup-step" });
		step1.createEl("h3", { text: "1. 安装 Ginkgo Backup" });
		step1.createEl("p", { text: "如果尚未安装，请先下载并安装 Ginkgo Backup 桌面应用。" });
		const linkEl = step1.createEl("a", {
			text: "下载 Ginkgo Backup",
			cls: "ginkgo-setup-link",
		});
		linkEl.href = "https://github.com/ginkgobackup/ginkgo";
		linkEl.target = "_blank";

		const step2 = contentEl.createEl("div", { cls: "ginkgo-setup-step" });
		step2.createEl("h3", { text: "2. 启动应用" });
		step2.createEl("p", { text: "确保 Ginkgo Backup 桌面应用正在运行。" });

		const step3 = contentEl.createEl("div", { cls: "ginkgo-setup-step" });
		step3.createEl("h3", { text: "3. 获取 API Token" });
		step3.createEl("p", { text: "在 Ginkgo Backup 桌面应用的设置页面中找到 API Token。" });

		const step4 = contentEl.createEl("div", { cls: "ginkgo-setup-step" });
		step4.createEl("h3", { text: "4. 配置插件" });
		step4.createEl("p", { text: "在插件设置中填入 API Token，然后点击一键配置。" });

		const statusEl = contentEl.createEl("div", { cls: "ginkgo-setup-status" });
		const checkBtn = contentEl.createEl("button", {
			text: "检测连接",
			cls: "ginkgo-setup-check-btn",
		});

		checkBtn.addEventListener("click", async () => {
			checkBtn.disabled = true;
			checkBtn.textContent = "检测中...";
			statusEl.empty();

			try {
				const health = await this.client.health();
				statusEl.createEl("div", {
					cls: "ginkgo-setup-ok",
					text: `✅ 已连接到 Ginkgo Backup v${health.version}`,
				});
			} catch {
				statusEl.createEl("div", {
					cls: "ginkgo-setup-err",
					text: "❌ 无法连接，请确保应用正在运行",
				});
			}

			checkBtn.disabled = false;
			checkBtn.textContent = "检测连接";
		});

		const footerEl = contentEl.createEl("div", { cls: "ginkgo-modal-footer" });
		footerEl.createEl("button", { text: "关闭", cls: "ginkgo-close-btn" })
			.addEventListener("click", () => this.close());
	}

	onClose() {
		this.contentEl.empty();
	}
}
