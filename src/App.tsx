import { useEffect, useRef, useState } from "react";
import type { SidecarStatus } from "../global";
import { EngineStatus } from "./components/EngineStatus";
import { FeedbackView } from "./components/FeedbackView";
import { FirstRunModal } from "./components/FirstRunModal";
import { OllamaSetupCard } from "./components/OllamaSetupCard";
import { ProviderCard, loadProvider } from "./components/ProviderCard";
import {
  AudioAttachment,
  DocumentAttachment,
  FeedbackResult,
  HistoryEntry,
  ImageAttachment,
  MAX_AUDIO,
  MAX_DOCUMENTS,
  MAX_IMAGES,
  Rubric,
  RUN_SETTINGS,
  appendHistory,
  loadHistory,
  parseRubric,
  readAudioFile,
  readDocumentFile,
  readImageFile,
  submissionTypes,
} from "./practice";
import { T, button, card, input } from "./theme";

type RunState =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "error"; message: string }
  | { kind: "done"; result: FeedbackResult };

// Generous ceiling for one feedback job (3 local-model runs can take many
// minutes); past this the UI surfaces an error instead of spinning forever.
// See RUN_SETTINGS in practice.ts (tests shorten it).
const errText = (e: unknown): string => (e instanceof Error ? e.message : String(e));

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span
      style={{
        ...T.label,
        color: T.ink,
        border: `1px solid ${T.border}`,
        background: "#fff",
        borderRadius: 999,
        padding: "4px 10px",
        textTransform: "none",
        letterSpacing: "normal",
        fontSize: 12,
      }}
    >
      {label}
      <button
        style={{ marginLeft: 8, cursor: "pointer", border: "none", background: "none", color: T.red }}
        onClick={onRemove}
        aria-label={`Remove ${label}`}
      >
        ×
      </button>
    </span>
  );
}

