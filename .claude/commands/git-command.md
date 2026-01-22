---
allowed-tools: Bash(git add:*), Bash(git status:*), Bash(git commit:*), Bash(git diff:*), Bash(git push:*)
description: Create one or more git commits and a Merge Request (GitLab) following Husky commit rules. For every commit, always ask the user for the Jira ticket key (e.g. PSN-123) and prefix the commit message with it.
---

# git-push – Commit & Merge Request Workflow
(Jira Ticket Prompt + Husky commit-msg + GitLab MR Template)

This workflow defines how Claude Code should:

1. Inspect and group changes into commits
2. Ask for the **Jira ticket key for every commit**
3. Create commit messages based on Husky `commit-msg` rules
4. Push the branch
5. Prepare a GitLab Merge Request based on templates

---

## 0. Assumptions

- Husky `commit-msg` hook is configured
- `.gitlab/merge_request_templates/` contains MR templates
- You know the default base branch (main/dev)
- Local branch is up to date

```bash
git checkout main
git pull origin main
```

⸻

1. High-level behavior

Claude Code must:
	1.	Run git status
	2.	Show changes and help user group them into commits
	3.	For each commit:
	•	Show which changes will be included
	•	Ask for Jira ticket key
	•	Ask commit type & summary
	•	Generate commit message using <JIRA_KEY> <type>: <summary>
	•	Stage selected files
	•	Run git commit
	4.	Push branch
	5.	Generate MR description using GitLab template

⸻

2. Jira Ticket Key Prompt Rules (중요)

For every commit, Claude must:

✔ Ask the user for a Jira ticket key

Prompt:

이 커밋에 해당되는 Jira 티켓 번호를 입력해 주세요.
예: PSN-123
(없으면 NO-TICKET 입력)

✔ Validate format

Valid examples:

PSN-123
ENA-456
DOC-789

If format is invalid:

입력한 티켓 번호가 Jira 형식과 다릅니다.
올바른 형식(예: PSN-123)으로 다시 입력하시겠습니까?
아니면 NO-TICKET으로 진행할까요?

✔ Use Jira key as commit message prefix

Commit message format:

<type>: <summary> (<JIRA_KEY>)

Examples:

feat: add overlay stack manager (PSN-123)
fix: null guard for role mapper (ENA-456)
chore: update documentation (NO-TICKET)

This ensures Husky commit-msg hook always passes.

⸻

3. Commit Workflow (Claude must follow this per commit)

For each logical commit:
	1.	Show staged/unstaged changes (git status, git diff)
	2.	Ask:

이 변경들을 하나의 커밋으로 묶을까요?

	3.	Ask Jira ticket:

이 커밋의 Jira 티켓 번호를 입력해 주세요. (예: PSN-123, 없으면 NO-TICKET)

	4.	Ask commit metadata:

커밋 type(feat/fix/chore/refactor 등)과 summary를 입력해 주세요.

	5.	Generate commit message:

<type>: <summary> (<JIRA_KEY>)

	6.	Run:

git add <files>
git commit -m "<type>: <summary> (<JIRA_KEY>)"

	7.	Continue until all commits are created.

⸻

4. Branch Push

Claude asks:

어떤 브랜치로 push할까요?
(기본값: 현재 브랜치명)

Then runs:

git push -u origin <branch>


⸻

5. Merge Request Generation (GitLab)

Claude must:
	1.	Ask the user which template to use
	2.	Auto-generate MR title using: <JIRA_KEY>: <first commit summary>
	3.	Auto-generate MR description from:
		•	Summary of changes
		•	List of Jira tickets included
		•	Testing notes
		•	Impact
		•	Additional notes
	4.	Output MR description markdown
	5.	Optionally guide user to create MR via GitLab UI or API
	6. Branch target to 'dev'

⸻

✔ Summary

This markdown defines:
	•	The entire commit workflow
	•	Jira ticket prompt enforcement
	•	Commit message format
	•	Husky compatibility
	•	Branch push
	•	GitLab MR creation

Claude Code will use this document to perform a reliable, repeatable commit + MR workflow with Jira ticket enforcement for every commit.

---