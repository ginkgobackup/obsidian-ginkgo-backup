import { Notice } from "obsidian";
import { GinkgoBackupClient } from "./api";
import { t } from "./i18n";
import type { GinkgoBackupSettings, Source } from "./types";

export type BackupProgress = import("./types").BackupProgress;

export class ConnectionManager {
	client: GinkgoBackupClient;
	settings: GinkgoBackupSettings;
	app: import("obsidian").App;

	connected = false;
	consecutiveFailures = 0;
	vaultSourceId = 0;
	vaultRepoPath = "";

	private refreshTimer?: number;
	private progressTimer?: number;
	private statusBarUpdater: (state: string, detail?: string) => void;
	private getVaultPath: () => string;
	private onReconnected?: () => void;
	private persistSettings: () => Promise<void>;

	constructor(
		app: import("obsidian").App,
		settings: GinkgoBackupSettings,
		client: GinkgoBackupClient,
		getVaultPath: () => string,
		statusBarUpdater: (state: string, detail?: string) => void,
		persistSettings: () => Promise<void>,
		onReconnected?: () => void
	) {
		this.app = app;
		this.settings = settings;
		this.client = client;
		this.getVaultPath = getVaultPath;
		this.statusBarUpdater = statusBarUpdater;
		this.persistSettings = persistSettings;
		this.onReconnected = onReconnected;
	}

	updateSettings(settings: GinkgoBackupSettings) {
		this.settings = settings;
	}

	async initialize() {
		const connected = await this.client.isConnected();
		if (connected) {
			this.connected = true;
			this.consecutiveFailures = 0;
			await this.detectSourceId();
			this.statusBarUpdater("connected");
		} else {
			this.connected = false;
			this.statusBarUpdater("disconnected");
		}
	}

	startStatusRefresh() {
		if (this.refreshTimer) window.clearTimeout(this.refreshTimer);
		this.scheduleNextRefresh(this.connected ? this.settings.refreshInterval * 1000 : 10000);
	}

	stopStatusRefresh() {
		if (this.refreshTimer) window.clearTimeout(this.refreshTimer);
		this.refreshTimer = undefined;
	}

	private scheduleNextRefresh(delay: number) {
		this.refreshTimer = window.setTimeout(() => this.refreshStatus(), delay);
	}

	private async refreshStatus() {
		try {
			const connected = await this.client.isConnected();
			if (!connected) {
				this.connected = false;
				this.consecutiveFailures++;
				this.statusBarUpdater("disconnected");

				if (this.consecutiveFailures === 1 && this.settings.stagingPushOnSave) {
					new Notice(t("notice.autoBackupPaused"), 5000);
				}
				return;
			}

			const wasDisconnected = !this.connected;
			this.connected = true;
			this.consecutiveFailures = 0;

			if (wasDisconnected && this.onReconnected) {
				this.onReconnected();
			}

			const progressArr = await this.client.getProgress() as BackupProgress | BackupProgress[];
			const progress = Array.isArray(progressArr) ? progressArr[0] : progressArr;

			if (progress && progress.phase && progress.phase !== "complete" && progress.phase !== "error" && progress.phase !== "cancelled") {
				const pct = progress.total_files > 0
					? Math.round((progress.processed_files / progress.total_files) * 100)
					: 0;
				this.statusBarUpdater("backing_up", `${pct}%`);
				return;
			}

			if (this.vaultSourceId > 0) {
				const sources = await this.client.getSources();
				const vaultSource = sources.find((s) => s.id === this.vaultSourceId);
				if (vaultSource) {
					const fileCount = vaultSource.file_count ?? 0;
					const lastBackup = vaultSource.last_backup > 0
						? this.formatRelativeTime(new Date(vaultSource.last_backup / 1000000))
						: t("status.never");
					this.statusBarUpdater("connected", t("status.fileCount", { count: fileCount, time: lastBackup }));
					return;
				}
			}

			this.statusBarUpdater("connected");
		} catch (err) {
			this.logError("refresh status failed", err);
			this.connected = false;
			this.statusBarUpdater("disconnected");
		} finally {
			this.scheduleNextRefresh(this.connected ? this.settings.refreshInterval * 1000 : 10000);
		}
	}

