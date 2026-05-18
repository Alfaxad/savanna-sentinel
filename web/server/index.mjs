import cors from "cors";
import express from "express";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, "..");
const projectRoot = process.env.SAVANNA_ROOT
  ? path.resolve(process.env.SAVANNA_ROOT)
  : path.resolve(webRoot, "..");
const dataRoot = path.join(projectRoot, "data");

const PORT = Number(process.env.SAVANNA_API_PORT || 8787);
const OLLAMA_URL = process.env.OLLAMA_URL || "http://127.0.0.1:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "wild-gemma4:e4b";

const promptPath = path.join(
  dataRoot,
  "demo/public_replay_stream/phase1_event_interpreter_demo_stream_prompts.jsonl"
);
const hiddenLabelPath = path.join(
  dataRoot,
  "demo/hidden_label_stream/phase1_event_interpreter_demo_stream_hidden_labels.jsonl"
);
const reviewPromptPath = path.join(
  dataRoot,
  "demo/public_replay_stream/phase2_review_router_demo_stream_prompts.jsonl"
);
const reviewHiddenLabelPath = path.join(
  dataRoot,
  "demo/hidden_label_stream/phase2_review_router_demo_stream_hidden_labels.jsonl"
);
const environmentPath = path.join(
  dataRoot,
  "processed/environmental_features/snapshot_serengeti_50gb_event_environment_features.csv"
);
const taxonomyPath = path.join(dataRoot, "processed/schemas/species_taxonomy.json");
const speciesProfilesPath = path.join(dataRoot, "processed/schemas/species_profiles.json");
const toolRegistryPath = path.join(dataRoot, "processed/schemas/savanna_sentinel_tool_registry.json");
const searchEffortPath = path.join(dataRoot, "raw/snapshot_serengeti_dryad/search_effort.csv");
const curatedIdsPath = path.join(dataRoot, "demo/curated/ollama_correct_event_ids.json");
const curatedResultsPath = path.join(dataRoot, "demo/curated/ollama_correct_events.jsonl");
const curatedSummaryPath = path.join(dataRoot, "demo/curated/ollama_demo_curation_summary.json");
const reviewActionsPath = path.join(dataRoot, "demo/review/review_actions.jsonl");
const metricsRoot = path.join(projectRoot, "model_metrics/huggingface/wild-gemma-4-E4B-it/metrics");

let cache;

function parseJsonl(text) {
  return text
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function parseCsv(text) {
  const [headerLine, ...lines] = text.split(/\r?\n/).filter(Boolean);
  const headers = headerLine.split(",");
  return lines.map((line) => {
    const cells = line.split(",");
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]));
  });
}

function numberOrNull(value) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function compactLabel(value) {
  return String(value || "")
    .trim()
    .replace(/[_\s-]+/g, "")
    .toLowerCase();
}

function canonicalAnimal(value) {
  const label = compactLabel(value);
  if (!label) return null;
  const direct = new Map([
    ["gazelle", "gazelle"],
    ["gazellegrants", "gazelle"],
    ["gazellegrant", "gazelle"],
    ["grantsgazelle", "gazelle"],
    ["gazellethomsons", "gazelle"],
    ["gazellethomson", "gazelle"],
    ["thomsonsgazelle", "gazelle"],
    ["thompsonsgazelle", "gazelle"],
    ["lion", "lion"],
    ["lionfemale", "lion"],
    ["lionmale", "lion"],
    ["lioness", "lion"],
    ["hyena", "hyena"],
    ["hyenaspotted", "hyena"],
    ["hyenastriped", "hyena"],
    ["spottedhyena", "hyena"],
    ["stripedhyena", "hyena"],
    ["guineafowl", "guineafowl"],
    ["kori", "koribustard"],
    ["koribustard", "koribustard"],
    ["secretarybird", "secretarybird"],
    ["batearedfox", "batearedfox"],
    ["fox", "batearedfox"],
    ["monkey", "vervetmonkey"],
    ["vervet", "vervetmonkey"],
    ["vervetmonkey", "vervetmonkey"],
    ["bird", "bird"],
    ["otherbird", "bird"],
    ["rodent", "rodents"],
    ["rodents", "rodents"],
    ["reptile", "reptiles"],
    ["reptiles", "reptiles"],
    ["cat", "wildcat"],
    ["wildcat", "wildcat"]
  ]);
  if (direct.has(label)) return direct.get(label);
  for (const token of [
    "zebra",
    "elephant",
    "giraffe",
    "wildebeest",
    "buffalo",
    "impala",
    "ostrich",
    "warthog",
    "aardvark",
    "aardwolf",
    "baboon",
    "bushbuck",
    "caracal",
    "cheetah",
    "civet",
    "dikdik",
    "eland",
    "genet",
    "hare",
    "hartebeest",
    "hippopotamus",
    "honeybadger",
    "jackal",
    "leopard",
    "mongoose",
    "porcupine",
    "reedbuck",
    "rhinoceros",
    "serval",
    "topi",
    "waterbuck",
    "zorilla"
  ]) {
    if (label === token || label.includes(token)) return token;
  }
  if (label.includes("gazelle")) return "gazelle";
  if (label.includes("hyena")) return "hyena";
  if (label.includes("lion")) return "lion";
  if (label.includes("fowl")) return "guineafowl";
  if (label.includes("bustard")) return "koribustard";
  if (label.includes("bird")) return "bird";
  return label;
}

function extractTextContent(message) {
  if (!message) return "";
  if (typeof message.content === "string") return message.content;
  return message.content
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n");
}

function imageUrlFor(relativePath) {
  return `/api/images?path=${encodeURIComponent(relativePath)}`;
}

function sanitizeRelativeImagePath(relativePath) {
  const normalized = path.normalize(relativePath).replace(/^(\.\.[/\\])+/, "");
  const resolved = path.resolve(projectRoot, normalized);
  const allowedRoots = [
    path.resolve(dataRoot, "mirrored_images"),
    path.resolve(webRoot, "public/images")
  ];
  if (!allowedRoots.some((root) => resolved.startsWith(root + path.sep) || resolved === root)) {
    throw new Error("Image path is outside the allowed image roots.");
  }
  return resolved;
}

async function readJsonIfExists(filePath, fallback = null) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

async function readJsonlIfExists(filePath) {
  try {
    return parseJsonl(await fs.readFile(filePath, "utf8"));
  } catch {
    return [];
  }
}

