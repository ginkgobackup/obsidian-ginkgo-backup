export interface Repository {
	id: number;
	path: string;
	display_name: string;
	type: string;
	encrypted: boolean;
}

export interface GinkgoBackupSettings {
	apiHost: string;
	apiPort: number;
	apiToken: string;
	refreshInterval: number;
	showStatusBar: boolean;
	autoBackup: boolean;
	autoBackupIntervalMinutes: number;
	autoBackupDebounceMs: number;
	stagingPushOnSave: boolean;
	sourceId: number;
	excludePaths: string[];
	watchExtensions: string[];
	vaultIdentifier: string;
	language: "auto" | "zh-CN" | "en";
	largeFileThresholdBytes: number;
}

export const DEFAULT_SETTINGS: GinkgoBackupSettings = {
	apiHost: "127.0.0.1",
	apiPort: 9275,
	apiToken: "",
	refreshInterval: 60,
	showStatusBar: true,
	autoBackup: false,
	autoBackupIntervalMinutes: 60,
	autoBackupDebounceMs: 30000,
	stagingPushOnSave: true,
	sourceId: 0,
	excludePaths: [".obsidian", ".trash", ".DS_Store"],
	watchExtensions: ["md", "canvas", "base", "json", "css"],
	vaultIdentifier: "",
	language: "auto",
	largeFileThresholdBytes: 5 * 1024 * 1024,
};

export interface HealthResponse {
	status: string;
	version: string;
}

export interface StatusResponse {
	source_count: number;
	enabled_count: number;
	snapshot_count: number;
	storage_used: number;
	backup_running: boolean;
}

export interface Source {
	id: number;
	path: string;
	name: string;
	enabled: boolean;
	schedule: string;
	excludes: string[];
	watch_mode: string;
	last_backup: number;
	file_count: number;
	total_bytes: number;
	repo_paths: string[];
	created_at: number;
	updated_at: number;
}

export interface Snapshot {
	id: number;
	source_id: number;
	timestamp: number;
	file_count: number;
	dir_count: number;
	deleted_count: number;
	total_size: number;
	new_files: number;
	changed_files: number;
	new_bytes: number;
	duration_ms: number;
	status: string;
	tags: string[];
	created_at: number;
}

export interface SnapshotPage {
	items: Snapshot[];
	total: number;
	has_more: boolean;
}

export interface FileHistoryEntry {
	first_seen: number;
	last_seen: number;
	size: number;
	content_hash: string;
	size_delta: number;
	is_deleted: boolean;
}

export interface DirectoryEntry {
	name: string;
	type: string;
	size: number;
	hash: string;
	mtime: number;
	path: string;
	is_deleted: boolean;
	file_count: number;
	dir_count: number;
	total_size: number;
}

export interface BackupProgress {
	source_id: number;
	source_name: string;
	phase: string;
	total_files: number;
	processed_files: number;
	total_bytes: number;
	processed_bytes: number;
	current_file: string;
	bytes_per_second: number;
	estimated_eta_sec: number;
	errors: number;
	skipped_files: number;
}

export interface StagingRequest {
	source_id: number;
	message: string;
	files: FilePush[];
	trigger?: string;
}

export interface FilePush {
	rel_path: string;
	action: "add" | "modify" | "delete";
	content?: string;
	size?: number;
	mode?: number;
	mtime?: number;
}

export interface StagingResult {
	session_id: string;
	status: string;
	file_count: number;
	total_size: number;
}

export interface StagingSession {
	id: string;
	source_id: number;
	source_name: string;
	status: "pending" | "staged" | "running" | "completed" | "failed";
	trigger: string;
	message: string;
	staged_at: number;
	started_at: number;
	finished_at: number;
	file_count: number;
	total_bytes: number;
	retry_count: number;
	max_retries: number;
	error_message: string;
}

export interface HistoryDiff {
	source_id: number;
	path: string;
	diff_type: "unchanged" | "modified" | "deleted" | "restored";
	old: FileHistoryEntry | null;
	new: FileHistoryEntry | null;
	size_delta: number;
}

export enum GinkgoErrorType {
	NETWORK = "network",
	AUTH = "auth",
	NOT_FOUND = "not_found",
	RATE_LIMITED = "rate_limited",
	BAD_REQUEST = "bad_request",
	SERVER = "server",
	UNKNOWN = "unknown",
}

export class GinkgoApiError extends Error {
	readonly type: GinkgoErrorType;
	readonly statusCode: number;
	readonly code: string;

	constructor(type: GinkgoErrorType, message: string, statusCode: number = 0, code: string = "") {
		super(message);
		this.name = "GinkgoApiError";
		this.type = type;
		this.statusCode = statusCode;
		this.code = code;
	}

	get userMessage(): string {
		switch (this.type) {
			case GinkgoErrorType.NETWORK:
				return "Ginkgo Backup 未运行，请确保应用已启动";
			case GinkgoErrorType.AUTH:
				return "API Token 无效，请在设置中检查 Token";
			case GinkgoErrorType.NOT_FOUND:
				return "备份源未找到，请重新配置";
			case GinkgoErrorType.RATE_LIMITED:
				return "请求过于频繁，请稍后再试";
			case GinkgoErrorType.BAD_REQUEST:
				return `请求错误: ${this.message}`;
			case GinkgoErrorType.SERVER:
				return `服务器错误: ${this.message}`;
			default:
				return this.message;
		}
	}
}
