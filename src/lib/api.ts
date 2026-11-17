// Typed client for the NSCA FastAPI backend.

export type Dataset = "ddxplus" | "mendeley" | "phenopackets";

export interface Option { value: string; label: string }
export interface Question {
  id: string;
  text: string;
  type: "yes_no" | "single" | "multi" | "scale";
  kind: "symptom" | "risk_factor";
  parent: string | null;
  options: Option[];
  default: string | null;
}

export interface Candidate {
  disease: string;
  score: number;
  match: number;
  core_coverage: number;
  source: string;
  consistent: boolean;
  failed_checks: string[];
  excluding_present: string[];
  unexplained_symptoms: string[];
  missing_core_symptoms: string[];
  node_difference_alignment: number | null;
  checks: { name: "overall_match" | "usual_symptoms" | "nothing_against" | "symptoms_explained";
    passed: boolean; value: number; limit: number }[];
  core_present: string[];      // the disease's usual symptoms that you have
  typical_present: string[];   // other symptoms of yours often seen with it
}

export interface NodeDiffItem {
  feature_index: number;
  meaning: string;
  patient: number;
  winner_weight: number;
  runner_up_weight?: number;
  favours?: "winner" | "runner_up";
  score?: number;
}

export interface Exemplar {
  train_index: number;
  distance: number;
  diagnosis: string | null;
  symptoms: string[];
  shared_with_patient: string[];
}

export interface FusedRecord {
  cluster_id: number;
  cluster_name: string | null;
  runner_up_cluster: number | null;
  runner_up_name: string | null;
  winner_node: number;
  distance_to_winner: number;
  cluster_radius: number;
  stage1_outlier: boolean;
  rule: { text: string; length: number; leaf_purity: number; leaf_support: number; then_cluster: number };
  cart_cluster: number;
  agreement: boolean;
  fidelity: number;
  node_difference: {
    supporting: NodeDiffItem[];
    unexpected: NodeDiffItem[];
    expected_but_missing: NodeDiffItem[];
    differential_vs_runner_up: NodeDiffItem[];
    support_ratio: number;
  };
  exemplars: Exemplar[];
  reliable: boolean;
  unreliable_reasons: string[];
}

export interface IdentifyResult {
  outcome: "known_disease" | "flag_as_new";
  disease: string | null;
  confidence: "high" | "medium" | "low" | "provisional" | string;
  unknown_symptoms: string[];
  filled_defaults: string[];
  summary: { reason: string; rule: string; record_reliable: boolean; fidelity: number };
  stages: {
    stage1_neural: {
      winner_node: number; cluster_id: number; cluster_name: string | null; distance: number;
      cluster_radius: number; outlier: boolean; runner_up_cluster: number | null;
    };
    stage2_fused_record: FusedRecord;
    stage3_symbolic: {
      grounding: { term: string; label: string }[];
      candidates: Candidate[];
      resolution: { outcome: string; disease: string | null; confidence: string; reason: string };
      ontology?: string;
      hpo_release?: string;
    };
  } | null;
  flag: FlagSaved | null;
  elapsed_ms: number;
}

// ---- saved "possible new disease" cases
export interface SimilarCase { case_id: string; distance: number; status: ReviewStatus }
export interface FlagSaved {
  case_id: string;
  saved: boolean;               // false when the same symptoms were re-submitted within 10 minutes
  duplicate_of_recent: boolean;
  similar_cases: SimilarCase[];
}
export type ReviewStatus = "pending_review" | "confirmed_new" | "known_disease" | "dismissed";
export interface FlagCase {
  case_id: string;
  created_at: string;
  free_text: string | null;
  symptoms: string[];
  hpo_terms: { term: string; label: string }[];
  stage1: { cluster_id: number; cluster_name: string | null; distance: number; cluster_radius: number; outlier: boolean };
  stage2: { reliable: boolean; unreliable_reasons: string[]; rule: string; fidelity: number };
  candidates: { disease: string; score: number; failed_checks: string[] }[];
  nearest_known: string | null;
  reason: string;
  similar_cases: SimilarCase[];
  review: { status: ReviewStatus; note: string | null; disease: string | null; reviewed_at: string | null };
}
export interface FlagList {
  counts: Record<ReviewStatus | "total", number>;
  groups_of_similar_cases: string[][];
  cases: FlagCase[];
}

