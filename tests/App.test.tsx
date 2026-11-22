import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../src/App";
import { ApiResponse } from "../global";
import { RUN_SETTINGS } from "../src/practice";
import { lens } from "./setup";

const api = vi.mocked(lens.api);

const RUBRIC = {
  kind: "ffrubric",
  formatVersion: "1.0",
  assignment: { title: "Essay 1 - Critical Analysis" },
  rubric: { categories: [{ name: "Argument", weight: 40 }, { name: "Evidence", weight: 60 }] },
};

const RESULT = {
  overall: { score: 77.2, level: { label: "On the board", color: "amber" } },
  overall_feedback: "Solid draft.",
  categories: [
    {
      name: "Argument",
      weight: 40,
      score: 82,
      level: { label: "Closing in", color: "teal" },
      feedback: "Clear thesis.",
      strengths: [],
      improvements: [],
      runs: 2,
    },
  ],
  runs: 2,
  failed_runs: 0,
  word_count: 120,
};

// Drive the app like a student: open a rubric file, paste a draft, pick a
// model, run. Poll responses are controlled through the lens.api mock.
// (jsdom's File may lack .text(); real Chromium always has it.)
function makeFile(name: string, content: string): File {
  const f = new File([content], name, { type: "application/json" });
  return Object.assign(f, { text: async () => content });
}

async function prepareDraft() {
  const rubricFile = makeFile("r.ffrubric", JSON.stringify(RUBRIC));
  const fileInput = document.querySelector<HTMLInputElement>(
    'input[type="file"][accept=".ffrubric,.json"]',
  )!;
  fireEvent.change(fileInput, { target: { files: [rubricFile] } });
  await screen.findByText("Essay 1 - Critical Analysis");

  fireEvent.change(screen.getByPlaceholderText(/Paste your draft here/), {
    target: { value: "My draft text with a thesis and some evidence." },
  });
  fireEvent.change(screen.getByPlaceholderText("llama3.2:3b"), {
    target: { value: "mock-model" },
  });
  const button = screen.getByRole("button", { name: "Get practice feedback" }) as HTMLButtonElement;
  expect(button.disabled).toBe(false);
  return button;
}

describe("App feedback flow", () => {
  let pollCount = 0;

  beforeEach(() => {
    pollCount = 0;
    api.mockImplementation(async (method: string, path: string): Promise<ApiResponse> => {
      if (method === "POST" && path === "/practice/feedback")
        return { status: 202, body: { id: "job1", status: "running" } };
      if (method === "GET" && path === "/practice/feedback/job1") {
        if (pollCount < 1) {
          pollCount++;
          return { status: 200, body: { status: "running" } };
        }
        return { status: 200, body: { status: "done", result: RESULT } };
      }
      return { status: 200, body: {} };
    });
  });

  it("runs a job end-to-end: 202 -> poll -> done -> feedback view + history", async () => {
    render(<App />);
    fireEvent.click(await prepareDraft());

    // poll interval is 1500ms real time
    const heading = await screen.findByRole("heading", { level: 2, name: "On the board" }, { timeout: 6000 });
    expect(heading).toBeTruthy();
    expect(screen.getByText(/2 model runs/)).toBeTruthy();

    const stored = JSON.parse(
      localStorage.getItem("ffd-history2:Essay 1 - Critical Analysis") ?? "[]",
    );
    expect(stored).toHaveLength(1);
    expect(stored[0].overallScore).toBe(77.2);
  });

  it("surfaces an engine rejection (non-202) as an error, not a stuck spinner", async () => {
    api.mockImplementation(async (method: string): Promise<ApiResponse> =>
      method === "POST" ? { status: 400, body: { detail: "bad rubric" } } : { status: 200, body: {} },
    );
    render(<App />);
    fireEvent.click(await prepareDraft());
    expect(await screen.findByText(/Engine rejected the request \(400\)/)).toBeTruthy();
    expect(screen.queryByText("Aiming…")).toBeNull();
  });

  it("surfaces a lost engine connection (rejected IPC) as an error", async () => {
    api.mockImplementation(async () => {
      throw new Error("engine not started");
    });
    render(<App />);
    fireEvent.click(await prepareDraft());
    expect(await screen.findByText(/Could not reach the engine: engine not started/)).toBeTruthy();
  });

  it("surfaces a failed job status from the engine", async () => {
    api.mockImplementation(async (method: string, path: string): Promise<ApiResponse> => {
      if (method === "POST" && path === "/practice/feedback")
        return { status: 202, body: { id: "job1", status: "running" } };
      return { status: 200, body: { status: "error", error: "provider unreachable" } };
    });
    render(<App />);
    fireEvent.click(await prepareDraft());
    expect(await screen.findByText(/provider unreachable/)).toBeTruthy();
  });

  it("stops polling after the deadline instead of spinning forever", async () => {
    // shorten the 30-min deadline via the test seam (real timers — faking
    // them fights React's scheduler and the window.setTimeout routing)
    RUN_SETTINGS.pollTimeoutMs = 3000;
    api.mockImplementation(async (method: string, path: string): Promise<ApiResponse> => {
      if (method === "POST" && path === "/practice/feedback")
        return { status: 202, body: { id: "job1", status: "running" } };
      return { status: 200, body: { status: "running" } }; // never finishes
    });
    try {
      render(<App />);
      fireEvent.click(await prepareDraft());
      expect(await screen.findByText(/Timed out waiting for the engine/, {}, { timeout: 12_000 })).toBeTruthy();
      expect(screen.queryByText("Aiming…")).toBeNull();
    } finally {
      RUN_SETTINGS.pollTimeoutMs = 30 * 60 * 1000;
    }
  }, 20_000);
});