async function loadCache() {
  if (cache) return cache;

  const [
    promptText,
    labelText,
    reviewPromptText,
    reviewLabelText,
    envText,
    taxonomyText,
    speciesProfilesText,
    toolRegistryText,
    searchEffortText
  ] = await Promise.all([
    fs.readFile(promptPath, "utf8"),
    fs.readFile(hiddenLabelPath, "utf8"),
    fs.readFile(reviewPromptPath, "utf8"),
    fs.readFile(reviewHiddenLabelPath, "utf8"),
    fs.readFile(environmentPath, "utf8"),
    fs.readFile(taxonomyPath, "utf8"),
    fs.readFile(speciesProfilesPath, "utf8"),
    fs.readFile(toolRegistryPath, "utf8"),
    fs.readFile(searchEffortPath, "utf8")
  ]);

  const prompts = parseJsonl(promptText);
  const labels = new Map(parseJsonl(labelText).map((item) => [item.capture_event_id, item]));
  const reviewPrompts = new Map(
    parseJsonl(reviewPromptText).map((item) => [item.sample_id.match(/ASG[0-9a-z]+/)?.[0], item])
  );
  const reviewLabels = new Map(parseJsonl(reviewLabelText).map((item) => [item.capture_event_id, item]));
  const environment = new Map(parseCsv(envText).map((row) => [row.capture_event_id, row]));
  const taxonomy = JSON.parse(taxonomyText);
  const speciesProfiles = JSON.parse(speciesProfilesText).profiles || {};
  const toolRegistry = JSON.parse(toolRegistryText);
  const searchEffortRows = parseCsv(searchEffortText).map((row) => ({
    siteId: row["Site ID"],
    dateStart: row["Start date"],
    dateEnd: row["End date"]
  }));
  let curatedIds = null;
  let curatedOrder = new Map();
  let curatedResults = new Map();
  try {
    const curated = JSON.parse(await fs.readFile(curatedIdsPath, "utf8"));
    const acceptedIds = curated.acceptedIds || [];
    curatedIds = new Set(acceptedIds);
    curatedOrder = new Map(acceptedIds.map((eventId, index) => [eventId, index]));
    curatedResults = new Map(
      parseJsonl(await fs.readFile(curatedResultsPath, "utf8")).map((item) => [item.eventId, item])
    );
  } catch {
    curatedIds = null;
  }

  const events = prompts.map((item, index) => {
    const eventId = item.sample_id.match(/ASG[0-9a-z]+/)?.[0];
    const hidden = labels.get(eventId);
    const reviewPrompt = reviewPrompts.get(eventId);
    const reviewHidden = reviewLabels.get(eventId);
    const env = environment.get(eventId);
    const userMessage = item.messages.find((message) => message.role === "user");
    const systemMessage = item.messages.find((message) => message.role === "system");
    const localDatetime =
      hidden?.target?.event?.local_datetime ||
      extractTextContent(userMessage).match(/local_datetime:\s*([^\n]+)/)?.[1] ||
      env?.datetime ||
      null;
    const siteId =
      hidden?.target?.event?.site_id ||
      extractTextContent(userMessage).match(/camera site ([A-Z][0-9]{2})/)?.[1] ||
      env?.site_id ||
      "unknown";
    const images = item.images.map((relativePath) => ({
      path: relativePath,
      url: imageUrlFor(relativePath),
      filename: path.basename(relativePath)
    }));

    return {
      index,
      sampleId: item.sample_id,
      eventId,
      split: item.split,
      task: item.task,
      siteId,
      localDatetime,
      frameCount: images.length,
      images,
      prompt: {
        system: extractTextContent(systemMessage),
        user: extractTextContent(userMessage)
      },
      reviewRouter: reviewPrompt
        ? {
            sampleId: reviewPrompt.sample_id,
            task: reviewPrompt.task,
            prompt: {
              system: extractTextContent(reviewPrompt.messages.find((message) => message.role === "system")),
              user: extractTextContent(reviewPrompt.messages.find((message) => message.role === "user"))
            }
          }
        : null,
      environment: env
        ? {
            status: env.environment_feature_status,
            longitude: numberOrNull(env.longitude),
            latitude: numberOrNull(env.latitude),
            month: env.month,
            chirpsMonthlyMm: numberOrNull(env.chirps_monthly_mm),
            modisEviMean: numberOrNull(env.modis_evi_mean),
            modisNdviMean: numberOrNull(env.modis_ndvi_mean),
            waterOccurrencePct: numberOrNull(env.jrc_water_occurrence_pct),
            modisFirstDate: env.modis_first_calendar_date,
            modisLatestDate: env.modis_latest_calendar_date
          }
        : null,
      allowedSpecies: taxonomy.species,
      hiddenLabelAvailable: Boolean(hidden),
      hiddenReviewAvailable: Boolean(reviewHidden),
      curation: curatedResults.get(eventId)
        ? {
            acceptedSettings: curatedResults.get(eventId).acceptedSettings,
            finalEvaluation: curatedResults.get(eventId).finalEvaluation,
            acceptedAttempt: curatedResults
              .get(eventId)
              .attempts?.find((attempt) => attempt.evaluation?.accepted)
          }
        : null
    };
  })
    .filter((event) => !curatedIds || curatedIds.has(event.eventId))
    .sort((a, b) => {
      if (!curatedIds) return a.index - b.index;
      return (
        (curatedOrder.get(a.eventId) ?? Number.MAX_SAFE_INTEGER) -
        (curatedOrder.get(b.eventId) ?? Number.MAX_SAFE_INTEGER)
      );
    });

  cache = {
    events,
    labels,
    reviewLabels,
    speciesProfiles,
    toolRegistry,
    searchEffortRows
  };
  return cache;
}

function buildInferencePrompt(event, thinking) {
  const systemPrefix = thinking ? "<|think|>\n" : "";
  const system = `${systemPrefix}You are Savanna Sentinel, a Serengeti camera-trap event interpreter. Return only valid compact JSON matching savanna_sentinel_event_v1. Use image evidence only for animal presence, species, count, behavior, and young-present claims. Do not use habitat, map, or satellite data as animal-presence evidence.`;
  const context = {
    capture_event_id: event.eventId,
    site_id: event.siteId,
    local_datetime: event.localDatetime,
    frame_count: event.frameCount,
    frame_order: "chronological",
    allowed_species_taxonomy: "snapshot_serengeti_selected_47",
    environmental_context_for_review_only: event.environment
      ? {
          chirps_monthly_mm: event.environment.chirpsMonthlyMm,
          modis_evi_mean: event.environment.modisEviMean,
          modis_ndvi_mean: event.environment.modisNdviMean,
          water_occurrence_pct: event.environment.waterOccurrencePct
        }
      : null
  };

  const allowedSpecies = event.allowedSpecies.join(", ");
  const user = `Classify this Snapshot Serengeti camera-trap capture event.

Return exactly one JSON object with this shape:
{
  "schema_version": "savanna_sentinel_event_v1",
  "capture_event_id": "${event.eventId}",
  "event": {
    "blank": boolean,
    "site_id": "${event.siteId}",
    "local_datetime": "${event.localDatetime}",
    "frame_count": ${event.frameCount},
    "frames_used": "all_available"
  },
  "detections": [
    {
      "species": "taxonomy_label",
      "count": {"bin": "1|2|3|4|5|6-10|11-50|51+", "minimum": number, "maximum": number},
      "behaviors": {"standing": boolean, "resting": boolean, "moving": boolean, "eating": boolean, "interacting": boolean},
      "young_present": boolean,
      "confidence": {"label": "high|medium|low", "basis": ["visual reason"]}
    }
  ],
  "review": {"review_needed": boolean, "priority": "none|medium|high", "reasons": []},
  "grounding": {"environment_used_for_species_claim": false, "image_evidence_required": true}
}

Allowed species labels:
${allowedSpecies}

Rules:
- If no animal is visible, set event.blank=true and detections=[].
- If an animal is visible but species is uncertain, choose the closest label from the allowed species list only, lower confidence, and set review.review_needed=true.
- Do not output species labels outside the allowed list.
- Do not claim lion, leopard, cheetah, hyena, or other predator unless predator features are visually clear.

Input context:
${JSON.stringify(context, null, 2)}`;

  return { system, user };
}

