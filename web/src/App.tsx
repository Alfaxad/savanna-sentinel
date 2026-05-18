import {
  Activity,
  AlertTriangle,
  Bell,
  BarChart3,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  CloudRain,
  Database,
  Download,
  Expand,
  Eye,
  FileText,
  GitBranch,
  Image as ImageIcon,
  Layers,
  Map as MapIcon,
  MapPin,
  Menu,
  Microscope,
  Mountain,
  Play,
  Radar,
  Search,
  SlidersHorizontal,
  Sparkles,
  Waypoints
} from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { type ElementType, useEffect, useMemo, useRef, useState } from "react";
import {
  API_BASE,
  BenchmarkSummary,
  ConservationReport,
  CopilotAnswer,
  DemoEvent,
  DetectionSearchResponse,
  HealthStatus,
  HiddenLabel,
  IntelligenceSummary,
  ModelPrediction,
  ReviewTask,
  SitesResponse,
  ToolRegistryResponse,
  askCopilot,
  exportReviewActions,
  fetchBenchmarks,
  fetchDemoEvents,
  fetchDetectionSearch,
  fetchEnvironmentExtract,
  fetchHealth,
  fetchHiddenLabel,
  fetchIntelligenceSummary,
  fetchReport,
  fetchReviewTasks,
  fetchSites,
  fetchToolRegistry,
  resolveReviewTask,
  runInference,
  runTool
} from "./api";

type ClaimType = "OBSERVED" | "MEASURED" | "INFERRED";
type RuntimeStatus = "loading" | "ready" | "running" | "error";
type CopilotStatus = "idle" | "running" | "error";
type OperationsTab = "tools" | "review" | "benchmarks" | "intelligence" | "reports";

type JsonRow = {
  key: string;
  value: string;
  claim: ClaimType;
};

type OperationsData = {
  tools: ToolRegistryResponse | null;
  detections: DetectionSearchResponse | null;
  sites: SitesResponse | null;
  benchmarks: BenchmarkSummary | null;
  reviewTasks: ReviewTask[];
  intelligence: IntelligenceSummary | null;
  report: ConservationReport | null;
};

type BenchmarkMetricKey =
  | "json_valid_rate"
  | "species_set_exact_rate"
  | "blank_correct_rate"
  | "review_correct_rate"
  | "has_evidence_rate";

const fallbackImages = [
  "/images/hyena-spotted-1.jpg",
  "/images/hyena-spotted-2.jpg",
  "/images/hyena-spotted-3.jpg"
];

const copilotPromptSuggestions = [
  "What evidence supports this prediction?",
  "Tell me a fun fact about this species",
  "What ecological role does this species play?",
  "Should this event go to review?",
  "How should I interpret the rainfall and EVI here?",
  "What would you check before using this event in a report?"
];

function StatusDot({ tone = "green" }: { tone?: "green" | "amber" | "gray" | "red" }) {
  return <span className={`status-dot ${tone}`} />;
}

function ClaimChip({ type }: { type: ClaimType }) {
  return <span className={`claim-chip ${type.toLowerCase()}`}>{type}</span>;
}

function Panel({
  title,
  children,
  className = "",
  right
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
  right?: React.ReactNode;
}) {
  return (
    <section className={`panel ${className}`}>
      {title ? (
        <div className="panel-title">
          <span>{title}</span>
          {right}
        </div>
      ) : null}
      {children}
    </section>
  );
}

function absoluteImageUrl(imageUrl: string) {
  if (imageUrl.startsWith("http")) return imageUrl;
  if (imageUrl.startsWith("/api")) return `${API_BASE}${imageUrl}`;
  return imageUrl;
}

function formatDateTime(value?: string | null) {
  if (!value) return { date: "Unknown", time: "--:--", longDate: "Unknown", local: "Unknown" };
  const normalized = value.replace(" ", "T");
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    return { date: value.slice(0, 10), time: value.slice(11, 16), longDate: value.slice(0, 10), local: value };
  }
  return {
    date: normalized.slice(0, 10),
    time: normalized.slice(11, 16),
    longDate: date.toLocaleDateString(undefined, {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric"
    }),
    local: normalized.replace("T", " ").slice(0, 19)
  };
}

function decimalToDms(value: number | null | undefined, axis: "lat" | "lon") {
  if (value == null || !Number.isFinite(value)) return "--";
  const direction = axis === "lat" ? (value >= 0 ? "N" : "S") : value >= 0 ? "E" : "W";
  const abs = Math.abs(value);
  const degrees = Math.floor(abs);
  const minutesFloat = (abs - degrees) * 60;
  const minutes = Math.floor(minutesFloat);
  const seconds = Math.round((minutesFloat - minutes) * 60);
  return `${degrees.toString().padStart(2, "0")}° ${minutes.toString().padStart(2, "0")}′ ${seconds
    .toString()
    .padStart(2, "0")}″ ${direction}`;
}

function getObject(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function getFirstDetection(parsed: unknown) {
  const root = getObject(parsed);
  const detections = root?.detections;
  return Array.isArray(detections) ? getObject(detections[0]) : null;
}

function stringifyCell(value: unknown) {
  if (value === undefined || value === null) return "null";
  if (typeof value === "string") return `"${value}"`;
  if (typeof value === "boolean" || typeof value === "number") return String(value);
  return JSON.stringify(value);
}

function formatPercent(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : "--";
}

function formatNumber(value: number | null | undefined, digits = 1) {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(digits) : "--";
}

function averageBenchmarkMetric(rows: BenchmarkSummary["rows"], key: BenchmarkMetricKey) {
  const values = rows
    .map((row) => row[key])
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function bestBenchmarkMetric(rows: BenchmarkSummary["rows"], key: BenchmarkMetricKey) {
  const values = rows
    .map((row) => row[key])
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (!values.length) return null;
  return Math.max(...values);
}

function shortJson(value: unknown) {
  return JSON.stringify(value, null, 2).slice(0, 1400);
}

function summarizePrediction(event: DemoEvent, prediction: ModelPrediction | null): JsonRow[] {
  const parsed = prediction?.result.parsed;
  const root = getObject(parsed);
  const eventBlock = getObject(root?.event);
  const detection = getFirstDetection(parsed);
  const count = getObject(detection?.count);
  const confidence = getObject(detection?.confidence);
  const review = getObject(root?.review);

  if (!prediction) {
    return [
      { key: "capture_event_id", value: `"${event.eventId}"`, claim: "MEASURED" },
      { key: "site_id", value: `"${event.siteId}"`, claim: "MEASURED" },
      { key: "frame_count", value: String(event.frameCount), claim: "MEASURED" },
      { key: "status", value: '"awaiting_ollama"', claim: "INFERRED" },
      { key: "model", value: '"wild-gemma4:e4b"', claim: "MEASURED" }
    ];
  }

  if (!parsed) {
    return [
      { key: "capture_event_id", value: `"${event.eventId}"`, claim: "MEASURED" },
      { key: "raw_response", value: JSON.stringify(prediction.result.raw.slice(0, 96)), claim: "INFERRED" },
      { key: "json_parse_ok", value: "false", claim: "MEASURED" },
      { key: "latency_ms", value: String(prediction.result.latencyMs), claim: "MEASURED" }
    ];
  }

  return [
    { key: "blank", value: stringifyCell(eventBlock?.blank ?? root?.blank), claim: "OBSERVED" },
    {
      key: "species",
      value: prediction.result.validation.speciesOk
        ? stringifyCell(detection?.species ?? "none")
        : stringifyCell(`INVALID:${detection?.species ?? "none"}`),
      claim: "OBSERVED"
    },
    { key: "count_bin", value: stringifyCell(count?.bin ?? "none"), claim: "OBSERVED" },
    { key: "confidence", value: stringifyCell(confidence?.label ?? "unknown"), claim: "MEASURED" },
    {
      key: "review_needed",
      value: stringifyCell(!prediction.result.validation.schemaOk || (review?.review_needed ?? true)),
      claim: "INFERRED"
    },
    { key: "schema_ok", value: stringifyCell(prediction.result.validation.schemaOk), claim: "MEASURED" },
    { key: "model", value: `"${prediction.result.model}"`, claim: "MEASURED" },
    { key: "curated", value: stringifyCell(Boolean(prediction.result.cachedCurated)), claim: "MEASURED" },
    { key: "thinking", value: stringifyCell(prediction.result.thinking), claim: "MEASURED" },
    { key: "latency_ms", value: String(prediction.result.latencyMs), claim: "MEASURED" }
  ];
}

function labelSummary(label: HiddenLabel | null) {
  if (!label) return null;
  const target = label.target;
  if (target.event.blank) return "blank event";
  const detection = target.detections[0];
  if (!detection) return "no detection";
  return `${detection.species} · count ${detection.count.bin} · ${detection.confidence.label}`;
}

function reviewSummary(label: HiddenLabel | null) {
  if (!label?.review_target) return "review target unavailable";
  const reasons = label.review_target.reasons.length ? ` · ${label.review_target.reasons.join(", ")}` : "";
  return `${label.review_target.decision} · ${label.review_target.priority}${reasons}`;
}

function renderInlineMarkdown(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*\n]+\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    }
    return <span key={index}>{part}</span>;
  });
}

