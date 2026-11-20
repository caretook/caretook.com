import { describe, expect, it } from "vitest";

import { parseTheme, THEME_KEY, THEME_SCRIPT } from "./theme";

describe("parseTheme", () => {
  it("keeps light and dark", () => {
    expect(parseTheme("light")).toBe("light");
    expect(parseTheme("dark")).toBe("dark");
  });

  it("falls back to system for anything else", () => {
    for (const v of [null, undefined, "", "system", "Dark", "sepia", 1]) expect(parseTheme(v)).toBe("system");
  });
});

describe("THEME_SCRIPT", () => {
  const run = (stored: string | null, throws = false) => {
    const dataset: Record<string, string> = {};
    const localStorage = {
      getItem: (key: string) => {
        if (throws) throw new Error("denied");
        return key === THEME_KEY ? stored : null;
      },
    };
    const document = { documentElement: { dataset } };
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const script = new Function("localStorage", "document", THEME_SCRIPT) as (s: unknown, d: unknown) => void;
    script(localStorage, document);
    return dataset.theme;
  };

  it("applies a saved light or dark theme", () => {
    expect(run("dark")).toBe("dark");
    expect(run("light")).toBe("light");
  });

  it("leaves System (no attribute) for nothing or an unknown value", () => {
    expect(run(null)).toBeUndefined();
    expect(run("sepia")).toBeUndefined();
  });

  it("survives storage that throws", () => {
    expect(run("dark", true)).toBeUndefined();
  });
});
