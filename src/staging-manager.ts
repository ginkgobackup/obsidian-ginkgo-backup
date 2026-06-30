import { Notice, TFile, debounce, type EventRef } from "obsidian";
import { GinkgoBackupClient } from "./api";
import { encodeText, encodeBinary } from "./encoding";
import { t } from "./i18n";
import { formatBytes, logError, isPathExcluded, isENOENT } from "./utils";
import { handleError } from "./ui-utils";
import type { GinkgoBackupSettings, FilePush } from "./types";

const PENDING_CACHE_FILENAME = "pending.json";
const HASH_CACHE_FILENAME = "hash-cache.json";

/**
 * 按设备/标识符隔离缓存路径。
 * 默认放在 vault 配置目录（`Vault.configDir`，通常为 `.obsidian`）下的
 * `plugins/ginkgo-backup/`，但若用户设置了 vaultIdentifier，则追加一个子目录
 * 避免跨设备同步时互相覆盖。这样多设备同步 vault 也不会让 hash/pending 缓存互相污染。
 *
 * 注意：不硬编码 `.obsidian`，因为配置目录位置可被 Obsidian 自定义（见官方插件规范）。
 */
function resolveCacheDir(configDir: string, vaultIdentifier: string): string {
	const base = `${configDir}/plugins/ginkgo-backup`;
	const safe = (vaultIdentifier || "").replace(/[^A-Za-z0-9_-]/g, "_").trim();
	if (!safe) return base;
	return `${base}/${safe}`;
}

export class StagingManager {
	private app: import("obsidian").App;
	private client: GinkgoBackupClient;
	private settings: GinkgoBackupSettings;
	private getVaultSourceId: () => number;

	pendingModifiedFiles: Set<string> = new Set();
	private lastPushedHashes: Map<string, string> = new Map();
	private debouncedSavePending?: () => void;
	private debouncedStagingPush?: () => void;
	private modifyEventRef?: EventRef;
	private autoBackupTimer?: number;
	private onBackupVault: () => void;
	private registerEvent: (ref: EventRef) => void;

	constructor(
		app: import("obsidian").App,
		client: GinkgoBackupClient,
		settings: GinkgoBackupSettings,
		getVaultSourceId: () => number,
		onBackupVault: () => void,
		registerEvent: (ref: EventRef) => void
	) {
		this.app = app;
		this.client = client;
		this.settings = settings;
		this.getVaultSourceId = getVaultSourceId;
		this.onBackupVault = onBackupVault;
		this.registerEvent = registerEvent;
	}

	private get pendingCachePath(): string {
		return `${resolveCacheDir(this.app.vault.configDir, this.settings.vaultIdentifier)}/${PENDING_CACHE_FILENAME}`;
	}

	private get hashCachePath(): string {
		return `${resolveCacheDir(this.app.vault.configDir, this.settings.vaultIdentifier)}/${HASH_CACHE_FILENAME}`;
	}

	async initialize() {
		this.debouncedSavePending = debounce(() => this.savePendingCache(), 5000);
		await this.loadHashCache();
		await this.loadPendingCache();
	}

	updateSettings(settings: GinkgoBackupSettings) {
		this.settings = settings;
		this.setupAutoBackup();
	}

	teardown() {
		if (this.modifyEventRef) {
			this.app.vault.offref(this.modifyEventRef);
			this.modifyEventRef = undefined;
		}
		this.stopAutoBackupTimer();
	}

	private stopAutoBackupTimer() {
		if (this.autoBackupTimer) {
			window.clearTimeout(this.autoBackupTimer);
			this.autoBackupTimer = undefined;
		}
	}

	async persist() {
		await this.saveHashCache();
		if (this.pendingModifiedFiles.size > 0) {
			await this.savePendingCache();
		}
	}

