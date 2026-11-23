import { userEvent } from "vitest/browser";
import { found } from "./found";

/** Set a `TimeSelect` to "HH:MM", through its two selects; `named` is its hidden, named input. */
export async function pickTime(named: () => HTMLInputElement | null | undefined, time: string) {
  const [hour = "", minute = ""] = time.split(":");
  const selects = () => named()?.closest("[data-time-select]")?.querySelectorAll("select");
  await userEvent.selectOptions(await found(() => selects()?.[0]), hour);
  await userEvent.selectOptions(await found(() => selects()?.[1]), minute);
}
