import { describe, it, expect } from "vitest";
import { emptyMetaShape, emptyFullPersist, loadInitialSync } from "./slateStorage";

describe("slateStorage", () => {
  it("initializes empty meta shape with required fields", () => {
    const meta = emptyMetaShape();
    expect(meta.boards).toEqual({});
    expect(meta.boardOrder).toEqual([]);
    expect(meta.folders).toEqual([]);
    expect(meta.recentAI).toEqual([]);
  });

  it("initializes full persist shape including boardData", () => {
    const full = emptyFullPersist();
    expect(full.boardData).toEqual({});
    expect(full.boards).toEqual({});
  });

  it("loads gracefully even when localStorage is empty", () => {
    const initial = loadInitialSync();
    expect(initial).toBeDefined();
    expect(typeof initial.boards).toBe("object");
  });
});
