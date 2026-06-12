# Ginkgo Backup — Obsidian Plugin

Time machine for your Obsidian vault — auto backup, version diff, one-click restore.

This plugin connects your Obsidian vault to [Ginkgo Backup](https://ginkgobackup.com), providing seamless backup and version history for your notes.

## Features

- **Instant Push** — Notes are pushed to the staging area on save, then backed up in the background without blocking editing
- **Full Backup** — Trigger a complete vault backup on demand
- **Version History** — Browse file history with a visual timeline and diff view
- **One-Click Restore** — Restore any previous version of a file
- **File Context Menu** — Right-click any file to view its history
- **Status Bar** — Real-time backup status in the status bar
- **Auto Backup** — Configurable auto-push or auto-backup on file save

## Prerequisites

You need [Ginkgo Backup](https://ginkgobackup.com) installed and running on your machine. The plugin communicates with the Ginkgo Backup API (default port 9275).

## Setup

1. Install and start Ginkgo Backup
2. Enable this plugin in Obsidian Settings → Community Plugins
3. Open plugin settings and enter your API Token (found in Ginkgo Backup settings)
4. Click "Configure" to select a backup repository for this vault
5. Done! Your notes will be automatically backed up

## Commands

| Command | Description |
|---------|-------------|
| `Ginkgo: Backup Now` | Trigger a full vault backup |
| `Ginkgo: Push Current File` | Push the active file to staging |
| `Ginkgo: Check Status` | Show backup status notification |
| `Ginkgo: Configure Source` | Set up backup source for this vault |
| `Ginkgo: Open Timeline` | Open the backup timeline sidebar |
| `Ginkgo: File History` | View version history of the active file |
| `Ginkgo: Open App` | Open Ginkgo Backup in the browser |

## Settings

- **API Host** — Ginkgo Backup server address (default: `127.0.0.1`)
- **API Port** — Server port (default: `9275`)
- **API Token** — Authentication token from Ginkgo Backup
- **Vault Identifier** — Custom identifier for multi-device setups
- **Instant Push** — Auto-push files on save (recommended)
- **Full Backup** — Auto-trigger full backup on save
- **Debounce Delay** — Wait time before pushing after save (ms)
- **Watch Extensions** — File types to monitor for auto-push (e.g., `md, canvas, base`)
- **Exclude Paths** — Paths to exclude from backup (e.g., `.obsidian`, `.trash`)

## How It Works

### Instant Push Mode (Recommended)

When you save a note, the plugin immediately pushes the file content to Ginkgo Backup's staging area. The actual backup runs in the background — no interruption to your workflow. Binary files (images, PDFs) are covered by the scheduled full backup.

### Full Backup Mode

Triggers a complete vault scan and backup. Slower but ensures all files (including attachments) are backed up.

## License

MIT
