---
name: hookify:writing-rules
description: Use this skill when writing or generating hookify rule files (.local.md). Ensures correct frontmatter format, valid event types, and proper condition syntax.
---

# Writing Hookify Rules

When creating a hookify rule file, follow this exact format:

## File Naming

Rules go in the project's `.claude/` directory (not the plugin directory):

```
.claude/hookify.{rule-name}.local.md
```

Use kebab-case for the rule name. Examples:
- `.claude/hookify.warn-dangerous-rm.local.md`
- `.claude/hookify.block-eval-usage.local.md`
- `.claude/hookify.warn-console-log.local.md`

## File Format

```markdown
---
name: rule-name-here
enabled: true
event: bash
action: warn
pattern: regex-pattern-here
---

Message shown to Claude when this rule triggers.
Explain what was detected and suggest safer alternatives.
```

## Frontmatter Fields

| Field | Required | Values | Description |
|-------|----------|--------|-------------|
| `name` | yes | kebab-case string | Unique identifier for this rule |
| `enabled` | yes | `true` or `false` | Whether the rule is active |
| `event` | yes | `bash`, `file`, `stop`, `prompt`, `all` | Which hook event to match |
| `action` | yes | `warn` or `block` | Whether to warn Claude or block the operation |
| `pattern` | yes* | regex string | Simple regex pattern (*required unless using `conditions`) |

## Event Types

- **`bash`** — matches Bash tool calls; `pattern` applies to the `command` field
- **`file`** — matches Edit/Write/MultiEdit tool calls; `pattern` applies to `new_string`/content
- **`stop`** — matches when Claude tries to end its turn; `pattern` applies to `reason`
- **`prompt`** — matches incoming user prompts; `pattern` applies to `user_prompt`
- **`all`** — matches all hook events

## Actions

- **`warn`** — sends a `systemMessage` to Claude but allows the operation to proceed
- **`block`** — denies the operation (PreToolUse) or blocks stopping (Stop event)

## Simple Pattern Examples

**Bash rules:**
```yaml
event: bash
pattern: rm\s+-rf
```

```yaml
event: bash
pattern: sudo\s+
```

**File rules:**
```yaml
event: file
pattern: console\.log\(
```

```yaml
event: file
pattern: eval\(|new\s+Function\(
```

## Message Body Guidelines

Write the message body (after the `---`) as a clear explanation for Claude:

1. **State what was detected** — be specific
2. **Explain why it's a concern** — the risk or policy
3. **Suggest alternatives** — what to do instead

Example:
```
Dangerous `rm -rf` command detected.

This command recursively deletes files without confirmation and cannot be undone.
Before proceeding, verify the exact path and consider using `trash` or `rm -i` instead.
If deletion is truly needed, confirm the path with the user first.
```

## Complete Examples

### Warn on dangerous delete
```markdown
---
name: warn-dangerous-rm
enabled: true
event: bash
action: warn
pattern: rm\s+-rf
---

Dangerous `rm -rf` detected. Verify the exact path before proceeding and confirm with the user if deleting anything outside /tmp.
```

### Block hardcoded secrets
```markdown
---
name: block-hardcoded-secrets
enabled: true
event: file
action: block
pattern: (api_key|secret|password)\s*=\s*["'][^"']{8,}["']
---

Potential hardcoded secret detected in file content.

Never commit API keys, passwords, or secrets directly in source files.
Use environment variables or a secrets manager instead.
```

### Warn before stopping without summary
```markdown
---
name: warn-stop-without-summary
enabled: true
event: stop
action: warn
pattern: .*
---

Before stopping, confirm you have:
1. Summarized all changes made
2. Listed any follow-up tasks for the user
3. Noted any unresolved issues
```

## Advanced: Explicit Conditions

For complex matching, use `conditions` instead of `pattern`:

```markdown
---
name: warn-chmod-777
enabled: true
event: bash
action: warn
tool_matcher: Bash
conditions:
  - field: command, operator: regex_match, pattern: chmod\s+777
---

Insecure file permissions (777) detected. Use more restrictive permissions like 755 or 644.
```
