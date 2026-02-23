# Mathdoku OCR + Google Slides Generator

## Project Goal

Generate Google Slides presentations for Mathdoku puzzles that can be solved interactively using bound Apps Script. The workflow is: OCR a puzzle screenshot -> YAML spec -> Google Slides presentation -> solve step-by-step in the browser.

## Architecture

### Pipeline

1. **OCR** (`ocr/ocr_mathdoku.py`): Screenshot -> YAML puzzle spec
2. **Slides Generation** (`scripts/makeMathdokuSlides.ts`): YAML -> Google Slides presentation with bound Apps Script
3. **Solving** (`apps-script/`): Interactive solving via custom "Mathdoku" menu in Google Slides

### How It Works

`scripts/makeMathdokuSlides.ts` is a thin wrapper that:
1. Uploads `assets/template-960x540.pptx` via Drive API (creates a Google Slides presentation with the correct 960×540 pt page size)
2. Binds the Apps Script project (pushes all `.js`/`.html` files from `apps-script/`)
3. Embeds puzzle JSON in the first slide for Init menu to read

### Key Files

- `scripts/makeMathdokuSlides.ts` - Slides generator: upload PPTX template, bind script, embed puzzle JSON
- `assets/template-960x540.pptx` - Blank PPTX with 960×540 pt page size (workaround for API bug)
- `src/Puzzle.ts` - Business logic: Puzzle class, PuzzleRenderer/Strategy interfaces, `initPuzzleSlides()`, types (zero Google Slides dependencies)
- `src/View.ts` - Google Slides layer: SlidesRenderer class, layout profiles, grid rendering, importPuzzle, global entry points
- `src/strategies/` - Strategy implementations: cage operation strategies (TooSmallForSum, TooBigForSum, DoesNotDivideProduct, TooSmallForProduct, TooBigForProduct), solving strategies (SingleCandidate, HiddenSingle, NakedSet, LastCellInCage, DeterminedByCage, NoCageCombination), init strategies (FillAllCandidates, SingleCellCage, UniqueCageMultiset)
- `src/cellChanges/` - CellChange subclasses (CandidatesChange, CandidatesStrikethrough, CellClearance, ValueChange)
- `dist/EnterDialog.html` - Modal dialog UI for Enter command
- `dist/ProgressDialog.html` - Modal progress dialog for Init and strategy application (chunked execution with cancel/revert)
- `ocr/ocr_mathdoku.py` - OCR: uses OpenCV + Tesseract to extract puzzle from screenshot
- `tests/fixtures/` - YAML specs and reference images for various puzzles

### Shape Naming Convention (Google Slides)

Shape titles (set via `shape.setTitle()`):
- `VALUE_A1` - Cell's final value (centered, bold, gray)
- `CANDIDATES_A1` - Cell's candidate digits (Consolas, 2-line fixed-position layout)
- `CAGE_0_A1` - Cage label with operation (e.g., "12+")
- `SOLVE_NOTES_COL1/COL2` - Editable note columns

Puzzle state stored in DocumentProperties as JSON.

### Solving Workflow (MVC)

The Apps Script code follows an MVC pattern:
- **Puzzle** (model+logic in `Puzzle.ts`): maintains cell values/candidates, parses Enter commands, runs strategies
- **SlidesRenderer** (view in `View.ts`): implements `PuzzleRenderer` interface, handles all Google Slides rendering
- **Strategies** (one file each): implement `Strategy` interface, called by Puzzle's strategy loop. Each strategy returns `StrategyResult` with `changeGroups: ChangeGroup[]` (each group pairs changes with a reason) and a `note` string

Flow:
1. **Enter**: Opens modal dialog. User input parsed by `Puzzle.buildEnterChanges()`. Changes rendered in green via `renderPendingChanges` (duplicates slide first, then applies green).
   - `=N` sets value, `digits` adds candidates, `-digits` strikethroughs candidates, `x` clears cell
   - Cell selection syntax (brackets optional for single cell/cage, required for groups):
     - `D3:op` or `(D3):op` — single cell
     - `@D3:op` or `(@D3):op` — whole cage containing D3
     - `(A1 B2):op` — explicit cell list
     - `(Row 3):op` — entire row (case-insensitive keyword)
     - `(Column C):op` — entire column (case-insensitive keyword)
     - `(A3..D4):op` — rectangular range (endpoints in any order)
     - `(@A3-B3):op` — cage of A3 minus B3
     - `(@A3-(B3 A4)):op` — cage of A3 minus multiple cells
   - `// comment` at end of input is stripped from execution but included in slide notes
   - Comment-only input (no commands) throws an error
