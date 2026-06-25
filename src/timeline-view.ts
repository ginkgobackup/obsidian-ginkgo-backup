import { App, ItemView, WorkspaceLeaf, Modal, setIcon } from "obsidian";
import GinkgoBackupPlugin from "./main";
import { t } from "./i18n";
import { tsToDate, formatBytes } from "./utils";
import type { Snapshot, DirectoryEntry } from "./types";

export const TIMELINE_VIEW_TYPE = "ginkgo-backup-timeline";

interface DirectoryPage {
	entries: DirectoryEntry[];
	total: number;
	has_more: boolean;
}

export class FileHistoryView extends ItemView {
	plugin: GinkgoBackupPlugin;
	snapshots: Snapshot[] = [];

	constructor(leaf: WorkspaceLeaf, plugin: GinkgoBackupPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return TIMELINE_VIEW_TYPE;
	}

	getDisplayText(): string {
		return t("timeline.title");
	}

	getIcon(): string {
		return "hard-drive";
	}

	async onOpen() {
		const container = this.contentEl;
		container.empty();
		container.addClass("ginkgo-timeline-container");

		const headerEl = container.createEl("div", { cls: "ginkgo-timeline-header" });
		const h3 = headerEl.createEl("h3");
		const iconSpan = h3.createSpan({ cls: "ginkgo-timeline-icon" });
		setIcon(iconSpan, "hard-drive");
		iconSpan.style.marginRight = "8px";
		h3.createSpan({ text: t("timeline.title") });

		const refreshBtn = headerEl.createEl("button", { text: t("timeline.refresh"), cls: "ginkgo-refresh-btn" });
		refreshBtn.addEventListener("click", () => this.onOpen());

		const backupBtn = headerEl.createEl("button", { text: t("timeline.backupNow"), cls: "ginkgo-backup-btn" });
		backupBtn.addEventListener("click", () => this.plugin.backupVault());

		if (this.plugin.vaultSourceId === 0) {
			const emptyEl = container.createEl("div", { cls: "ginkgo-empty-state" });
			const iconEl = emptyEl.createEl("div", { cls: "ginkgo-empty-icon" });
			setIcon(iconEl, "hard-drive");
			emptyEl.createEl("div", { cls: "ginkgo-empty-title", text: t("timeline.notConfigured") });
			emptyEl.createEl("div", { cls: "ginkgo-empty-desc", text: t("timeline.configureHint") });
			return;
		}

		const loadingEl = container.createEl("div", { cls: "ginkgo-loading" });
		loadingEl.createEl("span", { text: t("timeline.loading") });

		try {
			const result = await this.plugin.client.getSnapshots(this.plugin.vaultSourceId, 50);
			this.snapshots = result.items;
			loadingEl.remove();
			this.renderTimeline(container);
		} catch (err) {
			loadingEl.remove();
			const msg = err instanceof Error ? err.message : String(err);
			container.createEl("p", { text: t("timeline.loadFailed", { message: msg }), cls: "ginkgo-error" });
		}
	}

	private renderTimeline(container: HTMLElement) {
		container.findAll(".ginkgo-timeline-summary, .ginkgo-timeline-list, .ginkgo-empty-state").forEach(el => el.remove());

		if (this.snapshots.length === 0) {
			const emptyEl = container.createEl("div", { cls: "ginkgo-empty-state" });
			const iconEl = emptyEl.createEl("div", { cls: "ginkgo-empty-icon" });
			setIcon(iconEl, "archive");
			emptyEl.createEl("div", { cls: "ginkgo-empty-title", text: t("timeline.noRecords") });
			emptyEl.createEl("div", { cls: "ginkgo-empty-desc", text: t("timeline.firstBackupHint") });
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
				cardEl.addEventListener("click", () => this.openSnapshotDetail(snap));

				const time = tsToDate(snap.timestamp);
				cardEl.createEl("div", {
					cls: "ginkgo-card-time",
					text: time.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }),
				});