function extractJson(text) {
  if (!text) return null;
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

function validatePrediction(parsed, event) {
  const warnings = [];
  if (!parsed || typeof parsed !== "object") {
    return {
      jsonOk: false,
      schemaOk: false,
      speciesOk: false,
      warnings: ["response_did_not_contain_parseable_json"]
    };
  }

  const schemaOk = parsed.schema_version === "savanna_sentinel_event_v1";
  if (!schemaOk) warnings.push("schema_version_mismatch");
  if (parsed.capture_event_id !== event.eventId) warnings.push("capture_event_id_mismatch");

  const detections = Array.isArray(parsed.detections) ? parsed.detections : [];
  const allowed = new Set(event.allowedSpecies);
  const allowedCanonical = new Set(event.allowedSpecies.map(canonicalAnimal));
  const invalidSpecies = detections
    .map((detection) => detection?.species)
    .filter((species) => species && !allowed.has(species) && !allowedCanonical.has(canonicalAnimal(species)));
  if (invalidSpecies.length) warnings.push(`species_not_in_taxonomy:${invalidSpecies.join("|")}`);

  return {
    jsonOk: true,
    schemaOk: schemaOk && warnings.length === 0,
    speciesOk: invalidSpecies.length === 0,
    warnings
  };
}

function stripThinkingChannels(text) {
  return String(text || "")
    .replace(/<\|channel\>thought[\s\S]*?<channel\|>/g, "")
    .replace(/<\|channel\>final\s*/g, "")
    .trim();
}

function predictionSpeciesLabels(prediction) {
  const detections = prediction?.parsed?.detections;
  if (!Array.isArray(detections)) return [];
  return [...new Set(detections.map((detection) => detection?.species).filter(Boolean))];
}

function lookupSpeciesProfile(label, speciesProfiles) {
  const candidates = [label, canonicalAnimal(label)].filter(Boolean);
  for (const candidate of candidates) {
    if (speciesProfiles[candidate]) return { key: candidate, profile: speciesProfiles[candidate] };
  }

  const normalizedCandidates = new Set(candidates.map(compactLabel));
  if (normalizedCandidates.has("bird")) normalizedCandidates.add("otherbird");

  for (const [key, profile] of Object.entries(speciesProfiles)) {
    if (normalizedCandidates.has(compactLabel(key))) return { key, profile };
  }
  return null;
}

function selectSpeciesProfiles(speciesLabels, speciesProfiles) {
  const selected = [];
  const seen = new Set();
  for (const label of speciesLabels) {
    const match = lookupSpeciesProfile(label, speciesProfiles);
    if (match && !seen.has(match.key)) {
      selected.push({ label, profile_key: match.key, ...match.profile });
      seen.add(match.key);
    }
  }
  return selected;
}

function asDateOnly(value) {
  if (!value) return null;
  return String(value).slice(0, 10);
}

function dateMs(value) {
  const date = new Date(`${asDateOnly(value)}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date.getTime();
}

function overlapsDateRange(startA, endA, startB, endB) {
  const a0 = dateMs(startA);
  const a1 = dateMs(endA || startA);
  const b0 = dateMs(startB || "1900-01-01");
  const b1 = dateMs(endB || "2100-01-01");
  if ([a0, a1, b0, b1].some((value) => value === null)) return true;
  return a0 <= b1 && b0 <= a1;
}

function daysOverlapped(startA, endA, startB, endB) {
  const a0 = dateMs(startA);
  const a1 = dateMs(endA || startA);
  const b0 = dateMs(startB);
  const b1 = dateMs(endB);
  if ([a0, a1, b0, b1].some((value) => value === null)) return 0;
  const start = Math.max(a0, b0);
  const end = Math.min(a1, b1);
  return Math.max(0, Math.round((end - start) / 86400000) + 1);
}

function confidenceScore(label) {
  const normalized = String(label || "").toLowerCase();
  if (normalized === "high") return 0.9;
  if (normalized === "medium") return 0.62;
  if (normalized === "low") return 0.35;
  return null;
}

function predictionForEvent(event) {
  const attempt = event.curation?.acceptedAttempt;
  if (!attempt?.parsed) return null;
  return {
    source: "cached_curated_prediction",
    model: OLLAMA_MODEL,
    parsed: attempt.parsed,
    raw: attempt.raw,
    latencyMs: attempt.latencyMs,
    thinking: Boolean(attempt.thinking),
    validation: validatePrediction(attempt.parsed, event)
  };
}

function detectionsFromPrediction(event) {
  const prediction = predictionForEvent(event);
  const parsed = prediction?.parsed;
  const root = parsed && typeof parsed === "object" ? parsed : {};
  const eventBlock = root.event || {};
  const detections = Array.isArray(root.detections) ? root.detections : [];
  const review = root.review || {};
  if (eventBlock.blank || root.blank) {
    return [
      {
        capture_event_id: event.eventId,
        site_id: event.siteId,
        local_datetime: event.localDatetime,
        year: asDateOnly(event.localDatetime)?.slice(0, 4),
        species: "blank",
        canonical_species: "blank",
        confidence_label: "high",
        confidence_score: 0.9,
        count_bin: "0",
        behaviors: [],
        review_needed: Boolean(review.review_needed),
        review_priority: review.priority || "none",
        source: "prediction"
      }
    ];
  }
  return detections.map((detection) => {
    const confidenceLabel = detection?.confidence?.label || "unknown";
    return {
      capture_event_id: event.eventId,
      site_id: event.siteId,
      local_datetime: event.localDatetime,
      year: asDateOnly(event.localDatetime)?.slice(0, 4),
      species: detection?.species || "unknown",
      canonical_species: canonicalAnimal(detection?.species) || "unknown",
      confidence_label: confidenceLabel,
      confidence_score: confidenceScore(confidenceLabel),
      count_bin: detection?.count?.bin || "unknown",
      behaviors: Object.entries(detection?.behaviors || {})
        .filter(([, value]) => Boolean(value))
        .map(([key]) => key),
      young_present: Boolean(detection?.young_present),
      review_needed: Boolean(review.review_needed),
      review_priority: review.priority || "none",
      source: "prediction"
    };
  });
}

function publicEventDetails(event) {
  const prediction = predictionForEvent(event);
  return {
    eventId: event.eventId,
    siteId: event.siteId,
    localDatetime: event.localDatetime,
    frameCount: event.frameCount,
    images: event.images,
    environment: event.environment,
    prediction: prediction
      ? {
          parsed: prediction.parsed,
          validation: prediction.validation,
          latencyMs: prediction.latencyMs,
          thinking: prediction.thinking,
          cachedCurated: true
        }
      : null,
    detections: detectionsFromPrediction(event)
  };
}

function queryDetectionsTool(events, args = {}) {
  const requestedSpecies = new Set((Array.isArray(args.species) ? args.species : [])
    .map(canonicalAnimal)
    .filter(Boolean));
  const requestedSites = new Set(Array.isArray(args.site_ids) ? args.site_ids : []);
  const minConfidence = numberOrNull(args.min_confidence);
  const limit = Math.max(1, Math.min(500, Number(args.limit) || 100));
  let rows = events.flatMap(detectionsFromPrediction);

  rows = rows.filter((row) => {
    if (requestedSpecies.size && !requestedSpecies.has(row.canonical_species)) return false;
    if (requestedSites.size && !requestedSites.has(row.site_id)) return false;
    if (!overlapsDateRange(row.local_datetime, row.local_datetime, args.date_start, args.date_end)) return false;
    if (minConfidence != null && (row.confidence_score == null || row.confidence_score < minConfidence)) return false;
    return true;
  });

  const groupBy = Array.isArray(args.group_by) ? args.group_by : [];
  const groups = new Map();
  if (groupBy.length) {
    for (const row of rows) {
      const key = groupBy.map((field) => row[field] ?? "unknown").join("|");
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          fields: Object.fromEntries(groupBy.map((field) => [field, row[field] ?? "unknown"])),
          events: 0,
          species: new Set()
        });
      }
      const group = groups.get(key);
      group.events += 1;
      group.species.add(row.canonical_species);
    }
  }

  return {
    tool: "query_detections",
    source: args.source || "prediction",
    source_note: "Public demo search uses cached curated model predictions, not hidden answer labels.",
    count: rows.length,
    rows: rows.slice(0, limit),
    groups: [...groups.values()].map((group) => ({
      ...group,
      species: [...group.species].sort()
    }))
  };
}

function getCameraEffortTool(searchEffortRows, args = {}) {
  const requestedSites = new Set(Array.isArray(args.site_ids) ? args.site_ids : []);
  const dateStart = args.date_start || "1900-01-01";
  const dateEnd = args.date_end || "2100-01-01";
  const windows = searchEffortRows.filter((row) => {
    if (requestedSites.size && !requestedSites.has(row.siteId)) return false;
    return overlapsDateRange(row.dateStart, row.dateEnd, dateStart, dateEnd);
  });
  const bySite = new Map();
  for (const row of windows) {
    if (!bySite.has(row.siteId)) {
      bySite.set(row.siteId, { site_id: row.siteId, active_windows: 0, active_camera_days: 0 });
    }
    const site = bySite.get(row.siteId);
    site.active_windows += 1;
    site.active_camera_days += daysOverlapped(row.dateStart, row.dateEnd, dateStart, dateEnd);
  }
  return {
    tool: "get_camera_effort",
    date_start: dateStart,
    date_end: dateEnd,
    site_count: bySite.size,
    total_active_camera_days: [...bySite.values()].reduce((sum, row) => sum + row.active_camera_days, 0),
    sites: [...bySite.values()].sort((a, b) => b.active_camera_days - a.active_camera_days)
  };
}

function extractEnvironmentTool(events, args = {}) {
  const requestedSites = new Set(Array.isArray(args.site_ids) ? args.site_ids : []);
  const rows = events
    .filter((event) => {
      if (requestedSites.size && !requestedSites.has(event.siteId)) return false;
      return overlapsDateRange(event.localDatetime, event.localDatetime, args.date_start, args.date_end);
    })
    .map((event) => ({
      capture_event_id: event.eventId,
      site_id: event.siteId,
      local_datetime: event.localDatetime,
      month: event.environment?.month || null,
      latitude: event.environment?.latitude ?? null,
      longitude: event.environment?.longitude ?? null,
      chirps_monthly_mm: event.environment?.chirpsMonthlyMm ?? null,
      modis_evi_mean: event.environment?.modisEviMean ?? null,
      modis_ndvi_mean: event.environment?.modisNdviMean ?? null,
      water_occurrence_pct: event.environment?.waterOccurrencePct ?? null,
      feature_status: event.environment?.status || "missing"
    }));
  const mean = (field) => {
    const values = rows.map((row) => row[field]).filter((value) => typeof value === "number" && Number.isFinite(value));
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  };
  return {
    tool: "extract_environment",
    count: rows.length,
    layers: Array.isArray(args.layers) ? args.layers : ["CHIRPS", "MODIS_EVI", "MODIS_NDVI", "JRC_WATER"],
    summary: {
      mean_chirps_monthly_mm: mean("chirps_monthly_mm"),
      mean_modis_evi: mean("modis_evi_mean"),
      mean_modis_ndvi: mean("modis_ndvi_mean"),
      mean_water_occurrence_pct: mean("water_occurrence_pct")
    },
    rows
  };
}

function compareToBaselineTool(events, args = {}) {
  const period = extractEnvironmentTool(events, args);
  const baseline = extractEnvironmentTool(events, { site_ids: args.site_ids, layers: args.layers });
  const metricMap = {
    rainfall: "mean_chirps_monthly_mm",
    chirps_monthly_mm: "mean_chirps_monthly_mm",
    evi: "mean_modis_evi",
    modis_evi: "mean_modis_evi",
    ndvi: "mean_modis_ndvi",
    water: "mean_water_occurrence_pct"
  };
  const metric = metricMap[String(args.metric || "evi").toLowerCase()] || "mean_modis_evi";
  const current = period.summary[metric];
  const base = baseline.summary[metric];
  return {
    tool: "compare_to_baseline",
    metric,
    baseline_mode: args.baseline_mode || "all_history",
    current_value: current,
    baseline_value: base,
    delta: current != null && base != null ? current - base : null,
    interpretation:
      current == null || base == null
        ? "Not enough environmental records for comparison."
        : current > base
          ? "Current selected window is above the demo baseline."
          : current < base
            ? "Current selected window is below the demo baseline."
            : "Current selected window matches the demo baseline."
  };
}

function retrieveEvidenceImagesTool(events, args = {}) {
  const requestedIds = new Set(Array.isArray(args.capture_event_ids) ? args.capture_event_ids : []);
  return {
    tool: "retrieve_evidence_images",
    redact_humans: args.redact_humans !== false,
    rows: events
      .filter((event) => requestedIds.has(event.eventId))
      .map((event) => ({
        capture_event_id: event.eventId,
        site_id: event.siteId,
        local_datetime: event.localDatetime,
        images: event.images
      }))
  };
}

function siteSummaries(events) {
  const sites = new Map();
  for (const event of events) {
    const detections = detectionsFromPrediction(event);
    if (!sites.has(event.siteId)) {
      sites.set(event.siteId, {
        site_id: event.siteId,
        latitude: event.environment?.latitude ?? null,
        longitude: event.environment?.longitude ?? null,
        events: 0,
        review_needed: 0,
        species_counts: {},
        years: new Set(),
        rain_values: [],
        evi_values: []
      });
    }
    const site = sites.get(event.siteId);
    site.events += 1;
    site.years.add(asDateOnly(event.localDatetime)?.slice(0, 4));
    if (typeof event.environment?.chirpsMonthlyMm === "number") site.rain_values.push(event.environment.chirpsMonthlyMm);
    if (typeof event.environment?.modisEviMean === "number") site.evi_values.push(event.environment.modisEviMean);
    for (const detection of detections) {
      site.species_counts[detection.canonical_species] = (site.species_counts[detection.canonical_species] || 0) + 1;
      if (detection.review_needed) site.review_needed += 1;
    }
  }
  return [...sites.values()]
    .map((site) => ({
      site_id: site.site_id,
      latitude: site.latitude,
      longitude: site.longitude,
      events: site.events,
      review_needed: site.review_needed,
      species_counts: site.species_counts,
      years: [...site.years].filter(Boolean).sort(),
      mean_rainfall_mm: site.rain_values.length
        ? site.rain_values.reduce((sum, value) => sum + value, 0) / site.rain_values.length
        : null,
      mean_evi: site.evi_values.length ? site.evi_values.reduce((sum, value) => sum + value, 0) / site.evi_values.length : null
    }))
    .sort((a, b) => b.events - a.events);
}

async function loadReviewActions() {
  return readJsonlIfExists(reviewActionsPath);
}

function latestActionByEvent(actions) {
  const latest = new Map();
  for (const action of actions) latest.set(action.capture_event_id, action);
  return latest;
}

function buildReviewTasks(events, reviewLabels, actions) {
  const latest = latestActionByEvent(actions);
  return events
    .map((event) => {
      const prediction = predictionForEvent(event);
      const parsed = prediction?.parsed || {};
      const detection = Array.isArray(parsed.detections) ? parsed.detections[0] : null;
      const review = parsed.review || {};
      const hiddenReview = reviewLabels.get(event.eventId)?.target || null;
      const action = latest.get(event.eventId) || null;
      const reviewNeeded = Boolean(review.review_needed || hiddenReview?.review_needed);
      return {
        task_id: `review_${event.eventId}`,
        capture_event_id: event.eventId,
        site_id: event.siteId,
        local_datetime: event.localDatetime,
        thumbnail_url: event.images[0]?.url || null,
        status: action ? "resolved" : reviewNeeded ? "pending" : "auto_accept",
        action,
        proposed_label: detection?.species || (parsed.event?.blank ? "blank" : "unknown"),
        confidence: detection?.confidence?.label || "unknown",
        review_needed: reviewNeeded,
        priority: action?.priority || review.priority || hiddenReview?.priority || (reviewNeeded ? "medium" : "none"),
        reasons: action?.reasons || review.reasons || hiddenReview?.reasons || [],
        route: reviewNeeded ? "human_review" : "auto_accept"
      };
    })
    .sort((a, b) => {
      const rank = { pending: 0, auto_accept: 1, resolved: 2 };
      return rank[a.status] - rank[b.status] || String(a.capture_event_id).localeCompare(String(b.capture_event_id));
    });
}

async function appendReviewAction(event, body) {
  const actionType = String(body.action || body.decision || "accept");
  const decision = actionType === "accept" ? "accept" : "review";
  const action = {
    schema_version: "savanna_sentinel_review_action_v1",
    task_id: `review_${event.eventId}`,
    capture_event_id: event.eventId,
    action: actionType,
    decision,
    review_needed: decision !== "accept",
    priority: actionType === "escalate" ? "high" : decision === "review" ? "medium" : "none",
    corrected_label: String(body.correctedLabel || "").trim() || null,
    notes: String(body.notes || "").trim() || null,
    reasons: Array.isArray(body.reasons) ? body.reasons : actionType === "accept" ? ["accepted_model_output"] : [actionType],
    reviewer: "public_demo_session",
    created_at: new Date().toISOString()
  };
  await fs.mkdir(path.dirname(reviewActionsPath), { recursive: true });
  await fs.appendFile(reviewActionsPath, `${JSON.stringify(action)}\n`);
  return action;
}

function exportReviewActions(events, actions) {
  const eventById = new Map(events.map((event) => [event.eventId, event]));
  const rows = actions.map((action) => {
    const event = eventById.get(action.capture_event_id);
    return {
      capture_event_id: action.capture_event_id,
      site_id: event?.siteId || null,
      local_datetime: event?.localDatetime || null,
      action: action.action,
      decision: action.decision,
      corrected_label: action.corrected_label,
      notes: action.notes,
      reviewer: action.reviewer,
      created_at: action.created_at
    };
  });
  const headers = [
    "capture_event_id",
    "site_id",
    "local_datetime",
    "action",
    "decision",
    "corrected_label",
    "notes",
    "reviewer",
    "created_at"
  ];
  const csv = [
    headers.join(","),
    ...rows.map((row) =>
      headers
        .map((header) => `"${String(row[header] ?? "").replaceAll('"', '""')}"`)
        .join(",")
    )
  ].join("\n");
  return { rows, csv };
}

