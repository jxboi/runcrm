import {
  createContact,
  createDeal,
  createSalesRep,
  createTask,
  getContact,
  getSalesRep,
  listActivities,
  listAgents,
  listContacts,
  listDeals,
  listSalesReps,
  listTasks,
  logActivity,
  updateContact,
  updateDeal,
  updateSalesRep,
  updateTask,
} from "../crm";
import { ACTIVITY_TYPES, Agent, canRead, canWrite, CapabilityEntity, CONTACT_STATUSES, DEAL_STAGES, Entity, EntityRef, TASK_STATUSES, writeRequiresApproval } from "../types";
import { journalMutation, refFor, snapshotRow } from "../mutations";
import { createProposal } from "../proposals";
import {
  createWorkflow,
  getWorkflow,
  listWorkflows,
  restoreWorkflowVersion,
  reviseWorkflow,
  setWorkflowStatus,
} from "../workflows";
import { nameKey } from "./mentions";

// Plain JSON-schema tool definitions (Anthropic Messages API shape).
export interface ToolDef {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface ToolSpec {
  /** null for workspace tools that aren't gated on access rights. */
  entity: CapabilityEntity | null;
  level: "read" | "write";
  def: ToolDef;
  run: (input: Record<string, unknown>, agent: Agent) => unknown | Promise<unknown>;
}

export const HANDOFF_TOOL = "handoff_to_agent";

/** Where a turn asked its work to go next. */
export interface HandoffRequest {
  agentId: number;
  agentName: string;
  instructions: string;
}

const num = (v: unknown): number | undefined =>
  v === null || v === undefined || v === "" ? undefined : Number(v);
const str = (v: unknown): string | undefined =>
  v === null || v === undefined ? undefined : String(v);

const WORKFLOW_DEFINITION_SCHEMA = {
  type: "object",
  description: "A complete v1 workflow graph. Revisions must send the entire graph, including unchanged nodes and edges.",
  properties: {
    schema_version: { type: "integer", enum: [1] },
    name: { type: "string" },
    description: { type: "string" },
    nodes: {
      type: "array",
      minItems: 2,
      maxItems: 30,
      items: {
        type: "object",
        properties: {
          id: { type: "string", description: "Stable lowercase id such as lead_created or create_follow_up" },
          kind: { type: "string", enum: ["trigger", "condition", "action", "delay", "ai_agent"] },
          operation: {
            type: "string",
            description: "Built-ins: manual, record.created, record.updated, schedule.reached, branch.if, record.update, sales_rep.create, contact.assign_sales_rep, deal.close, task.create, activity.log, email.send, notification.send, wait.duration, agent.run",
          },
          title: { type: "string" },
          description: { type: "string" },
          config: {
            type: "object",
            description: "Operation settings. Conditions use field/operator/value; delays use duration; AI nodes use instructions. email.send requires to, subject, and body; values may use runtime placeholders such as {{record.email}}.",
            additionalProperties: true,
          },
        },
        required: ["id", "kind", "operation", "title", "description", "config"],
        additionalProperties: false,
      },
    },
    edges: {
      type: "array",
      maxItems: 60,
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          source: { type: "string" },
          target: { type: "string" },
          label: { type: "string", description: "Use then for normal edges and yes/no for the two condition branches" },
        },
        required: ["id", "source", "target", "label"],
        additionalProperties: false,
      },
    },
  },
  required: ["schema_version", "name", "description", "nodes", "edges"],
  additionalProperties: false,
};

function workflowResult(workflow: Awaited<ReturnType<typeof createWorkflow>>) {
  return {
    id: workflow.id,
    name: workflow.name,
    status: workflow.status,
    current_version: workflow.current_version,
    node_count: workflow.definition.nodes.length,
    validation: workflow.validation,
    note: "The saved version is now visible in Workflow Studio.",
  };
}

