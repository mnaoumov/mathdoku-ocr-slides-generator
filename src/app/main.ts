import yaml from 'js-yaml';
import { z } from 'zod';

import type { PuzzleJson } from '../Puzzle.ts';

import 'reveal.js/dist/reveal.css';
import 'reveal.js/dist/theme/white.css';

import {
  initPuzzleSlides,
  parsePuzzleJson,
  Puzzle
} from '../Puzzle.ts';
import {
  buildPuzzleJson,
  type YamlSpec
} from '../puzzleYamlParser.ts';
import {
  buildSolutionYaml,
  parseSolutionYaml,
  puzzleJsonFromSolution,
  replaySolution
} from '../SolutionYaml.ts';
import {
  createInitialStrategies,
  createStrategies
} from '../strategies/createDefaultStrategies.ts';
import {
  getSolveNotesRect,
  type SolveNotesRect,
  SvgRenderer
} from '../SvgRenderer.ts';
import { EditPanel } from './EditPanel.ts';
import { exportPresentation } from './ExportService.ts';
import {
  addSlides,
  initializeReveal,
  navigateToFirst,
  navigateToLast,
  removeAfter
} from './RevealApp.ts';
import {
  type HistoryEntry,
  type SavedPuzzleState,
  saveState
} from './StorageService.ts';

const SOLVE_NOTES_OVERLAY_CLASS = 'solve-notes-overlay';
const SVG_NS = 'http://www.w3.org/2000/svg';
const XHTML_NS = 'http://www.w3.org/1999/xhtml';

function addSolveNotesOverlay(svg: SVGSVGElement, slideIndex: number, rect: SolveNotesRect): void {
  const fo = document.createElementNS(SVG_NS, 'foreignObject');
  fo.classList.add(SOLVE_NOTES_OVERLAY_CLASS);
  fo.setAttribute('x', String(rect.left));
  fo.setAttribute('y', String(rect.top));
  fo.setAttribute('width', String(rect.width));
  fo.setAttribute('height', String(rect.height));

  const textarea = document.createElementNS(XHTML_NS, 'textarea');
  textarea.setAttribute('class', 'solve-notes-textarea');
  textarea.setAttribute('style', `font-size: ${String(rect.font)}px`);
  (textarea as unknown as HTMLTextAreaElement).value = manualNotes[slideIndex] ?? '';

  textarea.addEventListener('input', () => {
    manualNotes[slideIndex] = (textarea as unknown as HTMLTextAreaElement).value;
    autoSave();
  });

  fo.appendChild(textarea);
  svg.appendChild(fo);
}

function addSolveNotesOverlays(startIndex: number): void {
  if (!currentSolveNotesRect) {
    return;
  }
  const sections = document.querySelectorAll('.reveal .slides > section');
  for (let i = startIndex; i < sections.length; i++) {
    const section = sections[i];
    if (!section) {
      continue;
    }
    const svg = section.querySelector('svg');
    if (!svg || svg.querySelector(`.${SOLVE_NOTES_OVERLAY_CLASS}`)) {
      continue;
    }
    addSolveNotesOverlay(svg, i, currentSolveNotesRect);
  }
}

let currentPuzzle: null | Puzzle = null;
let currentRenderer: null | SvgRenderer = null;
let currentSolveNotesRect: null | SolveNotesRect = null;
let currentTitle = '';
let historyStack: HistoryEntry[] = [];
let manualNotes: string[] = [];
const editPanel = new EditPanel();

function autoSave(): void {
  if (!currentRenderer || !currentTitle) {
    return;
  }
  const state = currentPuzzle ? extractCellState(currentPuzzle) : { candidates: {}, values: {} };
  saveState(currentTitle, {
    history: historyStack,
    manualNotes,
    slides: currentRenderer.slides,
    state
  });
}

function extractCellState(puzzle: Puzzle): SavedPuzzleState {
  const values: Record<string, number> = {};
  const candidates: Record<string, number[]> = {};
  for (const cell of puzzle.cells) {
    if (cell.value === null) {
      const cands = cell.getCandidates();
      if (cands.length > 0) {
        candidates[cell.ref] = cands;
      }
    } else {
      values[cell.ref] = cell.value;
    }
  }
  return { candidates, values };
}

