import { Agent } from "../types";

/** At most this many agents answer one message, so a stray "@" can't fan out. */
export const MAX_RECIPIENTS = 3;

/** Compare names loosely: "@Sales Assistant" and "@SalesAssistant" are the same agent. */
export function nameKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * An "@" that starts a word, then the longest run of name-ish characters after
 * it. Anchoring to a word start keeps email addresses from parsing as mentions.
 */
export const MENTION_PATTERN = /(?:^|\s)@([\p{L}\p{N}][\p{L}\p{N} _-]*)/gu;

/**
 * Resolve "@Name" mentions in a message to agents, in the order they appear.
 * Longer agent names are tried first so "@Sales Assistant" beats a hypothetical
 * agent called "Sales".
 *
 * Pure and dependency-free — the composer imports this too.
 */
export function parseMentions(content: string, agents: Agent[]): number[] {
  const byLength = [...agents].sort((a, b) => b.name.length - a.name.length);
  const ids: number[] = [];

  for (const match of content.matchAll(MENTION_PATTERN)) {
    const candidate = nameKey(match[1]);
    const agent = byLength.find((a) => candidate.startsWith(nameKey(a.name)));
    if (agent && !ids.includes(agent.id)) ids.push(agent.id);
  }

  return ids.slice(0, MAX_RECIPIENTS);
}
