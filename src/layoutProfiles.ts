import { Operator } from './Puzzle.ts';
import { ensureNonNullable } from './typeGuards.ts';

export interface CageProfile {
  readonly boxHeightFraction: number;
  readonly boxWidthFraction: number;
  readonly font: number;
  readonly insetLeftFraction: number;
  readonly insetTopFraction: number;
}

export interface CandidatesProfile {
  readonly digitMargin: number;
  readonly font: number;
  readonly heightFraction: number;
  readonly leftFraction: number;
  readonly topFraction: number;
  readonly widthFraction: number;
}

export interface LayoutProfile {
  readonly axisFont: number;
  readonly axisLabelHeight: number;
  readonly axisLabelWidth: number;
  readonly axisSideOffset: number;
  readonly axisTopOffset: number;
  readonly cage: CageProfile;
  readonly candidates: CandidatesProfile;
  readonly gridLeftInches: number;
  readonly gridSizeInches: number;
  readonly gridTopInches: number;
  readonly metaFontSize: number;
  readonly solve: SolveProfile;
  readonly thickPt: number;
  readonly thinPt: number;
  readonly titleFontSize: number;
  readonly titleHeightInches: number;
  readonly value: ValueProfile;
}

export interface SolveProfile {
  readonly columnCount: number;
  readonly columnGapInches: number;
  readonly columnWidthInches: number;
  readonly font: number;
  readonly leftInches: number;
}

export interface ValueProfile {
  readonly font: number;
  readonly heightFraction: number;
  readonly topFraction: number;
}

// Color constants
export const AXIS_LABEL_MAGENTA = '#C800C8';
export const BLACK = '#000000';
export const CAGE_LABEL_BLUE = '#3232C8';
export const CANDIDATES_DARK_RED = '#8B0000';
export const CANDIDATES_FONT = 'Consolas';
export const FOOTER_COLOR = '#6E7887';
export const GREEN = '#00B050';
export const LIGHT_GRAY_BORDER = '#C8C8C8';
export const THIN_GRAY = '#AAAAAA';
export const VALUE_GRAY = '#3C414B';

// Dimensional constants
export const CANDIDATE_ROW_COUNT = 2;
export const CHAR_CODE_A = 65;
export const FONT_FIT_HEIGHT_RATIO = 1.15;
export const FONT_FIT_PADDING_PT = 2;
export const FONT_FIT_WIDTH_RATIO = 0.60;
export const FOOTER_FONT_SIZE = 14;
export const FOOTER_HEIGHT_INCHES = 0.3;
export const FOOTER_OFFSET_INCHES = 0.45;
export const FOOTER_TEXT = '@mnaoumov';
export const MIN_FONT_SIZE = 7;
export const POINTS_PER_INCH = 72;
export const SIDE_COUNT = 2;
export const SLIDE_HEIGHT_PT = 540;
export const SLIDE_WIDTH_PT = 960;
export const TEXT_BOX_SIDE_PADDING_INCHES = 0.1;
export const TEXT_BOX_SIDE_PADDING_PT = TEXT_BOX_SIDE_PADDING_INCHES * POINTS_PER_INCH;
export const TEXT_BOX_TOP_PADDING_INCHES = 0.05;
export const TEXT_BOX_TOP_PADDING_PT = TEXT_BOX_TOP_PADDING_INCHES * POINTS_PER_INCH;
export const TITLE_HORIZONTAL_MARGIN_INCHES = 0.4;

