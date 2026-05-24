# Create Hooks to Prevent Unwanted Behaviors

Use this command to create hookify rules that prevent behaviors you've found problematic. Either provide explicit instructions about what to prevent, or run without arguments to analyze the current conversation.

## Process

### Step 1: Gather Behaviors to Prevent

**If user provided instructions** ($ARGUMENTS is not empty):
- Parse the description to understand what behavior to prevent
- Identify which tool is involved (Bash, Edit, Write, etc.)
- Determine appropriate event type and pattern

**If no arguments** (analyze conversation):
- Launch conversation-analyzer agent to scan recent messages
- Agent will identify frustration signals, corrections, and repeated issues
- Review agent findings

### Step 2: Confirm with User

Present detected behaviors using AskUserQuestion with multiSelect:
- Show each behavior as an option
- Ask user to select which ones to create rules for
- Include option to add custom behaviors

For each selected behavior, ask:
- Should this **warn** (show message but allow) or **block** (prevent operation)?

### Step 3: Generate Rules

For each confirmed behavior:

1. Determine rule configuration:
   - `name`: kebab-case identifier (e.g., `warn-dangerous-rm`)
   - `enabled`: true
   - `event`: bash | file | stop | prompt | all
   - `action`: warn | block
   - `pattern`: regex pattern to match

2. Write message body - explain what was detected and why it matters

3. Create file at `.claude/hookify.{name}.local.md` in the **current working directory's .claude folder**

   **CRITICAL**: The path should resolve to the project's `.claude` directory, not the plugin's directory.

   ```
   .claude/hookify.{name}.local.md
   ```

4. Use the hookify:writing-rules skill to ensure correct format

### Step 4: Confirm Creation

Show user what was created:
- List of rule files created
- Summary of what each rule does
- How to disable: set `enabled: false` or delete the file
- How to test: rules activate immediately on next tool use

## Rule File Format

```markdown
---
name: rule-name-here
enabled: true
event: bash
action: warn
pattern: regex-pattern-here
---

Message shown to Claude when rule triggers.
Explain what was detected and suggest alternatives.
```

## Pattern Examples

**Bash patterns:**
- `rm\s+-rf` - dangerous recursive delete
- `sudo\s+` - privilege escalation
- `chmod\s+777` - insecure permissions

**File patterns:**
- `console\.log\(` - debug logging in production
- `eval\(` - dangerous eval
- `\.env$` - sensitive environment files

**Stop patterns:**
- `.*` - always check before stopping (use with conditions)
