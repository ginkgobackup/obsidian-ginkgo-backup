# Ginkgo Backup for Obsidian

> A time machine for your Obsidian vault — instant push, version diff, and one-click restore, powered by the [Ginkgo Backup](https://ginkgobackup.com) desktop engine.

[![Version](https://img.shields.io/badge/version-0.5.0-d4a056)](./manifest.json)
[![License](https://img.shields.io/badge/license-MIT-blue)](./LICENSE)
[![Obsidian](https://img.shields.io/badge/Obsidian-1.0%2B-7c3aed)](https://obsidian.md)
[![Platform](https://img.shields.io/badge/platform-desktop-4a4a4a)](./manifest.json)

## Overview

Ever rewritten a paragraph and wished you could get the original back? Or merged a note by mistake and lost half your work?

Ginkgo Backup captures every save into a versioned timeline, so any previous state is one click away — diff it, preview it, restore it, all without leaving Obsidian.

![Version diff between any two snapshots](./docs/screenshots/file-history-diff.png)

## Why Ginkgo Backup?

- **No Git knowledge required** — No commits, branches, or push/pull. Just save, and it's backed up.
- **No cloud subscription** — The backup engine runs locally on your machine. Your data never leaves your control.
- **Diff any two versions** — Pick any two points in history and see exactly what changed, line by line.
- **Visual calendar timeline** — Jump to any day with a date picker, not a scroll through commit logs.
- **Instant push on save** — Every save is captured within seconds, not on a schedule.

## Quick Start

1. **Install Ginkgo Backup** — Download from [ginkgobackup.com](https://ginkgobackup.com/#download), launch it, and copy the API token from *Settings → API*.
2. **Enable the plugin** — In Obsidian, open *Settings → Community plugins*, install this plugin, and enable it.
3. **Follow the setup guide** — On first launch the plugin shows a 4-step welcome modal. Paste your API token and click **Test connection**.

   ![Setup guide](./docs/screenshots/setup-guide.png)

4. **Configure the backup source** — Run the command `Ginkgo: Configure source` and pick the repository for this vault. Done — your notes are now versioned.

> Tip: set a **Vault identifier** (e.g. your machine name) in settings when the same vault is synced across multiple devices. This keeps per-device hash caches isolated.

## Features

- **Instant Push on Save** — Every save is captured within seconds. Identical content is skipped, so only real changes are stored.
- **Scheduled Full Backup** — Optionally back up the entire vault (including images and attachments) on a timer.
- **Visual Timeline** — A sidebar calendar lets you jump to any day and browse that day's snapshots with file counts, sizes, and change badges (`+added`, `~modified`).
- **Version History & Diff** — Right-click any file to see its full history. Pick any two versions and see exactly what changed, line by line.
- **One-Click Restore** — Preview a version before restoring. Your current content is saved automatically first, so an accidental restore never destroys unsaved work.

   ![Restore preview](./docs/screenshots/restore-preview.png)

- **Connection Auto-Recovery** — Network drops are retried automatically; pending pushes flush the moment the link comes back. The status bar shows live connection state at a glance.

   ![Status bar menu](./docs/screenshots/status-bar.png)

- **Secure by Default** — HTTPS is enforced for non-local hosts; the API token travels in a request header, never in the URL.
- **Bilingual UI** — English and 简体中文, with automatic locale detection.

## Timeline & History

**Timeline view** — Open via the ribbon icon (hard-drive) or the `Ginkgo: Open timeline` command. A calendar lets you pick any date; the list below shows that day's snapshots with a summary header (snapshot count, total new bytes, last backup time). Click any snapshot card to drill into its file list.

![Timeline calendar view](./docs/screenshots/timeline-calendar.png)

**File history modal** — Right-click any file in the file explorer or editor and choose *Ginkgo → File history*. Browse every version, diff any two (LCS line-level, with context-only mode for large files), or diff a version against the current content. Hit **Restore** to preview and confirm.

## Requirements

- [Obsidian](https://obsidian.md) **1.0+** (desktop)
- [Ginkgo Backup](https://ginkgobackup.com/#download) desktop app (macOS / Windows / Linux) — the backup engine that powers this plugin

## Commands

| Command | Action |
|---------|--------|
| `Ginkgo: Backup now` | Trigger a full vault backup immediately |
| `Ginkgo: Push current file` | Push the active file to staging on demand |
| `Ginkgo: Check status` | Show a status notice (sources, snapshots, storage, state) |
| `Ginkgo: Configure source` | Bind this vault to a Ginkgo Backup repository |
| `Ginkgo: Open timeline` | Open the backup timeline sidebar |
| `Ginkgo: File history` | Open the version history modal for the active file |
| `Ginkgo: Open app` | Open the Ginkgo Backup web UI in your browser |
| `Ginkgo: Cancel backup` | Cancel a running full backup |

## Settings

![Settings](./docs/screenshots/settings.png)

### Connection
| Setting | Default | Description |
|---------|---------|-------------|
| API host | `127.0.0.1` | Ginkgo Backup server address (IP, domain, or full URL) |
| API port | `9275` | Server port (1–65535) |
| API token | — | Authentication token from Ginkgo Backup *Settings → API* |
| Vault identifier | — | Unique name for this vault on this device (recommended for multi-device setups) |
| Source ID | `0` | Auto-detected; can be set manually if needed |

### Backup Strategy
| Setting | Default | Description |
|---------|---------|-------------|
| Push on save | `on` | Instantly push text files to staging on save |
| Push debounce delay | `30000` ms | Wait time before pushing after a save (5000–120000 ms) |
| Scheduled full backup | `off` | Run a full vault backup on a timer |
| Full backup interval | `60` min | Interval between scheduled full backups (5–1440 min) |

### Filters & Display
| Setting | Default | Description |
|---------|---------|-------------|
| Watch extensions | `md, canvas, base, json, css` | File types monitored for instant push |
| Exclude paths | `.obsidian, .trash, .DS_Store` | Path prefixes excluded from backup (one per line) |
| Large file threshold | `5` MB | Files above this size are skipped by instant push |
| Show status bar | `on` | Show the live backup status bar item |
| Status refresh interval | `60` s | How often to poll the server for status (10–300 s) |

### Interface
| Setting | Default | Description |
|---------|---------|-------------|
| Language | `auto` | `auto` follows `navigator.language`; force `zh-CN` or `en` |

## Security

- **HTTPS enforced off-host** — When the API host is a public domain or IP (not `localhost` / `127.0.0.1` / RFC 1918 private ranges), HTTPS is used automatically. Loopback and private-LAN hosts may still use HTTP. Explicit `http(s)://` prefixes in the host field are always honored.
- **Token in header** — The API token is sent via the `X-Ginkgo-Token` request header, never as a URL query parameter, so it cannot leak through server logs or referrers.
- **Content hashing** — File de-duplication uses the Web Crypto API (`crypto.subtle.digest("SHA-256")`); no file content is hashed by hand-rolled code.
- **No telemetry** — The plugin makes no outbound requests except to your configured Ginkgo Backup server.

## Internationalization

The UI ships with **English** and **简体中文**. Set *Language* to `auto` (default) to follow your browser/OS locale, or pin it explicitly. Missing keys fall back to English, then to the key itself.

## Manual Installation

If the plugin is not yet available in the community browser, or you want to test a pre-release build:

1. Download `main.js`, `manifest.json`, and `styles.css` from the latest [GitHub Release](https://github.com/ginkgobackup/obsidian-ginkgo-backup/releases).
2. In your vault, navigate to `.obsidian/plugins/` (create the `plugins` folder if it doesn't exist).
3. Create a subfolder named `ginkgo-backup`.
4. Copy the three downloaded files into `.obsidian/plugins/ginkgo-backup/`.
5. In Obsidian, open *Settings → Community plugins*, click the **reload** icon, then enable **Ginkgo Backup**.

## FAQ

**Does this work on mobile?**
No — the plugin requires the Ginkgo Backup desktop engine, so it runs on desktop only (macOS / Windows / Linux).

**Why do I need a separate desktop app?**
The plugin is a lightweight frontend; the actual backup engine (snapshot storage, deduplication, scheduling) runs as a standalone app. This keeps your vault history independent of Obsidian's lifecycle — your backups survive even if Obsidian is closed or the plugin is uninstalled.

**Can I diff binary files like images?**
No — instant push covers text files (`md`, `canvas`, `base`, `json`, `css`). Binary attachments are captured by full backups and can be restored, but not diffed line-by-line.

**How far back can I go?**
The timeline loads up to 500 recent snapshots for calendar browsing. Older snapshots remain accessible through the Ginkgo Backup app directly.

**My vault is synced across desktop and mobile. Will mobile changes be backed up?**
Only desktop changes are backed up (the mobile app can't run the engine). Mobile edits will be captured once they sync to a desktop running Ginkgo Backup.

## Development

```bash
# Install dependencies
npm install

# Build for development (with watch)
npm run dev

# Build for production
npm run build

# Type-check
npm run lint

# Run unit tests (pure functions)
npm test
```

Build output: `main.js`, `manifest.json`, `styles.css` — the three files Obsidian loads.

## Links

- **Website:** [ginkgobackup.com](https://ginkgobackup.com)
- **Download Ginkgo Backup:** [ginkgobackup.com/#download](https://ginkgobackup.com/#download)
- **Source code:** [github.com/ginkgobackup/obsidian-ginkgo-backup](https://github.com/ginkgobackup/obsidian-ginkgo-backup)
- **Changelog:** [CHANGELOG.md](./CHANGELOG.md)

## License

[MIT](./LICENSE)
