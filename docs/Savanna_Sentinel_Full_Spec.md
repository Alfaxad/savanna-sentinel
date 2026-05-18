
---
title: "Savanna Sentinel"
subtitle: "Full Product, Data, Fine-Tuning, Evaluation, Inference, Tool-Calling, and Deployment Specification"
author: "Prepared for alfa"
date: "2026-05-12"
geometry: margin=0.72in
fontsize: 10pt
papersize: letter
colorlinks: true
linkcolor: blue
urlcolor: blue
toc: true
toc-depth: 3
header-includes:
  - \usepackage{fvextra}
  - \DefineVerbatimEnvironment{Highlighting}{Verbatim}{breaklines,commandchars=\\\{\}}
  - \usepackage{longtable}
  - \usepackage{booktabs}
  - \usepackage{array}
---

# Executive summary

**Savanna Sentinel** is a Gemma 4 powered biodiversity monitoring system for the Serengeti. It turns real camera-trap image events from Snapshot Serengeti into a grounded, geo-temporal intelligence layer that can classify species, estimate counts and behavior, route uncertain events for review, and explain changes across space and time using public Earth observation data.

The project is designed for the **Global Resilience** track of the Gemma 4 Good Hackathon. The core resilience claim is simple: protected areas are producing more biodiversity evidence than humans can label and interpret fast enough. Camera traps can monitor animals day and night across long periods, but raw images alone do not become conservation decisions. Savanna Sentinel converts image events, camera effort, environmental layers, and structured tool calls into evidence-backed biodiversity intelligence.

The product will have three operating modes:

1. **Historical intelligence mode:** learn from and analyze the public Snapshot Serengeti archive.
2. **Live replay mode:** run inference on real, unseen Snapshot Serengeti image events with labels hidden until after prediction.
3. **Live-ready monitoring mode:** accept new uploaded camera-trap images, add current habitat context from satellite/climate APIs, and produce grounded reports without claiming current animal presence unless current camera evidence exists.

The model strategy is not only "classify animals." Gemma 4 is used as a multimodal event interpreter, a structured tool-calling agent, and a grounded report generator. Deterministic geospatial tools do the measurements and searches; Gemma 4 interprets images, chooses tools, validates schemas, separates observation from inference, and explains outputs in conservation language.

**Primary track:** Global Resilience.  
**Special technology track target:** Ollama, with a secondary Unsloth target if we fine-tune and publish weights.  
**Core model:** Gemma 4 E4B or another Gemma 4 multimodal variant that supports image-text input.  
**Training stack:** Hugging Face Transformers + TRL + PEFT, with Unsloth if it supports the chosen Gemma 4 multimodal training path conveniently.  
**Demo stack:** public web app + backend + Ollama-hosted inference endpoint + PostGIS + vector search + environmental data tools.

# 1. Problem

## 1.1 The real-world challenge

Biodiversity monitoring is a data bottleneck. Camera traps can collect millions of images, but conservation teams still need to determine:

- which images are blank;
- which species appear;
- how many individuals appear;
- what they are doing;
- whether young are present;
- where and when detections occur;
- whether detections are reliable;
- how detections relate to rainfall, vegetation, water, fire, seasonality, and human pressure.

The Snapshot Serengeti study illustrates the scale. The project deployed 225 camera traps across 1,125 km2 in Serengeti National Park and accumulated 99,241 camera-trap days and 1.2 million image sets by 2013. More than 28,000 registered users and about 40,000 unregistered users contributed 10.8 million classifications. The original consensus labels were validated against expert gold-standard labels with 96.6% species-identification accuracy and about 90% species-count accuracy.[^snapshot-paper]

This is exactly the kind of system-level bottleneck the Global Resilience track should reward: climate and ecosystem resilience depend on timely, trusted environmental intelligence, not merely on raw data.

## 1.2 Product thesis

Savanna Sentinel should not be a simple dashboard and not a generic classifier. It should be a biodiversity intelligence system with four promises:

1. **See:** classify real camera-trap events using a fine-tuned Gemma 4 multimodal model.
2. **Ground:** link every detection to time, camera site, search effort, habitat context, and evidence images.
3. **Reason:** use tool calling to answer ecological questions with database and geospatial computations.
4. **Act:** produce review queues, alerts, maps, placement recommendations, and conservation reports.

## 1.3 Non-negotiable scientific honesty

Savanna Sentinel must clearly separate four categories:

| Category | Meaning | Example |
|---|---|---|
| Observed | Directly supported by camera-trap images or stored labels | "This held-out event was predicted as zebra." |
| Measured | Computed from public environmental data | "The 7-day rainfall total near this site was 18 mm." |
| Inferred | Statistical/model-derived from observations and covariates | "Activity increased relative to active-camera effort." |
| Hypothesized | Ecological explanation, not a direct fact | "This may reflect a forage pulse after rainfall." |

The system must never claim current animal presence from satellite imagery alone. Current satellite data can monitor habitat and risk, but medium-to-large mammals are not reliably observable as individual animals in public moderate-resolution satellite data. Current animal presence requires current camera-trap images, field observations, telemetry, or other direct animal data.

# 2. Project identity

## 2.1 Name

**Savanna Sentinel**

## 2.2 One-line pitch

Savanna Sentinel turns real Serengeti camera-trap images and public Earth data into a grounded, explainable biodiversity monitoring system powered by fine-tuned Gemma 4 and deployed through Ollama.

## 2.3 Longer pitch

Camera traps are the eyes of conservation, but millions of images overwhelm human teams. Savanna Sentinel fine-tunes Gemma 4 to understand Serengeti camera-trap events, then connects each detection to location, time, camera effort, rainfall, vegetation, water, fire, and uncertainty. Instead of a black-box species label, it gives conservation teams a living map, evidence-linked answers, and a review workflow for uncertain cases.

## 2.4 Hackathon alignment

The Gemma 4 Good Hackathon asks for solutions using Gemma 4 to create positive global impact and specifically values post-training, domain adaptation, agentic retrieval, local intelligence, multimodal understanding, function calling, working demos, public code, and published weights/benchmarks for trained models.[^hackathon]

Savanna Sentinel aligns directly:

- **Global Resilience:** biodiversity and climate resilience monitoring.
- **Safety & Trust:** grounded responses, uncertainty, observed/inferred separation.
- **Health & Sciences:** accelerates ecological analysis and wildlife research.
- **Ollama special track:** public demo via Ollama API/cloud or Ollama-compatible hosted server.
- **Unsloth special track:** fine-tuned Gemma 4 adapter/weights if Unsloth supports the selected training path.

# 3. Scope

## 3.1 Geographic scope

The product scope is **Serengeti National Park and the Snapshot Serengeti camera grid**. The primary camera-trap study area is a 1,125 km2 grid inside the long-term Serengeti Lion Project study area, covering an intersection of open plains and savanna woodlands.[^snapshot-paper]

## 3.2 Data scope

Core training and evaluation use Snapshot Serengeti camera-trap images, metadata, raw classifications, consensus labels, search effort, and gold-standard labels.

Public environmental data can be joined as context:

- rainfall;
- vegetation greenness/productivity;
- water seasonality and distance to water;
- fire/burn history;
- temperature/soil moisture/climate stress;
- protected-area boundaries;
- roads/tracks and human-access proxies;
- modern satellite basemaps for visualization.

## 3.3 Product scope

Savanna Sentinel is not only a model. It is a full system:

- data ingestion and mirroring;
- training data generation;
- fine-tuned Gemma 4 model;
- geospatial data warehouse;
- tool-calling inference service;
- map-based UI;
- evaluation suite;
- public demo deployment;
- Kaggle writeup and public code repository.

## 3.4 Explicit non-scope

The project will not claim:

- real-time current animal locations without current camera feeds;
- precise bounding-box localization from the original Dryad release alone;
- individual identity for most species;
- production-ready anti-poaching surveillance;
- replacement of human ecologists or park authorities.

# 4. Source data

## 4.1 Snapshot Serengeti canonical Dryad release

The canonical release contains:

| Dataset file | Approximate role | Use in Savanna Sentinel |
|---|---|---|
| `all_images.csv` | Image URL suffixes, one row per image | Download or reference camera-trap images |
| `raw_data_for_dryad.csv.zip` | All volunteer classifications | Uncertainty training, blank sampling, weak labels |
| `consensus_data.csv` | Aggregated labels and metadata | Primary supervised labels and geospatial event table |
| `search_effort.csv` | Camera active windows | Effort correction and map truth |
| `gold_standard_data.csv` | Expert labels | Locked final evaluation |
| README files | Field descriptions | Schema validation |

The original paper reports `all_images.csv` with 3,198,737 rows, `raw_data.csv` with 10,530,564 rows, `consensus_data.csv` with 334,671 rows, `search_effort.csv` with 1,128 rows, and `gold_standard_data.csv` with 4,432 rows covering 4,149 expert-classified capture events.[^snapshot-paper]

The Dryad dataset page lists the same main files and package size, and describes gold-standard and operation-date data.[^dryad]

## 4.2 Snapshot Serengeti expanded LILA release

For optional scale-up, LILA describes a larger Snapshot Serengeti release with approximately 2.65 million image sequences and 7.1 million images from seasons 1 through 11, with labels across 61 categories, about 76% empty images, and approximately 150,000 bounding-box annotations on roughly 78,000 images.[^lila-serengeti]

Use policy:

- **Core model and paper claims:** use the canonical Dryad release and uploaded Scientific Data paper.
- **Scale-up and bounding-box optional module:** use LILA if we need more images, standard COCO Camera Traps JSON, recommended train/validation splits, or bounding boxes.
- **Do not mix split regimes:** if using LILA, create a separate split manifest and do not contaminate the Dryad gold-standard evaluation.

## 4.3 Snapshot Safari 2024 Expansion

Snapshot Safari 2024 Expansion includes 4,029,374 images from 15 camera trapping projects, including a Snapshot Serengeti/SER portion, and is released in COCO Camera Traps format under a permissive Community Data License Agreement.[^safari-expansion]

For this project, use it only as:

- an optional domain robustness set;
- a cross-site generalization stress test;
- not as the core Serengeti-only benchmark unless filtered to SER and documented.

## 4.4 Data access plan

### 4.4.1 Canonical Dryad metadata

1. Download the Dryad package.
2. Store in `data/raw/snapshot_serengeti_dryad/`.
3. Compute checksums.
4. Load CSVs into staging tables.
5. Validate schema and row counts.

### 4.4.2 Image retrieval

The uploaded paper states that images can be accessed by appending `URL_Info` from `all_images.csv` to the Snapshot Serengeti image host; it also notes that the host was not intended as a proper archival image storage site for the terabytes of raw images.[^snapshot-paper]

Implementation:

