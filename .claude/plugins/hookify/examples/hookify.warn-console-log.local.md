---
name: warn-console-log
enabled: true
event: file
action: warn
pattern: console\.log\(
---

`console.log` detected in file edit.

Avoid adding debug logging to production code. Use a proper logging library or remove before committing. If this is intentional debug output, add a comment explaining why.