function markdownLineToText(line: string) {
  return line
    .trim()
    .replace(/^[-*]\s+/, "")
    .replace(/\s+/g, " ");
}

function CopilotMarkdown({ text }: { text: string }) {
  const blocks = text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  if (!blocks.length) return null;

  return (
    <div className="copilot-markdown">
      {blocks.map((block, blockIndex) => {
        const lines = block.split(/\n/).map(markdownLineToText).filter(Boolean);
        const isList = block.split(/\n/).every((line) => /^\s*[-*]\s+/.test(line));
        if (isList) {
          return (
            <ul key={blockIndex}>
              {lines.map((line, lineIndex) => (
                <li key={lineIndex}>{renderInlineMarkdown(line)}</li>
              ))}
            </ul>
          );
        }
        return <p key={blockIndex}>{renderInlineMarkdown(lines.join(" "))}</p>;
      })}
    </div>
  );
}

function Header({ health }: { health: HealthStatus | null }) {
  const reachable = health?.ollama.reachable;
  return (
    <header className="topbar">
      <div className="brand-block">
        <h1>Savanna Sentinel</h1>
        <span className="divider" />
        <span className="mode-label">
          <StatusDot tone="amber" />
          Live Replay
        </span>
      </div>
      <div className="topbar-status">
        <span className="system-online">
          <StatusDot tone={reachable === false ? "red" : "green"} />
          {reachable === false ? "Ollama Offline" : "System Online"}
        </span>
        <span>Model: {health?.ollama.model || "wild-gemma4:e4b"}</span>
        <span>v1.4.2</span>
        <button aria-label="Open map layers">
          <MapIcon size={18} />
        </button>
        <button aria-label="Notifications">
          <Bell size={17} />
        </button>
        <button aria-label="Main menu">
          <Menu size={19} />
        </button>
      </div>
    </header>
  );
}

