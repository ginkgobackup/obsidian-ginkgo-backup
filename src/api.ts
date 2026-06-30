import { requestUrl, type RequestUrlParam } from "obsidian";
import {
	type HealthResponse,
	type StatusResponse,
	type Source,
	type Repository,
	type SnapshotPage,
	type FileHistoryEntry,
	type BackupProgress,
	type StagingRequest,
	type StagingResult,
	type StagingSession,
	type HistoryDiff,
	GinkgoApiError,
	GinkgoErrorType,
} from "./types";
import { defaultSchemeForHost, safeParseJson } from "./utils";

export class GinkgoBackupClient {
	private baseURL: string;
	private token: string;

	constructor(host: string, port: number, token: string) {
		this.baseURL = this.buildBaseURL(host, port);
		this.token = token;
	}

	updateConfig(host: string, port: number, token: string): void {
		this.baseURL = this.buildBaseURL(host, port);
		this.token = token;
	}

	private buildBaseURL(host: string, port: number): string {
		if (host.startsWith("http://") || host.startsWith("https://")) {
			const url = new URL(host);
			if (port && !host.includes(":" + port)) {
				url.port = String(port);
			}
			return `${url.origin}/api/v1`;
		}
		// 非 localhost 且未显式声明协议时强制 HTTPS，避免 Token 明文走 HTTP。
		// localhost / 127.0.0.1 / 0.0.0.0 / 内网 IP 仍允许 HTTP。
		const scheme = defaultSchemeForHost(host);
		return `${scheme}://${host}:${port}/api/v1`;
	}

	private async request<T>(
		method: string,
		path: string,
		body?: unknown
	): Promise<T> {
		const opts: RequestUrlParam = {
			url: `${this.baseURL}${path}`,
			method,
			headers: {
				"X-Ginkgo-Token": this.token,
				"Content-Type": "application/json",
			},
			throw: false,
		};
		if (body !== undefined) {
			opts.body = JSON.stringify(body);
		}

		let resp;
		try {
			resp = await requestUrl(opts);
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			if (msg.includes("net::ERR_CONNECTION_REFUSED") || msg.includes("ECONNREFUSED") || msg.includes("fetch") || msg.includes("connect") || msg.includes("timeout") || msg.includes("Timeout")) {
				throw new GinkgoApiError(GinkgoErrorType.NETWORK, "Cannot connect to Ginkgo Backup");
			}
			throw new GinkgoApiError(GinkgoErrorType.NETWORK, msg);
		}

		const status = resp.status;

		if (status === 0) {
			throw new GinkgoApiError(GinkgoErrorType.NETWORK, "Cannot connect to Ginkgo Backup");
		}

		if (status === 401) {
			throw new GinkgoApiError(GinkgoErrorType.AUTH, "Invalid API token", 401, "unauthorized");
		}

		if (status === 429) {
			throw new GinkgoApiError(GinkgoErrorType.RATE_LIMITED, "Too many requests", 429, "rate_limited");
		}

		if (status >= 400) {
			// 服务端可能返回非 JSON 错误（如 Nginx 的
			// "Client sent an HTTP request to an HTTPS server" 纯文本），
			// 必须用 safeParseJson 容错，否则访问 resp.json 会抛出
			// "Unexpected token ..." 混乱错误。
			const errData = safeParseJson(resp.text) as
				| { error?: { code?: string; message?: string } }
				| null;
			const code = errData?.error?.code ?? "";
			// 优先用 JSON 里的 message；没有则回退到纯文本 body；都没有才用 HTTP 状态
			const message = errData?.error?.message || (resp.text && resp.text.trim()) || `HTTP ${status}`;

			if (status === 404) {
				throw new GinkgoApiError(GinkgoErrorType.NOT_FOUND, message, 404, code);
			}
			if (status === 400) {
				throw new GinkgoApiError(GinkgoErrorType.BAD_REQUEST, message, 400, code);
			}
			if (status >= 500) {
				throw new GinkgoApiError(GinkgoErrorType.SERVER, message, status, code);
			}
			throw new GinkgoApiError(GinkgoErrorType.UNKNOWN, message, status, code);
		}

		if (resp.text === "" || resp.text === undefined || resp.text === null) {
			// 已知类型安全妥协:空响应返回 undefined,调用方需自行处理可能的空值
			return undefined as unknown as T;
		}

		// 信任服务端返回的 JSON 结构,未做运行时 schema 校验。
		// 用 safeParseJson 避免非 JSON 响应（代理错误页等）抛错。
		const parsed = safeParseJson(resp.text);
		if (parsed === null) {
			// 响应非 JSON 但状态码 2xx——视为空响应
			return undefined as unknown as T;
		}
		return parsed as T;
	}

	async health(): Promise<HealthResponse> {
		return this.request<HealthResponse>("GET", "/health");
	}

	async isConnected(): Promise<boolean> {
		try {
			const h = await this.health();
			return h.status === "ok";
		} catch {
			return false;
		}
	}

	async getStatus(): Promise<StatusResponse> {
		return this.request<StatusResponse>("GET", "/status");
	}

	async getSources(): Promise<Source[]> {
		return this.request<Source[]>("GET", "/sources");
	}

	async getRepositories(): Promise<Repository[]> {
		return this.request<Repository[]>("GET", "/repositories");
	}

