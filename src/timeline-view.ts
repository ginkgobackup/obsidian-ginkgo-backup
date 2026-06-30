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

// 把 Date 格式化为 YYYY-MM-DD（本地时区），用作日历单元格的 key。
function formatDateKey(d: Date): string {
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `${y}-${m}-${day}`;
}

export class FileHistoryView extends ItemView {
	plugin: GinkgoBackupPlugin;
	// 全量缓存：onOpen 时一次性拉取，后续日历交互只在前端过滤
	allSnapshots: Snapshot[] = [];
	// 当前选中日期（YYYY-MM-DD）
	selectedDate: string = formatDateKey(new Date());
	// 日历当前显示的月份（指向该月 1 号）
	calendarMonth: Date = new Date();

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

		this.renderHeader(container);

		if (this.plugin.vaultSourceId === 0) {
			this.renderNotConfigured(container);
			return;
		}

		const loadingEl = container.createEl("div", { cls: "ginkgo-loading" });
		loadingEl.createEl("span", { text: t("timeline.loading") });

		try {
			const result = await this.plugin.client.getSnapshots(this.plugin.vaultSourceId, 500);
			this.allSnapshots = result.items;
			loadingEl.remove();

			if (this.allSnapshots.length === 0) {
				this.renderNoRecords(container);
				return;
			}

			// 默认定位到今天；今天无备份则跳到最新一次备份的日期
			const todayKey = formatDateKey(new Date());
			const hasToday = this.allSnapshots.some(s => formatDateKey(tsToDate(s.timestamp)) === todayKey);
			this.selectedDate = hasToday
				? todayKey
				: formatDateKey(tsToDate(this.allSnapshots[0].timestamp));
			this.calendarMonth = new Date(this.selectedDate + "T00:00:00");

			this.renderCalendar(container);
			this.renderDayList(container);
		} catch (err) {
			loadingEl.remove();
			const msg = err instanceof Error ? err.message : String(err);
			container.createEl("p", { text: t("timeline.loadFailed", { message: msg }), cls: "ginkgo-error" });
		}
	}

	private renderHeader(container: HTMLElement) {
		const headerEl = container.createEl("div", { cls: "ginkgo-timeline-header" });
		const h3 = headerEl.createEl("h3");
		const iconSpan = h3.createSpan({ cls: "ginkgo-timeline-icon" });
		setIcon(iconSpan, "hard-drive");
		iconSpan.addClass("ginkgo-timeline-icon-margin");
		h3.createSpan({ text: t("timeline.title") });

		const btnGroup = headerEl.createEl("div", { cls: "ginkgo-timeline-header-actions" });
		const refreshBtn = btnGroup.createEl("button", { text: t("timeline.refresh"), cls: "ginkgo-refresh-btn" });
		refreshBtn.addEventListener("click", () => this.onOpen());
		const backupBtn = btnGroup.createEl("button", { text: t("timeline.backupNow"), cls: "ginkgo-backup-btn" });
		backupBtn.addEventListener("click", () => this.plugin.backupVault());
	}

	private renderNotConfigured(container: HTMLElement) {
		const emptyEl = container.createEl("div", { cls: "ginkgo-empty-state" });
		const iconEl = emptyEl.createEl("div", { cls: "ginkgo-empty-icon" });
		setIcon(iconEl, "hard-drive");
		emptyEl.createEl("div", { cls: "ginkgo-empty-title", text: t("timeline.notConfigured") });
		emptyEl.createEl("div", { cls: "ginkgo-empty-desc", text: t("timeline.configureHint") });
	}

	private renderNoRecords(container: HTMLElement) {
		const emptyEl = container.createEl("div", { cls: "ginkgo-empty-state" });
		const iconEl = emptyEl.createEl("div", { cls: "ginkgo-empty-icon" });
		setIcon(iconEl, "archive");
		emptyEl.createEl("div", { cls: "ginkgo-empty-title", text: t("timeline.noRecords") });
		emptyEl.createEl("div", { cls: "ginkgo-empty-desc", text: t("timeline.firstBackupHint") });
	}

	// 按 YYYY-MM-DD 分组并按时间倒序排序
	private groupByDateKey(): Map<string, Snapshot[]> {
		const grouped = new Map<string, Snapshot[]>();
		for (const snap of this.allSnapshots) {
			const key = formatDateKey(tsToDate(snap.timestamp));
			const arr = grouped.get(key);
			if (arr) arr.push(snap);
			else grouped.set(key, [snap]);
		}
		// 每天内按时间倒序（最新在前）。allSnapshots 已是时间倒序，但保险起见再排一次。
		for (const arr of grouped.values()) {
			arr.sort((a, b) => b.timestamp - a.timestamp);
		}
		return grouped;
	}

	private renderCalendar(container: HTMLElement) {
		container.findAll(".ginkgo-calendar").forEach(el => el.remove());

		const calendarEl = container.createEl("div", { cls: "ginkgo-calendar" });
		const grouped = this.groupByDateKey();

		// 头部：上一月 / 月份标题 / 下一月 + 跳到最新
		const headerEl = calendarEl.createEl("div", { cls: "ginkgo-calendar-header" });

		const leftEl = headerEl.createEl("div", { cls: "ginkgo-calendar-nav" });
		const prevBtn = leftEl.createEl("button", { cls: "ginkgo-cal-nav-btn" });
		setIcon(prevBtn, "chevron-left");
		prevBtn.setAttr("aria-label", t("timeline.prevMonth"));
		prevBtn.addEventListener("click", () => {
			this.calendarMonth = new Date(this.calendarMonth.getFullYear(), this.calendarMonth.getMonth() - 1, 1);
			this.renderCalendar(container);
			this.renderDayList(container);
		});

		const titleEl = headerEl.createEl("div", { cls: "ginkgo-calendar-title" });
		const monthLabel = this.calendarMonth.toLocaleDateString(undefined, { year: "numeric", month: "long" });
		titleEl.createSpan({ text: monthLabel });

		const rightEl = headerEl.createEl("div", { cls: "ginkgo-calendar-nav" });
		const todayBtn = rightEl.createEl("button", { text: t("timeline.thisMonth"), cls: "ginkgo-cal-today-btn" });
		todayBtn.addEventListener("click", () => {
			this.calendarMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
			this.selectedDate = formatDateKey(new Date());
			this.renderCalendar(container);
			this.renderDayList(container);
		});

		const latestBtn = rightEl.createEl("button", { text: t("timeline.jumpToLatest"), cls: "ginkgo-cal-latest-btn" });
		latestBtn.addEventListener("click", () => {
			if (this.allSnapshots.length === 0) return;
			const latest = this.allSnapshots[0];
			const latestKey = formatDateKey(tsToDate(latest.timestamp));
			this.selectedDate = latestKey;
			this.calendarMonth = new Date(latestKey + "T00:00:00");
			this.renderCalendar(container);
			this.renderDayList(container);
		});

		const nextBtn = rightEl.createEl("button", { cls: "ginkgo-cal-nav-btn" });
		setIcon(nextBtn, "chevron-right");
		nextBtn.setAttr("aria-label", t("timeline.nextMonth"));
		nextBtn.addEventListener("click", () => {
			this.calendarMonth = new Date(this.calendarMonth.getFullYear(), this.calendarMonth.getMonth() + 1, 1);
			this.renderCalendar(container);
			this.renderDayList(container);
		});

		// 星期标题行（日 一 二 三 四 五 六）
		const weekdayEl = calendarEl.createEl("div", { cls: "ginkgo-calendar-weekdays" });
		const weekdays = this.getWeekdayLabels();
		for (const w of weekdays) {
			weekdayEl.createEl("div", { cls: "ginkgo-calendar-weekday", text: w });
		}

		// 日期网格
		const gridEl = calendarEl.createEl("div", { cls: "ginkgo-calendar-grid" });
		const year = this.calendarMonth.getFullYear();
		const month = this.calendarMonth.getMonth();
		const firstDay = new Date(year, month, 1);
		const startWeekday = firstDay.getDay(); // 0=周日
		const daysInMonth = new Date(year, month + 1, 0).getDate();

		// 1 号之前的空白格
		for (let i = 0; i < startWeekday; i++) {
			gridEl.createEl("div", { cls: "ginkgo-calendar-day is-blank" });
		}

		for (let day = 1; day <= daysInMonth; day++) {
			const dateObj = new Date(year, month, day);
			const dateKey = formatDateKey(dateObj);
			const daySnaps = grouped.get(dateKey) ?? [];
			const hasBackup = daySnaps.length > 0;

			const dayEl = gridEl.createEl("div", {
				cls: `ginkgo-calendar-day${hasBackup ? " has-backup" : ""}${dateKey === this.selectedDate ? " is-selected" : ""}`,
			});
			dayEl.createEl("span", { cls: "ginkgo-cal-day-num", text: String(day) });

			if (hasBackup) {
				// 多个快照显示数字角标，单个显示圆点
				const badgeEl = dayEl.createEl("span", { cls: "ginkgo-cal-day-badge" });
				if (daySnaps.length > 1) {
					badgeEl.createSpan({ text: String(daySnaps.length) });
				}
			}

			dayEl.addEventListener("click", () => {
				this.selectedDate = dateKey;
				this.renderCalendar(container);
				this.renderDayList(container);
			});
		}
	}

	private getWeekdayLabels(): string[] {
		// 始终以周日为列首，与 getDay() 对齐
		const locale = navigator.language || "en";
		const base = new Date(2024, 0, 7); // 2024-01-07 是周日
		const labels: string[] = [];
		for (let i = 0; i < 7; i++) {
			const d = new Date(base);
			d.setDate(base.getDate() + i);
			labels.push(d.toLocaleDateString(locale, { weekday: "narrow" }));
		}
		return labels;
	}

	private renderDayList(container: HTMLElement) {
		container.findAll(".ginkgo-day-list, .ginkgo-day-empty, .ginkgo-day-summary").forEach(el => el.remove());

		const grouped = this.groupByDateKey();
		const daySnaps = grouped.get(this.selectedDate) ?? [];

		if (daySnaps.length === 0) {
			// 方案 2B：当天无备份隐藏列表，只显示日历
			const emptyEl = container.createEl("div", { cls: "ginkgo-day-empty" });
			const iconEl = emptyEl.createEl("div", { cls: "ginkgo-empty-icon" });
			setIcon(iconEl, "calendar-x");
			emptyEl.createEl("div", { cls: "ginkgo-empty-title", text: t("timeline.noBackupOnDay") });
			emptyEl.createEl("div", { cls: "ginkgo-empty-desc", text: t("timeline.noBackupOnDayHint") });
			return;
		}

		// 当天统计 summary
		const summaryEl = container.createEl("div", { cls: "ginkgo-timeline-summary ginkgo-day-summary" });
		// new_bytes = 每个快照相对前一次的增量字节数，累加 = 当天真正产生的数据量
		// 注意：total_size 是 vault 全量大小，累加会误导（3 次 100MB 快照会显示 300MB）
		const newBytes = daySnaps.reduce((sum, s) => sum + s.new_bytes, 0);
		const newFiles = daySnaps.reduce((sum, s) => sum + s.new_files, 0);
		const changedFiles = daySnaps.reduce((sum, s) => sum + s.changed_files, 0);

		const items = [
			{ value: String(daySnaps.length), label: t("timeline.dayCount") },
			{ value: formatBytes(newBytes), label: t("timeline.dayNewBytes") },
			{ value: `+${newFiles}`, label: t("timeline.dayNewFiles") },
			{ value: `~${changedFiles}`, label: t("timeline.dayChangedFiles") },
		];
		for (const item of items) {
			const itemEl = summaryEl.createEl("div", { cls: "ginkgo-summary-item" });
			itemEl.createEl("div", { cls: "ginkgo-summary-value", text: item.value });
			itemEl.createEl("div", { cls: "ginkgo-summary-label", text: item.label });
		}

		// 当天列表（不再按日期分组，所有项都属于 selectedDate）
		const listEl = container.createEl("div", { cls: "ginkgo-timeline-list ginkgo-day-list" });
		for (const snap of daySnaps) {
			const itemEl = listEl.createEl("div", { cls: "ginkgo-timeline-item" });

			const trackEl = itemEl.createEl("div", { cls: "ginkgo-timeline-track" });
			const dotCls = this.getDotClass(snap, daySnaps);
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