2. **Commit**: Calls `renderCommittedChanges` which duplicates slide and finalizes green changes (green→normal, strikethrough→removed).
3. **Apply Automated Strategies** (`tryApplyAutomatedStrategies`): Runs strategy loop (single candidate → hidden single → naked set k=2,3,...) until no more progress. Returns `boolean` (true if any strategy applied).

### Slide Notes

Every action records its description in slide speaker notes for an audit trail:
- **Init**: batch 1 = "Filling all possible cell candidates", batch 2 = "Filling single cell values and unique cage multisets"
- **Enter**: the full input string (including `//` comments) is recorded
- **Automated strategies**: "Applying automated strategies" on each step
- Each action produces 2 slides (pending + committed), both get the note
- **Invariant**: at any point in time, only the very last slide has no note text. Notes are set on the SOURCE slide during `makeNextSlide` (the current slide before duplication); the new (duplicated) slide's notes are cleared. When no more strategies fire, `applyOneStep` clears notes on the last slide.

Note text is set via `PuzzleRenderer.setNoteText()` from business logic (`Puzzle.enter()`, `Puzzle.tryApplyAutomatedStrategies()`, `initPuzzleSlides()`), not from View callers.

### Progress Dialog (Chunked Execution)

Init and Apply Automated Strategies use a modal progress dialog (`dist/ProgressDialog.html`) for real-time feedback and cancellation support. Since SlidesApp is single-threaded, progress is achieved via client-driven chunked execution: the dialog calls the server once per strategy step via `google.script.run`, updates the UI between calls.

**Server functions** (exported from `View.ts`):
- `initGridSetup(puzzleJsonStr)` — creates grid layout, saves mathdokuState (everything `importPuzzle` does except strategy application)
- `applyOneStep()` — rebuilds puzzle from cached cell state (falls back to slide if cache miss), tries one strategy, returns `StepResult { applied, message? }`. Tracks initial strategy index in cache so each initial strategy is tried exactly once; after exhausting them, switches to automated strategies. When no strategy fires, clears notes on the last slide.
- `getRevertState()` — returns `{ slideCount, lastSlideNotes }` for revert baseline
- `revertOperation(targetSlideCount, savedNotes)` — deletes slides after target count, restores notes
- `finishInit()` — updates menu and selects last slide after init completes
- `submitEnterCommand(input)` — applies enter + commit, then opens ProgressDialog for strategies

**`tryApplyOneStrategyStep(strategies)`** on Puzzle class: iterates provided strategies, applies first match, returns `StepResult`. Used by `applyOneStep()` for single-step execution.

**Initial vs automated strategies:** `applyOneStep()` handles both phases internally. It uses `CacheService` to track which initial strategy to try next (set by `initGridSetup`). Each initial strategy is tried exactly once in order; those that don't fire are skipped. Once all initial strategies are exhausted, automated strategies take over. The dialog just calls `applyOneStep()` in a loop — no mode parameter needed.

**Cell state caching:** `applyOneStep()` uses `CacheService` to cache cell values and candidates between calls (`CELL_STATE_CACHE_KEY`). After each successful strategy step, the updated cell state is saved to cache via `saveCellState()`. On cache miss, falls back to `buildPuzzleFromSlide()` (slower, reads shapes from the slide). `initGridSetup()` seeds the cache with empty state; `submitEnterCommand()` saves state after enter+commit; `revertOperation()` clears the cache.

**Flows:**
- **Init**: validates puzzle data → stores JSON in CacheService → opens ProgressDialog → dialog calls `initGridSetup()` → loops `applyOneStep()` → calls `finishInit()`
- **Enter**: EnterDialog calls `submitEnterCommand(cmd)` → enter + commit → opens ProgressDialog → loops `applyOneStep()`
- **Cancel**: dialog calls `revertOperation()` to delete added slides and restore notes

### Last Slide Guard

All commands (`enter()`, `tryApplyAutomatedStrategies()`) check `PuzzleRenderer.ensureLastSlide()` before proceeding. If the user is not on the last slide, an alert is shown and the command is aborted. This prevents accidental modifications to intermediate slides. The `addChanges()` dialog opener also checks via the View-layer `ensureLastSlideSelected()`.

