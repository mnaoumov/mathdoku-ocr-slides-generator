import { z } from 'zod';

import type { CandidatesChange } from './cellChanges/CandidatesChange.ts';
import type { CandidatesStrikethrough } from './cellChanges/CandidatesStrikethrough.ts';
import type { CellClearance } from './cellChanges/CellClearance.ts';
import type { ValueChange } from './cellChanges/ValueChange.ts';
import type { LayoutProfile } from './layoutProfiles.ts';
import type {
  CageRaw,
  CellSnapshot,
  PuzzleRenderer
} from './Puzzle.ts';

import { GridBoundaries } from './combinatorics.ts';
import {
  AXIS_LABEL_MAGENTA,
  BLACK,
  CAGE_LABEL_BLUE,
  CANDIDATE_ROW_COUNT,
  CANDIDATES_DARK_RED,
  CANDIDATES_FONT,
  CHAR_CODE_A,
  clamp,
  fitFontSize,
  FOOTER_COLOR,
  FOOTER_FONT_SIZE,
  FOOTER_OFFSET_INCHES,
  FOOTER_TEXT,
  formatCandidates,
  GREEN,
  in2pt,
  LAYOUT_PROFILES,
  LIGHT_GRAY_BORDER,
  opSymbol,
  POINTS_PER_INCH,
  pt,
  SIDE_COUNT,
  SLIDE_HEIGHT_PT,
  SLIDE_WIDTH_PT,
  TEXT_BOX_TOP_PADDING_INCHES,
  TEXT_BOX_TOP_PADDING_PT,
  THIN_GRAY,
  TITLE_HORIZONTAL_MARGIN_INCHES,
  VALUE_GRAY
} from './layoutProfiles.ts';
import {
  getCellRef,
  parseCellRef
} from './parsers.ts';
import { Operator } from './Puzzle.ts';
import { ensureNonNullable } from './typeGuards.ts';

const CANDIDATES_BOTTOM_PADDING_PT = 3;
const SOLVE_NOTES_PADDING_PT = 6;

export const slideSnapshotSchema = z.object({
  notes: z.string(),
  svg: z.string()
});

export type SlideSnapshot = z.infer<typeof slideSnapshotSchema>;

export interface SolveNotesRect {
  readonly font: number;
  readonly height: number;
  readonly left: number;
  readonly top: number;
  readonly width: number;
}

interface CellVisualState {
  candidates: readonly number[];
  candidatesColor: string;
  strikethroughDigits: ReadonlySet<number>;
  value: string;
  valueColor: string;
}

interface GridContext {
  readonly boundaries: GridBoundaries;
  readonly cages: readonly CageRaw[];
  readonly cellWidth: number;
  readonly gridLeft: number;
  readonly gridSize: number;
  readonly gridTop: number;
  readonly hasOperators: boolean;
  readonly puzzleSize: number;
}

export class SvgRenderer implements PuzzleRenderer {
  public readonly slides: SlideSnapshot[] = [];

  public get slideCount(): number {
    return this.slides.length;
  }

  private cageLabelsSvg = '';
  private cellStates = new Map<string, CellVisualState>();
  private ctx: GridContext | null = null;
  private gridSvg = '';
  private noteText = '';
  private snapshot = new Map<string, CellVisualState>();

  public beginPendingRender(_puzzleSize: number): void {
    this.snapshot = cloneCellStates(this.cellStates);
  }

  public ensureLastSlide(): boolean {
    return true;
  }

  public initGrid(
    puzzleSize: number,
    cages: readonly CageRaw[],
    hasOperators: boolean,
    title: string,
    meta: string
  ): void {
    const profile = ensureNonNullable(LAYOUT_PROFILES[puzzleSize]);
    const gridLeft = pt(in2pt(profile.gridLeftInches));
    const gridTop = pt(in2pt(profile.gridTopInches));
    const gridSize = pt(in2pt(profile.gridSizeInches));
    const cellWidth = gridSize / puzzleSize;
    const boundaries = new GridBoundaries(cages, puzzleSize);

    this.ctx = {
      boundaries,
      cages,
      cellWidth,
      gridLeft,
      gridSize,
      gridTop,
      hasOperators,
      puzzleSize
    };

    // Initialize cell states
    for (let rowId = 1; rowId <= puzzleSize; rowId++) {
      for (let columnId = 1; columnId <= puzzleSize; columnId++) {
        const ref = getCellRef(rowId, columnId);
        this.cellStates.set(ref, {
          candidates: [],
          candidatesColor: CANDIDATES_DARK_RED,
          strikethroughDigits: new Set(),
          value: '',
          valueColor: VALUE_GRAY
        });
      }
    }

    // Build the static grid SVG (everything except cell values/candidates and cage labels)
    this.gridSvg = buildGridSvg(this.ctx, profile, title, meta);
    this.cageLabelsSvg = buildCageLabels(this.ctx, profile);
  }

