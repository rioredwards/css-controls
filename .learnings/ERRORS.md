## [ERR-20260327-001] skill_sync_path

**Logged**: 2026-03-27T00:34:32Z
**Priority**: medium
**Status**: pending
**Area**: config

### Summary
The AGENTS autopilot command for `skill-sync` points to `~/coding/agent-skills/scripts/skill-sync`, but this machine's canonical skills live under `/Users/rioredwards/dev/agent-skills`.

### Error
```text
zsh:1: no such file or directory: /Users/rioredwards/coding/agent-skills/scripts/skill-sync
```

### Context
- Command attempted: `~/coding/agent-skills/scripts/skill-sync sync --project /Users/rioredwards/dev/css-controls`
- Trigger: repo AGENTS autopilot rule for projects with existing `.agent-context.json`
- Environment: local Codex session on macOS

### Suggested Fix
Update the project instructions to reference the actual canonical skill path on this machine, or standardize the skill install location so the documented command works.

### Metadata
- Reproducible: yes
- Related Files: AGENTS.md

---