async function loadBenchmarkSummary() {
  const [base, finetuned, ollama, trainMetrics, demoCuration] = await Promise.all([
    readJsonIfExists(path.join(metricsRoot, "base_eval_summary.json"), {}),
    readJsonIfExists(path.join(metricsRoot, "finetuned_eval_summary.json"), {}),
    readJsonIfExists(path.join(metricsRoot, "evaluation_ollama_manual_combined_q4_officialmeta_redo.json"), {}),
    readJsonIfExists(path.join(metricsRoot, "train_metrics.json"), {}),
    readJsonIfExists(curatedSummaryPath, {})
  ]);
  const row = (label, mode, payload) => {
    const overall = payload?.[mode]?.overall || {};
    return {
      label,
      mode,
      rows: overall.rows ?? 0,
      json_valid_rate: overall.json_valid_rate ?? null,
      species_set_exact_rate: overall.species_set_exact_rate ?? null,
      blank_correct_rate: overall.blank_correct_rate ?? null,
      review_correct_rate: overall.review_correct_rate ?? null,
      has_evidence_rate: overall.has_evidence_rate ?? null,
      has_tool_calls_rate: overall.has_tool_calls_rate ?? null,
      mean_generation_chars: overall.mean_generation_chars ?? null
    };
  };
  return {
    generated_at: new Date().toISOString(),
    training: trainMetrics,
    demo_curation: demoCuration,
    rows: [
      row("Base Gemma 4 E4B", "direct", base),
      row("HF fine-tuned wild-gemma", "direct", finetuned),
      row("HF fine-tuned wild-gemma", "thinking", finetuned),
      row("Ollama wild-gemma4:e4b Q4", "direct", ollama),
      row("Ollama wild-gemma4:e4b Q4", "thinking", ollama)
    ]
  };
}

