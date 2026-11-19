import { describe, expect, it } from "vitest";
import { csvField, toCsv, WAITLIST_CSV_HEADER, waitlistCsv, waitlistCsvFileName } from "./waitlistCsv";

describe("csvField", () => {
  it("leaves plain text as it is", () => {
    expect(csvField("Robin")).toBe("Robin");
    expect(csvField("José ❤️")).toBe("José ❤️");
  });

  it("writes nothing for a missing value", () => {
    expect(csvField(null)).toBe("");
    expect(csvField(undefined)).toBe("");
    expect(csvField("")).toBe("");
  });

  it("quotes commas, quotes and line breaks, doubling quotes", () => {
    expect(csvField("Smith, Robin")).toBe('"Smith, Robin"');
    expect(csvField('My "aunt"')).toBe('"My ""aunt"""');
    expect(csvField("line one\nline two")).toBe('"line one\nline two"');
    expect(csvField("a\r\nb")).toBe('"a\r\nb"');
  });

  it("keeps a spreadsheet from running a cell as a formula", () => {
    expect(csvField("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvField("+1")).toBe("'+1");
    expect(csvField("-2")).toBe("'-2");
    expect(csvField("@cmd")).toBe("'@cmd");
    expect(csvField("=1,2")).toBe(`"'=1,2"`);
    expect(csvField("a=b")).toBe("a=b");
  });
});

describe("toCsv", () => {
  it("joins cells with commas and ends every row with CRLF", () => {
    expect(
      toCsv([
        ["a", "b"],
        ["c", null],
      ]),
    ).toBe("a,b\r\nc,\r\n");
    expect(toCsv([])).toBe("");
  });
});

describe("waitlistCsv", () => {
  const entry = {
    email: "robin@example.com",
    firstName: 'Robin "Bird", Jr.',
    caringFor: "parent" as const,
    heardFrom: "A friend,\nat church",
    source: { page: "/", utmSource: "newsletter", utmCampaign: "fall" },
    createdAt: "2026-11-17T21:45:25.229Z",
  };

  it("starts with a byte order mark and the header, then one row per entry in order", () => {
    const csv = waitlistCsv([entry, { ...entry, email: "sam@example.com", caringFor: null, source: null }]);
    expect(csv.startsWith("﻿")).toBe(true);
    const text = csv.slice(1);
    expect(text.startsWith(WAITLIST_CSV_HEADER.join(",") + "\r\n")).toBe(true);
    expect(text).toBe(
      WAITLIST_CSV_HEADER.join(",") +
        "\r\n" +
        '2026-11-17T21:45:25.229Z,robin@example.com,"Robin ""Bird"", Jr.",A parent,"A friend,\nat church",/,newsletter,,fall,,\r\n' +
        '2026-11-17T21:45:25.229Z,sam@example.com,"Robin ""Bird"", Jr.",,"A friend,\nat church",,,,,,\r\n',
    );
  });

  it("is just the header for no entries", () => {
    expect(waitlistCsv([])).toBe("﻿" + WAITLIST_CSV_HEADER.join(",") + "\r\n");
  });

  it("names the file by the UTC date", () => {
    expect(waitlistCsvFileName(new Date("2026-11-18T23:30:00Z"))).toBe("caretook-waitlist-2026-11-18.csv");
  });
});