```text
base_url = "https://snapshotserengeti.s3.msi.umn.edu/"
image_url = base_url + URL_Info
```

Operationally, we should mirror a controlled subset first:

- `train_core_high_confidence/`
- `val_event/`
- `val_spatial/`
- `val_temporal/`
- `test_gold/`
- `demo_stream/`
- `rare_species_pack/`
- `hard_cases_pack/`

For the full build, mirror all required images into cloud object storage:

```text
s3://savanna-sentinel-data/images/snapshot_serengeti/{season}/{site}/{filename}
gs://savanna-sentinel-data/images/...
r2://savanna-sentinel-demo/images/...
```

### 4.4.3 LILA access

LILA provides GCP, AWS, and Azure cloud storage paths for Snapshot Serengeti images and metadata and recommends using cloud tools such as `gsutil`, `aws s3`, or AzCopy rather than giant zipfiles.[^lila-serengeti]

Preferred for large-scale training:

```bash
# Example only: use exact LILA bucket path from metadata.
gsutil -m cp -r gs://public-datasets-lila/snapshotserengeti-unzipped ./data/lila/
aws s3 sync s3://us-west-2.opendata.source.coop/agentmorris/lila-wildlife/snapshotserengeti-unzipped ./data/lila/
```

## 4.5 Licensing and attribution

- The Scientific Data article is licensed under Creative Commons Attribution 4.0; metadata associated with the Data Descriptor is released under CC0.[^snapshot-paper]
- Dryad data should be cited using the Dryad DOI and the original paper.[^dryad]
- LILA Snapshot Serengeti is released under the Community Data License Agreement, permissive variant, and asks users to cite the associated manuscript.[^lila-serengeti]
- Human images require special care. LILA states the original human class label exists in metadata, but human images were removed from that version for privacy reasons.[^lila-serengeti]

# 5. Public environmental and geospatial data

Savanna Sentinel joins each camera event to environmental context. These layers are used for monitoring, querying, and reporting, not as hidden animal labels.

## 5.1 Required open layers

| Layer | Source | Main features | Why it matters |
|---|---|---|---|
| Rainfall | CHIRPS Daily | 1, 7, 14, 30, 60 day rainfall totals and anomalies | Forage pulses, migration context, drought |
| Vegetation | MODIS MOD13Q1 | NDVI/EVI, 16-day composites, QA flags | Greenness/productivity and seasonal forage |
| Climate stress | ERA5-Land | temperature, soil moisture, evapotranspiration | Heat, drought, environmental stress |
| Surface water | JRC Global Surface Water | water occurrence, seasonality, distance to water | Dry-season concentration and water access |
| Burned area | MODIS MCD64A1 | monthly burn date and burned-area indicators | Fire disturbance and post-burn forage |
| Active fire | VIIRS/FIRMS or NASA products | near-real-time hotspots | Current hazard context |
| Land cover | ESA WorldCover or Landsat-derived local layers | grassland, shrubland, tree cover, water, built-up | Habitat stratification |
| Boundaries | WDPA/Protected Planet | protected-area boundary | scope and map context |
| Roads/tracks | OSM/Overpass | distance to road/track/settlement/tourism proxy | human pressure proxy |

CHIRPS provides quasi-global daily rainfall from 1981 onward at 0.05 degree resolution and is suitable for trend analysis and seasonal drought monitoring.[^chirps] MODIS MOD13Q1 provides NDVI/EVI every 16 days at 250 m resolution.[^modis] ERA5-Land provides land-surface variables from 1950 to about 5 days before present at roughly 9 km resolution.[^era5] JRC Global Surface Water maps global surface water occurrence and seasonality using Landsat-derived data at 30 m resolution.[^jrc-water]

## 5.2 Historical vs current compatibility

| Data source | Historical 2010-2013 compatibility | Current monitoring compatibility | Notes |
|---|---:|---:|---|
| CHIRPS | Yes | Yes | Ideal rainfall layer |
| MODIS NDVI/EVI | Yes | Yes | Main greenness layer |
| ERA5-Land | Yes | Near-current | Coarser but useful |
| JRC water | Yes as long-term water layer | Partially | Long-term static/seasonal water context |
| Landsat C2 | Yes | Yes | 30 m detailed surface reflectance |
| Sentinel-2 | No for 2010-2013 | Yes | Modern high-resolution context only |
| ESA WorldCover | No historical match | Yes baseline | Modern land-cover baseline only |
| VIIRS active fire | Partly after 2011 | Yes | Current fire/risk layer |

Landsat Collection 2 Level-2 products provide global surface reflectance and surface temperature science products, with surface reflectance available from Landsat 4-9 missions across the relevant historical period.[^landsat] Sentinel-2 and ESA WorldCover are primarily for the modern deployment layer, not for labeling the original 2010-2013 training set.[^sentinel-hub][^worldcover]

## 5.3 APIs and services

| Service | Use | Core or optional |
|---|---|---|
| Google Earth Engine Python API | Batch extraction of CHIRPS, MODIS, JRC, Landsat, WorldCover | Core |
| NASA GIBS WMTS/WMS | Fast satellite tiles and public map visualizations | Optional but useful |
| Copernicus Sentinel Hub | Sentinel imagery, NDVI/statistics, current imagery API | Optional/current mode |
| NASA FIRMS/VIIRS | Fire alerts and hotspots | Optional/current mode |
| Overpass API / OSM extracts | Roads/tracks/settlements/human-pressure proxy | Optional but useful |
| Protected Planet / WDPA | Protected-area boundaries | Core map context |
| SkyFi/EOSDA/commercial APIs | High-resolution commercial imagery | Optional only |

NASA GIBS provides standards-based WMTS/WMS/TWMS/GDAL access to global satellite imagery visualizations, with many products updated daily and available within hours after observation.[^gibs] Sentinel Hub provides REST APIs for raw satellite data, rendered imagery, statistical analysis, catalog search, and processing over user-defined areas and time windows.[^sentinel-hub]

## 5.4 DPhi / SimSat note

No DPhi or SimSat dependency is required for the core product. If "DPhi" refers to a documentation/evaluation platform, it can host notebooks or reports but should not be a data dependency. If "SimSat" refers to a satellite simulation or commercial imagery provider, it should be treated as optional visualization or procurement infrastructure, not as the scientific source of truth. The open, reproducible stack for this hackathon should be:

```text
Google Earth Engine + CHIRPS + MODIS + ERA5-Land + JRC Water + Landsat + OSM + WDPA
```

Use commercial APIs only if the demo needs higher-resolution basemap visuals. Avoid building the core inference claims on proprietary imagery that judges cannot reproduce.

# 6. System architecture

## 6.1 High-level architecture

```text
                 +-----------------------------+
                 |       Public web app        |
                 |  Map, event review, chat    |
                 +--------------+--------------+
                                |
                                v
+----------------+    +-------------------------+     +---------------------+
| Camera images  | -> | FastAPI inference/API   | --> | Ollama model host   |
| Snapshot/demo  |    | auth, tools, validators |     | Gemma 4 fine-tuned  |
+----------------+    +-----------+-------------+     +---------------------+
                                  |
          +-----------------------+------------------------+
          |                        |                       |
          v                        v                       v
+-------------------+    +--------------------+    +--------------------+
| PostGIS warehouse |    | Vector/image index |    | Earth data tools   |
| events, sites,    |    | similar events,    |    | GEE, GIBS, OSM,    |
| effort, labels    |    | reports, species   |    | Sentinel Hub       |
+-------------------+    +--------------------+    +--------------------+
          |
          v
+-------------------+
| Evidence cards    |
| tool logs, row IDs|
| citations, images |
+-------------------+
```

## 6.2 Core layers

### Layer A: Data lake

Stores raw and processed assets.

```text
data/
  raw/
    dryad/
    lila/
    earth_engine_exports/
  mirrored_images/
  processed/
    parquet/
    event_manifests/
    splits/
    environmental_features/
  training/
    sft_jsonl/
    eval_jsonl/
  demo/
    hidden_label_stream/
```

### Layer B: Warehouse

PostGIS stores authoritative event, site, environmental, and prediction tables. This is the source of truth for tool calls.

### Layer C: Model layer

- **Gemma 4 VLM event interpreter:** image/text-to-JSON inference.
- **Gemma 4 tool-calling agent:** chooses tools and composes grounded answers.
- **Embedding model:** image/event/report similarity search.
- **Statistical models:** occupancy/activity/anomaly calculations outside the LLM.

### Layer D: Grounding and tool layer

Tools retrieve from PostGIS, vector stores, object storage, and environmental APIs. Every response is grounded through tool outputs.

### Layer E: Product interface

Next.js/React or Streamlit/Gradio for the first demo, with MapLibre/Deck.gl for maps.

# 7. Data model and schemas

## 7.1 Entity definitions

| Entity | Definition |
|---|---|
| Capture event | One camera trigger, usually 1-3 images, the ecological analysis unit |
| Event image | One image file belonging to a capture event |
| Detection | A predicted or labeled species occurrence within an event |
| Camera site | A fixed camera location with UTM/WGS84 coordinates |
| Search effort | Time intervals when a camera was functioning properly |
| Environmental snapshot | Satellite/climate features extracted for one site/time window |
| Biodiversity state vector | Aggregated state for species/site/cell/time window |
| Review task | A human review item created from low-confidence or anomalous outputs |
| Evidence card | A user-visible bundle of source rows, images, tool calls, and confidence |

## 7.2 SQL schema

### 7.2.1 `camera_site`

```sql
CREATE TABLE camera_site (
  site_id TEXT PRIMARY KEY,
  utm_x DOUBLE PRECISION,
  utm_y DOUBLE PRECISION,
  utm_zone TEXT DEFAULT '36S',
  datum TEXT DEFAULT 'Arc1960',
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  geom GEOMETRY(Point, 4326),
  grid_cell_id TEXT,
  habitat_class TEXT,
  notes TEXT
);
```

### 7.2.2 `capture_event`

```sql
CREATE TABLE capture_event (
  capture_event_id TEXT PRIMARY KEY,
  site_id TEXT REFERENCES camera_site(site_id),
  datetime_local TIMESTAMP,
  timezone TEXT DEFAULT 'UTC+3',
  num_images INT,
  season TEXT,
  source_dataset TEXT,
  split_name TEXT,
  has_consensus_label BOOLEAN DEFAULT FALSE,
  has_gold_label BOOLEAN DEFAULT FALSE,
  is_demo_hidden BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT now()
);
```

### 7.2.3 `event_image`

```sql
CREATE TABLE event_image (
  image_id TEXT PRIMARY KEY,
  capture_event_id TEXT REFERENCES capture_event(capture_event_id),
  url_info TEXT,
  source_url TEXT,
  mirrored_uri TEXT,
  frame_index INT,
  width INT,
  height INT,
  checksum_sha256 TEXT,
  is_available BOOLEAN,
  contains_human_redacted BOOLEAN DEFAULT FALSE
);
```