  public pushInitialSlide(): void {
    const ctx = ensureNonNullable(this.ctx);
    const svg = this.buildSlideSvg(ctx, this.cellStates);
    this.slides.push({ notes: '', svg });
  }

  public renderCommittedChanges(_puzzleSize: number): void {
    const ctx = ensureNonNullable(this.ctx);

    // Build pending SVG (green overlays from current cellStates)
    const pendingSvg = this.buildSlideSvg(ctx, this.cellStates);
    this.slides.push({ notes: this.noteText, svg: pendingSvg });

    // Now apply pending changes to snapshot to get committed state
    // The current cellStates already have the pending visual state;
    // We need the committed version (green->normal, strikethrough->removed)
    const committedStates = new Map<string, CellVisualState>();
    for (const [ref, pending] of this.cellStates) {
      const snap = this.snapshot.get(ref);
      if (pending.value && pending.valueColor === GREEN) {
        // Green value -> committed as normal value
        committedStates.set(ref, {
          candidates: [],
          candidatesColor: CANDIDATES_DARK_RED,
          strikethroughDigits: new Set(),
          value: pending.value,
          valueColor: VALUE_GRAY
        });
      } else if (pending.strikethroughDigits.size > 0) {
        // Remove struck-through candidates
        const surviving = pending.candidates.filter((d) => !pending.strikethroughDigits.has(d));
        committedStates.set(ref, {
          candidates: surviving,
          candidatesColor: CANDIDATES_DARK_RED,
          strikethroughDigits: new Set(),
          value: pending.value,
          valueColor: pending.value ? VALUE_GRAY : pending.valueColor
        });
      } else if (pending.candidatesColor === GREEN) {
        // Green candidates -> committed as normal
        committedStates.set(ref, {
          candidates: pending.candidates,
          candidatesColor: CANDIDATES_DARK_RED,
          strikethroughDigits: new Set(),
          value: '',
          valueColor: VALUE_GRAY
        });
      } else {
        committedStates.set(ref, snap ? { ...snap } : { ...pending });
      }
    }

    this.cellStates = committedStates;

    // Build committed SVG
    const committedSvg = this.buildSlideSvg(ctx, this.cellStates);
    this.slides.push({ notes: this.noteText, svg: committedSvg });

    this.snapshot = new Map();
  }

  public renderPendingCandidates(change: CandidatesChange): void {
    const state = ensureNonNullable(this.cellStates.get(change.cell.ref));
    this.cellStates.set(change.cell.ref, {
      ...state,
      candidates: [...change.values],
      candidatesColor: GREEN,
      strikethroughDigits: new Set(),
      value: '',
      valueColor: VALUE_GRAY
    });
  }

  public renderPendingClearance(change: CellClearance): void {
    this.cellStates.set(change.cell.ref, {
      candidates: [],
      candidatesColor: CANDIDATES_DARK_RED,
      strikethroughDigits: new Set(),
      value: '',
      valueColor: VALUE_GRAY
    });
  }

  public renderPendingStrikethrough(change: CandidatesStrikethrough): void {
    const state = ensureNonNullable(this.cellStates.get(change.cell.ref));
    const newStrike = new Set(state.strikethroughDigits);
    for (const v of change.values) {
      newStrike.add(v);
    }
    this.cellStates.set(change.cell.ref, {
      ...state,
      strikethroughDigits: newStrike
    });
  }

