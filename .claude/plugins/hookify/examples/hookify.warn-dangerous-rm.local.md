---
name: warn-dangerous-rm
enabled: true
event: bash
action: warn
pattern: rm\s+-rf
---

Dangerous `rm -rf` command detected.

This recursively deletes files without confirmation and cannot be undone. Verify the exact path before proceeding. If deleting outside /tmp, confirm with the user first.