function buildIntelligenceSummary(events) {
  const allDetections = events.flatMap(detectionsFromPrediction);
  const animalDetections = allDetections.filter((row) => row.canonical_species !== "blank");
  const countBy = (rows, keyFn) => {
    const map = new Map();
    for (const row of rows) {
      const key = keyFn(row);
      map.set(key, (map.get(key) || 0) + 1);
    }
    return [...map.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count);
  };
  const focusSpecies = new Set(["wildebeest", "zebra", "gazelle", "buffalo", "impala"]);
  const predators = new Set(["lion", "hyena", "leopard", "cheetah", "jackal"]);
  const prey = new Set(["zebra", "wildebeest", "gazelle", "impala", "buffalo", "topi", "hartebeest"]);
  const speciesCounts = countBy(animalDetections, (row) => row.canonical_species);
  const rareSpecies = speciesCounts.filter((row) => row.count <= 1 && row.key !== "unknown");
  const siteSpecies = new Map();
  for (const row of animalDetections) {
    if (!siteSpecies.has(row.site_id)) siteSpecies.set(row.site_id, new Set());
    siteSpecies.get(row.site_id).add(row.canonical_species);
  }
  const predatorPreySites = [...siteSpecies.entries()]
    .map(([siteId, species]) => ({
      site_id: siteId,
      predators: [...species].filter((item) => predators.has(item)),
      prey: [...species].filter((item) => prey.has(item))
    }))
    .filter((row) => row.predators.length && row.prey.length);
  const years = [...new Set(events.map((event) => asDateOnly(event.localDatetime)?.slice(0, 4)).filter(Boolean))].sort();
  const yearlyPredatorPreyGraphs = years.map((year) => {
    const rows = animalDetections.filter((row) => row.year === year);
    const predatorCounts = countBy(
      rows.filter((row) => predators.has(row.canonical_species)),
      (row) => row.canonical_species
    );
    const preyCounts = countBy(
      rows.filter((row) => prey.has(row.canonical_species)),
      (row) => row.canonical_species
    );
    const edges = [];
    for (const predatorRow of predatorCounts) {
      for (const preyRow of preyCounts) {
        edges.push({
          year,
          predator: predatorRow.key,
          prey: preyRow.key,
          predator_events: predatorRow.count,
          prey_events: preyRow.count,
          weight: predatorRow.count * preyRow.count
        });
      }
    }
    edges.sort((a, b) => b.weight - a.weight);
    return {
      year,
      predators: predatorCounts,
      prey: preyCounts,
      edges: edges.slice(0, 8),
      summary:
        predatorCounts.length && preyCounts.length
          ? `${predatorCounts.length} predator group(s), ${preyCounts.length} prey group(s), ${edges.length} yearly link(s).`
          : predatorCounts.length
            ? `${predatorCounts.length} predator group(s), no focus prey detections in this demo year.`
            : preyCounts.length
              ? `No predator detections; ${preyCounts.length} focus prey group(s) in this demo year.`
              : "No predator or focus prey detections in this demo year."
    };
  });
  const behaviorRows = [];
  for (const row of animalDetections) {
    for (const behavior of row.behaviors || []) {
      behaviorRows.push({ ...row, behavior });
    }
  }
  const siteRows = siteSummaries(events);
  const placementCandidates = siteRows
    .map((site) => {
      const diversity = Object.keys(site.species_counts).filter((species) => species !== "blank").length;
      const uncertainty = site.review_needed / Math.max(1, site.events);
      const underSampled = 1 / Math.max(1, site.events);
      const habitat = (site.mean_evi || 0) + (site.mean_rainfall_mm || 0) / 100;
      return {
        site_id: site.site_id,
        score: Number((diversity * 0.4 + uncertainty * 0.35 + underSampled * 0.15 + habitat * 0.1).toFixed(3)),
        rationale: `${diversity} detected animal group(s), ${site.review_needed} review case(s), ${site.events} curated event(s).`
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);
  return {
    migration_pulse: {
      focus_species: [...focusSpecies],
      year_species_counts: countBy(
        animalDetections.filter((row) => focusSpecies.has(row.canonical_species)),
        (row) => `${row.year}:${row.canonical_species}`
      ).slice(0, 12)
    },
    predator_prey_graph: {
      predator_species: [...predators],
      prey_species: [...prey],
      overlap_sites: predatorPreySites.slice(0, 8),
      yearly_graphs: yearlyPredatorPreyGraphs,
      yearly_edges: yearlyPredatorPreyGraphs.flatMap((graph) => graph.edges)
    },
    behavior_shift_monitor: {
      behavior_counts: countBy(behaviorRows, (row) => `${row.behavior}:${row.canonical_species}`).slice(0, 12)
    },
    rare_anomaly_radar: {
      rare_species: rareSpecies,
      review_events: allDetections.filter((row) => row.review_needed).slice(0, 12)
    },
    camera_placement_optimizer: {
      candidates: placementCandidates
    },
    conservation_reports: {
      available_reports: ["ranger-brief", "scientist-brief", "public-brief"]
    }
  };
}

async function buildReport(reportId, events) {
  const benchmarks = await loadBenchmarkSummary();
  const intelligence = buildIntelligenceSummary(events);
  const detections = queryDetectionsTool(events, { limit: 500 }).rows.filter((row) => row.canonical_species !== "blank");
  const speciesCounts = {};
  for (const row of detections) speciesCounts[row.canonical_species] = (speciesCounts[row.canonical_species] || 0) + 1;
  const topSpecies = Object.entries(speciesCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([species, count]) => `${species}: ${count}`);
  const env = extractEnvironmentTool(events);
  const demo = benchmarks.demo_curation || {};
  const reportType = {
    "ranger-brief": "ranger",
    "scientist-brief": "scientist",
    "public-brief": "public"
  }[reportId] || "public";
  return {
    schema_version: "savanna_sentinel_report_v1",
    report_id: reportId,
    report_type: reportType,
    generated_at: new Date().toISOString(),
    scope: {
      events: events.length,
      years: [...new Set(events.map((event) => asDateOnly(event.localDatetime)?.slice(0, 4)).filter(Boolean))].sort(),
      source: "curated public demo stream"
    },
    observed: [
      `${detections.length} non-blank model detections across ${events.length} curated replay events.`,
      `Top predicted groups: ${topSpecies.join(", ") || "none"}.`,
      `${demo.accepted || events.length} events passed curation for parseable schema and animal-label agreement.`
    ],
    measured: [
      `Mean monthly rainfall in selected demo events: ${
        env.summary.mean_chirps_monthly_mm == null ? "not available" : env.summary.mean_chirps_monthly_mm.toFixed(1)
      } mm.`,
      `Mean MODIS EVI in selected demo events: ${
        env.summary.mean_modis_evi == null ? "not available" : env.summary.mean_modis_evi.toFixed(2)
      }.`,
      `Ollama curated acceptance rate: ${
        demo.acceptanceRate == null ? "not available" : `${(demo.acceptanceRate * 100).toFixed(1)}%`
      }.`
    ],
    inferred: [
      `Review routing should prioritize ${intelligence.rare_anomaly_radar.review_events.length} uncertain or routed events in the visible demo slice.`,
      `Camera placement candidates emphasize sites with diversity, uncertainty, and under-sampled coverage.`
    ],
    uncertainty: [
      "This public report uses curated model predictions and environmental context; hidden labels are only for reveal/evaluation flows.",
      "The demo stream is historical Snapshot Serengeti data, not a live current-animal-presence feed.",
      "Environmental layers contextualize detections and must not be used as animal-presence evidence."
    ],
    evidence: [
      { type: "events", count: events.length },
      { type: "environment", layers: ["CHIRPS", "MODIS_EVI", "MODIS_NDVI", "JRC_WATER"] },
      { type: "benchmark", rows: benchmarks.rows }
    ]
  };
}

async function executeTool(name, args, cachePayload) {
  const { events, searchEffortRows } = cachePayload;
  if (name === "query_detections") return queryDetectionsTool(events, args);
  if (name === "get_camera_effort") return getCameraEffortTool(searchEffortRows, args);
  if (name === "extract_environment") return extractEnvironmentTool(events, args);
  if (name === "compare_to_baseline") return compareToBaselineTool(events, args);
  if (name === "retrieve_evidence_images") return retrieveEvidenceImagesTool(events, args);
  throw new Error(`Unknown tool: ${name}`);
}

function buildCopilotPrompt(event, body, speciesProfiles) {
  const thinking = Boolean(body.thinking);
  const systemPrefix = thinking ? "<|think|>\n" : "";
  const system = `${systemPrefix}You are Savanna Sentinel Copilot, a grounded analyst assistant for a public Serengeti camera-trap demo.

Rules:
- Use only the provided public context, current model output, site metadata, and environmental features.
- Never use hidden labels, answer keys, or training labels. If asked for ground truth, say the hidden label can only be revealed by the UI after inference.
- Copilot chat receives text context only. It does not receive image pixels. Image filenames are not visual evidence.
- Do not infer animal presence from filenames, map, rainfall, EVI, NDVI, habitat, or site metadata. Animal claims must come from the current model output provided in context.
- If model_output is null, say that inference has not been run and avoid naming a species.
- You may use species_profiles only for educational species-background or fun-fact questions after a species appears in model_output.
- For fun-fact, animal-background, or ecological-role questions, start with "Species background:" and answer only from species_profiles.
- When using species_profiles, state that this is background information, not event evidence.
- For event-evidence or review-decision questions, do not use species_profiles as visual evidence.
- If species_profiles is empty, say no curated species background is available for the current model output.
- Separate measured context from model interpretation.
- If evidence is missing or uncertain, say so plainly.
- Keep answers concise: 2-5 short bullets or one compact paragraph.`;

  const speciesLabels = body.prediction ? predictionSpeciesLabels(body.prediction) : [];
  const matchedSpeciesProfiles = selectSpeciesProfiles(speciesLabels, speciesProfiles);

  const context = {
    event: {
      capture_event_id: event.eventId,
      site_id: event.siteId,
      local_datetime: event.localDatetime,
      frame_count: event.frameCount,
      image_filenames: event.images.map((image) => image.filename)
    },
    environment: event.environment
      ? {
          month: event.environment.month,
          latitude: event.environment.latitude,
          longitude: event.environment.longitude,
          chirps_monthly_mm: event.environment.chirpsMonthlyMm,
          modis_evi_mean: event.environment.modisEviMean,
          modis_ndvi_mean: event.environment.modisNdviMean,
          water_occurrence_pct: event.environment.waterOccurrencePct,
          feature_status: event.environment.status
        }
      : null,
    review_router: event.reviewRouter
      ? {
          task: event.reviewRouter.task,
          public_prompt_summary: event.reviewRouter.prompt.user.slice(0, 900)
        }
      : null,
    model_output: body.prediction
      ? {
          source: body.prediction.cachedCurated ? "cached_curated" : "live_ollama",
          parsed: body.prediction.parsed || null,
          validation: body.prediction.validation || null,
          latency_ms: body.prediction.latencyMs || null
      }
      : {
          status: "not_available",
          instruction: "No model output was supplied to copilot. Do not name a species or behavior."
        },
    species_profiles: matchedSpeciesProfiles
  };

  const user = `User question:
${String(body.question || "").slice(0, 800)}

Public context:
${JSON.stringify(context, null, 2)}`;

  return { system, user };
}

async function callCopilot(event, body, speciesProfiles) {
  const question = String(body.question || "").trim();
  if (!question) throw new Error("Copilot question is required.");

  const prompt = buildCopilotPrompt(event, body, speciesProfiles);
  const started = performance.now();
  const response = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: body.model || OLLAMA_MODEL,
      stream: false,
      messages: [
        { role: "system", content: prompt.system },
        { role: "user", content: prompt.user }
      ],
      options: {
        temperature: 0.2,
        top_p: 0.9,
        top_k: 40,
        seed: Number(process.env.OLLAMA_SEED || 751),
        num_predict: Number(body.numPredict) || 512
      }
    })
  });

  const elapsedMs = Math.round(performance.now() - started);
  if (!response.ok) {
    const responseBody = await response.text();
    throw new Error(`Ollama returned HTTP ${response.status}: ${responseBody.slice(0, 500)}`);
  }

  const data = await response.json();
  const raw = data.message?.content || data.response || "";
  return {
    eventId: event.eventId,
    model: body.model || OLLAMA_MODEL,
    latencyMs: elapsedMs,
    thinking: Boolean(body.thinking),
    question,
    answer: stripThinkingChannels(raw),
    raw,
    createdAt: data.created_at || new Date().toISOString()
  };
}

