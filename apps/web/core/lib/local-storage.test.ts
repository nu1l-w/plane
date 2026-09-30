import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getValueFromLocalStorage as getSharedValue, setValueIntoLocalStorage as setSharedValue } from "@plane/hooks";
import { getValueFromLocalStorage, setValueIntoLocalStorage } from "../hooks/use-local-storage";
import { storage } from "./local-storage";

let values: Map<string, string>;
let localStorage: Pick<Storage, "getItem" | "setItem" | "removeItem">;

beforeEach(() => {
  values = new Map();
  localStorage = {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      values.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      values.delete(key);
    }),
  };
  vi.stubGlobal("window", { localStorage });
});

afterEach(() => vi.unstubAllGlobals());

describe("raw local storage", () => {
  it.each([false, "", {}, []])("persists %j instead of leaving stale preferences", (value) => {
    values.set("preference", "stale");
    storage.set("preference", value);
    expect(storage.get("preference")).toBe(typeof value === "string" ? value : JSON.stringify(value));
  });

  it("is safe during server rendering", () => {
    vi.stubGlobal("window", undefined);
    expect(storage.get("preference")).toBeUndefined();
    expect(() => storage.set("preference", true)).not.toThrow();
    expect(() => storage.remove("preference")).not.toThrow();
  });

  it("does not crash when storage access is forbidden", () => {
    vi.stubGlobal("window", {
      get localStorage() {
        throw new Error("SecurityError");
      },
    });
    expect(storage.get("preference")).toBeUndefined();
    expect(() => storage.set("preference", true)).not.toThrow();
    expect(() => storage.remove("preference")).not.toThrow();
  });

  it("does not crash when the storage quota is exhausted", () => {
    vi.mocked(localStorage.setItem).mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    expect(() => storage.set("preference", true)).not.toThrow();
  });
});

describe.each([
  ["web", getValueFromLocalStorage, setValueIntoLocalStorage],
  ["shared", getSharedValue, setSharedValue],
] as const)("%s JSON storage", (_name, getValue, setValue) => {
  it("returns the default during server rendering", () => {
    vi.stubGlobal("window", undefined);
    expect(getValue("preference", false)).toBe(false);
    expect(setValue("preference", true)).toBe(false);
  });

  it("round-trips false", () => {
    expect(setValue("preference", false)).toBe(true);
    expect(getValue("preference", true)).toBe(false);
  });

  it("removes corrupted JSON and falls back to the default", () => {
    values.set("preference", "{invalid");
    expect(getValue("preference", true)).toBe(true);
    expect(values.has("preference")).toBe(false);
  });

  it("still falls back when corrupted JSON cannot be removed", () => {
    values.set("preference", "{invalid");
    vi.mocked(localStorage.removeItem).mockImplementation(() => {
      throw new Error("SecurityError");
    });
    expect(getValue("preference", true)).toBe(true);
  });

  it("handles a forbidden localStorage getter", () => {
    vi.stubGlobal("window", {
      get localStorage() {
        throw new Error("SecurityError");
      },
    });
    expect(getValue("preference", true)).toBe(true);
    expect(setValue("preference", false)).toBe(false);
  });

  it("reports write failure without throwing", () => {
    vi.mocked(localStorage.setItem).mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    expect(setValue("preference", true)).toBe(false);
  });
});
