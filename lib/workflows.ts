import { all, first, run } from "./crm";
import {
  Workflow,
  WorkflowDefinition,
  WorkflowRun,
  WorkflowRunStep,
  WORKFLOW_STATUSES,
  WorkflowStatus,
  WorkflowVersion,
} from "./types";
import {
  assertValidWorkflowDefinition,
  isNoBranch,
  isYesBranch,
  normalizeWorkflowDefinition,
  validateWorkflowDefinition,
} from "./workflow-definition";
import { emailConfigurationError, sendWorkflowEmail } from "./email";

function parseObject(value: unknown): Record<string, unknown> {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function parseArray<T>(value: unknown): T[] {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function rowToWorkflow(row: Record<string, unknown>): Workflow {
  const definition = normalizeWorkflowDefinition(parseObject(row.definition));
  return {
    id: Number(row.id),
    name: String(row.name),
    description: String(row.description ?? ""),
    status: (WORKFLOW_STATUSES as readonly string[]).includes(String(row.status))
      ? (row.status as WorkflowStatus)
      : "draft",
    current_version: Number(row.current_version),
    definition,
    validation: validateWorkflowDefinition(definition),
    created_by_agent_id: row.created_by_agent_id == null ? null : Number(row.created_by_agent_id),
    created_by_agent_name: (row.created_by_agent_name as string) ?? null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function rowToVersion(row: Record<string, unknown>): WorkflowVersion {
  return {
    id: Number(row.id),
    workflow_id: Number(row.workflow_id),
    version: Number(row.version),
    definition: normalizeWorkflowDefinition(parseObject(row.definition)),
    change_summary: String(row.change_summary),
    agent_id: row.agent_id == null ? null : Number(row.agent_id),
    agent_name: (row.agent_name as string) ?? null,
    created_at: String(row.created_at),
  };
}

function rowToRun(row: Record<string, unknown>): WorkflowRun {
  return {
    id: Number(row.id),
    workflow_id: Number(row.workflow_id),
    workflow_name: (row.workflow_name as string) ?? null,
    version: Number(row.version),
    status: row.status === "succeeded" || row.status === "failed" ? row.status : "running",
    trigger: row.trigger === "manual" || row.trigger === "event" ? row.trigger : "test",
    input: parseObject(row.input),
    trace: parseArray<WorkflowRunStep>(row.trace),
    output: row.output == null ? null : parseObject(row.output),
    error: (row.error as string) ?? null,
    started_at: String(row.started_at),
    completed_at: row.completed_at == null ? null : String(row.completed_at),
  };
}

const WORKFLOW_SELECT = `SELECT w.*, v.definition, a.name AS created_by_agent_name
  FROM workflows w
  JOIN workflow_versions v ON v.workflow_id = w.id AND v.version = w.current_version
  LEFT JOIN agents a ON a.id = w.created_by_agent_id`;

export async function listWorkflows(options: { includeArchived?: boolean } = {}): Promise<Workflow[]> {
  const where = options.includeArchived ? "" : "WHERE w.status <> 'archived'";
  const rows = await all<Record<string, unknown>>(`${WORKFLOW_SELECT} ${where} ORDER BY w.updated_at DESC, w.id DESC`);
  return rows.map(rowToWorkflow);
}

export async function getWorkflow(id: number): Promise<Workflow | null> {
  const row = await first<Record<string, unknown>>(`${WORKFLOW_SELECT} WHERE w.id = ?`, [id]);
  return row ? rowToWorkflow(row) : null;
}

export async function createWorkflow(input: {
  definition: unknown;
  changeSummary?: string;
  agentId?: number | null;
}): Promise<Workflow> {
  const definition = assertValidWorkflowDefinition(input.definition);
  const result = await run(
    "INSERT INTO workflows (name, description, status, current_version, created_by_agent_id) VALUES (?, ?, 'draft', 1, ?)",
    [definition.name, definition.description, input.agentId ?? null]
  );
  const workflowId = Number(result.meta.last_row_id);
  await run(
    "INSERT INTO workflow_versions (workflow_id, version, definition, change_summary, agent_id) VALUES (?, 1, ?, ?, ?)",
    [workflowId, JSON.stringify(definition), input.changeSummary?.trim() || "Initial workflow", input.agentId ?? null]
  );
  const workflow = await getWorkflow(workflowId);
  if (!workflow) throw new Error("The workflow was saved but could not be reloaded.");
  return workflow;
}

export async function reviseWorkflow(input: {
  id: number;
  expectedVersion: number;
  definition: unknown;
  changeSummary: string;
  agentId?: number | null;
}): Promise<Workflow> {
  const existing = await getWorkflow(input.id);
  if (!existing || existing.status === "archived") throw new Error(`Workflow ${input.id} not found.`);
  if (existing.current_version !== input.expectedVersion) {
    throw new Error(
      `Workflow ${input.id} changed while you were editing it. Expected v${input.expectedVersion}, but it is now v${existing.current_version}. Read it again and reapply the requested change.`
    );
  }
  const definition = assertValidWorkflowDefinition(input.definition);
  const version = existing.current_version + 1;
  await run(
    "INSERT INTO workflow_versions (workflow_id, version, definition, change_summary, agent_id) VALUES (?, ?, ?, ?, ?)",
    [input.id, version, JSON.stringify(definition), input.changeSummary.trim() || `Updated to v${version}`, input.agentId ?? null]
  );
  const updated = await run(
    `UPDATE workflows SET name = ?, description = ?, current_version = ?, status = 'draft', updated_at = datetime('now')
      WHERE id = ? AND current_version = ?`,
    [definition.name, definition.description, version, input.id, input.expectedVersion]
  );
  if (updated.meta.changes === 0) {
    throw new Error("The workflow changed before this version could become current. Read it again before retrying.");
  }
  return (await getWorkflow(input.id))!;
}

export async function listWorkflowVersions(workflowId: number): Promise<WorkflowVersion[]> {
  const rows = await all<Record<string, unknown>>(
    `SELECT v.*, a.name AS agent_name FROM workflow_versions v
      LEFT JOIN agents a ON a.id = v.agent_id
      WHERE v.workflow_id = ? ORDER BY v.version DESC`,
    [workflowId]
  );
  return rows.map(rowToVersion);
}

export async function restoreWorkflowVersion(input: {
  workflowId: number;
  version: number;
  expectedVersion: number;
  agentId?: number | null;
}): Promise<Workflow> {
  const source = await first<Record<string, unknown>>(
    "SELECT * FROM workflow_versions WHERE workflow_id = ? AND version = ?",
    [input.workflowId, input.version]
  );
  if (!source) throw new Error(`Version ${input.version} does not exist for workflow ${input.workflowId}.`);
  return reviseWorkflow({
    id: input.workflowId,
    expectedVersion: input.expectedVersion,
    definition: parseObject(source.definition),
    changeSummary: `Restored the definition from v${input.version}`,
    agentId: input.agentId,
  });
}

export async function setWorkflowStatus(id: number, status: WorkflowStatus): Promise<Workflow> {
  if (!(WORKFLOW_STATUSES as readonly string[]).includes(status)) throw new Error(`Invalid workflow status “${status}”.`);
  const workflow = await getWorkflow(id);
  if (!workflow) throw new Error(`Workflow ${id} not found.`);
  if (status === "active") {
    const errors = workflow.validation.filter((issue) => issue.level === "error");
    if (errors.length > 0) throw new Error(`Fix ${errors.length} validation error${errors.length === 1 ? "" : "s"} before activating.`);
    if (workflow.definition.nodes.some((node) => node.operation === "email.send")) {
      const configurationError = emailConfigurationError();
      if (configurationError) throw new Error(configurationError);
    }
  }
  await run("UPDATE workflows SET status = ?, updated_at = datetime('now') WHERE id = ?", [status, id]);
  return (await getWorkflow(id))!;
}

export async function listWorkflowRuns(workflowId?: number): Promise<WorkflowRun[]> {
  const where = workflowId == null ? "" : "WHERE r.workflow_id = ?";
  const rows = await all<Record<string, unknown>>(
    `SELECT r.*, w.name AS workflow_name FROM workflow_runs r
      LEFT JOIN workflows w ON w.id = r.workflow_id ${where}
      ORDER BY r.id DESC LIMIT 50`,
    workflowId == null ? [] : [workflowId]
  );
  return rows.map(rowToRun);
}

function readPath(value: Record<string, unknown>, path: string): unknown {
  const keys = path.split(".").filter(Boolean);
  let current: unknown = value;
  for (const key of keys) {
    if (current === null || typeof current !== "object" || Array.isArray(current)) return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

function conditionMatches(config: Record<string, unknown>, input: Record<string, unknown>): boolean {
  const actual = readPath(input, String(config.field ?? ""));
  const expected = config.value;
  switch (String(config.operator ?? "equals")) {
    case "equals": return String(actual ?? "").toLowerCase() === String(expected ?? "").toLowerCase();
    case "not_equals": return String(actual ?? "").toLowerCase() !== String(expected ?? "").toLowerCase();
    case "contains": return String(actual ?? "").toLowerCase().includes(String(expected ?? "").toLowerCase());
    case "greater_than": return Number(actual) > Number(expected);
    case "less_than": return Number(actual) < Number(expected);
    case "exists": return actual !== undefined && actual !== null && actual !== "";
    default: return false;
  }
}

function stepDetail(node: WorkflowDefinition["nodes"][number], input: Record<string, unknown>): string {
  if (node.kind === "trigger") return `Received a simulated ${node.operation} event.`;
  if (node.kind === "condition") {
    const matched = conditionMatches(node.config, input);
    return `${String(node.config.field)} ${String(node.config.operator)} ${String(node.config.value ?? "")} → ${matched ? "Yes" : "No"}`;
  }
  if (node.kind === "delay") return `Would wait ${String(node.config.duration)} (skipped in test mode).`;
  if (node.kind === "ai_agent") return `Would ask an AI agent: ${String(node.config.instructions).slice(0, 160)}`;
  if (node.operation === "sales_rep.create") return `Would create sales rep ${String(node.config.name)}.`;
  if (node.operation === "contact.assign_sales_rep") {
    return `Would assign contact ${String(node.config.contact_id)} to sales rep ${String(node.config.sales_rep_id)}.`;
  }
  if (node.operation === "deal.close") {
    return `Would close deal ${String(node.config.deal_id)} as ${String(node.config.outcome ?? "won")} by sales rep ${String(node.config.sales_rep_id)}.`;
  }
  if (node.operation === "task.create" && node.config.assignee_sales_rep_id != null) {
    return `Would create task “${String(node.config.title)}” for sales rep ${String(node.config.assignee_sales_rep_id)}.`;
  }
  return `Would run ${node.operation}${Object.keys(node.config).length ? ` with ${JSON.stringify(node.config)}` : ""}.`;
}

/**
 * Safe executor used by the visual builder. It follows real graph branches and
 * records a durable trace, but action adapters are deliberately dry-run only.
 */
export async function testWorkflow(id: number, providedInput?: Record<string, unknown>): Promise<WorkflowRun> {
  const workflow = await getWorkflow(id);
  if (!workflow || workflow.status === "archived") throw new Error(`Workflow ${id} not found.`);
  const errors = workflow.validation.filter((issue) => issue.level === "error");
  if (errors.length > 0) throw new Error(`This workflow has ${errors.length} validation error${errors.length === 1 ? "" : "s"}.`);
  const input = providedInput ?? {
    record: { id: 42, name: "Sample lead", status: "qualified", value: 12000, email: "sample@example.com", sales_rep_id: 7 },
    sales_rep: { id: 7, name: "Sample sales rep", email: "rep@example.com" },
    event: { source: "workflow_test", entity: "contact", occurred_at: new Date().toISOString() },
  };
  const inserted = await run(
    "INSERT INTO workflow_runs (workflow_id, version, status, trigger, input) VALUES (?, ?, 'running', 'test', ?)",
    [workflow.id, workflow.current_version, JSON.stringify(input)]
  );
  const runId = Number(inserted.meta.last_row_id);
  const trace: WorkflowRunStep[] = [];

  try {
    const nodeById = new Map(workflow.definition.nodes.map((node) => [node.id, node]));
    const outgoing = new Map<string, WorkflowDefinition["edges"]>();
    for (const edge of workflow.definition.edges) outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge]);
    const trigger = workflow.definition.nodes.find((node) => node.kind === "trigger")!;
    const queue = [trigger.id];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      if (visited.has(nodeId)) continue;
      visited.add(nodeId);
      const node = nodeById.get(nodeId);
      if (!node) continue;
      trace.push({ node_id: node.id, node_title: node.title, kind: node.kind, status: "succeeded", detail: stepDetail(node, input) });
      const next = outgoing.get(node.id) ?? [];
      if (node.kind === "condition") {
        const matched = conditionMatches(node.config, input);
        const chosen = next.find((edge) => (matched ? isYesBranch(edge.label) : isNoBranch(edge.label)));
        const skipped = next.find((edge) => edge !== chosen);
        if (skipped) {
          const skippedNode = nodeById.get(skipped.target);
          if (skippedNode) trace.push({ node_id: skippedNode.id, node_title: skippedNode.title, kind: skippedNode.kind, status: "skipped", detail: `${matched ? "No" : "Yes"} branch was not selected.` });
        }
        if (chosen) queue.push(chosen.target);
      } else {
        queue.push(...next.map((edge) => edge.target));
      }
    }

    const output = { tested_nodes: trace.filter((step) => step.status === "succeeded").length, dry_run: true };
    await run(
      "UPDATE workflow_runs SET status = 'succeeded', trace = ?, output = ?, completed_at = datetime('now') WHERE id = ?",
      [JSON.stringify(trace), JSON.stringify(output), runId]
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await run(
      "UPDATE workflow_runs SET status = 'failed', trace = ?, error = ?, completed_at = datetime('now') WHERE id = ?",
      [JSON.stringify(trace), message, runId]
    );
  }

  const row = await first<Record<string, unknown>>(
    `SELECT r.*, w.name AS workflow_name FROM workflow_runs r LEFT JOIN workflows w ON w.id = r.workflow_id WHERE r.id = ?`,
    [runId]
  );
  return rowToRun(row!);
}

/** Execute an active workflow. Live adapters are explicit so unsupported actions fail closed. */
export async function runWorkflow(id: number, providedInput?: Record<string, unknown>): Promise<WorkflowRun> {
  const workflow = await getWorkflow(id);
  if (!workflow || workflow.status === "archived") throw new Error(`Workflow ${id} not found.`);
  if (workflow.status !== "active") throw new Error("Activate this workflow before running it live.");
  const errors = workflow.validation.filter((issue) => issue.level === "error");
  if (errors.length > 0) throw new Error(`This workflow has ${errors.length} validation error${errors.length === 1 ? "" : "s"}.`);
  const unsupported = workflow.definition.nodes.filter((node) =>
    node.kind !== "trigger" && node.kind !== "condition" && node.operation !== "email.send"
  );
  if (unsupported.length > 0) {
    throw new Error(`This workflow contains live actions that are not available yet: ${[...new Set(unsupported.map((node) => node.operation))].join(", ")}.`);
  }
  const input = providedInput ?? {};
  const inserted = await run(
    "INSERT INTO workflow_runs (workflow_id, version, status, trigger, input) VALUES (?, ?, 'running', 'manual', ?)",
    [workflow.id, workflow.current_version, JSON.stringify(input)]
  );
  const runId = Number(inserted.meta.last_row_id);
  const trace: WorkflowRunStep[] = [];
  const sentEmailIds: string[] = [];

  try {
    const nodeById = new Map(workflow.definition.nodes.map((node) => [node.id, node]));
    const outgoing = new Map<string, WorkflowDefinition["edges"]>();
    for (const edge of workflow.definition.edges) outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge]);
    const trigger = workflow.definition.nodes.find((node) => node.kind === "trigger")!;
    const queue = [trigger.id];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      if (visited.has(nodeId)) continue;
      visited.add(nodeId);
      const node = nodeById.get(nodeId);
      if (!node) continue;

      try {
        let detail: string;
        if (node.kind === "trigger") {
          detail = `Started by a manual ${node.operation} run.`;
        } else if (node.kind === "condition") {
          const matched = conditionMatches(node.config, input);
          detail = `${String(node.config.field)} ${String(node.config.operator)} ${String(node.config.value ?? "")} → ${matched ? "Yes" : "No"}`;
        } else if (node.operation === "email.send") {
          const result = await sendWorkflowEmail({
            config: node.config,
            workflowInput: input,
            idempotencyKey: `workflow-${workflow.id}-run-${runId}-node-${node.id}`,
          });
          sentEmailIds.push(result.id);
          detail = `Sent email to ${result.recipients.join(", ")} (provider id ${result.id}).`;
        } else {
          throw new Error(`Live execution for ${node.operation} is not available yet.`);
        }
        trace.push({ node_id: node.id, node_title: node.title, kind: node.kind, status: "succeeded", detail });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        trace.push({ node_id: node.id, node_title: node.title, kind: node.kind, status: "failed", detail: message });
        throw error;
      }

      const next = outgoing.get(node.id) ?? [];
      if (node.kind === "condition") {
        const matched = conditionMatches(node.config, input);
        const chosen = next.find((edge) => (matched ? isYesBranch(edge.label) : isNoBranch(edge.label)));
        const skipped = next.find((edge) => edge !== chosen);
        if (skipped) {
          const skippedNode = nodeById.get(skipped.target);
          if (skippedNode) trace.push({ node_id: skippedNode.id, node_title: skippedNode.title, kind: skippedNode.kind, status: "skipped", detail: `${matched ? "No" : "Yes"} branch was not selected.` });
        }
        if (chosen) queue.push(chosen.target);
      } else {
        queue.push(...next.map((edge) => edge.target));
      }
    }

    const output = { executed_nodes: trace.filter((step) => step.status === "succeeded").length, email_ids: sentEmailIds };
    await run(
      "UPDATE workflow_runs SET status = 'succeeded', trace = ?, output = ?, completed_at = datetime('now') WHERE id = ?",
      [JSON.stringify(trace), JSON.stringify(output), runId]
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await run(
      "UPDATE workflow_runs SET status = 'failed', trace = ?, error = ?, completed_at = datetime('now') WHERE id = ?",
      [JSON.stringify(trace), message, runId]
    );
  }

  const row = await first<Record<string, unknown>>(
    `SELECT r.*, w.name AS workflow_name FROM workflow_runs r LEFT JOIN workflows w ON w.id = r.workflow_id WHERE r.id = ?`,
    [runId]
  );
  return rowToRun(row!);
}
