# GitHub Relay Contract

ChatGPT writes a bounded task JSON file to `relay/inbox/<task-id>.json` on `feature/chatgpt-codex-bridge`. The local worker atomically creates `relay/processed/<task-id>.json` before execution, then writes `relay/outbox/<task-id>.json`.

Task IDs use lowercase letters, digits, and hyphens. Payloads contain no absolute paths, shell commands, or secrets. The worker uses GitHub file-create semantics for the claim, so a conflicting worker skips the task rather than running it twice.

## Allowlist

- `bridge_ping` — no additional fields.
- `project_git_status` — `project: "iotmart"|"magnolia"`.
- `azure_work_item_read` — numeric `work_item_id`.
- `azure_work_item_update` — numeric `work_item_id` and one or more of `title`, `description`, or `acceptance_criteria`. The worker first reads the item, requires it to belong to `IoTMart 3.0`, updates only those supplied fields through Azure CLI, then reads it again. A result is successful only when every requested field matches exactly; no state, assignment, tags, links, attachments, or other metadata can be changed.
- `project_text_search` — `project`, literal UTF-8 `query`, optional `max_results` (1–100). Results contain relative paths, line numbers, and bounded excerpts. The worker skips `.git`, dependency, and common generated directories.
- `project_file_read` — `project`, `relative_path`, `start_line`, and `end_line` (at most 201 lines). Paths must resolve to a regular file beneath the configured project root.
- `project_git_diff` — `project` and optional `relative_path`; output is bounded.
- `project_comment_replace` — only `iotmart`; `relative_path`, exact `old_text`, exact `new_text`, and `expected_count: 1`.

`project_comment_replace` rejects absolute/traversing/symlink paths, any target file already dirty, non-comment or changed comment prefixes, text that is not one complete comment-only line, newlines in either text, and any occurrence count other than one. It writes only the exact bytes for that replacement, verifies the diff names only the target file, and restores its own pre-write bytes if post-write verification fails. It never commits the target repository.

Every task may include the optional routing field `machine_id`. It must match the local ignored machine identity or the worker skips the task before claiming it.
