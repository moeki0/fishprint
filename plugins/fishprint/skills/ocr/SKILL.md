---
name: ocr
description: OCR text from images and create translation overlays. Use when asked to "OCR", "translate an image", or "read text from image".
user-invocable: true
allowed-tools:
  - Read
  - Write
  - Bash(fishprint-ocr *)
  - Bash(mkdir *)
  - Bash(ls *)
  - Bash(head *)
  - Write(/tmp/*)
---

# /fishprint:ocr — OCR translation overlay

Arguments: `$ARGUMENTS`

Extract text from images via tesseract OCR and overlay translations on a light gray background.

## Flow

### Step 1: OCR

```bash
fishprint-ocr "<image_path_or_url>"
```

→ Returns JSON with text lines and bounding boxes.

### Step 2: Create translation JSON

Based on OCR results:

```json
[
  { "text": "Original text", "translated": "Translated text", "bbox": { "x0": 10, "y0": 20, "x1": 200, "y1": 50 } }
]
```

### Step 3: Apply overlay

```bash
fishprint-ocr "<image_path_or_url>" /tmp/translations.json
```

→ Fills original text regions with light gray and draws translated text on top.

Take image path/URL from arguments. If none provided, ask the user.
Requires tesseract (`brew install tesseract`).