/* eslint-disable no-magic-numbers -- Canonical layout spec values. */
export const LAYOUT_PROFILES: Record<number, LayoutProfile> = {
  4: {
    axisFont: 24,
    axisLabelHeight: 0.34,
    axisLabelWidth: 0.30,
    axisSideOffset: 0.36,
    axisTopOffset: 0.42,
    cage: { boxHeightFraction: 0.35, boxWidthFraction: 0.65, font: 28, insetLeftFraction: 0.07, insetTopFraction: 0.05 },
    candidates: { digitMargin: 12, font: 22, heightFraction: 0.60, leftFraction: 0.15, topFraction: 0.38, widthFraction: 0.80 },
    gridLeftInches: 0.65,
    gridSizeInches: 4.75,
    gridTopInches: 1.35,
    metaFontSize: 20,
    solve: { columnCount: 1, columnGapInches: 0.25, columnWidthInches: 6.50, font: 16, leftInches: 6.20 },
    thickPt: 5.0,
    thinPt: 1.0,
    titleFontSize: 30,
    titleHeightInches: 0.85,
    value: { font: 52, heightFraction: 0.70, topFraction: 0.30 }
  },
  5: {
    axisFont: 26,
    axisLabelHeight: 0.37,
    axisLabelWidth: 0.32,
    axisSideOffset: 0.38,
    axisTopOffset: 0.45,
    cage: { boxHeightFraction: 0.33, boxWidthFraction: 0.65, font: 24, insetLeftFraction: 0.07, insetTopFraction: 0.05 },
    candidates: { digitMargin: 7, font: 20, heightFraction: 0.62, leftFraction: 0.05, topFraction: 0.36, widthFraction: 0.88 },
    gridLeftInches: 0.65,
    gridSizeInches: 5.20,
    gridTopInches: 1.25,
    metaFontSize: 18,
    solve: { columnCount: 1, columnGapInches: 0.25, columnWidthInches: 6.20, font: 16, leftInches: 6.55 },
    thickPt: 5.0,
    thinPt: 1.0,
    titleFontSize: 26,
    titleHeightInches: 0.70,
    value: { font: 44, heightFraction: 0.72, topFraction: 0.28 }
  },
  6: {
    axisFont: 22,
    axisLabelHeight: 0.32,
    axisLabelWidth: 0.28,
    axisSideOffset: 0.34,
    axisTopOffset: 0.41,
    cage: { boxHeightFraction: 0.30, boxWidthFraction: 0.65, font: 22, insetLeftFraction: 0.07, insetTopFraction: 0.05 },
    candidates: { digitMargin: 5, font: 19, heightFraction: 0.65, leftFraction: 0.07, topFraction: 0.33, widthFraction: 0.86 },
    gridLeftInches: 0.65,
    gridSizeInches: 5.70,
    gridTopInches: 1.15,
    metaFontSize: 16,
    solve: { columnCount: 1, columnGapInches: 0.25, columnWidthInches: 5.90, font: 16, leftInches: 6.85 },
    thickPt: 6.5,
    thinPt: 1.0,
    titleFontSize: 24,
    titleHeightInches: 0.65,
    value: { font: 38, heightFraction: 0.75, topFraction: 0.25 }
  },
  7: {
    axisFont: 28,
    axisLabelHeight: 0.40,
    axisLabelWidth: 0.35,
    axisSideOffset: 0.42,
    axisTopOffset: 0.49,
    cage: { boxHeightFraction: 0.28, boxWidthFraction: 0.65, font: 20, insetLeftFraction: 0.07, insetTopFraction: 0.05 },
    candidates: { digitMargin: 1, font: 18, heightFraction: 0.67, leftFraction: 0.08, topFraction: 0.31, widthFraction: 0.84 },
    gridLeftInches: 0.65,
    gridSizeInches: 6.05,
    gridTopInches: 1.10,
    metaFontSize: 14,
    solve: { columnCount: 1, columnGapInches: 0.25, columnWidthInches: 5.70, font: 16, leftInches: 7.05 },
    thickPt: 6.5,
    thinPt: 1.0,
    titleFontSize: 22,
    titleHeightInches: 0.55,
    value: { font: 32, heightFraction: 0.77, topFraction: 0.23 }
  },
  8: {
    axisFont: 28,
    axisLabelHeight: 0.40,
    axisLabelWidth: 0.35,
    axisSideOffset: 0.42,
    axisTopOffset: 0.49,
    cage: { boxHeightFraction: 0.26, boxWidthFraction: 0.65, font: 18, insetLeftFraction: 0.07, insetTopFraction: 0.05 },
    candidates: { digitMargin: 1, font: 17, heightFraction: 0.69, leftFraction: 0.08, topFraction: 0.29, widthFraction: 0.84 },
    gridLeftInches: 0.65,
    gridSizeInches: 6.20,
    gridTopInches: 1.10,
    metaFontSize: 14,
    solve: { columnCount: 1, columnGapInches: 0.25, columnWidthInches: 5.60, font: 16, leftInches: 7.15 },
    thickPt: 6.5,
    thinPt: 1.0,
    titleFontSize: 22,
    titleHeightInches: 0.55,
    value: { font: 30, heightFraction: 0.78, topFraction: 0.22 }
  },
  9: {
    axisFont: 28,
    axisLabelHeight: 0.40,
    axisLabelWidth: 0.35,
    axisSideOffset: 0.42,
    axisTopOffset: 0.49,
    cage: { boxHeightFraction: 0.24, boxWidthFraction: 0.70, font: 16, insetLeftFraction: 0.07, insetTopFraction: 0.05 },
    candidates: { digitMargin: 0, font: 14, heightFraction: 0.71, leftFraction: 0.09, topFraction: 0.27, widthFraction: 0.88 },
    gridLeftInches: 0.65,
    gridSizeInches: 6.30,
    gridTopInches: 1.10,
    metaFontSize: 14,
    solve: { columnCount: 1, columnGapInches: 0.25, columnWidthInches: 5.50, font: 16, leftInches: 7.25 },
    thickPt: 6.5,
    thinPt: 1.0,
    titleFontSize: 22,
    titleHeightInches: 0.55,
    value: { font: 28, heightFraction: 0.80, topFraction: 0.20 }
  }
};
/* eslint-enable no-magic-numbers -- End layout profiles. */

