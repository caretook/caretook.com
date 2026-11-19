import { z } from "zod";

/** A valid IANA time zone name, as the runtime understands it. */
export const isTimeZone = (value: string) => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
};

/** An IANA time zone name ("America/Los_Angeles"). */
export const timeZoneZSchema = z.string().refine(isTimeZone, { message: "Unknown time zone" });
