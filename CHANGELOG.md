# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.5.0] - 2026-06-30

### Added
- **时间线日历视图**：快照列表改为日历选择日期 + 当天快照列表模式，前端拉取 500 条快照缓存后按日过滤。
- **状态栏「打开设置」菜单项**：右键状态栏图标可直接跳转到本插件设置页。
- **配置完成后自动触发全量备份**：绑定 Vault 后立即备份，无需等待下一个调度周期。

### Changed
- **设置页 UI 精简**：移除 Banner logo 图标，保留名称与版本；连接状态改为紧凑胶囊样式（含 7px 状态点）。
- **时间线「当天大小」指标**：从 `total_size` 累加改为 `new_bytes` 累加，避免误解为中英文标签同步调整。
- **API 错误响应容错**：用 `safeParseJson` 解析服务端错误体，兼容 Nginx 纯文本错误（如 HTTPS/HTTP 协议错配），不再抛出 "Unexpected token"。

### Fixed
- **时间线日期显示 1970**：`tsToDate` 时间戳阈值（ns/µs/ms）修正，原阈值在 2026 年后失效。
- **「跳到最新」重复添加概览卡片**：在 `renderDayList` 中清理 `.ginkgo-day-summary` 元素。

## [0.4.2] - 2026-06-25

### Fixed
- **设置页版本号硬编码**：Banner 中显示 `v0.3.0` 与实际不符，改用 `manifest.version`。
- **hash-cache 跨设备污染**：当 `vaultIdentifier` 非空时，缓存按标识符子目录隔离，避免多设备同步 Vault 时哈希/pending 缓存互相覆盖。
- **timeline-view 脆弱 DOM 索引**：用 `contentEl` 替换 `containerEl.children[1]`。
- **isExcluded 误排除**：原前缀匹配会把 `notes` 误排除 `notes-archive/`，改为分段匹配。
- **onunload 未等待 finalize**：异常落地逻辑改为 fire-and-forget + try/catch，避免快速卸载时丢失 pending。

### Changed
- **HTTPS 强制**：非 localhost / 非内网 IP 默认走 HTTPS，避免 Token 明文走 HTTP。
- **统一时间戳转换**：新增 `tsToDate()` 统一处理 ns/µs/ms 三种单位，消除分散的魔法数字。
- **公共 utils 抽取**：`formatBytes` / `logError` / `handleError` / `tsToDate` 等不再在 4+ 文件重复。
- **魔法数字常量化**：LCS 阈值、base64 分块大小、哨兵时间戳均提取为命名常量。

### Added
- **首次启用引导**：Token 未配置或未连接时自动弹出 SetupGuideModal，含四步引导与一键测试连接。
- **i18n 完整覆盖 SetupGuide**：新增 `setup.*` 共 16 个 key 的中英文翻译。
- **恢复前自动备份**：覆盖当前文件前先把当前内容推送到 staging，避免本地未推送的改动被覆盖丢失。
- **纯函数单测**：新增 `tests/utils.test.ts` 覆盖 `formatBytes` / `isPathExcluded` / `tsToDate` / `isSentinelTs` / `effectiveTs`。

### Removed
- 删除未使用的 `file-diff-modal.ts`（死代码）。
- 移除未使用的 `diff` / `@types/diff` 依赖。

## [0.4.1] - 2026-06

- 初始公开版本：即时推送、全量备份、版本对比、A/B 比对、一键恢复、中英双语。
