export type EnvironmentSnapshot = {
  status: string;
  longitude: number | null;
  latitude: number | null;
  month: string;
  chirpsMonthlyMm: number | null;
  modisEviMean: number | null;
  modisNdviMean: number | null;
  waterOccurrencePct: number | null;
  modisFirstDate: string;
  modisLatestDate: string;
};

export type DemoImage = {
  path: string;
  url: string;
  filename: string;
};

export type DemoEvent = {
  index: number;
  sampleId: string;
  eventId: string;
  split: string;
  task: string;
  siteId: string;
  localDatetime: string;
  frameCount: number;
  images: DemoImage[];
  prompt: {
    system: string;
    user: string;
  };
  reviewRouter: {
    sampleId: string;
    task: string;
    prompt: {
      system: string;
      user: string;
    };
  } | null;
  environment: EnvironmentSnapshot | null;
  hiddenLabelAvailable: boolean;
  hiddenReviewAvailable: boolean;
  curation: {
    acceptedSettings: {
      thinking: boolean;
      seed: number;
      numPredict: number;
    };
    finalEvaluation: {
      accepted: boolean;
      reasons: string[];
    };
  } | null;
};

export type HiddenLabel = {
  capture_event_id: string;
  target: {
    schema_version: string;
    capture_event_id: string;
    event: {
      blank: boolean;
      site_id: string;
      local_datetime: string;
      frame_count: number;
    };
    detections: Array<{
      species: string;
      count: {
        bin: string;
        minimum: number;
        maximum: number;
      };
      behaviors: Record<string, boolean>;
      young_present: boolean;
      confidence: {
        label: string;
        basis: string[];
      };
    }>;
    review: {
      review_needed: boolean;
      priority: string;
      reasons: string[];
    };
  };
  supervision: {
    label_source: string;
    raw_votes: number;
    blank_votes: number;
    blank_vote_ratio: number;
    max_evenness: number | null;
  };
  review_target: {
    schema_version: string;
    capture_event_id: string;
    decision: "accept" | "review";
    review_needed: boolean;
    priority: string;
    reasons: string[];
    uncertainty: Record<string, string>;
    routing: {
      queue: string;
      human_privacy_filter: boolean;
    };
  } | null;
  review_supervision: {
    label_source: string;
    raw_votes: number;
    blank_votes: number;
    blank_vote_ratio: number;
    max_evenness: number | null;
  } | null;
};

export type ModelPrediction = {
  eventId: string;
  result: {
    model: string;
    thinking: boolean;
    latencyMs: number;
    raw: string;
    parsed: unknown | null;
    validation: {
      jsonOk: boolean;
      schemaOk: boolean;
      speciesOk: boolean;
      warnings: string[];
    };
    doneReason: string | null;
    createdAt: string;
    cachedCurated?: boolean;
  };
};

export type CopilotAnswer = {
  eventId: string;
  model: string;
  latencyMs: number;
  thinking: boolean;
  question: string;
  answer: string;
  raw: string;
  createdAt: string;
};

export type HealthStatus = {
  ok: boolean;
  ollama: {
    reachable: boolean;
    url: string;
    model: string;
    models?: string[];
    error?: string;
  };
};

export type ToolRegistryResponse = {
  tools: Array<{
    type: string;
    function: {
      name: string;
      description: string;
      parameters: Record<string, unknown>;
    };
  }>;
  endpoints: string[];
};

export type DetectionSearchResponse = {
  tool: string;
  source: string;
  source_note: string;
  count: number;
  rows: Array<{
    capture_event_id: string;
    site_id: string;
    local_datetime: string;
    year: string;
    species: string;
    canonical_species: string;
    confidence_label: string;
    confidence_score: number | null;
    count_bin: string;
    behaviors: string[];
    review_needed: boolean;
    review_priority: string;
    source: string;
  }>;
  groups: Array<{
    key: string;
    fields: Record<string, string>;
    events: number;
    species: string[];
  }>;
};

export type SitesResponse = {
  sites: Array<{
    site_id: string;
    latitude: number | null;
    longitude: number | null;
    events: number;
    review_needed: number;
    species_counts: Record<string, number>;
    years: string[];
    mean_rainfall_mm: number | null;
    mean_evi: number | null;
  }>;
};

export type EnvironmentExtractResponse = {
  tool: string;
  count: number;
  layers: string[];
  summary: {
    mean_chirps_monthly_mm: number | null;
    mean_modis_evi: number | null;
    mean_modis_ndvi: number | null;
    mean_water_occurrence_pct: number | null;
  };
  rows: Array<Record<string, unknown>>;
};

export type BenchmarkSummary = {
  generated_at: string;
  training: Record<string, number>;
  demo_curation: {
    accepted?: number;
    tested?: number;
    acceptanceRate?: number;
    acceptedYearCounts?: Record<string, number>;
    acceptedSpeciesCounts?: Record<string, number>;
  };
  rows: Array<{
    label: string;
    mode: string;
    rows: number;
    json_valid_rate: number | null;
    species_set_exact_rate: number | null;
    blank_correct_rate: number | null;
    review_correct_rate: number | null;
    has_evidence_rate: number | null;
    has_tool_calls_rate: number | null;
    mean_generation_chars: number | null;
  }>;
};

export type ReviewTask = {
  task_id: string;
  capture_event_id: string;
  site_id: string;
  local_datetime: string;
  thumbnail_url: string | null;
  status: "pending" | "auto_accept" | "resolved";
  action: Record<string, unknown> | null;
  proposed_label: string;
  confidence: string;
  review_needed: boolean;
  priority: string;
  reasons: string[];
  route: string;
};

