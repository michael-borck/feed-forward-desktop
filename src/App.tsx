import { useEffect, useRef, useState } from "react";
import type { SidecarStatus } from "../global";
import { EngineStatus } from "./components/EngineStatus";
import { FeedbackView } from "./components/FeedbackView";
import { FirstRunModal } from "./components/FirstRunModal";
import { OllamaSetupCard } from "./components/OllamaSetupCard";
import { ProviderCard, loadProvider } from "./components/ProviderCard";
import {
  FeedbackResult,
  HistoryEntry,
  Rubric,
  appendHistory,
  loadHistory,
  parseRubric,
} from "./practice";
import { T, button, card, input } from "./theme";

type RunState =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "error"; message: string }
  | { kind: "done"; result: FeedbackResult };

export function App() {
  const [status, setStatus] = useState<SidecarStatus>({ phase: "not-started", url: "" });
  const [setupPhase, setSetupPhase] = useState<string>("");
  const [provider, setProvider] = useState(loadProvider);
  const [rubric, setRubric] = useState<Rubric | null>(null);
  const [rubricError, setRubricError] = useState("");
  const [draft, setDraft] = useState("");
  const [runs, setRuns] = useState(1);
  const [run, setRun] = useState<RunState>({ kind: "idle" });
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const pollTimer = useRef<number | null>(null);

  useEffect(() => {
    window.lens.sidecarStatus().then(setStatus);
    const offStatus = window.lens.onSidecarStatus(setStatus);
    const offPhase = window.lens.onSetupPhase(setSetupPhase);
    return () => {
      offStatus();
      offPhase();
      if (pollTimer.current) window.clearTimeout(pollTimer.current);
    };
  }, []);

  const installing = setupPhase === "installing" || status.phase === "installing";

  const openRubric = (file: File) => {
    file.text().then((text) => {
      try {
        const parsed = parseRubric(text);
        setRubric(parsed);
        setRubricError("");
        setHistory(loadHistory(parsed));
        setRun({ kind: "idle" });
      } catch (e) {
        setRubric(null);
        setRubricError(e instanceof Error ? e.message : String(e));
      }
    });
  };

  const openDraft = (file: File) => {
    file.text().then(setDraft);
  };

  const poll = (jobId: string, currentRubric: Rubric) => {
    window.lens.api("GET", `/practice/feedback/${jobId}`).then((resp) => {
      const job = resp.body as { status: string; result?: FeedbackResult; error?: string };
      if (resp.status !== 200) {
        setRun({ kind: "error", message: `Engine error (${resp.status})` });
      } else if (job.status === "done" && job.result) {
        setRun({ kind: "done", result: job.result });
        setHistory(appendHistory(currentRubric, job.result));
      } else if (job.status === "error") {
        setRun({ kind: "error", message: job.error ?? "Unknown error" });
      } else {
        pollTimer.current = window.setTimeout(() => poll(jobId, currentRubric), 1500);
      }
    });
  };

  const start = () => {
    if (!rubric) return;
    setRun({ kind: "running" });
    window.lens
      .api("POST", "/practice/feedback", {
        rubric,
        draft_text: draft,
        num_runs: runs,
        provider: {
          base_url: provider.base_url,
          api_key: provider.api_key,
          model: provider.model,
        },
      })
      .then((resp) => {
        if (resp.status === 202) {
          poll((resp.body as { id: string }).id, rubric);
        } else {
          setRun({ kind: "error", message: `Engine rejected the request (${resp.status})` });
        }
      });
  };

  const ready = status.phase === "ready";
  const canRun =
    ready &&
    rubric !== null &&
    draft.trim().length > 0 &&
    provider.model.trim().length > 0 &&
    run.kind !== "running";
  const wordCount = draft.trim() ? draft.trim().split(/\s+/).length : 0;

  return (
    <div style={{ minHeight: "100vh", background: T.paper, fontFamily: "system-ui, sans-serif" }}>
      {installing && <FirstRunModal />}
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "14px 28px",
          borderBottom: `2px solid ${T.ink}`,
        }}
      >
        <div style={{ fontFamily: T.serif, fontSize: 24, fontWeight: 700 }}>
          <span style={{ color: T.ink }}>Feed</span>
          <span style={{ color: T.teal }}>Forward</span>
          <span style={{ ...T.label, marginLeft: 10 }}>Desktop · private practice</span>
        </div>
        <EngineStatus status={status} />
      </header>

      <main style={{ maxWidth: 860, margin: "0 auto", padding: "28px 20px 80px", display: "grid", gap: 18 }}>
        {provider.preset === "local" && <OllamaSetupCard />}

        <ProviderCard value={provider} onChange={setProvider} />

        <section style={card}>
          <div style={T.label}>Rubric</div>
          {rubric ? (
            <div style={{ marginTop: 10 }}>
              <h2 style={{ fontFamily: T.serif, color: T.ink, margin: 0, fontSize: 20 }}>
                {rubric.assignment.title}
              </h2>
              <div style={{ fontSize: 13, color: T.textMuted, marginTop: 2 }}>
                {rubric.source?.courseCode ? `${rubric.source.courseCode} · ` : ""}
                {rubric.rubric.categories.map((c) => `${c.name} ${Math.round(c.weight)}%`).join(" · ")}
              </div>
            </div>
          ) : (
            <p style={{ fontSize: 13, color: T.textMuted, margin: "10px 0" }}>
              Open the .ffrubric file your instructor shared for this assignment.
            </p>
          )}
          <label style={{ ...button("secondary"), display: "inline-block", marginTop: 12, fontSize: 11 }}>
            {rubric ? "Open a different rubric" : "Open rubric…"}
            <input
              type="file"
              accept=".ffrubric,.json"
              style={{ display: "none" }}
              onChange={(e) => e.target.files?.[0] && openRubric(e.target.files[0])}
            />
          </label>
          {rubricError && <div style={{ color: T.red, fontSize: 13, marginTop: 8 }}>{rubricError}</div>}
        </section>

        <section style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <div style={T.label}>Your draft</div>
            <div style={{ fontSize: 12, color: T.textMuted }}>{wordCount} words</div>
          </div>
          <textarea
            style={{ ...input, marginTop: 10, minHeight: 220, fontFamily: T.serif, fontSize: 15, lineHeight: 1.6 }}
            value={draft}
            placeholder="Paste your draft here, or open a .txt / .md file…"
            onChange={(e) => setDraft(e.target.value)}
          />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
            <label style={{ ...button("secondary"), fontSize: 11 }}>
              Open draft file…
              <input
                type="file"
                accept=".txt,.md,.markdown"
                style={{ display: "none" }}
                onChange={(e) => e.target.files?.[0] && openDraft(e.target.files[0])}
              />
            </label>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <label style={{ fontSize: 12, color: T.textMuted }}>
                Model runs{" "}
                <select
                  style={{ ...input, width: 56, display: "inline-block", padding: "6px 6px" }}
                  value={runs}
                  onChange={(e) => setRuns(Number(e.target.value))}
                >
                  {[1, 2, 3].map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                </select>
              </label>
              <button style={{ ...button("primary"), opacity: canRun ? 1 : 0.45 }} disabled={!canRun} onClick={start}>
                {run.kind === "running" ? "Aiming…" : "Get practice feedback"}
              </button>
            </div>
          </div>
          {run.kind === "running" && (
            <p style={{ fontSize: 13, color: T.textMuted, marginTop: 10 }}>
              Running {runs} model run{runs !== 1 ? "s" : ""} — local models can take a few minutes. Your draft never
              leaves this machine except to the endpoint you chose.
            </p>
          )}
          {run.kind === "error" && <div style={{ color: T.red, fontSize: 13, marginTop: 10 }}>{run.message}</div>}
        </section>

        {run.kind === "done" && <FeedbackView result={run.result} history={history} />}

        <p style={{ fontSize: 12, color: T.textMuted, textAlign: "center" }}>
          Practice feedback is formative guidance, not a grade. Submit through your unit's FeedForward site as usual.
        </p>
      </main>
    </div>
  );
}
