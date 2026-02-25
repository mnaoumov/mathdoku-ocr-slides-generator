import { z } from 'zod';

import { slideSnapshotSchema } from '../SvgRenderer.ts';

const STORAGE_PREFIX = 'mathdoku_';
const STATE_SUFFIX = '_state';
const SLIDES_SUFFIX = '_slides';
const HISTORY_SUFFIX = '_history';
const MANUAL_NOTES_SUFFIX = '_manualNotes';
const SLIDE_NOTES_SUFFIX = '_slideNotes';

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- inferred pipe type is complex
function jsonParsed<T extends z.ZodType>(schema: T) {
  return z.string().transform((s: string): unknown => JSON.parse(s)).pipe(schema);
}

const savedPuzzleStateSchema = z.object({
  candidates: z.record(z.string(), z.array(z.number())),
  values: z.record(z.string(), z.number())
});

const historyEntrySchema = z.object({
  cellState: savedPuzzleStateSchema,
  previousLastNote: z.string().optional(),
  slideCount: z.number()
});

const historyJsonSchema = jsonParsed(z.array(historyEntrySchema));
const manualNotesJsonSchema = jsonParsed(z.array(z.string()));
const slideNotesJsonSchema = jsonParsed(z.array(z.string()));
const slidesJsonSchema = jsonParsed(z.array(slideSnapshotSchema));
const stateJsonSchema = jsonParsed(savedPuzzleStateSchema);

export type HistoryEntry = z.infer<typeof historyEntrySchema>;

export type SavedPuzzleState = z.infer<typeof savedPuzzleStateSchema>;

export interface StorageData {
  readonly history: readonly HistoryEntry[];
  readonly manualNotes: readonly string[];
  readonly slideNotes: readonly string[];
  readonly slides: readonly z.infer<typeof slideSnapshotSchema>[];
  readonly state: SavedPuzzleState;
}

export function clearState(puzzleTitle: string): void {
  localStorage.removeItem(storageKey(puzzleTitle, STATE_SUFFIX));
  localStorage.removeItem(storageKey(puzzleTitle, SLIDES_SUFFIX));
  localStorage.removeItem(storageKey(puzzleTitle, HISTORY_SUFFIX));
  localStorage.removeItem(storageKey(puzzleTitle, MANUAL_NOTES_SUFFIX));
  localStorage.removeItem(storageKey(puzzleTitle, SLIDE_NOTES_SUFFIX));
}

export function loadState(puzzleTitle: string): null | StorageData {
  const stateJson = localStorage.getItem(storageKey(puzzleTitle, STATE_SUFFIX));
  const slidesJson = localStorage.getItem(storageKey(puzzleTitle, SLIDES_SUFFIX));
  const historyJson = localStorage.getItem(storageKey(puzzleTitle, HISTORY_SUFFIX));
  const manualNotesJson = localStorage.getItem(storageKey(puzzleTitle, MANUAL_NOTES_SUFFIX));
  const slideNotesJson = localStorage.getItem(storageKey(puzzleTitle, SLIDE_NOTES_SUFFIX));
  if (!stateJson || !slidesJson) {
    return null;
  }
  return {
    history: historyJson ? historyJsonSchema.parse(historyJson) : [],
    manualNotes: manualNotesJson ? manualNotesJsonSchema.parse(manualNotesJson) : [],
    slideNotes: slideNotesJson ? slideNotesJsonSchema.parse(slideNotesJson) : [],
    slides: slidesJsonSchema.parse(slidesJson),
    state: stateJsonSchema.parse(stateJson)
  };
}

export function saveState(puzzleTitle: string, data: StorageData): void {
  try {
    localStorage.setItem(storageKey(puzzleTitle, STATE_SUFFIX), JSON.stringify(data.state));
    localStorage.setItem(storageKey(puzzleTitle, SLIDES_SUFFIX), JSON.stringify(data.slides));
    localStorage.setItem(storageKey(puzzleTitle, HISTORY_SUFFIX), JSON.stringify(data.history));
    localStorage.setItem(storageKey(puzzleTitle, MANUAL_NOTES_SUFFIX), JSON.stringify(data.manualNotes));
    localStorage.setItem(storageKey(puzzleTitle, SLIDE_NOTES_SUFFIX), JSON.stringify(data.slideNotes));
  } catch {
    // LocalStorage full or unavailable — silently ignore
  }
}

function storageKey(puzzleTitle: string, suffix: string): string {
  return STORAGE_PREFIX + puzzleTitle + suffix;
}
