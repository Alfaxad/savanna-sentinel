# Savanna Sentinel

Savanna Sentinel is a public Serengeti camera-trap intelligence demo. It combines a curated Snapshot Serengeti replay stream, cached Wild Gemma 4 E4B predictions, environmental context, review routing, benchmark reporting, and conservation intelligence modules.

The repository is self-contained for the public demo: clone it, install Node dependencies, and run the app locally. Ollama is optional because curated model outputs are bundled for the demo stream.

## Quick Start

Requirements:

- Node.js 20+
- npm
- Optional: Ollama with `wild-gemma4:e4b` for live inference

```bash
npm install
npm run dev
```

Open:

- Web UI: http://localhost:5173
- API health: http://localhost:8787/api/health

If port `8787` is already in use:

```bash
SAVANNA_API_PORT=8790 npm run dev
```

## What Runs Locally

The local app starts two processes:

- Express API server from `web/server/index.mjs`
- Vite React frontend from `web/src`

The UI includes:

- camera-trap event replay with real Snapshot Serengeti images
- cached Wild Gemma 4 E4B predictions for the curated demo stream
- optional live Ollama inference
- hidden-label reveal for demo evaluation
- review queue and review action export
- tool registry/API surface
- benchmark table and release gates
- predator-prey timeline, migration pulse, behavior monitor, anomaly radar, camera placement, and report generation

## Demo Data Included

Only the curated public demo slice is included, not the full research cache.

Included artifacts:

- `data/demo/public_replay_stream`: event and review-router prompts
- `data/demo/hidden_label_stream`: hidden labels used by the reveal workflow
- `data/demo/curated`: cached accepted Wild Gemma/Ollama outputs and curation summary
- `data/mirrored_images`: 164 JPEG frames required by the 64 accepted demo events
- `data/processed/environmental_features`: event-level CHIRPS/MODIS/JRC context for the demo events
- `data/processed/schemas`: event, review, report, taxonomy, species profile, and tool registry schemas
- `data/raw/snapshot_serengeti_dryad/search_effort.csv`: camera effort metadata used by tool outputs
- `model_metrics/huggingface`: compact training/evaluation metrics surfaced in the app

Large raw training caches, full Snapshot Serengeti imagery, Lambda training files, model weights, and local `node_modules` are intentionally excluded.

## Optional Live Model Setup

The demo works without a local model because cached curated outputs are bundled. To run live inference:

```bash
ollama run alfaxad/wild-gemma4:e4b
```

Then start the app:

```bash
OLLAMA_MODEL=wild-gemma4:e4b npm run dev
```

In the UI, keep `Live` off to use cached curated predictions. Turn `Live` on to call Ollama.

## Useful Scripts

```bash
npm run dev        # API + Vite frontend
npm run api        # Express API only
npm run web        # Vite frontend only
npm run build      # TypeScript + production build
npm run preview    # Vite preview
```

## API Surface

Key local endpoints:

- `GET /api/health`
- `GET /api/demo/events`
- `GET /api/demo/events/:eventId/label`
- `POST /api/infer`
- `POST /api/copilot`
- `GET /api/tools`
- `POST /api/tools/:toolName`
- `GET /api/detections/search`
- `GET /api/sites`
- `GET /api/environment/extract`
- `GET /api/benchmarks/summary`
- `GET /api/review/tasks`
- `POST /api/review/:taskId/resolve`
- `GET /api/review/export`
- `GET /api/intelligence/summary`
- `GET /api/reports/:reportId`

## Source Notes

Savanna Sentinel uses public Snapshot Serengeti data and derived environmental features. See:

- `docs/Savanna_Sentinel_Full_Spec.md`
- `docs/gemma-4-finetuning-guide.md`

The demo stream is historical public camera-trap data, not a live current animal-presence feed.
