import Reveal from 'reveal.js';
import RevealNotes from 'reveal.js/plugin/notes/notes.esm.js';

import type { SlideSnapshot } from '../SvgRenderer.ts';

let deck: InstanceType<typeof Reveal> | null = null;

export function addSlides(newSlides: readonly SlideSnapshot[]): void {
  const container = document.querySelector('.reveal .slides');
  if (!container || !deck) {
    return;
  }

  for (const slide of newSlides) {
    appendSlideElement(container, slide);
  }

  deck.sync();
  navigateToLast();
}

export function getCurrentSlideIndex(): number {
  if (!deck) {
    return 0;
  }
  return deck.getIndices().h;
}

export function getSlideNotes(): string {
  if (!deck) {
    return '';
  }
  const indices = deck.getIndices();
  const container = document.querySelector('.reveal .slides');
  if (!container) {
    return '';
  }
  const sections = container.querySelectorAll(':scope > section');
  const section = sections[indices.h];
  if (!section) {
    return '';
  }
  const aside = section.querySelector('aside.notes');
  return aside?.textContent ?? '';
}

export async function initializeReveal(slides: readonly SlideSnapshot[]): Promise<void> {
  const container = document.querySelector('.reveal .slides');
  if (!container) {
    throw new Error('.reveal .slides container not found');
  }

  container.innerHTML = '';
  for (const slide of slides) {
    appendSlideElement(container, slide);
  }

  /* eslint-disable no-magic-numbers -- Reveal.js config values. */
  deck = new Reveal({
    controls: true,
    hash: false,
    height: 540,
    history: false,
    keyboard: true,
    mouseWheel: true,
    plugins: [RevealNotes],
    progress: true,
    slideNumber: true,
    transition: 'none',
    width: 960
  });
  /* eslint-enable no-magic-numbers -- End Reveal.js config. */
  await deck.initialize();
  navigateToLast();
}

export function isOnLastSlide(): boolean {
  if (!deck) {
    return true;
  }
  return getCurrentSlideIndex() === deck.getTotalSlides() - 1;
}

export function navigateToFirst(): void {
  if (!deck) {
    return;
  }
  deck.slide(0);
}

export function navigateToLast(): void {
  if (!deck) {
    return;
  }
  const total = deck.getTotalSlides();
  if (total > 0) {
    deck.slide(total - 1);
  }
}

export function onSlideChanged(callback: () => void): void {
  if (!deck) {
    return;
  }
  deck.on('slidechanged', () => {
    callback();
  });
}

export function removeAfter(slideIndex: number): void {
  const container = document.querySelector('.reveal .slides');
  if (!container || !deck) {
    return;
  }

  const sections = container.querySelectorAll(':scope > section');
  for (let i = sections.length - 1; i > slideIndex; i--) {
    const section = sections[i];
    if (section) {
      section.remove();
    }
  }

  deck.sync();
  deck.slide(slideIndex);
}

function appendSlideElement(container: Element, slide: SlideSnapshot): void {
  const section = document.createElement('section');
  section.innerHTML = slide.svg;
  if (slide.notes) {
    const aside = document.createElement('aside');
    aside.className = 'notes';
    aside.textContent = slide.notes;
    section.appendChild(aside);
  }
  container.appendChild(section);
}
