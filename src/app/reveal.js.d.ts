declare module 'reveal.js' {
  interface RevealIndices {
    h: number;
  }

  interface RevealOptions {
    controls?: boolean;
    hash?: boolean;
    height?: number;
    history?: boolean;
    keyboard?: boolean;
    mouseWheel?: boolean;
    plugins?: unknown[];
    progress?: boolean;
    slideNumber?: boolean;
    transition?: string;
    width?: number;
  }

  class Reveal {
    public constructor(options?: RevealOptions);
    public getCurrentSlide(): Element | null;
    public getIndices(): RevealIndices;
    public getTotalSlides(): number;
    public initialize(): Promise<void>;
    public on(event: string, callback: (event: unknown) => void): void;
    public slide(h: number): void;
    public sync(): void;
  }

  export default Reveal;
}

declare module 'reveal.js/plugin/notes/notes.esm.js' {
  declare const RevealNotes: unknown;
  export default RevealNotes;
}
