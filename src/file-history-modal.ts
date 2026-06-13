import { App, Modal, Notice, TFile, setIcon } from "obsidian";
import * as Diff from "diff";
import { GinkgoBackupClient } from "./api";
import type { FileHistoryEntry } from "./types";

export class FileHistoryModal extends Modal {
	private client: GinkgoBackupClient;
	private sourceId: number;
	private filePath: string;
	private repoPath: string;
	private versions: FileHistoryEntry[] = [];
	private selectedVersion: FileHistoryEntry | null = null;
	private compareVersion: FileHistoryEntry | null = null;
	private currentContent: string = "";
	private diffEl!: HTMLElement;
	private restoreBtn!: HTMLButtonElement;
	private compareBtn!: HTMLButtonElement;
	private listEl!: HTMLElement;

	constructor(app: App, client: GinkgoBackupClient, sourceId: number, filePath: string, repoPath: string) {
		super(app);
		this.client = client;
		this.sourceId = sourceId;
		this.filePath = filePath;
		this.repoPath = repoPath;
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
		loadingEl.createEl("span", { text: "加载中..." });

		try {
			const [versions, currentContent] = await Promise.all([
				this.client.getFileHistory(this.sourceId, this.filePath, this.repoPath),
				this.readCurrentFile(),
			]);
			this.versions = versions;
			this.currentContent = currentContent;
			loadingEl.remove();

			if (this.versions.length === 0) {
				contentEl.createEl("div", { cls: "ginkgo-empty", text: "暂无备份历史" });
				return;
			}

			this.renderBody(contentEl);
		} catch (err) {
			loadingEl.remove();
			const msg = err instanceof Error ? err.message : String(err);
			contentEl.createEl("div", { cls: "ginkgo-error", text: `加载失败: ${msg}` });
		}
	}

	private renderHeader(contentEl: HTMLElement) {
		const headerEl = contentEl.createEl("div", { cls: "ginkgo-fh-header" });
		headerEl.createEl("span", { cls: "ginkgo-fh-title", text: "版本历史" });
		headerEl.createEl("span", { cls: "ginkgo-fh-filename", text: this.getFileName() });
	}

	private renderBody(contentEl: HTMLElement) {
		const bodyEl = contentEl.createEl("div", { cls: "ginkgo-fh-body" });

		const leftEl = bodyEl.createEl("div", { cls: "ginkgo-fh-versions" });
		leftEl.createEl("div", { cls: "ginkgo-fh-section-label", text: `共 ${this.versions.length} 个版本` });
		this.listEl = leftEl.createEl("div", { cls: "ginkgo-fh-list" });
		this.renderVersionList();

		const rightEl = bodyEl.createEl("div", { cls: "ginkgo-fh-preview" });
		rightEl.createEl("div", { cls: "ginkgo-fh-section-label", text: "与当前文件的差异" });
		this.diffEl = rightEl.createEl("div", { cls: "ginkgo-fh-diff" });
		this.diffEl.createEl("div", { cls: "ginkgo-fh-diff-empty", text: "点击左侧版本查看差异" });

		const footerEl = contentEl.createEl("div", { cls: "ginkgo-fh-footer" });
		this.restoreBtn = footerEl.createEl("button", {
			cls: "ginkgo-btn-restore",
			text: "恢复此版本",
		});
		this.restoreBtn.disabled = true;
		this.restoreBtn.addEventListener("click", () => this.restoreSelectedVersion());

		this.compareBtn = footerEl.createEl("button", {
			cls: "ginkgo-btn-compare",
			text: "对比两个版本",
		});
		this.compareBtn.disabled = true;
		this.compareBtn.addEventListener("click", () => this.openCompareModal());

		footerEl.createEl("button", { cls: "ginkgo-close-btn", text: "关闭" })
			.addEventListener("click", () => this.close());
	}

	private isSentinelTs(ts: number): boolean {
		return ts > 9000000000000;
	}