  public renderPendingValue(change: ValueChange): void {
    const state = ensureNonNullable(this.cellStates.get(change.cell.ref));
    this.cellStates.set(change.cell.ref, {
      ...state,
      candidates: [],
      candidatesColor: CANDIDATES_DARK_RED,
      strikethroughDigits: new Set(),
      value: String(change.value),
      valueColor: GREEN
    });
  }

  public restoreCellStates(cells: readonly CellSnapshot[]): void {
    for (const cell of cells) {
      this.cellStates.set(cell.ref, {
        candidates: cell.value === null ? cell.getCandidates() : [],
        candidatesColor: CANDIDATES_DARK_RED,
        strikethroughDigits: new Set(),
        value: cell.value === null ? '' : String(cell.value),
        valueColor: VALUE_GRAY
      });
    }
  }

  public setNoteText(text: string): void {
    this.noteText = text;
  }

  private buildSlideSvg(ctx: GridContext, states: Map<string, CellVisualState>): string {
    const profile = ensureNonNullable(LAYOUT_PROFILES[ctx.puzzleSize]);
    const parts: string[] = [];

    parts.push(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${String(SLIDE_WIDTH_PT)} ${String(SLIDE_HEIGHT_PT)}" width="${String(SLIDE_WIDTH_PT)}" height="${
        String(SLIDE_HEIGHT_PT)
      }">`
    );
    parts.push('<rect width="100%" height="100%" fill="white"/>');

    // Static grid elements
    parts.push(this.gridSvg);

    // Dynamic cell content
    for (let rowId = 1; rowId <= ctx.puzzleSize; rowId++) {
      for (let columnId = 1; columnId <= ctx.puzzleSize; columnId++) {
        const ref = getCellRef(rowId, columnId);
        const state = ensureNonNullable(states.get(ref));
        const cellLeft = ctx.gridLeft + (columnId - 1) * ctx.cellWidth;
        const cellTop = ctx.gridTop + (rowId - 1) * ctx.cellWidth;

        // Value
        if (state.value) {
          const valueY = cellTop + profile.value.topFraction * ctx.cellWidth;
          const valueH = profile.value.heightFraction * ctx.cellWidth;
          const valueCenterX = pt(cellLeft + ctx.cellWidth / SIDE_COUNT);
          const valueCenterY = pt(valueY + valueH / SIDE_COUNT);
          parts.push(
            `<text x="${String(valueCenterX)}" y="${String(valueCenterY)}" `
              + `font-family="Segoe UI" font-size="${String(profile.value.font)}" font-weight="bold" `
              + `fill="${state.valueColor}" text-anchor="middle" dominant-baseline="central">${escapeXml(state.value)}</text>`
          );
        }

        // Candidates
        if (state.candidates.length > 0) {
          const candLeft = cellLeft + profile.candidates.leftFraction * ctx.cellWidth;
          const candTop = cellTop + profile.candidates.topFraction * ctx.cellWidth;
          const candWidth = profile.candidates.widthFraction * ctx.cellWidth;
          const candHeight = profile.candidates.heightFraction * ctx.cellWidth;
          const formatted = formatCandidates(state.candidates, ctx.puzzleSize);
          const lines = formatted.split('\n');
          const lineHeight = candHeight / CANDIDATE_ROW_COUNT;

          for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
            const line = ensureNonNullable(lines[lineIdx]);
            const lineY = pt(candTop + candHeight - CANDIDATES_BOTTOM_PADDING_PT - (lines.length - 1 - lineIdx) * lineHeight);

            for (let charIdx = 0; charIdx < line.length; charIdx++) {
              const ch = line.charAt(charIdx);
              if (ch === ' ') {
                continue;
              }
              const digit = parseInt(ch, 10);
              const isStruck = state.strikethroughDigits.has(digit);
              const color = isStruck ? GREEN : state.candidatesColor;
              const charWidth = candWidth / Math.max(1, line.length);
              const charX = pt(candLeft + charIdx * charWidth + charWidth / SIDE_COUNT);

              parts.push(
                `<text x="${String(charX)}" y="${String(lineY)}" `
                  + `font-family="${CANDIDATES_FONT}" font-size="${String(profile.candidates.font)}" `
                  + `fill="${color}" text-anchor="middle" dominant-baseline="auto"${isStruck ? ' text-decoration="line-through"' : ''}>${escapeXml(ch)}</text>`
              );
            }
          }
        }

        // Clickable overlay
        parts.push(
          `<rect x="${String(pt(cellLeft))}" y="${String(pt(cellTop))}" `
            + `width="${String(pt(ctx.cellWidth))}" height="${String(pt(ctx.cellWidth))}" `
            + `data-cell="${ref}" class="cell-overlay"/>`
        );
      }
    }

