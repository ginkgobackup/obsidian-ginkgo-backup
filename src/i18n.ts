export type Locale = "zh-CN" | "en";

export type I18nKey =
	| "plugin.name"
	| "command.backupNow"
	| "command.openTimeline"
	| "command.pushPending"
	| "command.pushCurrentFile"
	| "command.checkStatus"
	| "command.setupSource"
	| "command.fileHistory"
	| "command.openApp"
	| "command.cancelBackup"
	| "command.openSettings"
	| "notice.notConnected"
	| "notice.noVaultPath"
	| "notice.sourceNotConfigured"
	| "notice.selectRepoFirst"
	| "notice.configuringSource"
	| "notice.sourceConfigured"
	| "notice.createSourceFailed"
	| "notice.pushFailed"
	| "notice.pushSuccess"
	| "notice.pushSkipped"
	| "notice.pushFileSuccess"
	| "notice.backupStarted"
	| "notice.backupComplete"
	| "notice.backupError"
	| "notice.backupFailed"
	| "notice.backupCancelled"
	| "notice.cancelNoBackup"
	| "notice.cancelRequested"
	| "notice.pendingPushed"
	| "notice.pendingFailed"
	| "notice.pendingRestored"
	| "notice.autoBackupPaused"
	| "notice.largeFileSkipped"
	| "status.never"
	| "status.disconnected"
	| "status.connected"
	| "status.connectedAria"
	| "status.disconnectedAria"
	| "status.backingUp"
	| "status.backingUpAria"
	| "status.error"
	| "status.errorAria"
	| "status.connecting"
	| "status.fileCount"
	| "status.idle"
	| "status.sources"
	| "status.snapshots"
	| "status.storage"
	| "status.state"
	| "status.notice"
	| "menu.backupNow"
	| "menu.pushPending"
	| "menu.pushCurrentFile"
	| "menu.openTimeline"
	| "menu.cancelBackup"
	| "menu.configureBackup"
	| "menu.checkStatus"
	| "menu.openApp"
	| "menu.openSettings"
	| "menu.fileHistory"
	| "setting.title"
	| "setting.language"
	| "setting.languageAuto"
	| "setting.languageZh"
	| "setting.languageEn"
	| "setting.serverUrl"
	| "setting.serverUrlDesc"
	| "setting.apiToken"
	| "setting.apiTokenDesc"
	| "setting.refreshInterval"
	| "setting.refreshIntervalDesc"
	| "setting.stagingPushOnSave"
	| "setting.stagingPushOnSaveDesc"
	| "setting.watchExtensions"
	| "setting.watchExtensionsDesc"
	| "setting.excludePaths"
	| "setting.excludePathsDesc"
	| "setting.showStatusBar"
	| "setting.showStatusBarDesc"
	| "setting.connectionStatus"
	| "setting.statusConnected"
	| "setting.statusConfigured"
	| "setting.statusNotConfigured"
	| "setting.statusError"
	| "setting.configureBackup"
	| "setting.selectRepos"
	| "setting.reposSelected"
	| "setting.loadReposFailed"
	| "setting.selectedCount"
	| "setting.connection"
	| "setting.backupStrategy"
	| "setting.filterAndDisplay"
	| "setting.quickActions"
	| "setting.help"
	| "setting.apiHost"
	| "setting.apiHostDesc"
	| "setting.apiPort"
	| "setting.apiPortDesc"
	| "setting.apiTokenDesc2"
	| "setting.vaultIdentifier"
	| "setting.vaultIdentifierDesc"
	| "setting.backupSource"
	| "setting.sourceConfigured"
	| "setting.sourceNotConfigured"
	| "setting.reconfigure"
	| "setting.oneClickConfig"
	| "setting.autoBackup"
	| "setting.fullBackup"
	| "setting.fullBackupDesc"
	| "setting.debounceDelay"
	| "setting.debounceDelayDesc"
	| "setting.watchExtensionsDesc2"
	| "setting.excludePathsDesc2"
	| "setting.refreshIntervalDesc2"
	| "setting.testConnection"
	| "setting.testConnectionDesc"
	| "setting.backupNowDesc"
	| "setting.openAppDesc"
	| "setting.helpLine1"
	| "setting.helpLine2"
	| "setting.helpLine3"
	| "setting.largeFileThreshold"
	| "setting.largeFileThresholdDesc"
	| "btn.save"
	| "btn.backupNow"
	| "btn.pushPending"
	| "btn.selectRepos"
	| "btn.compare"
	| "btn.restore"
	| "btn.cancel"
	| "btn.confirm"
	| "repo.cloud"
	| "repo.local"
	| "repo.webdav"
	| "repo.encrypted"
	| "modal.restoreTitle"
	| "modal.restoreDesc"
	| "modal.restoreConfirm"
	| "modal.diffTitle"
	| "modal.diffOldVersion"
	| "modal.diffNewVersion"
	| "modal.diffEmpty"
	| "modal.diffSummary"
	| "diff.unavailableOld"
	| "diff.unavailableNew"
	| "modal.historyTitle"
	| "modal.historyEmpty"
	| "modal.historyCurrent"
	| "modal.timelineTitle"
	| "modal.timelineEmpty"
	| "history.loading"
	| "history.noHistory"
	| "history.loadFailed"
	| "history.title"
	| "history.versionCount"
	| "history.diffTitle"
	| "history.diffHint"
	| "history.restoreThisVersion"
	| "history.close"
	| "history.currentVersion"
	| "history.latest"
	| "history.first"
	| "history.deleted"
	| "history.compare"
	| "history.cancelCompare"
	| "history.loadingDiff"
	| "history.contentFailed"
	| "history.loadingTwoVersions"
	| "history.identical"
	| "history.restored"
	| "timeline.title"
	| "timeline.refresh"
	| "timeline.backupNow"
	| "timeline.notConfigured"
	| "timeline.configureHint"
	| "timeline.loading"
	| "timeline.loadFailed"
	| "timeline.noRecords"
	| "timeline.firstBackupHint"
	| "timeline.snapshots"
	| "timeline.totalSize"
	| "timeline.lastBackup"
	| "timeline.files"
	| "timeline.newFiles"
	| "timeline.changedFiles"
	| "timeline.fileList"
	| "timeline.loadingFiles"
	| "timeline.noFiles"
	| "timeline.deleted"
	| "timeline.moreFiles"
	| "snapshot.files"
	| "snapshot.dirs"
	| "snapshot.size"
	| "snapshot.new"
	| "snapshot.changed"
	| "snapshot.deleted"
	| "snapshot.duration"
	| "restore.title"
	| "restore.file"
	| "restore.version"
	| "restore.size"
	| "restore.deleted"
	| "restore.loading"
	| "restore.emptyFile"
	| "restore.readFailed"
	| "restore.truncated"
	| "restore.warning"
	| "restore.confirm"
	| "restore.restoring"
	| "restore.failed"
	| "time.justNow"
	| "time.minutesAgo"
	| "time.hoursAgo"
	| "time.daysAgo"
	| "time.today"
	| "time.yesterday"
	| "time.weeksAgo"
	| "error.unknown"
	| "error.loadFailed"
	| "error.pushFailed"
	| "error.backupFailed"
	| "error.cancelBackupFailed"
	| "error.configureSourceFailed"
	| "error.getStatusFailed";

