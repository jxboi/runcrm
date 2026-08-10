export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error((body as { error?: string } | null)?.error ?? `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export function fmtMoney(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function fmtClock(time: string): string {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) return time;

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return time;

  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${match[2]} ${suffix}`;
}

export function fmtTime(sqliteUtc: string): string {
  const date = parseMessageDate(sqliteUtc);
  if (isNaN(date.getTime())) return sqliteUtc;
  const datePart = date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
  });
  const timePart = date.toLocaleString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return `${datePart}, ${timePart}`;
}

export function parseMessageDate(sqliteUtc: string): Date {
  const normalized = sqliteUtc.includes("T") ? sqliteUtc : sqliteUtc.replace(" ", "T");
  const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized);
  return new Date(hasTimezone ? normalized : `${normalized}Z`);
}

export function fmtMessageTime(sqliteUtc: string): string {
  const date = parseMessageDate(sqliteUtc);
  if (isNaN(date.getTime())) return sqliteUtc;
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

export function isSameMessageDay(a: string, b: string): boolean {
  const first = parseMessageDate(a);
  const second = parseMessageDate(b);
  if (isNaN(first.getTime()) || isNaN(second.getTime())) return a.slice(0, 10) === b.slice(0, 10);
  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  );
}

export function fmtMessageDate(sqliteUtc: string, now = new Date()): string {
  const date = parseMessageDate(sqliteUtc);
  if (isNaN(date.getTime())) return sqliteUtc;

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayDifference = Math.round((startOfToday.getTime() - startOfDate.getTime()) / 86_400_000);

  if (dayDifference === 0) return "Today";
  if (dayDifference === 1) return "Yesterday";
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: date.getFullYear() === now.getFullYear() ? undefined : "numeric",
  });
}