const TOOL_SPECS: ToolSpec[] = [
  // ---- contacts ----
  {
    entity: "contacts",
    level: "read",
    def: {
      name: "list_contacts",
      description:
        "List contacts in the CRM, optionally filtered by a free-text query (matches name, company, email) and/or status.",
      input_schema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Free-text filter on name, company, or email" },
          status: { type: "string", enum: [...CONTACT_STATUSES], description: "Filter by lifecycle status" },
        },
      },
    },
    run: (input) => listContacts({ query: str(input.query), status: str(input.status) }),
  },
  {
    entity: "contacts",
    level: "read",
    def: {
      name: "get_contact",
      description: "Get one contact by id, including their deals and recent activities.",
      input_schema: {
        type: "object",
        properties: { id: { type: "integer", description: "Contact id" } },
        required: ["id"],
      },
    },
    run: async (input) => {
      const c = await getContact(Number(input.id));
      if (!c) throw new Error(`Contact ${input.id} not found`);
      return c;
    },
  },
  {
    entity: "contacts",
    level: "write",
    def: {
      name: "create_contact",
      description:
        "Prepare a new contact for the user to review. Check with list_contacts first to avoid duplicates. This action always waits for explicit approval before the contact is created.",
      input_schema: {
        type: "object",
        properties: {
          name: { type: "string" },
          email: { type: "string" },
          phone: { type: "string" },
          company: { type: "string" },
          sales_rep_id: { type: "integer", description: "Sales rep who owns this contact" },
          status: { type: "string", enum: [...CONTACT_STATUSES], description: "Defaults to 'lead'" },
          notes: { type: "string" },
        },
        required: ["name"],
      },
    },
    run: (input) =>
      createContact({
        name: String(input.name ?? ""),
        email: str(input.email),
        phone: str(input.phone),
        company: str(input.company),
        sales_rep_id: num(input.sales_rep_id) ?? null,
        status: str(input.status),
        notes: str(input.notes),
      }),
  },
  {
    entity: "contacts",
    level: "write",
    def: {
      name: "update_contact",
      description: "Update fields on an existing contact. Only pass the fields you want to change.",
      input_schema: {
        type: "object",
        properties: {
          id: { type: "integer" },
          name: { type: "string" },
          email: { type: "string" },
          phone: { type: "string" },
          company: { type: "string" },
          sales_rep_id: { type: ["integer", "null"], description: "Assign or unassign the contact's sales rep" },
          status: { type: "string", enum: [...CONTACT_STATUSES] },
          notes: { type: "string" },
        },
        required: ["id"],
      },
    },
    run: (input) =>
      updateContact(Number(input.id), {
        name: str(input.name),
        email: str(input.email),
        phone: str(input.phone),
        company: str(input.company),
        sales_rep_id: input.sales_rep_id === null ? null : num(input.sales_rep_id),
        status: str(input.status) as never,
        notes: str(input.notes),
      }),
  },
  // ---- deals ----
  {
    entity: "deals",
    level: "read",
    def: {
      name: "list_deals",
      description: "List deals with their contact names, optionally filtered by stage or contact_id.",
      input_schema: {
        type: "object",
        properties: {
          stage: { type: "string", enum: [...DEAL_STAGES] },
          contact_id: { type: "integer" },
        },
      },
    },
    run: (input) => listDeals({ stage: str(input.stage), contact_id: num(input.contact_id) }),
  },
  {
    entity: "deals",
    level: "write",
    def: {
      name: "create_deal",
      description: "Create a new deal, optionally linked to a contact by contact_id.",
      input_schema: {
        type: "object",
        properties: {
          title: { type: "string" },
          contact_id: { type: "integer" },
          value: { type: "number", description: "Deal value in USD" },
          stage: { type: "string", enum: [...DEAL_STAGES], description: "Defaults to 'lead'" },
          notes: { type: "string" },
          closed_by_sales_rep_id: { type: "integer", description: "Sales rep who closed the deal; only valid for won or lost deals" },
        },
        required: ["title"],
      },
    },
    run: (input) =>
      createDeal({
        title: String(input.title ?? ""),
        contact_id: num(input.contact_id) ?? null,
        value: num(input.value),
        stage: str(input.stage),
        notes: str(input.notes),
        closed_by_sales_rep_id: num(input.closed_by_sales_rep_id) ?? null,
      }),
  },
  {
    entity: "deals",
    level: "write",
    def: {
      name: "update_deal",
      description: "Update fields on an existing deal (e.g. move stage, change value). Only pass fields to change.",
      input_schema: {
        type: "object",
        properties: {
          id: { type: "integer" },
          title: { type: "string" },
          contact_id: { type: "integer" },
          value: { type: "number" },
          stage: { type: "string", enum: [...DEAL_STAGES] },
          notes: { type: "string" },
          closed_by_sales_rep_id: { type: ["integer", "null"], description: "Sales rep who closed the deal; set stage to won or lost too" },
        },
        required: ["id"],
      },
    },
    run: (input) =>
      updateDeal(Number(input.id), {
        title: str(input.title),
        contact_id: num(input.contact_id),
        value: num(input.value),
        stage: str(input.stage) as never,
        notes: str(input.notes),
        closed_by_sales_rep_id: input.closed_by_sales_rep_id === null ? null : num(input.closed_by_sales_rep_id),
      }),
  },
  // ---- activities ----
  {
    entity: "activities",
    level: "read",
    def: {
      name: "list_activities",
      description: "List recent activities (notes, calls, emails, meetings), newest first.",
      input_schema: {
        type: "object",
        properties: {
          contact_id: { type: "integer" },
          deal_id: { type: "integer" },
          limit: { type: "integer", description: "Max rows, default 30" },
        },
      },
    },
    run: (input) =>
      listActivities({ contact_id: num(input.contact_id), deal_id: num(input.deal_id), limit: num(input.limit) }),
  },
  {
    entity: "activities",
    level: "write",
    def: {
      name: "log_activity",
      description: "Log an activity (note, call, email, meeting), optionally linked to a contact and/or deal.",
      input_schema: {
        type: "object",
        properties: {
          type: { type: "string", enum: [...ACTIVITY_TYPES], description: "Defaults to 'note'" },
          content: { type: "string" },
          contact_id: { type: "integer" },
          deal_id: { type: "integer" },
        },
        required: ["content"],
      },
    },
    run: (input, agent) =>
      logActivity({
        type: str(input.type),
        content: String(input.content ?? ""),
        contact_id: num(input.contact_id) ?? null,
        deal_id: num(input.deal_id) ?? null,
        actor: agent.name,
      }),
  },
  // ---- tasks ----
  {
    entity: "tasks",
    level: "read",
    def: {
      name: "list_tasks",
      description: "List tasks on the shared task board, optionally filtered by status.",
      input_schema: {
        type: "object",
        properties: { status: { type: "string", enum: [...TASK_STATUSES] } },
      },
    },
    run: (input) => listTasks({ status: str(input.status) }),
  },
  {
    entity: "tasks",
    level: "write",
    def: {
      name: "create_task",
      description: "Create a task on the shared task board, optionally assigned to one AI agent or one sales rep by id.",
      input_schema: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          assignee_agent_id: { type: "integer" },
          assignee_sales_rep_id: { type: "integer" },
        },
        required: ["title"],
      },
    },
    run: (input) =>
      createTask({
        title: String(input.title ?? ""),
        description: str(input.description),
        assignee_agent_id: num(input.assignee_agent_id) ?? null,
        assignee_sales_rep_id: num(input.assignee_sales_rep_id) ?? null,
      }),
  },
  {
    entity: "tasks",
    level: "write",
    def: {
      name: "update_task",
      description: "Update a task's status, result, title, description, or assignee.",
      input_schema: {
        type: "object",
        properties: {
          id: { type: "integer" },
          title: { type: "string" },
          description: { type: "string" },
          status: { type: "string", enum: [...TASK_STATUSES] },
          result: { type: "string" },
          assignee_agent_id: { type: ["integer", "null"] },
          assignee_sales_rep_id: { type: ["integer", "null"] },
        },
        required: ["id"],
      },
    },
    run: (input) =>
      updateTask(Number(input.id), {
        title: str(input.title),
        description: str(input.description),
        status: str(input.status) as never,
        result: str(input.result),
        assignee_agent_id: input.assignee_agent_id === null ? null : num(input.assignee_agent_id),
        assignee_sales_rep_id: input.assignee_sales_rep_id === null ? null : num(input.assignee_sales_rep_id),
      }),
  },
  // ---- sales reps ----
  {
    entity: "sales_reps",
    level: "read",
    def: {
      name: "list_sales_reps",
      description: "List sales reps with their assigned-contact count and won-deal performance.",
      input_schema: { type: "object", properties: {} },
    },
    run: () => listSalesReps(),
  },
  {
    entity: "sales_reps",
    level: "read",
    def: {
      name: "get_sales_rep",
      description: "Get one sales rep by id, including summary counts.",
      input_schema: {
        type: "object",
        properties: { id: { type: "integer" } },
        required: ["id"],
      },
    },
    run: async (input) => {
      const salesRep = await getSalesRep(Number(input.id));
      if (!salesRep) throw new Error(`Sales rep ${input.id} not found`);
      return salesRep;
    },
  },
  {
    entity: "sales_reps",
    level: "write",
    def: {
      name: "create_sales_rep",
      description: "Create a sales rep who can own contacts, close deals, and receive tasks.",
      input_schema: {
        type: "object",
        properties: { name: { type: "string" }, email: { type: "string" }, phone: { type: "string" } },
        required: ["name"],
      },
    },
    run: (input) => createSalesRep({ name: String(input.name ?? ""), email: str(input.email), phone: str(input.phone) }),
  },
  {
    entity: "sales_reps",
    level: "write",
    def: {
      name: "update_sales_rep",
      description: "Update a sales rep's name or contact details.",
      input_schema: {
        type: "object",
        properties: { id: { type: "integer" }, name: { type: "string" }, email: { type: "string" }, phone: { type: "string" } },
        required: ["id"],
      },
    },
    run: (input) => updateSalesRep(Number(input.id), { name: str(input.name), email: str(input.email), phone: str(input.phone) }),
  },
  // ---- workflows ----
  {
    entity: "workflows",
    level: "read",
    def: {
      name: "list_workflows",
      description: "List saved workflows with ids, status, version, validation summary, and node counts.",
      input_schema: {
        type: "object",
        properties: { include_archived: { type: "boolean" } },
      },
    },
    run: async (input) => (await listWorkflows({ includeArchived: Boolean(input.include_archived) })).map((workflow) => ({
      id: workflow.id,
      name: workflow.name,
      description: workflow.description,
      status: workflow.status,
      current_version: workflow.current_version,
      node_count: workflow.definition.nodes.length,
      validation: workflow.validation,
      updated_at: workflow.updated_at,
    })),
  },
  {
    entity: "workflows",
    level: "read",
    def: {
      name: "get_workflow",
      description: "Read a workflow's complete current definition before revising it. Always use its current_version as expected_version.",
      input_schema: {
        type: "object",
        properties: { workflow_id: { type: "integer" } },
        required: ["workflow_id"],
      },
    },
    run: async (input) => {
      const workflow = await getWorkflow(Number(input.workflow_id));
      if (!workflow) throw new Error(`Workflow ${input.workflow_id} not found`);
      return workflow;
    },
  },
  {
    entity: "workflows",
    level: "write",
    def: {
      name: "create_workflow",
      description: "Create and save a new draft workflow. The saved graph appears immediately in the user's visual preview.",
      input_schema: {
        type: "object",
        properties: {
          definition: WORKFLOW_DEFINITION_SCHEMA,
          change_summary: { type: "string", description: "Short description of what this first version establishes" },
        },
        required: ["definition", "change_summary"],
      },
    },
    run: async (input, agent) => workflowResult(await createWorkflow({ definition: input.definition, changeSummary: String(input.change_summary ?? "Initial workflow"), agentId: agent.id })),
  },
  {
    entity: "workflows",
    level: "write",
    def: {
      name: "revise_workflow",
      description: "Save a complete replacement definition as the next immutable version. Read the workflow first and preserve everything the user did not ask to change.",
      input_schema: {
        type: "object",
        properties: {
          workflow_id: { type: "integer" },
          expected_version: { type: "integer", description: "The current_version returned by get_workflow" },
          definition: WORKFLOW_DEFINITION_SCHEMA,
          change_summary: { type: "string", description: "Concise user-facing summary of this revision" },
        },
        required: ["workflow_id", "expected_version", "definition", "change_summary"],
      },
    },
    run: async (input, agent) => workflowResult(await reviseWorkflow({
        id: Number(input.workflow_id),
        expectedVersion: Number(input.expected_version),
        definition: input.definition,
        changeSummary: String(input.change_summary ?? "Updated workflow"),
        agentId: agent.id,
      })),
  },
  {
    entity: "workflows",
    level: "write",
    def: {
      name: "restore_workflow_version",
      description: "Copy an older saved definition into a new current version. Use this when the user asks to undo or return to a previous workflow version.",
      input_schema: {
        type: "object",
        properties: {
          workflow_id: { type: "integer" },
          version: { type: "integer", description: "Older version to restore" },
          expected_version: { type: "integer", description: "Current version, used to prevent overwriting a newer edit" },
        },
        required: ["workflow_id", "version", "expected_version"],
      },
    },
    run: async (input, agent) => workflowResult(await restoreWorkflowVersion({
        workflowId: Number(input.workflow_id),
        version: Number(input.version),
        expectedVersion: Number(input.expected_version),
        agentId: agent.id,
      })),
  },
  {
    entity: "workflows",
    level: "write",
    def: {
      name: "set_workflow_status",
      description: "Activate, pause, return to draft, or archive a workflow only when the user explicitly asks. Activation is rejected if validation has errors.",
      input_schema: {
        type: "object",
        properties: {
          workflow_id: { type: "integer" },
          status: { type: "string", enum: ["draft", "active", "paused", "archived"] },
        },
        required: ["workflow_id", "status"],
      },
    },
    run: async (input) => workflowResult(await setWorkflowStatus(Number(input.workflow_id), String(input.status) as never)),
  },
  // ---- workspace ----
  {
    entity: null,
    level: "read",
    def: {
      name: HANDOFF_TOOL,
      description:
        "Hand this work to another agent in the workspace. Use it when the job needs access rights or knowledge you don't have — it is better than refusing. Pass along anything you already looked up (ids, names, values) so they don't repeat your work. Call this at most once per turn, and say in your reply that you handed off.",
      input_schema: {
        type: "object",
        properties: {
          agent_name: { type: "string", description: "Exact name of the agent to hand off to" },
          instructions: { type: "string", description: "What you need them to do, with any ids or values you found" },
        },
        required: ["agent_name", "instructions"],
      },
    },
    run: async (input, agent) => {
      const roster = await listAgents();
      const wanted = nameKey(String(input.agent_name ?? ""));
      const target = roster.find((a) => nameKey(a.name) === wanted);
      if (!target) {
        throw new Error(
          `No agent named "${input.agent_name}". Agents here: ${roster.map((a) => a.name).join(", ")}`
        );
      }
      if (target.id === agent.id) throw new Error("You can't hand off to yourself.");
      return {
        handed_off_to: target.name,
        agent_id: target.id,
        instructions: String(input.instructions ?? ""),
        note: "They will pick this up right after your reply. Tell the user you handed it to them.",
      };
    },
  },
];