function CameraDeck({
  event,
  selectedFrame,
  onSelectFrame
}: {
  event: DemoEvent;
  selectedFrame: number;
  onSelectFrame: (index: number) => void;
}) {
  const when = formatDateTime(event.localDatetime);
  const images = event.images.length ? event.images.map((image) => absoluteImageUrl(image.url)) : fallbackImages;
  const latitude = event.environment?.latitude;
  const longitude = event.environment?.longitude;

  return (
    <Panel className="camera-panel">
      <div className="section-kicker">
        <span>SERENGETI NORTH • CAM {event.siteId}</span>
        <span className="live-word">STREAM</span>
      </div>
      <div className="camera-frame">
        <img src={images[selectedFrame] || images[0]} alt={`Snapshot Serengeti event ${event.eventId}`} />
        <div className="image-vignette" />
        <div className="timestamp">
          <span>{when.local}</span>
          <span>UTC+03:00</span>
        </div>
        <div className="coordinates">
          <span>{decimalToDms(latitude, "lat")}</span>
          <span>{decimalToDms(longitude, "lon")}</span>
          <span>Site {event.siteId}</span>
        </div>
        <div className="burst">
          FRAME <strong>{selectedFrame + 1}</strong> / {images.length}
        </div>
      </div>
      <div className="camera-meta">
        <Meta label="EVENT ID" value={event.eventId} />
        <Meta label="FRAME COUNT" value={String(event.frameCount)} />
        <Meta label="SITE" value={event.siteId} />
        <Meta label="MONTH" value={event.environment?.month || "--"} />
        <Meta label="MODIS EVI" value={event.environment?.modisEviMean?.toFixed(2) || "--"} />
        <Meta label="RAIN" value={`${event.environment?.chirpsMonthlyMm?.toFixed(1) || "--"} mm`} />
      </div>
      <div className="thumbnail-rail">
        <button className="icon-button" aria-label="Previous frame" onClick={() => onSelectFrame(Math.max(0, selectedFrame - 1))}>
          <ChevronLeft size={18} />
        </button>
        {images.map((image, index) => (
          <button
            key={`${event.eventId}-${index}`}
            className={`thumbnail ${selectedFrame === index ? "selected" : ""}`}
            onClick={() => onSelectFrame(index)}
            aria-label={`Select frame ${index + 1}`}
          >
            <img src={image} alt="" />
          </button>
        ))}
        <button
          className="icon-button"
          aria-label="Next frame"
          onClick={() => onSelectFrame(Math.min(images.length - 1, selectedFrame + 1))}
        >
          <ChevronRight size={18} />
        </button>
      </div>
      <div className="timeline">
        <button className="play-button" aria-label="Play replay">
          <Play size={15} />
        </button>
        <span className="live-dot">
          <StatusDot tone="amber" />
          DEMO
        </span>
        {["T-20", "T-10", "T", "T+10", "T+20"].map((time, index) => (
          <button
            key={time}
            className={`tick ${index === 2 ? "active" : ""}`}
            onClick={() => onSelectFrame(Math.min(index, images.length - 1))}
          >
            <span />
            {time}
          </button>
        ))}
        <button className="speed">1x</button>
        <button className="icon-button" aria-label="Expand replay">
          <Expand size={15} />
        </button>
      </div>
    </Panel>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function PredictionPanel({
  event,
  prediction,
  hiddenLabel,
  revealed,
  status,
  error,
  thinking,
  numPredict,
  forceLive,
  onThinkingChange,
  onNumPredictChange,
  onForceLiveChange,
  onRun,
  onReveal
}: {
  event: DemoEvent;
  prediction: ModelPrediction | null;
  hiddenLabel: HiddenLabel | null;
  revealed: boolean;
  status: RuntimeStatus;
  error: string | null;
  thinking: boolean;
  numPredict: number;
  forceLive: boolean;
  onThinkingChange: (value: boolean) => void;
  onNumPredictChange: (value: number) => void;
  onForceLiveChange: (value: boolean) => void;
  onRun: () => void;
  onReveal: () => void;
}) {
  const rows = summarizePrediction(event, prediction);
  const canReveal = Boolean(prediction);

  return (
    <div className="prediction-column">
      <Panel
        title="GEMMA 4 PREDICTION"
        right={
          <span className="ready">
            <StatusDot tone={status === "error" ? "red" : status === "running" ? "amber" : "green"} />
            {status === "running" ? "RUNNING" : status === "error" ? "CHECK" : "READY"}
          </span>
        }
      >
        <div className="inference-controls">
          <button className="run-button" onClick={onRun} disabled={status === "running"}>
            <Sparkles size={14} />
            {status === "running" ? "Running Ollama..." : "Run inference"}
          </button>
          <label className="toggle-control">
            <input type="checkbox" checked={thinking} onChange={(event) => onThinkingChange(event.target.checked)} />
            <span>Thinking</span>
          </label>
          <label className="toggle-control">
            <input type="checkbox" checked={forceLive} onChange={(event) => onForceLiveChange(event.target.checked)} />
            <span>Live</span>
          </label>
          <label className="budget-control">
            <span>Tokens</span>
            <select value={numPredict} onChange={(event) => onNumPredictChange(Number(event.target.value))}>
              <option value={1024}>1024</option>
              <option value={1536}>1536</option>
              <option value={2048}>2048</option>
            </select>
          </label>
        </div>
        <div className="json-card">
          <span className="brace">{"{"}</span>
          {rows.map((row) => (
            <div className="json-row" key={row.key}>
              <span className="json-key">"{row.key}"</span>
              <span className="punct">:</span>
              <span className={row.claim === "OBSERVED" ? "json-value amber" : "json-value"}>{row.value}</span>
              <ClaimChip type={row.claim} />
            </div>
          ))}
          <span className="brace">{"}"}</span>
        </div>
        {prediction?.result.validation.warnings.length ? (
          <div className="inline-error">{prediction.result.validation.warnings.join(" · ")}</div>
        ) : null}
        {error ? <div className="inline-error">{error}</div> : null}
        <button className={`reveal ${revealed ? "revealed" : ""}`} onClick={onReveal} disabled={!canReveal}>
          <Eye size={15} />
          {revealed && hiddenLabel
            ? `Hidden label: ${labelSummary(hiddenLabel)} · review ${reviewSummary(hiddenLabel)}`
            : canReveal
              ? "Reveal hidden label"
              : "Run inference before reveal"}
        </button>
      </Panel>
    </div>
  );
}

function MetricCard({
  title,
  value,
  unit,
  tone
}: {
  title: string;
  value: string;
  unit?: string;
  tone: "blue" | "green";
}) {
  const bars = tone === "blue" ? [18, 44, 31, 39, 12, 22, 17, 28] : [16, 21, 47, 61, 52, 58, 64, 57];
  return (
    <div className="metric-card">
      <span>{title}</span>
      <strong>
        {value} {unit ? <em>{unit}</em> : null}
      </strong>
      <div className={`spark ${tone}`}>
        {bars.map((height, index) => (
          <i key={index} style={{ height: `${height}%` }} />
        ))}
      </div>
      <div className="spark-axis">
        <span>{title.includes("RAIN") ? "month" : "16d"}</span>
        <span>event</span>
      </div>
    </div>
  );
}

function LiveMap({
  events,
  selectedEvent,
  onSelectEvent
}: {
  events: DemoEvent[];
  selectedEvent: DemoEvent;
  onSelectEvent: (event: DemoEvent) => void;
}) {
  const mapNode = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerLayerRef = useRef<L.LayerGroup | null>(null);
  const siteGroups = useMemo(() => {
    const groups = new globalThis.Map<string, DemoEvent[]>();
    for (const event of events) {
      if (!event.environment?.latitude || !event.environment.longitude) continue;
      if (!groups.has(event.siteId)) groups.set(event.siteId, []);
      groups.get(event.siteId)?.push(event);
    }
    return groups;
  }, [events]);
  const selectedSiteEvents = siteGroups.get(selectedEvent.siteId) || [];
  const selectedSiteYears = [...new Set(selectedSiteEvents.map((event) => event.localDatetime.slice(0, 4)))].sort();
  const selectedYearRange =
    selectedSiteYears.length > 1
      ? `${selectedSiteYears[0]}-${selectedSiteYears[selectedSiteYears.length - 1]}`
      : selectedSiteYears[0] || selectedEvent.localDatetime.slice(0, 4);

  function fitSites() {
    const coords = [...siteGroups.values()]
      .map((group) => group[0])
      .filter((event) => event.environment?.latitude != null && event.environment.longitude != null)
      .map((event) => [event.environment?.latitude, event.environment?.longitude] as L.LatLngTuple);
    if (!coords.length || !mapRef.current) return;
    mapRef.current.fitBounds(L.latLngBounds(coords), { padding: [30, 30], maxZoom: 11 });
  }

  useEffect(() => {
    if (!mapNode.current || mapRef.current) return;

    const center: L.LatLngExpression = [
      selectedEvent.environment?.latitude || -2.49,
      selectedEvent.environment?.longitude || 34.86
    ];
    const map = L.map(mapNode.current, {
      zoomControl: false,
      attributionControl: false
    }).setView(center, 10);

    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 16
    }).addTo(map);
    L.control.zoom({ position: "bottomright" }).addTo(map);
    L.control
      .attribution({ prefix: false, position: "bottomleft" })
      .addAttribution("Tiles Esri · Snapshot Serengeti public archive")
      .addTo(map);

    markerLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      markerLayerRef.current = null;
    };
  }, [selectedEvent.environment?.latitude, selectedEvent.environment?.longitude]);

  useEffect(() => {
    const map = mapRef.current;
    const layer = markerLayerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();

    for (const [siteId, siteEvents] of siteGroups) {
      const event = siteEvents[0];
      const lat = event.environment?.latitude;
      const lon = event.environment?.longitude;
      if (lat == null || lon == null) continue;
      const active = event.siteId === selectedEvent.siteId;
      const radius = active ? 9 : Math.min(9, 4 + Math.sqrt(siteEvents.length));
      const marker = L.circleMarker([lat, lon], {
        radius,
        color: active ? "#f0b83f" : "#b9d8df",
        fillColor: active ? "#f0b83f" : "#e7eee5",
        fillOpacity: active ? 0.95 : 0.34,
        opacity: active ? 1 : 0.82,
        weight: active ? 3 : 1.4
      });
      if (active) {
        L.circleMarker([lat, lon], {
          radius: 21,
          color: "#f0b83f",
          fillOpacity: 0,
          opacity: 0.62,
          weight: 1,
          dashArray: "4 6"
        }).addTo(layer);
      }
      marker.bindTooltip(`${siteId} · ${siteEvents.length} event${siteEvents.length === 1 ? "" : "s"}`, { direction: "top" });
      marker.on("click", () => onSelectEvent(event));
      marker.addTo(layer);
    }

    const lat = selectedEvent.environment?.latitude;
    const lon = selectedEvent.environment?.longitude;
    if (lat != null && lon != null) map.flyTo([lat, lon], Math.max(map.getZoom(), 10), { duration: 0.7 });
  }, [siteGroups, selectedEvent, onSelectEvent]);

  return (
    <div className="map-surface actual-map">
      <div ref={mapNode} className="leaflet-map" />
      <div className="map-control-bar">
        <button onClick={fitSites}>
          <MapPin size={13} />
          Fit sites
        </button>
      </div>
      <div className="map-legend">
        <span>
          <i className="map-legend-dot active" />
          Active Site ({selectedEvent.siteId})
        </span>
        <span>
          <i className="map-legend-dot site" />
          Sites
        </span>
        <span>
          <i className="map-legend-dot basemap" />
          Basemap
        </span>
      </div>
      <div className="map-coords">
        {decimalToDms(selectedEvent.environment?.latitude, "lat")} ·{" "}
        {decimalToDms(selectedEvent.environment?.longitude, "lon")}
      </div>
      <div className="map-site-summary">
        <span>ACTIVE SITE</span>
        <strong>{selectedEvent.siteId}</strong>
        <em>
          {selectedSiteEvents.length || 1} event{(selectedSiteEvents.length || 1) === 1 ? "" : "s"} · {selectedYearRange}
        </em>
        <small>
          Rain {selectedEvent.environment?.chirpsMonthlyMm?.toFixed(1) || "--"} mm · EVI{" "}
          {selectedEvent.environment?.modisEviMean?.toFixed(2) || "--"}
        </small>
      </div>
    </div>
  );
}