	async detectSourceId() {
		if (this.settings.sourceId > 0) {
			this.vaultSourceId = this.settings.sourceId;
			try {
				const source = await this.client.getSourceById(this.vaultSourceId);
				if (source && source.repo_paths.length > 0) {
					this.vaultRepoPath = source.repo_paths[0];
				}
			} catch (err) {
				this.logError("detect source by id failed", err);
			}
			return;
		}

		const vaultPath = this.getVaultPath();
		if (!vaultPath) return;

		try {
			const source = await this.client.findSourceByPath(vaultPath);
			if (source) {
				this.vaultSourceId = source.id;
				this.vaultRepoPath = source.repo_paths.length > 0 ? source.repo_paths[0] : "";
				this.settings.sourceId = source.id;
				await this.persistSettings();
			}
		} catch (err) {
			this.logError("find source by path failed", err);
		}
	}

	async setupSource(repoPaths?: string[]): Promise<Source | null> {
		const vaultPath = this.getVaultPath();
		if (!vaultPath) {
			new Notice(t("notice.noVaultPath"));
			return null;
		}
		if (!repoPaths || repoPaths.length === 0) {
			new Notice(t("notice.selectRepoFirst"));
			return null;
		}

		const vaultName = this.app.vault.getName();
		new Notice(t("notice.configuringSource"));

		try {
			const source = await this.client.ensureSourceExists(
				vaultPath,
				vaultName,
				repoPaths,
				this.settings.excludePaths
			);
			if (source) {
				this.vaultSourceId = source.id;
				this.vaultRepoPath = source.repo_paths.length > 0 ? source.repo_paths[0] : "";
				this.settings.sourceId = source.id;
				const repoList = (source.repo_paths || []).join(", ");
				new Notice(t("notice.sourceConfigured", { name: vaultName, repos: repoList }), 6000);
				this.statusBarUpdater("connected");
			} else {
				new Notice(t("notice.createSourceFailed"));
			}
			return source;
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			new Notice(t("error.configureSourceFailed") + " — " + msg);
			return null;
		}
	}

	startProgressPolling() {
		if (this.progressTimer) window.clearTimeout(this.progressTimer);
		this.progressTimer = undefined;
		this.pollProgress();
	}

	private pollProgress() {
		this.progressTimer = window.setTimeout(async () => {
			try {
				const progress = await this.client.getProgress(this.vaultSourceId) as BackupProgress;
				if (!progress || progress.phase === "complete" || progress.phase === "error" || progress.phase === "cancelled") {
					this.progressTimer = undefined;

					if (progress?.phase === "complete") {
						new Notice(t("notice.backupComplete"));
						this.statusBarUpdater("connected");
					} else if (progress?.phase === "error") {
						new Notice(t("notice.backupError"));
						this.statusBarUpdater("error");
					} else {
						this.statusBarUpdater("connected");
					}
					return;
				}

				const pct = progress.total_files > 0
					? Math.round((progress.processed_files / progress.total_files) * 100)
					: 0;
				this.statusBarUpdater("backing_up", `${pct}%`);
				this.pollProgress();
			} catch (err) {
				this.logError("progress polling failed", err);
				this.pollProgress();
			}
		}, 3000);
	}

	stopProgressPolling() {
		if (this.progressTimer) window.clearTimeout(this.progressTimer);
		this.progressTimer = undefined;
	}

	private formatRelativeTime(date: Date): string {
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffMins = Math.floor(diffMs / 60000);
		if (diffMins < 1) return t("time.justNow");
		if (diffMins < 60) return t("time.minutesAgo", { count: diffMins });
		const diffHours = Math.floor(diffMins / 60);
		if (diffHours < 24) return t("time.hoursAgo", { count: diffHours });
		const diffDays = Math.floor(diffHours / 24);
		return t("time.daysAgo", { count: diffDays });
	}

	private logError(context: string, err: unknown) {
		const msg = err instanceof Error ? err.message : String(err);
		console.error(`[Ginkgo Backup] ${context}: ${msg}`, err);
	}
}