async function callOllama(event, options) {
  const prompt = buildInferencePrompt(event, options.thinking);
  const images = await Promise.all(
    event.images.map(async (image) => {
      const imagePath = sanitizeRelativeImagePath(image.path);
      const buffer = await fs.readFile(imagePath);
      return buffer.toString("base64");
    })
  );

  const started = performance.now();
  const response = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: options.model || OLLAMA_MODEL,
      stream: false,
      messages: [
        { role: "system", content: prompt.system },
        { role: "user", content: prompt.user, images }
      ],
      options: {
        temperature: 1.0,
        top_p: 0.95,
        top_k: 64,
        seed: Number(process.env.OLLAMA_SEED || 751),
        num_predict: options.numPredict || 1536
      }
    })
  });

  const elapsedMs = Math.round(performance.now() - started);
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Ollama returned HTTP ${response.status}: ${body.slice(0, 500)}`);
  }

  const data = await response.json();
  const raw = data.message?.content || data.response || "";
  const parsed = extractJson(raw);
  return {
    model: options.model || OLLAMA_MODEL,
    thinking: Boolean(options.thinking),
    latencyMs: elapsedMs,
    raw,
    parsed,
    validation: validatePrediction(parsed, event),
    doneReason: data.done_reason || null,
    createdAt: data.created_at || new Date().toISOString()
  };
}

async function inferPayload(events, body = {}) {
  const event = events.find((item) => item.eventId === body.eventId) || events[0];
  if (!event) {
    const error = new Error("No demo events are available.");
    error.statusCode = 404;
    throw error;
  }
  if (!body.forceLive && event.curation?.acceptedAttempt) {
    const attempt = event.curation.acceptedAttempt;
    return {
      eventId: event.eventId,
      result: {
        model: body.model || OLLAMA_MODEL,
        thinking: Boolean(attempt.thinking),
        latencyMs: attempt.latencyMs,
        raw: attempt.raw,
        parsed: attempt.parsed,
        validation: validatePrediction(attempt.parsed, event),
        doneReason: attempt.doneReason || null,
        createdAt: new Date().toISOString(),
        cachedCurated: true
      }
    };
  }
  const result = await callOllama(event, {
    thinking: Boolean(body.thinking),
    model: body.model,
    numPredict: Number(body.numPredict) || 1536
  });
  return { eventId: event.eventId, result };
}

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", async (_req, res) => {
  try {
    const response = await fetch(`${OLLAMA_URL}/api/tags`);
    const tags = response.ok ? await response.json() : null;
    res.json({
      ok: true,
      ollama: {
        reachable: response.ok,
        url: OLLAMA_URL,
        model: OLLAMA_MODEL,
        models: tags?.models?.map((model) => model.name) || []
      }
    });
  } catch (error) {
    res.json({
      ok: true,
      ollama: {
        reachable: false,
        url: OLLAMA_URL,
        model: OLLAMA_MODEL,
        error: error.message
      }
    });
  }
});

app.get("/api/tools", async (_req, res, next) => {
  try {
    const { toolRegistry } = await loadCache();
    res.json({
      tools: toolRegistry,
      endpoints: [
        "POST /api/events/classify",
        "GET /api/events/{capture_event_id}",
        "GET /api/detections/search",
        "GET /api/sites",
        "GET /api/environment/extract",
        "POST /api/chat",
        "GET /api/reports/{report_id}",
        "POST /api/review/{task_id}/resolve",
        "GET /api/benchmarks/summary"
      ]
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/tools/:toolName", async (req, res, next) => {
  try {
    const cachePayload = await loadCache();
    const result = await executeTool(req.params.toolName, req.body || {}, cachePayload);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.get("/api/demo/events", async (_req, res, next) => {
  try {
    const { events } = await loadCache();
    res.json({ events });
  } catch (error) {
    next(error);
  }
});

app.get("/api/demo/events/:eventId/label", async (req, res, next) => {
  try {
    const { labels, reviewLabels } = await loadCache();
    const label = labels.get(req.params.eventId);
    if (!label) {
      res.status(404).json({ error: "No hidden label for this event." });
      return;
    }
    res.json({
      ...label,
      review_target: reviewLabels.get(req.params.eventId)?.target || null,
      review_supervision: reviewLabels.get(req.params.eventId)?.supervision || null
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/events/classify", async (req, res, next) => {
  try {
    const { events } = await loadCache();
    res.json(await inferPayload(events, req.body));
  } catch (error) {
    next(error);
  }
});

app.get("/api/events/:eventId", async (req, res, next) => {
  try {
    const { events } = await loadCache();
    const event = events.find((item) => item.eventId === req.params.eventId);
    if (!event) {
      res.status(404).json({ error: "Event not found." });
      return;
    }
    res.json(publicEventDetails(event));
  } catch (error) {
    next(error);
  }
});

app.get("/api/detections/search", async (req, res, next) => {
  try {
    const { events } = await loadCache();
    const species = req.query.species ? String(req.query.species).split(",").filter(Boolean) : [];
    const siteIds = req.query.site_ids ? String(req.query.site_ids).split(",").filter(Boolean) : [];
    res.json(
      queryDetectionsTool(events, {
        species,
        site_ids: siteIds,
        date_start: req.query.date_start,
        date_end: req.query.date_end,
        min_confidence: req.query.min_confidence,
        source: req.query.source,
        limit: req.query.limit,
        group_by: req.query.group_by ? String(req.query.group_by).split(",").filter(Boolean) : []
      })
    );
  } catch (error) {
    next(error);
  }
});

app.get("/api/sites", async (_req, res, next) => {
  try {
    const { events } = await loadCache();
    res.json({ sites: siteSummaries(events) });
  } catch (error) {
    next(error);
  }
});

app.get("/api/environment/extract", async (req, res, next) => {
  try {
    const { events } = await loadCache();
    res.json(
      extractEnvironmentTool(events, {
        site_ids: req.query.site_ids ? String(req.query.site_ids).split(",").filter(Boolean) : [],
        date_start: req.query.date_start,
        date_end: req.query.date_end,
        layers: req.query.layers ? String(req.query.layers).split(",").filter(Boolean) : []
      })
    );
  } catch (error) {
    next(error);
  }
});

app.post("/api/chat", async (req, res, next) => {
  try {
    const { events, speciesProfiles } = await loadCache();
    const event = events.find((item) => item.eventId === req.body.eventId) || events[0];
    if (!event) {
      res.status(404).json({ error: "No demo events are available." });
      return;
    }
    const result = await callCopilot(event, req.body, speciesProfiles);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.get("/api/benchmarks/summary", async (_req, res, next) => {
  try {
    res.json(await loadBenchmarkSummary());
  } catch (error) {
    next(error);
  }
});

app.get("/api/review/tasks", async (_req, res, next) => {
  try {
    const { events, reviewLabels } = await loadCache();
    const actions = await loadReviewActions();
    res.json({ tasks: buildReviewTasks(events, reviewLabels, actions), actions });
  } catch (error) {
    next(error);
  }
});

app.post("/api/review/:taskId/resolve", async (req, res, next) => {
  try {
    const { events, reviewLabels } = await loadCache();
    const eventId = req.params.taskId.replace(/^review_/, "");
    const event = events.find((item) => item.eventId === eventId);
    if (!event) {
      res.status(404).json({ error: "Review task not found." });
      return;
    }
    const action = await appendReviewAction(event, req.body || {});
    const actions = await loadReviewActions();
    res.json({ action, tasks: buildReviewTasks(events, reviewLabels, actions) });
  } catch (error) {
    next(error);
  }
});

app.get("/api/review/export", async (_req, res, next) => {
  try {
    const { events } = await loadCache();
    const actions = await loadReviewActions();
    res.json(exportReviewActions(events, actions));
  } catch (error) {
    next(error);
  }
});

app.get("/api/intelligence/summary", async (_req, res, next) => {
  try {
    const { events } = await loadCache();
    res.json(buildIntelligenceSummary(events));
  } catch (error) {
    next(error);
  }
});

app.get("/api/reports/:reportId", async (req, res, next) => {
  try {
    const { events } = await loadCache();
    res.json(await buildReport(req.params.reportId, events));
  } catch (error) {
    next(error);
  }
});

app.post("/api/infer", async (req, res, next) => {
  try {
    const { events } = await loadCache();
    res.json(await inferPayload(events, req.body));
  } catch (error) {
    next(error);
  }
});

app.post("/api/copilot", async (req, res, next) => {
  try {
    const { events, speciesProfiles } = await loadCache();
    const event = events.find((item) => item.eventId === req.body.eventId) || events[0];
    if (!event) {
      res.status(404).json({ error: "No demo events are available." });
      return;
    }
    const result = await callCopilot(event, req.body, speciesProfiles);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.get("/api/images", async (req, res, next) => {
  try {
    const relativePath = String(req.query.path || "");
    const imagePath = sanitizeRelativeImagePath(relativePath);
    res.sendFile(imagePath);
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(error.statusCode || 500).json({ error: error.message || "Unknown server error" });
});

app.listen(PORT, () => {
  console.log(`Savanna Sentinel API listening on http://localhost:${PORT}`);
  console.log(`Ollama target: ${OLLAMA_URL} · ${OLLAMA_MODEL}`);
});
