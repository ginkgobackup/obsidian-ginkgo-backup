// 纯函数单元测试，使用 Node.js 内置 test runner 运行：`npm test`
// 仅测试不依赖 Obsidian API 的纯函数。

import { test } from "node:test";
import assert from "node:assert/strict";
import {
	formatBytes,
	isPathExcluded,
	tsToDate,
	isSentinelTs,
	effectiveTs,
	isLoopbackHost,
	isPrivateLanHost,
	defaultSchemeForHost,
	safeParseJson,
	NS_THRESHOLD,
	US_THRESHOLD,
} from "../src/utils.ts";

// formatBytes
test("formatBytes: 0 / falsy / negative", () => {
	assert.equal(formatBytes(0), "0 B");
	assert.equal(formatBytes(NaN), "0 B");
	assert.equal(formatBytes(-1024), "-1.0 KB");
});

test("formatBytes: bytes < 1KB", () => {
	assert.equal(formatBytes(1), "1 B");
	assert.equal(formatBytes(512), "512 B");
	assert.equal(formatBytes(1023), "1023 B");
});

test("formatBytes: KB / MB / GB boundaries", () => {
	assert.equal(formatBytes(1024), "1.0 KB");
	assert.equal(formatBytes(1048576), "1.0 MB");
	assert.equal(formatBytes(1073741824), "1.0 GB");
	assert.equal(formatBytes(1572864), "1.5 MB");
});

// isPathExcluded
test("isPathExcluded: 段名整段匹配", () => {
	assert.ok(isPathExcluded("notes/foo.md", ["notes"]));
	assert.ok(isPathExcluded("foo/.obsidian/app.json", [".obsidian"]));
});

test("isPathExcluded: 不应误匹配前缀相似但段不同的路径", () => {
	// "notes" 不应排除 "notes-archive/x.md"（分段匹配语义）
	assert.equal(isPathExcluded("notes-archive/x.md", ["notes"]), false);
	assert.equal(isPathExcluded("notesarchive/x.md", ["notes"]), false);
});

test("isPathExcluded: 显式路径前缀匹配（含斜杠）", () => {
	assert.ok(isPathExcluded("sub/folder/a.md", ["sub/folder"]));
	assert.ok(isPathExcluded("sub\\folder\\a.md", ["sub/folder"]));
});

test("isPathExcluded: 空模式跳过", () => {
	assert.equal(isPathExcluded("a.md", [""]), false);
	assert.equal(isPathExcluded("a.md", ["  "]), false);
});

test("isPathExcluded: 大小写敏感 + 文件名段匹配", () => {
	assert.ok(isPathExcluded(".DS_Store", [".DS_Store"]));
	assert.equal(isPathExcluded("foo.md", ["FOO"]), false);
});

// tsToDate
test("tsToDate: 纳秒（>1e15）", () => {
	const ns = 2_000_000_000_000_000_000;
	const d = tsToDate(ns);
	assert.equal(d.getTime(), 2_000_000_000_000);
});

test("tsToDate: 微秒（1e12 < ts < 1e15）", () => {
	const us = 500_000_000_000_000; // 5e14
	const d = tsToDate(us);
	assert.equal(d.getTime(), 500_000_000_000);
});

test("tsToDate: 毫秒（< 1e12）", () => {
	const ms = 900_000_000_000; // 9e11
	const d = tsToDate(ms);
	assert.equal(d.getTime(), 900_000_000_000);
});

// isSentinelTs / effectiveTs
test("isSentinelTs: 阈值判定", () => {
	assert.equal(isSentinelTs(9_000_000_000_001), true);
	assert.equal(isSentinelTs(9_000_000_000_000), false);
	assert.equal(isSentinelTs(1_700_000_000_000), false);
});

test("effectiveTs: 哨兵回退到 first_seen", () => {
	assert.equal(effectiveTs(1_700_000_000_000, 9_999_999_999_999), 1_700_000_000_000);
	assert.equal(effectiveTs(1_700_000_000_000, 1_700_000_001_000), 1_700_000_001_000);
});