    // Cage labels (rendered after overlays so they're clickable)
    parts.push(this.cageLabelsSvg);

    parts.push('</svg>');
    return parts.join('\n');
  }
}

export function buildSolveNotesForeignObject(text: string, rect: SolveNotesRect): string {
  const escaped = escapeXml(text);
  return `<foreignObject x="${String(rect.left)}" y="${String(rect.top)}" width="${String(rect.width)}" height="${String(rect.height)}">`
    + `<div xmlns="http://www.w3.org/1999/xhtml" style="font-family: 'Segoe UI', sans-serif; font-size: ${String(rect.font)}px; `
    + `color: ${VALUE_GRAY}; padding: ${
      String(SOLVE_NOTES_PADDING_PT)
    }px; text-align: left; overflow: hidden; overflow-wrap: break-word; white-space: pre-wrap;">`
    + `${escaped}</div></foreignObject>`;
}

export function getSolveNotesRect(puzzleSize: number): SolveNotesRect {
  const profile = ensureNonNullable(LAYOUT_PROFILES[puzzleSize]);
  return {
    font: profile.solve.font,
    height: pt(in2pt(profile.gridSizeInches)),
    left: pt(in2pt(profile.solve.leftInches)),
    top: pt(in2pt(profile.gridTopInches)),
    width: pt(in2pt(profile.solve.columnWidthInches))
  };
}

function buildAxisLabels(ctx: GridContext, profile: LayoutProfile): string {
  const parts: string[] = [];
  const { cellWidth, gridLeft, gridTop, puzzleSize } = ctx;
  const labelHeight = pt(in2pt(profile.axisLabelHeight));
  const topOffset = in2pt(profile.axisTopOffset);
  const sideOffset = in2pt(profile.axisSideOffset);
  const topY = pt(gridTop - topOffset - TEXT_BOX_TOP_PADDING_PT);
  const sideX = pt(gridLeft - sideOffset);

  // Column labels
  for (let columnId = 1; columnId <= puzzleSize; columnId++) {
    const colLeft = gridLeft + (columnId - 1) * cellWidth;
    const centerX = pt(colLeft + cellWidth / SIDE_COUNT);
    const centerY = topY + labelHeight / SIDE_COUNT;
    const columnCells = Array.from({ length: puzzleSize }, (_, r) => getCellRef(r + 1, columnId)).join(',');
    parts.push(
      `<text x="${String(centerX)}" y="${String(centerY)}" `
        + `font-family="Segoe UI" font-size="${String(profile.axisFont)}" font-weight="bold" `
        + `fill="${AXIS_LABEL_MAGENTA}" text-anchor="middle" dominant-baseline="central" `
        + `class="clickable-label" data-cells="${columnCells}">${String.fromCharCode(CHAR_CODE_A + columnId - 1)}</text>`
    );
  }

  // Row labels
  const labelWidth = pt(in2pt(profile.axisLabelWidth));
  for (let rowId = 1; rowId <= puzzleSize; rowId++) {
    const rowTop = gridTop + (rowId - 1) * cellWidth;
    const centerX = sideX + labelWidth / SIDE_COUNT;
    const centerY = pt(rowTop + cellWidth / SIDE_COUNT);
    const rowCells = Array.from({ length: puzzleSize }, (_, c) => getCellRef(rowId, c + 1)).join(',');
    parts.push(
      `<text x="${String(centerX)}" y="${String(centerY)}" `
        + `font-family="Segoe UI" font-size="${String(profile.axisFont)}" font-weight="bold" `
        + `fill="${AXIS_LABEL_MAGENTA}" text-anchor="middle" dominant-baseline="central" `
        + `class="clickable-label" data-cells="${rowCells}">${String(rowId)}</text>`
    );
  }
  return parts.join('\n');
}

