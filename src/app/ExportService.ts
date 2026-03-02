import type {
  SlideSnapshot,
  SolveNotesRect
} from '../SvgRenderer.ts';

import { buildSolveNotesForeignObject } from '../SvgRenderer.ts';

// Exported HTML files use CDN for portability (self-contained single file)
const REVEAL_CDN = 'https://cdn.jsdelivr.net/npm/reveal.js@5';
const REVEAL_DIST = `${REVEAL_CDN}/dist`;
// Avoid literal </script> inside template literal (would prematurely close the outer script)
const CLOSE_SCRIPT = ['<', '/script>'].join('');
const MUSIC_URL = 'https://github.com/mnaoumov/mathdoku-ocr-slides-generator/raw/refs/heads/master/assets/music.mp3';
const SVG_CLOSE_TAG = '</svg>';

export interface ExportParams {
  readonly manualNotes: readonly string[];
  readonly slides: readonly SlideSnapshot[];
  readonly solveNotesRect: SolveNotesRect;
  readonly title: string;
}

export function exportPresentation(options: ExportParams): void {
  const html = generateHtml(options);

  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${options.title}.html`;
  a.click();
  URL.revokeObjectURL(url);
}

export function generateHtml(options: ExportParams): string {
  const { manualNotes, slides, solveNotesRect, title } = options;
  const slidesHtml = slides.map((slide, index) => {
    let svg = slide.svg;
    const manualText = manualNotes[index] ?? '';
    if (manualText.trim()) {
      const foreignObject = buildSolveNotesForeignObject(manualText, solveNotesRect);
      svg = svg.replace(SVG_CLOSE_TAG, `${foreignObject}${SVG_CLOSE_TAG}`);
    }
    return `<section>${svg}</section>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>${escapeHtml(title)}</title>
<link rel="stylesheet" href="${REVEAL_DIST}/reveal.css"/>
<link rel="stylesheet" href="${REVEAL_DIST}/theme/white.css"/>
<style>
.reveal .slides section { padding: 0; }
.reveal .slides svg { max-width: 100%; max-height: 100%; }
.cell-overlay { fill: none; }
.clickable-label { pointer-events: none; }
</style>
</head>
<body>
<div class="reveal">
<div class="slides">
${slidesHtml}
</div>
</div>
<script src="${REVEAL_DIST}/reveal.js">${CLOSE_SCRIPT}
<script>
Reveal.initialize({
  controls: true,
  hash: true,
  height: 540,
  mouseWheel: true,
  slideNumber: true,
  transition: 'none',
  width: 960
}).then(function() {
  var audio = new Audio("${MUSIC_URL}");
  audio.loop = true;
  function tryPlay() {
    audio.play().then(function() {
      document.removeEventListener('click', tryPlay);
      document.removeEventListener('keydown', tryPlay);
    }).catch(function() {});
  }
  document.addEventListener('click', tryPlay);
  document.addEventListener('keydown', tryPlay);
});
${CLOSE_SCRIPT}
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
