/** Types and helpers for the practice flow (mirror of the sidecar API). */

export interface RubricCategory {
  name: string;
  description?: string;
  weight: number;
}

export interface Rubric {
  formatVersion: string;
  kind: "ffrubric";
  assignment: { title: string; description?: string; maxDrafts?: number };
  rubric: { categories: RubricCategory[] };
  source?: { courseCode?: string; courseTitle?: string };
}

export interface Level {
  label: string;
  color: string;
}

export interface FeedbackCategory {
  name: string;
  weight: number;
  score: number;
  level: Level;
  feedback: string;
  strengths: string[];
  improvements: string[];
  runs: number;
}

export interface FeedbackResult {
  overall: { score: number; level: Level };
  overall_feedback: string;
  categories: FeedbackCategory[];
  runs: number;
  failed_runs: number;
  word_count: number;
}

export interface Provider {
  base_url: string;
  api_key: string;
  model: string;
}

export const PRESETS: { id: string; name: string; base_url: string; needsKey: boolean }[] = [
  { id: "local", name: "Local Ollama", base_url: "http://localhost:11434/v1", needsKey: false },
  { id: "remote", name: "Remote Ollama / class server", base_url: "", needsKey: true },
  { id: "byok", name: "My own key (OpenAI-compatible)", base_url: "https://api.openai.com/v1", needsKey: true },
];

export function parseRubric(text: string): Rubric {
  const data = JSON.parse(text);
  if (data?.kind !== "ffrubric") throw new Error("Not a .ffrubric file");
  if (!data?.rubric?.categories?.length) throw new Error("Rubric has no categories");
  return data as Rubric;
}

export interface HistoryEntry {
  ts: number;
  overallScore: number;
  levelLabel: string;
}

const historyKey = (rubric: Rubric) => `ffd-history:${rubric.assignment.title}`;

export function loadHistory(rubric: Rubric): HistoryEntry[] {
  try {
    return JSON.parse(localStorage.getItem(historyKey(rubric)) ?? "[]");
  } catch {
    return [];
  }
}

export function appendHistory(rubric: Rubric, result: FeedbackResult): HistoryEntry[] {
  const entries = loadHistory(rubric);
  entries.push({
    ts: Date.now(),
    overallScore: result.overall.score,
    levelLabel: result.overall.level.label,
  });
  localStorage.setItem(historyKey(rubric), JSON.stringify(entries.slice(-20)));
  return entries;
}
