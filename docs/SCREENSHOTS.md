# Screenshot Capture Guide

Capture these 6 screenshots with the plugin UI set to **English**.

## Prerequisite

1. In Obsidian, open **Settings → Ginkgo Backup → Interface → Language**.
2. Set it to **`en`** (not `auto`).
3. Make sure the plugin is connected and has at least 2 snapshots.

---

## 1. `timeline-calendar.png` — Timeline calendar view

**What to show:** The sidebar timeline with calendar date picker and a day's snapshot list.

**Steps:**
1. Click the hard-drive ribbon icon, or run `Ginkgo: Open timeline`.
2. Click a date with backups (marked dot).
3. Make sure the day summary header (Snapshots / Day new data / Last backup) and 2–3 snapshot cards are visible.
4. Screenshot.

---

## 2. `file-history-diff.png` — File history & version diff

**What to show:** The version history modal with a diff between two versions.

**Steps:**
1. Open a note that has been edited at least twice (multiple versions).
2. Right-click the file in the file explorer → **Ginkgo → File history**.
   (Or run `Ginkgo: File history` with the file open.)
3. Click one version to select it (highlighted).
4. Click **Compare** on another version.
5. Wait for the diff to render (green/red lines).
6. Screenshot — include the version list on the left and the diff on the right.

---

## 3. `restore-preview.png` — Restore preview modal

**What to show:** The restore confirmation modal previewing a version's content.

**Steps:**
1. In the file history modal (from screenshot 2), click **Restore this version** on any version.
2. The restore preview modal appears showing the content that will be restored.
3. Screenshot — include the preview content and the Restore/Cancel buttons.

---

## 4. `setup-guide.png` — First-run setup guide

**What to show:** The 4-step welcome modal shown on first enable.

**Steps:**
1. Disable and re-enable the plugin, OR delete the `sourceId` setting to trigger first-run.
2. The setup guide modal appears (4 steps: Welcome → API token → Test connection → Configure source).
3. Stay on the API token step (step 2) — it's the most informative.
4. Screenshot.

---

## 5. `settings.png` — Settings page

**What to show:** The plugin settings page with the compact status capsule.

**Steps:**
1. Open **Settings → Ginkgo Backup**.
2. Make sure the connection status capsule (green "Connected" dot) is visible at the top.
3. Scroll to show the Connection and Backup Strategy sections.
4. Screenshot.

---

## 6. `status-bar.png` — Status bar menu

**What to show:** The status bar item and its right-click context menu.

**Steps:**
1. Locate the Ginkgo Backup status bar item (bottom-right, shows connection state).
2. Right-click it to open the context menu.
3. Screenshot — include the status bar item and the open menu (Backup now, Push current file, Open settings, etc.).

---

## After Capturing

1. Save each screenshot to `docs/screenshots/` with the exact filename listed above.
2. Commit and push:
   ```bash
   git add docs/screenshots/*.png
   git commit -m "docs: add plugin screenshots"
   git push origin master
   ```
3. The README image references will resolve automatically.