Note: `selectAsCurrentPage()` is the only Google Slides API for navigating to a slide. It selects the slide but does not reliably scroll the thumbnail panel — this is a known editor limitation.

## TypeScript

### Type Checking & Linting

- `npm run check` (from project root) runs `cspell && eslint && dprint check && tsc`
- **eslint.config.mts** (root): based on obsidian-dev-utils strict config. Includes `typescript-eslint` strictTypeChecked + stylisticTypeChecked, `@stylistic/eslint-plugin`, `eslint-plugin-perfectionist` (alphabetical sorting), `@eslint-community/eslint-plugin-eslint-comments`

### Coding Style

- **camelCase** for all identifiers (variables, functions, interface fields). **UPPER_CASE** for constants only.
- Single quotes, no trailing commas, 1tbs brace style, semicolons required
- `.editorconfig`: 2-space indent, LF line endings, UTF-8

## Conventions

### IMPORTANT: Traceability Rule

**No candidate eliminations or puzzle changes are made without a clear, human-readable, mentally traceable explanation.** Every elimination recorded in slide notes must have a reason a human can verify by inspection (e.g., "5 doesn't divide 72", "1 too small", "6 too big"). If a strategy cannot provide such an explanation for a particular elimination, that elimination must not be made. If brute-force enumeration is used, it must have a reasonably small number of options that a human can validate without writing anything down.

This is enforced structurally: `StrategyResult.changeGroups` is an array of `ChangeGroup`, where each group has `changes: CellChange[]` and `reason: string`. Every change must belong to a group with an explanation. Consumers flatten groups via `changeGroups.flatMap(g => g.changes)`.

### Operator enum

Cage operators use the `Operator` string enum (in `Puzzle.ts`): `Plus = '+'`, `Minus = '-'`, `Times = 'x'`, `Divide = '/'`, `Unknown = '?'`. The OCR normalizes all Unicode variants (×, ÷, etc.) to these four known operators before writing YAML. `Operator.Unknown` is an internal sentinel for cages without a specified operator (puzzles with `hasOperators: false`); it never appears in YAML. The `'?'` value may appear in serialized `PuzzleState` JSON and is accepted on deserialization. `CageRaw.operator` and `Cage.operator` are always `Operator` (never `undefined`).

- Generate slides: `npm run makeMathdokuSlides tests/fixtures/Blog15.yaml`
- Run OCR: `npm run ocrMathdoku screenshot.png`
- YAML fixtures go in `tests/fixtures/`
- Grid sizes 4-9 supported, each with a hardcoded layout profile in `LAYOUT_PROFILES` (in View.ts)
- Color constants defined in `View.ts`
- Font: "Segoe UI" for title, labels, values, notes; "Consolas" for candidates (per layout spec)

## Testing

- `npm test` runs vitest unit tests for Puzzle logic, strategies, parsers, combinatorics, cage constraints
- `uv run pytest` runs OCR tests. Don't run them unless OCR code changed.
- For Google Slides rendering changes, test manually: generate a presentation and verify in the browser.
- `TrackingRenderer` (in `__tests__/puzzleTestHelper.ts`) is the test double for `PuzzleRenderer` — tracks `notesBySlide`, `slideCount`, and has a configurable `isLastSlide` flag for guard testing.
- `createTestPuzzle()` accepts an optional `renderer` parameter to inject a `TrackingRenderer` the test holds a reference to (avoids `as TrackingRenderer` casts).

## Documentation

After every confirmed change, keep this file (`CLAUDE.md`) in sync with the current design. Update relevant sections (architecture, solving workflow, testing patterns, etc.) so future sessions have accurate context.

## Dependencies

- Node: googleapis, js-yaml (runtime); typescript, eslint, cspell (dev) — see `package.json`
- Python: opencv-python, numpy, pytesseract, pyyaml — see `pyproject.toml`
- System: Tesseract OCR, gcloud CLI
- Google Cloud: OAuth Desktop credentials (`credentials.json`), APIs enabled: Slides, Drive, Apps Script

---

## Slide layout spec (pixel-perfect reference)

The following is the canonical layout specification. `apps-script/View.ts` must implement it exactly so that Google Slides output matches the reference (former PowerPoint generator) one-to-one. All layout values come from the profiles below; convert inches to points with **1 in = 72 pt** and **round every position and size to integer pt** before passing to the Slides API.