function allowed(agent: Agent, spec: ToolSpec): boolean {
  // Workspace tools (handoff) aren't tied to an entity — every agent gets them.
  if (spec.entity === null) return true;
  const level = agent.capabilities[spec.entity];
  return spec.level === "read" ? canRead(level) : canWrite(level);
}

/** Tool definitions this agent is allowed to use, given its access rights. */
export function toolsForAgent(agent: Agent): ToolDef[] {
  return TOOL_SPECS.filter((s) => allowed(agent, s)).map((s) => s.def);
}

/** True for tools that change CRM data — the UI refreshes the record panel on these. */
export function isWriteTool(name: string): boolean {
  return TOOL_SPECS.find((s) => s.def.name === name)?.level === "write";
}

const MAX_RESULT_CHARS = 6000;
export interface ToolOutcome {
  result: string;
  ok: boolean;
  /** Set when the agent asked to pass the work on. */
  handoff?: HandoffRequest;
  /** Records this call created or changed. */
  refs?: EntityRef[];
  /** Journal rows written by this call, linked to the message once it exists. */
  mutationIds?: number[];
  /** Writes filed for approval instead of executed. */
  proposalIds?: number[];
}

/**
 * Execute one tool call on behalf of an agent, enforcing its access rights.
 *
 * This is the single enforcement point: access rights are checked here,
 * ask-scoped writes are diverted into proposals. Approving a proposal comes back through
 * this same function with `skipApproval`, so the permission check is never
 * bypassed.
 */