### 7.2.4 `consensus_label`

```sql
CREATE TABLE consensus_label (
  id BIGSERIAL PRIMARY KEY,
  capture_event_id TEXT REFERENCES capture_event(capture_event_id),
  num_species INT,
  species TEXT,
  count_bin TEXT,
  standing DOUBLE PRECISION,
  resting DOUBLE PRECISION,
  moving DOUBLE PRECISION,
  eating DOUBLE PRECISION,
  interacting DOUBLE PRECISION,
  babies DOUBLE PRECISION,
  num_classifications INT,
  num_votes INT,
  num_blanks INT,
  evenness DOUBLE PRECISION,
  percent_support DOUBLE PRECISION GENERATED ALWAYS AS
    (CASE WHEN num_classifications > 0 THEN num_votes::DOUBLE PRECISION / num_classifications ELSE NULL END) STORED
);
```

### 7.2.5 `gold_label`

```sql
CREATE TABLE gold_label (
  id BIGSERIAL PRIMARY KEY,
  capture_event_id TEXT REFERENCES capture_event(capture_event_id),
  num_species INT,
  species TEXT,
  count_bin TEXT,
  is_impossible BOOLEAN DEFAULT FALSE,
  expert_notes TEXT
);
```

### 7.2.6 `raw_classification`

```sql
CREATE TABLE raw_classification (
  id BIGSERIAL PRIMARY KEY,
  capture_event_id TEXT,
  classification_id TEXT,
  user_id_hash TEXT,
  species TEXT,
  count_bin TEXT,
  standing BOOLEAN,
  resting BOOLEAN,
  moving BOOLEAN,
  eating BOOLEAN,
  interacting BOOLEAN,
  babies BOOLEAN
);
```

### 7.2.7 `camera_effort`

```sql
CREATE TABLE camera_effort (
  id BIGSERIAL PRIMARY KEY,
  site_id TEXT REFERENCES camera_site(site_id),
  start_date DATE,
  end_date DATE,
  active_days DOUBLE PRECISION,
  source TEXT DEFAULT 'search_effort.csv'
);
```

### 7.2.8 `environmental_snapshot`

```sql
CREATE TABLE environmental_snapshot (
  id BIGSERIAL PRIMARY KEY,
  site_id TEXT REFERENCES camera_site(site_id),
  capture_event_id TEXT REFERENCES capture_event(capture_event_id),
  datetime_local TIMESTAMP,
  rainfall_1d_mm DOUBLE PRECISION,
  rainfall_7d_mm DOUBLE PRECISION,
  rainfall_30d_mm DOUBLE PRECISION,
  rainfall_30d_anomaly DOUBLE PRECISION,
  modis_ndvi_16d DOUBLE PRECISION,
  modis_evi_16d DOUBLE PRECISION,
  evi_anomaly DOUBLE PRECISION,
  era5_temp_c DOUBLE PRECISION,
  era5_soil_moisture DOUBLE PRECISION,
  water_occurrence_pct DOUBLE PRECISION,
  distance_to_water_m DOUBLE PRECISION,
  burned_area_recent BOOLEAN,
  landcover_class TEXT,
  source_versions JSONB,
  extracted_at TIMESTAMP DEFAULT now()
);
```

### 7.2.9 `model_prediction`

```sql
CREATE TABLE model_prediction (
  prediction_id UUID PRIMARY KEY,
  capture_event_id TEXT REFERENCES capture_event(capture_event_id),
  model_name TEXT,
  model_version TEXT,
  inference_mode TEXT,
  prediction_json JSONB,
  blank_probability DOUBLE PRECISION,
  max_species_confidence DOUBLE PRECISION,
  review_needed BOOLEAN,
  reason_for_review TEXT,
  latency_ms INT,
  created_at TIMESTAMP DEFAULT now()
);
```

### 7.2.10 `tool_call_log`

```sql
CREATE TABLE tool_call_log (
  tool_call_id UUID PRIMARY KEY,
  session_id TEXT,
  user_query TEXT,
  tool_name TEXT,
  arguments JSONB,
  result_summary JSONB,
  row_count INT,
  evidence_ids TEXT[],
  started_at TIMESTAMP,
  finished_at TIMESTAMP,
  error TEXT
);
```

### 7.2.11 `review_task`

```sql
CREATE TABLE review_task (
  review_task_id UUID PRIMARY KEY,
  capture_event_id TEXT REFERENCES capture_event(capture_event_id),
  prediction_id UUID REFERENCES model_prediction(prediction_id),
  priority TEXT,
  reason TEXT,
  status TEXT DEFAULT 'open',
  assigned_to TEXT,
  reviewer_label JSONB,
  created_at TIMESTAMP DEFAULT now(),
  resolved_at TIMESTAMP
);
```

## 7.3 Inference input schema

```json
{
  "capture_event_id": "ASG0000009",
  "images": [
    {"frame_index": 1, "uri": "s3://.../image1.jpg"},
    {"frame_index": 2, "uri": "s3://.../image2.jpg"}
  ],
  "metadata": {
    "site_id": "B04",
    "datetime_local": "2012-03-14T06:32:11+03:00",
    "latitude": -2.12345,
    "longitude": 34.56789,
    "num_images": 2
  },
  "environment": {
    "rainfall_7d_mm": 18.2,
    "modis_evi_16d": 0.43,
    "distance_to_water_m": 820,
    "landcover_class": "grassland"
  },
  "instructions": {
    "return_schema": "savanna_sentinel_event_v1",
    "do_not_use_labels": true,
    "allowed_species_taxonomy": "snapshot_serengeti_48_or_lila_61"
  }
}
```

## 7.4 Inference output schema

```json
{
  "capture_event_id": "ASG0000009",
  "blank": false,
  "detections": [
    {
      "species": "spotted hyena",
      "count_bin": "1",
      "behaviors": {
        "standing": false,
        "resting": false,
        "moving": true,
        "eating": false,
        "interacting": false
      },
      "young_present": false,
      "confidence": 0.91,
      "visual_evidence": "single animal visible in night frame, body shape and posture consistent with spotted hyena"
    }
  ],
  "review": {
    "review_needed": false,
    "priority": "normal",
    "reason": null
  },
  "grounding": {
    "input_images_used": ["image1", "image2"],
    "metadata_used": ["site_id", "datetime_local"],
    "environment_used": ["rainfall_7d_mm", "modis_evi_16d"],
    "labels_used": false
  }
}
```

## 7.5 Biodiversity state vector schema

The state vector is the VectorOS-like core object. It summarizes one species, site/cell, and time window.

```json
{
  "state_vector_id": "serengeti_hex12_zebra_2012w14",
  "species": "zebra",
  "cell_id": "hex12_044",
  "site_ids": ["B04", "B05", "C04"],
  "time_window": {"start": "2012-04-01", "end": "2012-04-07"},
  "effort": {"active_camera_days": 19.0, "active_sites": 3},
  "detections": {
    "event_count": 37,
    "count_index": 112,
    "blank_rate": 0.76,
    "prediction_confidence_mean": 0.89
  },
  "behavior": {
    "moving_rate": 0.74,
    "eating_rate": 0.18,
    "resting_rate": 0.03,
    "young_present_rate": 0.06
  },
  "environment": {
    "rainfall_30d_anomaly": 1.3,
    "evi_anomaly": 0.11,
    "distance_to_water_m_mean": 910,
    "burned_area_recent": false
  },
  "relationships": {
    "co_detection_species": ["wildebeest", "Thomson's gazelle"],
    "predator_pressure_index": 0.24,
    "human_activity_index": 0.03
  },
  "interpretation": {
    "state_label": "herbivore_activity_pulse",
    "confidence": "medium_high",
    "claim_type": "inferred"
  }
}
```

# 8. Data gathering and ETL pipeline

## 8.1 Repository structure

```text
savanna-sentinel/
  README.md
  LICENSE
  pyproject.toml
  docker-compose.yml
  data/
    manifests/
    splits/
  notebooks/
    00_dataset_audit.ipynb
    01_download_images.ipynb
    02_build_splits.ipynb
    03_extract_environment.ipynb
    04_train_gemma4_sft.ipynb
    05_eval_gold_standard.ipynb
  src/
    sentinel_data/
    sentinel_models/
    sentinel_tools/
    sentinel_eval/
    sentinel_app/
  app/
    web/
    api/
  infra/
    ollama/
    db/
    cloudrun/
  eval/
    benchmarks/
    reports/
  models/
    adapters/
    gguf/
    modelfiles/
```

## 8.2 ETL steps

### Step 1: Download metadata

Inputs:

- Dryad CSV files;
- optional LILA metadata JSON/CSV;
- data-source readmes.

Outputs:

- `metadata_manifest.json`;
- staging tables;
- checksum report.

### Step 2: Normalize event IDs

Create one authoritative capture-event table by joining:

```text
all_images.CaptureEventID
raw_data.CaptureEventID
consensus_data.CaptureEventID
gold_standard_data.CaptureEventID
```

Rules:

- never split individual images from the same `CaptureEventID` across train/test;
- one event can have multiple species rows;
- one event can have 1-3 image rows;
- blank events may appear only in raw classifications, not consensus animal labels.

### Step 3: Convert coordinates

The paper describes `LocationX` and `LocationY` as UTM coordinates with datum Arc1960, zone 36S.[^snapshot-paper]

Use `pyproj`:

```python
from pyproj import Transformer
transformer = Transformer.from_crs("EPSG:21036", "EPSG:4326", always_xy=True)
lon, lat = transformer.transform(location_x, location_y)
```

If EPSG code behavior is uncertain, validate using known Serengeti bounds and the camera map.

### Step 4: Build blank examples

Consensus data excludes blank/blank-consensus events; raw data includes them. Use raw data to build blank training examples:

```text
blank_event if all or enough raw classifications are species='blank'
blank_consensus if retirement reason or vote pattern indicates blank consensus
hard_blank if NumBlanks is high but animal consensus exists
```

### Step 5: Mirror images

For each event in a split manifest:

1. get all `URL_Info` rows;
2. construct source URL;
3. download with retries;
4. check content type and image load;
5. store to object storage;
6. record checksum, width, height, and availability.

### Step 6: Extract environmental features

For every event, extract features at the site geometry and relevant time windows:

```text
rainfall_1d, rainfall_7d, rainfall_30d
rainfall_anomaly_monthly
NDVI/EVI nearest MODIS 16-day composite
NDVI/EVI anomalies against historical site-month baseline
ERA5-Land temperature and soil moisture
surface water occurrence and distance_to_water
burned area within 1/5/10 km and 30/90 days
landcover class
road distance and road density
```