export interface ParsedItem {
  phrase: string; concept: string; question_id: string; question: string; source: string; note: string | null;
}
export interface ParseResult {
  symptoms: string[];
  answers: Record<string, string[]>;
  found: ParsedItem[];
  absent: ParsedItem[];
  unrecognised: string[];
}

export interface ModelStatus {
  dataset: string;
  trained_at: string;
  stage1_esoinn: { nodes: number; edges: number; clusters: number; samples_seen: number;
    noise_buffer_patients: number; params: Record<string, number> };
  stage2_surrogate: { fidelity: number; leaves: number; refit_triggers_pending: string[] };
  stage3: { hpo_release: string; known_diseases: number; grounded_symptoms: number; symptom_columns: number;
    thresholds: Record<string, number>; top_k: number };
  flagged_cases: Record<ReviewStatus | "total", number>;
}

export interface ClusterInfo {
  cluster_id: number;
  name: string | null;
  training_patients: number;
  radius: number;
  rules: { text: string; support: number; purity: number }[];
}

export class ApiError extends Error {}

async function call<T>(base: string, path: string, init?: RequestInit, timeoutMs = 20000): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(`${base.replace(/\/+$/, "")}${path}`, {
      ...init,
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
  } catch (e) {
    throw new ApiError(
      (e as Error).name === "AbortError"
        ? "The server took too long to answer."
        : `Cannot reach the server at ${base}. Check that it is running and the address in Settings.`,
    );
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    try {
      const j = await res.json();
      detail = typeof j.detail === "string" ? j.detail : j.detail?.error ?? JSON.stringify(j.detail);
    } catch {}
    throw new ApiError(detail);
  }
  return res.json() as Promise<T>;
}

export const api = {
  health: (base: string) =>
    call<{ status: string; models_loaded: string[]; default_dataset: string }>(base, "/health", undefined, 6000),
  questions: (base: string, dataset: Dataset) => call<Question[]>(base, `/questions?dataset=${dataset}`),
  identify: (base: string, dataset: Dataset, symptoms: string[], text?: string | null) =>
    call<IdentifyResult>(base, "/identify", {
      method: "POST",
      body: JSON.stringify({ dataset, symptoms, detail: "full", text: text || null }),
    }),
  flags: (base: string, dataset: Dataset) => call<FlagList>(base, `/flags?dataset=${dataset}`),
  reviewFlag: (base: string, dataset: Dataset, caseId: string, status: ReviewStatus, note?: string, disease?: string) =>
    call<FlagCase>(base, `/flags/${encodeURIComponent(caseId)}`, {
      method: "PATCH",
      body: JSON.stringify({ dataset, status, note: note || null, disease: disease || null }),
    }),
  deleteFlag: (base: string, dataset: Dataset, caseId: string) =>
    call<{ deleted: string }>(base, `/flags/${encodeURIComponent(caseId)}?dataset=${dataset}`, { method: "DELETE" }),
  clearFlags: (base: string, dataset: Dataset, status?: ReviewStatus) =>
    call<{ deleted: number }>(base, `/flags?dataset=${dataset}${status ? `&status=${status}` : ""}`, { method: "DELETE" }),
  flagsExportUrl: (base: string, dataset: Dataset) => `${base.replace(/\/+$/, "")}/flags/export?dataset=${dataset}`,
  parseText: (base: string, dataset: Dataset, text: string) =>
    call<ParseResult>(base, "/parse-text", { method: "POST", body: JSON.stringify({ dataset, text }) }),
  status: (base: string, dataset: Dataset) => call<ModelStatus>(base, `/model-status?dataset=${dataset}`),
  clusters: (base: string, dataset: Dataset) => call<ClusterInfo[]>(base, `/clusters?dataset=${dataset}`),
};
