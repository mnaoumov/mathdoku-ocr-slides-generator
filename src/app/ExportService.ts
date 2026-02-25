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
const MUSIC_BASE64_PATH = '/music.b64';
const SVG_CLOSE_TAG = '</svg>';

export interface ExportOptions {
  readonly manualNotes: readonly string[];
  readonly slideNotes: readonly string[];
  readonly slides: readonly SlideSnapshot[];
  readonly solveNotesRect: SolveNotesRect;
  readonly title: string;
}

export async function exportPresentation(options: ExportOptions): Promise<void> {
  const { manualNotes, slideNotes, slides, solveNotesRect, title } = options;
  const slidesHtml = slides.map((slide, index) => {
    let svg = slide.svg;
    const manualText = manualNotes[index] ?? '';
    if (manualText.trim()) {
      const foreignObject = buildSolveNotesForeignObject(manualText, solveNotesRect);
      svg = svg.replace(SVG_CLOSE_TAG, `${foreignObject}${SVG_CLOSE_TAG}`);
    }
    const noteText = slideNotes[index] ?? slide.notes;
    const notesHtml = noteText
      ? `<aside class="notes">${escapeHtml(noteText)}</aside>`
      : '';
    return `<section>${svg}${notesHtml}</section>`;
  }).join('\n');

  const musicBase64 = await fetchMusicBase64();

  const html = `<!DOCTYPE html>
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
#notes-bar {
  padding: 4px 16px;
  background: #f5f5f5;
  border-top: 1px solid #ddd;
  box-sizing: border-box;
}
#slide-notes {
  width: 100%;
  padding: 4px 8px;
  font-family: 'Segoe UI', sans-serif;
  font-size: 13px;
  color: #444;
  box-sizing: border-box;
  min-height: 1.5em;
}
</style>
</head>
<body>
<div class="reveal">
<div class="slides">
${slidesHtml}
</div>
</div>
<div id="notes-bar"><div id="slide-notes"></div></div>
<script src="${REVEAL_DIST}/reveal.js">${CLOSE_SCRIPT}
<script src="${REVEAL_CDN}/plugin/notes/notes.js">${CLOSE_SCRIPT}
<script>
Reveal.initialize({
  controls: true,
  hash: true,
  height: 540,
  mouseWheel: true,
  plugins: [RevealNotes],
  slideNumber: true,
  width: 960
}).then(function() {
  var notesEl = document.getElementById('slide-notes');
  function updateNotes() {
    var slide = Reveal.getCurrentSlide();
    var aside = slide && slide.querySelector('aside.notes');
    notesEl.textContent = aside ? aside.textContent : '';
  }
  Reveal.on('slidechanged', updateNotes);
  updateNotes();
${musicBase64 ? `  var bin = atob("${musicBase64}");
  var bytes = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  var audio = new Audio(URL.createObjectURL(new Blob([bytes], { type: 'audio/mpeg' })));
  audio.loop = true;
  audio.addEventListener('canplaythrough', function() {
    function tryPlay() {
      audio.play().then(function() {
        document.removeEventListener('click', tryPlay);
        document.removeEventListener('keydown', tryPlay);
      }).catch(function() {});
    }
    document.addEventListener('click', tryPlay);
    document.addEventListener('keydown', tryPlay);
  });` : ''}
});
${CLOSE_SCRIPT}
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${title}.html`;
  a.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function fetchMusicBase64(): Promise<string> {
  try {
    const response = await fetch(MUSIC_BASE64_PATH);
    if (!response.ok) {
      return '';
    }
    return (await response.text()).trim();
  } catch {
    return '';
  }
}
