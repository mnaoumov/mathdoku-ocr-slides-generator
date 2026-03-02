import type { Puzzle } from '../Puzzle.ts';
import type { SvgRenderer } from '../SvgRenderer.ts';

enum OperationMode {
  Candidates = 'candidates',
  Strikethrough = 'strikethrough',
  Value = 'value'
}

interface EditPanelCallbacks {
  onActionComplete(slidesBefore: number, command: string): void;
}

interface QueuedGroup {
  readonly cells: readonly string[];
  readonly mode: OperationMode;
  readonly values: readonly number[];
}

const PANEL_ID = 'edit-panel';
const SELECTED_CLASS = 'cell-selected';

export class EditPanel {
  private callbacks: EditPanelCallbacks | null = null;
  private currentMode: OperationMode = OperationMode.Candidates;
  private delegationAttached = false;
  private panel: HTMLElement | null = null;
  private puzzle: null | Puzzle = null;
  private queuedGroups: QueuedGroup[] = [];
  private renderer: null | SvgRenderer = null;
  private readonly selectedCells = new Set<string>();

  public close(): void {
    this.clearSelection();
    this.queuedGroups = [];
    if (this.panel) {
      this.panel.classList.add('hidden');
    }
    document.querySelector('.reveal')?.classList.remove('edit-active');
  }

  public init(puzzle: Puzzle, renderer: SvgRenderer, callbacks: EditPanelCallbacks): void {
    this.puzzle = puzzle;
    this.renderer = renderer;
    this.callbacks = callbacks;
    this.buildPanel();
  }

  public isOpen(): boolean {
    return this.panel !== null && !this.panel.classList.contains('hidden');
  }

  public open(): void {
    if (this.panel) {
      this.panel.classList.remove('hidden');
      this.queuedGroups = [];
      this.updateQueueDisplay();
    }
    document.querySelector('.reveal')?.classList.add('edit-active');
  }

  public updateCellOverlays(): void {
    this.ensureCellClickDelegation();
  }

  private addToQueue(): void {
    if (this.selectedCells.size === 0) {
      return;
    }

    const cells = [...this.selectedCells];
    const digitBtns = this.panel?.querySelectorAll('.btn-digit.selected') ?? [];
    const values = Array.from(digitBtns, (btn) => parseInt(btn.getAttribute('data-digit') ?? '0', 10));
    if (values.length === 0) {
      return;
    }

    this.queuedGroups.push({ cells, mode: this.currentMode, values });
    this.clearSelection();
    this.clearDigitSelection();
    this.updateQueueDisplay();
  }

  private buildCommandString(): string {
    const parts: string[] = [];
    for (const group of this.queuedGroups) {
      const cellPart = group.cells.length === 1
        ? group.cells[0]
        : `(${group.cells.join(' ')})`;

      let opPart: string;
      switch (group.mode) {
        case OperationMode.Candidates:
          opPart = group.values.join('');
          break;
        case OperationMode.Strikethrough:
          opPart = `-${group.values.join('')}`;
          break;
        case OperationMode.Value:
          opPart = `=${String(group.values[0])}`;
          break;
        default: {
          const exhaustive: never = group.mode;
          throw new Error(`Unknown mode: ${String(exhaustive)}`);
        }
      }
      parts.push(`${String(cellPart)}:${opPart}`);
    }

    return parts.join(' ');
  }

