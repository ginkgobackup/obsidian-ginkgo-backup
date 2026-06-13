import { ItemView, WorkspaceLeaf, Notice, setIcon } from "obsidian";
import GinkgoBackupPlugin from "./main";
import type { Snapshot, DirectoryEntry } from "./types";
import { GinkgoBackupClient } from "./api";

export const TIMELINE_VIEW_TYPE = "ginkgo-backup-timeline";

export class FileHistoryView extends ItemView {
	plugin: GinkgoBackupPlugin;
	snapshots: Snapshot[] = [];
	selectedSnapshot: Snapshot | null = null;
	snapshotFiles: DirectoryEntry[] = [];

	constructor(leaf: WorkspaceLeaf, plugin: GinkgoBackupPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return TIMELINE_VIEW_TYPE;
	}

	getDisplayText(): string {
		return "备份时间线";
	}

	getIcon(): string {
		return "hard-drive";
	}

	async onOpen() {
		const container = this.containerEl.children[1] as HTMLElement;
		container.empty();
		container.addClass("ginkgo-timeline-container");

		const headerEl = container.createEl("div", { cls: "ginkgo-timeline-header" });
		const h3 = headerEl.createEl("h3");
		const iconSpan = h3.createSpan({ cls: "ginkgo-timeline-icon" });
		setIcon(iconSpan, "hard-drive");
		iconSpan.style.marginRight = "8px";
		h3.createSpan({ text: "备份时间线" });

		const refreshBtn = headerEl.createEl("button", { text: "刷新", cls: "ginkgo-refresh-btn" });
		refreshBtn.addEventListener("click", () => this.onOpen());

		const backupBtn = headerEl.createEl("button", { text: "立即备份", cls: "ginkgo-backup-btn" });
		backupBtn.addEventListener("click", () => this.plugin.backupVault());

		if (this.plugin.vaultSourceId === 0) {
			const emptyEl = container.createEl("div", { cls: "ginkgo-empty-state" });
			const iconEl = emptyEl.createEl("div", { cls: "ginkgo-empty-icon" });
			setIcon(iconEl, "hard-drive");
			emptyEl.createEl("div", { cls: "ginkgo-empty-title", text: "尚未配置备份源" });
			emptyEl.createEl("div", { cls: "ginkgo-empty-desc", text: "使用命令 Ginkgo: 配置备份源 来开始" });
			return;
		}

		const loadingEl = container.createEl("div", { cls: "ginkgo-loading" });
		loadingEl.createEl("span", { text: "加载中..." });

		try {
			const result = await this.plugin.client.getSnapshots(this.plugin.vaultSourceId, 50);
			this.snapshots = result.items;
			loadingEl.remove();
			this.renderTimeline(container);
		} catch (err) {
			loadingEl.remove();
			const msg = err instanceof Error ? err.message : String(err);
			container.createEl("p", { text: `加载失败: ${msg}`, cls: "ginkgo-error" });
		}
	}