function buildCageBoundaries(ctx: GridContext): string {
  const parts: string[] = [];
  const { boundaries, cellWidth, gridLeft, gridTop, puzzleSize } = ctx;
  const profile = ensureNonNullable(LAYOUT_PROFILES[puzzleSize]);
  const thickPt = profile.thickPt;
  const inset = thickPt / SIDE_COUNT;

  // Vertical boundaries
  for (let columnId = 1; columnId < puzzleSize; columnId++) {
    let startRowId = 1;
    while (startRowId <= puzzleSize) {
      if (!boundaries.hasRightBound(startRowId, columnId)) {
        startRowId++;
        continue;
      }
      let endRowId = startRowId;
      while (endRowId < puzzleSize && boundaries.hasRightBound(endRowId + 1, columnId)) {
        endRowId++;
      }
      const x = gridLeft + columnId * cellWidth;
      let y1 = gridTop + (startRowId - 1) * cellWidth;
      let y2 = gridTop + endRowId * cellWidth;
      if (startRowId === 1) {
        y1 += inset;
      }
      if (endRowId === puzzleSize) {
        y2 -= inset;
      }
      parts.push(thickRect(x - thickPt / SIDE_COUNT, y1, thickPt, y2 - y1));
      startRowId = endRowId + 1;
    }
  }

  // Horizontal boundaries
  for (let rowId = 1; rowId < puzzleSize; rowId++) {
    let startColumnId = 1;
    while (startColumnId <= puzzleSize) {
      if (!boundaries.hasBottomBound(rowId, startColumnId)) {
        startColumnId++;
        continue;
      }
      let endColumnId = startColumnId;
      while (endColumnId < puzzleSize && boundaries.hasBottomBound(rowId, endColumnId + 1)) {
        endColumnId++;
      }
      const y = gridTop + rowId * cellWidth;
      let x1 = gridLeft + (startColumnId - 1) * cellWidth;
      let x2 = gridLeft + endColumnId * cellWidth;
      if (startColumnId === 1) {
        x1 += inset;
      }
      if (endColumnId === puzzleSize) {
        x2 -= inset;
      }
      parts.push(thickRect(x1, y - thickPt / SIDE_COUNT, x2 - x1, thickPt));
      startColumnId = endColumnId + 1;
    }
  }

  return parts.join('\n');
}

function buildCageLabels(ctx: GridContext, profile: LayoutProfile): string {
  const parts: string[] = [];
  const { cages, cellWidth, gridLeft, gridTop, hasOperators } = ctx;
  const cageProfile = profile.cage;
  const insetX = cageProfile.insetLeftFraction * cellWidth;
  const insetY = cageProfile.insetTopFraction * cellWidth;
  const labelBoxWidth = cageProfile.boxWidthFraction * cellWidth;
  const labelBoxHeight = Math.min(
    cageProfile.boxHeightFraction * cellWidth,
    profile.candidates.topFraction * cellWidth - insetY
  );

  for (const cage of cages) {
    const parsed = cage.cells.map((ref) => ({ ref, ...parseCellRef(ref) }));
    parsed.sort((a, b) => a.rowId === b.rowId ? a.columnId - b.columnId : a.rowId - b.rowId);
    const topLeftCell = ensureNonNullable(parsed[0]);

    const label = hasOperators && cage.cells.length > 1 && cage.operator !== Operator.Unknown
      ? String(cage.value) + opSymbol(cage.operator)
      : String(cage.value);

    const x = pt(gridLeft + (topLeftCell.columnId - 1) * cellWidth + insetX);
    const y = pt(gridTop + (topLeftCell.rowId - 1) * cellWidth + insetY);
    const actualFont = fitFontSize(label, cageProfile.font, labelBoxWidth / POINTS_PER_INCH, labelBoxHeight / POINTS_PER_INCH);

    const cageCells = cage.cells.join(',');
    parts.push(
      `<text x="${String(x)}" y="${String(y + actualFont)}" `
        + `font-family="Segoe UI" font-size="${String(actualFont)}" font-weight="bold" `
        + `fill="${CAGE_LABEL_BLUE}" text-anchor="start" dominant-baseline="auto" `
        + `class="clickable-label" data-cells="${cageCells}">${escapeXml(label)}</text>`
    );
  }
  return parts.join('\n');
}