	private effectiveTs(version: FileHistoryEntry): number {
		if (this.isSentinelTs(version.last_seen)) {
			return version.first_seen;
		}
		return version.last_seen;
	}

	private tsToDate(ts: number): Date {
		if (ts > 1e15) {
			return new Date(ts / 1000000);
		}
		return new Date(ts);
	}

	private renderVersionList() {
		this.listEl.empty();

		for (let i = 0; i < this.versions.length; i++) {
			const version = this.versions[i];
			const isLatest = i === 0;
			const isSelected = this.selectedVersion === version;
			const isCompareBase = this.compareVersion === version;
			const isCurrent = this.isSentinelTs(version.last_seen);

			const itemEl = this.listEl.createEl("div", {
				cls: `ginkgo-fh-item ${isSelected ? "is-selected" : ""} ${isCompareBase ? "is-compare-base" : ""} ${isLatest ? "is-latest" : ""}`,
			});

			itemEl.addEventListener("click", (evt: MouseEvent) => {
			if (this.compareVersion) {
				if (version === this.compareVersion) {
					this.deselectVersion();
				} else {
					this.selectVersion(version);
				}
			} else if (this.selectedVersion === version) {
				this.deselectVersion();
			} else if (evt.shiftKey && this.selectedVersion) {
				this.compareVersion = this.selectedVersion;
				this.selectVersion(version);
			} else {
				this.selectVersion(version);
			}
		});

		const trackEl = itemEl.createEl("div", { cls: "ginkgo-fh-track" });
		if (isCompareBase) {
			const baseEl = trackEl.createEl("div", { cls: "ginkgo-fh-compare-marker" });
			setIcon(baseEl, "git-branch");
		} else if (isSelected) {
			const checkEl = trackEl.createEl("div", { cls: "ginkgo-fh-check" });
			setIcon(checkEl, "check");
		} else {
			trackEl.createEl("div", { cls: `ginkgo-fh-dot ${isLatest ? "is-latest" : ""}` });
		}

			const infoEl = itemEl.createEl("div", { cls: "ginkgo-fh-info" });
			const timeEl = infoEl.createEl("div", { cls: "ginkgo-fh-time" });

			if (isCurrent) {
				timeEl.createEl("span", { cls: "ginkgo-fh-reltime", text: "当前版本" });
				timeEl.createEl("span", { cls: "ginkgo-fh-abstime", text: this.formatTime(version.first_seen) });
			} else {
				timeEl.createEl("span", { cls: "ginkgo-fh-reltime", text: this.relativeTime(version.last_seen) });
				timeEl.createEl("span", { cls: "ginkgo-fh-abstime", text: this.formatTime(version.last_seen) });
			}

			const metaEl = infoEl.createEl("div", { cls: "ginkgo-fh-meta" });
			metaEl.createEl("span", { cls: "ginkgo-fh-size", text: this.formatBytes(version.size) });

			if (isLatest) {
				metaEl.createEl("span", { cls: "ginkgo-fh-badge ginkgo-fh-badge-latest", text: "最新" });
			} else if (i === this.versions.length - 1) {
				metaEl.createEl("span", { cls: "ginkgo-fh-badge ginkgo-fh-badge-first", text: "首次" });
			} else {
				const prevSize = this.versions[i + 1].size;
				const delta = version.size - prevSize;
				if (delta !== 0) {
					const isPositive = delta > 0;
					metaEl.createEl("span", {
						cls: `ginkgo-fh-delta ${isPositive ? "is-up" : "is-down"}`,
						text: `${isPositive ? "+" : ""}${this.formatBytes(delta)}`,
					});
				}
			}

			if (version.is_deleted) {
				metaEl.createEl("span", { cls: "ginkgo-fh-badge ginkgo-fh-badge-deleted", text: "已删除" });
			}
		}
	}