const translations: Record<Locale, Record<I18nKey, string>> = {
	"zh-CN": {
		"plugin.name": "Ginkgo Backup",
		"command.backupNow": "立即备份",
		"command.openTimeline": "打开备份时间线",
		"command.pushPending": "推送待备份文件",
		"command.pushCurrentFile": "推送当前文件变更",
		"command.checkStatus": "检查备份状态",
		"command.setupSource": "配置备份源",
		"command.fileHistory": "查看当前文件历史版本",
		"command.openApp": "打开 Ginkgo Backup 应用",
		"command.cancelBackup": "取消当前备份",
		"command.openSettings": "打开 Ginkgo 设置",
		"notice.notConnected": "Ginkgo: 未连接",
		"notice.noVaultPath": "Ginkgo: 无法确定 Vault 路径",
		"notice.sourceNotConfigured": "Ginkgo: 当前 Vault 未配置备份源",
		"notice.selectRepoFirst": "Ginkgo: 请先选择备份仓库",
		"notice.configuringSource": "Ginkgo: 正在配置备份源...",
		"notice.sourceConfigured": "Ginkgo: {{name}} 已配置（仓库: {{repos}}）",
		"notice.createSourceFailed": "Ginkgo: 创建备份源失败",
		"notice.pushFailed": "Ginkgo: 推送失败 — {{message}}",
		"notice.pushSuccess": "Ginkgo: 已推送 {{count}} 个文件 ({{names}})",
		"notice.pushSkipped": "Ginkgo: 文件内容未变化，跳过推送",
		"notice.pushFileSuccess": "Ginkgo: 已推送 {{name}} (session: {{session}})",
		"notice.backupStarted": "Ginkgo: 开始全量备份",
		"notice.backupComplete": "Ginkgo: 备份完成",
		"notice.backupError": "Ginkgo: 备份出错",
		"notice.backupFailed": "Ginkgo: 备份失败 — {{message}}",
		"notice.backupCancelled": "Ginkgo: 备份已取消",
		"notice.cancelNoBackup": "Ginkgo: 当前没有运行中的备份",
		"notice.cancelRequested": "Ginkgo: 已请求取消备份",
		"notice.pendingPushed": "Ginkgo: 已推送 {{count}} 个待备份文件",
		"notice.pendingFailed": "Ginkgo: 待备份推送失败 — {{message}}",
		"notice.pendingRestored": "Ginkgo: 恢复 {{count}} 个待推送文件",
		"notice.autoBackupPaused": "Ginkgo: 未连接，自动备份已暂停",
		"notice.largeFileSkipped": "Ginkgo: {{name}} 超过 {{size}}，跳过即时推送，将由全量备份处理",
		"status.never": "从未",
		"status.disconnected": "未连接",
		"status.connected": "已连接",
		"status.connectedAria": "Ginkgo Backup 已连接",
		"status.disconnectedAria": "Ginkgo Backup 未连接",
		"status.backingUp": "备份中",
		"status.backingUpAria": "正在备份",
		"status.error": "错误",
		"status.errorAria": "备份出错",
		"status.connecting": "连接中",
		"status.fileCount": "{{count}} 文件 | {{time}}",
		"status.idle": "空闲",
		"status.sources": "备份源: {{count}} 个",
		"status.snapshots": "快照: {{count}} 个",
		"status.storage": "存储: {{size}}",
		"status.state": "状态: {{state}}",
		"status.notice": "Ginkgo 状态\n{{lines}}",
		"menu.backupNow": "立即备份",
		"menu.pushPending": "推送待备份文件",
		"menu.pushCurrentFile": "推送当前文件",
		"menu.openTimeline": "查看时间线",
		"menu.cancelBackup": "取消备份",
		"menu.configureBackup": "配置备份",
		"menu.checkStatus": "检查状态",
		"menu.openApp": "打开应用",
		"menu.openSettings": "打开设置",
		"menu.fileHistory": "历史版本",
		"setting.title": "Ginkgo Backup 设置",
		"setting.language": "界面语言",
		"setting.languageAuto": "自动",
		"setting.languageZh": "中文",
		"setting.languageEn": "English",
		"setting.serverUrl": "Ginkgo 服务器地址",
		"setting.serverUrlDesc": "例如 http://127.0.0.1:9275",
		"setting.apiToken": "API Token",
		"setting.apiTokenDesc": "在 Ginkgo Web UI 的“设置 › API Token”中生成",
		"setting.refreshInterval": "状态刷新间隔（秒）",
		"setting.refreshIntervalDesc": "状态栏刷新频率",
		"setting.stagingPushOnSave": "保存时自动推送",
		"setting.stagingPushOnSaveDesc": "文件保存后立即推送到 Ginkgo staging",
		"setting.watchExtensions": "监听扩展名",
		"setting.watchExtensionsDesc": "以逗号分隔，例如 md,txt,png",
		"setting.excludePaths": "排除路径",
		"setting.excludePathsDesc": "以逗号分隔的相对路径片段",
		"setting.showStatusBar": "显示状态栏",
		"setting.showStatusBarDesc": "在 Obsidian 底部显示 Ginkgo 连接状态",
		"setting.connectionStatus": "连接状态",
		"setting.statusConnected": "已连接 — 当前 Vault 已配置备份",
		"setting.statusConfigured": "已连接",
		"setting.statusNotConfigured": "已连接 — 当前 Vault 未配置备份",
		"setting.statusError": "未连接",
		"setting.configureBackup": "配置当前 Vault 的备份",
		"setting.selectRepos": "选择备份仓库",
		"setting.reposSelected": "已选择仓库 {{names}}",
		"setting.loadReposFailed": "获取仓库列表失败 — {{message}}",
		"setting.selectedCount": "已选择 {{count}} 个",
		"setting.connection": "连接",
		"setting.backupStrategy": "备份策略",
		"setting.filterAndDisplay": "过滤与显示",
		"setting.quickActions": "快捷操作",
		"setting.help": "帮助",
		"setting.apiHost": "API 主机",
		"setting.apiHostDesc": "支持 IP、域名或完整 URL（如 https://ginkgo.example.com）",
		"setting.apiPort": "API 端口",
		"setting.apiPortDesc": "API 服务端口（默认 9275）",
		"setting.apiTokenDesc2": "在 Ginkgo Backup 桌面应用的设置页面获取",
		"setting.vaultIdentifier": "Vault 标识符",
		"setting.vaultIdentifierDesc": "留空则自动检测。多设备同名 Vault 时需设置唯一标识（如 MyVault-iPhone），确保每个设备对应独立备份源",
		"setting.backupSource": "备份源",
		"setting.sourceConfigured": "已配置（ID: {{id}}）",
		"setting.sourceNotConfigured": "未配置，点击一键配置选择仓库",
		"setting.reconfigure": "重新配置",
		"setting.oneClickConfig": "一键配置",
		"setting.autoBackup": "即时推送",
		"setting.fullBackup": "全量备份",
		"setting.fullBackupDesc": "文件保存后触发全量备份（较慢，与即时推送互斥）",
		"setting.debounceDelay": "防抖延迟",
		"setting.debounceDelayDesc": "文件保存后等待多久再触发推送（毫秒）",
		"setting.watchExtensionsDesc2": "即时推送的文件扩展名，逗号或换行分隔（如 md, canvas, base）。其他文件由兜底备份覆盖",
		"setting.excludePathsDesc2": "不备份的路径前缀，每行一个（如 .obsidian, .trash）",
		"setting.refreshIntervalDesc2": "状态栏刷新间隔（秒）",
		"setting.testConnection": "测试连接",
		"setting.testConnectionDesc": "验证与 Ginkgo Backup 的连接",
		"setting.backupNowDesc": "触发全量备份",
		"setting.openAppDesc": "在浏览器中打开 Ginkgo Backup",
		"setting.helpLine1": "确保 Ginkgo Backup 桌面应用正在运行，并且当前 Vault 已添加到备份源。",
		"setting.helpLine2": "使用命令面板（Ctrl/Cmd + P）搜索 Ginkgo 查看所有可用命令。",
		"setting.helpLine3": "即时推送模式：笔记保存后即时推送到暂存区，后台自动完成备份，不阻塞编辑。图片等附件由兜底备份覆盖。",
		"setting.largeFileThreshold": "大文件阈值（MB）",
		"setting.largeFileThresholdDesc": "超过此大小的文件不执行即时推送，避免卡顿，由全量备份处理",
		"btn.save": "保存",
		"btn.backupNow": "立即备份",
		"btn.pushPending": "推送待备份",
		"btn.selectRepos": "选择仓库",
		"btn.compare": "对比",
		"btn.restore": "恢复",
		"btn.cancel": "取消",
		"btn.confirm": "确认",
		"repo.cloud": "云端",
		"repo.local": "本地",
		"repo.webdav": "WebDAV",
		"repo.encrypted": "加密",
		"modal.restoreTitle": "恢复预览",
		"modal.restoreDesc": "即将把以下文件恢复到 {{path}}",
		"modal.restoreConfirm": "确认覆盖当前文件？",
		"modal.diffTitle": "文件对比: {{path}}",
		"modal.diffOldVersion": "旧版本",
		"modal.diffNewVersion": "新版本",
		"modal.diffEmpty": "无内容可对比",
		"modal.diffSummary": "差异类型: {{type}} | 大小变化: {{delta}} 字节",
		"diff.unavailableOld": "(无法获取旧版本内容)",
		"diff.unavailableNew": "(无法获取新版本内容)",
		"modal.historyTitle": "历史版本: {{path}}",
		"modal.historyEmpty": "暂无历史版本",
		"modal.historyCurrent": "当前版本",
		"modal.timelineTitle": "备份时间线",
		"modal.timelineEmpty": "暂无备份记录",
		"history.loading": "加载中...",
		"history.noHistory": "暂无备份历史",
		"history.loadFailed": "加载失败: {{message}}",
		"history.title": "版本历史",
		"history.versionCount": "共 {{count}} 个版本 · 点击选择，再点击另一版本的「对比」",
		"history.diffTitle": "差异",
		"history.diffHint": "点击左侧版本查看与当前文件的差异",
		"history.restoreThisVersion": "恢复此版本",
		"history.close": "关闭",
		"history.currentVersion": "当前版本",
		"history.latest": "最新",
		"history.first": "首次",
		"history.deleted": "已删除",
		"history.compare": "对比",
		"history.cancelCompare": "取消",
		"history.loadingDiff": "加载差异...",
		"history.contentFailed": "内容读取失败: {{message}}",
		"history.loadingTwoVersions": "加载两个版本...",
		"history.identical": "内容相同",
		"history.restored": "文件已恢复",
		"timeline.title": "备份时间线",
		"timeline.refresh": "刷新",
		"timeline.backupNow": "立即备份",
		"timeline.notConfigured": "尚未配置备份源",
		"timeline.configureHint": "使用命令 Ginkgo: 配置备份源 来开始",
		"timeline.loading": "加载中...",
		"timeline.loadFailed": "加载失败: {{message}}",
		"timeline.noRecords": "暂无备份记录",
		"timeline.firstBackupHint": "点击「立即备份」创建第一个快照",
		"timeline.snapshots": "快照",
		"timeline.totalSize": "总大小",
		"timeline.lastBackup": "最近备份",
		"timeline.files": "文件",
		"timeline.newFiles": "新增",
		"timeline.changedFiles": "修改",
		"timeline.fileList": "文件列表",
		"timeline.loadingFiles": "加载中...",
		"timeline.noFiles": "此快照无文件",
		"timeline.deleted": "已删除",
		"timeline.moreFiles": "还有更多文件（共 {{count}} 项）",
		"snapshot.files": "文件",
		"snapshot.dirs": "目录",
		"snapshot.size": "大小",
		"snapshot.new": "新增",
		"snapshot.changed": "修改",
		"snapshot.deleted": "删除",
		"snapshot.duration": "耗时",
		"restore.title": "恢复预览",
		"restore.file": "文件: {{path}}",
		"restore.version": "版本: {{version}}",
		"restore.size": "大小: {{size}}",
		"restore.deleted": "⚠️ 此版本为删除状态",
		"restore.loading": "加载文件内容...",
		"restore.emptyFile": "(空文件)",
		"restore.readFailed": "(读取失败: {{message}})",
		"restore.truncated": "... 共 {{total}} 行，仅显示前 {{count}} 行",
		"restore.warning": "⚠️ 恢复将覆盖当前文件内容",
		"restore.confirm": "确认恢复",
		"restore.restoring": "恢复中...",
		"restore.failed": "恢复失败 — {{message}}",
		"time.justNow": "刚刚",
		"time.minutesAgo": "{{count}}分钟前",
		"time.hoursAgo": "{{count}}小时前",
		"time.daysAgo": "{{count}}天前",
		"time.today": "今天",
		"time.yesterday": "昨天",
		"time.weeksAgo": "{{count}}周前",
		"error.unknown": "未知错误",
		"error.loadFailed": "加载失败: {{message}}",
		"error.pushFailed": "推送失败",
		"error.backupFailed": "备份失败",
		"error.cancelBackupFailed": "取消备份失败",
		"error.configureSourceFailed": "配置备份源失败",
		"error.getStatusFailed": "获取状态失败",
	},
	en: {
		"plugin.name": "Ginkgo Backup",
		"command.backupNow": "Backup now",
		"command.openTimeline": "Open backup timeline",
		"command.pushPending": "Push pending files",
		"command.pushCurrentFile": "Push current file changes",
		"command.checkStatus": "Check backup status",
		"command.setupSource": "Configure backup source",
		"command.fileHistory": "View current file history",
		"command.openApp": "Open Ginkgo Backup app",
		"command.cancelBackup": "Cancel current backup",
		"command.openSettings": "Open Ginkgo settings",
		"notice.notConnected": "Ginkgo: not connected",
		"notice.noVaultPath": "Ginkgo: unable to determine vault path",
		"notice.sourceNotConfigured": "Ginkgo: current vault is not configured for backup",
		"notice.selectRepoFirst": "Ginkgo: please select backup repositories first",
		"notice.configuringSource": "Ginkgo: configuring backup source...",
		"notice.sourceConfigured": "Ginkgo: {{name}} configured (repos: {{repos}})",
		"notice.createSourceFailed": "Ginkgo: failed to create backup source",
		"notice.pushFailed": "Ginkgo: push failed — {{message}}",
		"notice.pushSuccess": "Ginkgo: pushed {{count}} file(s) ({{names}})",
		"notice.pushSkipped": "Ginkgo: file unchanged, skipped",
		"notice.pushFileSuccess": "Ginkgo: pushed {{name}} (session: {{session}})",
		"notice.backupStarted": "Ginkgo: starting full backup",
		"notice.backupComplete": "Ginkgo: backup complete",
		"notice.backupError": "Ginkgo: backup error",
		"notice.backupFailed": "Ginkgo: backup failed — {{message}}",
		"notice.backupCancelled": "Ginkgo: backup cancelled",
		"notice.cancelNoBackup": "Ginkgo: no backup is currently running",
		"notice.cancelRequested": "Ginkgo: backup cancel requested",
		"notice.pendingPushed": "Ginkgo: pushed {{count}} pending file(s)",
		"notice.pendingFailed": "Ginkgo: pending push failed — {{message}}",
		"notice.pendingRestored": "Ginkgo: restored {{count}} pending file(s)",
		"notice.autoBackupPaused": "Ginkgo: disconnected, auto backup paused",
		"notice.largeFileSkipped": "Ginkgo: {{name}} exceeds {{size}}, skipped instant push; will be handled by full backup",
		"status.never": "never",
		"status.disconnected": "disconnected",
		"status.connected": "connected",
		"status.connectedAria": "Ginkgo Backup connected",
		"status.disconnectedAria": "Ginkgo Backup disconnected",
		"status.backingUp": "backing up",
		"status.backingUpAria": "Backing up",
		"status.error": "error",
		"status.errorAria": "Backup error",
		"status.connecting": "connecting",
		"status.fileCount": "{{count}} files | {{time}}",
		"status.idle": "idle",
		"status.sources": "Sources: {{count}}",
		"status.snapshots": "Snapshots: {{count}}",
		"status.storage": "Storage: {{size}}",
		"status.state": "State: {{state}}",
		"status.notice": "Ginkgo Status\n{{lines}}",
		"menu.backupNow": "Backup now",
		"menu.pushPending": "Push pending files",
		"menu.pushCurrentFile": "Push current file",
		"menu.openTimeline": "Open timeline",
		"menu.cancelBackup": "Cancel backup",
		"menu.configureBackup": "Configure backup",
		"menu.checkStatus": "Check status",
		"menu.openApp": "Open app",
		"menu.openSettings": "Open settings",
		"menu.fileHistory": "History",
		"setting.title": "Ginkgo Backup Settings",
		"setting.language": "Interface language",
		"setting.languageAuto": "Auto",
		"setting.languageZh": "中文",
		"setting.languageEn": "English",
		"setting.serverUrl": "Ginkgo server URL",
		"setting.serverUrlDesc": "e.g. http://127.0.0.1:9275",
		"setting.apiToken": "API Token",
		"setting.apiTokenDesc": "Generate it in Ginkgo Web UI: Settings › API Token",
		"setting.refreshInterval": "Status refresh interval (seconds)",
		"setting.refreshIntervalDesc": "How often the status bar refreshes",
		"setting.stagingPushOnSave": "Push on save",
		"setting.stagingPushOnSaveDesc": "Push files to Ginkgo staging immediately after save",
		"setting.watchExtensions": "Watched extensions",
		"setting.watchExtensionsDesc": "Comma-separated, e.g. md,txt,png",
		"setting.excludePaths": "Excluded paths",
		"setting.excludePathsDesc": "Comma-separated relative path fragments",
		"setting.showStatusBar": "Show status bar",
		"setting.showStatusBarDesc": "Show Ginkgo connection status in the Obsidian status bar",
		"setting.connectionStatus": "Connection status",
		"setting.statusConnected": "Connected — current vault is configured for backup",
		"setting.statusConfigured": "Connected",
		"setting.statusNotConfigured": "Connected — current vault is not configured for backup",
		"setting.statusError": "Not connected",
		"setting.configureBackup": "Configure backup for current vault",
		"setting.selectRepos": "Select backup repositories",
		"setting.reposSelected": "Selected repositories: {{names}}",
		"setting.loadReposFailed": "Failed to load repository list — {{message}}",
		"setting.selectedCount": "{{count}} selected",
		"setting.connection": "Connection",
		"setting.backupStrategy": "Backup strategy",
		"setting.filterAndDisplay": "Filter & display",
		"setting.quickActions": "Quick actions",
		"setting.help": "Help",
		"setting.apiHost": "API host",
		"setting.apiHostDesc": "Supports IP, domain or full URL (e.g. https://ginkgo.example.com)",
		"setting.apiPort": "API port",
		"setting.apiPortDesc": "API service port (default 9275)",
		"setting.apiTokenDesc2": "Get it from the Ginkgo Backup app settings page",
		"setting.vaultIdentifier": "Vault identifier",
		"setting.vaultIdentifierDesc": "Leave empty to auto-detect. Set a unique identifier for same-name vaults across devices (e.g. MyVault-iPhone)",
		"setting.backupSource": "Backup source",
		"setting.sourceConfigured": "Configured (ID: {{id}})",
		"setting.sourceNotConfigured": "Not configured, click one-click config to select repositories",
		"setting.reconfigure": "Reconfigure",
		"setting.oneClickConfig": "One-click config",
		"setting.autoBackup": "Instant push",
		"setting.fullBackup": "Full backup",
		"setting.fullBackupDesc": "Trigger a full backup after save (slower, mutually exclusive with instant push)",
		"setting.debounceDelay": "Debounce delay",
		"setting.debounceDelayDesc": "How long to wait after save before pushing (milliseconds)",
		"setting.watchExtensionsDesc2": "Extensions for instant push, comma or newline separated (e.g. md, canvas, base). Other files are covered by periodic full backup",
		"setting.excludePathsDesc2": "Path prefixes to exclude, one per line (e.g. .obsidian, .trash)",
		"setting.refreshIntervalDesc2": "Status bar refresh interval (seconds)",
		"setting.testConnection": "Test connection",
		"setting.testConnectionDesc": "Verify connection to Ginkgo Backup",
		"setting.backupNowDesc": "Trigger a full backup",
		"setting.openAppDesc": "Open Ginkgo Backup in browser",
		"setting.helpLine1": "Make sure Ginkgo Backup is running and the current vault is added as a backup source.",
		"setting.helpLine2": "Use the command palette (Ctrl/Cmd + P) and search for Ginkgo to see all available commands.",
		"setting.helpLine3": "Instant push mode: notes are pushed to staging immediately after save and backed up in the background without blocking editing. Images and attachments are covered by periodic full backup.",
		"setting.largeFileThreshold": "Large file threshold (MB)",
		"setting.largeFileThresholdDesc": "Files larger than this are not pushed instantly to avoid lag; they are handled by full backup",
		"btn.save": "Save",
		"btn.backupNow": "Backup now",
		"btn.pushPending": "Push pending",
		"btn.selectRepos": "Select repos",
		"btn.compare": "Compare",
		"btn.restore": "Restore",
		"btn.cancel": "Cancel",
		"btn.confirm": "Confirm",
		"repo.cloud": "Cloud",
		"repo.local": "Local",
		"repo.webdav": "WebDAV",
		"repo.encrypted": "Encrypted",
		"modal.restoreTitle": "Restore preview",
		"modal.restoreDesc": "About to restore the following file to {{path}}",
		"modal.restoreConfirm": "Overwrite current file?",
		"modal.diffTitle": "File diff: {{path}}",
		"modal.diffOldVersion": "Old version",
		"modal.diffNewVersion": "New version",
		"modal.diffEmpty": "No content to compare",
		"modal.diffSummary": "Diff type: {{type}} | Size delta: {{delta}} bytes",
		"diff.unavailableOld": "(Unable to load old version)",
		"diff.unavailableNew": "(Unable to load new version)",
		"modal.historyTitle": "History: {{path}}",
		"modal.historyEmpty": "No history versions",
		"modal.historyCurrent": "Current version",
		"modal.timelineTitle": "Backup timeline",
		"modal.timelineEmpty": "No backup records",
		"history.loading": "Loading...",
		"history.noHistory": "No backup history",
		"history.loadFailed": "Load failed: {{message}}",
		"history.title": "Version history",
		"history.versionCount": "{{count}} versions · click to select, then click Compare on another version",
		"history.diffTitle": "Diff",
		"history.diffHint": "Click a version on the left to view diff with current file",
		"history.restoreThisVersion": "Restore this version",
		"history.close": "Close",
		"history.currentVersion": "Current version",
		"history.latest": "Latest",
		"history.first": "First",
		"history.deleted": "Deleted",
		"history.compare": "Compare",
		"history.cancelCompare": "Cancel",
		"history.loadingDiff": "Loading diff...",
		"history.contentFailed": "Failed to read content: {{message}}",
		"history.loadingTwoVersions": "Loading two versions...",
		"history.identical": "Identical",
		"history.restored": "File restored",
		"timeline.title": "Backup timeline",
		"timeline.refresh": "Refresh",
		"timeline.backupNow": "Backup now",
		"timeline.notConfigured": "Backup source not configured",
		"timeline.configureHint": "Use the command Ginkgo: Configure backup source to start",
		"timeline.loading": "Loading...",
		"timeline.loadFailed": "Load failed: {{message}}",
		"timeline.noRecords": "No backup records",
		"timeline.firstBackupHint": "Click Backup now to create the first snapshot",
		"timeline.snapshots": "Snapshots",
		"timeline.totalSize": "Total size",
		"timeline.lastBackup": "Last backup",
		"timeline.files": "files",
		"timeline.newFiles": "new",
		"timeline.changedFiles": "changed",
		"timeline.fileList": "File list",
		"timeline.loadingFiles": "Loading...",
		"timeline.noFiles": "No files in this snapshot",
		"timeline.deleted": "deleted",
		"timeline.moreFiles": "More files ({{count}} total)",
		"snapshot.files": "Files",
		"snapshot.dirs": "Dirs",
		"snapshot.size": "Size",
		"snapshot.new": "New",
		"snapshot.changed": "Changed",
		"snapshot.deleted": "Deleted",
		"snapshot.duration": "Duration",
		"restore.title": "Restore preview",
		"restore.file": "File: {{path}}",
		"restore.version": "Version: {{version}}",
		"restore.size": "Size: {{size}}",
		"restore.deleted": "⚠️ This version is deleted",
		"restore.loading": "Loading file content...",
		"restore.emptyFile": "(Empty file)",
		"restore.readFailed": "(Read failed: {{message}})",
		"restore.truncated": "... {{total}} lines total, showing first {{count}}",
		"restore.warning": "⚠️ Restore will overwrite current file content",
		"restore.confirm": "Confirm restore",
		"restore.restoring": "Restoring...",
		"restore.failed": "Restore failed — {{message}}",
		"time.justNow": "just now",
		"time.minutesAgo": "{{count}} minutes ago",
		"time.hoursAgo": "{{count}} hours ago",
		"time.daysAgo": "{{count}} days ago",
		"time.today": "today",
		"time.yesterday": "yesterday",
		"time.weeksAgo": "{{count}} weeks ago",
		"error.unknown": "Unknown error",
		"error.loadFailed": "Load failed: {{message}}",
		"error.pushFailed": "Push failed",
		"error.backupFailed": "Backup failed",
		"error.cancelBackupFailed": "Cancel backup failed",
		"error.configureSourceFailed": "Configure source failed",
		"error.getStatusFailed": "Get status failed",
	},
};

let currentLocale: Locale | null = null;

export function getStoredLocale(): Locale | "auto" {
	return (localStorage.getItem("ginkgo-locale") as Locale | "auto" | null) ?? "auto";
}

export function setStoredLocale(locale: Locale | "auto") {
	localStorage.setItem("ginkgo-locale", locale);
	currentLocale = null;
}

function resolveLocale(preference: Locale | "auto"): Locale {
	if (preference !== "auto") return preference;
	const nav = navigator.language.toLowerCase();
	return nav.startsWith("zh") ? "zh-CN" : "en";
}

export function setActiveLocale(preference: Locale | "auto") {
	currentLocale = resolveLocale(preference);
}

export function getLocale(): Locale {
	if (currentLocale) return currentLocale;
	currentLocale = resolveLocale(getStoredLocale());
	return currentLocale;
}

export function t(key: I18nKey, placeholders?: Record<string, string | number>): string {
	const locale = getLocale();
	let text = translations[locale][key] ?? translations.en[key] ?? key;
	if (placeholders) {
		for (const [k, v] of Object.entries(placeholders)) {
			text = text.replace(new RegExp(`\\{\\{${k}\\}\\}`, "g"), String(v));
		}
	}
	return text;
}
