import { describe, expect, it } from "vitest";
import { normalizePage, pageRange, totalPages } from "@/lib/pagination";

describe("profile campaign pagination", () => {
  it("normalizes unsafe query values", () => {
    expect(normalizePage(undefined)).toBe(1);
    expect(normalizePage("-2")).toBe(1);
    expect(normalizePage("not-a-page")).toBe(1);
    expect(normalizePage(["3", "9"])).toBe(3);
  });

  it("calculates non-overlapping six-item ranges", () => {
    expect(pageRange(1)).toEqual({ from: 0, to: 5 });
    expect(pageRange(2)).toEqual({ from: 6, to: 11 });
  });

  it("keeps lifetime totals independent from page size", () => {
    expect(totalPages(0)).toBe(1);
    expect(totalPages(6)).toBe(1);
    expect(totalPages(7)).toBe(2);
    expect(totalPages(19)).toBe(4);
  });
});
