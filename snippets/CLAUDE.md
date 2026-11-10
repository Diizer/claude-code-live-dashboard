# long tasks: live dashboard

For a task with more than 5 steps or likely longer than 30 minutes:

- Before step 1, spawn the `dashboard-builder` agent with the plan. If it replies `STYLE NEEDED`, ask me (theme, density, accent, language) and pass the answer back via SendMessage. When it replies `READY TO PUBLISH <path>`, publish that file yourself (Artifact, `capabilities: {db: {}, comments: {}}`, its title and description), write `.dashboard/artifact.json` = `{"url": "<url>", "published_at": "<date -Iseconds>"}`, and send the URL to the agent. Only your own publish arms comment wake-ups. On `REPUBLISH NEEDED`, republish the same file. Never `cd` into `.dashboard/`.
- After each step, send the update (status, result, blockers, tokens used by that step) to the SAME agent via SendMessage, not a new Agent call.
- After each step and on every comment notification, read `questions` from its db (ArtifactData). For each answer: `answer_rev` new → apply it; `seen` already set but `< answer_rev` (corrected after reading) → first roll back what you did for `seen_answered`, then apply the new answer. Then write `seen`, `seen_answered`, `applied_at` with `if_version`; on conflict re-read and redo.
- Need a decision from me? Put the question on the dashboard with a default and keep working on the default, but only for reversible decisions. Push, publishing, and deleting wait for my explicit "yes".
