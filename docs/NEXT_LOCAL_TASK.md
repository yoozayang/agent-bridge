# Next Local Task — Azure 47151 English Update

Owner: local agent on `mac-cd134ffbc7aa2eb9`
Planner/translator/reviewer: ChatGPT

## Context

This Mac is already bootstrapped and its GitHub relay health check has passed.

Do not revisit MCP Tunnel, custom connectors, or relay architecture. Do not modify IoTMart/Magnolia target repositories.

Azure work item 47151 has already been read through the relay. ChatGPT has authored the English translation below.

## Objective

Add the smallest safe deterministic Azure DevOps write capability needed to update an existing work item, then use it once to update work item **47151** with the exact English title, description, and acceptance criteria supplied by ChatGPT.

This is an Azure work-item metadata update only. It is NOT a source-code task and must not touch any target repo.

## Human interaction

Do not ask the user anything except unavoidable login/SSO/MFA/permission actions.

Use the existing authenticated Azure CLI/session if valid.

## Add one bounded relay task

Add `azure_work_item_update` with these fields:

- `work_item_id`: positive integer
- optional `title`: bounded UTF-8 string
- optional `description`: bounded UTF-8 / HTML string
- optional `acceptance_criteria`: bounded UTF-8 / HTML string
- `machine_id`: normal relay routing field

Safety requirements:

1. only update an existing Azure DevOps work item in the already-configured IoTMart 3.0 project/org context
2. no arbitrary shell/command payloads
3. allow only the three fields above; reject unknown write fields
4. do not change state, assignee, tags, iteration, area, priority, links, attachments, or any other field
5. before writing, read and record the current values of the three target fields
6. apply the update using the authenticated Azure CLI/API
7. read the work item back after writing and verify the three stored values exactly match the requested values
8. return a bounded result containing work_item_id, before/after target fields, verification status, web_url, and machine_id
9. no Codex model turn is needed for the Azure update itself once the deterministic handler exists

Add focused tests for field allowlisting, missing/invalid work item IDs, bounded payloads, and no-op/verification behavior. Update `relay/README.md` and handoff docs if the contract changed materially.

## Exact update for work item 47151

### Title

`[EU][Mail] Remove hard-coded system email recipients and manage them via backend configuration (Manage system email recipients via Custom Metadata)`

### Description

```html
<h3>Background and Current State</h3>
<p>Currently, the recipient email addresses for some automatically generated system notifications (for example, low-inventory notifications and payment-success notifications) are hard-coded directly in Apex code or Flow.</p>
<p>This creates significant maintenance issues. When employees leave the company or responsibilities are reassigned, system administrators cannot update the recipient list directly from the backend. Each personnel change requires an engineering ticket, code changes, testing, a pull request, and redeployment to Production. This process is lengthy and can easily result in omissions, such as former employees continuing to receive system emails.</p>

<h3>Proposed Improvement</h3>
<p>Fully decouple system-notification recipient lists from executable code and manage them through backend configuration:</p>
<ol>
  <li>Use the existing Salesforce application-setting Custom Metadata (<code>AppSetting__mdt</code>) to store the recipient lists (To / CC) for each type of system email.</li>
  <li>Update the related Apex code (such as <code>BatchEUH1LowInventoryEmail</code> and <code>EmailTemplate_LowInventory</code>) to dynamically read the backend configuration and remove hard-coded personal email addresses.</li>
  <li>Update the related Flows (such as <code>Payment_Success_Notification</code>) to remove hard-coded personal email addresses.</li>
  <li>For future personnel changes, administrators can update the recipient configuration directly in Salesforce, with the changes taking effect immediately and without engineering involvement or code deployment.</li>
</ol>
```

### Acceptance Criteria

```html
<ol>
  <li><strong>No hard-coded personal email addresses:</strong> The target system-notification Apex code and Flows must not contain any hard-coded personal email addresses.</li>
  <li><strong>Dynamic backend configuration:</strong> Both To and CC recipient lists for system notifications must be dynamically read from <code>AppSetting__mdt</code>, and emails must be sent successfully to the configured recipients.</li>
  <li><strong>Administrator self-service maintenance:</strong> System administrators must be able to add, modify, or remove recipients directly in Salesforce Custom Metadata. Saved changes must take effect without requiring an engineering ticket or code deployment.</li>
  <li><strong>Email functionality remains operational:</strong> Low-inventory notifications, payment-success notifications, and other targeted system emails must continue to be delivered successfully to valid configured recipients in both UAT and PROD.</li>
  <li><strong>Code quality and testing:</strong> All related Apex unit tests must pass, with test coverage meeting the required standards.</li>
</ol>
```

## Execution sequence

1. implement and test `azure_work_item_update`
2. restart/reload the LaunchAgent watcher yourself so it uses the new code
3. verify watcher health
4. perform the 47151 update above
5. read 47151 back and verify the exact stored title/description/acceptance criteria
6. do not modify source repos
7. commit and push only Agent Bridge changes on `feature/chatgpt-codex-bridge`

## Completion report

Return only:

- Agent Bridge commit SHA
- `azure_work_item_update` implemented/tested status
- watcher reload/health status
- Azure 47151 update result
- read-back verification result
- confirmation no target repo was modified
- blocker, if any

Then stop. ChatGPT will inspect GitHub and provide the user with the final translated content and the full operational flow.