export function clamp(value: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, value));
}

export function fitFontSize(text: string, basePt: number, boxWidthIn: number, boxHeightIn: number): number {
  const trimmedText = text.trim();
  if (!trimmedText) {
    return basePt;
  }
  const maxWidthPt = Math.max(1, boxWidthIn * POINTS_PER_INCH - FONT_FIT_PADDING_PT);
  const maxHeightPt = Math.max(1, boxHeightIn * POINTS_PER_INCH - 1);
  const charCount = Math.max(1, trimmedText.length);
  const widthBased = Math.floor(maxWidthPt / (FONT_FIT_WIDTH_RATIO * charCount));
  const heightBased = Math.floor(maxHeightPt / FONT_FIT_HEIGHT_RATIO);
  return Math.max(MIN_FONT_SIZE, Math.min(basePt, widthBased, heightBased));
}

export function formatCandidates(values: readonly number[], puzzleSize: number): string {
  const valueSet = new Set(values);
  const firstRowCount = Math.ceil(puzzleSize / CANDIDATE_ROW_COUNT);
  let line1 = '';
  let line2 = '';
  for (let d = 1; d <= puzzleSize; d++) {
    const ch = valueSet.has(d) ? String(d) : ' ';
    if (d <= firstRowCount) {
      line1 += ch;
    } else {
      line2 += ch;
    }
  }
  return `${line1}\n${line2}`;
}

export function getLayoutProfile(puzzleSize: number): LayoutProfile {
  const profile = LAYOUT_PROFILES[puzzleSize];
  return ensureNonNullable(profile, `Unsupported puzzle size: ${String(puzzleSize)}`);
}

export function in2pt(inches: number): number {
  return inches * POINTS_PER_INCH;
}

export function opSymbol(op: Operator): string {
  switch (op) {
    case Operator.Divide:
      return '/';
    case Operator.Minus:
      return '\u2212';
    case Operator.Plus:
      return '+';
    case Operator.Times:
      return 'x';
    case Operator.Unknown:
    default:
      return '?';
  }
}

export function pt(x: number): number {
  return Math.round(x);
}
