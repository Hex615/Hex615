---
name: block-hardcoded-secrets
enabled: true
event: file
action: block
pattern: (api_key|secret_key|password|api_secret)\s*[:=]\s*["'][^"']{8,}["']
---

Potential hardcoded secret detected.

Never commit API keys, passwords, or secrets directly in source files. Use environment variables (.env) or a secrets manager instead. This operation has been blocked to prevent accidental exposure.
