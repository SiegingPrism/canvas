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

  it("restores emergency backup boards from slate_b_<id>", () => {
    const mockBoardData = {
      pages: [{ id: "p1", objects: [], background: "white" as const }],
      activePageId: "p1",
    };
    const store: Record<string, string> = {
      slate_b_emerg123: JSON.stringify(mockBoardData),
    };
    const mockLocalStorage = {
      get length() {
        return Object.keys(store).length;
      },
      key: (i: number) => Object.keys(store)[i] || null,
      getItem: (k: string) => store[k] || null,
      setItem: (k: string, v: string) => {
        store[k] = v;
      },
      removeItem: (k: string) => {
        delete store[k];
      },
    };

    (globalThis as any).window = globalThis;
    (globalThis as any).localStorage = mockLocalStorage;

    const initial = loadInitialSync();
    expect(initial.boardData["emerg123"]).toEqual(mockBoardData);

    delete (globalThis as any).window;
  });
});
