import { App, Modal, Notice, TFile, setIcon } from "obsidian";
import { GinkgoBackupClient } from "./api";
import { encodeText, tryDecodeText } from "./encoding";
import { t } from "./i18n";
import { tsToDate, formatBytes, logError, isSentinelTs, effectiveTs, LCS_FALLBACK_THRESHOLD } from "./utils";
import type { FileHistoryEntry } from "./types";
import type GinkgoBackupPlugin from "./main";

interface DiffLine {
	type: "added" | "removed" | "unchanged";
	text: string;
}

function computeLCS(oldLines: string[], newLines: string[]): DiffLine[] {
	const m = oldLines.length;
	const n = newLines.length;
	if (m === 0) return newLines.map(l => ({ type: "added" as const, text: l }));
	if (n === 0) return oldLines.map(l => ({ type: "removed" as const, text: l }));
	if (m * n > LCS_FALLBACK_THRESHOLD) return computeSimpleDiff(oldLines, newLines);

	const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
	for (let i = 1; i <= m; i++) {
		for (let j = 1; j <= n; j++) {
			dp[i][j] = oldLines[i - 1] === newLines[j - 1]
				? dp[i - 1][j - 1] + 1
				: Math.max(dp[i - 1][j], dp[i][j - 1]);
		}
	}

	const result: DiffLine[] = [];
	let i = m, j = n;
	while (i > 0 || j > 0) {
		if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
			result.unshift({ type: "unchanged", text: oldLines[i - 1] });
			i--; j--;
		} else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
			result.unshift({ type: "added", text: newLines[j - 1] });
			j--;
		} else {
			result.unshift({ type: "removed", text: oldLines[i - 1] });
			i--;
		}
	}
	return result;
}

function computeSimpleDiff(oldLines: string[], newLines: string[]): DiffLine[] {
	const result: DiffLine[] = [];
	const maxLen = Math.max(oldLines.length, newLines.length);
	for (let i = 0; i < maxLen; i++) {
		const oLine = i < oldLines.length ? oldLines[i] : undefined;
		const nLine = i < newLines.length ? newLines[i] : undefined;
		if (oLine !== undefined && nLine !== undefined && oLine === nLine) {
			result.push({ type: "unchanged", text: oLine });
		} else {
			if (oLine !== undefined) result.push({ type: "removed", text: oLine });
			if (nLine !== undefined) result.push({ type: "added", text: nLine });
		}
	}
	return result;
}

function extractDiffOnly(lines: DiffLine[], contextLines: number): DiffLine[] {
	const changeIndices: number[] = [];
	for (let i = 0; i < lines.length; i++) {
		if (lines[i].type !== "unchanged") changeIndices.push(i);
	}
	if (changeIndices.length === 0) return [];

	const included = new Set<number>();
	for (const idx of changeIndices) {
		for (let c = -contextLines; c <= contextLines; c++) {
			const target = idx + c;
			if (target >= 0 && target < lines.length) included.add(target);
		}
	}

	const sorted = [...included].sort((a, b) => a - b);
	const result: DiffLine[] = [];
	let lastIdx = -2;
	for (const idx of sorted) {
		if (idx > lastIdx + 1) {
			result.push({ type: "unchanged", text: "..." });
		}
		result.push(lines[idx]);
		lastIdx = idx;
	}
	return result;
}

export class FileHistoryModal extends Modal {
	private client: GinkgoBackupClient;
	private sourceId: number;
	private filePath: string;
	private repoPath: string;
	private plugin: GinkgoBackupPlugin | null;
	private versions: FileHistoryEntry[] = [];
	private selectedIdx: number | null = null;
	private compareIdx: number | null = null;
	private currentContent: string = "";
	private diffEl!: HTMLElement;
	private restoreBtn!: HTMLButtonElement;
	private listEl!: HTMLElement;

	constructor(app: App, client: GinkgoBackupClient, sourceId: number, filePath: string, repoPath: string, plugin: GinkgoBackupPlugin | null = null) {
		super(app);
		this.client = client;
		this.sourceId = sourceId;
		this.filePath = filePath;
		this.repoPath = repoPath;
		this.plugin = plugin;
	}

	async onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("ginkgo-file-history-modal");

		const modalEl = contentEl.closest(".modal") as HTMLElement;
		if (modalEl) {
			modalEl.style.width = "800px";
			modalEl.style.maxWidth = "90vw";
		}

		this.renderHeader(contentEl);

		const loadingEl = contentEl.createEl("div", { cls: "ginkgo-loading" });
		loadingEl.createEl("span", { text: t("history.loading") });