function buildGridSvg(
  ctx: GridContext,
  profile: LayoutProfile,
  title: string,
  meta: string
): string {
  const parts: string[] = [];

  // Title
  const titleLeft = pt(in2pt(TITLE_HORIZONTAL_MARGIN_INCHES / SIDE_COUNT));
  const titleTop = pt(in2pt(TEXT_BOX_TOP_PADDING_INCHES));
  const titleWidth = pt(SLIDE_WIDTH_PT - in2pt(TITLE_HORIZONTAL_MARGIN_INCHES));
  const titleCenterX = titleLeft + titleWidth / SIDE_COUNT;
  const titleY = titleTop + profile.titleFontSize;
  parts.push(
    `<text x="${String(pt(titleCenterX))}" y="${String(titleY)}" `
      + `font-family="Segoe UI" font-size="${String(profile.titleFontSize)}" font-weight="bold" `
      + `fill="${BLACK}" text-anchor="middle">${escapeXml(title)}</text>`
  );
  if (meta) {
    const metaY = titleY + profile.metaFontSize + SIDE_COUNT;
    parts.push(
      `<text x="${String(pt(titleCenterX))}" y="${String(metaY)}" `
        + `font-family="Segoe UI" font-size="${String(profile.metaFontSize)}" `
        + `fill="${VALUE_GRAY}" text-anchor="middle">${escapeXml(meta)}</text>`
    );
  }

  // Thin grid
  parts.push(buildThinGrid(ctx));

  // Cage boundaries
  parts.push(buildCageBoundaries(ctx));

  // Join squares
  parts.push(buildJoinSquares(ctx));

  // Outer border
  parts.push(buildOuterBorder(ctx));

  // Axis labels
  parts.push(buildAxisLabels(ctx, profile));

  // Footer
  const footerLeft = pt(in2pt(TITLE_HORIZONTAL_MARGIN_INCHES));
  const footerTop = pt(SLIDE_HEIGHT_PT - in2pt(FOOTER_OFFSET_INCHES));
  const footerWidth = pt(SLIDE_WIDTH_PT - in2pt(SIDE_COUNT * TITLE_HORIZONTAL_MARGIN_INCHES));
  parts.push(
    `<text x="${String(footerLeft + footerWidth)}" y="${String(footerTop + FOOTER_FONT_SIZE)}" `
      + `font-family="Segoe UI" font-size="${String(FOOTER_FONT_SIZE)}" `
      + `fill="${FOOTER_COLOR}" text-anchor="end">${escapeXml(FOOTER_TEXT)}</text>`
  );

  // Solve notes columns
  parts.push(buildSolveNotes(ctx, profile));

  return parts.join('\n');
}

function buildJoinSquares(ctx: GridContext): string {
  const parts: string[] = [];
  const { boundaries, cellWidth, gridLeft, gridSize, gridTop, puzzleSize } = ctx;
  const profile = ensureNonNullable(LAYOUT_PROFILES[puzzleSize]);
  const thickPt = profile.thickPt;

  for (let vertexRow = 1; vertexRow < puzzleSize; vertexRow++) {
    for (let vertexCol = 1; vertexCol < puzzleSize; vertexCol++) {
      const verticalAbove = boundaries.hasRightBound(vertexRow, vertexCol);
      const verticalBelow = boundaries.hasRightBound(vertexRow + 1, vertexCol);
      const horizontalLeft = boundaries.hasBottomBound(vertexRow, vertexCol);
      const horizontalRight = boundaries.hasBottomBound(vertexRow, vertexCol + 1);
      if (!verticalAbove && !verticalBelow && !horizontalLeft && !horizontalRight) {
        continue;
      }
      const x = gridLeft + vertexCol * cellWidth;
      const y = gridTop + vertexRow * cellWidth;
      const left = clamp(x - thickPt / SIDE_COUNT, gridLeft, gridLeft + gridSize - thickPt);
      const top = clamp(y - thickPt / SIDE_COUNT, gridTop, gridTop + gridSize - thickPt);
      parts.push(svgRect(pt(left), pt(top), pt(thickPt), pt(thickPt), BLACK));
    }
  }
  return parts.join('\n');
}