function handleUndo(): void {
  if (historyStack.length === 0 || !currentRenderer || !currentPuzzle) {
    return;
  }

  const entry = historyStack.pop();
  if (!entry) {
    return;
  }

  // Remove slides added by the last action
  removeAfter(entry.slideCount - 1);

  // Remove slides from renderer and truncate notes
  currentRenderer.slides.length = entry.slideCount;
  manualNotes.length = entry.slideCount;

  // Rebuild puzzle from saved cell state
  const puzzleJson = currentPuzzleJson;
  if (!puzzleJson) {
    return;
  }

  const values = new Map<string, number>();
  const candidates = new Map<string, Set<number>>();
  for (const [ref, v] of Object.entries(entry.cellState.values)) {
    values.set(ref, v);
  }
  for (const [ref, cands] of Object.entries(entry.cellState.candidates)) {
    candidates.set(ref, new Set(cands));
  }

  currentPuzzle = new Puzzle({
    cages: puzzleJson.cages,
    hasOperators: puzzleJson.hasOperators ?? true,
    initialCandidates: candidates,
    initialValues: values,
    meta: puzzleJson.meta ?? '',
    puzzleSize: puzzleJson.puzzleSize,
    renderer: currentRenderer,
    strategies: createStrategies(puzzleJson.puzzleSize),
    title: puzzleJson.title ?? ''
  });

  // Sync renderer's visual state with the restored puzzle state
  currentRenderer.restoreCellStates(currentPuzzle.cells);

  editPanel.init(currentPuzzle, currentRenderer, { onActionComplete });
  editPanel.updateCellOverlays();

  autoSave();
}

function onActionComplete(slidesBefore: number): void {
  if (!currentRenderer || !currentPuzzle) {
    return;
  }

  // Save undo point
  historyStack.push({
    cellState: extractCellState(currentPuzzle),
    slideCount: slidesBefore
  });

  // Add new slides and populate manualNotes from slide notes
  const newSlides = currentRenderer.slides.slice(slidesBefore);
  for (const slide of newSlides) {
    manualNotes.push(slide.notes);
  }
  addSlides(newSlides);
  addSolveNotesOverlays(slidesBefore);

  // Update cell click handlers
  editPanel.updateCellOverlays();

  autoSave();
}

let currentPuzzleJson: null | PuzzleJson = null;

function initFromPuzzleJson(puzzleJson: PuzzleJson): void {
  currentPuzzleJson = puzzleJson;
  currentTitle = puzzleJson.title ?? 'Mathdoku';
  historyStack = [];
  currentSolveNotesRect = getSolveNotesRect(puzzleJson.puzzleSize);

  const renderer = new SvgRenderer();
  renderer.initGrid(
    puzzleJson.puzzleSize,
    puzzleJson.cages,
    puzzleJson.hasOperators ?? true,
    puzzleJson.title ?? '',
    puzzleJson.meta ?? ''
  );
  currentRenderer = renderer;
  renderer.pushInitialSlide();

  const puzzle = initPuzzleSlides({
    cages: puzzleJson.cages,
    hasOperators: puzzleJson.hasOperators !== false,
    initialStrategies: createInitialStrategies(),
    meta: puzzleJson.meta ?? '',
    puzzleSize: puzzleJson.puzzleSize,
    renderer,
    strategies: createStrategies(puzzleJson.puzzleSize),
    title: puzzleJson.title ?? ''
  });
  currentPuzzle = puzzle;

  // Auto-populate manualNotes from slide notes (strategy descriptions on pending, empty on committed)
  manualNotes = renderer.slides.map((slide) => slide.notes);

  initializeReveal(renderer.slides).then(() => {
    editPanel.init(puzzle, renderer, { onActionComplete });
    editPanel.updateCellOverlays();
    addSolveNotesOverlays(0);
    autoSave();
  }).catch((e: unknown) => {
    console.error('Failed to initialize Reveal.js', e);
  });
}

function loadYaml(content: string, name: string): void {
  const spec = yaml.load(content) as YamlSpec;
  const puzzleJson = buildPuzzleJson(spec, name);
  const validated = parsePuzzleJson(puzzleJson);
  showAppContainer();
  initFromPuzzleJson(validated);
}

function setupFileInput(): void {
  const fileInput = document.getElementById('yaml-input') as HTMLInputElement | null;
  if (!fileInput) {
    return;
  }
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = (): void => {
      try {
        loadYaml(reader.result as string, file.name.replace(/\.yaml$/i, ''));
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        // eslint-disable-next-line no-alert -- Browser alert for user-facing error
        alert(`Error loading YAML: ${message}`);
      }
    };
    reader.readAsText(file);
  });
}

function setupKeyboardShortcuts(): void {
  document.addEventListener('keydown', (e: KeyboardEvent) => {
    // Don't intercept when typing in input fields
    const tag = (e.target as HTMLElement).tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') {
      return;
    }

    if (e.key === 'e' || e.key === 'E') {
      e.preventDefault();
      if (editPanel.isOpen()) {
        editPanel.close();
      } else {
        editPanel.open();
      }
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
      e.preventDefault();
      handleUndo();
    }

    if (e.key === 'Home') {
      e.preventDefault();
      navigateToFirst();
    }

    if (e.key === 'End') {
      e.preventDefault();
      navigateToLast();
    }
  });
}

