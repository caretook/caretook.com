import { formString } from "../../../../../lib/core/form";

// The Passes screen's posts, read from the form: add, edit (rename or
// retime), move up or down, delete. Pure; web:unit tests it.

export const PASS_FIELD = {
  intent: "intent",
  passId: "passId",
  name: "name",
  time: "time",
  direction: "direction",
} as const;

export type PassAction =
  | { intent: "create"; name: string; time: string }
  | { intent: "update"; passId: string; name: string; time: string }
  | { intent: "move"; passId: string; direction: "up" | "down" }
  | { intent: "remove"; passId: string };

/** What a post asks for, or null when it's not one of the screen's. */
export const passActionFromForm = (form: FormData): PassAction | null => {
  const intent = formString(form, PASS_FIELD.intent);
  const passId = formString(form, PASS_FIELD.passId);
  const name = formString(form, PASS_FIELD.name);
  const time = formString(form, PASS_FIELD.time).trim();
  if (intent === "create") return { intent, name, time };
  if (!passId) return null;
  if (intent === "update") return { intent, passId, name, time };
  if (intent === "remove") return { intent, passId };
  if (intent === "move") {
    const direction = formString(form, PASS_FIELD.direction);
    return direction === "up" || direction === "down" ? { intent, passId, direction } : null;
  }
  return null;
};
