export type Cue = { from: number; to: number; text: string };

export type Slot = {
  id: string;
  kind: "clip" | "title" | "problem";
  dur: number;
  start?: number;
  rate?: number;
  // false mutes the clip's own sound (the app's sound effects).
  audio?: boolean;
  still?: boolean;
  // Problem clip only: plays the animation faster, to fit a shorter slot.
  speed?: number;
  label?: string;
  shot?: string;
  tagline?: string;
  vo: string;
  // Filled in by scripts/build.mjs: paths under public/, null when missing.
  clip?: string | null;
  voFile?: string | null;
  voDur?: number;
  // The slot lasts as long as its voice line plus `pad` seconds.
  fit?: boolean;
  pad?: number;
  // Large centered text over the clip, for the closing line.
  overlay?: string;
  // Recorder takes: the source file, a mark in its log, and the app's sound-effect notes inside this slot.
  src?: string;
  from?: string | string[];
  sfx?: { at: number; file: string }[];
  // Close-up: scale, and the point to zoom on as a percentage of width and height.
  zoom?: { scale: number; x: number; y: number };
};

// Volumes from 0 to 1. The "UnderVoice" values apply while a voiceover take plays.
export type Mix = { voice: number; app: number; appUnderVoice: number; music: number; musicUnderVoice: number };

export type FilmProps = { slots: Slot[]; cues: Cue[]; mix: Mix; music: string | null };

// USF brand colors, from design/js/palette.js.
export const C = {
  green: "#006747",
  evergreen: "#005432",
  ink: "#0D231B",
  gold: "#CFC493",
  sand: "#EDEBD1",
  white: "#FFFFFF",
};

export const MONO = "ui-monospace, Menlo, Monaco, monospace";
