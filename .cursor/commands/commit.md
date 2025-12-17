Automatically stage changes and create a commit (or multiple commits) with an auto-generated message.

**Steps to execute (do all automatically without asking):**

1. Check git status to see what files have changed
2. Determine if the changes should be grouped into one commit or split into multiple commits.

- For a single commit, the changes should be generally related... either to a single component/feature or a single type of change (e.g. formatting, refactoring, etc.). Small miscellaneous changes should be grouped into a single commit.
- For multiple commits, the changes should be unrelated... either to different components/features or different types of changes (e.g. formatting, refactoring, etc.).
- Proceed with the following steps for each commit.

3. Stage all changes related to the commit: `git add .`
4. Generate a concise commit message based on the changes:

- Review the changed files and their diffs if needed
- Use conventional commit format:

```bash
git commit -m"<type>(<optional scope>): <description>" \
-m"<body (very optional)>" \
-m"<footer (almost never needed)>"
```

- Examples of good commit messages:

```
feat: add email notifications on new direct messages
```

```
feat(shopping cart): add the amazing button
```

```
feat!: remove ticket list endpoint

refers to JIRA-1337

BREAKING CHANGE: ticket endpoints no longer supports list all entities.
```

```
style: remove empty line
```

5. Commit: `git commit -m "generated message"`

**Important:** Do NOT ask for confirmation or user input. Execute all steps immediately and automatically.
**Important:** THE COMMIT MESSAGE SHOULD BE CONCISE AND TO THE POINT. IT SHOULD NOT BE A LONG PARAGRAPH. IT SHOULD IDEALLY BE A SINGLE SENTENCE THAT DESCRIBES THE CHANGES. THE INTENT OF OF THE CHANGE IS MORE IMPORTANT THAN THE SPECIFIC IMPLEMENTATION DETAILS, SO KEEP IT SOMEWHAT HIGH-LEVEL IF POSSIBLE!

- **IMPORTANT:** Use "(AI)" as the scope when the changes involve files that are specifically for AI instructions, rules, or context (e.g., `.cursor/commands/`, AI prompt files, AI configuration files, etc.). For other changes, use appropriate scopes based on what was actually changed (e.g., `feat(lockScreen):`, `chore(hotkeys):`, `docs(webview):`, etc.).