function MapPanel({
  event,
  events,
  onSelectEvent
}: {
  event: DemoEvent;
  events: DemoEvent[];
  onSelectEvent: (event: DemoEvent) => void;
}) {
  const when = formatDateTime(event.localDatetime);
  return (
    <div className="map-column">
      <div className="metric-strip">
        <MetricCard
          title="RAINFALL MONTH"
          value={event.environment?.chirpsMonthlyMm?.toFixed(1) || "--"}
          unit="mm"
          tone="blue"
        />
        <MetricCard title="MODIS EVI" value={event.environment?.modisEviMean?.toFixed(2) || "--"} tone="green" />
        <div className="site-card">
          <span>SITE ID</span>
          <strong>{event.siteId}</strong>
          <em>Serengeti North</em>
          <small>Grid {event.siteId}</small>
        </div>
        <div className="site-card time">
          <span>LOCAL TIME</span>
          <strong>{when.time}</strong>
          <em>{when.longDate}</em>
          <small>UTC+03:00</small>
        </div>
      </div>
      <Panel
        className="map-panel"
        title="SERENGETI CAMERA GRID"
        right={
          <button className="icon-button" aria-label="Expand map">
            <Expand size={15} />
          </button>
        }
      >
        <LiveMap events={events} selectedEvent={event} onSelectEvent={onSelectEvent} />
      </Panel>
    </div>
  );
}

function ReviewQueue({
  events,
  selectedId,
  revealedLabels,
  onSelect
}: {
  events: DemoEvent[];
  selectedId: string;
  revealedLabels: Record<string, HiddenLabel>;
  onSelect: (event: DemoEvent) => void;
}) {
  return (
    <Panel className="review-panel">
      <div className="review-title">
        <span>STREAM</span>
        <span>•</span>
        <span>EVENTS</span>
        <strong>{events.length}</strong>
      </div>
      <div className="review-scroll">
        {events.map((event) => {
          const when = formatDateTime(event.localDatetime);
          const label = revealedLabels[event.eventId];
          return (
            <button
              key={event.eventId}
              className={`review-card ${selectedId === event.eventId ? "selected" : ""}`}
              onClick={() => onSelect(event)}
            >
              <img src={absoluteImageUrl(event.images[0]?.url || fallbackImages[0])} alt={`Demo event ${event.eventId}`} />
              <span>{when.time}</span>
              <strong>{label ? labelSummary(label) : event.eventId}</strong>
              <em>Site {event.siteId} · {event.frameCount} frame{event.frameCount === 1 ? "" : "s"}</em>
            </button>
          );
        })}
      </div>
    </Panel>
  );
}

function CopilotPanel({
  selectedEvent,
  prediction,
  copilotQuestion,
  copilotAnswer,
  copilotStatus,
  copilotError,
  onQuestionChange,
  onAskCopilot
}: {
  selectedEvent: DemoEvent;
  prediction: ModelPrediction | null;
  copilotQuestion: string;
  copilotAnswer: CopilotAnswer | null;
  copilotStatus: CopilotStatus;
  copilotError: string | null;
  onQuestionChange: (value: string) => void;
  onAskCopilot: (question?: string) => void;
}) {
  const parsedOk = Boolean(prediction?.result.parsed && prediction.result.validation.schemaOk);
  const detection = getFirstDetection(prediction?.result.parsed);
  const eventBlock = getObject(getObject(prediction?.result.parsed)?.event);
  const review = getObject(getObject(prediction?.result.parsed)?.review);
  const confidence = getObject(detection?.confidence);
  const species = eventBlock?.blank ? "blank event" : String(detection?.species || "awaiting detection");
  const source = prediction
    ? prediction.result.cachedCurated
      ? "Cached curated output"
      : "Live Ollama output"
    : "Awaiting inference";
  const reviewState = prediction
    ? review?.review_needed
      ? "review queued"
      : "auto-accept candidate"
    : "pending model output";
  const confidenceLabel = String(confidence?.label || "pending");
  const plan = prediction
    ? `${source}: ${species} · ${confidenceLabel} confidence · ${reviewState}. Evidence bundle attaches imagery, site, MODIS EVI, rainfall, and review-router context.`
    : `Run inference, then bind the model output to cached MODIS/CHIRPS context for site ${selectedEvent.siteId}.`;

  return (
    <Panel
      className="copilot-panel"
      title="COPILOT PREVIEW"
      right={
        <span className="thinking">
          <StatusDot tone={parsedOk ? "green" : "amber"} />
          {parsedOk ? "Grounded" : "Planning"}
          <Sparkles size={15} />
        </span>
      }
    >
      <div className="copilot-body">
        <div className="tool-section">
          <span>{prediction ? "Resolved tool context" : "Planned tool calls"}</span>
          <div className="tool-chips">
            <span>
              <Search size={14} />
              query_detections
            </span>
            <span>
              <CloudRain size={14} />
              extract_environment
            </span>
            <span>
              <Activity size={14} />
              get_camera_effort
            </span>
          </div>
        </div>
        <div className="tool-section review-router-note">
          <span>Review router artifact</span>
          <p>
            {selectedEvent.reviewRouter ? selectedEvent.reviewRouter.task : "No review-router prompt attached"}
            {prediction ? ` · ${source}` : ""}
          </p>
        </div>
        <div className="natural-plan">
          <span>Natural language plan</span>
          <p>{plan}</p>
        </div>
        <div className="copilot-chat">
          <span>Grounded question</span>
          <div className="prompt-suggestions">
            {copilotPromptSuggestions.map((prompt) => (
              <button key={prompt} onClick={() => onAskCopilot(prompt)} disabled={copilotStatus === "running"}>
                {prompt}
              </button>
            ))}
          </div>
          <form
            className="copilot-form"
            onSubmit={(event) => {
              event.preventDefault();
              onAskCopilot();
            }}
          >
            <textarea
              value={copilotQuestion}
              onChange={(event) => onQuestionChange(event.target.value)}
              placeholder="Ask about the current event, prediction, site context, or review decision..."
              rows={2}
            />
            <button type="submit" disabled={copilotStatus === "running" || !copilotQuestion.trim()}>
              <Sparkles size={14} />
              {copilotStatus === "running" ? "Asking" : "Ask"}
            </button>
          </form>
          {copilotError ? <div className="copilot-error">{copilotError}</div> : null}
          {copilotAnswer ? (
            <div className="copilot-answer">
              <span>
                {copilotAnswer.model} · {copilotAnswer.latencyMs} ms
              </span>
              <CopilotMarkdown text={copilotAnswer.answer} />
            </div>
          ) : null}
        </div>
      </div>
    </Panel>
  );
}