export type ReviewTasksResponse = {
  tasks: ReviewTask[];
  actions: Array<Record<string, unknown>>;
};

export type ReviewExportResponse = {
  rows: Array<Record<string, unknown>>;
  csv: string;
};

export type IntelligenceSummary = {
  migration_pulse: {
    focus_species: string[];
    year_species_counts: Array<{ key: string; count: number }>;
  };
  predator_prey_graph: {
    predator_species: string[];
    prey_species: string[];
    overlap_sites: Array<{ site_id: string; predators: string[]; prey: string[] }>;
    yearly_graphs: Array<{
      year: string;
      predators: Array<{ key: string; count: number }>;
      prey: Array<{ key: string; count: number }>;
      edges: Array<{
        year: string;
        predator: string;
        prey: string;
        predator_events: number;
        prey_events: number;
        weight: number;
      }>;
      summary: string;
    }>;
    yearly_edges: Array<{
      year: string;
      predator: string;
      prey: string;
      predator_events: number;
      prey_events: number;
      weight: number;
    }>;
  };
  behavior_shift_monitor: {
    behavior_counts: Array<{ key: string; count: number }>;
  };
  rare_anomaly_radar: {
    rare_species: Array<{ key: string; count: number }>;
    review_events: DetectionSearchResponse["rows"];
  };
  camera_placement_optimizer: {
    candidates: Array<{ site_id: string; score: number; rationale: string }>;
  };
  conservation_reports: {
    available_reports: string[];
  };
};

export type ConservationReport = {
  schema_version: string;
  report_id: string;
  report_type: string;
  generated_at: string;
  scope: Record<string, unknown>;
  observed: string[];
  measured: string[];
  inferred: string[];
  uncertainty: string[];
  evidence: Array<Record<string, unknown>>;
};

export const API_BASE =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") || "http://localhost:8787";

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers
    }
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `HTTP ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export async function fetchHealth() {
  return requestJson<HealthStatus>("/api/health");
}

export async function fetchDemoEvents() {
  const payload = await requestJson<{ events: DemoEvent[] }>("/api/demo/events");
  return payload.events;
}

export async function fetchHiddenLabel(eventId: string) {
  return requestJson<HiddenLabel>(`/api/demo/events/${eventId}/label`);
}

export async function runInference(
  eventId: string,
  options: { thinking: boolean; numPredict: number; forceLive?: boolean }
) {
  return requestJson<ModelPrediction>("/api/infer", {
    method: "POST",
    body: JSON.stringify({
      eventId,
      thinking: options.thinking,
      numPredict: options.numPredict,
      forceLive: Boolean(options.forceLive)
    })
  });
}

export async function askCopilot(
  eventId: string,
  options: {
    question: string;
    prediction: ModelPrediction["result"] | null;
    thinking: boolean;
    numPredict?: number;
  }
) {
  return requestJson<CopilotAnswer>("/api/copilot", {
    method: "POST",
    body: JSON.stringify({
      eventId,
      question: options.question,
      prediction: options.prediction
        ? {
            parsed: options.prediction.parsed,
            validation: options.prediction.validation,
            latencyMs: options.prediction.latencyMs,
            cachedCurated: Boolean(options.prediction.cachedCurated)
          }
        : null,
      thinking: options.thinking,
      numPredict: options.numPredict || 512
    })
  });
}

export async function fetchToolRegistry() {
  return requestJson<ToolRegistryResponse>("/api/tools");
}

export async function runTool(toolName: string, args: Record<string, unknown>) {
  return requestJson<Record<string, unknown>>(`/api/tools/${toolName}`, {
    method: "POST",
    body: JSON.stringify(args)
  });
}

export async function fetchDetectionSearch(params: {
  siteIds?: string[];
  species?: string[];
  groupBy?: string[];
  limit?: number;
} = {}) {
  const query = new URLSearchParams();
  if (params.siteIds?.length) query.set("site_ids", params.siteIds.join(","));
  if (params.species?.length) query.set("species", params.species.join(","));
  if (params.groupBy?.length) query.set("group_by", params.groupBy.join(","));
  if (params.limit) query.set("limit", String(params.limit));
  return requestJson<DetectionSearchResponse>(`/api/detections/search${query.size ? `?${query}` : ""}`);
}

export async function fetchSites() {
  return requestJson<SitesResponse>("/api/sites");
}

export async function fetchEnvironmentExtract(siteIds: string[] = []) {
  const query = new URLSearchParams();
  if (siteIds.length) query.set("site_ids", siteIds.join(","));
  return requestJson<EnvironmentExtractResponse>(`/api/environment/extract${query.size ? `?${query}` : ""}`);
}

export async function fetchBenchmarks() {
  return requestJson<BenchmarkSummary>("/api/benchmarks/summary");
}

export async function fetchReviewTasks() {
  return requestJson<ReviewTasksResponse>("/api/review/tasks");
}

export async function resolveReviewTask(
  taskId: string,
  payload: { action: "accept" | "correct" | "escalate"; correctedLabel?: string; notes?: string }
) {
  return requestJson<ReviewTasksResponse>(`/api/review/${taskId}/resolve`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function exportReviewActions() {
  return requestJson<ReviewExportResponse>("/api/review/export");
}

export async function fetchIntelligenceSummary() {
  return requestJson<IntelligenceSummary>("/api/intelligence/summary");
}

export async function fetchReport(reportId: string) {
  return requestJson<ConservationReport>(`/api/reports/${reportId}`);
}
