import { describe, expect, it } from "vitest";
import { normalizeEventValue } from "../src/modules/blockchain/eventValueNormalizer.js";

describe("normalizeEventValue", () => {
  it("converts bigints recursively into JSON-safe strings", () => {
    const normalized = normalizeEventValue({
      amount: 10n,
      nested: [1n, { total: 2n }],
      ok: true,
      note: "value"
    });

    expect(normalized).toEqual({
      amount: "10",
      nested: ["1", { total: "2" }],
      ok: true,
      note: "value"
    });
  });

  it("returns null for unsupported runtime values", () => {
    expect(normalizeEventValue(undefined)).toBeNull();
    expect(normalizeEventValue(() => "x")).toBeNull();
  });
});
