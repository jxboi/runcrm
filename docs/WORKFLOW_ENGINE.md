# Workflow engine architecture

RunCRM workflows are authored in chat, stored as immutable graph versions, rendered in Workflow Studio, and exercised through a safe dry-run runtime.

## Product contract

1. A user describes a workflow to an agent with Workflow write access.
2. The agent saves a complete, validated v1 graph with `create_workflow`.
3. The studio selects that saved workflow and renders the database version—not an optimistic model response.
4. A follow-up instruction makes the agent read the current graph and call `revise_workflow` with the whole replacement definition and `expected_version`.
5. Each accepted revision becomes an immutable version. Concurrent stale edits are rejected.
6. Definition edits always return the workflow to draft. Activation is explicit and validation-gated.

The chat message is the command surface. The canvas, version list, validation state, tests, and status controls are projections of durable workflow state.

## Data model

- `workflows` owns identity, lifecycle status, and the current version number.
- `workflow_versions` stores immutable JSON definitions and human-readable change summaries.
- `workflow_runs` stores test or future live execution traces.
- `agents.capabilities.workflows` is the server-enforced capability boundary for workflow authoring tools.

A definition is a portable JSON document with `schema_version`, metadata, nodes, and edges. Nodes use stable ids so revisions and future diff views can identify unchanged steps.

## Safety boundaries

- The validator requires one trigger, reachable nodes, an acyclic graph, valid endpoints, and explicit Yes/No condition branches.
- Activation fails when validation contains errors.
- Revisions use optimistic concurrency (`expected_version`) rather than silently overwriting a newer chat edit.
- Tests follow the real graph and evaluate conditions, but never mutate CRM data or contact external integrations. Explicit live runs execute only registered live adapters and fail closed on unsupported actions.
- Sales reps are supported as record trigger/update entities. Built-in actions can create a rep, assign one rep to a contact, close a deal under a rep, or create a task assigned to a rep.
- `email.send` has a Resend-backed live adapter; notification nodes carry setup warnings until an integration adapter is connected.

## Email operation

- `email.send` requires `config.to`, `config.subject`, and `config.body`; `config.reply_to` is optional.
- Recipients can be one address, a comma-separated string, or a list of up to 50 addresses.
- Text values support input references such as `{{record.email}}` and `{{record.name}}`. Missing references fail the run before the provider request.
- Provider credentials and the verified sender come from `RESEND_API_KEY` and `RESEND_FROM_EMAIL`; they are never stored in workflow versions.
- Every live send uses a key derived from the workflow, run, and node so a retry cannot duplicate that node's email.

## Extending the engine

Add a new node operation in four places:

1. Register it in `WORKFLOW_OPERATIONS` and add operation-specific validation in `lib/workflow-definition.ts`.
2. Add its tool-schema description in `lib/agent/tools.ts` so the architect can author it correctly.
3. Add a runtime adapter to `runWorkflow`. Keep test and live paths separate so tests remain side-effect free; unsupported live actions must fail closed.
4. Add a visual label/icon if the operation introduces a new node kind; ordinary operations can reuse the existing kind card.

Live execution should enter through a trigger dispatcher that resolves active workflows by trigger operation, records a `workflow_runs` row, and delegates each action to a permission-aware adapter. Delays should be durable scheduled jobs rather than in-process timers. Integration credentials belong in server-side connection records and must never be stored in workflow JSON.

## Sales rep operations

- `record.created` / `record.updated`: set `config.entity` to `sales_rep` to react to rep records.
- `sales_rep.create`: accepts `name`, plus optional `email` and `phone`.
- `contact.assign_sales_rep`: requires `contact_id` and `sales_rep_id`.
- `deal.close`: requires `deal_id` and `sales_rep_id`; `outcome` is `won` or `lost` and defaults to `won`.
- `task.create`: accepts either `assignee_sales_rep_id` or `assignee_agent_id`, but not both.
- `record.update`: accepts `sales_rep` as `config.entity`, alongside contact, deal, activity, and task.

Configuration IDs may be literal values or runtime references such as `{{record.id}}` and `{{record.sales_rep_id}}`.

## Schema evolution

`schema_version: 1` is intentionally explicit. Future migrations should be pure functions from one document version to the next. Old `workflow_versions` rows remain immutable; normalize or migrate only when reading them into a newer runtime.
