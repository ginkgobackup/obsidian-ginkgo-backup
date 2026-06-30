# Q3 Product Roadmap

## Overview

This quarter we focus on four pillars: stability, performance, the Obsidian plugin launch, and cloud sync.

## Priorities

1. **Ship Obsidian plugin v0.5.0**
   - Complete community store submission
   - Add screenshot assets
   - Write user documentation
   - Prepare marketing landing page

2. **Cloud sync beta**
   - Implement R2 storage backend
   - End-to-end encryption for remote backups
   - Invite 20 beta testers

3. **Improve backup engine performance**
   - Reduce snapshot creation time by 30%
   - Optimize deduplication hash cache

4. **Hardening**
   - Fix connection retry edge cases
   - Add health check endpoint

## Timeline

| Milestone | Target |
|-----------|--------|
| Plugin submission | Week 2 |
| Cloud sync beta | Week 4 |
| Engine optimization | Week 6 |
| Q3 release | Week 10 |

## Notes

- The Obsidian plugin is our first third-party integration.
- Cloud sync should feel transparent — users shouldn't think about it.
- Need to coordinate with marketing on launch announcement.
- Consider beta testing with 5 power users before public release.

## Open Questions

- Should we support mobile (iOS/Android) in Q4?
- What's the pricing model for teams?
- Can we reuse the Obsidian plugin's dedup logic for cloud sync?