export function App() {
  const [status, setStatus] = useState<SidecarStatus>({ phase: "not-started", url: "" });
  const [setupPhase, setSetupPhase] = useState<string>("");
  const [provider, setProvider] = useState(loadProvider);
  const [rubric, setRubric] = useState<Rubric | null>(null);
  const [rubricError, setRubricError] = useState("");
  const [draft, setDraft] = useState("");
  const [images, setImages] = useState<ImageAttachment[]>([]);
  const [documents, setDocuments] = useState<DocumentAttachment[]>([]);
  const [audio, setAudio] = useState<AudioAttachment[]>([]);
  const [audioNote, setAudioNote] = useState("");
  const [attachError, setAttachError] = useState("");
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
        setImages([]); // a new rubric may not accept the old attachments
        setDocuments([]);
        setAudio([]);
        setAudioNote("");
        setAttachError("");
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

  const addImages = (files: FileList) => {
    setAttachError("");
    const room = MAX_IMAGES - images.length;
    const picked = Array.from(files).slice(0, room);
    if (Array.from(files).length > room) {
      setAttachError(`At most ${MAX_IMAGES} images per submission`);
    }
    Promise.all(picked.map(readImageFile))
      .then((loaded) => setImages((prev) => [...prev, ...loaded]))
      .catch((e) => setAttachError(e instanceof Error ? e.message : String(e)));
  };

  const addDocuments = (files: FileList) => {
    setAttachError("");
    const room = MAX_DOCUMENTS - documents.length;
    const picked = Array.from(files).slice(0, room);
    if (Array.from(files).length > room) {
      setAttachError(`At most ${MAX_DOCUMENTS} documents per submission`);
    }
    Promise.all(picked.map(readDocumentFile))
      .then((loaded) => setDocuments((prev) => [...prev, ...loaded]))
      .catch((e) => setAttachError(e instanceof Error ? e.message : String(e)));
  };

  const addAudio = (files: FileList) => {
    setAttachError("");
    const room = MAX_AUDIO - audio.length;
    const picked = Array.from(files).slice(0, room);
    if (Array.from(files).length > room) {
      setAttachError(`At most ${MAX_AUDIO} recordings per submission`);
    }
    Promise.all(picked.map(readAudioFile))
      .then((loaded) => setAudio((prev) => [...prev, ...loaded]))
      .catch((e) => setAttachError(e instanceof Error ? e.message : String(e)));
  };

  const poll = (jobId: string, currentRubric: Rubric, deadline: number) => {
    window.lens.api("GET", `/practice/feedback/${jobId}`).then((resp) => {
      const job = resp.body as { status: string; result?: FeedbackResult; error?: string };
      if (resp.status !== 200) {
        setRun({ kind: "error", message: `Engine error (${resp.status})` });
      } else if (job.status === "done" && job.result) {
        setRun({ kind: "done", result: job.result });
        setHistory(appendHistory(currentRubric, job.result));
      } else if (job.status === "error") {
        setRun({ kind: "error", message: job.error ?? "Unknown error" });
      } else if (Date.now() > deadline) {
        setRun({ kind: "error", message: "Timed out waiting for the engine — try fewer model runs." });
      } else {
        pollTimer.current = window.setTimeout(
          () => poll(jobId, currentRubric, deadline),
          RUN_SETTINGS.pollIntervalMs,
        );
      }
    }).catch((e) => {
      setRun({ kind: "error", message: `Lost contact with the engine: ${errText(e)}` });
    });
  };

  const start = () => {
    if (!rubric) return;
    if (pollTimer.current) window.clearTimeout(pollTimer.current);
    setRun({ kind: "running" });

    // Audio needs the on-demand speech-analyser: install/start it first and
    // pass its URL per-request (the engine process predates the analyser).
    const prepareAudio =
      audio.length > 0
        ? (setAudioNote("Preparing the audio engine (one-time install)…"),
          window.lens
            .audioEnsure()
            .catch((e) => {
              throw new Error(`Audio engine unavailable: ${errText(e)}`);
            })
            .finally(() => setAudioNote("")))
        : Promise.resolve("");

    prepareAudio
      .then((speechUrl) =>
        window.lens.api("POST", "/practice/feedback", {
          rubric,
          draft_text: draft,
          num_runs: runs,
          images,
          documents,
          audio,
          include_signals: true,
          speech_analyser_url: speechUrl,
          provider: {
            base_url: provider.base_url,
            api_key: provider.api_key,
            model: provider.model,
          },
        }),
      )
      .then((resp) => {
        if (resp.status === 202) {
          poll(
            (resp.body as { id: string }).id,
            rubric,
            Date.now() + RUN_SETTINGS.pollTimeoutMs,
          );
        } else {
          setRun({ kind: "error", message: `Engine rejected the request (${resp.status})` });
        }
      })
      .catch((e) => {
        setRun({ kind: "error", message: `Could not reach the engine: ${errText(e)}` });
      });
  };

  const ready = status.phase === "ready";
  const types = rubric ? submissionTypes(rubric) : ["text"];
  const acceptsImages = types.includes("image");
  const acceptsDocuments = types.includes("document");
  const acceptsAudio = types.includes("audio");
  const textAllowed = types.includes("text");
  const hasSubmission =
    draft.trim().length > 0 || images.length > 0 || documents.length > 0 || audio.length > 0;
  const canRun =
    ready && rubric !== null && hasSubmission && provider.model.trim().length > 0 && run.kind !== "running";
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
        {rubric !== null && acceptsImages && (
          <p style={{ fontSize: 12, color: T.textMuted, margin: "-6px 0 0" }}>
            This assignment accepts image submissions — the model on your chosen
            endpoint must be vision-capable (e.g. llama3.2-vision on Ollama, or any
            multimodal cloud model). “List models” above shows what your endpoint offers.
          </p>
        )}

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
            <div style={T.label}>Your submission</div>
            <div style={{ fontSize: 12, color: T.textMuted }}>
              {[
                textAllowed && `${wordCount} word${wordCount === 1 ? "" : "s"}`,
                acceptsDocuments && documents.length > 0
                  ? `${documents.length} document${documents.length === 1 ? "" : "s"}`
                  : "",
                acceptsImages && images.length > 0
                  ? `${images.length} image${images.length === 1 ? "" : "s"}`
                  : "",
                acceptsAudio && audio.length > 0
                  ? `${audio.length} recording${audio.length === 1 ? "" : "s"}`
                  : "",
              ]
                .filter(Boolean)
                .join(" · ")}
            </div>
          </div>
          {textAllowed && (
            <textarea
              style={{ ...input, marginTop: 10, minHeight: 220, fontFamily: T.serif, fontSize: 15, lineHeight: 1.6 }}
              value={draft}
              placeholder="Paste your draft here, or open a .txt / .md file…"
              onChange={(e) => setDraft(e.target.value)}
            />
          )}
          {(acceptsDocuments || acceptsImages || acceptsAudio) && (
            <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
              {documents.length > 0 && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {documents.map((doc) => (
                    <Chip
                      key={doc.name}
                      label={doc.name}
                      onRemove={() => setDocuments((prev) => prev.filter((d) => d.name !== doc.name))}
                    />
                  ))}
                </div>
              )}
              {images.length > 0 && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {images.map((img) => (
                    <Chip
                      key={img.name}
                      label={img.name}
                      onRemove={() => setImages((prev) => prev.filter((i) => i.name !== img.name))}
                    />
                  ))}
                </div>
              )}
              {audio.length > 0 && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {audio.map((clip) => (
                    <Chip
                      key={clip.name}
                      label={clip.name}
                      onRemove={() => setAudio((prev) => prev.filter((a) => a.name !== clip.name))}
                    />
                  ))}
                </div>
              )}
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                {acceptsAudio && (
                  <label style={{ ...button("secondary"), fontSize: 11 }}>
                    {audio.length ? "Add more audio…" : "Attach audio…"}
                    <input
                      type="file"
                      accept=".mp3,.wav,.m4a,.ogg,.webm,.flac"
                      multiple
                      style={{ display: "none" }}
                      onChange={(e) => {
                        if (e.target.files?.length) addAudio(e.target.files);
                        e.target.value = "";
                      }}
                    />
                  </label>
                )}
                {acceptsDocuments && (
                  <label style={{ ...button("secondary"), fontSize: 11 }}>
                    {documents.length ? "Add more documents…" : "Attach documents…"}
                    <input
                      type="file"
                      accept=".pdf,.docx,.txt,.md,.markdown"
                      multiple
                      style={{ display: "none" }}
                      onChange={(e) => {
                        if (e.target.files?.length) addDocuments(e.target.files);
                        e.target.value = "";
                      }}
                    />
                  </label>
                )}
                {acceptsImages && (
                  <label style={{ ...button("secondary"), fontSize: 11 }}>
                    {images.length ? "Add more images…" : "Attach images…"}
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      style={{ display: "none" }}
                      onChange={(e) => {
                        if (e.target.files?.length) addImages(e.target.files);
                        e.target.value = "";
                      }}
                    />
                  </label>
                )}
                {acceptsImages && (
                  <span style={{ fontSize: 12, color: T.textMuted }}>
                    images need a vision-capable model · up to {MAX_IMAGES}
                  </span>
                )}
              </div>
              {attachError && <div style={{ color: T.red, fontSize: 13 }}>{attachError}</div>}
              {acceptsAudio && (
                <div style={{ fontSize: 12, color: T.textMuted }}>
                  recordings are transcribed on this machine (audio engine installs on first use)
                </div>
              )}
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
            {textAllowed ? (
              <label style={{ ...button("secondary"), fontSize: 11 }}>
                Open draft file…
                <input
                  type="file"
                  accept=".txt,.md,.markdown"
                  style={{ display: "none" }}
                  onChange={(e) => e.target.files?.[0] && openDraft(e.target.files[0])}
                />
              </label>
            ) : (
              <span style={{ fontSize: 12, color: T.textMuted }}>
                This assignment takes {types.join(", ")} submissions — this version of the app can
                practise text, documents, images and audio.
              </span>
            )}
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
              {audioNote && (
                <>
                  {audioNote}
                  <br />
                </>
              )}
              Running {runs} model run{runs !== 1 ? "s" : ""} — local models can take a few minutes. Your submission never
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
