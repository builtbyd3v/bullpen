export type Cue = { from: number; to: number; text: string };

export type Slot = {
  id: string;
  kind: "clip" | "title";
  dur: number;
  start?: number;
  rate?: number;
  // false mutes the clip's own sound (app sound effects, room sound).
  audio?: boolean;
  still?: boolean;
  label?: string;
  shot?: string;
  tagline?: string;
  vo: string;
  // Filled in by scripts/build.mjs: paths under public/, null when missing.
  clip?: string | null;
  voFile?: string | null;
  voDur?: number;
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