export async function executeTool(
  agent: Agent,
  name: string,
  input: Record<string, unknown>,
  options: { skipApproval?: boolean } = {}
): Promise<ToolOutcome> {
  const spec = TOOL_SPECS.find((s) => s.def.name === name);
  if (!spec) return { result: `Unknown tool: ${name}`, ok: false };
  if (!allowed(agent, spec)) {
    const access = agent.capabilities[spec.entity!];
    return {
      result: `Permission denied: ${agent.name} has "${access}" access to ${spec.entity}, but ${name} requires "${spec.level}". Consider handing this to an agent with Workflow write access.`,
      ok: false,
    };
  }

  // Ask-scoped writes are previewed instead of executed. This runs only
  // after the access check, so a proposal cannot ask for more than the agent
  // was already allowed to do.
  const requiresApproval = spec.entity ? writeRequiresApproval(agent.capabilities[spec.entity]) : false;
  if (requiresApproval && spec.level === "write" && spec.entity && !options.skipApproval) {
    const proposalId = await createProposal({ agentId: agent.id, tool: name, input: input ?? {} });
    return {
      result: `Filed proposal #${proposalId} for approval — ${name} was NOT executed. The user will approve or reject it. Do not retry this call or try another way around it; tell the user what you proposed and move on.`,
      ok: true,
      proposalIds: [proposalId],
    };
  }

  try {
    // Snapshot before the write so the journal can put the row back. Updates
    // carry the target id in their input; creates have nothing to snapshot.
    const isCrmWrite = spec.level === "write" && spec.entity != null && spec.entity !== "workflows";
    const targetId = isCrmWrite ? num(input?.id) : undefined;
    const before = targetId ? await snapshotRow(spec.entity as Entity, targetId) : null;

    const out = await spec.run(input ?? {}, agent);
    let json = JSON.stringify(out ?? null);
    if (json.length > MAX_RESULT_CHARS) json = json.slice(0, MAX_RESULT_CHARS) + "…(truncated)";

    const outcome: ToolOutcome = { result: json, ok: true };

    if (isCrmWrite) {
      const writtenId = num((out as { id?: unknown } | null)?.id);
      if (writtenId) {
        const crmEntity = spec.entity as Entity;
        const after = await snapshotRow(crmEntity, writtenId);
        outcome.refs = [refFor(crmEntity, writtenId, after)];
        outcome.mutationIds = [
          await journalMutation({
            agentId: agent.id,
            tool: name,
            entity: crmEntity,
            entityId: writtenId,
            before,
            after,
          }),
        ];
      }
    }

    if (spec.def.name === HANDOFF_TOOL) {
      const handoff = out as { agent_id: number; handed_off_to: string; instructions: string };
      outcome.handoff = {
        agentId: handoff.agent_id,
        agentName: handoff.handed_off_to,
        instructions: handoff.instructions,
      };
    }
    return outcome;
  } catch (err) {
    return { result: `Error: ${err instanceof Error ? err.message : String(err)}`, ok: false };
  }
}
