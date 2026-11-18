import { z } from "zod";

/** An app path for a link: starts with one "/", so it can't leave APP_URL. */
export const appPathZ = z.string().regex(/^\/(?!\/)/, "An app path starting with /");

/** A token or code from Better Auth: URL-safe characters only. */
export const tokenZ = z
  .string()
  .min(1)
  .max(2000)
  .regex(/^[A-Za-z0-9._~-]+$/, "A URL-safe token");

/** How a greeting starts: the name when there is one. */
export const greeting = (name: string | undefined) => (name?.trim() ? `Hi ${name.trim()},` : "Hi,");
