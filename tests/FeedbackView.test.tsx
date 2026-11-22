import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FeedbackView } from "../src/components/FeedbackView";
import { FeedbackResult, HistoryEntry } from "../src/practice";

const RESULT: FeedbackResult = {
  overall: { score: 77.2, level: { label: "On the board", color: "amber" } },
  overall_feedback: "A solid draft with a clear thesis.",
  categories: [
    {
      name: "Argument",
      weight: 40,
      score: 82,
      level: { label: "Closing in", color: "teal" },
      feedback: "Clear thesis.",
      strengths: ["Focus"],
      improvements: ["Add a counter-argument"],
      runs: 2,
    },
    {
      name: "Evidence",
      weight: 60,
      score: 74,
      level: { label: "On the board", color: "amber" },
      feedback: "Quotes are summarised, not analysed.",
      strengths: [],
      improvements: ["Analyse quotes"],
      runs: 2,
    },
  ],
  runs: 2,
  failed_runs: 0,
  word_count: 250,
};

describe("FeedbackView", () => {
  it("renders the overall level and per-category feedback", () => {
    render(<FeedbackView result={RESULT} history={[]} />);
    // the overall heading shows the level; category chips show their own
    expect(screen.getByRole("heading", { level: 2, name: "On the board" })).toBeTruthy();
    expect(screen.getByText("Closing in")).toBeTruthy(); // Argument level chip
    expect(screen.getByText("Argument")).toBeTruthy();
    expect(screen.getByText("Clear thesis.")).toBeTruthy();
    expect(screen.getByText("Focus")).toBeTruthy();
    expect(screen.getByText("Analyse quotes")).toBeTruthy();
    expect(screen.getByText(/2 model runs/)).toBeTruthy();
  });

  it("hides numeric scores until the reader opts in", () => {
    render(<FeedbackView result={RESULT} history={[]} />);
    expect(screen.queryByText(/82\/100/)).toBeNull();
    fireEvent.click(screen.getByRole("checkbox"));
    expect(screen.getByText(/82\/100/)).toBeTruthy();
  });

  it("renders one mini bullseye per past draft", () => {
    const history: HistoryEntry[] = [
      { ts: 1, overallScore: 60, levelLabel: "Finding the range" },
      { ts: 2, overallScore: 70, levelLabel: "On the board" },
      { ts: 3, overallScore: 85, levelLabel: "Closing in" },
    ];
    render(<FeedbackView result={RESULT} history={history} />);
    expect(screen.getByText("#1")).toBeTruthy();
    expect(screen.getByText("#3")).toBeTruthy();
    expect(screen.getByText("Your aim across drafts")).toBeTruthy();
  });
});
