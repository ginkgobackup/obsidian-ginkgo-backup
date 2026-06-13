import { App, Modal, Notice } from "obsidian";
import { GinkgoBackupClient } from "./api";
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
		headerEl.createEl("span", { cls: "ginkgo-header-title", text: "恢复预览" });

		const infoEl = contentEl.createEl("div", { cls: "ginkgo-restore-info" });
		infoEl.createEl("div", { text: `文件: ${this.filePath}`, cls: "ginkgo-restore-path" });
		infoEl.createEl("div", { text: `版本: ${this.versionLabel}`, cls: "ginkgo-restore-version" });
		infoEl.createEl("div", { text: `大小: ${this.formatBytes(this.version.size)}`, cls: "ginkgo-restore-size" });

		if (this.version.is_deleted) {
			infoEl.createEl("div", { text: "⚠️ 此版本为删除状态", cls: "ginkgo-restore-deleted" });
		}

		const loadingEl = contentEl.createEl("div", { cls: "ginkgo-loading" });
		loadingEl.createEl("span", { text: "加载文件内容..." });

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
				try {
					content = decodeURIComponent(escape(atob(resp.content)));
				} catch {
					content = resp.content;
				}
			}
			if (resp.error) {
				content = `(读取失败: ${resp.error})`;
			}
			if (!content) {
				content = "(空文件)";
			}
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			content = `(无法获取内容: ${msg})`;
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
				text: `... 共 ${lines.length} 行，仅显示前 ${maxLines} 行`,
			});
		}

		const warningEl = contentEl.createEl("div", { cls: "ginkgo-restore-warning" });
		warningEl.createEl("span", { text: "⚠️ 恢复将覆盖当前文件内容" });

		const footerEl = contentEl.createEl("div", { cls: "ginkgo-modal-footer" });

		const restoreBtn = footerEl.createEl("button", {
			cls: "ginkgo-btn-restore",
			text: "确认恢复",
		});
		restoreBtn.addEventListener("click", async () => {
			restoreBtn.disabled = true;
			restoreBtn.textContent = "恢复中...";
			try {
				await this.onRestore();
				this.close();
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				new Notice(`Ginkgo: 恢复失败 — ${msg}`);
				restoreBtn.disabled = false;
				restoreBtn.textContent = "确认恢复";
			}
		});

		footerEl.createEl("button", { cls: "ginkgo-close-btn", text: "取消" })
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