	setupAutoBackup() {
		if (this.modifyEventRef) {
			this.app.vault.offref(this.modifyEventRef);
			this.modifyEventRef = undefined;
		}
		this.stopAutoBackupTimer();

		this.debouncedStagingPush = debounce(
			async () => {
				const sourceId = this.getVaultSourceId();
				if (sourceId === 0) return;
				if (this.settings.stagingPushOnSave) {
					await this.stagingPushPendingFiles();
				}
			},
			this.settings.autoBackupDebounceMs
		);

		if (this.settings.stagingPushOnSave) {
			this.modifyEventRef = this.app.vault.on("modify", async (file) => {
				if (!(file instanceof TFile)) return;
				if (isPathExcluded(file.path, this.settings.excludePaths)) return;
				if (!this.isWatchedExtension(file)) return;
				if (await this.isLargeFile(file)) {
					new Notice(t("notice.largeFileSkipped", { name: file.name, size: formatBytes(this.settings.largeFileThresholdBytes) }), 5000);
					return;
				}
				if (!(await this.hasContentChanged(file))) return;
				this.pendingModifiedFiles.add(file.path);
				if (this.debouncedSavePending) {
					this.debouncedSavePending();
				}
				if (this.debouncedStagingPush) {
					this.debouncedStagingPush();
				}
			});
			this.registerEvent(this.modifyEventRef);
		}

		if (this.settings.autoBackup) {
			this.scheduleAutoBackup();
		}
	}

	private scheduleAutoBackup() {
		const intervalMs = this.settings.autoBackupIntervalMinutes * 60 * 1000;
		this.autoBackupTimer = window.setTimeout(async () => {
			const sourceId = this.getVaultSourceId();
			if (sourceId > 0) {
				this.onBackupVault();
			}
			this.scheduleAutoBackup();
		}, intervalMs);
	}

	private isWatchedExtension(file: TFile): boolean {
		return this.settings.watchExtensions.includes(file.extension);
	}

	private async isLargeFile(file: TFile): Promise<boolean> {
		try {
			const stat = await this.app.vault.adapter.stat(file.path);
			return (stat?.size ?? 0) > this.settings.largeFileThresholdBytes;
		} catch (err) {
			logError("stat file failed", err);
			return false;
		}
	}

	private async contentHash(str: string): Promise<string> {
		const data = new TextEncoder().encode(str);
		const hashBuffer = await crypto.subtle.digest("SHA-256", data);
		const hashArray = Array.from(new Uint8Array(hashBuffer));
		return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
	}

	private async hasContentChanged(file: TFile): Promise<boolean> {
		try {
			const content = await this.app.vault.read(file);
			const hash = await this.contentHash(content);
			const lastHash = this.lastPushedHashes.get(file.path);
			if (!lastHash) {
				this.lastPushedHashes.set(file.path, hash);
				return false;
			}
			if (hash === lastHash) return false;
			this.lastPushedHashes.set(file.path, hash);
			return true;
		} catch (err) {
			logError("hasContentChanged failed", err);
			return true;
		}
	}

	private isBinaryFile(file: TFile): boolean {
		const binaryExtensions = new Set(["png", "jpg", "jpeg", "gif", "bmp", "svg", "webp", "ico", "pdf", "mp3", "wav", "ogg", "m4a", "flac", "mp4", "webm", "mov", "zip", "gz", "tar", "7z", "rar"]);
		return binaryExtensions.has(file.extension.toLowerCase());
	}

	private async encodeFileContent(file: TFile): Promise<string> {
		if (this.isBinaryFile(file)) {
			const data = await this.app.vault.readBinary(file);
			return encodeBinary(data);
		}
		const content = await this.app.vault.read(file);
		return encodeText(content);
	}

	async stagingPushPendingFiles() {
		const sourceId = this.getVaultSourceId();
		if (sourceId === 0) return;

		const filePaths = Array.from(this.pendingModifiedFiles);
		this.pendingModifiedFiles.clear();
		await this.clearPendingCache();
		if (filePaths.length === 0) return;

		const files: FilePush[] = [];
		const failedPaths: string[] = [];
		for (const filePath of filePaths) {
			try {
				const file = this.app.vault.getAbstractFileByPath(filePath);
				if (!(file instanceof TFile)) continue;
				if (await this.isLargeFile(file)) {
					new Notice(t("notice.largeFileSkipped", { name: file.name, size: formatBytes(this.settings.largeFileThresholdBytes) }), 5000);
					continue;
				}

				const encoded = await this.encodeFileContent(file);
				const stat = await this.app.vault.adapter.stat(file.path);

				files.push({
					rel_path: file.path.replace(/\\/g, "/"),
					action: "modify",
					content: encoded,
					size: stat?.size ?? 0,
					mtime: (stat?.mtime ?? Date.now()) * 1000,
				});
			} catch (err) {
				logError("encode pending file failed", err);
				failedPaths.push(filePath);
			}
		}

		if (files.length === 0) {
			for (const p of failedPaths) this.pendingModifiedFiles.add(p);
			if (failedPaths.length > 0) await this.savePendingCache();
			return;
		}

		try {
			await this.client.stagingPush({
				source_id: sourceId,
				message: `Obsidian: ${files.length} file${files.length > 1 ? "s" : ""}`,
				files,
				trigger: "api",
			});
			const names = files.map((f) => f.rel_path.split("/").pop()).join(", ");
			new Notice(t("notice.pushSuccess", { count: files.length, names }), 4000);
			await this.saveHashCache();
			if (failedPaths.length > 0) {
				for (const p of failedPaths) this.pendingModifiedFiles.add(p);
				await this.savePendingCache();
			}
		} catch (err) {
			handleError(err, t("error.pushFailed"));
			for (const p of filePaths) this.pendingModifiedFiles.add(p);
			await this.savePendingCache();
		}
	}