### Step 7: Build training JSONL

Every row becomes a conversational multimodal example.

Example:

```json
{
  "id": "ASG0010cz5",
  "images": ["/images/ASG0010cz5_1.jpg", "/images/ASG0010cz5_2.jpg"],
  "messages": [
    {"role": "system", "content": "You are Savanna Sentinel, a Serengeti camera-trap event interpreter. Return only valid JSON."},
    {"role": "user", "content": "Classify this capture event. Include species, count_bin, behavior, young_present, confidence, and review flag."},
    {"role": "assistant", "content": "{\"blank\":false,\"detections\":[{\"species\":\"giraffe\",\"count_bin\":\"1\",\"behaviors\":{\"moving\":true},\"young_present\":false,\"confidence\":0.96}],\"review\":{\"review_needed\":false}}"}
  ]
}
```

# 9. Training, validation, evaluation, and demo splits

## 9.1 Leakage rules

- Split by `CaptureEventID`, never by individual image.
- Remove every gold-standard `CaptureEventID` from training and validation.
- Keep demo-stream events unseen by the model.
- If using LILA seasons, keep LILA location-based splits separate from Dryad split logic.
- Do not use raw volunteer votes, consensus labels, or gold labels during inference.

## 9.2 Recommended split plan

| Split | Source | Purpose | Labels visible during training? |
|---|---|---|---|
| `train_core` | High/medium-confidence consensus events + sampled blanks | Main SFT | Yes |
| `train_uncertainty` | Raw votes + consensus difficulty | Review routing and calibration | Yes |
| `train_agent_tools` | Generated geospatial Q/A over real database | Tool-calling and report generation | Yes |
| `val_event` | Held-out random events | Hyperparameters | Validation only |
| `val_spatial` | Held-out camera sites | Generalization to new sites | Validation only |
| `val_temporal` | Later months/seasons | Seasonal generalization | Validation only |
| `test_gold` | Gold-standard labels | Locked final model benchmark | Never train |
| `test_hard` | High-evenness, rare, multi-species, night, high-blank cases | Stress test | Never train |
| `demo_stream` | Real hidden events | Public live replay | Labels hidden until reveal |
| `current_env` | Current public Earth data | Habitat context | Not animal labels |

## 9.3 Suggested proportions

For the canonical Dryad release:

```text
Gold standard: locked, all gold events excluded from other splits.
Remaining animal events:
  train_core: ~70%
  val_event: ~10%
  val_spatial: ~10% by held-out sites
  val_temporal: ~10% by held-out later period
Blank events:
  sample enough to reflect realistic blank prevalence and balanced training needs.
Demo stream:
  500-2,000 real events, stratified by common species, rare species, blanks, and hard cases.
```

## 9.4 Class imbalance plan

The original event counts are highly imbalanced. Wildebeest, zebra, and Thomson's gazelle dominate; species like zorilla, genet, rhinoceros, civet, honey badger, and wildcat are rare.[^snapshot-paper]

Training sampler:

```text
p(sample event) = 0.45 balanced_by_species
                + 0.25 natural_frequency
                + 0.15 rare_species_boost
                + 0.15 hard_case_boost
```

Loss strategy:

- normal SFT loss for JSON output;
- oversample rare species;
- do not over-promise rare species precision;
- require review for rare species unless confidence is high and evidence is strong.

# 10. Gemma 4 fine-tuning strategy

## 10.1 Model roles

Savanna Sentinel uses Gemma 4 in three roles.

### Role 1: Multimodal event interpreter

Input:

- one to three camera-trap images;
- site/time metadata;
- optional environmental context.

Output:

- blank/non-blank;
- species list;
- count bin;
- behavior labels;
- young-present flag;
- confidence;
- review-needed decision;
- evidence sentence.

### Role 2: Tool-calling geo-ecological agent

Input:

- user question;
- conversation context;
- available tool schemas.

Output:

- function/tool calls;
- grounded answer based on tool results;
- observed/inferred/hypothesized separation;
- evidence cards.

### Role 3: Conservation report generator

Input:

- computed detection summaries;
- environmental changes;
- uncertainty metrics;
- retrieved evidence.

Output:

- ranger brief;
- scientist brief;
- public education summary;
- benchmark/evaluation report.

## 10.2 Why Gemma 4

Hugging Face's Gemma 4 documentation describes Gemma 4 as a multimodal family with E2B, E4B, 31B, and 26B-A4B variants, processing text and image inputs across all models, with audio on E2B/E4B, large context windows, reasoning modes, and function-calling support.[^gemma4-hf]

That maps well to Savanna Sentinel:

- **image-text understanding:** camera-trap image events;
- **long context:** reports, tool results, state vectors;
- **function calling:** geospatial tools;
- **local/cloud deployment:** Ollama-compatible demo;
- **open weights:** public model weights/benchmarks.

## 10.3 Training stack options

### Preferred path A: Hugging Face Transformers + TRL + PEFT

Use this if it is the most stable multimodal training path.

Hugging Face Transformers documents `AutoProcessor` and `AutoModelForImageTextToText` for Gemma 4 image-text generation.[^gemma4-hf] Hugging Face TRL's `SFTTrainer` supports supervised fine-tuning for vision-language models with an `images` column and recommends `max_length=None` to avoid truncating image tokens.[^trl-sft]

Stack:

```text
transformers
trl
peft
accelerate
bitsandbytes
safetensors
datasets
pillow
wandb or mlflow
```

### Preferred path B: Unsloth if Gemma 4 VLM training path is convenient

Use Unsloth if it supports the selected Gemma 4 variant and multimodal SFT efficiently. Hugging Face lists Unsloth integration for faster training and reduced memory usage across model families including Gemma.[^unsloth-hf] Unsloth also publishes Gemma-family running/fine-tuning guides and Gemma model artifacts, and its model hub lists Gemma 4 variants.[^unsloth-docs]

Stack:

```text
unsloth
trl
transformers
peft
datasets
bitsandbytes
```

### Fallback path C: two-stage system

If Gemma 4 VLM fine-tuning is blocked by tool maturity:

1. train/fine-tune a specialist vision classifier or use existing camera-trap detector for species probability;
2. feed top-k visual predictions, images, and metadata to Gemma 4 for structured event interpretation and tool-grounded reasoning;
3. still publish a Gemma 4 fine-tune for JSON output, tool-calling, and report generation.

This fallback is still valid but less compelling than full multimodal Gemma 4 event fine-tuning.

## 10.4 Fine-tuning phases

### Phase 0: Baseline eval before training

Run base Gemma 4 on a small gold/demo sample with the output schema. Measure:

- schema validity;
- species accuracy;
- blank recall;
- count accuracy;
- refusal/hallucination rate;
- latency in Ollama or HF inference.

### Phase 1: Event interpreter SFT

Train on `train_core` with image bursts and consensus/gold-free labels.

Target output:

```json
{
  "blank": false,
  "detections": [
    {"species": "zebra", "count_bin": "3", "behaviors": {"moving": true}, "young_present": false, "confidence": 0.88}
  ],
  "review": {"review_needed": false, "reason": null}
}
```

### Phase 2: Uncertainty and review routing

Train with examples where raw vote disagreement predicts difficulty.

Targets:

- high confidence accept;
- expert review;
- impossible/insufficient detail;
- likely multi-species missed;
- species-pair confusion.

The paper reports that higher raw-classification disagreement predicted incorrect consensus results, and that percent support, `NumBlanks`, and `Evenness` can be used to target uncertain images for review or exclusion.[^snapshot-paper]

### Phase 3: Tool-calling SFT

Create synthetic but database-grounded tool-calling examples over real tables.

Example user query:

```text
Where did zebra detections increase after rainfall in April 2012?
```

Target tool plan:

```json
[
  {"name": "query_detections", "arguments": {"species": "zebra", "date_range": ["2012-04-01", "2012-04-30"]}},
  {"name": "get_camera_effort", "arguments": {"date_range": ["2012-04-01", "2012-04-30"]}},
  {"name": "extract_rainfall", "arguments": {"window_days": 30, "layer": "CHIRPS"}},
  {"name": "compare_to_baseline", "arguments": {"metric": "detections_per_effort"}}
]
```

### Phase 4: Grounded report SFT

Train on report examples generated from deterministic summaries.

Output format:

```text
Observed:
- 37 zebra detections across 19 active camera-days in eastern cells.
Measured:
- 30-day rainfall anomaly was above baseline.
Inferred:
- Detection-per-effort increased relative to the same month baseline.
Hypothesized:
- The pattern may reflect a local forage pulse.
Evidence:
- Events: ASG..., ASG...
- Tools: query_detections, get_camera_effort, extract_rainfall
```

## 10.5 LoRA/QLoRA configuration

Initial recommended config:

| Setting | Value |
|---|---|
| Base model | `google/gemma-4-E4B-it` or stronger available Gemma 4 VLM |
| Method | LoRA or QLoRA SFT |
| Precision | bf16 if available; 4-bit NF4 for QLoRA |
| LoRA rank | 16 or 32 first; 64 for final if stable |
| LoRA alpha | 32 or 64 |
| LoRA dropout | 0.05 |
| Target modules | attention and MLP projection layers; include multimodal projector if supported |
| Vision encoder | freeze first, then optionally unfreeze projector only |
| Max length | `None` for VLM SFT if using TRL to avoid image-token truncation |
| Batch size | as GPU memory allows; gradient accumulation to effective 64-256 examples |
| LR | 1e-4 for adapter-only SFT; 2e-5 if unfreezing projector |
| Epochs | 1-3, early stopping by validation macro-F1 + schema validity |
| Sampler | balanced species + hard-case + natural-frequency mixture |

## 10.6 Training data families

| Family | Inputs | Labels | Why it matters |
|---|---|---|---|
| Event classification | image burst + minimal metadata | species/count/behavior/young | core model ability |
| Blank triage | blank and hard blank images | blank true/false | time-saving workflow |
| Multi-species handling | images with `NumSpecies > 1` | multiple species rows | prevents missed co-detections |
| Count estimation | herd images | count bin | ecological signal |
| Behavior extraction | images + consensus behavior proportions | behavior booleans/rates | behavior monitoring |
| Young presence | images + `Babies` proportion | young true/false | population/reproduction signal |
| Uncertainty | high/low evenness, blank votes, support | review routing | trust and safety |
| Tool-calling | user question + tool schemas | tool call JSON | grounded answers |
| Reporting | tool summaries | structured report | demo narrative |

## 10.7 Prompt template

System prompt:

```text
You are Savanna Sentinel, a Serengeti biodiversity monitoring model.
You classify camera-trap capture events and answer ecological questions.
Return only valid JSON for event classification.
For ecological questions, use tools before making factual claims.
Separate observed facts, measured environmental data, inferred trends, and hypotheses.
Never claim current animal presence without current camera or field observations.
If evidence is weak, say review_needed=true or state uncertainty.
```

