import { describe, it, expect } from "vitest";
import { extractBoardSearchStrings, semanticSearch } from "./localRAG";
import { useWhiteboard } from "../whiteboard/store";

describe("extractBoardSearchStrings", () => {
  it("extracts text from diverse whiteboard objects (formulas, mind-maps, tables, quizzes)", () => {
    const mockBoardData = {
      pages: [
        {
          id: "p1",
          objects: [
            { id: "1", kind: "formula", latex: "\\int x^2 dx", solution: "x^3 / 3 + C" },
            { id: "2", kind: "graph", fn: "x^2 - 4", title: "Parabola f(x)" },
            { id: "3", kind: "mind-map", topic: "Photosynthesis", rootNode: { title: "Light Reactions", children: [{ title: "Calvin Cycle" }] } },
            { id: "4", kind: "table", data: [["Time", "Velocity"], ["0", "9.8"]] },
            { id: "5", kind: "quiz", question: "What is ATP?", options: ["Energy", "DNA", "Lipid"] },
            { id: "6", kind: "text", text: "Physics Lecture Notes" },
          ],
        },
      ],
    };

    const strings = extractBoardSearchStrings(mockBoardData);
    const combined = strings.join(" ");

    expect(combined).toContain("\\int x^2 dx");
    expect(combined).toContain("x^3 / 3 + C");
    expect(combined).toContain("y = x^2 - 4");
    expect(combined).toContain("Photosynthesis");
    expect(combined).toContain("Calvin Cycle");
    expect(combined).toContain("Velocity");
    expect(combined).toContain("What is ATP?");
  });
});

describe("semanticSearch with BM25", () => {
  it("returns empty results for empty query", () => {
    expect(semanticSearch("")).toEqual([]);
    expect(semanticSearch("   ")).toEqual([]);
  });

  it("finds board content indexed via extractBoardSearchStrings", () => {
    const wb = useWhiteboard.getState();
    const boardId = "test-search-board";
    wb.boards[boardId] = {
      id: boardId,
      title: "Calculus Board",
      createdAt: 1,
      updatedAt: 1,
      tags: [],
      folderId: null,
      favorite: false,
      archived: false,
    };
    wb.boardData[boardId] = {
      activePageId: "p1",
      pages: [
        {
          id: "p1",
          background: "white",
          objects: [
            { id: "o1", kind: "formula", latex: "E = mc^2", label: "mass-energy equivalence", x: 0, y: 0, w: 100, h: 50 },
          ],
        },
      ],
    };

    const results = semanticSearch("equivalence");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].title).toBe("Calculus Board");
    expect(results[0].snippet).toContain("equivalence");
  });
});
