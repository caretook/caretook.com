import { describe, expect, it, vi } from "vitest";
import { appUrls } from "../../../../lib/appUrls";
import { shareLink, shareUrl } from "./share";

const data = { title: "Cardiology visit", url: `https://caretook.com${appUrls.entry("g", "e")}` };
const abort = () => Object.assign(new Error("Share canceled"), { name: "AbortError" });
const notAllowed = () =>
  Object.assign(new Error("Must be handling a user gesture"), { name: "NotAllowedError" });

describe("shareUrl", () => {
  it("joins the web origin and the entry's path", () => {
    expect(shareUrl("https://caretook.com", appUrls.entry("g", "e"))).toBe(data.url);
    expect(shareUrl("http://localhost:5173/", appUrls.home())).toBe("http://localhost:5173/app");
  });
});

describe("shareLink", () => {
  it("uses the share sheet when there is one", async () => {
    const share = vi.fn(() => Promise.resolve());
    const writeText = vi.fn(() => Promise.resolve());
    expect(await shareLink({ share, clipboard: { writeText } }, data)).toBe("shared");
    expect(share).toHaveBeenCalledWith(data);
    expect(writeText).not.toHaveBeenCalled();
  });

  it("says nothing when the share sheet is dismissed", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    const share = () => Promise.reject(abort());
    expect(await shareLink({ share, clipboard: { writeText } }, data)).toBe("cancelled");
    expect(writeText).not.toHaveBeenCalled();
  });

  it("copies the link when the share sheet refuses", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    const share = () => Promise.reject(notAllowed());
    expect(await shareLink({ share, clipboard: { writeText } }, data)).toBe("copied");
    expect(writeText).toHaveBeenCalledWith(data.url);
  });

  it("copies the link when the data can't be shared", async () => {
    const share = vi.fn(() => Promise.resolve());
    const writeText = vi.fn(() => Promise.resolve());
    expect(await shareLink({ share, canShare: () => false, clipboard: { writeText } }, data)).toBe("copied");
    expect(share).not.toHaveBeenCalled();
  });

  it("copies the link without a share sheet", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    expect(await shareLink({ clipboard: { writeText } }, data)).toBe("copied");
    expect(writeText).toHaveBeenCalledWith(data.url);
  });

  it("fails when neither works", async () => {
    expect(await shareLink({}, data)).toBe("failed");
    const writeText = () => Promise.reject(new Error("denied"));
    expect(await shareLink({ clipboard: { writeText } }, data)).toBe("failed");
  });
});