function buildOuterBorder(ctx: GridContext): string {
  const { gridLeft, gridSize, gridTop, puzzleSize } = ctx;
  const profile = ensureNonNullable(LAYOUT_PROFILES[puzzleSize]);
  const thickPt = profile.thickPt;
  const halfThick = thickPt / SIDE_COUNT;

  const parts: string[] = [];
  // Top
  parts.push(thickRect(gridLeft - halfThick, gridTop - halfThick, gridSize + thickPt, thickPt));
  // Bottom
  parts.push(thickRect(gridLeft - halfThick, gridTop + gridSize - halfThick, gridSize + thickPt, thickPt));
  // Left
  parts.push(thickRect(gridLeft - halfThick, gridTop + halfThick, thickPt, Math.max(0, gridSize - thickPt)));
  // Right
  parts.push(thickRect(gridLeft + gridSize - halfThick, gridTop + halfThick, thickPt, Math.max(0, gridSize - thickPt)));
  return parts.join('\n');
}

function buildSolveNotes(ctx: GridContext, profile: LayoutProfile): string {
  const parts: string[] = [];
  const { gridSize, gridTop } = ctx;
  const solveProfile = profile.solve;
  const notesLeft = in2pt(solveProfile.leftInches);
  const columnWidth = in2pt(solveProfile.columnWidthInches);
  const columnGap = in2pt(solveProfile.columnGapInches);

  for (let i = 0; i < solveProfile.columnCount; i++) {
    const x = pt(notesLeft + i * (columnWidth + columnGap));
    const y = pt(gridTop);
    const w = pt(columnWidth);
    const h = pt(gridSize);
    parts.push(
      `<rect x="${String(x)}" y="${String(y)}" width="${String(w)}" height="${String(h)}" `
        + `fill="none" stroke="${LIGHT_GRAY_BORDER}" stroke-width="1"/>`
    );
  }
  return parts.join('\n');
}

function buildThinGrid(ctx: GridContext): string {
  const parts: string[] = [];
  const { boundaries, cellWidth, gridLeft, gridTop, puzzleSize } = ctx;
  const thinWidth = ensureNonNullable(LAYOUT_PROFILES[puzzleSize]).thinPt;
  const halfThin = thinWidth / SIDE_COUNT;

  for (let rowId = 1; rowId <= puzzleSize; rowId++) {
    for (let columnId = 1; columnId <= puzzleSize; columnId++) {
      const x = gridLeft + (columnId - 1) * cellWidth;
      const y = gridTop + (rowId - 1) * cellWidth;

      if (!boundaries.hasLeftBound(rowId, columnId)) {
        parts.push(svgRect(pt(x - halfThin), pt(y), pt(thinWidth), pt(cellWidth), THIN_GRAY));
      }

      if (!boundaries.hasTopBound(rowId, columnId)) {
        parts.push(svgRect(pt(x), pt(y - halfThin), pt(cellWidth), pt(thinWidth), THIN_GRAY));
      }
    }
  }
  return parts.join('\n');
}

function cloneCellStates(states: Map<string, CellVisualState>): Map<string, CellVisualState> {
  const clone = new Map<string, CellVisualState>();
  for (const [ref, state] of states) {
    clone.set(ref, {
      candidates: [...state.candidates],
      candidatesColor: state.candidatesColor,
      strikethroughDigits: new Set(state.strikethroughDigits),
      value: state.value,
      valueColor: state.valueColor
    });
  }
  return clone;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function svgRect(x: number, y: number, w: number, h: number, fill: string): string {
  if (w <= 0 || h <= 0) {
    return '';
  }
  return `<rect x="${String(x)}" y="${String(y)}" width="${String(w)}" height="${String(h)}" fill="${fill}"/>`;
}

function thickRect(left: number, top: number, width: number, height: number): string {
  const w = pt(width);
  const h = pt(height);
  if (w <= 0 || h <= 0) {
    return '';
  }
  return `<rect x="${String(pt(left))}" y="${String(pt(top))}" width="${String(w)}" height="${String(h)}" fill="${BLACK}"/>`;
}
