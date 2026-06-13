import { App, Modal } from "obsidian";
import { GinkgoBackupClient } from "./api";
import { tryDecodeText } from "./encoding";
import { t } from "./i18n";
import type { HistoryDiff } from "./types";

export class FileDiffModal extends Modal {
	private client: GinkgoBackupClient;
	private sourceId: number;
	private filePath: string;
	private oldSnapshot: number;
	private newSnapshot: number;
	private repoPath?: string;
	private diff: HistoryDiff;

	constructor(
		app: App,
		client: GinkgoBackupClient,
		sourceId: number,
		filePath: string,
		oldSnapshot: number,
		newSnapshot: number,
		diff: HistoryDiff,
		repoPath?: string
	) {
		super(app);
		this.client = client;
		this.sourceId = sourceId;
		this.filePath = filePath;
		this.oldSnapshot = oldSnapshot;
		this.newSnapshot = newSnapshot;
		this.diff = diff;
		this.repoPath = repoPath;
	}

	async onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("ginkgo-file-diff-modal");

		contentEl.createEl("h2", { text: t("modal.diffTitle", { path: this.filePath }) });
		contentEl.createEl("div", {
			cls: "ginkgo-diff-meta",
			text: t("modal.diffSummary", { type: this.diff.diff_type, delta: this.diff.size_delta }),
		});

		const loadingEl = contentEl.createEl("div", { cls: "ginkgo-diff-loading", text: t("history.loadingDiff") });

		try {
			let oldContent = "";
			let newContent = "";

			try {
				const oldResp = await this.client.getFileContent(this.sourceId, this.filePath, this.oldSnapshot, this.repoPath);
				if (oldResp.content) {
					const decoded = tryDecodeText(oldResp.content);
					oldContent = decoded.ok ? decoded.text : oldResp.content;
				}
			} catch {
				oldContent = t("diff.unavailableOld");
			}

			try {
				const newResp = await this.client.getFileContent(this.sourceId, this.filePath, this.newSnapshot, this.repoPath);
				if (newResp.content) {
					const decoded = tryDecodeText(newResp.content);
					newContent = decoded.ok ? decoded.text : newResp.content;
				}
			} catch {
				newContent = t("diff.unavailableNew");
			}

			loadingEl.remove();
			this.renderDiff(contentEl, oldContent, newContent);
		} catch (err) {
			loadingEl.setText(t("history.loadFailed", { message: err instanceof Error ? err.message : String(err) }));
		}
	}

	private renderDiff(container: HTMLElement, oldContent: string, newContent: string) {
		const diffEl = container.createEl("div", { cls: "ginkgo-diff-viewer" });

		const contentEl = diffEl.createEl("div", { cls: "ginkgo-diff-content" });

		if (!oldContent && !newContent) {
			contentEl.createEl("div", { cls: "ginkgo-diff-empty", text: t("modal.diffEmpty") });
			return;
		}

		const grid = contentEl.createEl("div", { cls: "ginkgo-diff-grid" });

		const oldEl = grid.createEl("div", { cls: "ginkgo-diff-old" });
		oldEl.createEl("div", { cls: "ginkgo-diff-header", text: t("modal.diffOldVersion") });
		const oldPre = oldEl.createEl("pre");
		oldPre.setText(oldContent || t("modal.diffEmpty"));

		const newEl = grid.createEl("div", { cls: "ginkgo-diff-new" });
		newEl.createEl("div", { cls: "ginkgo-diff-header", text: t("modal.diffNewVersion") });
		const newPre = newEl.createEl("pre");
		newPre.setText(newContent || t("modal.diffEmpty"));
	}

	onClose() {
		this.contentEl.empty();
	}
}