function EvidenceBundle({
  selectedEvent,
  prediction
}: {
  selectedEvent: DemoEvent;
  prediction: ModelPrediction | null;
}) {
  const when = formatDateTime(selectedEvent.localDatetime);
  const rows = [
    { icon: ImageIcon, label: "Images", value: `${selectedEvent.frameCount} frame(s) · ${selectedEvent.eventId}` },
    { icon: MapPin, label: "Site", value: `${selectedEvent.siteId} · ${decimalToDms(selectedEvent.environment?.latitude, "lat")}` },
    { icon: CalendarClock, label: "Date / Time", value: `${when.local} UTC+03:00` },
    { icon: Database, label: "Model Output", value: prediction ? `${prediction.result.model} · ${prediction.result.latencyMs} ms` : "Not run" },
    {
      icon: Layers,
      label: "Environment",
      value: `Rain ${selectedEvent.environment?.chirpsMonthlyMm?.toFixed(1) || "--"} mm · EVI ${
        selectedEvent.environment?.modisEviMean?.toFixed(2) || "--"
      }`
    }
  ];

  return (
    <Panel className="evidence-panel" title="EVIDENCE BUNDLE">
      <div className="evidence-list">
        {rows.map(({ icon: Icon, label, value }) => (
          <div className="evidence-row" key={label}>
            <Icon size={15} />
            <span>{label}</span>
            <em>{value}</em>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function OperationsWorkspace({
  activeTab,
  onTabChange,
  data,
  selectedEvent,
  operationsError,
  toolResult,
  toolStatus,
  onRunTool,
  reviewDraft,
  onReviewDraftChange,
  onResolveReview,
  reviewExport,
  onExportReview,
  reportId,
  onReportChange
}: {
  activeTab: OperationsTab;
  onTabChange: (tab: OperationsTab) => void;
  data: OperationsData;
  selectedEvent: DemoEvent;
  operationsError: string | null;
  toolResult: Record<string, unknown> | null;
  toolStatus: "idle" | "running";
  onRunTool: (toolName: string) => void;
  reviewDraft: { correctedLabel: string; notes: string };
  onReviewDraftChange: (patch: Partial<{ correctedLabel: string; notes: string }>) => void;
  onResolveReview: (action: "accept" | "correct" | "escalate") => void;
  reviewExport: string;
  onExportReview: () => void;
  reportId: string;
  onReportChange: (reportId: string) => void;
}) {
  const tabs: Array<{ id: OperationsTab; label: string; icon: ElementType }> = [
    { id: "tools", label: "Tools API", icon: Database },
    { id: "review", label: "Review", icon: CheckCircle2 },
    { id: "benchmarks", label: "Benchmarks", icon: BarChart3 },
    { id: "intelligence", label: "Intelligence", icon: GitBranch },
    { id: "reports", label: "Reports", icon: FileText }
  ];

  return (
    <section className="operations-workspace">
      <div className="ops-header">
        <div>
          <span>OPERATIONS LAYER</span>
          <strong>Modules</strong>
        </div>
        <div className="ops-tabs">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button key={id} className={activeTab === id ? "active" : ""} onClick={() => onTabChange(id)}>
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>
      </div>
      {operationsError ? <div className="ops-error">{operationsError}</div> : null}
      {activeTab === "tools" ? (
        <ToolRegistryPanel
          tools={data.tools}
          detections={data.detections}
          sites={data.sites}
          selectedEvent={selectedEvent}
          toolResult={toolResult}
          toolStatus={toolStatus}
          onRunTool={onRunTool}
        />
      ) : null}
      {activeTab === "review" ? (
        <ReviewWorkflowPanel
          tasks={data.reviewTasks}
          selectedEvent={selectedEvent}
          reviewDraft={reviewDraft}
          onReviewDraftChange={onReviewDraftChange}
          onResolveReview={onResolveReview}
          reviewExport={reviewExport}
          onExportReview={onExportReview}
        />
      ) : null}
      {activeTab === "benchmarks" ? <BenchmarkPanel benchmarks={data.benchmarks} /> : null}
      {activeTab === "intelligence" ? <IntelligencePanel intelligence={data.intelligence} /> : null}
      {activeTab === "reports" ? (
        <ReportsPanel report={data.report} reportId={reportId} onReportChange={onReportChange} />
      ) : null}
    </section>
  );
}

function ToolRegistryPanel({
  tools,
  detections,
  sites,
  selectedEvent,
  toolResult,
  toolStatus,
  onRunTool
}: {
  tools: ToolRegistryResponse | null;
  detections: DetectionSearchResponse | null;
  sites: SitesResponse | null;
  selectedEvent: DemoEvent;
  toolResult: Record<string, unknown> | null;
  toolStatus: "idle" | "running";
  onRunTool: (toolName: string) => void;
}) {
  const toolNames = tools?.tools.map((tool) => tool.function.name) || [];
  return (
    <div className="ops-grid tools-grid">
      <Panel title="TOOL REGISTRY" className="ops-panel">
        <div className="tool-registry-list">
          {tools?.tools.map((tool) => (
            <div key={tool.function.name} className="tool-registry-row">
              <strong>{tool.function.name}</strong>
              <span>{tool.function.description}</span>
              <button onClick={() => onRunTool(tool.function.name)} disabled={toolStatus === "running"}>
                {toolStatus === "running" ? "Running" : "Run"}
              </button>
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="PUBLIC API SURFACE" className="ops-panel">
        <div className="endpoint-list">
          {tools?.endpoints.map((endpoint) => (
            <code key={endpoint}>{endpoint}</code>
          ))}
        </div>
      </Panel>
      <Panel title="LIVE TOOL RESULT" className="ops-panel wide">
        <div className="ops-summary-row">
          <span>{toolNames.length} tools registered</span>
          <span>{detections?.count ?? 0} searchable detections</span>
          <span>{sites?.sites.length ?? 0} active demo sites</span>
          <span>Current site {selectedEvent.siteId}</span>
        </div>
        <pre className="json-output">{toolResult ? shortJson(toolResult) : "Run a tool to inspect deterministic output."}</pre>
      </Panel>
    </div>
  );
}

function ReviewWorkflowPanel({
  tasks,
  selectedEvent,
  reviewDraft,
  onReviewDraftChange,
  onResolveReview,
  reviewExport,
  onExportReview
}: {
  tasks: ReviewTask[];
  selectedEvent: DemoEvent;
  reviewDraft: { correctedLabel: string; notes: string };
  onReviewDraftChange: (patch: Partial<{ correctedLabel: string; notes: string }>) => void;
  onResolveReview: (action: "accept" | "correct" | "escalate") => void;
  reviewExport: string;
  onExportReview: () => void;
}) {
  const currentTask = tasks.find((task) => task.capture_event_id === selectedEvent.eventId);
  const pending = tasks.filter((task) => task.status === "pending").length;
  const resolved = tasks.filter((task) => task.status === "resolved").length;
  return (
    <div className="ops-grid review-workflow-grid">
      <Panel title="CURRENT REVIEW TASK" className="ops-panel">
        <div className="review-task-detail">
          <strong>{currentTask?.capture_event_id || selectedEvent.eventId}</strong>
          <span>
            {currentTask?.proposed_label || "unknown"} · {currentTask?.confidence || "unknown"} confidence ·{" "}
            {currentTask?.priority || "none"} priority
          </span>
          <em>{currentTask?.reasons.length ? currentTask.reasons.join(", ") : "No explicit review reason attached."}</em>
          <div className="review-form">
            <input
              value={reviewDraft.correctedLabel}
              onChange={(event) => onReviewDraftChange({ correctedLabel: event.target.value })}
              placeholder="Corrected label, if needed"
            />
            <textarea
              value={reviewDraft.notes}
              onChange={(event) => onReviewDraftChange({ notes: event.target.value })}
              placeholder="Reviewer notes..."
              rows={3}
            />
            <div className="review-actions">
              <button onClick={() => onResolveReview("accept")}>
                <CheckCircle2 size={14} />
                Accept
              </button>
              <button onClick={() => onResolveReview("correct")}>
                <SlidersHorizontal size={14} />
                Correct
              </button>
              <button onClick={() => onResolveReview("escalate")}>
                <AlertTriangle size={14} />
                Escalate
              </button>
            </div>
          </div>
        </div>
      </Panel>
      <Panel title="TASK QUEUE" className="ops-panel">
        <div className="ops-summary-row stacked">
          <span>{pending} pending</span>
          <span>{resolved} resolved</span>
          <span>{tasks.length} total tasks</span>
        </div>
        <div className="review-task-list">
          {tasks.slice(0, 12).map((task) => (
            <div key={task.task_id} className={`review-task-row ${task.status}`}>
              <strong>{task.capture_event_id}</strong>
              <span>{task.proposed_label}</span>
              <em>{task.status}</em>
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="REVIEW EXPORT" className="ops-panel wide">
        <button className="export-button" onClick={onExportReview}>
          <Download size={14} />
          Export reviewed labels
        </button>
        <pre className="json-output">{reviewExport || "No export generated in this session yet."}</pre>
      </Panel>
    </div>
  );
}

function BenchmarkPanel({ benchmarks }: { benchmarks: BenchmarkSummary | null }) {
  const rows = benchmarks?.rows || [];
  const totalScoredRows = rows.reduce((sum, row) => sum + row.rows, 0);
  const modelCount = new Set(rows.map((row) => row.label)).size;
  const modeCount = new Set(rows.map((row) => row.mode)).size;
  const productRows = rows.filter((row) => row.label.toLowerCase().includes("ollama"));
  const releaseGates = [
    {
      label: "Strict JSON",
      value: averageBenchmarkMetric(productRows.length ? productRows : rows, "json_valid_rate"),
      note: "parseable event schema"
    },
    {
      label: "Species Match",
      value: bestBenchmarkMetric(productRows.length ? productRows : rows, "species_set_exact_rate"),
      note: "best product-mode score"
    },
    {
      label: "Blank Routing",
      value: bestBenchmarkMetric(productRows.length ? productRows : rows, "blank_correct_rate"),
      note: "empty-frame protection"
    },
    {
      label: "Review Routing",
      value: bestBenchmarkMetric(productRows.length ? productRows : rows, "review_correct_rate"),
      note: "human-in-loop gate"
    }
  ];

  return (
    <div className="ops-grid benchmark-grid">
      <Panel title="MODEL BENCHMARKS" className="ops-panel wide">
        <table className="benchmark-table">
          <thead>
            <tr>
              <th>Model</th>
              <th>Mode</th>
              <th>Rows</th>
              <th>JSON</th>
              <th>Species</th>
              <th>Blank</th>
              <th>Review</th>
              <th>Evidence</th>
            </tr>
          </thead>
          <tbody>
            {benchmarks?.rows.map((row) => (
              <tr key={`${row.label}-${row.mode}`}>
                <td>{row.label}</td>
                <td>{row.mode}</td>
                <td>{row.rows}</td>
                <td>{formatPercent(row.json_valid_rate)}</td>
                <td>{formatPercent(row.species_set_exact_rate)}</td>
                <td>{formatPercent(row.blank_correct_rate)}</td>
                <td>{formatPercent(row.review_correct_rate)}</td>
                <td>{formatPercent(row.has_evidence_rate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
      <Panel title="EVALUATION COVERAGE" className="ops-panel">
        <div className="benchmark-coverage">
          <div>
            <strong>{totalScoredRows || "--"}</strong>
            <span>model-evaluation rows</span>
          </div>
          <div>
            <strong>{rows.length || "--"}</strong>
            <span>benchmark runs</span>
          </div>
          <div>
            <strong>{modelCount || "--"}</strong>
            <span>model families</span>
          </div>
          <div>
            <strong>{modeCount || "--"}</strong>
            <span>generation modes</span>
          </div>
        </div>
      </Panel>
      <Panel title="RELEASE GATES" className="ops-panel">
        <div className="release-gate-list">
          {releaseGates.map((gate) => (
            <div key={gate.label} className="release-gate-row">
              <span>{gate.label}</span>
              <strong>{formatPercent(gate.value)}</strong>
              <em>{gate.note}</em>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function IntelligencePanel({ intelligence }: { intelligence: IntelligenceSummary | null }) {
  const moduleRows = [
    {
      title: "MIGRATION PULSE",
      icon: Activity,
      rows: intelligence?.migration_pulse.year_species_counts.map((row) => `${row.key.replace(":", " · ")}: ${row.count}`) || []
    },
    {
      title: "BEHAVIOR SHIFT MONITOR",
      icon: Waypoints,
      rows: intelligence?.behavior_shift_monitor.behavior_counts.map((row) => `${row.key.replace(":", " · ")}: ${row.count}`) || []
    },
    {
      title: "RARE / ANOMALY RADAR",
      icon: Radar,
      rows: intelligence?.rare_anomaly_radar.rare_species.map((row) => `${row.key}: ${row.count}`) || []
    },
    {
      title: "CAMERA PLACEMENT",
      icon: MapPin,
      rows: intelligence?.camera_placement_optimizer.candidates.map((row) => `${row.site_id} · score ${row.score}: ${row.rationale}`) || []
    },
    {
      title: "REPORT GENERATOR",
      icon: FileText,
      rows: intelligence?.conservation_reports.available_reports || []
    }
  ];
  return (
    <div className="intelligence-grid">
      <PredatorPreyGraphPanel intelligence={intelligence} />
      {moduleRows.map(({ title, icon: Icon, rows }) => (
        <Panel key={title} title={title} className="ops-panel intelligence-card">
          <Icon size={17} />
          <ul>
            {(rows.length ? rows : ["No module output available yet."]).slice(0, 6).map((row) => (
              <li key={row}>{row}</li>
            ))}
          </ul>
        </Panel>
      ))}
    </div>
  );
}

function PredatorPreyGraphPanel({ intelligence }: { intelligence: IntelligenceSummary | null }) {
  const graphs = intelligence?.predator_prey_graph.yearly_graphs || [];
  const chartRows = graphs
    .map((graph) => {
      const predatorTotal = graph.predators.reduce((sum, node) => sum + node.count, 0);
      const preyTotal = graph.prey.reduce((sum, node) => sum + node.count, 0);
      const edgeWeight = graph.edges.reduce((sum, edge) => sum + edge.weight, 0);
      const topEdge = [...graph.edges].sort((a, b) => b.weight - a.weight)[0] || null;
      return { ...graph, predatorTotal, preyTotal, edgeWeight, topEdge };
    })
    .sort((a, b) => a.year.localeCompare(b.year));
  const maxTrend = Math.max(1, ...chartRows.flatMap((row) => [row.predatorTotal, row.preyTotal, row.edgeWeight]));
  const xFor = (index: number) => 82 + (index / Math.max(1, chartRows.length - 1)) * 836;
  const yFor = (value: number) => 252 - (value / maxTrend) * 194;
  const predatorPath = chartRows.map((row, index) => `${index === 0 ? "M" : "L"} ${xFor(index)} ${yFor(row.predatorTotal)}`).join(" ");
  const preyPath = chartRows.map((row, index) => `${index === 0 ? "M" : "L"} ${xFor(index)} ${yFor(row.preyTotal)}`).join(" ");
  return (
    <Panel title="PREDATOR-PREY GRAPH" className="ops-panel intelligence-card predator-prey-card">
      <GitBranch size={17} />
      <div className="predator-timeline">
        {chartRows.length ? (
          <>
            <div className="predator-chart-header">
              <strong>Ecosystem interaction timeline</strong>
              <div>
                <span className="predator-legend predator">Predators</span>
                <span className="predator-legend prey">Prey</span>
                <span className="predator-legend pressure">Link pressure</span>
              </div>
            </div>
            <svg className="predator-line-chart" viewBox="0 0 1000 315" role="img" aria-label="Predator and prey detections by year">
              <defs>
                <linearGradient id="predatorPressureGradient" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="rgba(224, 170, 47, 0.58)" />
                  <stop offset="100%" stopColor="rgba(224, 170, 47, 0.04)" />
                </linearGradient>
                <linearGradient id="preyLineGradient" x1="0" x2="1" y1="0" y2="0">
                  <stop offset="0%" stopColor="#8bcf72" />
                  <stop offset="100%" stopColor="#b4e59b" />
                </linearGradient>
              </defs>
              {[58, 106, 154, 202, 250].map((y) => (
                <line key={y} x1="70" x2="930" y1={y} y2={y} className="chart-grid-line" />
              ))}
              {chartRows.map((row, index) => {
                const x = xFor(index);
                const barHeight = Math.max(10, (row.edgeWeight / maxTrend) * 175);
                return (
                  <g key={row.year}>
                    <rect className="pressure-bar" x={x - 22} y={252 - barHeight} width="44" height={barHeight} rx="4" />
                    <line x1={x} x2={x} y1="52" y2="266" className="year-guide" />
                    <text x={x} y="294" textAnchor="middle" className="chart-year">
                      {row.year}
                    </text>
                  </g>
                );
              })}
              <path d={preyPath} className="prey-trend-line" />
              <path d={predatorPath} className="predator-trend-line" />
              {chartRows.map((row, index) => {
                const x = xFor(index);
                const predatorY = yFor(row.predatorTotal);
                const preyY = yFor(row.preyTotal);
                return (
                  <g key={`${row.year}-points`}>
                    <circle cx={x} cy={preyY} r="7" className="prey-point" />
                    <text x={x + 12} y={preyY - 7} className="chart-value">
                      {row.preyTotal}
                    </text>
                    <circle cx={x} cy={predatorY} r="6" className="predator-point" />
                    <text x={x + 12} y={predatorY + 18} className="chart-value predator-value">
                      {row.predatorTotal}
                    </text>
                  </g>
                );
              })}
            </svg>
            <div className="predator-link-strip">
              {chartRows.map((row) => (
                <div key={`${row.year}-link`} className="predator-link-card">
                  <strong>{row.year}</strong>
                  <span>{row.topEdge ? `${row.topEdge.predator} → ${row.topEdge.prey}` : "No predator link"}</span>
                  <em>{row.edgeWeight} yearly link weight</em>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p>No predator-prey graph data available.</p>
        )}
      </div>
    </Panel>
  );
}

function ReportsPanel({
  report,
  reportId,
  onReportChange
}: {
  report: ConservationReport | null;
  reportId: string;
  onReportChange: (reportId: string) => void;
}) {
  const reportIds = ["ranger-brief", "scientist-brief", "public-brief"];
  return (
    <div className="ops-grid report-grid">
      <Panel title="REPORT SELECTOR" className="ops-panel">
        <div className="report-selector">
          {reportIds.map((id) => (
            <button key={id} className={reportId === id ? "active" : ""} onClick={() => onReportChange(id)}>
              <FileText size={14} />
              {id.replace("-", " ")}
            </button>
          ))}
        </div>
      </Panel>
      <Panel title="GENERATED CONSERVATION REPORT" className="ops-panel wide">
        <div className="report-body">
          <strong>{report?.report_type || "loading"}</strong>
          {(["observed", "measured", "inferred", "uncertainty"] as const).map((section) => (
            <div key={section}>
              <span>{section}</span>
              <ul>
                {(report?.[section] || []).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function BottomTelemetry({ health, events }: { health: HealthStatus | null; events: DemoEvent[] }) {
  const years = [...new Set(events.map((event) => event.localDatetime?.slice(0, 4)).filter(Boolean))].sort();
  const yearRange = years.length > 1 ? `${years[0]}-${years[years.length - 1]}` : years[0] || "--";

  return (
    <footer className="telemetry">
      <div>
        <span>DATA PIPELINE</span>
        <strong>LIVE</strong>
      </div>
      <div>
        <span>Demo events</span>
        <strong>{events.length}</strong>
      </div>
      <div>
        <span>Ollama</span>
        <strong>{health?.ollama.reachable ? "online" : "offline"}</strong>
      </div>
      <div>
        <span>Basemap</span>
        <strong>Esri tiles</strong>
      </div>
      <div>
        <span>Storage</span>
        <strong>Local cache</strong>
      </div>
      <div className="center-note">
        <Radar size={15} />
        <span>Labels hidden until prediction reveal</span>
      </div>
      <div>
        <span>Replay Years</span>
        <strong>{yearRange}</strong>
      </div>
      <div>
        <span>Focus</span>
        <strong>Live Replay</strong>
      </div>
      <div>
        <span>Session</span>
        <strong>Public demo</strong>
      </div>
    </footer>
  );
}

export function App() {
  const [events, setEvents] = useState<DemoEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<DemoEvent | null>(null);
  const [selectedFrame, setSelectedFrame] = useState(0);
  const [prediction, setPrediction] = useState<ModelPrediction | null>(null);
  const [predictionError, setPredictionError] = useState<string | null>(null);
  const [status, setStatus] = useState<RuntimeStatus>("loading");
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [thinking, setThinking] = useState(true);
  const [forceLive, setForceLive] = useState(false);
  const [numPredict, setNumPredict] = useState(1536);
  const [revealedLabels, setRevealedLabels] = useState<Record<string, HiddenLabel>>({});
  const [revealed, setRevealed] = useState(false);
  const [copilotQuestion, setCopilotQuestion] = useState("");
  const [copilotAnswer, setCopilotAnswer] = useState<CopilotAnswer | null>(null);
  const [copilotStatus, setCopilotStatus] = useState<CopilotStatus>("idle");
  const [copilotError, setCopilotError] = useState<string | null>(null);
  const [activeOpsTab, setActiveOpsTab] = useState<OperationsTab>("tools");
  const [operationsData, setOperationsData] = useState<OperationsData>({
    tools: null,
    detections: null,
    sites: null,
    benchmarks: null,
    reviewTasks: [],
    intelligence: null,
    report: null
  });
  const [operationsError, setOperationsError] = useState<string | null>(null);
  const [toolResult, setToolResult] = useState<Record<string, unknown> | null>(null);
  const [toolStatus, setToolStatus] = useState<"idle" | "running">("idle");
  const [reviewDraft, setReviewDraft] = useState({ correctedLabel: "", notes: "" });
  const [reviewExport, setReviewExport] = useState("");
  const [reportId, setReportId] = useState("public-brief");

  useEffect(() => {
    let mounted = true;
    Promise.all([fetchHealth(), fetchDemoEvents()])
      .then(([healthPayload, demoEvents]) => {
        if (!mounted) return;
        setHealth(healthPayload);
        setEvents(demoEvents);
        setSelectedEvent(demoEvents[0] || null);
        if (demoEvents[0]?.curation?.acceptedSettings) {
          setThinking(demoEvents[0].curation.acceptedSettings.thinking);
          setNumPredict(demoEvents[0].curation.acceptedSettings.numPredict);
        }
        setStatus("ready");
        void loadOperations("public-brief");
      })
      .catch((error) => {
        if (!mounted) return;
        setPredictionError(error.message);
        setStatus("error");
      });
    return () => {
      mounted = false;
    };
  }, []);

  async function loadOperations(nextReportId = reportId) {
    setOperationsError(null);
    try {
      const [tools, detections, sites, benchmarks, review, intelligence, report] = await Promise.all([
        fetchToolRegistry(),
        fetchDetectionSearch({ limit: 24, groupBy: ["canonical_species"] }),
        fetchSites(),
        fetchBenchmarks(),
        fetchReviewTasks(),
        fetchIntelligenceSummary(),
        fetchReport(nextReportId)
      ]);
      setOperationsData({ tools, detections, sites, benchmarks, reviewTasks: review.tasks, intelligence, report });
    } catch (error) {
      setOperationsError(error instanceof Error ? error.message : "Could not load operations layer.");
    }
  }

  const activeFrame = useMemo(() => {
    const frameCount = selectedEvent?.images.length || 1;
    return Math.min(selectedFrame, frameCount - 1);
  }, [selectedFrame, selectedEvent]);

  function selectEvent(event: DemoEvent) {
    setSelectedEvent(event);
    setSelectedFrame(0);
    setPrediction(null);
    setPredictionError(null);
    setRevealed(false);
    setForceLive(false);
    setCopilotQuestion("");
    setCopilotAnswer(null);
    setCopilotError(null);
    setCopilotStatus("idle");
    if (event.curation?.acceptedSettings) {
      setThinking(event.curation.acceptedSettings.thinking);
      setNumPredict(event.curation.acceptedSettings.numPredict);
    }
    setStatus("ready");
  }

  async function handleRunInference() {
    if (!selectedEvent) return;
    setStatus("running");
    setPredictionError(null);
    setRevealed(false);
    try {
      const result = await runInference(selectedEvent.eventId, { thinking, numPredict, forceLive });
      setPrediction(result);
      setStatus("ready");
    } catch (error) {
      setPredictionError(error instanceof Error ? error.message : "Inference failed");
      setStatus("error");
    }
  }

  async function handleReveal() {
    if (!selectedEvent || !prediction) return;
    if (!revealedLabels[selectedEvent.eventId]) {
      const label = await fetchHiddenLabel(selectedEvent.eventId);
      setRevealedLabels((labels) => ({ ...labels, [selectedEvent.eventId]: label }));
    }
    setRevealed((value) => !value);
  }

  async function handleAskCopilot(prompt?: string) {
    if (!selectedEvent) return;
    const question = (prompt || copilotQuestion).trim();
    if (!question) return;
    setCopilotQuestion(question);
    setCopilotStatus("running");
    setCopilotError(null);
    try {
      const answer = await askCopilot(selectedEvent.eventId, {
        question,
        prediction: prediction?.result || null,
        thinking,
        numPredict: 512
      });
      setCopilotAnswer(answer);
      setCopilotStatus("idle");
    } catch (error) {
      setCopilotError(error instanceof Error ? error.message : "Copilot request failed");
      setCopilotStatus("error");
    }
  }

  async function handleRunTool(toolName: string) {
    if (!selectedEvent) return;
    const year = selectedEvent.localDatetime.slice(0, 4);
    const argsByTool: Record<string, Record<string, unknown>> = {
      query_detections: { site_ids: [selectedEvent.siteId], limit: 12, group_by: ["canonical_species"] },
      get_camera_effort: { site_ids: [selectedEvent.siteId], date_start: `${year}-01-01`, date_end: `${year}-12-31` },
      extract_environment: { site_ids: [selectedEvent.siteId], date_start: `${year}-01-01`, date_end: `${year}-12-31` },
      compare_to_baseline: {
        site_ids: [selectedEvent.siteId],
        metric: "evi",
        date_start: `${year}-01-01`,
        date_end: `${year}-12-31`
      },
      retrieve_evidence_images: { capture_event_ids: [selectedEvent.eventId], redact_humans: true }
    };
    setToolStatus("running");
    setOperationsError(null);
    try {
      const result = await runTool(toolName, argsByTool[toolName] || {});
      setToolResult(result);
    } catch (error) {
      setOperationsError(error instanceof Error ? error.message : "Tool execution failed.");
    } finally {
      setToolStatus("idle");
    }
  }

  async function handleResolveReview(action: "accept" | "correct" | "escalate") {
    if (!selectedEvent) return;
    setOperationsError(null);
    try {
      const taskId = `review_${selectedEvent.eventId}`;
      const result = await resolveReviewTask(taskId, {
        action,
        correctedLabel: reviewDraft.correctedLabel,
        notes: reviewDraft.notes
      });
      setOperationsData((data) => ({ ...data, reviewTasks: result.tasks }));
      setReviewDraft({ correctedLabel: "", notes: "" });
    } catch (error) {
      setOperationsError(error instanceof Error ? error.message : "Review action failed.");
    }
  }

  async function handleExportReview() {
    setOperationsError(null);
    try {
      const exported = await exportReviewActions();
      setReviewExport(exported.csv);
    } catch (error) {
      setOperationsError(error instanceof Error ? error.message : "Review export failed.");
    }
  }

  async function handleReportChange(nextReportId: string) {
    setReportId(nextReportId);
    setOperationsError(null);
    try {
      const report = await fetchReport(nextReportId);
      setOperationsData((data) => ({ ...data, report }));
    } catch (error) {
      setOperationsError(error instanceof Error ? error.message : "Report generation failed.");
    }
  }

  if (!selectedEvent) {
    return (
      <main className="app-shell">
        <Header health={health} />
        <div className="loading-state">
          <StatusDot tone={status === "error" ? "red" : "amber"} />
          <span>{status === "error" ? predictionError || "Could not load demo artifacts." : "Loading demo stream..."}</span>
        </div>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <Header health={health} />
      <div className="dashboard-grid">
        <CameraDeck event={selectedEvent} selectedFrame={activeFrame} onSelectFrame={setSelectedFrame} />
        <div className="model-column">
          <PredictionPanel
            event={selectedEvent}
            prediction={prediction}
            hiddenLabel={revealedLabels[selectedEvent.eventId] || null}
            revealed={revealed}
            status={status}
            error={predictionError}
            thinking={thinking}
            numPredict={numPredict}
            forceLive={forceLive}
            onThinkingChange={setThinking}
            onNumPredictChange={setNumPredict}
            onForceLiveChange={setForceLive}
            onRun={handleRunInference}
            onReveal={handleReveal}
          />
          <CopilotPanel
            selectedEvent={selectedEvent}
            prediction={prediction}
            copilotQuestion={copilotQuestion}
            copilotAnswer={copilotAnswer}
            copilotStatus={copilotStatus}
            copilotError={copilotError}
            onQuestionChange={setCopilotQuestion}
            onAskCopilot={handleAskCopilot}
          />
        </div>
        <MapPanel event={selectedEvent} events={events} onSelectEvent={selectEvent} />
        <ReviewQueue events={events} selectedId={selectedEvent.eventId} revealedLabels={revealedLabels} onSelect={selectEvent} />
        <EvidenceBundle selectedEvent={selectedEvent} prediction={prediction} />
      </div>
      <OperationsWorkspace
        activeTab={activeOpsTab}
        onTabChange={setActiveOpsTab}
        data={operationsData}
        selectedEvent={selectedEvent}
        operationsError={operationsError}
        toolResult={toolResult}
        toolStatus={toolStatus}
        onRunTool={handleRunTool}
        reviewDraft={reviewDraft}
        onReviewDraftChange={(patch) => setReviewDraft((draft) => ({ ...draft, ...patch }))}
        onResolveReview={handleResolveReview}
        reviewExport={reviewExport}
        onExportReview={handleExportReview}
        reportId={reportId}
        onReportChange={handleReportChange}
      />
      <BottomTelemetry health={health} events={events} />
      <div className="mobile-tabs" aria-label="Mobile section shortcuts">
        <button>
          <ImageIcon size={15} />
          Replay
        </button>
        <button>
          <Microscope size={15} />
          Prediction
        </button>
        <button>
          <Mountain size={15} />
          Map
        </button>
        <button>
          <Waypoints size={15} />
          Evidence
        </button>
        <button>
          <SlidersHorizontal size={15} />
          Review
        </button>
      </div>
    </main>
  );
}
