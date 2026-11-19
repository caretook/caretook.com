import { describe, expect, it } from "vitest";
import {
  CARING_FOR,
  CARING_FOR_LABELS,
  CONTACT_TOPIC_LABELS,
  CONTACT_TOPICS,
  MIN_FORM_MS,
  spamVerdict,
} from "./publicFormRules";
import { contactSendZSchema, waitlistJoinZSchema } from "./publicForms";

const human = { elapsedMs: MIN_FORM_MS + 500 };

const issuesOf = (result: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }) =>
  (result.error?.issues ?? []).map((i) => i.path.join("."));

describe("spamVerdict", () => {
  it("passes a person: no honeypot, long enough on the page", () => {
    expect(spamVerdict({ website: "", elapsedMs: MIN_FORM_MS })).toBe("ok");
    expect(spamVerdict({ elapsedMs: 60_000 })).toBe("ok");
  });

  it("catches a filled honeypot, even when slow", () => {
    expect(spamVerdict({ website: "https://spam.example", elapsedMs: 60_000 })).toBe("honeypot");
    expect(spamVerdict({ website: "   ", elapsedMs: 60_000 })).toBe("ok");
  });

  it("catches a submit faster than the minimum, or one with no time", () => {
    expect(spamVerdict({ elapsedMs: MIN_FORM_MS - 1 })).toBe("tooFast");
    expect(spamVerdict({ elapsedMs: 0 })).toBe("tooFast");
    expect(spamVerdict({})).toBe("tooFast");
    expect(spamVerdict({ elapsedMs: Number.NaN })).toBe("tooFast");
  });

  it("takes another minimum", () => {
    expect(spamVerdict({ elapsedMs: 100 }, 50)).toBe("ok");
  });
});

describe("waitlistJoinZSchema", () => {
  it("needs only an email, and stores it trimmed and lowercased", () => {
    const parsed = waitlistJoinZSchema.parse({ email: "  Robin.Example@Example.COM ", ...human });
    expect(parsed).toMatchObject({ email: "robin.example@example.com" });
    expect(parsed.firstName).toBeUndefined();
    expect(parsed.caringFor).toBeUndefined();
  });

  it("turns the form's blanks into nothing", () => {
    const parsed = waitlistJoinZSchema.parse({
      email: "a@example.com",
      firstName: "  ",
      caringFor: "",
      heardFrom: "",
      ...human,
    });
    expect(parsed.firstName).toBeUndefined();
    expect(parsed.caringFor).toBeUndefined();
    expect(parsed.heardFrom).toBeUndefined();
  });

  it("keeps the optional context and the source", () => {
    const parsed = waitlistJoinZSchema.parse({
      email: "a@example.com",
      firstName: " Robin ",
      caringFor: "parent",
      heardFrom: "A friend",
      source: { page: "/", utmSource: "newsletter" },
      ...human,
    });
    expect(parsed).toMatchObject({
      firstName: "Robin",
      caringFor: "parent",
      heardFrom: "A friend",
      source: { page: "/", utmSource: "newsletter" },
    });
  });

  it("refuses a bad email, an unknown relation and a long 'how you heard'", () => {
    const result = waitlistJoinZSchema.safeParse({
      email: "not an email",
      caringFor: "cousin",
      heardFrom: "x".repeat(201),
    });
    expect(issuesOf(result).sort()).toEqual(["caringFor", "email", "heardFrom"]);
  });

  it("names every relation the form offers", () => {
    expect(Object.keys(CARING_FOR_LABELS)).toEqual([...CARING_FOR]);
  });
});

describe("contactSendZSchema", () => {
  const valid = { name: "Robin", email: "Robin@Example.com", topic: "privacy", message: " Hello " };

  it("accepts a full message, trimmed, with the email lowercased", () => {
    expect(contactSendZSchema.parse({ ...valid, ...human })).toMatchObject({
      name: "Robin",
      email: "robin@example.com",
      topic: "privacy",
      message: "Hello",
    });
  });

  it("requires every field, with a message for each", () => {
    const result = contactSendZSchema.safeParse({ name: " ", email: "", topic: "", message: "" });
    expect(issuesOf(result).sort()).toEqual(["email", "message", "name", "topic"]);
    expect(result.error?.issues.every((i) => i.message.length > 0)).toBe(true);
  });

  it("caps the message at 5,000 characters", () => {
    expect(contactSendZSchema.safeParse({ ...valid, message: "x".repeat(5000) }).success).toBe(true);
    expect(issuesOf(contactSendZSchema.safeParse({ ...valid, message: "x".repeat(5001) }))).toEqual([
      "message",
    ]);
  });

  it("names every topic", () => {
    expect(Object.keys(CONTACT_TOPIC_LABELS)).toEqual([...CONTACT_TOPICS]);
  });
});
