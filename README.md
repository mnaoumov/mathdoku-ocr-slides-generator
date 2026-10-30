# Mathdoku OCR + Google Slides Generator

Generate interactive Google Slides presentations for [Mathdoku](https://www.mathdoku.com/) puzzles, with Apps Script for step-by-step solving.

## Prerequisites

- Python 3.10+
- [uv](https://docs.astral.sh/uv/) (package manager)
- [Tesseract OCR](https://github.com/tesseract-ocr/tesseract) (for screenshot OCR)

## Setup

```bash
uv sync
```

### Google Cloud Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project (or select an existing one)
3. Enable APIs: **Google Slides API**, **Google Drive API**, **Apps Script API**
4. Go to **APIs & Services > OAuth consent screen**, configure it (External, add your email as test user)
5. Go to **APIs & Services > Credentials**, create an **OAuth 2.0 Client ID** (Desktop app)
6. Download the JSON and save it as `credentials.json` in this directory

On first run, the script opens a browser to authorize. The token is cached in `token.json`.

## Usage

### 1. OCR a puzzle screenshot

```bash
uv run ocr_mathdoku.py screenshot.png
```

Outputs `screenshot.yaml` with puzzle structure (grid size, cages, whether operators are shown).

### 2. Generate a Google Slides presentation

```bash
uv run make_mathdoku_slides.py puzzle.yaml
```

Creates a Google Slides presentation named after the YAML file, binds the Apps Script solver, embeds the puzzle data, and prints the URL.

### 3. Solve in Google Slides

Open the presentation URL. Click **Mathdoku > Init** once; it will request the permissions it needs, build the puzzle grid, then remove itself from the menu. After that, use the **Mathdoku** menu:

#### Enter

Opens a dialog with two fields:
- **Cells**: Space-separated cell references (e.g., `A1 B2 C3`), or `@A1` to select all cells in a cage
- **Operations**: What to do with those cells:
  - `=N` - Set the cell's final value (single cell only)
  - `digits` - Set candidates (e.g., `123` sets 1, 2, 3)
  - `-digits` - Mark candidates for removal (e.g., `-45` crosses out 4 and 5)

All changes appear in **green** to indicate they are pending.

#### MakeNextSlide

Duplicates the current slide and finalizes all green changes:
- Green values become the normal gray color
- Green candidates become the normal dark red color
- Green strikethrough candidates are removed

This creates a step-by-step solving history where each slide is one logical step.

## YAML Spec Format

```yaml
size: 5
difficulty: 3
hasOperators: true
cages:
- cells: [A1, B1, B2]
  value: 7
  op: +
- cells: [C1, D1]
  value: 2
  op: /
```

- `size`: Grid dimension (4-9)
- `difficulty`: Difficulty rating (set by user after OCR)
- `hasOperators`: Whether operation symbols are shown on cages
- `cages`: List of cages, each with cell references, target value, and operation (`+`, `-`, `x`, `/`)

Cell references use column letter + row number (e.g., `A1` = column A, row 1).

## Project Structure

```
make_mathdoku_slides.py        # YAML -> Google Slides generator (thin wrapper)
ocr_mathdoku.py                # Screenshot -> YAML OCR
apps-script/                   # Bound Apps Script files
  Code.gs                      # Menu, helpers, importPuzzle (grid generation)
  Enter.gs                     # Enter command
  MakeNextSlide.gs             # MakeNextSlide command
  EnterDialog.html             # Enter dialog UI
  appsscript.json              # Apps Script manifest
tests/fixtures/                # Test YAML specs and screenshots
```

## Filing an issue (for AI agents and humans)

Open issues through the [issue forms](https://github.com/mnaoumov/mathdoku-ocr-slides-generator/issues/new/choose), not as blank issues.

Filing from the CLI or the API (`gh issue create --body`, or an AI agent filing for you) skips the form, and `gh issue create --template` cannot load an issue form. In that case, open the matching form in [`.github/ISSUE_TEMPLATE/`](https://github.com/mnaoumov/mathdoku-ocr-slides-generator/tree/HEAD/.github/ISSUE_TEMPLATE), copy every field as a `### <label>` heading in the form's order, and fill in each one. Always state the version you used and your operating system.
