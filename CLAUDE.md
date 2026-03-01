# Mathdoku OCR + Reveal.js Solver

## Project Goal

Interactive browser-based Mathdoku puzzle solver with Reveal.js presentations. The workflow is: OCR a puzzle screenshot -> YAML spec -> open in browser app -> solve step-by-step -> export static HTML presentation for recording/archival.

## Architecture

### Pipeline

1. **OCR** (`ocr/ocr_mathdoku.py`): Screenshot -> YAML puzzle spec
2. **Browser App** (`src/app/`): Load YAML -> interactive solving with Reveal.js slides -> export static HTML

### Two-Phase Workflow

**Phase 1 — Interactive Solving (browser app):**
1. Open `npm run startSolver -- path/to/puzzle.yaml` (preferred: auto-loads puzzle) or `npm run dev` (manual file picker)
2. Load puzzle YAML (auto-loaded from server or via file picker)
3. Init: creates grid + runs initial strategies (synchronous, instant)
4. Solve interactively: click cells to edit, automated strategies run after each action, undo mistakes
5. Auto-saved to localStorage continuously

**Phase 2 — Export (static presentation):**
1. Click "Export" when done
2. Produces a self-contained Reveal.js HTML file (CSS/JS from CDN) with all SVG slides + speaker notes
3. Open the exported file to present, record video, archive

### Key Files

- `src/Puzzle.ts` - Business logic: Puzzle class, PuzzleRenderer/Strategy interfaces, `initPuzzleSlides()`, types (zero rendering dependencies)
- `src/layoutProfiles.ts` - Layout profile interfaces, `LAYOUT_PROFILES` constant (sizes 4-9), color/dimension constants, utility functions (`clamp`, `fitFontSize`, `formatCandidates`, `getLayoutProfile`, `in2pt`, `opSymbol`, `pt`)
- `src/SvgRenderer.ts` - SVG-based PuzzleRenderer: maintains per-cell visual state, builds SVG slides with pending/committed workflow, clickable cell overlays
- `src/strategies/` - Strategy implementations: solving strategies (SingleCandidate, HiddenSingle, LastCellInCage, NakedSet, HiddenSet, cage operation strategies (TooSmallForSum, TooBigForSum, DoesNotDivideProduct, TooSmallForProduct, TooBigForProduct), DeterminedByCage, NoCageCombination, RequiredCageCandidate, InniesOuties, Fish), init strategies (FillAllCandidates, SingleCellCage, UniqueCageMultiset)
- `src/strategies/cageOperationBounds.ts` - Cage operator deduction and Latin square bounds: `canBeOperator`, `computeLatinSquareBound`, `deduceOperator`, `getEffectiveOperator` (cached deduction via `Cage.deducedOperator`), enums (`AggregateType`, `BoundType`), `Bounds` interface, `BINARY_CELL_COUNT`
- `src/strategies/cageTupleAnalysis.ts` - Shared cage tuple enumeration functions (`getOperatorsForCage`, `adjustTargetForSolvedCells`, `enumerateValidTuples`) used by NoCageCombination and RequiredCageCandidate
- `src/cellChanges/` - CellChange subclasses (CandidatesChange, CandidatesStrikethrough, CellClearance, ValueChange)
- `src/app/main.ts` - Browser entry: YAML parsing, puzzle init, Reveal.js setup, keyboard shortcuts, undo, auto-save, server puzzle auto-load
- `scripts/startSolver.ts` - CLI script: starts Vite dev server with puzzle YAML served at `/api/puzzle`
- `src/app/RevealApp.ts` - Reveal.js deck management: `initializeReveal()`, `addSlides()`, `removeAfter()`, `navigateToLast()`
- `src/app/EditPanel.ts` - Click-to-select cell editing panel with operation queue and mandatory comments
- `src/app/ExportService.ts` - Export static HTML presentation (Reveal.js CDN, all SVG slides + notes)
- `src/app/StorageService.ts` - localStorage auto-save/restore (keyed by puzzle title)
- `src/app/index.html` - App HTML shell (file picker + Reveal.js container + toolbar)
- `src/app/style.css` - App styles (edit panel, cell overlays, toolbar)
- `src/app/reveal.js.d.ts` - Type declarations for reveal.js module
- `ocr/ocr_mathdoku.py` - OCR: uses OpenCV + Tesseract to extract puzzle from screenshot
- `tests/fixtures/` - YAML specs and reference images for various puzzles

### SVG Rendering (`SvgRenderer.ts`)

Implements `PuzzleRenderer` interface using SVG string generation. ViewBox `0 0 960 540` — coordinates map 1:1 to layout profile pt values.

