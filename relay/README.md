# GitHub Relay Contract

ChatGPT writes a bounded task JSON file to `relay/inbox/<task-id>.json` on `feature/chatgpt-codex-bridge`. The local worker accepts only `bridge_ping`, `project_git_status`, and `azure_work_item_read`, atomically creates `relay/processed/<task-id>.json` before execution, then writes `relay/outbox/<task-id>.json`.

Task IDs use lowercase letters, digits, and hyphens. Payloads contain no paths, shell commands, or secrets. The worker uses GitHub file-create semantics for the claim, so a conflicting worker skips the task rather than running it twice.
