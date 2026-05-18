---
license: apache-2.0
base_model:
- Alfaxad/wild-gemma-4-E4B-it
tags:
- gguf
- ollama
- gemma4
- gemma-4
- vision-language
- multimodal
- wildlife
- camera-trap
- biodiversity
- savanna-sentinel
- json-output
pipeline_tag: image-text-to-text
---

# Wild Gemma 4 E4B IT GGUF / Ollama

This repository contains the working Ollama-compatible GGUF export for `Alfaxad/wild-gemma-4-E4B-it`, the Savanna Sentinel fine-tune of Gemma 4 E4B IT.

The final model file is:

```text
wild-gemma-4-E4B-it.Q4_K_M.gguf
```

It is a single combined Gemma 4 GGUF containing the language model tensors plus the multimodal vision/projector tensors. The first split text-GGUF plus mmproj export path did not load correctly for this custom Gemma 4 model in Ollama during validation, so the final artifact was rebuilt as a combined GGUF using the official Gemma 4 metadata layout and then smoke-tested with image+text prompts.

## What This Model Does

Wild Gemma 4 E4B IT is specialized for Savanna Sentinel camera-trap workflows:

- Classify Serengeti camera-trap events as blank or non-blank
- Identify likely species from one to three frame bursts
- Return structured JSON for event interpretation
- Route uncertain events for review
- Support tool-agent/report-generation style JSON tasks

This GGUF is intended for local Ollama inference and deployment testing. For the full merged Transformers model, use `Alfaxad/wild-gemma-4-E4B-it`.

## File Details

| Field | Value |
|---|---|
| Architecture | Gemma 4 |
| Quantization | Q4_K_M |
| Context length | 131,072 |
| GGUF size | 6,325,644,864 bytes |
| Modalities evaluated | Image + text |
| Audio evaluated | No |
| Base model | `Alfaxad/wild-gemma-4-E4B-it` |

## Ollama Usage

The published Ollama model is intended to be used as:

```bash
ollama run alfaxad/wild-gemma4:e4b
```

For local creation from this repository:

```bash
hf download Alfaxad/wild-gemma-4-E4B-it-GGUF wild-gemma-4-E4B-it.Q4_K_M.gguf
cat > Modelfile <<'EOF'
FROM ./wild-gemma-4-E4B-it.Q4_K_M.gguf
RENDERER gemma4
PARSER gemma4
PARAMETER temperature 1
PARAMETER top_p 0.95
PARAMETER top_k 64
SYSTEM "You are Savanna Sentinel. Return only valid JSON."
EOF
ollama create wild-gemma4:e4b -f Modelfile
ollama run wild-gemma4:e4b
```

The model is configured to follow the Gemma 4/Ollama defaults used in evaluation:

```text
temperature = 1.0
top_p = 0.95
top_k = 64
```

For multimodal prompts, place images before text. This matches the Gemma 4 and Ollama guidance used during validation.

## Thinking Mode

Gemma 4 supports thinking mode. In Ollama, enable thinking through the runtime support or by starting the system prompt with:

```text
<|think|>
```

For non-thinking schema production, omit that token and request strict JSON. When thinking is enabled, strip thought-channel content and validate only the final JSON. Do not put prior thought content into multi-turn history.

## Evaluation Snapshot

These are diagnostic evals from the corrected Ollama/GGUF export:

| Mode | Rows | JSON valid | Species exact | Species overlap | Blank correct | Review correct |
|---|---:|---:|---:|---:|---:|---:|
| Non-thinking | 40 | 0.725 | 0.364 | 0.364 | 0.889 | 1.000 |
| Thinking | 24 | 0.792 | 0.500 | 0.500 | 1.000 | 1.000 |

The metrics are useful for regression checks and export validation, not as a final scientific benchmark. Full metrics and predictions are included under `metrics/`.

## Metrics Files

- `metrics/combined_gguf_officialmeta_status.json`
- `metrics/combined_gguf_status.json`
- `metrics/manual_lora_gguf_status.json`
- `metrics/evaluation_ollama_manual_combined_q4_officialmeta_redo.json`
- `metrics/predictions_ollama_manual_combined_q4_officialmeta_redo_direct.jsonl`
- `metrics/predictions_ollama_manual_combined_q4_officialmeta_redo_thinking.jsonl`

## Prompting Pattern

Use strict, schema-first prompts:

```text
You are Savanna Sentinel. Return only valid JSON.

Classify this Serengeti camera-trap capture event. Use the image burst first, then the metadata. Return JSON matching savanna_sentinel_event_v1.
```

Example target shape:

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

## Limitations

- The Q4_K_M export is smaller and faster than the merged HF model, but quantization can change behavior.
- JSON validity is not guaranteed; callers should parse and validate outputs.
- Tool/report tasks remain weaker than the core event/review tasks in the diagnostic evals.
- Audio support from Gemma 4 E4B was not evaluated in this Savanna Sentinel export.
- This model is specialized for Snapshot Serengeti-style camera-trap data and should be validated before use on other regions or camera systems.

## Related Artifacts

- Merged HF model: https://huggingface.co/Alfaxad/wild-gemma-4-E4B-it
- Training/eval dataset: https://huggingface.co/datasets/Alfaxad/wildlife-sentinel
- Base Gemma 4 E4B IT card: https://huggingface.co/google/gemma-4-E4B-it
- Ollama Gemma 4 E4B reference: https://ollama.com/library/gemma4:e4b