# 11. Evaluation plan

## 11.1 Evaluation principles

The evaluation must prove four things:

1. Gemma 4 can classify real Serengeti events.
2. The system generalizes beyond seen events/sites/times.
3. Uncertainty routing improves trust.
4. Tool-grounded answers avoid hallucination.

## 11.2 Image/event metrics

| Metric | Definition | Target for demo |
|---|---|---|
| Schema validity | percent of outputs matching JSON schema | > 99% |
| Blank precision/recall/F1 | blank vs animal | strong recall for blanks |
| Species top-1 accuracy | primary species vs gold/consensus | report on gold |
| Species macro-F1 | average across species | emphasize rare classes |
| Rare species F1 | rare species subset | report honestly |
| Multi-species F1 | set match for species list | prevent missed co-detections |
| Count exact accuracy | exact count-bin match | compare to paper baseline |
| Count +-1 bin accuracy | within adjacent bin | ecological robustness |
| Behavior multi-label F1 | standing/resting/moving/eating/interacting | key product differentiator |
| Young-present F1 | babies/young detection | conservation signal |
| Calibration/ECE | confidence reliability | trust layer |
| Review-queue lift | error capture in review queue vs random | key Safety & Trust proof |

The paper's own count validation found 76.4% exact count-bin match and 92.98% within +/-1 bin against expert counts for species counts where the plurality algorithm captured the species.[^snapshot-paper]

## 11.3 Geospatial and ecological metrics

| Metric | Definition |
|---|---|
| Effort-corrected detection accuracy | correct detections per active camera-day |
| Site holdout performance | performance on camera sites absent from training |
| Temporal holdout performance | performance on later/monthly windows |
| Habitat-slice performance | performance across grassland, woodland, water-distance bins |
| Activity curve accuracy | day/night and hourly distribution consistency |
| Query answer correctness | correct tool choice and computed summaries |
| Grounding coverage | percent of answer claims linked to evidence/tool output |
| Unsupported claim rate | claims with no evidence or tool basis |
| Tool argument accuracy | correct species/date/site filters |

## 11.4 Gold-standard evaluation

Use `gold_standard_data.csv` as locked test. The paper states it contains expert classifications for 4,149 capture events, with multiple experts reviewing uncertain cases and some impossible cases.[^snapshot-paper]

Procedure:

```text
1. Load gold events.
2. Ensure none appear in train/validation/demo pretraining.
3. Run model on images + metadata only.
4. Compare predictions to gold labels.
5. Report species, count, impossible/review, and calibration metrics.
6. Publish notebook and split manifest.
```

## 11.5 Hard-case evaluation

Build a test set from:

- high `Evenness`;
- high `NumBlanks` but animal consensus;
- low percent support;
- multi-species events;
- rare species;
- nighttime images;
- common confusion pairs: Grant's gazelle vs Thomson's gazelle, birds, multi-species zebra/wildebeest.

The uploaded paper reports common mistakes including birds and Grant's gazelles confused as Thomson's gazelles.[^snapshot-paper]

## 11.6 Grounding evaluation

Every natural language answer must be evaluated on:

| Metric | Test |
|---|---|
| Tool-required compliance | Did the model call tools before factual claims? |
| SQL correctness | Did tool arguments match the question? |
| Evidence binding | Are event IDs/site IDs/layers attached? |
| Claim typing | Did answer label observed/measured/inferred/hypothesized? |
| No-current-animal hallucination | Does it avoid claiming current animal presence from satellite alone? |
| Refusal/uncertainty | Does it state uncertainty when evidence is missing? |

# 12. Inference design

## 12.1 Inference inputs

At inference time, the model may receive:

- images;
- site ID;
- timestamp;
- coordinates;
- environmental context from public data;
- allowed species taxonomy;
- tool schemas;
- previous tool results.

It must not receive:

- consensus label;
- raw volunteer votes;
- gold labels;
- hidden demo labels;
- evaluation answers.

## 12.2 Event inference flow

```text
1. User uploads or app streams a capture event.
2. Backend fetches images and metadata.
3. Backend extracts environmental context by site/time.
4. Backend calls Gemma 4 event interpreter through Ollama API.
5. JSON schema validator checks output.
6. If invalid, retry with repair prompt or constrained parsing.
7. Prediction is saved to `model_prediction`.
8. Low-confidence/anomalous events create `review_task`.
9. Map and timeline update.
10. Hidden label can be revealed only after prediction in demo mode.
```

## 12.3 Chat/tool inference flow

```text
1. User asks a biodiversity question.
2. Backend determines if tools are required.
3. Gemma 4 proposes tool calls.
4. Backend validates tool name and arguments.
5. Tools execute deterministic searches/calculations.
6. Tool results are stored with evidence IDs.
7. Gemma 4 writes answer using only tool results.
8. Backend checks answer for unsupported claims.
9. UI shows answer + evidence cards + tool log.
```

## 12.4 Inference response policy

Savanna Sentinel responses must follow this structure for ecological claims:

```text
Answer summary
Observed evidence
Measured environmental context
Inferred pattern
Hypothesis or interpretation
Uncertainty and review needs
Evidence cards
```

Example:

```text
Observed: Zebra detections increased in 12 active camera sites during the selected period.
Measured: CHIRPS rainfall was above the same-month baseline in nearby cells.
Inferred: Detection-per-active-camera-day increased relative to the prior 30 days.
Hypothesis: This may represent a local herbivore activity pulse following greening.
Uncertainty: This is not a current-animal-presence claim; it is based on historical Snapshot events and public environmental layers.
```

# 13. Tool calling and grounding

## 13.1 Tool calling through Ollama

Ollama documents tool calling/function calling for chat models, including single-shot, parallel, and multi-turn agent-loop tool calls.[^ollama-tools] Ollama also provides cloud model access through `ollama.com` API endpoints, and the API can be addressed directly at `https://ollama.com/api` for cloud models with API-key authentication.[^ollama-cloud][^ollama-api]

Deployment should use:

```text
backend -> Ollama client -> https://ollama.com/api/chat
```

or, if custom fine-tuned model hosting through Ollama Cloud is not available for the exact model artifact:

```text
backend -> self-managed Ollama-compatible GPU server -> /api/chat
```

The product still qualifies for Ollama usage if the live demo uses Ollama API semantics and a model served through Ollama.

## 13.2 Critical note on custom model hosting

Ollama docs describe Modelfiles for creating customized models, including `FROM`, `SYSTEM`, `PARAMETER`, and `ADAPTER`, and also describe pushing models with the API.[^ollama-modelfile][^ollama-push] Ollama pricing/docs mention cloud models and private model plans, but custom cloud execution support should be verified at implementation time.

Therefore the deployment plan has two paths:

- **Path A:** Upload/push the fine-tuned or adapter-based model and make it accessible through Ollama Cloud if supported.
- **Path B:** Run an Ollama server on a public GPU host and expose it securely as the model endpoint, while still using Ollama tooling and API.

Path B prevents the demo from being blocked by a cloud-model availability limitation.

## 13.3 Tool registry

### 13.3.1 `classify_capture_event`

Purpose: classify an image event.

```json
{
  "name": "classify_capture_event",
  "description": "Classify a camera-trap capture event from images and metadata.",
  "parameters": {
    "type": "object",
    "required": ["capture_event_id"],
    "properties": {
      "capture_event_id": {"type": "string"},
      "include_environment": {"type": "boolean", "default": true}
    }
  }
}
```

### 13.3.2 `query_detections`

Purpose: retrieve observed or predicted species events.

```json
{
  "name": "query_detections",
  "description": "Search labeled or predicted detections by species, site, date, confidence, and data split.",
  "parameters": {
    "type": "object",
    "properties": {
      "species": {"type": "array", "items": {"type": "string"}},
      "date_start": {"type": "string"},
      "date_end": {"type": "string"},
      "site_ids": {"type": "array", "items": {"type": "string"}},
      "min_confidence": {"type": "number"},
      "source": {"type": "string", "enum": ["consensus", "gold", "prediction"]},
      "limit": {"type": "integer", "default": 100}
    }
  }
}
```

### 13.3.3 `get_camera_effort`

Purpose: retrieve active camera-days.

```json
{
  "name": "get_camera_effort",
  "description": "Return camera active periods and active camera-days for sites/date ranges.",
  "parameters": {
    "type": "object",
    "required": ["date_start", "date_end"],
    "properties": {
      "date_start": {"type": "string"},
      "date_end": {"type": "string"},
      "site_ids": {"type": "array", "items": {"type": "string"}}
    }
  }
}
```

### 13.3.4 `extract_environment`

Purpose: extract or retrieve environmental features.

```json
{
  "name": "extract_environment",
  "description": "Retrieve environmental features for sites or geometries across a date range.",
  "parameters": {
    "type": "object",
    "required": ["date_start", "date_end"],
    "properties": {
      "site_ids": {"type": "array", "items": {"type": "string"}},
      "geometry_geojson": {"type": "object"},
      "date_start": {"type": "string"},
      "date_end": {"type": "string"},
      "layers": {"type": "array", "items": {"type": "string"}}
    }
  }
}
```

### 13.3.5 `compare_to_baseline`

Purpose: compare detections/environment to historical baseline.

```json
{
  "name": "compare_to_baseline",
  "description": "Compare a metric to site/species/month historical baselines.",
  "parameters": {
    "type": "object",
    "required": ["metric", "date_start", "date_end"],
    "properties": {
      "metric": {"type": "string"},
      "species": {"type": "string"},
      "site_ids": {"type": "array", "items": {"type": "string"}},
      "date_start": {"type": "string"},
      "date_end": {"type": "string"},
      "baseline_mode": {"type": "string", "enum": ["same_month", "previous_30d", "seasonal", "all_history"]}
    }
  }
}
```

### 13.3.6 `find_similar_habitat_states`

Purpose: compare current habitat to historical Snapshot states.

```json
{
  "name": "find_similar_habitat_states",
  "description": "Find historical camera-site periods similar to current rainfall, greenness, water, and fire state.",
  "parameters": {
    "type": "object",
    "required": ["target_environment"],
    "properties": {
      "target_environment": {"type": "object"},
      "species_filter": {"type": "array", "items": {"type": "string"}},
      "top_k": {"type": "integer", "default": 20}
    }
  }
}
```

### 13.3.7 `retrieve_evidence_images`

Purpose: fetch example images for evidence cards.