	private deselectVersion() {
		if (this.compareVersion && this.selectedVersion) {
			this.selectedVersion = null;
			this.compareVersion = null;
		} else {
			this.selectedVersion = null;
		}
		this.renderVersionList();
		this.restoreBtn.disabled = true;
		this.restoreBtn.textContent = "恢复此版本";
		this.compareBtn.disabled = true;
		this.diffEl.empty();
		this.diffEl.createEl("div", { cls: "ginkgo-fh-diff-empty", text: "点击左侧版本查看差异" });
	}

	private async selectVersion(version: FileHistoryEntry) {
		if (this.compareVersion) {
			if (this.compareVersion === version) {
				this.compareVersion = null;
				this.selectedVersion = null;
			} else {
				this.selectedVersion = version;
				this.compareBtn.disabled = false;
			}
			this.renderVersionList();
			this.restoreBtn.disabled = !this.selectedVersion;
			return;
		}

		this.selectedVersion = version;
		this.renderVersionList();
		this.restoreBtn.disabled = false;
		this.restoreBtn.textContent = "恢复此版本";
		this.compareBtn.disabled = true;

		this.diffEl.empty();
		this.diffEl.createEl("div", { cls: "ginkgo-fh-diff-loading", text: "加载差异..." });

		try {
			if (this.isSentinelTs(version.last_seen)) {
				this.renderDiff(this.diffEl, this.currentContent, this.currentContent);
				return;
			}

			const snapshotTime = this.effectiveTs(version);
			const resp = await this.client.getFileContent(this.sourceId, this.filePath, snapshotTime, this.repoPath);
			let versionContent = "";
			if (resp.content) {
				try {
					versionContent = decodeURIComponent(escape(atob(resp.content)));
				} catch {
					versionContent = resp.content;
				}
			}
			if (resp.error) {
				this.diffEl.empty();
				this.diffEl.createEl("div", { cls: "ginkgo-error", text: `内容读取失败: ${resp.error}` });
				return;
			}
			if (!versionContent && !this.currentContent) {
				this.diffEl.empty();
				this.diffEl.createEl("div", { cls: "ginkgo-fh-diff-empty", text: "两个版本内容均为空" });
				return;
			}
			this.renderDiff(this.diffEl, versionContent, this.currentContent);
		} catch (err) {
			this.diffEl.empty();
			const msg = err instanceof Error ? err.message : String(err);
			this.diffEl.createEl("div", { cls: "ginkgo-error", text: `加载失败: ${msg}` });
		}
	}