**State model:**
- Maintains per-cell visual state: value, candidates, colors (normal/green), strikethrough flags
- `initGrid()` — initializes grid context, cell states, builds static grid SVG (boundaries, labels, etc.)
- `beginPendingRender()` — snapshots current cell states
- `renderPending*()` methods — apply green overlays/strikethrough to cell states
- `renderCommittedChanges()` — builds pending SVG (green overlays from snapshot) + committed SVG (finalized colors), pushes both to `slides[]`

**Static grid SVG** (cached, drawn once): title, thin grid, cage boundaries, join squares, outer border, axis labels, cage labels, footer, solve notes. Same draw order and geometry as the layout spec.

**Clickable cell overlays:** each cell gets a transparent `<rect>` with `data-cell="A1"` class `cell-overlay` for EditPanel click handlers.

### Solving Workflow

The app follows the same MVC pattern as the original:
- **Puzzle** (model+logic in `Puzzle.ts`): maintains cell values/candidates, parses Enter commands, runs strategies
- **SvgRenderer** (view): implements `PuzzleRenderer` interface with SVG rendering
- **Strategies** (one file each): implement `Strategy` interface, called by Puzzle's strategy loop

Flow:
1. **Edit** (via EditPanel): User clicks cells, chooses operation, enters comment. Submit builds a command string, calls `puzzle.enter(cmd)` + `puzzle.commit()` + `puzzle.tryApplyAutomatedStrategies()`.
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
2. **Commit**: `renderCommittedChanges` builds pending SVG (green changes) then committed SVG (finalized) — both pushed as slides.
3. **Automated strategies** run automatically after init and after each manual edit via `tryApplyAutomatedStrategies()`. No explicit trigger needed.

### Undo

History stack of `{slideCount, cellState}` snapshots. On undo: pop entry, remove slides after `slideCount`, rebuild Puzzle from saved cell state (values + candidates). Keyboard shortcut: `Ctrl+Z`.

### Slide Notes

Every action records its description in slide speaker notes for an audit trail:
- **Init**: batch 1 = "Filling all possible cell candidates", batch 2 = "Filling single cell values and unique cage multisets"
- **Enter**: the full input string (including `//` comments) is recorded
- **Automated strategies**: "Applying automated strategies" on each step
- Each action produces 2 slides (pending + committed), both get the note

Note text is set via `PuzzleRenderer.setNoteText()` from business logic (`Puzzle.enter()`, `Puzzle.tryApplyAutomatedStrategies()`, `initPuzzleSlides()`), not from app callers.

### localStorage Persistence (`StorageService.ts`)

Auto-saves after every action. Keyed by puzzle title with storage keys per puzzle. All `JSON.parse()` calls are validated with zod schemas (invalid data returns `null`):
- `mathdoku_{title}_state` — cell values and candidates
- `mathdoku_{title}_slides` — all SVG slide snapshots
- `mathdoku_{title}_history` — undo history stack

## TypeScript

### Type Checking & Linting

- `npm run check` (from project root) runs `cspell && eslint && dprint check && tsc`
- **eslint.config.mts** (root): based on obsidian-dev-utils strict config. Includes `typescript-eslint` strictTypeChecked + stylisticTypeChecked, `@stylistic/eslint-plugin`, `eslint-plugin-perfectionist` (alphabetical sorting), `@eslint-community/eslint-plugin-eslint-comments`

### Coding Style

- **camelCase** for all identifiers (variables, functions, interface fields). **UPPER_CASE** for constants only.
- Single quotes, no trailing commas, 1tbs brace style, semicolons required
- `.editorconfig`: 2-space indent, LF line endings, UTF-8
- **Enums over union types**: Use `enum X { A = 'a', B = 'b' }` instead of `type X = 'a' | 'b'`. No inline union type parameters — define a named enum.
- **Named types only**: No anonymous return types or anonymous argument object types. Use named interfaces.
- **Argument object pattern**: Functions with 5+ parameters should take a single params object. Name the interface `...Params`. Return type interfaces use `...Result`.

### Build

- `npm run startSolver -- path/to/puzzle.yaml` — Start solver with pre-loaded puzzle (preferred workflow)
- `npm run dev` — Vite dev server with hot reload and manual file picker (config: `vite.config.app.ts`, root: `src/app/`)
- `npm run build` — Vite production build to `dist/` (via `scripts/build.ts`)
- Entry point: `src/app/index.html` with `<script type="module" src="./main.ts">`
- Bundled dependencies: `js-yaml` (YAML parsing), `reveal.js` (presentation framework), `zod` (runtime validation)

