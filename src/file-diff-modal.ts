import { App, Modal } from "obsidian";
import { GinkgoBackupClient } from "./api";
import type { HistoryDiff, FileHistoryEntry } from "./types";

export class FileDiffModal extends Modal {
	private client: GinkgoBackupClient;
	private sourceId: number;
	private filePath: string;
	private oldSnapshot: number;
	private newSnapshot: number;
	private oldLabel: string;
	private newLabel: string;

	constructor(
		app: App,
		client: GinkgoBackupClient,
		sourceId: number,
		filePath: string,
		oldSnapshot: number,
		newSnapshot: number,
		oldLabel: string,
		newLabel: string
	) {
		super(app);
		this.client = client;
		this.sourceId = sourceId;
		this.filePath = filePath;
		this.oldSnapshot = oldSnapshot;
		this.newSnapshot = newSnapshot;
		this.oldLabel = oldLabel;
		this.newLabel = newLabel;
	}

	async onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("ginkgo-diff-modal");

		const headerEl = contentEl.createEl("div", { cls: "ginkgo-header" });
		headerEl.createEl("span", { cls: "ginkgo-header-title", text: "版本对比" });
		headerEl.createEl("div", { cls: "ginkgo-header-path", text: this.filePath });

		const loadingEl = contentEl.createEl("div", { cls: "ginkgo-loading" });
		loadingEl.createEl("span", { text: "加载中..." });

		try {
			const diff = await this.client.getFileDiff(
				this.sourceId,
				this.filePath,
				this.oldSnapshot,
				this.newSnapshot
			);

			let oldContent = "";
			let newContent = "";

			try {
				const oldResp = await this.client.getFileContent(this.sourceId, this.filePath, this.oldSnapshot);
				oldContent = oldResp.content ?? "";
			} catch {
				oldContent = "(无法获取旧版本内容)";
			}

			try {
				const newResp = await this.client.getFileContent(this.sourceId, this.filePath, this.newSnapshot);
				newContent = newResp.content ?? "";
			} catch {
				newContent = "(无法获取新版本内容)";
			}

			loadingEl.remove();
			this.renderDiff(contentEl, diff, oldContent, newContent);
		} catch (err) {
			loadingEl.remove();
			const msg = err instanceof Error ? err.message : String(err);
			contentEl.createEl("div", { cls: "ginkgo-error", text: `加载失败: ${msg}` });
		}
	}

	private renderDiff(contentEl: HTMLElement, diff: HistoryDiff, oldContent: string, newContent: string) {
		const summaryEl = contentEl.createEl("div", { cls: "ginkgo-diff-summary" });

		const typeBadge = summaryEl.createEl("span", {
			cls: `ginkgo-diff-type ginkgo-diff-type-${diff.diff_type}`,
		});
		switch (diff.diff_type) {
			case "unchanged":
				typeBadge.setText("无变化");
				break;
			case "modified":
				typeBadge.setText("已修改");
				break;
			case "deleted":
				typeBadge.setText("已删除");
				break;
			case "restored":
				typeBadge.setText("已恢复");
				break;
		}

		if (diff.size_delta !== 0) {
			const isPositive = diff.size_delta > 0;
			summaryEl.createEl("span", {
				cls: `ginkgo-diff-size ${isPositive ? "is-positive" : "is-negative"}`,
				text: `${isPositive ? "+" : ""}${this.formatBytes(diff.size_delta)}`,
			});
		}

		if (diff.diff_type === "unchanged") {
			contentEl.createEl("div", { cls: "ginkgo-diff-unchanged", text: "两个版本内容相同" });
			this.renderFooter(contentEl);
			return;
		}

		const diffContainer = contentEl.createEl("div", { cls: "ginkgo-diff-container" });

		const oldPanel = diffContainer.createEl("div", { cls: "ginkgo-diff-panel" });
		oldPanel.createEl("div", { cls: "ginkgo-diff-panel-header", text: this.oldLabel });
		const oldCode = oldPanel.createEl("pre", { cls: "ginkgo-diff-code" });
		oldCode.createEl("code", { text: oldContent });

		const newPanel = diffContainer.createEl("div", { cls: "ginkgo-diff-panel" });
		newPanel.createEl("div", { cls: "ginkgo-diff-panel-header", text: this.newLabel });
		const newCode = newPanel.createEl("pre", { cls: "ginkgo-diff-code" });
		newCode.createEl("code", { text: newContent });

		this.renderInlineDiff(diffContainer, oldContent, newContent);

		this.renderFooter(contentEl);
	}

	private renderInlineDiff(container: HTMLElement, oldContent: string, newContent: string) {
		const oldLines = oldContent.split("\n");
		const newLines = newContent.split("\n");

		const diffEl = container.createEl("div", { cls: "ginkgo-inline-diff" });
		diffEl.createEl("div", { cls: "ginkgo-diff-section-title", text: "差异" });

		const maxLen = Math.max(oldLines.length, newLines.length);
		let hasDiff = false;

		for (let i = 0; i < maxLen; i++) {
			const oldLine = oldLines[i];
			const newLine = newLines[i];

			if (oldLine === undefined && newLine !== undefined) {
				hasDiff = true;
				const lineEl = diffEl.createEl("div", { cls: "ginkgo-diff-line ginkgo-diff-added" });
				lineEl.createEl("span", { cls: "ginkgo-line-num", text: `+${i + 1}` });
				lineEl.createEl("span", { cls: "ginkgo-line-content", text: newLine });
			} else if (oldLine !== undefined && newLine === undefined) {
				hasDiff = true;
				const lineEl = diffEl.createEl("div", { cls: "ginkgo-diff-line ginkgo-diff-removed" });
				lineEl.createEl("span", { cls: "ginkgo-line-num", text: `-${i + 1}` });
				lineEl.createEl("span", { cls: "ginkgo-line-content", text: oldLine });
			} else if (oldLine !== newLine) {
				hasDiff = true;
				const removedEl = diffEl.createEl("div", { cls: "ginkgo-diff-line ginkgo-diff-removed" });
				removedEl.createEl("span", { cls: "ginkgo-line-num", text: `-${i + 1}` });
				removedEl.createEl("span", { cls: "ginkgo-line-content", text: oldLine });

				const addedEl = diffEl.createEl("div", { cls: "ginkgo-diff-line ginkgo-diff-added" });
				addedEl.createEl("span", { cls: "ginkgo-line-num", text: `+${i + 1}` });
				addedEl.createEl("span", { cls: "ginkgo-line-content", text: newLine });
			}
		}

		if (!hasDiff) {
			diffEl.createEl("div", { cls: "ginkgo-diff-unchanged", text: "内容相同" });
		}
	}

	private renderFooter(contentEl: HTMLElement) {
		const footerEl = contentEl.createEl("div", { cls: "ginkgo-modal-footer" });
		footerEl.createEl("button", { cls: "ginkgo-close-btn", text: "关闭" })
			.addEventListener("click", () => this.close());
	}

	private formatBytes(bytes: number): string {
		if (!bytes || isNaN(bytes)) return "0 B";
		const sign = bytes < 0 ? "-" : "";
		bytes = Math.abs(bytes);
		if (bytes === 0) return "0 B";
		const k = 1024;
		const sizes = ["B", "KB", "MB", "GB"];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return sign + parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[Math.min(i, sizes.length - 1)];
	}

	onClose() {
		this.contentEl.empty();
	}
}
