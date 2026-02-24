/// <reference lib="dom" />

interface RevertState {
  lastSlideNotes: string;
  nextStrategyName?: string;
  slideCount: number;
}

type StepResult = StepResultApplied | StepResultSkipped;

interface StepResultApplied {
  applied: true;
  message?: string;
  nextStrategyName?: string;
  slideNumber: number;
  strategyName: string;
}

interface StepResultSkipped {
  applied: false;
  nextStrategyName?: string;
  strategyName: string;
}

const cancelBtn = document.getElementById('cancelBtn') as HTMLButtonElement;
const closeBtn = document.getElementById('closeBtn') as HTMLButtonElement;
const logEl = document.getElementById('log') as HTMLDivElement;
const summaryEl = document.getElementById('summary') as HTMLDivElement;

let activeEntry: HTMLDivElement | null = null;
let cancelled = false;
let currentSpinner: HTMLDivElement | null = null;
let isInit = false;
let nextStrategyName: null | string = null;
let revertState: null | RevertState = null;
let stepCount = 0;

function addLogEntry(text: string, className: string): HTMLDivElement {
  if (activeEntry) {
    activeEntry.className = 'log-entry done';
  }
  const entry = document.createElement('div');
  entry.className = `log-entry ${className}`;
  entry.textContent = text;
  logEl.appendChild(entry);
  logEl.scrollTop = logEl.scrollHeight;
  if (className === 'active') {
    activeEntry = entry;
  }
  return entry;
}

function cancelOperation(): void {
  cancelled = true;
  cancelBtn.disabled = true;
  cancelBtn.textContent = 'Cancelling...';
  if (currentSpinner) {
    currentSpinner.remove();
    currentSpinner = null;
  }
  if (revertState) {
    finishActiveEntry();
    addLogEntry('Reverting changes...', 'active');
    google.script.run
      .withSuccessHandler(() => {
        finishActiveEntry();
        addLogEntry('Changes reverted', 'done');
        summaryEl.textContent = `Cancelled after ${String(stepCount)} step${stepCount === 1 ? '' : 's'}.`;
        cancelBtn.style.display = 'none';
        closeBtn.style.display = '';
      })
      .withFailureHandler((err: Error) => {
        finishActiveEntry();
        addLogEntry(`Revert failed: ${err.message}`, 'error');
        cancelBtn.style.display = 'none';
        closeBtn.style.display = '';
      })
      .revertOperation(revertState.slideCount, revertState.lastSlideNotes);
  } else {
    summaryEl.textContent = 'Cancelled.';
    cancelBtn.style.display = 'none';
    closeBtn.style.display = '';
  }
}

function doGridSetup(puzzleJson: string): void {
  addLogEntry('Creating puzzle grid...', 'active');
  google.script.run
    .withSuccessHandler((slideNumber: number) => {
      if (activeEntry) {
        activeEntry.textContent = `Slide ${String(slideNumber)}: Creating puzzle grid...`;
      }
      finishActiveEntry();
      startChunks();
    })
    .withFailureHandler(onError)
    .initGridSetup(puzzleJson);
}

function finishActiveEntry(): void {
  if (activeEntry) {
    activeEntry.className = 'log-entry done';
    activeEntry = null;
  }
}

function onError(err: Error): void {
  if (currentSpinner) {
    currentSpinner.remove();
    currentSpinner = null;
  }
  finishActiveEntry();
  addLogEntry(`Error: ${err.message}`, 'error');
  summaryEl.textContent = 'An error occurred.';
  cancelBtn.style.display = 'none';
  closeBtn.style.display = '';
}

function runChunks(): void {
  if (cancelled) {
    return;
  }
  if (!nextStrategyName) {
    showDone();
    return;
  }
  const entry = document.createElement('div');
  entry.className = 'log-entry active';
  entry.textContent = `Testing: ${nextStrategyName}...`;
  logEl.appendChild(entry);
  logEl.scrollTop = logEl.scrollHeight;
  currentSpinner = entry;
  google.script.run
    .withSuccessHandler((result: StepResult) => {
      currentSpinner = null;
      if (cancelled) {
        entry.remove();
        return;
      }
      if (result.applied) {
        stepCount++;
        const startSlide = result.slideNumber - 1;
        entry.textContent = `Slide ${String(startSlide)}-${String(result.slideNumber)}: ${result.message ?? `Step ${String(stepCount)}`}`;
        entry.className = 'log-entry done';
      } else {
        entry.textContent = result.strategyName;
        entry.className = 'log-entry skipped';
      }
      logEl.scrollTop = logEl.scrollHeight;
      nextStrategyName = result.nextStrategyName ?? null;
      runChunks();
    })
    .withFailureHandler((err: Error) => {
      currentSpinner = null;
      entry.remove();
      onError(err);
    })
    .applyOneStep();
}

function showDone(): void {
  finishActiveEntry();
  summaryEl.textContent = `Done (${String(stepCount)} step${stepCount === 1 ? '' : 's'}).`;
  cancelBtn.style.display = 'none';
  closeBtn.style.display = '';
  if (isInit) {
    google.script.run
      .withFailureHandler(() => {
        // Ignored: finishInit errors are non-critical
      })
      .finishInit();
  }
}

function startChunks(): void {
  google.script.run
    .withSuccessHandler((state: RevertState) => {
      revertState = state;
      nextStrategyName = state.nextStrategyName ?? null;
      runChunks();
    })
    .withFailureHandler(onError)
    .getRevertState();
}

cancelBtn.addEventListener('click', cancelOperation);

closeBtn.addEventListener('click', () => {
  google.script.host.close();
});

google.script.run
  .withSuccessHandler((gridSetup: boolean) => {
    isInit = gridSetup;
    if (gridSetup) {
      google.script.run
        .withSuccessHandler((json: string) => {
          doGridSetup(json);
        })
        .withFailureHandler(onError)
        .getPuzzleJsonFromCache();
    } else {
      startChunks();
    }
  })
  .withFailureHandler(onError)
  .needsGridSetup();