```json
{
  "name": "retrieve_evidence_images",
  "description": "Retrieve image thumbnails and metadata for event evidence cards.",
  "parameters": {
    "type": "object",
    "required": ["capture_event_ids"],
    "properties": {
      "capture_event_ids": {"type": "array", "items": {"type": "string"}},
      "redact_humans": {"type": "boolean", "default": true}
    }
  }
}
```

### 13.3.8 `generate_report`

Purpose: compose final grounded report from tool outputs.

```json
{
  "name": "generate_report",
  "description": "Create a ranger, scientist, or public brief from evidence-bound summaries.",
  "parameters": {
    "type": "object",
    "required": ["audience", "date_start", "date_end"],
    "properties": {
      "audience": {"type": "string", "enum": ["ranger", "scientist", "public", "hackathon_judge"]},
      "date_start": {"type": "string"},
      "date_end": {"type": "string"},
      "species": {"type": "array", "items": {"type": "string"}},
      "include_uncertainty": {"type": "boolean", "default": true}
    }
  }
}
```

## 13.4 Grounding rules

Every agent response must satisfy:

1. **No tool, no factual dataset claim.** If a user asks about events, locations, trends, counts, species, or environmental conditions, the model must call tools.
2. **Evidence IDs required.** Tool results must include event IDs, site IDs, layer names, date windows, and row counts.
3. **Claim type required.** Each claim must be observed, measured, inferred, or hypothesized.
4. **Uncertainty required.** Low evidence or missing labels must be stated clearly.
5. **No current-animal claims from habitat data.** Current satellite layers can support habitat similarity or risk, not current animal presence.
6. **Schema validation required.** JSON outputs and tool arguments must validate before execution.
7. **Human privacy filter required.** Human-labeled images should not be displayed publicly unless explicitly safe and permitted.

## 13.5 Anti-hallucination implementation

```text
User query
  -> intent classifier
  -> tool-required gate
  -> tool call generation
  -> schema validator
  -> SQL/API tool execution
  -> evidence object
  -> answer generation with evidence object only
  -> claim checker
  -> UI evidence display
```

Claim checker rules:

- Detect unsupported numerals and percentages.
- Detect claims about current animal presence.
- Detect species not in taxonomy.
- Detect date ranges outside data availability.
- Detect missing source type.
- Reject/refine response if unsupported.

# 14. Product features

## 14.1 Living Serengeti map

Core map layers:

- camera sites;
- active/inactive effort windows;
- detections by species;
- predicted vs consensus vs gold layers;
- rainfall, EVI/NDVI, water, burned area;
- uncertainty heatmap;
- review queue layer.

Interactions:

- filter by species/date/site/confidence;
- click event to view image burst and model output;
- compare prediction to hidden label in demo;
- switch between observed, inferred, and habitat layers.

## 14.2 Live replay demo

A real stream of unseen Snapshot events.

UI sequence:

1. "New camera event received."
2. Image burst appears.
3. Gemma 4 predicts structured JSON.
4. Map updates at the true site.
5. Environmental context appears.
6. User clicks "Reveal label".
7. System compares prediction with consensus/gold label.
8. Benchmark counters update live.

This is the strongest demonstration that the product works with real data.

## 14.3 Event review queue

Review triggers:

- low model confidence;
- rare species;
- high visual ambiguity;
- conflicting model outputs;
- suspected multi-species event;
- human/privacy class;
- species outside expected habitat/time range;
- important conservation alert.

Review UI:

- image burst player;
- model output;
- evidence context;
- similar historical events;
- label editor;
- accept/correct/escalate;
- export reviewed labels.

## 14.4 Migration pulse tracker

Focus species:

- wildebeest;
- zebra;
- Thomson's gazelle;
- Grant's gazelle;
- buffalo.

Inputs:

- detections per active camera-day;
- CHIRPS rainfall;
- MODIS EVI/NDVI;
- site/time windows;
- camera effort.

Output:

- animated map;
- rainfall/greenness timeline;
- event examples;
- grounded explanation.

## 14.5 Predator-prey interaction graph

Nodes:

- predator species;
- prey species;
- human/vehicle class if available and privacy-safe.

Edges:

- co-detection at same site/time window;
- lagged detection patterns;
- shared habitat state;
- avoidance patterns.

Questions:

- "Do hyena detections increase after zebra/wildebeest pulses?"
- "Which sites show predator-prey overlap after rainfall?"
- "Where are lions detected near high herbivore activity?"

## 14.6 Behavior shift monitor

Uses behavior fields from consensus labels and model predictions:

- moving;
- eating;
- standing;
- resting;
- interacting;
- young present.

Example outputs:

- "Elephants are moving more during low-greenness windows."
- "Resting behavior peaks in hotter periods."
- "Young-present detections cluster in these cells after rainfall."

All claims must be effort-corrected and evidence-linked.

## 14.7 Rare species and anomaly radar

Flags:

- rare species detections;
- new site detections;
- unusual season/time of day;
- unexpected habitat context;
- anomalous behavior;
- low-confidence high-impact predictions.

Output:

- alert list;
- confidence;
- recommended review action;
- evidence images;
- explanation of why unusual.

## 14.8 Camera placement optimizer

Goal: recommend where new cameras should go.

Inputs:

- historical detections;
- current/seasonal habitat layers;
- existing camera coverage;
- uncertainty heatmap;
- rare species priority;
- water/road/habitat gradients.

Optimization objectives:

```text
maximize rare species detection probability
maximize under-sampled habitat coverage
maximize migration corridor coverage
minimize redundancy with existing cameras
maximize uncertainty reduction
respect practical deployment constraints
```

Outputs:

- ranked candidate sites;
- expected information gain;
- map overlay;
- rationale.

## 14.9 Grounded conservation reports

Report types:

- **Ranger brief:** operational, short, alert-focused.
- **Scientist brief:** methods, assumptions, uncertainty, metrics.
- **Public brief:** story-driven and accessible.
- **Judge brief:** shows what Gemma 4 did and why it matters.

Report sections:

```text
Summary
Observed detections
Habitat context
Trends and anomalies
Uncertainty
Recommended actions
Evidence links
```

## 14.10 Public API

Endpoints:

```text
POST /api/events/classify
GET  /api/events/{capture_event_id}
GET  /api/detections/search
GET  /api/sites
GET  /api/environment/extract
POST /api/chat
GET  /api/reports/{report_id}
POST /api/review/{task_id}/resolve
GET  /api/benchmarks/summary
```

# 15. Live demo deployment with Ollama

## 15.1 Target demo architecture

```text
Internet user
  -> Vercel/Next.js web app
  -> FastAPI backend
  -> Ollama Cloud or public Ollama-compatible GPU endpoint
  -> PostGIS + vector DB + object storage
  -> Earth data tools/cache
```

## 15.2 Ollama deployment options

### Option A: Ollama Cloud direct

Use `https://ollama.com/api` with `OLLAMA_API_KEY`, if the target model is available or custom model execution is supported for our artifact.

### Option B: public Ollama-compatible server

Run Ollama on GPU infrastructure:

- RunPod;
- Lambda Labs;
- Modal;
- Vast.ai;
- AWS/GCP/Azure GPU VM;
- university GPU server.

Expose through secure HTTPS reverse proxy:

```text
https://model.savanna-sentinel.org/api/chat
```

The front-end never calls the model directly; the backend handles keys, rate limits, tool execution, and output validation.

## 15.3 Exporting to Ollama

Possible model packaging paths:

1. Fine-tune adapter on HF.
2. Merge adapter into base model if needed.
3. Convert to GGUF if supported.
4. Create Ollama Modelfile.
5. `ollama create savanna-sentinel-gemma4 -f Modelfile`.
6. `ollama run savanna-sentinel-gemma4`.
7. Push/share if supported.

Example Modelfile:

```text
FROM ./savanna-sentinel-gemma4-e4b-q4_k_m.gguf
PARAMETER temperature 0.2
PARAMETER top_p 0.9
PARAMETER num_ctx 32768
SYSTEM """
You are Savanna Sentinel, a grounded Serengeti biodiversity monitoring model.
Use tools for factual data claims. Return JSON for event classification.
Never claim current animal presence without current camera or field observations.
"""
```

If adapter import is supported for the model architecture:

```text
FROM gemma4-e4b-base
ADAPTER ./savanna-sentinel-lora
PARAMETER temperature 0.2
SYSTEM "..."
```

## 15.4 Latency plan

| Operation | Expected strategy |
|---|---|
| Image classification | async call, thumbnail preprocessing, batch where possible |
| Environmental extraction | cached by site/date/layer |
| Chat tool calls | parallel where safe |
| Similarity search | precomputed embeddings |
| Reports | stream response after tool results |

## 15.5 Public demo guardrails

- Rate limit by IP/session.
- Hide raw model endpoint and API key.
- Disable arbitrary SQL.
- Restrict tools to safe allowlisted functions.
- Redact human images/classes.
- Log tool calls and model outputs for audit.
- Show uncertainty and data date range.

# 16. Data products for model training

## 16.1 Event SFT row

```json
{
  "sample_id": "event_ASG0010cz5_v1",
  "split": "train_core",
  "task": "event_interpretation",
  "images": ["s3://.../ASG0010cz5_1.jpg", "s3://.../ASG0010cz5_2.jpg"],
  "metadata_text": "Site B04. Local time 2011-06-23 08:14:21. 2 images.",
  "input_text": "Classify this Serengeti camera-trap capture event. Return valid JSON.",
  "target_text": "{...}"
}
```

## 16.2 Tool-calling SFT row

```json
{
  "sample_id": "toolqa_zebra_rainfall_2012_04",
  "split": "train_agent_tools",
  "messages": [
    {"role": "system", "content": "Use tools before answering dataset questions."},
    {"role": "user", "content": "Which sites had increased zebra activity after rainfall in April 2012?"},
    {"role": "assistant", "tool_calls": [
      {"name": "query_detections", "arguments": {"species": ["zebra"], "date_start": "2012-04-01", "date_end": "2012-04-30", "source": "consensus"}},
      {"name": "get_camera_effort", "arguments": {"date_start": "2012-04-01", "date_end": "2012-04-30"}},
      {"name": "extract_environment", "arguments": {"date_start": "2012-04-01", "date_end": "2012-04-30", "layers": ["CHIRPS", "MODIS_EVI"]}}
    ]}
  ]
}
```

## 16.3 Report SFT row

```json
{
  "sample_id": "report_weekly_2012w14",
  "split": "train_report",
  "input": {
    "tool_results": ["detection_summary", "camera_effort", "rainfall_summary", "uncertainty_summary"],
    "audience": "ranger"
  },
  "target": {
    "observed": ["Zebra detections increased at 12 active sites."],
    "measured": ["Rainfall was above baseline in the same period."],
    "inferred": ["Detection-per-active-camera-day rose relative to the prior 30 days."],
    "uncertainty": ["Two low-confidence gazelle events require review."]
  }
}
```