	private renderDiff(container: HTMLElement, oldContent: string, newContent: string) {
		container.empty();

		const normalizedOld = oldContent.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
		const normalizedNew = newContent.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

		const changes = Diff.diffLines(normalizedOld, normalizedNew);

		let added = 0;
		let removed = 0;
		for (const change of changes) {
			if (change.added) {
				added += change.count ?? 0;
			} else if (change.removed) {
				removed += change.count ?? 0;
			}
		}

		const summaryEl = container.createEl("div", { cls: "ginkgo-fh-diff-summary" });
		if (added === 0 && removed === 0) {
			summaryEl.createEl("span", { cls: "ginkgo-fh-diff-identical", text: "与当前文件内容相同" });
			return;
		}
		if (removed > 0) {
			summaryEl.createEl("span", { cls: "ginkgo-fh-diff-stat ginkgo-fh-stat-remove", text: `-${removed} 行` });
		}
		if (added > 0) {
			summaryEl.createEl("span", { cls: "ginkgo-fh-diff-stat ginkgo-fh-stat-add", text: `+${added} 行` });
		}

		const total = added + removed;
		if (total > 0) {
			const barEl = summaryEl.createEl("div", { cls: "ginkgo-fh-diff-bar" });
			barEl.createEl("div", { cls: "ginkgo-fh-diff-bar-add", attr: { style: `width: ${(added / total) * 100}%` } });
			barEl.createEl("div", { cls: "ginkgo-fh-diff-bar-remove", attr: { style: `width: ${(removed / total) * 100}%` } });
		}

		type DiffLine = { type: "add" | "remove" | "same"; oldNum: number; newNum: number; text: string };
		const allLines: DiffLine[] = [];

		let oldLineNum = 0;
		let newLineNum = 0;

		for (const change of changes) {
			const lines = (change.value ?? "").replace(/\n$/, "").split("\n");
			for (const line of lines) {
				if (change.added) {
					newLineNum++;
					allLines.push({ type: "add", oldNum: 0, newNum: newLineNum, text: line });
				} else if (change.removed) {
					oldLineNum++;
					allLines.push({ type: "remove", oldNum: oldLineNum, newNum: 0, text: line });
				} else {
					oldLineNum++;
					newLineNum++;
					allLines.push({ type: "same", oldNum: oldLineNum, newNum: newLineNum, text: line });
				}
			}
		}

		const contextLines = 3;
		const changedIndices = new Set<number>();
		for (let i = 0; i < allLines.length; i++) {
			if (allLines[i].type !== "same") {
				for (let j = Math.max(0, i - contextLines); j <= Math.min(allLines.length - 1, i + contextLines); j++) {
					changedIndices.add(j);
				}
			}
		}

		const codeEl = container.createEl("div", { cls: "ginkgo-fh-diff-code" });

		let lastRendered = -1;
		for (let i = 0; i < allLines.length; i++) {
			if (!changedIndices.has(i)) {
				if (lastRendered >= 0 && i - lastRendered > 1) {
					const sepEl = codeEl.createEl("div", { cls: "ginkgo-fh-diff-fold" });
					const skipped = i - lastRendered - 1;
					sepEl.createEl("span", { cls: "ginkgo-fh-diff-fold-text", text: `⋯ ${skipped} 行未变化 ⋯` });
				}
				lastRendered = i;
				continue;
			}

			if (lastRendered >= 0 && i - lastRendered > 1) {
				const sepEl = codeEl.createEl("div", { cls: "ginkgo-fh-diff-fold" });
				const skipped = i - lastRendered - 1;
				sepEl.createEl("span", { cls: "ginkgo-fh-diff-fold-text", text: `⋯ ${skipped} 行未变化 ⋯` });
			}

			const dl = allLines[i];
			const lineEl = codeEl.createEl("div", {
				cls: `ginkgo-fh-diff-line ${dl.type === "add" ? "is-add" : dl.type === "remove" ? "is-remove" : "is-same"}`,
			});

			const gutterEl = lineEl.createEl("span", { cls: "ginkgo-fh-diff-gutter" });
			if (dl.type === "add") {
				gutterEl.createEl("span", { cls: "ginkgo-fh-diff-num-add", text: String(dl.newNum) });
				gutterEl.createEl("span", { cls: "ginkgo-fh-diff-sign", text: "+" });
			} else if (dl.type === "remove") {
				gutterEl.createEl("span", { cls: "ginkgo-fh-diff-num-remove", text: String(dl.oldNum) });
				gutterEl.createEl("span", { cls: "ginkgo-fh-diff-sign", text: "-" });
			} else {
				gutterEl.createEl("span", { cls: "ginkgo-fh-diff-num-same", text: String(dl.newNum) });
				gutterEl.createEl("span", { cls: "ginkgo-fh-diff-sign", text: " " });
			}

			const contentEl = lineEl.createEl("span", { cls: "ginkgo-fh-diff-content" });
			contentEl.setText(dl.text);

			lastRendered = i;
		}
	}

