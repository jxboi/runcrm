import {
  createContact,
  createDeal,
  createTask,
  getContact,
  listActivities,
  listContacts,
  listDeals,
  listTasks,
  logActivity,
  updateContact,
  updateDeal,
  updateTask,
} from "../crm";
import { ACTIVITY_TYPES, Agent, CONTACT_STATUSES, DEAL_STAGES, Entity, TASK_STATUSES } from "../types";

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
  entity: Entity;
  level: "read" | "write";
  def: ToolDef;
  run: (input: Record<string, unknown>, agent: Agent) => unknown;
}

const num = (v: unknown): number | undefined =>
  v === null || v === undefined || v === "" ? undefined : Number(v);
const str = (v: unknown): string | undefined =>
  v === null || v === undefined ? undefined : String(v);

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
    run: (input) => {
      const c = getContact(Number(input.id));
      if (!c) throw new Error(`Contact ${input.id} not found`);
      return c;
    },
  },
  {
    entity: "contacts",
    level: "write",
    def: {
      name: "create_contact",
      description: "Create a new contact. Check with list_contacts first to avoid duplicates.",
      input_schema: {
        type: "object",
        properties: {
          name: { type: "string" },
          email: { type: "string" },
          phone: { type: "string" },
          company: { type: "string" },
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
      description: "Create a task on the shared task board, optionally assigned to an agent by id.",
      input_schema: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          assignee_agent_id: { type: "integer" },
        },
        required: ["title"],
      },
    },
    run: (input) =>
      createTask({
        title: String(input.title ?? ""),
        description: str(input.description),
        assignee_agent_id: num(input.assignee_agent_id) ?? null,
      }),
  },
  {
    entity: "tasks",
    level: "write",
    def: {
      name: "update_task",
      description: "Update a task's status, result, title, or description.",
      input_schema: {
        type: "object",
        properties: {
          id: { type: "integer" },
          title: { type: "string" },
          description: { type: "string" },
          status: { type: "string", enum: [...TASK_STATUSES] },
          result: { type: "string" },
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
      }),
  },
];

function allowed(agent: Agent, spec: ToolSpec): boolean {
  const level = agent.capabilities[spec.entity];
  if (spec.level === "read") return level === "read" || level === "write";
  return level === "write";
}

/** Tool definitions this agent is allowed to use, given its access rights. */
export function toolsForAgent(agent: Agent): ToolDef[] {
  return TOOL_SPECS.filter((s) => allowed(agent, s)).map((s) => s.def);
}

const MAX_RESULT_CHARS = 6000;

/** Execute one tool call on behalf of an agent, enforcing its access rights. */
export function executeTool(
  agent: Agent,
  name: string,
  input: Record<string, unknown>
): { result: string; ok: boolean } {
  const spec = TOOL_SPECS.find((s) => s.def.name === name);
  if (!spec) return { result: `Unknown tool: ${name}`, ok: false };
  if (!allowed(agent, spec)) {
    return {
      result: `Permission denied: ${agent.name} has "${agent.capabilities[spec.entity]}" access to ${spec.entity}, but ${name} requires "${spec.level}".`,
      ok: false,
    };
  }
  try {
    const out = spec.run(input ?? {}, agent);
    let json = JSON.stringify(out ?? null);
    if (json.length > MAX_RESULT_CHARS) json = json.slice(0, MAX_RESULT_CHARS) + "…(truncated)";
    return { result: json, ok: true };
  } catch (err) {
    return { result: `Error: ${err instanceof Error ? err.message : String(err)}`, ok: false };
  }
}