# 17. Model outputs and validation

## 17.1 JSON validation

Use Pydantic or JSON Schema.

```python
from pydantic import BaseModel, Field
from typing import List, Optional

class Behavior(BaseModel):
    standing: bool = False
    resting: bool = False
    moving: bool = False
    eating: bool = False
    interacting: bool = False

class Detection(BaseModel):
    species: str
    count_bin: str
    behaviors: Behavior
    young_present: bool
    confidence: float = Field(ge=0, le=1)
    visual_evidence: Optional[str] = None

class Review(BaseModel):
    review_needed: bool
    priority: str = "normal"
    reason: Optional[str] = None

class EventPrediction(BaseModel):
    capture_event_id: str
    blank: bool
    detections: List[Detection]
    review: Review
```

## 17.2 Validation failure repair

If output fails schema:

1. parse with tolerant JSON parser;
2. repair invalid fields if unambiguous;
3. re-prompt with schema and invalid field list;
4. if still invalid, route to review.

## 17.3 Confidence calibration

Model confidence must be calibrated on validation/gold data.

Inputs to calibration:

- model probability/logit confidence if available;
- self-reported confidence;
- agreement across test-time augmentations;
- raw-data uncertainty features for training only;
- visual difficulty features;
- rare species prior.

Outputs:

- calibrated confidence;
- review threshold;
- reliability plot;
- expected calibration error.

# 18. Grounding of model responses

## 18.1 Evidence card schema

```json
{
  "evidence_card_id": "evc_123",
  "claim_id": "claim_4",
  "claim_text": "Zebra detections increased in eastern sites during April 2012.",
  "claim_type": "inferred",
  "tools": [
    {"tool_call_id": "tc_1", "tool_name": "query_detections", "row_count": 248},
    {"tool_call_id": "tc_2", "tool_name": "get_camera_effort", "row_count": 75}
  ],
  "source_rows": {
    "capture_event_ids": ["ASG...", "ASG..."],
    "site_ids": ["B04", "C04"]
  },
  "environment_layers": ["CHIRPS_DAILY", "MODIS_MOD13Q1"],
  "confidence": "medium_high",
  "limitations": "Historical Snapshot data only; not current animal presence."
}
```

## 18.2 Answer-checking rubric

Before sending an answer to the UI:

```text
Does every numeric claim have a tool result? yes/no
Does every species/site claim have source rows? yes/no
Are current vs historical dates clear? yes/no
Is animal presence based on camera evidence? yes/no
Are environmental claims based on official layers? yes/no
Is uncertainty stated? yes/no
Are unsupported speculations removed or labeled as hypothesis? yes/no
```

## 18.3 Search tools to prevent hallucination

Savanna Sentinel needs four search layers:

1. **SQL search:** deterministic facts from labels, predictions, effort, environment.
2. **Vector search:** similar events/images/reports; used for examples, not truth.
3. **Geospatial search:** sites/cells within distance, water, roads, habitat.
4. **Source search:** whitelisted documentation and dataset cards for data availability and methods.

The model should never invent source facts. It can ask tools:

```text
search_dataset_docs(query="What fields are in consensus_data.csv?")
search_species_taxonomy(query="Grant gazelle vs Thomson gazelle")
search_environment_catalog(layer="CHIRPS")
```

Each source-search result must include source name, date/version, and URL/citation.

# 19. UI/UX spec

## 19.1 Home page

Sections:

- hero statement;
- live demo button;
- map preview;
- model benchmark badges;
- Global Resilience framing.

## 19.2 Live inference page

Components:

- image burst viewer;
- model prediction JSON summary;
- confidence gauge;
- hidden label reveal;
- map site marker;
- environmental context cards;
- benchmark update.

## 19.3 Map intelligence page

Components:

- map with sites and hex grid;
- layer controls;
- species/date filters;
- detections per active camera-day;
- uncertainty overlay;
- event thumbnails on click.

## 19.4 Copilot page

Examples:

```text
Where did wildebeest activity increase after rainfall?
Show low-confidence gazelle cases.
Which sites have rare carnivore detections?
Generate a ranger brief for March 2012.
Where should we add 20 new cameras?
```

UI must show:

- answer;
- tool calls;
- evidence cards;
- claim type labels;
- uncertainty.

## 19.5 Review queue page

Components:

- priority list;
- image viewer;
- proposed label;
- similar examples;
- correction form;
- audit history.

# 20. Backend services

## 20.1 FastAPI services

```text
sentinel_api/
  main.py
  routers/
    events.py
    inference.py
    chat.py
    environment.py
    review.py
    benchmark.py
  services/
    ollama_client.py
    tool_runner.py
    schema_validator.py
    evidence_builder.py
    claim_checker.py
    image_store.py
```

## 20.2 Workers

- image download worker;
- environmental extraction worker;
- embedding worker;
- batch inference worker;
- evaluation worker;
- report generation worker.

Use Celery/RQ/Arq or Modal jobs.

## 20.3 Databases

| Store | Recommended option | Purpose |
|---|---|---|
| PostGIS | Supabase, Neon + PostGIS, Crunchy, Cloud SQL | truth tables |
| Vector DB | Qdrant, pgvector, Weaviate | similar images/events/reports |
| Object storage | R2, S3, GCS | images, manifests, reports |
| Cache | Redis | tool results, API rate limiting |
| Metrics | Prometheus/Grafana or OpenTelemetry | latency and reliability |

# 21. Environmental extraction details

## 21.1 Feature windows

For each event timestamp:

```text
rainfall_1d: previous 24 hours
rainfall_7d: previous 7 days
rainfall_14d: previous 14 days
rainfall_30d: previous 30 days
rainfall_anomaly: compared to same site/month baseline
EVI/NDVI: nearest valid 16-day MODIS composite
EVI_anomaly: compared to same site/month historical baseline
fire_recent: burned within 5 km in previous 30/90 days
water_distance: distance to persistent or seasonal water
```

## 21.2 Google Earth Engine extraction pseudocode

```python
import ee

ee.Initialize()

site_fc = ee.FeatureCollection(site_geojson)
chirps = ee.ImageCollection("UCSB-CHG/CHIRPS/DAILY")
modis = ee.ImageCollection("MODIS/061/MOD13Q1")

# For each event/site/date, build a small reducer request.
def rainfall_window(point, start, end):
    img = chirps.filterDate(start, end).sum()
    return img.reduceRegion(
        reducer=ee.Reducer.mean(),
        geometry=point,
        scale=5500,
        maxPixels=1e8
    )
```

## 21.3 Caching

Environmental extraction can be expensive. Cache by:

```text
site_id + date + layer + window + version
```

This makes demo responses fast and reproducible.

# 22. Security, ethics, and privacy

## 22.1 Human images

The original dataset included a human class, including vehicles and hot-air balloons; LILA removed human images from its version for privacy reasons while retaining labels in metadata.[^lila-serengeti]

Rules:

- Do not show human images in public demo.
- Human/vehicle class can be summarized as privacy-safe counts if legally allowed.
- Public demo should blur or exclude any human image.

## 22.2 Conservation-sensitive data

Rare species locations can be sensitive. For public demo:

- do not expose exact coordinates for high-risk species if this could aid harm;
- aggregate rare species to coarse cells;
- add delay/fuzzing in public maps if using current data;
- for historical public Snapshot data, still avoid sensationalizing rhino/rare detections.

## 22.3 Model limitations

- The model can misclassify rare or visually ambiguous species.
- Satellite layers contextualize habitat but do not prove current animal presence.
- Camera-effort correction is necessary for ecological claims.
- No camera-inactive period should be interpreted as absence.
- Behavior labels are weak/proportional and should be calibrated.

# 23. Benchmarks and reporting artifacts

## 23.1 Public benchmark table

The repo should publish:

```text
benchmarks/
  gold_standard_species_metrics.csv
  gold_standard_count_metrics.csv
  blank_detection_metrics.csv
  rare_species_metrics.csv
  calibration_report.json
  grounding_eval.json
  review_queue_lift.csv
  latency_ollama.csv
```

## 23.2 Evaluation notebook

Notebook sections:

1. Load split manifests.
2. Verify no gold leakage.
3. Run model on gold events.
4. Validate JSON.
5. Compute metrics.
6. Compare against baseline.
7. Plot confusion matrix.
8. Plot reliability diagram.
9. Evaluate review queue lift.
10. Export tables for Kaggle writeup.

## 23.3 Baselines

Baseline models:

- always-wildebeest/zebra majority baseline;
- consensus-derived labels vs gold from paper;
- base Gemma 4 zero/few-shot;
- fine-tuned Gemma 4;
- optional MegaDetector + classifier if using LILA.

# 24. Implementation roadmap

## Phase 0: Data readiness

Deliverables:

- Dryad metadata downloaded;
- schema audit;
- image subset mirrored;
- split manifests;
- environmental extraction prototype.

## Phase 1: Baseline model and demo skeleton

Deliverables:

- base Gemma 4 inference on 100 events;
- JSON schema validator;
- map UI with camera sites;
- hidden-label replay prototype.

## Phase 2: Fine-tuning

Deliverables:

- SFT dataset JSONL;
- LoRA/QLoRA adapter;
- model card;
- benchmark notebook;
- evaluation report.

## Phase 3: Tool-calling OS

Deliverables:

- PostGIS warehouse;
- tool registry;
- evidence cards;
- claim checker;
- grounded copilot.

## Phase 4: Public demo

Deliverables:

- deployed frontend;
- deployed backend;
- Ollama-hosted inference;
- rate-limited API;
- public demo stream;
- benchmark dashboard.

## Phase 5: Submission

Deliverables:

- Kaggle writeup under 1,500 words;
- public GitHub repo;
- live demo URL;
- public YouTube video under 3 minutes;
- media gallery;
- model weights/adapter and benchmarks.

# 25. Hackathon video storyboard

## 25.1 Three-minute story

### 0:00-0:25 - Problem

Open with millions of camera-trap images and a researcher/ranger overwhelmed by image folders.

Message:

```text
The Serengeti is changing, but conservation teams cannot manually interpret millions of images fast enough.
```

### 0:25-0:55 - Data

Show Snapshot Serengeti map, camera grid, image bursts, labels, and search effort.

Message:

```text
Snapshot Serengeti gave the world a rare public archive: camera images, species labels, counts, behaviors, young, timestamps, and camera locations.
```

### 0:55-1:25 - Gemma 4 sees

Run live inference on a hidden event.

Show:

- image burst;
- JSON prediction;
- confidence;
- reveal label.

### 1:25-1:55 - The map thinks

Show rainfall, EVI, water, camera effort, detections.

Question:

```text
Where did zebra activity increase after rainfall?
```

Gemma calls tools and produces evidence.