// 常量一致性
test("threshold 常量: ns > us > ms 数量级", () => {
	assert.ok(NS_THRESHOLD > US_THRESHOLD);
	assert.ok(US_THRESHOLD > 1e9);
});

// isLoopbackHost
test("isLoopbackHost: 识别本机回环", () => {
	assert.equal(isLoopbackHost("localhost"), true);
	assert.equal(isLoopbackHost("127.0.0.1"), true);
	assert.equal(isLoopbackHost("0.0.0.0"), true);
	assert.equal(isLoopbackHost("[::1]"), true);
	assert.equal(isLoopbackHost("LOCALHOST"), true);
});

test("isLoopbackHost: 非回环返回 false", () => {
	assert.equal(isLoopbackHost("192.168.1.1"), false);
	assert.equal(isLoopbackHost("example.com"), false);
	assert.equal(isLoopbackHost("10.0.0.1"), false);
});

// isPrivateLanHost
test("isPrivateLanHost: RFC 1918 私有地址", () => {
	assert.equal(isPrivateLanHost("10.0.0.1"), true);
	assert.equal(isPrivateLanHost("192.168.1.1"), true);
	assert.equal(isPrivateLanHost("172.16.0.1"), true);
	assert.equal(isPrivateLanHost("172.31.255.255"), true);
});

test("isPrivateLanHost: 边界 172.15 / 172.32 不算私有", () => {
	assert.equal(isPrivateLanHost("172.15.0.1"), false);
	assert.equal(isPrivateLanHost("172.32.0.1"), false);
});

test("isPrivateLanHost: 不应把 1172.16 误判为 172.16", () => {
	// 正则锚定 ^172\. 应排除前缀数字
	assert.equal(isPrivateLanHost("1172.16.0.1"), false);
});

test("isPrivateLanHost: 公网地址返回 false", () => {
	assert.equal(isPrivateLanHost("8.8.8.8"), false);
	assert.equal(isPrivateLanHost("example.com"), false);
});

// defaultSchemeForHost
test("defaultSchemeForHost: loopback → https（服务端默认启用 TLS）", () => {
	assert.equal(defaultSchemeForHost("localhost"), "https");
	assert.equal(defaultSchemeForHost("127.0.0.1"), "https");
});

test("defaultSchemeForHost: 内网 IP → http（LAN 部署常无 TLS）", () => {
	assert.equal(defaultSchemeForHost("10.0.0.1"), "http");
	assert.equal(defaultSchemeForHost("192.168.1.1"), "http");
});

test("defaultSchemeForHost: 公网域名 / 公网 IP → https", () => {
	assert.equal(defaultSchemeForHost("example.com"), "https");
	assert.equal(defaultSchemeForHost("8.8.8.8"), "https");
	assert.equal(defaultSchemeForHost("backup.example.com"), "https");
});

// safeParseJson
test("safeParseJson: 合法 JSON 返回解析结果", () => {
	assert.deepEqual(safeParseJson('{"a":1}'), { a: 1 });
	assert.deepEqual(safeParseJson('[1,2,3]'), [1, 2, 3]);
	assert.equal(safeParseJson("null"), null);
	assert.equal(safeParseJson('"text"'), "text");
	assert.equal(safeParseJson("42"), 42);
});

test("safeParseJson: 非 JSON 文本返回 null（不抛错）", () => {
	// 模拟 Nginx 的纯文本错误
	assert.equal(safeParseJson("Client sent an HTTP request to an HTTPS server"), null);
	assert.equal(safeParseJson("Not Found"), null);
	assert.equal(safeParseJson("<html>404</html>"), null);
});

test("safeParseJson: 空输入与非字符串返回 null", () => {
	assert.equal(safeParseJson(""), null);
	assert.equal(safeParseJson("   "), null);
	assert.equal(safeParseJson(null), null);
	assert.equal(safeParseJson(undefined), null);
	assert.equal(safeParseJson(123), null);
	assert.equal(safeParseJson({}), null);
});