		try {
			const [versions, currentContent] = await Promise.all([
				this.client.getFileHistory(this.sourceId, this.filePath, this.repoPath),
				this.readCurrentFile(),
			]);
			this.versions = versions;
			this.currentContent = currentContent;
			loadingEl.remove();

			if (this.versions.length === 0) {
				contentEl.createEl("div", { cls: "ginkgo-empty", text: t("history.noHistory") });
				return;
			}

			this.renderBody(contentEl);
		} catch (err) {
			loadingEl.remove();
			const msg = err instanceof Error ? err.message : String(err);
			contentEl.createEl("div", { cls: "ginkgo-error", text: t("history.loadFailed", { message: msg }) });
		}
	}

	private renderHeader(contentEl: HTMLElement) {
		const headerEl = contentEl.createEl("div", { cls: "ginkgo-fh-header" });
		headerEl.createEl("span", { cls: "ginkgo-fh-title", text: t("history.title") });
		headerEl.createEl("span", { cls: "ginkgo-fh-filename", text: this.getFileName() });
	}

	private renderBody(contentEl: HTMLElement) {
		const bodyEl = contentEl.createEl("div", { cls: "ginkgo-fh-body" });

		const leftEl = bodyEl.createEl("div", { cls: "ginkgo-fh-versions" });
		leftEl.createEl("div", { cls: "ginkgo-fh-section-label", text: t("history.versionCount", { count: this.versions.length }) });
		this.listEl = leftEl.createEl("div", { cls: "ginkgo-fh-list" });
		this.renderVersionList();

		const rightEl = bodyEl.createEl("div", { cls: "ginkgo-fh-preview" });
		rightEl.createEl("div", { cls: "ginkgo-fh-section-label", text: t("history.diffTitle") });
		this.diffEl = rightEl.createEl("div", { cls: "ginkgo-fh-diff" });
		this.diffEl.createEl("div", { cls: "ginkgo-fh-diff-empty", text: t("history.diffHint") });

		const footerEl = contentEl.createEl("div", { cls: "ginkgo-fh-footer" });
		this.restoreBtn = footerEl.createEl("button", {
			cls: "ginkgo-btn-restore",
			text: t("history.restoreThisVersion"),
		});
		this.restoreBtn.disabled = true;
		this.restoreBtn.addEventListener("click", () => this.restoreSelectedVersion());

		footerEl.createEl("button", { cls: "ginkgo-close-btn", text: t("history.close") })
			.addEventListener("click", () => this.close());
	}

	private isSentinelTs(ts: number): boolean {
		return isSentinelTs(ts);
	}

	private effectiveTs(version: FileHistoryEntry): number {
		return effectiveTs(version.first_seen, version.last_seen);
	}

	private tsToDate(ts: number): Date {
		return tsToDate(ts);
	}

	private renderVersionList() {
		this.listEl.empty();

		for (let i = 0; i < this.versions.length; i++) {
			const version = this.versions[i];
			const isLatest = i === 0;
			const isFirst = i === this.versions.length - 1;
			const isSelected = this.selectedIdx === i;
			const isComparing = this.compareIdx === i;
			const isCurrent = this.isSentinelTs(version.last_seen);

			const itemEl = this.listEl.createEl("div", {
				cls: `ginkgo-fh-item ${isSelected ? "is-selected" : ""} ${isComparing ? "is-comparing" : ""}`,
			});

			const trackEl = itemEl.createEl("div", { cls: "ginkgo-fh-track" });
			if (isComparing) {
				const markerEl = trackEl.createEl("div", { cls: "ginkgo-fh-compare-marker" });
				setIcon(markerEl, "git-branch");
			} else if (isSelected) {
				const checkEl = trackEl.createEl("div", { cls: "ginkgo-fh-check" });
				setIcon(checkEl, "check");
			} else {
				trackEl.createEl("div", { cls: `ginkgo-fh-dot ${isLatest ? "is-latest" : ""} ${isCurrent ? "is-current" : ""}` });
			}

			const infoEl = itemEl.createEl("div", { cls: "ginkgo-fh-info" });
			infoEl.addEventListener("click", () => this.handleSelect(i));

			const timeEl = infoEl.createEl("div", { cls: "ginkgo-fh-time" });
			if (isCurrent) {
				timeEl.createEl("span", { cls: "ginkgo-fh-reltime", text: t("history.currentVersion") });
				timeEl.createEl("span", { cls: "ginkgo-fh-abstime", text: this.formatTime(version.first_seen) });
			} else {
				timeEl.createEl("span", { cls: "ginkgo-fh-reltime", text: this.relativeTime(version.last_seen) });
				timeEl.createEl("span", { cls: "ginkgo-fh-abstime", text: this.formatTime(version.last_seen) });
			}

			const metaEl = infoEl.createEl("div", { cls: "ginkgo-fh-meta" });
			metaEl.createEl("span", { cls: "ginkgo-fh-size", text: this.formatBytes(version.size) });

			if (isLatest && !isCurrent) {
				metaEl.createEl("span", { cls: "ginkgo-fh-badge ginkgo-fh-badge-latest", text: t("history.latest") });
			} else if (isFirst) {
				metaEl.createEl("span", { cls: "ginkgo-fh-badge ginkgo-fh-badge-first", text: t("history.first") });
			} else if (i < this.versions.length - 1) {
				const prevSize = this.versions[i + 1].size;
				const delta = version.size - prevSize;
				if (delta !== 0) {
					const isUp = delta > 0;
					metaEl.createEl("span", {
						cls: `ginkgo-fh-delta ${isUp ? "is-up" : "is-down"}`,
						text: `${isUp ? "+" : ""}${this.formatBytes(delta)}`,
					});
				}
			}

			if (version.is_deleted) {
				metaEl.createEl("span", { cls: "ginkgo-fh-badge ginkgo-fh-badge-deleted", text: t("history.deleted") });
			}

			if (isSelected) {
				metaEl.createEl("span", { cls: "ginkgo-fh-badge ginkgo-fh-badge-b", text: "B" });
			}
			if (isComparing) {
				metaEl.createEl("span", { cls: "ginkgo-fh-badge ginkgo-fh-badge-a", text: "A" });
			}

			if (this.selectedIdx !== null && i !== this.selectedIdx) {
				const compareBtn = itemEl.createEl("button", {
					cls: `ginkgo-fh-compare-btn ${isComparing ? "is-active" : ""}`,
					text: isComparing ? t("history.cancelCompare") : t("history.compare"),
				});
				compareBtn.addEventListener("click", (e: MouseEvent) => {
					e.stopPropagation();
					this.handleCompare(i);
				});
			}
		}
	}

	private handleSelect(idx: number) {
		if (this.selectedIdx === idx) {
			this.selectedIdx = null;
			this.compareIdx = null;
		} else {
			this.selectedIdx = idx;
		}
		this.renderVersionList();
		this.restoreBtn.disabled = this.selectedIdx === null;

		if (this.selectedIdx !== null && this.compareIdx !== null && this.selectedIdx !== this.compareIdx) {
			this.loadCompareDiff();
		} else if (this.selectedIdx !== null) {
			this.loadCurrentDiff();
		} else {
			this.diffEl.empty();
			this.diffEl.createEl("div", { cls: "ginkgo-fh-diff-empty", text: t("history.diffHint") });
		}
	}

	private handleCompare(idx: number) {
		if (this.compareIdx === idx) {
			this.compareIdx = null;
		} else {
			this.compareIdx = idx;
		}
		this.renderVersionList();

		if (this.selectedIdx !== null && this.compareIdx !== null && this.selectedIdx !== this.compareIdx) {
			this.loadCompareDiff();
		} else if (this.selectedIdx !== null) {
			this.loadCurrentDiff();
		}
	}

	private async loadCurrentDiff() {
		if (this.selectedIdx === null) return;
		const version = this.versions[this.selectedIdx];

		this.diffEl.empty();
		this.diffEl.createEl("div", { cls: "ginkgo-fh-diff-loading", text: t("history.loadingDiff") });

		try {
			if (this.isSentinelTs(version.last_seen)) {
				this.renderDiff(this.diffEl, this.currentContent, this.currentContent, t("history.currentVersion"), t("history.currentVersion"));
				return;
			}

			const snapshotTime = this.effectiveTs(version);
			const resp = await this.client.getFileContent(this.sourceId, this.filePath, snapshotTime, this.repoPath);
			let versionContent = "";
			if (resp.content) {
				const decoded = tryDecodeText(resp.content);
				versionContent = decoded.ok ? decoded.text : resp.content;
			}
			if (resp.error) {
				this.diffEl.empty();
				this.diffEl.createEl("div", { cls: "ginkgo-error", text: t("history.contentFailed", { message: resp.error }) });
				return;
			}
			this.renderDiff(this.diffEl, versionContent, this.currentContent, this.formatTime(version.first_seen), t("modal.diffOldVersion"));
		} catch (err) {
			this.diffEl.empty();
			const msg = err instanceof Error ? err.message : String(err);
			this.diffEl.createEl("div", { cls: "ginkgo-error", text: t("history.loadFailed", { message: msg }) });
		}
	}

	private async loadCompareDiff() {
		if (this.selectedIdx === null || this.compareIdx === null) return;

		const aVersion = this.versions[this.compareIdx];
		const bVersion = this.versions[this.selectedIdx];

		this.diffEl.empty();
		this.diffEl.createEl("div", { cls: "ginkgo-fh-diff-loading", text: t("history.loadingTwoVersions") });

		try {
			const [aResp, bResp] = await Promise.all([
				this.isSentinelTs(aVersion.last_seen)
					? { content: encodeText(this.currentContent), error: "" }
					: this.client.getFileContent(this.sourceId, this.filePath, this.effectiveTs(aVersion), this.repoPath),
				this.isSentinelTs(bVersion.last_seen)
					? { content: encodeText(this.currentContent), error: "" }
					: this.client.getFileContent(this.sourceId, this.filePath, this.effectiveTs(bVersion), this.repoPath),
			]);

			let aContent = "";
			let bContent = "";
			if (aResp.content) {
				const aDecoded = tryDecodeText(aResp.content);
				aContent = aDecoded.ok ? aDecoded.text : aResp.content;
			}
			if (bResp.content) {
				const bDecoded = tryDecodeText(bResp.content);
				bContent = bDecoded.ok ? bDecoded.text : bResp.content;
			}

			const aLabel = this.isSentinelTs(aVersion.last_seen) ? t("history.currentVersion") : this.formatTime(aVersion.first_seen);
			const bLabel = this.isSentinelTs(bVersion.last_seen) ? t("history.currentVersion") : this.formatTime(bVersion.first_seen);

			this.renderDiff(this.diffEl, aContent, bContent, aLabel, bLabel);
		} catch (err) {
			this.diffEl.empty();
			const msg = err instanceof Error ? err.message : String(err);
			this.diffEl.createEl("div", { cls: "ginkgo-error", text: t("history.loadFailed", { message: msg }) });
		}
	}

	private renderDiff(container: HTMLElement, oldContent: string, newContent: string, oldLabel: string, newLabel: string) {
		container.empty();

		const normalizedOld = oldContent.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
		const normalizedNew = newContent.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

		const oldLines = normalizedOld.split("\n");
		const newLines = normalizedNew.split("\n");
		if (oldLines.length > 0 && oldLines[oldLines.length - 1] === "") oldLines.pop();
		if (newLines.length > 0 && newLines[newLines.length - 1] === "") newLines.pop();

		const diffLines = computeLCS(oldLines, newLines);

		let added = 0;
		let removed = 0;
		for (const l of diffLines) {
			if (l.type === "added") added++;
			else if (l.type === "removed") removed++;
		}

		const headerEl = container.createEl("div", { cls: "ginkgo-fh-diff-header" });
		const labelEl = headerEl.createEl("div", { cls: "ginkgo-fh-diff-labels" });
		labelEl.createEl("span", { cls: "ginkgo-fh-diff-label-a", text: `A: ${oldLabel}` });
		const arrowEl = labelEl.createEl("span", { cls: "ginkgo-fh-diff-arrow" });
		setIcon(arrowEl, "arrow-right");
		labelEl.createEl("span", { cls: "ginkgo-fh-diff-label-b", text: `B: ${newLabel}` });

		if (added === 0 && removed === 0) {
			headerEl.createEl("span", { cls: "ginkgo-fh-diff-identical", text: t("history.identical") });
			return;
		}

		const statsEl = headerEl.createEl("div", { cls: "ginkgo-fh-diff-stats" });
		if (removed > 0) statsEl.createEl("span", { cls: "ginkgo-fh-stat-remove", text: `-${removed}` });
		if (added > 0) statsEl.createEl("span", { cls: "ginkgo-fh-stat-add", text: `+${added}` });

		const diffOnly = extractDiffOnly(diffLines, 1);

		const codeEl = container.createEl("div", { cls: "ginkgo-fh-diff-code" });
		for (const line of diffOnly) {
			const lineEl = codeEl.createEl("div", {
				cls: `ginkgo-fh-diff-line ${line.type === "added" ? "is-add" : line.type === "removed" ? "is-remove" : line.text === "..." ? "is-fold" : "is-same"}`,
			});

			if (line.text === "...") {
				lineEl.createEl("span", { cls: "ginkgo-fh-diff-fold-text", text: "⋯" });
				continue;
			}

			const signEl = lineEl.createEl("span", { cls: "ginkgo-fh-diff-sign" });
			signEl.setText(line.type === "added" ? "+" : line.type === "removed" ? "-" : " ");
			lineEl.createEl("span", { cls: "ginkgo-fh-diff-content" }).setText(line.text);
		}
	}

	private async restoreSelectedVersion() {
		if (this.selectedIdx === null) return;
		const version = this.versions[this.selectedIdx];

		const snapshotTime = this.effectiveTs(version);
		const versionLabel = this.isSentinelTs(version.last_seen)
			? t("history.currentVersion")
			: this.formatTime(version.last_seen);

		const { RestorePreviewModal } = await import("./restore-preview-modal");
		const modal = new RestorePreviewModal(
			this.app, this.client, this.sourceId, this.filePath, version, versionLabel, this.repoPath,
			async () => {
				try {
					const resp = await this.client.getFileContent(this.sourceId, this.filePath, snapshotTime, this.repoPath);
					let versionContent = "";
					if (resp.content) {
						const decoded = tryDecodeText(resp.content);
						versionContent = decoded.ok ? decoded.text : resp.content;
					}

					let file = this.app.vault.getAbstractFileByPath(this.filePath);
					if (!file) {
						const allFiles = this.app.vault.getFiles();
						const matches = allFiles.filter(f => f.name === this.filePath || f.path.endsWith("/" + this.filePath) || f.path === this.filePath);
						if (matches.length > 0) file = matches[0];
					}

					// 恢复前先把当前文件内容推到 staging，避免本地未推送的改动被覆盖丢失
					if (file instanceof TFile && this.plugin) {
						await this.plugin.stagingManager.stagingPushFile(file).catch((err) => {
							logError("pre-restore backup push failed", err);
							// 推送失败仅告警，不阻塞恢复（用户已通过预览 Modal 确认）
							new Notice(t("restore.warning"), 5000);
						});
					}

					if (file instanceof TFile) {
						await this.app.vault.modify(file, versionContent);
					} else {
						const dirPath = this.filePath.includes("/") ? this.filePath.substring(0, this.filePath.lastIndexOf("/")) : "";
						if (dirPath) await this.app.vault.createFolder(dirPath).catch((err) => this.logError("create folder failed", err));
						await this.app.vault.create(this.filePath, versionContent);
					}

					this.currentContent = versionContent;
					new Notice(t("history.restored"));
					this.close();
				} catch (err) {
					const msg = err instanceof Error ? err.message : String(err);
					new Notice(t("restore.failed", { message: msg }));
				}
			}
		);
		modal.open();
	}

	private async readCurrentFile(): Promise<string> {
		try {
			let file = this.app.vault.getAbstractFileByPath(this.filePath);
			if (!file) {
				const allFiles = this.app.vault.getFiles();
				const matches = allFiles.filter(f => f.name === this.filePath || f.path.endsWith("/" + this.filePath) || f.path === this.filePath);
				if (matches.length > 0) file = matches[0];
			}
			if (!file || !(file instanceof TFile)) return "";
			return await this.app.vault.read(file);
		} catch (err) {
			this.logError("read current file failed", err);
			return "";
		}
	}

	private getFileName(): string {
		const parts = this.filePath.split(/[/\\]/);
		return parts[parts.length - 1] || this.filePath;
	}

	private relativeTime(ts: number): string {
		const date = this.tsToDate(ts);
		if (isNaN(date.getTime())) return String(ts);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffSec = Math.floor(diffMs / 1000);
		const diffMin = Math.floor(diffSec / 60);
		const diffHour = Math.floor(diffMin / 60);

		if (diffSec < 60) return t("time.justNow");
		if (diffMin < 60) return t("time.minutesAgo", { count: diffMin });
		if (diffHour < 24) return t("time.hoursAgo", { count: diffHour });

		const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
		const targetDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
		const dayDiff = Math.floor((today.getTime() - targetDay.getTime()) / 86400000);

		if (dayDiff === 0) return t("time.today");
		if (dayDiff === 1) return t("time.yesterday");
		if (dayDiff < 7) return t("time.daysAgo", { count: dayDiff });
		if (dayDiff < 30) return t("time.weeksAgo", { count: Math.floor(dayDiff / 7) });

		const m = String(date.getMonth() + 1).padStart(2, "0");
		const d = String(date.getDate()).padStart(2, "0");
		return `${date.getFullYear()}-${m}-${d}`;
	}

	private formatTime(ts: number): string {
		const date = this.tsToDate(ts);
		if (isNaN(date.getTime())) return String(ts);
		return date.toLocaleString();
	}

	private formatBytes(bytes: number): string {
		return formatBytes(bytes);
	}

	private logError(context: string, err: unknown) {
		logError(context, err);
	}

	onClose() {
		this.contentEl.empty();
	}
}
