import { devMailSchema, getDb } from "@caretook/data";
import { desc, eq } from "drizzle-orm";

// Reads for the dev mailbox (`/dev/mail`). The route refuses production;
// these only read what the `log` sender stored.

export type DevMailMessage = {
  id: string;
  name: string;
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  links: string[];
  createdAt: string;
};

/** Every distinct http(s) link in an email's HTML, in order. */
export const extractLinks = (html: string) => {
  const links = [...html.matchAll(/href="(https?:\/\/[^"]+)"/g)].map((m) =>
    (m[1] ?? "").replaceAll("&amp;", "&"),
  );
  return [...new Set(links)];
};

const toMessage = (row: typeof devMailSchema.$inferSelect): DevMailMessage => ({
  id: row.id,
  name: row.name,
  from: row.sender,
  to: row.recipient,
  subject: row.subject,
  html: row.html,
  text: row.text,
  links: extractLinks(row.html),
  createdAt: new Date(row.createdAt).toISOString(),
});

/** Newest first; `to` filters by recipient (case-insensitive). */
export const listDevMail = async ({ to, limit = 50 }: { to?: string; limit?: number } = {}) => {
  const rows = await getDb()
    .select()
    .from(devMailSchema)
    .where(to ? eq(devMailSchema.recipient, to.trim()) : undefined)
    .orderBy(desc(devMailSchema.createdAt), desc(devMailSchema.id))
    .limit(Math.min(Math.max(limit, 1), 200));
  return rows.map(toMessage);
};

export const getDevMail = async (id: string) => {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await getDb().select().from(devMailSchema).where(eq(devMailSchema.id, id));
  return row ? toMessage(row) : null;
};