				const metaEl = cardEl.createEl("div", { cls: "ginkgo-card-meta" });
				metaEl.createEl("span", { text: `${snap.file_count} ${t("timeline.files")}` });
				metaEl.createEl("span", { text: formatBytes(snap.total_size) });

				if (snap.new_files > 0) {
					metaEl.createEl("span", {
						text: `+${snap.new_files}`,
						cls: "ginkgo-meta-new",
					});
				}

				if (snap.changed_files > 0) {
					metaEl.createEl("span", {
						text: `~${snap.changed_files}`,
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

		const totalSize = this.snapshots.reduce((sum, s) => sum + s.total_size, 0);
		const latestSnap = this.snapshots[0];
		const lastTime = latestSnap
			? tsToDate(latestSnap.timestamp).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
			: "-";

		const items = [
			{ value: String(this.snapshots.length), label: t("timeline.snapshots") },
			{ value: formatBytes(totalSize), label: t("timeline.totalSize") },
			{ value: lastTime, label: t("timeline.lastBackup") },
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
			const date = tsToDate(snap.timestamp).toLocaleDateString(undefined, {
				year: "numeric",
				month: "long",
				day: "numeric",
			});
			if (!grouped[date]) grouped[date] = [];
			grouped[date].push(snap);
		}
		return grouped;
	}

	private openSnapshotDetail(snap: Snapshot) {
		new SnapshotDetailModal(this.app, this.plugin, snap).open();
	}

	async onClose() {
	}
}

class SnapshotDetailModal extends Modal {
	private plugin: GinkgoBackupPlugin;
	private snap: Snapshot;

	constructor(app: App, plugin: GinkgoBackupPlugin, snap: Snapshot) {
		super(app);
		this.plugin = plugin;
		this.snap = snap;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.addClass("ginkgo-snapshot-modal");

		const time = tsToDate(this.snap.timestamp);

		const headerEl = contentEl.createEl("div", { cls: "ginkgo-snap-header" });
		const titleEl = headerEl.createEl("div", { cls: "ginkgo-snap-title" });
		const iconSpan = titleEl.createSpan({ cls: "ginkgo-snap-title-icon" });
		setIcon(iconSpan, "camera");
		titleEl.createEl("span", { text: `${t("timeline.snapshots")} ${time.toLocaleString()}` });

		const statsEl = contentEl.createEl("div", { cls: "ginkgo-snap-stats" });
		const statItems: { icon: string; label: string; value: string; cls?: string }[] = [
			{ icon: "files", label: t("snapshot.files"), value: `${this.snap.file_count} ${t("timeline.files")} · ${this.snap.dir_count} ${t("snapshot.dirs")}` },
			{ icon: "hard-drive", label: t("snapshot.size"), value: formatBytes(this.snap.total_size) },
		];
		if (this.snap.new_files > 0) {
			statItems.push({ icon: "plus-circle", label: t("snapshot.new"), value: `${this.snap.new_files} ${t("timeline.files")}`, cls: "ginkgo-stat-new" });
		}
		if (this.snap.changed_files > 0) {
			statItems.push({ icon: "refresh-cw", label: t("snapshot.changed"), value: `${this.snap.changed_files} ${t("timeline.files")}`, cls: "ginkgo-stat-changed" });
		}
		if (this.snap.deleted_count > 0) {
			statItems.push({ icon: "minus-circle", label: t("snapshot.deleted"), value: `${this.snap.deleted_count} ${t("timeline.files")}`, cls: "ginkgo-stat-deleted" });
		}
		if (this.snap.duration_ms > 0) {
			const sec = Math.round(this.snap.duration_ms / 1000);
			statItems.push({ icon: "timer", label: t("snapshot.duration"), value: sec >= 60 ? `${Math.floor(sec / 60)}m${sec % 60}s` : `${sec}s` });
		}

		for (const item of statItems) {
			const statEl = statsEl.createEl("div", { cls: `ginkgo-snap-stat ${item.cls ?? ""}` });
			const iconSpan = statEl.createEl("span", { cls: "ginkgo-snap-stat-icon" });
			setIcon(iconSpan, item.icon);
			const textEl = statEl.createEl("div", { cls: "ginkgo-snap-stat-text" });
			textEl.createEl("span", { cls: "ginkgo-snap-stat-label", text: item.label });
			textEl.createEl("span", { cls: "ginkgo-snap-stat-value", text: item.value });
		}

		const fileSectionEl = contentEl.createEl("div", { cls: "ginkgo-snap-file-section" });
		const fileHeaderEl = fileSectionEl.createEl("div", { cls: "ginkgo-snap-file-header" });
		fileHeaderEl.createEl("span", { text: t("timeline.fileList") });
		const loadingEl = fileHeaderEl.createEl("span", { cls: "ginkgo-snap-loading", text: t("timeline.loadingFiles") });

		const fileListEl = fileSectionEl.createEl("div", { cls: "ginkgo-snap-file-list" });

		this.loadFiles(fileListEl, loadingEl);
	}

	private async loadFiles(listEl: HTMLElement, loadingEl: HTMLElement) {
		try {
			const result = await this.plugin.client.browseDirectory(
				this.plugin.vaultSourceId,
				"",
				this.snap.timestamp,
				200,
				0
			) as DirectoryPage;

			loadingEl.remove();
			const entries = result.entries ?? [];

			if (entries.length === 0) {
				listEl.createEl("div", { cls: "ginkgo-snap-empty", text: t("timeline.noFiles") });
				return;
			}

			const dirs = entries.filter(e => e.type === "dir");
			const files = entries.filter(e => e.type !== "dir");
			const sorted = [...dirs, ...files];

			for (const entry of sorted) {
				const rowEl = listEl.createEl("div", {
					cls: `ginkgo-snap-file-row ${entry.is_deleted ? "is-deleted" : ""} ${entry.type === "dir" ? "is-dir" : "is-file"}`,
				});

				const iconCls = entry.type === "dir" ? "folder" : this.getFileIcon(entry.name);
				const iconEl = rowEl.createEl("span", { cls: "ginkgo-snap-file-icon" });
				setIcon(iconEl, iconCls);

				rowEl.createEl("span", { cls: "ginkgo-snap-file-name", text: entry.name });

				if (entry.is_deleted) {
					rowEl.createEl("span", { cls: "ginkgo-snap-file-deleted", text: t("timeline.deleted") });
				}

				const rightEl = rowEl.createEl("span", { cls: "ginkgo-snap-file-right" });
				if (entry.type !== "dir") {
					rightEl.createEl("span", { cls: "ginkgo-snap-file-size", text: formatBytes(entry.size) });
				} else if (entry.file_count > 0) {
					rightEl.createEl("span", { cls: "ginkgo-snap-file-count", text: `${entry.file_count} ${t("timeline.files")}` });
				}

				if (entry.type !== "dir") {
					rowEl.addEventListener("click", () => {
						if (this.plugin.vaultSourceId > 0) {
							const filePath = entry.path || entry.name;
							this.close();
							this.plugin.showFileHistoryByPath(filePath);
						}
					});
				}
			}

			if (result.has_more) {
				listEl.createEl("div", { cls: "ginkgo-snap-file-more", text: t("timeline.moreFiles", { count: result.total }) });
			}
		} catch (err) {
			loadingEl.remove();
			const msg = err instanceof Error ? err.message : String(err);
			listEl.createEl("div", { cls: "ginkgo-error", text: t("timeline.loadFailed", { message: msg }) });
		}
	}

	private getFileIcon(name: string): string {
		const ext = name.split(".").pop()?.toLowerCase() ?? "";
		const iconMap: Record<string, string> = {
			md: "file-text", txt: "file-text", json: "file-json",
			css: "file-code", js: "file-code", ts: "file-code",
			png: "image", jpg: "image", jpeg: "image", gif: "image",
			svg: "image", webp: "image", pdf: "file-text", canvas: "layout-dashboard",
		};
		return iconMap[ext] ?? "file";
	}

	onClose() {
		this.contentEl.empty();
	}
}
