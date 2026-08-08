import {
  Bot,
  Brain,
  BriefcaseBusiness,
  ChartNoAxesColumnIncreasing,
  Clock3,
  Compass,
  Megaphone,
  ReceiptText,
  Search,
  Sprout,
  Trash2,
  UserRound,
  Workflow,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";

export const AGENT_ICON_OPTIONS: ReadonlyArray<{ key: string; label: string; Icon: LucideIcon }> = [
  { key: "bot", label: "General", Icon: Bot },
  { key: "briefcase", label: "Sales", Icon: BriefcaseBusiness },
  { key: "chart", label: "Analytics", Icon: ChartNoAxesColumnIncreasing },
  { key: "brain", label: "Strategy", Icon: Brain },
  { key: "zap", label: "Automation", Icon: Zap },
  { key: "search", label: "Research", Icon: Search },
  { key: "megaphone", label: "Outreach", Icon: Megaphone },
  { key: "wrench", label: "Operations", Icon: Wrench },
  { key: "receipt", label: "Finance", Icon: ReceiptText },
  { key: "sprout", label: "Growth", Icon: Sprout },
];

const AGENT_ICON_KEYS = new Set([
  ...AGENT_ICON_OPTIONS.map((option) => option.key),
  "workflow",
  "compass",
  "trash",
  "clock",
  "user",
]);

export function agentIconKey(icon: string | null | undefined, name: string | null | undefined): string {
  if (icon && AGENT_ICON_KEYS.has(icon)) return icon;

  const normalizedName = name?.toLowerCase() ?? "";
  if (normalizedName.includes("workflow") || normalizedName.includes("architect")) return "workflow";
  if (normalizedName.includes("analyst") || normalizedName.includes("data")) return "chart";
  if (normalizedName.includes("sales")) return "briefcase";
  if (normalizedName.includes("research")) return "search";
  if (normalizedName.includes("janitor") || normalizedName.includes("cleanup")) return "trash";
  if (normalizedName.includes("renewal") || normalizedName.includes("watchdog")) return "clock";
  if (normalizedName.includes("coordinator")) return "compass";
  if (normalizedName.includes("growth")) return "sprout";
  return "bot";
}

export function AgentIcon({
  icon,
  name,
  className = "h-4 w-4",
}: {
  icon?: string | null;
  name?: string | null;
  className?: string;
}) {
  const key = agentIconKey(icon, name);
  const props = { "aria-hidden": true as const, className, strokeWidth: 1.8 };
  if (key === "briefcase") return <BriefcaseBusiness {...props} />;
  if (key === "chart") return <ChartNoAxesColumnIncreasing {...props} />;
  if (key === "brain") return <Brain {...props} />;
  if (key === "zap") return <Zap {...props} />;
  if (key === "search") return <Search {...props} />;
  if (key === "megaphone") return <Megaphone {...props} />;
  if (key === "wrench") return <Wrench {...props} />;
  if (key === "receipt") return <ReceiptText {...props} />;
  if (key === "sprout") return <Sprout {...props} />;
  if (key === "workflow") return <Workflow {...props} />;
  if (key === "compass") return <Compass {...props} />;
  if (key === "trash") return <Trash2 {...props} />;
  if (key === "clock") return <Clock3 {...props} />;
  if (key === "user") return <UserRound {...props} />;
  return <Bot {...props} />;
}
