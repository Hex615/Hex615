# Configure Hookify Rules

Manage your hookify rules through an interactive interface. Toggle rules on/off without editing files manually.

## Process

### Step 1: Find Rules

Use Glob to find all hookify rule files:
```
.claude/hookify.*.local.md
```

### Step 2: Extract Rule Information

Read each file and pull:
- `name` field from frontmatter
- `enabled` field from frontmatter
- `event` type
- First line of message body (as description)

### Step 3: Present Interactive Interface

Show user a multi-select list with each rule's current status:
- ✅ `rule-name` (enabled) - brief description
- ❌ `rule-name` (disabled) - brief description

Ask user to select which rules to toggle.

### Step 4: Apply Changes

For each selected rule:
- If currently `enabled: true` → change to `enabled: false`
- If currently `enabled: false` → change to `enabled: true`

Use Edit tool to update the `enabled` field in YAML frontmatter.
Handle both quoted (`enabled: "true"`) and unquoted (`enabled: true`) values.

### Step 5: Confirm Results

Display summary:
- Rules enabled: [list]
- Rules disabled: [list]
- Rules unchanged: [list]

Note: Changes take effect immediately on next tool use.

## Edge Cases

- No rules found: Suggest running `/hookify` to create initial rules
- Empty selection: Confirm no changes made
- File errors: Report which files couldn't be updated

## Tips

Users can also manually edit `.local.md` files or use `/hookify:list` to view all configured rules.