	private renderTimeline(container: HTMLElement) {
		container.findAll(".ginkgo-timeline-summary, .ginkgo-timeline-list, .ginkgo-empty-state").forEach(el => el.remove());

		if (this.snapshots.length === 0) {
			const emptyEl = container.createEl("div", { cls: "ginkgo-empty-state" });
			const iconEl = emptyEl.createEl("div", { cls: "ginkgo-empty-icon" });
			setIcon(iconEl, "archive");
			emptyEl.createEl("div", { cls: "ginkgo-empty-title", text: "暂无备份记录" });
			emptyEl.createEl("div", { cls: "ginkgo-empty-desc", text: "点击「立即备份」创建第一个快照" });
			return;
		}

		this.renderSummary(container);

		const grouped = this.groupByDate(this.snapshots);
		const listEl = container.createEl("div", { cls: "ginkgo-timeline-list" });

		for (const [date, daySnapshots] of Object.entries(grouped)) {
			const dateEl = listEl.createEl("div", { cls: "ginkgo-date-group" });
			dateEl.createEl("h4", { text: date });

			for (const snap of daySnapshots) {
				const itemEl = dateEl.createEl("div", { cls: "ginkgo-timeline-item" });

				const trackEl = itemEl.createEl("div", { cls: "ginkgo-timeline-track" });
				const dotCls = this.getDotClass(snap, daySnapshots);
				trackEl.createEl("div", { cls: dotCls });

				const cardEl = itemEl.createEl("div", { cls: "ginkgo-timeline-card" });
				if (this.selectedSnapshot?.id === snap.id) {
					cardEl.addClass("is-selected");
				}

				cardEl.addEventListener("click", () => this.selectSnapshot(snap));

				const cardLeft = cardEl.createEl("div", { cls: "ginkgo-card-left" });

				const time = new Date(snap.timestamp / 1000);
				cardLeft.createEl("div", {
					cls: "ginkgo-card-time",
					text: time.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }),
				});

				const metaEl = cardLeft.createEl("div", { cls: "ginkgo-card-meta" });
				metaEl.createEl("span", { text: `${snap.file_count} 文件` });
				metaEl.createEl("span", { text: this.plugin.formatBytes(snap.total_size) });

				if (snap.new_files > 0) {
					metaEl.createEl("span", {
						text: `+${snap.new_files} 新`,
						cls: "ginkgo-meta-new",
					});
				}

				if (snap.changed_files > 0) {
					metaEl.createEl("span", {
						text: `~${snap.changed_files} 改`,
						cls: "ginkgo-meta-changed",
					});
				}

				if (snap.tags && snap.tags.length > 0) {
					const tagsEl = cardEl.createEl("div", { cls: "ginkgo-card-tags" });
					for (const tag of snap.tags) {
						tagsEl.createEl("span", {
							text: tag,
							cls: `ginkgo-tag ginkgo-tag-${tag}`,
						});
					}
				}

				if (snap.status !== "complete") {
					cardEl.createEl("span", {
						text: snap.status,
						cls: "ginkgo-badge-status",
					});
				}
			}
		}
	}

	private renderSummary(container: HTMLElement) {
		const summaryEl = container.createEl("div", { cls: "ginkgo-timeline-summary" });

		const totalFiles = this.snapshots.reduce((sum, s) => sum + s.file_count, 0);
		const totalSize = this.snapshots.reduce((sum, s) => sum + s.total_size, 0);
		const latestSnap = this.snapshots[0];
		const lastTime = latestSnap
			? new Date(latestSnap.timestamp / 1000).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
			: "-";

		const items = [
			{ value: String(this.snapshots.length), label: "快照" },
			{ value: this.plugin.formatBytes(totalSize), label: "总大小" },
			{ value: lastTime, label: "最近备份" },
		];

		for (const item of items) {
			const itemEl = summaryEl.createEl("div", { cls: "ginkgo-summary-item" });
			itemEl.createEl("div", { cls: "ginkgo-summary-value", text: item.value });
			itemEl.createEl("div", { cls: "ginkgo-summary-label", text: item.label });
		}
	}

	private getDotClass(snap: Snapshot, daySnapshots: Snapshot[]): string {
		const parts = ["ginkgo-dot"];
		if (snap === daySnapshots[0]) {
			parts.push("ginkgo-dot-latest");
		} else if (snap.status !== "complete") {
			parts.push("ginkgo-dot-error");
		} else {
			parts.push("ginkgo-dot-success");
		}
		return parts.join(" ");
	}

	private groupByDate(snapshots: Snapshot[]): Record<string, Snapshot[]> {
		const grouped: Record<string, Snapshot[]> = {};
		for (const snap of snapshots) {
			const date = new Date(snap.timestamp / 1000).toLocaleDateString(undefined, {
				year: "numeric",
				month: "long",
				day: "numeric",
			});
			if (!grouped[date]) grouped[date] = [];
			grouped[date].push(snap);
		}
		return grouped;
	}

	private async selectSnapshot(snap: Snapshot) {
		this.selectedSnapshot = snap;
		this.renderTimeline(this.containerEl.children[1] as HTMLElement);

		const detailEl = this.containerEl.querySelector(".ginkgo-snapshot-detail") as HTMLElement;
		if (detailEl) detailEl.remove();

		const detail = this.containerEl.children[1].createEl("div", { cls: "ginkgo-snapshot-detail" });
		const loadingEl = detail.createEl("div", { cls: "ginkgo-loading" });
		loadingEl.createEl("span", { text: "加载文件列表..." });

		try {
			const result = await this.plugin.client.browseDirectory(
				this.plugin.vaultSourceId,
				"",
				snap.timestamp / 1000,
				200,
				0
			);
			this.snapshotFiles = (result as { items?: DirectoryEntry[] }).items ?? [];
			loadingEl.remove();
			this.renderSnapshotDetail(detail, snap);
		} catch (err) {
			loadingEl.remove();
			const msg = err instanceof Error ? err.message : String(err);
			detail.createEl("div", { cls: "ginkgo-error", text: `加载失败: ${msg}` });
		}
	}

	private renderSnapshotDetail(container: HTMLElement, snap: Snapshot) {
		const headerEl = container.createEl("div", { cls: "ginkgo-detail-header" });
		const time = new Date(snap.timestamp / 1000);
		headerEl.createEl("span", { cls: "ginkgo-detail-title", text: `快照文件 — ${time.toLocaleString()}` });
		const closeBtn = headerEl.createEl("button", { cls: "ginkgo-detail-close", text: "关闭" });
		closeBtn.addEventListener("click", () => {
			this.selectedSnapshot = null;
			container.remove();
			this.renderTimeline(this.containerEl.children[1] as HTMLElement);
		});

		if (this.snapshotFiles.length === 0) {
			container.createEl("div", { cls: "ginkgo-empty", text: "此快照无文件记录" });
			return;
		}

		const listEl = container.createEl("div", { cls: "ginkgo-detail-file-list" });
		for (const entry of this.snapshotFiles) {
			const fileEl = listEl.createEl("div", { cls: "ginkgo-detail-file" });
			const iconCls = entry.type === "dir" ? "folder" : "file-text";
			const iconEl = fileEl.createEl("span", { cls: "ginkgo-detail-file-icon" });
			setIcon(iconEl, iconCls);
			fileEl.createEl("span", { cls: "ginkgo-detail-file-name", text: entry.name });
			if (entry.type !== "dir") {
				fileEl.createEl("span", { cls: "ginkgo-detail-file-size", text: this.plugin.formatBytes(entry.size) });
			}
			if (entry.is_deleted) {
				fileEl.createEl("span", { cls: "ginkgo-detail-file-deleted", text: "已删除" });
			}
			fileEl.addEventListener("click", () => {
				if (entry.type !== "dir" && this.plugin.vaultSourceId > 0) {
					const filePath = entry.path || entry.name;
					this.plugin.showFileHistoryByPath(filePath);
				}
			});
		}
	}

	async onClose() {
	}
}
