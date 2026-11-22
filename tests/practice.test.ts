import { describe, expect, it } from "vitest";
import { FeedbackResult, appendHistory, loadHistory, parseRubric } from "../src/practice";

const RUBRIC_JSON = JSON.stringify({
  formatVersion: "1.0",
  kind: "ffrubric",
  assignment: {
    title: "Essay 1 - Critical Analysis",
    description: "Analyse the assigned text.",
    maxDrafts: 3,
  },
  rubric: {
    categories: [
      { name: "Argument", description: "Thesis quality", weight: 40 },
      { name: "Evidence", description: "Use of sources", weight: 60 },
    ],
  },
});

describe("parseRubric", () => {
  it("accepts a valid .ffrubric payload", () => {
    const rubric = parseRubric(RUBRIC_JSON);
    expect(rubric.assignment.title).toBe("Essay 1 - Critical Analysis");
    expect(rubric.rubric.categories).toHaveLength(2);
  });

  it("rejects non-ffrubric JSON", () => {
    expect(() => parseRubric('{"kind":"other"}')).toThrow("Not a .ffrubric file");
  });

  it("rejects invalid JSON", () => {
    expect(() => parseRubric("not json")).toThrow();
  });

  it("rejects a rubric with no categories", () => {
    const noCats = JSON.parse(RUBRIC_JSON);
    noCats.rubric.categories = [];
    expect(() => parseRubric(JSON.stringify(noCats))).toThrow("Rubric has no categories");
  });
});

const result = (score: number): FeedbackResult => ({
  overall: { score, level: { label: "On the board", color: "amber" } },
  overall_feedback: "ok",
  categories: [],
  runs: 1,
  failed_runs: 0,
  word_count: 100,
});

describe("history", () => {
  it("returns [] when nothing is stored or the blob is corrupt", () => {
    expect(loadHistory(parseRubric(RUBRIC_JSON))).toEqual([]);
    localStorage.setItem("ffd-history2:Essay 1 - Critical Analysis", "{oops");
    expect(loadHistory(parseRubric(RUBRIC_JSON))).toEqual([]);
  });

  it("keys history per course so same-titled assignments don't collide", () => {
    const eng = parseRubric(JSON.stringify({ ...JSON.parse(RUBRIC_JSON), source: { courseCode: "ENG101" } }));
    const his = parseRubric(JSON.stringify({ ...JSON.parse(RUBRIC_JSON), source: { courseCode: "HIS202" } }));
    appendHistory(eng, result(90));
    appendHistory(eng, result(80));
    expect(loadHistory(eng)).toHaveLength(2);
    expect(loadHistory(his)).toHaveLength(0);
  });

  it("caps stored history at 20 entries", () => {
    const rubric = parseRubric(RUBRIC_JSON);
    let entries: ReturnType<typeof loadHistory> = [];
    for (let i = 0; i < 25; i++) entries = appendHistory(rubric, result(i));
    expect(entries).toHaveLength(20);
    expect(entries[entries.length - 1].overallScore).toBe(24);
  });
});