## Conventions

### IMPORTANT: Traceability Rule

**No candidate eliminations or puzzle changes are made without a clear, human-readable, mentally traceable explanation.** Every elimination recorded in slide notes must have a reason a human can verify by inspection (e.g., "5 doesn't divide 72", "1 too small", "6 too big"). If a strategy cannot provide such an explanation for a particular elimination, that elimination must not be made. If brute-force enumeration is used, it must have a reasonably small number of options that a human can validate without writing anything down.

This is enforced structurally: `StrategyResult.changeGroups` is an array of `ChangeGroup`, where each group has `changes: CellChange[]` and `reason: string`. Every change must belong to a group with an explanation. Consumers flatten groups via `changeGroups.flatMap(g => g.changes)`.

### Operator enum

Cage operators use the `Operator` string enum (in `Puzzle.ts`): `Plus = '+'`, `Minus = '-'`, `Times = 'x'`, `Divide = '/'`, `Exact = '='`, `Unknown = '?'`. The OCR normalizes all Unicode variants (x, /, etc.) to these four known operators before writing YAML. `Operator.Exact` is for single-cell cages where the cell value equals the cage value directly (no mathematical operation). `Operator.Unknown` is an internal sentinel for multi-cell cages without a specified operator (puzzles with `hasOperators: false`); it never appears in YAML. Neither `Exact` nor `Unknown` appear in YAML; the zod schema defaults missing operators to `Unknown`. `CageRaw.operator` and `Cage.operator` are always `Operator` (never `undefined`).

`Cage.deducedOperator` is a mutable cache field set by `getEffectiveOperator()` when operator deduction succeeds. Only non-Unknown results are cached (Unknown means "try again later"). All strategies use `getEffectiveOperator(cage, puzzleSize)` instead of calling `deduceOperator` directly.

- Start solver: `npm run startSolver -- path/to/puzzle.yaml`
- Run dev server (file picker): `npm run dev`
- Build for production: `npm run build`
- Run OCR: `npm run ocrMathdoku screenshot.png`
- YAML fixtures go in `tests/fixtures/`
- Grid sizes 4-9 supported, each with a hardcoded layout profile in `LAYOUT_PROFILES` (in `layoutProfiles.ts`)
- Color constants defined in `layoutProfiles.ts`
- Font: "Segoe UI" for title, labels, values, notes; "Consolas" for candidates (per layout spec)

## Testing

- `npm test` runs vitest unit tests for Puzzle logic, strategies, parsers, combinatorics, cage constraints
- `uv run pytest` runs OCR tests. Don't run them unless OCR code changed.
- For rendering changes, test manually: run `npm run dev`, load a YAML fixture, verify in the browser.
- `TrackingRenderer` (in `__tests__/puzzleTestHelper.ts`) is the test double for `PuzzleRenderer` — tracks `notesBySlide`, `slideCount`, and has a configurable `isLastSlide` flag for guard testing.
- `createTestPuzzle()` accepts an optional `renderer` parameter to inject a `TrackingRenderer` the test holds a reference to (avoids `as TrackingRenderer` casts).

## Documentation

After every confirmed change, keep this file (`CLAUDE.md`) in sync with the current design. Update relevant sections (architecture, solving workflow, testing patterns, etc.) so future sessions have accurate context.

## Dependencies

- Node: js-yaml, reveal.js, zod (runtime); typescript, eslint, cspell, vite (dev) — see `package.json`
- Python: opencv-python, numpy, pytesseract, pyyaml — see `pyproject.toml`
- System: Tesseract OCR

---

## Slide layout spec (pixel-perfect reference)

The following is the canonical layout specification. `src/SvgRenderer.ts` implements it using SVG with coordinates from `src/layoutProfiles.ts`. All layout values come from the profiles below; convert inches to points with **1 in = 72 pt** and **round every position and size to integer pt**.

### Visual reference

**The canonical visual reference for pixel-perfect layout is `docs/screenshot-blog19-current.png`** (clean grid, thick black cage boundaries, thin grey lines between cells within the same cage, small black join dots at vertices, cage numbers in consistent positions, row labels 1-5 and column labels A-E). Compare all rendering output against it.

### Slide dimensions

- **Reference size:** 13.333 in x 7.5 in = **960 pt x 540 pt** (16:9).
- SVG viewBox: `0 0 960 540`.

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
| Green (pending)| `#008000` | (0, 128, 0)      |

### Layout profiles (sizes 4-9)

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