  private buildPanel(): void {
    let panel = document.getElementById(PANEL_ID);
    if (!panel) {
      panel = document.createElement('div');
      panel.id = PANEL_ID;
      panel.className = 'edit-panel hidden';
      document.body.appendChild(panel);
    }
    this.panel = panel;

    const puzzleSize = this.puzzle?.puzzleSize ?? 0;
    panel.innerHTML = `
      <div class="edit-panel-header">
        <h3>Edit Cells</h3>
        <button class="btn-close" id="edit-close">X</button>
      </div>
      <div class="edit-section edit-hint">Click cells on the grid to select them</div>
      <div class="edit-section">
        <label>Selection: <span id="edit-selection">None</span></label>
      </div>
      <div class="edit-section">
        <label>Operation:</label>
        <div class="btn-group">
          <button class="btn-mode active" data-mode="candidates">Candidates</button>
          <button class="btn-mode" data-mode="strikethrough">Strike</button>
          <button class="btn-mode" data-mode="value">Set Value</button>
        </div>
      </div>
      <div class="edit-section" id="digit-section">
        <label>Digits:</label>
        <div class="digit-grid">
          ${Array.from({ length: puzzleSize }, (_, i) => `<button class="btn-digit" data-digit="${String(i + 1)}">${String(i + 1)}</button>`).join('')}
        </div>
      </div>
      <div class="edit-section">
        <button class="btn-action" id="edit-add">Add to Queue</button>
      </div>
      <div class="edit-section">
        <label>Queue:</label>
        <div id="edit-queue" class="edit-queue"></div>
      </div>
      <div class="edit-section edit-actions">
        <button class="btn-submit" id="edit-submit">Submit</button>
        <button class="btn-cancel" id="edit-cancel">Cancel</button>
      </div>
    `;

    // Mode buttons
    for (const btn of panel.querySelectorAll('.btn-mode')) {
      btn.addEventListener('click', () => {
        for (const b of panel.querySelectorAll('.btn-mode')) {
          b.classList.remove('active');
        }
        btn.classList.add('active');
        this.currentMode = btn.getAttribute('data-mode') as OperationMode;
      });
    }

    // Digit toggles
    for (const btn of panel.querySelectorAll('.btn-digit')) {
      btn.addEventListener('click', () => {
        btn.classList.toggle('selected');
      });
    }

    // Add to queue
    const addBtn = panel.querySelector('#edit-add');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        this.addToQueue();
      });
    }

    // Submit
    const submitBtn = panel.querySelector('#edit-submit');
    if (submitBtn) {
      submitBtn.addEventListener('click', () => {
        this.submit();
      });
    }

    // Cancel
    const cancelBtn = panel.querySelector('#edit-cancel');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        this.close();
      });
    }

    // Close
    const closeBtn = panel.querySelector('#edit-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        this.close();
      });
    }
  }

  private clearDigitSelection(): void {
    if (!this.panel) {
      return;
    }
    for (const btn of this.panel.querySelectorAll('.btn-digit')) {
      btn.classList.remove('selected');
    }
  }

  private clearSelection(): void {
    this.selectedCells.clear();
    const overlays = document.querySelectorAll(`.${SELECTED_CLASS}`);
    for (const overlay of overlays) {
      overlay.classList.remove(SELECTED_CLASS);
    }
    this.updateSelectionDisplay();
  }

  private deselectCell(ref: string): void {
    this.selectedCells.delete(ref);
    const overlays = document.querySelectorAll(`.cell-overlay[data-cell="${ref}"]`);
    for (const overlay of overlays) {
      overlay.classList.remove(SELECTED_CLASS);
    }
  }

  private ensureCellClickDelegation(): void {
    if (this.delegationAttached) {
      return;
    }
    const container = document.querySelector('.reveal .slides');
    if (!container) {
      return;
    }
    this.delegationAttached = true;
    container.addEventListener('click', (e: Event) => {
      const target = e.target as Element;

      // Handle clickable labels (axis + cage)
      const label = target.closest('.clickable-label');
      if (label && this.isOpen()) {
        e.stopPropagation();
        const cells = label.getAttribute('data-cells')?.split(',') ?? [];
        const allSelected = cells.length > 0 && cells.every((c) => this.selectedCells.has(c));
        for (const cell of cells) {
          if (allSelected) {
            this.deselectCell(cell);
          } else {
            this.selectCell(cell);
          }
        }
        this.updateSelectionDisplay();
        return;
      }

      // Handle cell overlays
      const overlay = target.closest('.cell-overlay');
      if (!overlay) {
        return;
      }
      const cell = overlay.getAttribute('data-cell');
      if (cell) {
        e.stopPropagation();
        this.toggleCell(cell);
      }
    });
  }

  private selectCell(ref: string): void {
    this.selectedCells.add(ref);
    const overlays = document.querySelectorAll(`.cell-overlay[data-cell="${ref}"]`);
    for (const overlay of overlays) {
      overlay.classList.add(SELECTED_CLASS);
    }
  }

  private submit(): void {
    if (!this.puzzle || !this.renderer || !this.callbacks) {
      return;
    }

    // If there are selected cells with digits, add them to queue first
    if (this.selectedCells.size > 0) {
      this.addToQueue();
    }

    if (this.queuedGroups.length === 0) {
      return;
    }

    const slidesBefore = this.renderer.slideCount;
    const cmd = this.buildCommandString();

    try {
      this.puzzle.enter(cmd);
      this.puzzle.commit();
      this.puzzle.tryApplyAutomatedStrategies();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      // eslint-disable-next-line no-alert -- Browser alert for user-facing error
      alert(message);
      return;
    }

    this.queuedGroups = [];
    this.close();
    this.callbacks.onActionComplete(slidesBefore, cmd);
  }

  private toggleCell(ref: string): void {
    if (!this.isOpen()) {
      return;
    }
    if (this.selectedCells.has(ref)) {
      this.deselectCell(ref);
    } else {
      this.selectCell(ref);
    }
    this.updateSelectionDisplay();
  }

  private updateQueueDisplay(): void {
    const queueEl = this.panel?.querySelector('#edit-queue');
    if (!queueEl) {
      return;
    }
    if (this.queuedGroups.length === 0) {
      queueEl.textContent = 'Empty';
      return;
    }
    queueEl.innerHTML = this.queuedGroups.map((g) => {
      const cellStr = g.cells.join(', ');
      const valStr = g.values.join('');
      return `<div class="queue-item">${g.mode}: ${cellStr} = ${valStr}</div>`;
    }).join('');
  }

  private updateSelectionDisplay(): void {
    const el = this.panel?.querySelector('#edit-selection');
    if (el) {
      el.textContent = this.selectedCells.size === 0
        ? 'None'
        : [...this.selectedCells].join(', ');
    }
  }
}
