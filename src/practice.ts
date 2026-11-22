/** Types and helpers for the practice flow (mirror of the sidecar API). */

export interface RubricCategory {
  name: string;
  description?: string;
  weight: number;
}

export interface Rubric {
  formatVersion: string;
  kind: "ffrubric";
  assignment: {
    title: string;
    description?: string;
    maxDrafts?: number;
    /** Contract v1.1: what a student may submit; absent = text only. */
    submissionTypes?: string[];
  };
  rubric: { categories: RubricCategory[] };
  source?: { courseCode?: string; courseTitle?: string };
}

/** Submission kinds this build of the desktop handles (engine manifest parity). */
export const HANDLED_SUBMISSION_TYPES = ["text", "image"] as const;

export function submissionTypes(rubric: Rubric): string[] {
  const t = rubric.assignment.submissionTypes;
  return Array.isArray(t) && t.length > 0 ? t : ["text"];
}

export interface ImageAttachment {
  name: string;
  mime_type: string;
  data_base64: string;
}

/** Matches the sidecar API's per-request cap. */
export const MAX_IMAGES = 8;

/** Read an image file into the base64 shape the engine expects. */
export function readImageFile(file: File): Promise<ImageAttachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
    reader.onload = () => {
      const match = /^data:([^;]+);base64,(.*)$/s.exec(String(reader.result));
      if (!match) return reject(new Error(`Unsupported file: ${file.name}`));
      resolve({ name: file.name, mime_type: match[1], data_base64: match[2] });
    };
    reader.readAsDataURL(file);
  });
}

export interface DocumentAttachment {
  name: string;
  data_base64: string;
}

/** Matches the sidecar API's per-request cap. */
export const MAX_DOCUMENTS = 4;

/** What the engine can extract text from (mirrors its extract.py). */
export const DOCUMENT_EXTENSIONS = [".pdf", ".docx", ".txt", ".md", ".markdown"];

/** Read a document file (pdf/docx/text) as base64 for the engine to extract. */
export function readDocumentFile(file: File): Promise<DocumentAttachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
    reader.onload = () => {
      const match = /^data:[^;]+;base64,(.*)$/s.exec(String(reader.result));
      if (!match) return reject(new Error(`Could not encode ${file.name}`));
      resolve({ name: file.name, data_base64: match[1] });
    };
    reader.readAsDataURL(file);
  });
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
  image_count?: number;
}

export interface Provider {
  base_url: string;
  api_key: string;
  model: string;
}

/** Runtime knobs for the run/poll loop. `pollTimeoutMs` is a test seam:
 *  integration tests shorten the 30-minute deadline instead of faking
 *  timers (which fight React's scheduler). */
export const RUN_SETTINGS = {
  pollTimeoutMs: 30 * 60 * 1000,
  pollIntervalMs: 1500,
};

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

// Course code scopes the history so two assignments with the same title in
// different units don't share progress. (Namespace bumped when the key changed.)
const historyKey = (rubric: Rubric) =>
  `ffd-history2:${rubric.source?.courseCode ? `${rubric.source.courseCode}::` : ""}${rubric.assignment.title}`;

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
  const capped = entries.slice(-20);
  localStorage.setItem(historyKey(rubric), JSON.stringify(capped));
  return capped;
}