1. Value and candidates text (one per cell).
2. Thin internal grid (grey `<rect>` between cells within the same cage).
3. Cage boundaries (thick black `<rect>`).
4. Thick join squares at inner vertices where any cage boundary touches.
5. Outer border (thick black `<rect>`).
6. Axis labels (column letters, row numbers — `<text>` elements).
7. Cage labels (one per cage, top-left cell).
8. Footer.
9. Solve notes columns.

### Geometry (all in inches in spec; convert to pt and round)

- **Title:** left = 0.2 in, top = 0.05 in, width = slide_width - 0.4 in (e.g. 13.333 - 0.4), height = title_h_in. Two lines: title (bold, title_sz) and meta (not bold, meta_sz). Paragraph alignment CENTER, vertical anchor TOP.
- **Footer:** left = 0.4 in, top = slide_height - 0.45 in, width = slide_width - 0.8 in, height = 0.3 in. Font 14, alignment RIGHT.
- **Grid:** grid_left, grid_top, grid_size from profile; cell_w = grid_size / n.
- **Value box (per cell):** left = grid_left + c*cell_w, top = grid_top + r*cell_w + value.y_frac*cell_w, width = cell_w, height = value.h_frac*cell_w. Content: MIDDLE, CENTER. Font value.font.
- **Candidates box (per cell):** left = grid_left + c*cell_w + candidates.x_frac*cell_w, top = grid_top + r*cell_w + candidates.y_frac*cell_w, width = candidates.w_frac*cell_w, height = candidates.h_frac*cell_w. Vertical anchor BOTTOM, paragraph LEFT. Font candidates.font; letter-spacing = candidates.digit_margin pt. Font: Consolas.
- **Boundaries:** v_bound[r][c-1] = true if cell (r,c-1) and (r,c) are in different cages. h_bound[r-1][c] = true if cell (r-1,c) and (r,c) are in different cages.
- **Thin grid:** Filled `<rect>` elements. For each vertical gap between columns c-1 and c (c = 1..n-1), for each row r (0..n-1): if **not** v_bound[r][c-1], draw a thin_pt-wide rect at (grid_left + c*cell_w - thin_pt/2, grid_top + r*cell_w, thin_pt, cell_w). Horizontal: for each row gap r (r = 1..n-1), for each col c (0..n-1): if **not** h_bound[r-1][c], draw (grid_left + c*cell_w, grid_top + r*cell_w - thin_pt/2, cell_w, thin_pt).
- **Thick line geometry:** thick_w = thick_pt (in pt). inset = thick_pt/2. Cage boundary segments: vertical at x = grid_left + c*cell_w, from y1 to y2; if r0 == 0 then y1 += inset; if r1 == n-1 then y2 -= inset. Rect: left = x - thick_w/2, top = y1, width = thick_w, height = y2-y1. Horizontal analogous.
- **Join squares:** At vertex (vr, vc) with vr, vc in 1..n-1, if any adjacent cage boundary exists: center (x, y) = (grid_left + vc*cell_w, grid_top + vr*cell_w). left = clamp(x - thick_w/2, grid_left, grid_left + grid_size - thick_w), top = clamp(y - thick_w/2, grid_top, grid_top + grid_size - thick_w), size thick_w x thick_w.
- **Outer border:** half = thick_w/2. Top: (grid_left - half, grid_top - half, grid_size + thick_w, thick_w). Bottom: (grid_left - half, grid_top + grid_size - half, grid_size + thick_w, thick_w). Left: (grid_left - half, grid_top + half, thick_w, max(0, grid_size - thick_w)). Right: (grid_left + grid_size - half, grid_top + half, thick_w, max(0, grid_size - thick_w)).
- **Axis labels:** top_offset, side_offset in inches. top_y = grid_top - top_offset, side_x = grid_left - side_offset. Column c: centered at (grid_left + c*cell_w + cell_w/2, top_y + axis_label_h/2). Row r: centered at (side_x + axis_label_w/2, grid_top + r*cell_w + cell_w/2).
- **Cage labels:** Top-left cell of cage = geometric min (smallest row, then smallest column). x = grid_left + tl.c*cell_w + cage.inset_x_frac*cell_w, y = grid_top + tl.r*cell_w + cage.inset_y_frac*cell_w. Box size (cage.box_w_frac*cell_w, cage.box_h_frac*cell_w). Font: use cage.font, or fit: actual_font = max(7, min(cage.font, floor((box_w_pt-10)/(0.60*len)), floor((box_h_pt-1)/1.15)).
- **Solve notes:** For i = 0..cols-1: left = solve.left_in + i*(solve.col_w_in + solve.col_gap_in), top = grid_top, width = solve.col_w_in, height = grid_size. Border 1 pt, color solve notes border.