### Visual reference

**The canonical visual reference for pixel-perfect layout is `docs/screenshot-blog19-current.png`** (the correct/reference rendering from the PowerPoint generator: clean grid, thick black cage boundaries, thin grey lines between cells within the same cage, small black join dots at vertices, cage numbers in consistent positions, row labels 1–5 and column labels A–E). Compare all Google Slides output against it. Any deviation (missing/extra grey lines, missing row 5 label, wrong cage number placement, join dots missing or wrong) is a bug.

### Slide dimensions

- **Reference size:** 13.333 in × 7.5 in = **960 pt × 540 pt** (16:9).
- Create the slide at this size so no scaling is applied for the default case.

### Colors

| Use            | Hex       | RGB reference   |
|----------------|-----------|------------------|
| Axis labels    | `#C800C8` | (200, 0, 200)   |
| Cage labels    | `#3232C8` | (50, 50, 200)    |
| Value text     | `#3C414B` | (60, 65, 75)     |
| Candidates     | `#8B0000` | (139, 0, 0)      |
| Thin grid      | `#AAAAAA` | (170, 170, 170)  |
| Black (lines)   | `#000000` | (0, 0, 0)        |
| Footer         | `#6E7887` | (110, 120, 135)  |
| Solve notes border | `#C8C8C8` | (200, 200, 200) |

### Layout profiles (sizes 4–9)

All linear dimensions in the table are **in inches** unless marked as pt. Fractions are unitless (fraction of cell size).

| Key | 4 | 5 | 6 | 7 | 8 | 9 |
|-----|------|------|------|------|------|------|
| title_h_in | 0.85 | 0.70 | 0.65 | 0.55 | 0.55 | 0.55 |
| title_sz | 30 | 26 | 24 | 22 | 22 | 22 |
| meta_sz | 20 | 18 | 16 | 14 | 14 | 14 |
| grid_left_in | 0.65 | 0.65 | 0.65 | 0.65 | 0.65 | 0.65 |
| grid_top_in | 1.35 | 1.25 | 1.15 | 1.10 | 1.10 | 1.10 |
| grid_size_in | 4.75 | 5.20 | 5.70 | 6.05 | 6.20 | 6.30 |
| thin_pt | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 |
| thick_pt | 5.0 | 5.0 | 6.5 | 6.5 | 6.5 | 6.5 |
| axis_font | 24 | 26 | 22 | 28 | 28 | 28 |
| axis_label_h | 0.34 | 0.37 | 0.32 | 0.40 | 0.40 | 0.40 |
| axis_label_w | 0.30 | 0.32 | 0.28 | 0.35 | 0.35 | 0.35 |
| axis_top_offset | 0.42 | 0.45 | 0.41 | 0.49 | 0.49 | 0.49 |
| axis_side_offset | 0.36 | 0.38 | 0.34 | 0.42 | 0.42 | 0.42 |
| value.y_frac | 0.30 | 0.28 | 0.25 | 0.23 | 0.22 | 0.20 |
| value.h_frac | 0.70 | 0.72 | 0.75 | 0.77 | 0.78 | 0.80 |
| value.font | 52 | 44 | 38 | 32 | 30 | 28 |
| candidates.x_frac | 0.15 | 0.05 | 0.07 | 0.08 | 0.08 | 0.09 |
| candidates.y_frac | 0.38 | 0.36 | 0.33 | 0.31 | 0.29 | 0.27 |
| candidates.w_frac | 0.80 | 0.88 | 0.86 | 0.84 | 0.84 | 0.88 |
| candidates.h_frac | 0.60 | 0.62 | 0.65 | 0.67 | 0.69 | 0.71 |
| candidates.font | 22 | 20 | 19 | 18 | 17 | 14 |
| candidates.digit_margin (pt) | 12 | 7 | 5 | 1 | 1 | 0 |
| cage.inset_x_frac | 0.07 | 0.07 | 0.07 | 0.07 | 0.07 | 0.07 |
| cage.inset_y_frac | 0.05 | 0.05 | 0.05 | 0.05 | 0.05 | 0.05 |
| cage.box_w_frac | 0.65 | 0.65 | 0.65 | 0.65 | 0.65 | 0.70 |
| cage.box_h_frac | 0.35 | 0.33 | 0.30 | 0.28 | 0.26 | 0.24 |
| cage.font | 28 | 24 | 22 | 20 | 18 | 16 |
| solve.left_in | 6.20 | 6.55 | 6.85 | 7.05 | 7.15 | 7.25 |
| solve.col_w_in | 3.25 | 3.10 | 2.95 | 2.85 | 2.80 | 2.75 |
| solve.col_gap_in | 0.25 | 0.25 | 0.25 | 0.25 | 0.25 | 0.25 |
| solve.font | 16 | 16 | 16 | 16 | 16 | 16 |