	async stagingPushFile(file: TFile) {
		const sourceId = this.getVaultSourceId();
		if (sourceId === 0) {
			new Notice(t("notice.sourceNotConfigured"));
			return;
		}

		if (await this.isLargeFile(file)) {
			new Notice(t("notice.largeFileSkipped", { name: file.name, size: formatBytes(this.settings.largeFileThresholdBytes) }), 5000);
			return;
		}

		try {
			if (!(await this.hasContentChanged(file))) {
				new Notice(t("notice.pushSkipped"));
				return;
			}

			const encoded = await this.encodeFileContent(file);
			const relPath = file.path.replace(/\\/g, "/");
			const stat = await this.app.vault.adapter.stat(file.path);

			const filePush: FilePush = {
				rel_path: relPath,
				action: "modify",
				content: encoded,
				size: stat?.size ?? 0,
				mtime: (stat?.mtime ?? Date.now()) * 1000,
			};

			const result = await this.client.stagingPush({
				source_id: sourceId,
				message: `Obsidian: ${file.name}`,
				files: [filePush],
				trigger: "api",
			});

			new Notice(t("notice.pushFileSuccess", { name: file.name, session: result.session_id.slice(0, 8) }));
			if (!this.isBinaryFile(file)) {
				const content = await this.app.vault.read(file);
				this.lastPushedHashes.set(file.path, await this.contentHash(content));
			}
			await this.saveHashCache();
		} catch (err) {
			handleError(err, t("error.pushFailed"));
		}
	}

	private async savePendingCache() {
		try {
			const data = Array.from(this.pendingModifiedFiles);
			await this.app.vault.adapter.write(this.pendingCachePath, JSON.stringify(data));
		} catch (err) {
			logError("save pending cache failed", err);
		}
	}

	private async loadPendingCache() {
		try {
			const data = await this.app.vault.adapter.read(this.pendingCachePath);
			const paths: string[] = JSON.parse(data);
			if (Array.isArray(paths)) {
				for (const p of paths) {
					if (!isPathExcluded(p, this.settings.excludePaths)) {
						this.pendingModifiedFiles.add(p);
					}
				}
			}
		} catch (err) {
			if (!isENOENT(err)) logError("load pending cache failed", err);
		}
	}

	private async clearPendingCache() {
		try {
			await this.app.vault.adapter.remove(this.pendingCachePath);
		} catch (err) {
			if (!isENOENT(err)) logError("clear pending cache failed", err);
		}
	}

	private async saveHashCache() {
		try {
			const data: Record<string, string> = {};
			for (const [path, hash] of this.lastPushedHashes) {
				const file = this.app.vault.getAbstractFileByPath(path);
				if (file instanceof TFile) {
					data[path] = hash;
				}
			}
			this.lastPushedHashes = new Map(Object.entries(data));
			await this.app.vault.adapter.write(this.hashCachePath, JSON.stringify(data));
		} catch (err) {
			logError("save hash cache failed", err);
		}
	}

	private async loadHashCache() {
		try {
			const data = await this.app.vault.adapter.read(this.hashCachePath);
			const cache: Record<string, string> = JSON.parse(data);
			for (const [path, hash] of Object.entries(cache)) {
				this.lastPushedHashes.set(path, hash);
			}
		} catch (err) {
			if (!isENOENT(err)) logError("load hash cache failed", err);
		}
	}
}