	async createSource(path: string, name: string, repoPaths: string[], schedule = "daily", excludes?: string[]): Promise<Source> {
		// enabled=true 创建即启用；watch_mode=disabled 关闭实时文件监控，
		// 仅靠 schedule 定时触发全量备份（每小时一次）。
		const body: Record<string, unknown> = {
			path,
			name,
			schedule,
			repo_paths: repoPaths,
			watch_mode: "disabled",
			enabled: true,
		};
		if (excludes && excludes.length > 0) {
			body.excludes = excludes;
		}
		return this.request<Source>("POST", "/sources", body);
	}

	async findSourceByPath(vaultPath: string): Promise<Source | null> {
		const sources = await this.getSources();
		const normalized = vaultPath.replace(/\\/g, "/").toLowerCase();
		for (const s of sources) {
			if (s.path.replace(/\\/g, "/").toLowerCase() === normalized) {
				return s;
			}
		}
		return null;
	}

	async ensureSourceExists(vaultPath: string, name: string, repoPaths: string[], excludes?: string[]): Promise<Source | null> {
		const existing = await this.findSourceByPath(vaultPath);
		if (existing) {
			const updatePayload: Record<string, unknown> = { repo_paths: repoPaths };
			if (excludes) updatePayload.excludes = excludes;
			await this.updateSource(existing.id, updatePayload);
			return await this.getSourceById(existing.id);
		}
		return await this.createSource(vaultPath, name, repoPaths, "hourly", excludes);
	}

	async getSourceById(id: number): Promise<Source | null> {
		try {
			return await this.request<Source>("GET", `/sources/${id}`);
		} catch {
			return null;
		}
	}

	async updateSource(id: number, updates: Record<string, unknown>): Promise<void> {
		await this.request("PUT", `/sources/${id}`, updates);
	}

	async triggerBackup(sourceId: number, message?: string): Promise<{ session_id: string }> {
		return this.request<{ session_id: string }>("POST", "/backup/run", {
			source_id: sourceId,
			message: message ?? "",
		});
	}

	async getProgress(sourceId?: number): Promise<BackupProgress | BackupProgress[]> {
		const path = sourceId
			? `/backup/progress?source_id=${sourceId}`
			: "/backup/progress";
		return this.request<BackupProgress | BackupProgress[]>("GET", path);
	}

	async getBackupState(): Promise<{ state: string }> {
		return this.request<{ state: string }>("GET", "/backup/state");
	}

	async cancelBackup(sourceId?: number): Promise<void> {
		const path = sourceId
			? `/backup/cancel?source_id=${sourceId}`
			: "/backup/cancel";
		await this.request("POST", path);
	}

	async stagingPush(req: StagingRequest): Promise<StagingResult> {
		return this.request<StagingResult>("POST", "/staging/push", {
			...req,
			trigger: req.trigger ?? "api",
		});
	}

	async getStagingSession(sessionId: string): Promise<StagingSession> {
		return this.request<StagingSession>("GET", `/staging/session?id=${sessionId}`);
	}

	async getSnapshots(sourceId: number, limit = 20, offset = 0): Promise<SnapshotPage> {
		return this.request<SnapshotPage>(
			"GET",
			`/snapshots?source_id=${sourceId}&limit=${limit}&offset=${offset}`
		);
	}

	async getFileHistory(sourceId: number, filePath: string, repoPath?: string): Promise<FileHistoryEntry[]> {
		const encoded = encodeURIComponent(filePath);
		let url = `/history?source_id=${sourceId}&path=${encoded}`;
		if (repoPath) {
			url += `&repo=${encodeURIComponent(repoPath)}`;
		}
		return this.request<FileHistoryEntry[]>("GET", url);
	}

	async getFileContent(sourceId: number, filePath: string, snapshotTime: number, repoPath?: string): Promise<{ source_id: number; path: string; snapshot_time: number; size: number; hash: string; content?: string; error?: string }> {
		const encoded = encodeURIComponent(filePath);
		let url = `/history/content?source_id=${sourceId}&path=${encoded}&snapshot=${snapshotTime}`;
		if (repoPath) {
			url += `&repo=${encodeURIComponent(repoPath)}`;
		}
		return this.request<{ source_id: number; path: string; snapshot_time: number; size: number; hash: string; content?: string; error?: string }>("GET", url);
	}

	async getFileDiff(sourceId: number, filePath: string, oldSnapshot: number, newSnapshot: number, repoPath?: string): Promise<HistoryDiff> {
		const encoded = encodeURIComponent(filePath);
		let url = `/history/diff?source_id=${sourceId}&path=${encoded}&old_snapshot=${oldSnapshot}&new_snapshot=${newSnapshot}`;
		if (repoPath) {
			url += `&repo=${encodeURIComponent(repoPath)}`;
		}
		return this.request<HistoryDiff>("GET", url);
	}

	async restoreFile(sourceId: number, filePath: string, snapshotTime: number, destPath?: string, repoPath?: string): Promise<{ task_id: string; status: string }> {
		const body: Record<string, unknown> = {
			source_id: sourceId,
			path: filePath,
			snapshot: snapshotTime,
		};
		if (destPath) {
			body.dest = destPath;
		}
		if (repoPath) {
			body.repo = repoPath;
		}
		return this.request("POST", "/history/restore", body);
	}

	async browseDirectory(sourceId: number, dirPath: string, snapshotTime?: number, limit = 100, offset = 0) {
		const params = new URLSearchParams({
			source_id: String(sourceId),
			dir: dirPath,
			limit: String(limit),
			offset: String(offset),
		});
		if (snapshotTime !== undefined) {
			params.set("snapshot", String(snapshotTime));
		}
		return this.request("GET", `/files?${params.toString()}`);
	}
}
