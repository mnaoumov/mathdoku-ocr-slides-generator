import type {
  CageRaw,
  PuzzleRenderer
} from '../src/Puzzle.ts';
import type { Strategy } from '../src/strategies/Strategy.ts';

import {
  Operator,
  Puzzle
} from '../src/Puzzle.ts';

export interface CreateTestPuzzleParams {
  readonly cages: readonly CageRaw[];
  readonly hasOperators: boolean;
  readonly initialCandidates?: Map<string, Set<number>>;
  readonly initialValues?: Map<string, number>;
  readonly puzzleSize: number;
  readonly renderer?: PuzzleRenderer;
  readonly strategies?: readonly Strategy[];
}

export class TrackingRenderer implements PuzzleRenderer {
  public isLastSlide = true;
  public readonly notesBySlide: string[] = [];
  public get slideCount(): number {
    return this.currentSlide + 1;
  }

  private currentSlide = 0;

  private noteText = '';

  public beginPendingRender(): void {
    this.recordNote();
  }

  public ensureLastSlide(): boolean {
    return this.isLastSlide;
  }

  public renderCommittedChanges(): void {
    this.recordNote();
  }

  public renderPendingCandidates(): void {
    // No-op
  }

  public renderPendingClearance(): void {
    // No-op
  }

  public renderPendingStrikethrough(): void {
    // No-op
  }

  public renderPendingValue(): void {
    // No-op
  }

  public setNoteText(text: string): void {
    this.noteText = text;
  }

  private recordNote(): void {
    if (this.noteText) {
      this.notesBySlide[this.currentSlide] = this.noteText;
    }
    this.currentSlide++;
  }
}

const CHAR_CODE_A = 65;

export function createTestPuzzle(options: CreateTestPuzzleParams): Puzzle {
  return new Puzzle({
    cages: options.cages,
    hasOperators: options.hasOperators,
    meta: 'test',
    puzzleSize: options.puzzleSize,
    renderer: options.renderer ?? new TrackingRenderer(),
    strategies: options.strategies ?? [],
    title: 'Test Puzzle',
    ...options.initialCandidates !== undefined && { initialCandidates: options.initialCandidates },
    ...options.initialValues !== undefined && { initialValues: options.initialValues }
  });
}

export function fillRemainingCells(cages: readonly CageRaw[], puzzleSize: number): CageRaw[] {
  const covered = new Set<string>();
  for (const cage of cages) {
    for (const ref of cage.cells) {
      covered.add(ref);
    }
  }
  const result = [...cages];
  for (let row = 1; row <= puzzleSize; row++) {
    for (let col = 1; col <= puzzleSize; col++) {
      const ref = String.fromCharCode(CHAR_CODE_A + col - 1) + String(row);
      if (!covered.has(ref)) {
        result.push({ cells: [ref], operator: Operator.Unknown, value: 1 });
      }
    }
  }
  return result;
}
