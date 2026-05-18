---
license: apache-2.0
library_name: transformers
base_model:
- unsloth/gemma-4-E4B-it
- google/gemma-4-E4B-it
datasets:
- Alfaxad/wildlife-sentinel
tags:
- gemma4
- gemma-4
- vision-language
- multimodal
- wildlife
- camera-trap
- biodiversity
- serengeti
- savanna-sentinel
- lora
- json-output
pipeline_tag: image-text-to-text
---

# Wild Gemma 4 E4B IT

Wild Gemma 4 E4B IT is the Savanna Sentinel fine-tune of Gemma 4 E4B IT for structured wildlife monitoring from Serengeti camera-trap events. It is trained to read one to three camera-trap frames plus event metadata and return machine-readable JSON for species/event interpretation, review routing, and downstream reporting workflows.

This repository contains the corrected merged Hugging Face model. The LoRA adapter was trained with Unsloth, then manually merged into the Gemma 4 E4B IT base weights after the automated merged artifact failed smoke tests. The corrected merge was re-evaluated before publication.

## Model Lineage

- Base family: Gemma 4
- Base instruction model: `unsloth/gemma-4-E4B-it`, derived from `google/gemma-4-E4B-it`
- Fine-tune method: LoRA supervised fine-tuning
- Merge method: manual LoRA merge into language model linear modules, `W += (B @ A) * alpha / r`
- Merged modules: 406
- Missing LoRA merge modules: 0
- Output format: Hugging Face Transformers safetensors
- Companion Ollama/GGUF export: `Alfaxad/wild-gemma-4-E4B-it-GGUF`

Gemma 4 E4B is a dense multimodal model with text, image, and audio support in the base model family. This Savanna Sentinel release was evaluated for image+text camera-trap inference; audio behavior was not evaluated for this project.

## Intended Use

This model is intended for open wildlife-monitoring demos, research prototypes, and production experiments around camera-trap event triage.

Primary input:

- One to three camera-trap images from a capture burst
- Event metadata such as camera site, timestamp, environmental features, split/task context, and prompt-specific instructions

Primary output:

- Strict JSON matching the Savanna Sentinel task schemas

Primary tasks:

- Phase 1 event interpretation: blank/non-blank, species, count bin, behavior, young-present signal, confidence, and review fields
- Phase 2 review routing: structured review decision, reasons, label uncertainty, disagreement signals, and triage notes
- Phase 3 report/tool tasks: structured tool-call style outputs and report JSON for biodiversity monitoring workflows

## Dataset

Fine-tuned on `Alfaxad/wildlife-sentinel`.

The dataset was generated for Savanna Sentinel from:

- Snapshot Serengeti camera-trap event images and labels
- Snapshot Serengeti consensus, expert gold, raw vote, search-effort, and image metadata artifacts
- Public environmental features joined at event/site/month level, including MODIS vegetation features and related public environmental layers
- Generated Savanna Sentinel task schemas for event interpretation, review routing, tool-agent planning, and reporting

Training package used by the run:

| Split group | Rows |
|---|---:|
| Train rows | 38,612 |
| Validation rows | 672 |
| Total audited rows | 39,284 |

Training rows by task:

| Task | Rows |
|---|---:|
| Phase 1 event interpretation | 17,496 |
| Phase 2 review routing | 17,496 |
| Phase 3 tool-agent planning | 2,220 |
| Phase 3 report generation | 1,400 |

Validation rows by task:

| Task | Rows |
|---|---:|
| Phase 1 event interpretation | 256 |
| Phase 2 review routing | 256 |
| Phase 3 tool-agent planning | 80 |
| Phase 3 report generation | 80 |

The training examples use chat-style multimodal messages. Image content is placed before text content, matching Gemma 4 and Ollama multimodal best practice.

## Training Configuration Snapshot

| Metric | Value |
|---|---:|
| Epochs | 1.0 |
| Train loss | 0.007153 |
| Train runtime | 35,587.66 seconds |
| Samples/sec | 1.085 |
| Steps/sec | 0.136 |
| Peak CUDA reserved | 13.498 GB |
| Chosen max length | 8192 |
| Max audited text tokens, before visual tokens | 1754 |
| P99 audited text tokens, before visual tokens | 1653 |
| Max images per example | 3 |

`max_length=8192` was selected to leave room for up to three image frames after the chat-template text tokens.

## Evaluation

The metrics below are diagnostic evaluations after the merge/export fix. They are useful for regression checking and comparison between base, merged, and Ollama-exported variants, but they should not be treated as a final benchmark.

### Base vs Fine-Tuned