### 1:55-2:25 - Trust layer

Show review queue, uncertainty, low-confidence gazelle example, rare species alert.

Message:

```text
Savanna Sentinel does not hide uncertainty. It routes hard cases to humans.
```

### 2:25-2:50 - Action

Show camera placement optimizer and weekly ranger report.

### 2:50-3:00 - Impact

Final line:

```text
Savanna Sentinel turns camera traps and Earth data into a living, grounded map of biodiversity resilience.
```

# 26. Kaggle writeup outline

The final Kaggle writeup must be under 1,500 words. Suggested outline:

1. Title/subtitle.
2. Problem and impact.
3. Data: Snapshot Serengeti + public Earth layers.
4. Architecture: Gemma 4 + Ollama + tools + PostGIS.
5. Fine-tuning: event interpreter + tool-calling agent.
6. Evaluation: gold standard, hard cases, grounding.
7. Demo: live replay + map + review queue.
8. Limitations and honesty.
9. Links: code, model, demo, video.

# 27. Engineering checklist

## 27.1 Data checklist

- [ ] Download Dryad metadata.
- [ ] Verify row counts.
- [ ] Mirror image subset.
- [ ] Validate image availability.
- [ ] Convert UTM to WGS84.
- [ ] Build camera site table.
- [ ] Build event table.
- [ ] Build blank examples.
- [ ] Build gold exclusion list.
- [ ] Build split manifests.
- [ ] Extract environmental features.

## 27.2 Model checklist

- [ ] Baseline Gemma 4 eval.
- [ ] SFT data JSONL.
- [ ] Fine-tune adapter.
- [ ] Validate JSON outputs.
- [ ] Calibrate confidence.
- [ ] Evaluate gold set.
- [ ] Export model/adapters.
- [ ] Package for Ollama.

## 27.3 App checklist

- [ ] Event classification endpoint.
- [ ] Tool registry.
- [ ] Grounding validator.
- [ ] Map UI.
- [ ] Live replay demo.
- [ ] Hidden label reveal.
- [ ] Review queue.
- [ ] Reports.
- [ ] Public deployment.

## 27.4 Submission checklist

- [ ] Public repo.
- [ ] Model weights/adapter.
- [ ] Benchmark tables.
- [ ] Live demo URL.
- [ ] YouTube video.
- [ ] Kaggle writeup.
- [ ] Media gallery cover image.

# 28. Key risks and mitigations

| Risk | Mitigation |
|---|---|
| Image host availability | Mirror images early; use LILA cloud mirrors if applicable |
| Class imbalance | Balanced sampler, macro-F1, rare review routing |
| Gold leakage | strict manifest and CI test |
| Ollama Cloud custom model limitation | fallback to public Ollama-compatible GPU host |
| Tool hallucination | tool-required gate, schema validation, claim checker |
| Current-presence overclaim | observed/measured/inferred/hypothesized separation |
| Human/privacy images | filter/redact; use LILA if public demo |
| Satellite mismatch | use historical-compatible layers for training, modern layers for current habitat only |
| Wide scope | build live replay + map + grounded copilot first |

# 29. Success criteria

## 29.1 Technical success

- Fine-tuned Gemma 4 model produces valid event JSON reliably.
- Gold-standard benchmark is published.
- Live demo runs real held-out image events.
- Tool-calling copilot answers with evidence cards.
- All claims are grounded or labeled uncertain.
- Public users can try the demo without login.

## 29.2 Impact success

- The demo makes the conservation data bottleneck obvious.
- The map shows how image events become resilience intelligence.
- The system is honest about historical vs current evidence.
- Judges can see real engineering, not a concept mockup.

# 30. Minimal viable product vs full product

## MVP for hackathon

- Fine-tuned Gemma 4 event interpreter.
- Live replay on real held-out Snapshot events.
- Map with camera sites and detections.
- CHIRPS + MODIS context for selected events.
- Tool-calling copilot with 5-8 tools.
- Evidence cards and hidden-label reveal.
- Public Ollama-powered demo.

## Full product

- Full image mirror.
- All environmental layers.
- Robust calibration.
- Rare species/anomaly radar.
- Camera placement optimizer.
- Human review workflow.
- Scientific reports.
- Current camera ingestion integration.
- Multi-reserve extension after Serengeti.

# 31. Source anchors

This section lists the factual anchors used throughout the specification. The same sources are also referenced as footnotes in the relevant sections.

## 31.1 Core Snapshot Serengeti sources

- Swanson, A. et al. "Snapshot Serengeti, high-frequency annotated camera trap images of 40 mammalian species in an African savanna." Scientific Data 2:150026 (2015). DOI: https://doi.org/10.1038/sdata.2015.26
- Dryad dataset record for Snapshot Serengeti: https://datadryad.org/dataset/doi%3A10.5061/dryad.5pt92
- LILA Snapshot Serengeti dataset page: https://lila.science/datasets/snapshot-serengeti
- LILA Snapshot Safari 2024 Expansion: https://lila.science/datasets/snapshot-safari-2024-expansion/

## 31.2 Gemma 4, training, and deployment sources

- Hugging Face Transformers Gemma 4 documentation: https://huggingface.co/docs/transformers/model_doc/gemma4
- Hugging Face TRL SFTTrainer documentation: https://huggingface.co/docs/trl/en/sft_trainer
- Hugging Face Unsloth integration: https://huggingface.co/docs/transformers/main/community_integrations/unsloth
- Unsloth documentation: https://docs.unsloth.ai/
- Ollama tool calling docs: https://docs.ollama.com/capabilities/tool-calling
- Ollama cloud docs: https://docs.ollama.com/cloud
- Ollama API docs: https://docs.ollama.com/api
- Ollama Modelfile docs: https://docs.ollama.com/modelfile
- Ollama push model endpoint docs: https://docs.ollama.com/api/push

## 31.3 Environmental and geospatial sources

- CHIRPS Daily in Google Earth Engine: https://developers.google.com/earth-engine/datasets/catalog/UCSB-CHG_CHIRPS_DAILY
- MODIS MOD13Q1 vegetation indices: https://developers.google.com/earth-engine/datasets/catalog/MODIS_061_MOD13Q1
- ERA5-Land overview: https://www.ecmwf.int/en/forecasts/dataset/ecmwf-reanalysis-v5-land
- JRC Global Surface Water: https://developers.google.com/earth-engine/datasets/catalog/JRC_GSW1_4_GlobalSurfaceWater
- USGS Landsat Collection 2 Surface Reflectance: https://www.usgs.gov/landsat-missions/landsat-collection-2-surface-reflectance
- Copernicus Sentinel Hub APIs: https://dataspace.copernicus.eu/analyse/apis/sentinel-hub
- NASA GIBS APIs: https://www.earthdata.nasa.gov/engage/open-data-services-software/earthdata-developer-portal/gibs-api
- ESA WorldCover: https://esa-worldcover.org/en

[^snapshot-paper]: Swanson, A. et al. "Snapshot Serengeti, high-frequency annotated camera trap images of 40 mammalian species in an African savanna." Scientific Data 2:150026 (2015). The uploaded PDF documents the 225-camera, 1,125 km2 grid, 99,241 camera-trap days, 1.2 million image sets, 10.8 million classifications, file schemas, image URL access, gold-standard validation, and uncertainty fields. DOI: https://doi.org/10.1038/sdata.2015.26

[^hackathon]: Gemma 4 Good Hackathon prompt provided in the uploaded text. It describes the Global Resilience track, requirements for public writeup/video/code/live demo, and emphasis on Gemma 4 post-training, domain adaptation, agentic retrieval, multimodal understanding, and function calling.

[^dryad]: Dryad dataset page for Snapshot Serengeti, DOI 10.5061/dryad.5pt92: https://datadryad.org/dataset/doi%3A10.5061/dryad.5pt92

[^lila-serengeti]: LILA Snapshot Serengeti dataset page, describing approximately 2.65M sequences, 7.1M images, seasons 1-11, labels, bounding boxes, licensing, cloud storage access, and human-image privacy note: https://lila.science/datasets/snapshot-serengeti

[^safari-expansion]: LILA Snapshot Safari 2024 Expansion page, describing 4,029,374 images from 15 projects and cloud storage access: https://lila.science/datasets/snapshot-safari-2024-expansion/

[^chirps]: Google Earth Engine CHIRPS Daily data catalog: https://developers.google.com/earth-engine/datasets/catalog/UCSB-CHG_CHIRPS_DAILY

[^modis]: Google Earth Engine MODIS MOD13Q1 vegetation indices data catalog: https://developers.google.com/earth-engine/datasets/catalog/MODIS_061_MOD13Q1

[^era5]: ECMWF ERA5-Land overview: https://www.ecmwf.int/en/forecasts/dataset/ecmwf-reanalysis-v5-land

[^jrc-water]: Google Earth Engine JRC Global Surface Water v1.4 data catalog: https://developers.google.com/earth-engine/datasets/catalog/JRC_GSW1_4_GlobalSurfaceWater

[^landsat]: USGS Landsat Collection 2 Surface Reflectance page: https://www.usgs.gov/landsat-missions/landsat-collection-2-surface-reflectance

[^sentinel-hub]: Copernicus Data Space Sentinel Hub API page: https://dataspace.copernicus.eu/analyse/apis/sentinel-hub

[^worldcover]: ESA WorldCover site and Google Earth Engine WorldCover v200 catalog: https://esa-worldcover.org/en and https://developers.google.com/earth-engine/datasets/catalog/ESA_WorldCover_v200

[^gibs]: NASA Earthdata Global Imagery Browse Services APIs: https://www.earthdata.nasa.gov/engage/open-data-services-software/earthdata-developer-portal/gibs-api

[^gemma4-hf]: Hugging Face Transformers Gemma 4 documentation: https://huggingface.co/docs/transformers/model_doc/gemma4

[^trl-sft]: Hugging Face TRL SFTTrainer documentation, including VLM fine-tuning guidance: https://huggingface.co/docs/trl/en/sft_trainer

[^unsloth-hf]: Hugging Face Transformers community integration page for Unsloth: https://huggingface.co/docs/transformers/main/community_integrations/unsloth

[^unsloth-docs]: Unsloth documentation and Gemma-family fine-tuning/running guides: https://docs.unsloth.ai/

[^ollama-tools]: Ollama tool calling documentation: https://docs.ollama.com/capabilities/tool-calling

[^ollama-cloud]: Ollama cloud documentation: https://docs.ollama.com/cloud

[^ollama-api]: Ollama API introduction, including local and cloud API base URLs: https://docs.ollama.com/api

[^ollama-modelfile]: Ollama Modelfile reference: https://docs.ollama.com/modelfile

[^ollama-push]: Ollama API push model endpoint: https://docs.ollama.com/api/push