function setupToolbar(): void {
  const firstBtn = document.getElementById('btn-first');
  if (firstBtn) {
    firstBtn.addEventListener('click', () => {
      navigateToFirst();
    });
  }

  const lastBtn = document.getElementById('btn-last');
  if (lastBtn) {
    lastBtn.addEventListener('click', () => {
      navigateToLast();
    });
  }

  const exportBtn = document.getElementById('btn-export');
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      if (currentRenderer && currentSolveNotesRect) {
        exportPresentation({
          manualNotes,
          slides: currentRenderer.slides,
          solveNotesRect: currentSolveNotesRect,
          title: currentTitle
        });
      }
    });
  }

  const saveYamlBtn = document.getElementById('btn-save-yaml');
  if (saveYamlBtn) {
    saveYamlBtn.addEventListener('click', () => {
      handleSaveYaml();
    });
  }

  const editBtn = document.getElementById('btn-edit');
  if (editBtn) {
    editBtn.addEventListener('click', () => {
      if (editPanel.isOpen()) {
        editPanel.close();
      } else {
        editPanel.open();
      }
    });
  }

  const undoBtn = document.getElementById('btn-undo');
  if (undoBtn) {
    undoBtn.addEventListener('click', () => {
      handleUndo();
    });
  }
}

function showAppContainer(): void {
  const picker = document.getElementById('file-picker');
  if (picker) {
    picker.classList.add('hidden');
  }
  const appContainer = document.getElementById('app-container');
  if (appContainer) {
    appContainer.classList.remove('hidden');
  }
}

const solutionApiResponseSchema = z.object({
  content: z.string(),
  name: z.string()
});

function handleSaveYaml(): void {
  if (!currentRenderer || !currentPuzzleJson) {
    return;
  }
  const yamlContent = buildSolutionYaml({
    hasOperators: currentPuzzleJson.hasOperators !== false,
    manualNotes,
    puzzleJson: currentPuzzleJson,
    slides: currentRenderer.slides
  });
  const blob = new Blob([yamlContent], { type: 'application/x-yaml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${currentTitle}.solution.yaml`;
  a.click();
  URL.revokeObjectURL(url);
}

function initFromSolution(content: string): void {
  const solution = parseSolutionYaml(content);
  const puzzleJson = puzzleJsonFromSolution(solution);

  currentPuzzleJson = puzzleJson;
  currentTitle = puzzleJson.title ?? 'Mathdoku';
  historyStack = [];
  currentSolveNotesRect = getSolveNotesRect(puzzleJson.puzzleSize);

  const renderer = new SvgRenderer();
  renderer.initGrid(
    puzzleJson.puzzleSize,
    puzzleJson.cages,
    puzzleJson.hasOperators ?? true,
    puzzleJson.title ?? '',
    puzzleJson.meta ?? ''
  );
  currentRenderer = renderer;
  renderer.pushInitialSlide();

  const result = replaySolution({
    puzzleJson,
    renderer,
    steps: solution.steps
  });

  manualNotes = result.manualNotes;
  currentPuzzle = result.puzzle;

  initializeReveal(renderer.slides).then(() => {
    editPanel.init(result.puzzle, renderer, { onActionComplete });
    editPanel.updateCellOverlays();
    addSolveNotesOverlays(0);
    autoSave();
  }).catch((e: unknown) => {
    console.error('Failed to initialize Reveal.js', e);
  });
}

async function tryLoadSolutionFromServer(): Promise<boolean> {
  try {
    const response = await fetch('/api/solution');
    if (!response.ok) {
      return false;
    }
    const data = solutionApiResponseSchema.parse(await response.json());
    showAppContainer();
    initFromSolution(data.content);
    return true;
  } catch {
    return false;
  }
}

// Global error handlers — surface unhandled errors via alert
window.addEventListener('error', (e) => {
  // eslint-disable-next-line no-alert -- Browser alert for unhandled error
  alert(e.message);
});
window.addEventListener('unhandledrejection', (e) => {
  const message = e.reason instanceof Error ? e.reason.message : String(e.reason);
  // eslint-disable-next-line no-alert -- Browser alert for unhandled rejection
  alert(message);
});

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  setupKeyboardShortcuts();
  setupToolbar();

  // If started via `npm run edit-solution`, solution is served at /api/solution
  tryLoadSolutionFromServer().then((loaded) => {
    if (!loaded) {
      setupFileInput();
    }
  }).catch(() => {
    setupFileInput();
  });
});
