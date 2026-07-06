import { useState } from "react";
import { FeedbackResult, HistoryEntry } from "../practice";
import { T, card, levelColor } from "../theme";
import { Bullseye } from "./Bullseye";

function LevelChip({ label, color }: { label: string; color: string }) {
  const c = levelColor(color);
  return (
    <span
      style={{
        ...T.label,
        color: c,
        border: `1px solid ${c}55`,
        background: `${c}11`,
        borderRadius: 999,
        padding: "4px 12px",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

export function FeedbackView({ result, history }: { result: FeedbackResult; history: HistoryEntry[] }) {
  const [showNumbers, setShowNumbers] = useState(false);

  return (
    <section style={{ ...card, display: "grid", gap: 24 }}>
      <div style={{ textAlign: "center", borderBottom: `1px solid ${T.border}`, paddingBottom: 20 }}>
        <Bullseye closeness={result.overall.score / 100} size={88} label={result.overall.level.label} />
        <h2 style={{ fontFamily: T.serif, color: T.ink, margin: "10px 0 2px", fontSize: 26 }}>
          {result.overall.level.label}
          {showNumbers && <span style={{ color: T.textMuted, fontSize: 18 }}> · {result.overall.score}/100</span>}
        </h2>
        <div style={T.label}>
          {result.runs} model run{result.runs !== 1 ? "s" : ""}
          {result.failed_runs > 0 ? ` · ${result.failed_runs} failed` : ""} · {result.word_count} words
        </div>
        {result.overall_feedback && (
          <p style={{ color: T.textBody, maxWidth: 560, margin: "12px auto 0", lineHeight: 1.6 }}>
            {result.overall_feedback}
          </p>
        )}
      </div>

      {history.length > 1 && (
        <div>
          <div style={T.label}>Your aim across drafts</div>
          <div style={{ display: "flex", gap: 14, alignItems: "center", marginTop: 8, flexWrap: "wrap" }}>
            {history.map((h, i) => (
              <div key={h.ts} style={{ textAlign: "center" }}>
                <Bullseye closeness={h.overallScore / 100} size={44} label={h.levelLabel} />
                <div style={{ ...T.label, marginTop: 2 }}>#{i + 1}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "grid", gap: 14 }}>
        {result.categories.map((cat) => (
          <div key={cat.name} style={{ border: `1px solid ${T.border}`, borderRadius: 4, padding: 16, background: "#fff" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 12 }}>
              <div>
                <h3 style={{ fontFamily: T.serif, color: T.ink, margin: 0, fontSize: 17 }}>
                  {cat.name}
                  <span style={{ color: T.textMuted, fontWeight: "normal", fontSize: 13 }}>
                    {cat.weight ? ` (${Math.round(cat.weight)}%)` : ""}
                    {showNumbers ? ` · ${cat.score}/100` : ""}
                  </span>
                </h3>
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <Bullseye closeness={cat.score / 100} size={32} label={cat.level.label} />
                <LevelChip label={cat.level.label} color={cat.level.color} />
              </div>
            </div>
            {cat.feedback && (
              <p
                style={{
                  color: T.textBody,
                  fontSize: 14,
                  lineHeight: 1.6,
                  margin: "10px 0 0",
                  paddingLeft: 12,
                  borderLeft: `2px solid ${levelColor(cat.level.color)}`,
                }}
              >
                {cat.feedback}
              </p>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 12 }}>
              {cat.strengths.length > 0 && (
                <div>
                  <div style={{ ...T.label, color: T.teal }}>Strengths</div>
                  <ul style={{ margin: "6px 0 0", paddingLeft: 18, color: T.textBody, fontSize: 13, lineHeight: 1.5 }}>
                    {cat.strengths.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}
              {cat.improvements.length > 0 && (
                <div>
                  <div style={{ ...T.label, color: T.amber }}>To improve</div>
                  <ul style={{ margin: "6px 0 0", paddingLeft: 18, color: T.textBody, fontSize: 13, lineHeight: 1.5 }}>
                    {cat.improvements.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <label style={{ fontSize: 12, color: T.textMuted, display: "flex", gap: 6, alignItems: "center" }}>
        <input type="checkbox" checked={showNumbers} onChange={(e) => setShowNumbers(e.target.checked)} />
        Show numeric scores (practice estimates only — your instructor's marking may differ)
      </label>
    </section>
  );
}
