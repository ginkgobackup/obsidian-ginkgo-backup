/**
 * 纯工具函数，不依赖 Obsidian / DOM / Node API。
 * 这些函数可被单元测试覆盖。
 */

// 时间戳单位阈值（ns > 1e15 > µs > 1e12 > ms > 1e9）
export const NS_THRESHOLD = 1e15;
export const US_THRESHOLD = 1e12;
export const NS_TO_MS = 1_000_000;
export const US_TO_MS = 1_000;

// 用于表示"当前版本"的哨兵时间戳（>9000000000000ns 区分历史与当前）
export const SENTINEL_TS_THRESHOLD = 9_000_000_000_000;

// LCS 算法保护阈值，超过则降级到 simple diff，避免 O(m*n) 内存爆炸
export const LCS_FALLBACK_THRESHOLD = 4_000_000;

// base64 分块大小，避免 String.fromCharCode.apply 参数上限
export const BASE64_CHUNK_SIZE = 0x8000;

/**
 * 把服务端返回的时间戳统一转换为 Date。
 * 支持三种单位：纳秒 / 微秒 / 毫秒（按数量级自动判定）。
 */
export function tsToDate(ts: number): Date {
	if (ts > NS_THRESHOLD) return new Date(ts / NS_TO_MS);
	if (ts > US_THRESHOLD) return new Date(ts / US_TO_MS);
	return new Date(ts);
}

/**
 * 判断是否为"当前版本"哨兵时间戳。
 */
export function isSentinelTs(ts: number): boolean {
	return ts > SENTINEL_TS_THRESHOLD;
}

/**
 * 选取有效的快照时间戳：哨兵值回退到 first_seen。
 */
export function effectiveTs(firstSeen: number, lastSeen: number): number {
	return isSentinelTs(lastSeen) ? firstSeen : lastSeen;
}

export function formatBytes(bytes: number): string {
	if (!bytes || isNaN(bytes)) return "0 B";
	const sign = bytes < 0 ? "-" : "";
	const abs = Math.abs(bytes);
	if (abs < 1024) return `${sign}${abs} B`;
	if (abs < 1048576) return `${sign}${(abs / 1024).toFixed(1)} KB`;
	if (abs < 1073741824) return `${sign}${(abs / 1048576).toFixed(1)} MB`;
	return `${sign}${(abs / 1073741824).toFixed(1)} GB`;
}

export function logError(context: string, err: unknown): void {
	const msg = err instanceof Error ? err.message : String(err);
	// eslint-disable-next-line no-console
	console.error(`[Ginkgo Backup] ${context}: ${msg}`, err);
}

/**
 * 判断路径是否被排除规则命中。采用分段匹配，避免 "notes" 误排除 "notes-archive"。
 * pattern 既匹配路径段（如 ".obsidian"），也匹配文件名前缀（如 ".DS_Store"）。
 */
export function isPathExcluded(filePath: string, patterns: string[]): boolean {
	const normalized = filePath.replace(/\\/g, "/");
	const segments = normalized.split("/");
	for (const pattern of patterns) {
		const p = pattern.replace(/\\/g, "/").trim();
		if (!p) continue;
		// 整段匹配：任一路径段 === pattern
		if (segments.some((seg) => seg === p)) return true;
		// 路径前缀匹配（保留对前缀片段的兼容，如 "sub/folder"）
		if (normalized === p || normalized.startsWith(p + "/")) return true;
	}
	return false;
}

/**
 * 判断 host 是否为 loopback（本机回环）。
 */
export function isLoopbackHost(host: string): boolean {
	return /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])$/i.test(host);
}

/**
 * 判断 host 是否为内网 IP（RFC 1918 私有地址）。
 */
export function isPrivateLanHost(host: string): boolean {
	return (
		/^10\./.test(host) ||
		/^192\.168\./.test(host) ||
		/^172\.(1[6-9]|2\d|3[01])\./.test(host)
	);
}

/**
 * 根据主机名决定默认 scheme：
 * - loopback（127.0.0.1 / localhost）→ https（服务端默认启用 TLS 自签名）
 * - 内网 IP → http（LAN 部署常无 TLS，避免误伤）
 * - 其他（公网域名 / 公网 IP）→ https（避免 Token 明文）
 * 用户若显式在 host 中带 http(s):// 前缀，则以前缀为准（逃生通道）。
 */
export function defaultSchemeForHost(host: string): "http" | "https" {
	if (isLoopbackHost(host)) return "https";
	return isPrivateLanHost(host) ? "http" : "https";
}

/**
 * 安全解析 JSON 文本。解析失败（或输入为空/非字符串）时返回 null，绝不抛错。
 * 用于处理服务端/代理返回的非 JSON 响应（如 Nginx 的
 * "Client sent an HTTP request to an HTTPS server" 纯文本错误）。
 */
export function safeParseJson(text: unknown): unknown | null {
	if (typeof text !== "string") return null;
	const trimmed = text.trim();
	if (trimmed === "") return null;
	try {
		return JSON.parse(trimmed);
	} catch {
		return null;
	}
}