| Model | Mode | Rows | JSON valid | Species exact | Species overlap | Blank correct | Review correct |
|---|---|---:|---:|---:|---:|---:|---:|
| HF base Gemma 4 E4B IT | non-thinking | 40 | 0.800 | 0.222 | 0.222 | 0.000 | n/a |
| Wild Gemma HF | non-thinking | 40 | 0.775 | 0.273 | 0.273 | 0.818 | 1.000 |
| Wild Gemma HF | thinking | 24 | 0.917 | 0.667 | 0.667 | 0.800 | 1.000 |
| Official Ollama Gemma 4 E4B | non-thinking | 24 | 0.917 | 0.333 | 0.333 | 0.000 | n/a |
| Wild Gemma Ollama/GGUF | non-thinking | 40 | 0.725 | 0.364 | 0.364 | 0.889 | 1.000 |
| Wild Gemma Ollama/GGUF | thinking | 24 | 0.792 | 0.500 | 0.500 | 1.000 | 1.000 |

The fine-tune substantially improves blank-event handling and review-routing behavior relative to the base diagnostic runs. Thinking mode improved the HF merged model on the small diagnostic species subset.

### Metrics Files

The full run artifacts are included under `metrics/`:

- `train_metrics.json`
- `dataset_runtime_stats.json`
- `dataset_token_length_audit.json`
- `merge_manual_lora_status.json`
- `merge_manual_lora_smoke.json`
- `evaluation_base.json`
- `evaluation_finetuned_adapter_redo_diagnostic.json`
- `evaluation_ollama_manual_combined_q4_officialmeta_redo.json`
- prediction JSONL files for base, fine-tuned, and Ollama diagnostic runs

## Usage

Use the Gemma 4 chat template from the tokenizer/processor. For multimodal prompts, place image content before text content. Ask for strict JSON only, and validate the response against the application schema before using it in production.

Example prompt intent:

```text
Classify this Serengeti camera-trap capture event. Use the images first, then the metadata. Return only valid JSON matching savanna_sentinel_event_v1.
```

Recommended generation defaults for parity with the evaluation setup:

```text
temperature = 1.0
top_p = 0.95
top_k = 64
```

For deterministic regression testing, use fixed seeds and task-specific max generation limits.

## Thinking Mode

Gemma 4 supports configurable thinking. For this model:

- Non-thinking mode is best when you need short, schema-only JSON outputs.
- Thinking mode can improve difficult visual/species reasoning, but the final answer still needs JSON extraction and validation.
- When thinking is enabled, do not feed previous hidden/thought content back into later turns. Multi-turn history should include only final assistant responses.

In runtimes that expose Gemma 4 thinking through the chat template, enable thinking with the runtime flag or by placing `<|think|>` at the start of the system prompt. For schema production, strip any thought channel content and keep only the final JSON.

## Output Schemas

The main event interpretation target follows this shape:

```json
{
  "schema_version": "savanna_sentinel_event_v1",
  "capture_event_id": "ASG...",
  "blank": false,
  "detections": [
    {
      "species": "zebra",
      "count_bin": "3",
      "behaviors": {
        "standing": false,
        "resting": false,
        "moving": true,
        "eating": false,
        "interacting": false
      },
      "young_present": false,
      "confidence": "high",
      "evidence": {
        "visual_basis": "Striped equids visible across the image burst.",
        "frames_used": [1, 2, 3]
      }
    }
  ],
  "review": {
    "review_needed": false,
    "reasons": []
  }
}
```

Production callers should treat model output as untrusted text until JSON parsing and schema validation succeed.

## Limitations

- Diagnostic evals are small and task-specific; run a broader benchmark before making scientific claims.
- Species predictions are not a replacement for expert review in high-stakes ecological analysis.
- The model can produce malformed JSON, especially on tool/report tasks and some Ollama quantized runs.
- The model was fine-tuned for Savanna Sentinel camera-trap workflows and may not generalize to unrelated wildlife imagery, camera systems, geographies, or taxonomies.
- Audio support from the base family was not evaluated for this release.
- Environmental fields are useful context, but the model should not be used as a causal ecological model.

## Citation And Attribution

Please cite the upstream model and data sources when using this model:

- Gemma 4 E4B IT by Google DeepMind: `google/gemma-4-E4B-it`
- Unsloth Gemma 4 E4B IT training base: `unsloth/gemma-4-E4B-it`
- Savanna Sentinel dataset package: `Alfaxad/wildlife-sentinel`
- Snapshot Serengeti source dataset and associated metadata used in the dataset package

## Related Artifacts

- Dataset: https://huggingface.co/datasets/Alfaxad/wildlife-sentinel
- GGUF/Ollama export: https://huggingface.co/Alfaxad/wild-gemma-4-E4B-it-GGUF
- Base model card: https://huggingface.co/google/gemma-4-E4B-it
- Ollama Gemma 4 E4B reference: https://ollama.com/library/gemma4:e4b
