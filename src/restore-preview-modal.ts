import { App, Modal, Notice } from "obsidian";
import { GinkgoBackupClient } from "./api";
import { tryDecodeText } from "./encoding";
import { t } from "./i18n";
import type { FileHistoryEntry } from "./types";

export class RestorePreviewModal extends Modal {
	private client: GinkgoBackupClient;
	private sourceId: number;
	private filePath: string;
	private version: FileHistoryEntry;
	private versionLabel: string;
	private repoPath: string;
	private onRestore: () => void;

	constructor(
		app: App,
		client: GinkgoBackupClient,
		sourceId: number,
		filePath: string,
		version: FileHistoryEntry,
		versionLabel: string,
		repoPath: string,
		onRestore: () => void
	) {
		super(app);
		this.client = client;
		this.sourceId = sourceId;
		this.filePath = filePath;
		this.version = version;
		this.versionLabel = versionLabel;
		this.repoPath = repoPath;
		this.onRestore = onRestore;
	}

	async onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("ginkgo-restore-modal");

		const headerEl = contentEl.createEl("div", { cls: "ginkgo-header" });
		headerEl.createEl("span", { cls: "ginkgo-header-title", text: t("restore.title") });

		const infoEl = contentEl.createEl("div", { cls: "ginkgo-restore-info" });
		infoEl.createEl("div", { text: t("restore.file", { path: this.filePath }), cls: "ginkgo-restore-path" });
		infoEl.createEl("div", { text: t("restore.version", { version: this.versionLabel }), cls: "ginkgo-restore-version" });
		infoEl.createEl("div", { text: t("restore.size", { size: this.formatBytes(this.version.size) }), cls: "ginkgo-restore-size" });

		if (this.version.is_deleted) {
			infoEl.createEl("div", { text: t("restore.deleted"), cls: "ginkgo-restore-deleted" });
		}

		const loadingEl = contentEl.createEl("div", { cls: "ginkgo-loading" });
		loadingEl.createEl("span", { text: t("restore.loading") });

		let content = "";
		try {
			const snapshotTime = this.version.last_seen > 9000000000000
				? this.version.first_seen
				: this.version.last_seen;
			const resp = await this.client.getFileContent(
				this.sourceId,
				this.filePath,
				snapshotTime,
				this.repoPath
			);
			if (resp.content) {
				const decoded = tryDecodeText(resp.content);
				content = decoded.ok ? decoded.text : resp.content;
			}
			if (resp.error) {
				content = t("restore.readFailed", { message: resp.error });
			}
			if (!content) {
				content = t("restore.emptyFile");
			}
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			content = t("restore.readFailed", { message: msg });
		}

		loadingEl.remove();

		const previewEl = contentEl.createEl("div", { cls: "ginkgo-restore-preview" });
		const codeEl = previewEl.createEl("pre", { cls: "ginkgo-restore-code" });

		const lines = content.split("\n");
		const maxLines = 100;
		const displayContent = lines.slice(0, maxLines).join("\n");
		codeEl.createEl("code", { text: displayContent });

		if (lines.length > maxLines) {
			previewEl.createEl("div", {
				cls: "ginkgo-restore-truncated",
				text: t("restore.truncated", { total: lines.length, count: maxLines }),
			});
		}

		const warningEl = contentEl.createEl("div", { cls: "ginkgo-restore-warning" });
		warningEl.createEl("span", { text: t("restore.warning") });

		const footerEl = contentEl.createEl("div", { cls: "ginkgo-modal-footer" });

		const restoreBtn = footerEl.createEl("button", {
			cls: "ginkgo-btn-restore",
			text: t("restore.confirm"),
		});
		restoreBtn.addEventListener("click", async () => {
			restoreBtn.disabled = true;
			restoreBtn.textContent = t("restore.restoring");
			try {
				await this.onRestore();
				this.close();
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				new Notice(t("restore.failed", { message: msg }));
				restoreBtn.disabled = false;
				restoreBtn.textContent = t("restore.confirm");
			}
		});

		footerEl.createEl("button", { cls: "ginkgo-close-btn", text: t("btn.cancel") })
			.addEventListener("click", () => this.close());
	}

	private formatBytes(bytes: number): string {
		if (!bytes || isNaN(bytes)) return "0 B";
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
		if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
		return `${(bytes / 1073741824).toFixed(1)} GB`;
	}

	onClose() {
		this.contentEl.empty();
	}
}