### Draw order

1. Value and candidates boxes (one per cell).
2. Thin internal grid (grey rectangles between cells within the same cage).
3. Cage boundaries (thick black).
4. Thick join squares at inner vertices where any cage boundary touches.
5. Outer border (thick black).
6. Axis labels (column letters, row numbers).
7. Cage labels (one per cage, top-left cell).
8. Footer.
9. Solve notes columns.

### Geometry (all in inches in spec; convert to pt and round for API)

- **Title:** left = 0.2 in, top = 0.05 in, width = slide_width − 0.4 in (e.g. 13.333 − 0.4), height = title_h_in. Two lines: title (bold, title_sz) and meta (not bold, meta_sz). Paragraph alignment CENTER, vertical anchor TOP.
- **Footer:** left = 0.4 in, top = slide_height − 0.45 in, width = slide_width − 0.8 in, height = 0.3 in. Font 14, alignment RIGHT.
- **Grid:** grid_left, grid_top, grid_size from profile; cell_w = grid_size / n.
- **Value box (per cell):** left = grid_left + c×cell_w, top = grid_top + r×cell_w + value.y_frac×cell_w, width = cell_w, height = value.h_frac×cell_w. Content: MIDDLE, CENTER. Font value.font.
- **Candidates box (per cell):** left = grid_left + c×cell_w + candidates.x_frac×cell_w, top = grid_top + r×cell_w + candidates.y_frac×cell_w, width = candidates.w_frac×cell_w, height = candidates.h_frac×cell_w. Vertical anchor BOTTOM, paragraph LEFT. Font candidates.font; letter-spacing = candidates.digit_margin pt. Reference font: Consolas (use Consolas for pixel-perfect match).
- **Boundaries:** v_bound[r][c−1] = true if cell (r,c−1) and (r,c) are in different cages. h_bound[r−1][c] = true if cell (r−1,c) and (r,c) are in different cages.
- **Thin grid:** Drawn as filled rectangles (not lines — `insertLine` has different z-order than `insertShape` in Google Slides, causing lines to render on top of shapes). For each vertical gap between columns c−1 and c (c = 1..n−1), for each row r (0..n−1): if **not** v_bound[r][c−1], draw a thin_pt-wide rectangle at (grid_left + c×cell_w − thin_pt/2, grid_top + r×cell_w, thin_pt, cell_w). Horizontal: for each row gap r (r = 1..n−1), for each col c (0..n−1): if **not** h_bound[r−1][c], draw (grid_left + c×cell_w, grid_top + r×cell_w − thin_pt/2, cell_w, thin_pt). Fill THIN_GRAY, border transparent. No shortening needed — thick cage boundary rectangles drawn afterward cover any overlap.
- **Thick line geometry:** thick_w = thick_pt / 72 (in inches; in pt use thick_pt). inset = thick_pt / 144 (in inches; in pt use thick_pt/2). Cage boundary segments: vertical at x = grid_left + c×cell_w, from y1 to y2; if r0 == 0 then y1 += inset; if r1 == n−1 then y2 −= inset. Rect: left = x − thick_w/2, top = y1, width = thick_w, height = y2−y1. Horizontal analogous (x1, x2 with inset at edges).
- **Join squares:** At vertex (vr, vc) with vr, vc in 1..n−1, if any of v_bound[vr−1][vc−1], v_bound[vr][vc−1], h_bound[vr−1][vc−1], h_bound[vr−1][vc] is true: center (x, y) = (grid_left + vc×cell_w, grid_top + vr×cell_w). left = clamp(x − thick_w/2, grid_left, grid_left + grid_size − thick_w), top = clamp(y − thick_w/2, grid_top, grid_top + grid_size − thick_w), size thick_w × thick_w.
- **Outer border:** half = thick_w/2. Top: (grid_left − half, grid_top − half, grid_size + thick_w, thick_w). Bottom: (grid_left − half, grid_top + grid_size − half, grid_size + thick_w, thick_w). Left: (grid_left − half, grid_top + half, thick_w, max(0, grid_size − thick_w)). Right: (grid_left + grid_size − half, grid_top + half, thick_w, max(0, grid_size − thick_w)).
- **Axis labels:** top_offset, side_offset in inches. top_y = grid_top − top_offset, side_x = grid_left − side_offset. Column c: box at (grid_left + c×cell_w, top_y), size (cell_w, axis_label_h). Text centered. Row r: box at (side_x, grid_top + r×cell_w + (cell_w − axis_label_h)/2), size (axis_label_w, axis_label_h). Vertical anchor MIDDLE, text centered.
- **Cage labels:** Top-left cell of cage = geometric min (smallest row, then smallest column). x = grid_left + tl.c×cell_w + cage.inset_x_frac×cell_w, y = grid_top + tl.r×cell_w + cage.inset_y_frac×cell_w. Box size (cage.box_w_frac×cell_w, cage.box_h_frac×cell_w). Vertical anchor TOP, paragraph LEFT. Font: use cage.font, or fit: actual_font = max(7, min(cage.font, floor((box_w_pt−10)/(0.60×len)), floor((box_h_pt−1)/1.15)) so long labels shrink. The 10 pt padding accounts for Google Slides' default horizontal text box insets (~0.05 in per side), which are not settable via API.
- **Solve notes:** For i = 0..cols−1: left = solve.left_in + i×(solve.col_w_in + solve.col_gap_in), top = grid_top, width = solve.col_w_in, height = grid_size. Border 1 pt, color solve notes border.

### Deviations (Slides vs reference)

- **Candidates letter-spacing:** The reference applies `candidates.digit_margin` (pt) as character spacing. The Google Slides Apps Script **TextStyle API does not expose letter/character spacing**, so this cannot be applied; candidate digits use default spacing. Box position/size and font match.
- **Solve notes inner margins:** The reference sets text margins (e.g. 0.08 in) inside the solve notes boxes. Slides does not set these explicitly; box position and size match.
- **Thin grid as rectangles:** The reference draws thin lines using actual line objects. Google Slides renders `insertLine` on top of `insertShape` regardless of insertion order, so thin grid segments are drawn as thin filled rectangles instead. Visually identical.
- **Rounding:** All coordinates and sizes are rounded to integer pt before the API. The reference rounded to integer EMU; the net effect is equivalent for layout.

### Google Slides API quirks

1. **`presentations.create` ignores `pageSize`** — known bug ([issuetracker #119321089](https://issuetracker.google.com/issues/119321089)). All presentations are created at the default 720×405 pt (10×5.625 in). Workaround: upload a PPTX template with the correct dimensions via the Drive API with MIME conversion (`mimeType: 'application/vnd.google-apps.presentation'`). The template is at `assets/template-960x540.pptx`.

2. **Page size is read-only after creation.** `updatePageProperties` cannot change `pageSize`. There is no API to resize a presentation after creation.

3. **Text box margins/insets are not settable via API** ([issuetracker #209837879](https://issuetracker.google.com/issues/209837879), status: blocked). `insertTextBox` creates boxes with ~0.05 in default top/bottom padding. The original Python generator set `margin_top=0` via python-pptx. Workaround: shift box positions up by 0.05 in to compensate (applied to column labels; row labels use MIDDLE vertical anchor where equal top/bottom padding cancels out).

4. **`insertLine()` renders on top of `insertShape()`** regardless of insertion order. Thin grid segments must be drawn as `insertShape(RECTANGLE)` filled with THIN_GRAY, not as lines.

### Implementation notes

1. **Thin grid drawn as rectangles, not lines.** See quirk #4 above. Thick cage boundary rectangles drawn afterward naturally cover any overlap at shared edges.

2. **Join squares at cage boundary vertices.** Drawn as thick_pt × thick_pt black rectangles at every interior vertex where **any** cage boundary touches (not just where 2+ meet). They blend in with thick boundaries.

3. **Row labels 1–n must all be visible.** The Google Slides editor may crop the bottom in the viewport, but the actual slide content is correct at 960×540 pt.

4. **Scale / slide size.** Slide is 960×540 pt (via PPTX template upload). Scaling is only applied when the page size differs.