	private async restoreSelectedVersion() {
		if (!this.selectedVersion) return;

		const snapshotTime = this.effectiveTs(this.selectedVersion);
		const versionLabel = this.isSentinelTs(this.selectedVersion.last_seen)
			? "当前版本"
			: this.formatTime(this.selectedVersion.last_seen);

		const { RestorePreviewModal } = await import("./restore-preview-modal");
		const modal = new RestorePreviewModal(
			this.app,
			this.client,
			this.sourceId,
			this.filePath,
			this.selectedVersion,
			versionLabel,
			this.repoPath,
			async () => {
				try {
					const resp = await this.client.getFileContent(this.sourceId, this.filePath, snapshotTime, this.repoPath);
					let versionContent = "";
					if (resp.content) {
						try {
							versionContent = decodeURIComponent(escape(atob(resp.content)));
						} catch {
							versionContent = resp.content;
						}
					}

					let file = this.app.vault.getAbstractFileByPath(this.filePath);
					if (!file) {
						const allFiles = this.app.vault.getFiles();
						const matches = allFiles.filter(f => f.name === this.filePath || f.path.endsWith("/" + this.filePath) || f.path === this.filePath);
						if (matches.length > 0) {
							file = matches[0];
						}
					}

					if (file instanceof TFile) {
						await this.app.vault.modify(file, versionContent);
					} else {
						const dirPath = this.filePath.includes("/") ? this.filePath.substring(0, this.filePath.lastIndexOf("/")) : "";
						if (dirPath) {
							await this.app.vault.createFolder(dirPath).catch(() => {});
						}
						await this.app.vault.create(this.filePath, versionContent);
					}

					this.currentContent = versionContent;
					new Notice("Ginkgo: 文件已恢复");
					this.close();
				} catch (err) {
					const msg = err instanceof Error ? err.message : String(err);
					new Notice(`Ginkgo: 恢复失败 — ${msg}`);
				}
			}
		);
		modal.open();
	}

	private async openCompareModal() {
		if (!this.compareVersion || !this.selectedVersion) return;

		const oldTs = this.effectiveTs(this.compareVersion);
		const newTs = this.effectiveTs(this.selectedVersion);
		const oldLabel = this.isSentinelTs(this.compareVersion.last_seen)
			? "当前版本"
			: this.formatTime(this.compareVersion.last_seen);
		const newLabel = this.isSentinelTs(this.selectedVersion.last_seen)
			? "当前版本"
			: this.formatTime(this.selectedVersion.last_seen);

		const { FileDiffModal } = await import("./file-diff-modal");
		const modal = new FileDiffModal(
			this.app,
			this.client,
			this.sourceId,
			this.filePath,
			oldTs,
			newTs,
			oldLabel,
			newLabel,
			this.repoPath
		);
		modal.open();
	}

	private async readCurrentFile(): Promise<string> {
		try {
			let file = this.app.vault.getAbstractFileByPath(this.filePath);
			if (!file) {
				const allFiles = this.app.vault.getFiles();
				const matches = allFiles.filter(f => f.name === this.filePath || f.path.endsWith("/" + this.filePath) || f.path === this.filePath);
				if (matches.length > 0) {
					file = matches[0];
				}
			}
			if (!file) return "";
			if (!(file instanceof TFile)) return "";
			return await this.app.vault.read(file);
		} catch {
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
		const diffDay = Math.floor(diffHour / 24);

		if (diffSec < 60) return "刚刚";
		if (diffMin < 60) return `${diffMin} 分钟前`;
		if (diffHour < 24) return `${diffHour} 小时前`;

		const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
		const targetDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
		const dayDiff = Math.floor((today.getTime() - targetDay.getTime()) / 86400000);

		if (dayDiff === 0) return "今天";
		if (dayDiff === 1) return "昨天";
		if (dayDiff === 2) return "前天";
		if (dayDiff < 7) return `${dayDiff} 天前`;
		if (dayDiff < 30) return `${Math.floor(dayDiff / 7)} 周前`;

		const m = String(date.getMonth() + 1).padStart(2, "0");
		const d = String(date.getDate()).padStart(2, "0");
		return `${date.getFullYear()}-${m}-${d}`;
	}

	private formatTime(ts: number): string {
		const date = this.tsToDate(ts);
		if (isNaN(date.getTime())) return String(ts);
		const h = String(date.getHours()).padStart(2, "0");
		const min = String(date.getMinutes()).padStart(2, "0");
		return `${h}:${min}`;
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
