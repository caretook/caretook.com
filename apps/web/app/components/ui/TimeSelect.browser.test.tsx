import { useState } from "react";
import { describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { renderInRouter } from "../../../test/device";
import { currentHourTime } from "~/lib/core/timeOfDay";
import { TimeSelect } from "./TimeSelect";

// The hour-first picker: a new time is this hour at :00 in the zone it's given,
// a saved off-grid time survives until changed, and what it submits is "HH:MM".

const submitted = (form: HTMLFormElement | null) => (form ? new FormData(form).get("time") : undefined);
const FORM = () => document.querySelector<HTMLFormElement>("form");
const hour = () => page.getByRole("combobox", { name: "Time hour" });
const minute = () => page.getByRole("combobox", { name: "Time minute" });
const minutes = () => [...minute().element().querySelectorAll("option")].map((o) => o.value);

describe("TimeSelect", () => {
  test("a new picker shows the current hour at :00 and offers 00, 15, 30 and 45", async () => {
    await renderInRouter(
      <form>
        <TimeSelect name="time" label="Time" />
      </form>,
    );
    const now = currentHourTime(Intl.DateTimeFormat().resolvedOptions().timeZone);
    await expect.element(hour()).toHaveValue(now.slice(0, 2));
    await expect.element(minute()).toHaveValue("00");
    expect(minutes()).toEqual(["00", "15", "30", "45"]);
    expect(submitted(FORM())).toBe(now);
  });

  test("the current hour is the zone's it is given, not the device's", async () => {
    await renderInRouter(
      <form>
        <TimeSelect name="time" label="Time" timeZone="Asia/Tokyo" />
      </form>,
    );
    expect(submitted(FORM())).toBe(currentHourTime("Asia/Tokyo"));
  });

  test("a saved 08:10 shows and submits as 08:10 until changed; a new hour keeps its minute", async () => {
    await renderInRouter(
      <form>
        <TimeSelect name="time" label="Time" defaultValue="08:10" />
      </form>,
    );
    await expect.element(minute()).toHaveValue("10");
    expect(minutes()).toEqual(["00", "10", "15", "30", "45"]);
    expect(submitted(FORM())).toBe("08:10");

    await userEvent.selectOptions(hour(), "09");
    expect(submitted(FORM())).toBe("09:10");
    await userEvent.selectOptions(minute(), "15");
    expect(submitted(FORM())).toBe("09:15");
    expect(minutes()).toEqual(["00", "15", "30", "45"]);
  });

  test("an optional one starts empty; an hour sets it at :00; No time clears it", async () => {
    const Controlled = () => {
      const [time, setTime] = useState("");
      return (
        <form>
          <TimeSelect name="time" label="Time" optional value={time} onChange={setTime} />
        </form>
      );
    };
    await renderInRouter(<Controlled />);
    expect(submitted(FORM())).toBe("");
    await expect.element(minute()).toBeDisabled();
    await userEvent.selectOptions(hour(), "17");
    expect(submitted(FORM())).toBe("17:00");
    await userEvent.selectOptions(hour(), "");
    expect(submitted(FORM())).toBe("");
  });

  test("disabled, it submits nothing", async () => {
    await renderInRouter(
      <form>
        <TimeSelect name="time" label="Time" defaultValue="08:00" disabled />
      </form>,
    );
    expect(submitted(FORM())).toBeNull();
  });

  test("both selects fit a narrow field", async () => {
    await renderInRouter(
      <div className="w-44">
        <TimeSelect label="Time" defaultValue="12:45" />
      </div>,
    );
    const box = document.querySelector<HTMLElement>("[data-time-select]")!;
    expect(box.scrollWidth).toBeLessThanOrEqual(box.clientWidth);
  });
});
