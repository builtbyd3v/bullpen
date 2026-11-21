import { AbsoluteFill, Audio, interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { ProblemCard } from "./ProblemCard";
import { TitleCard } from "./TitleCard";
import { C, MONO, type Cue, type FilmProps, type Slot } from "./types";

// Ducking (lowering one sound while another plays): the level sits at `under` while a voice take plays
// and returns to `full` over RAMP seconds on each side. Voice times are known up front, so no audio analysis is needed.
const RAMP = 0.35;
function duck(t: number, voices: [number, number][], full: number, under: number): number {
  const dip = Math.max(0, ...voices.map(([from, to]) => interpolate(t, [from - RAMP, from, to, to + RAMP], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })));
  return full + (under - full) * dip;
}

// Shown until the recording exists: black slate, white text, the exact shot to record.
function Slate({ slot }: { slot: Slot }) {
  return (
    <AbsoluteFill style={{ background: "#000", color: "#fff", fontFamily: MONO, padding: 140, justifyContent: "center", gap: 32 }}>
      <div style={{ fontSize: 64, lineHeight: 1.3, maxWidth: 1500 }}>
        APP CLIP: {slot.shot}, {slot.dur}s
      </div>
      <div style={{ fontSize: 34, opacity: 0.7 }}>save as raw/{slot.id}.mp4</div>
    </AbsoluteFill>
  );
}

function LowerThird({ text }: { text: string }) {
  return (
    <div style={{ position: "absolute", left: 48, top: 48, display: "flex", alignItems: "center", gap: 16, background: C.ink, padding: "14px 22px", fontFamily: MONO, fontSize: 30, color: C.sand }}>
      <div style={{ width: 16, height: 16, background: C.gold }} />
      {text}
    </div>
  );
}

function Captions({ cues }: { cues: Cue[] }) {
  const { fps } = useVideoConfig();
  const t = useCurrentFrame() / fps;
  const cue = cues.find((c) => t >= c.from && t < c.to);
  if (!cue) return null;
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 56 }}>
      <div style={{ background: C.ink, color: C.white, fontFamily: MONO, fontSize: 38, lineHeight: 1.35, padding: "12px 24px", maxWidth: 1500, textAlign: "center" }}>
        {cue.text}
      </div>
    </AbsoluteFill>
  );
}

export function Film({ slots, cues, mix, music }: FilmProps) {
  const { fps, durationInFrames } = useVideoConfig();
  let at = 0;
  let start = 0;
  const voices: [number, number][] = [];
  for (const slot of slots) {
    if (slot.voFile) voices.push([start, start + (slot.voDur ?? slot.dur)]);
    start += slot.dur;
  }
  const end = durationInFrames / fps;
  return (
    <AbsoluteFill style={{ background: C.ink }}>
      {slots.map((slot) => {
        const from = at;
        const frames = Math.round(slot.dur * fps);
        at += frames;
        return (
          <Sequence key={slot.id} from={from} durationInFrames={frames}>
            {slot.kind === "title" ? (
              <TitleCard tagline={slot.tagline ?? ""} still={slot.still} speed={slot.speed} />
            ) : slot.kind === "problem" ? (
              <ProblemCard speed={slot.speed} />
            ) : slot.clip ? (
              <OffthreadVideo
                src={staticFile(slot.clip)}
                trimBefore={Math.round((slot.start ?? 0) * fps)}
                playbackRate={slot.rate ?? 1}
                muted={slot.audio === false}
                volume={(f) => duck(f / fps, slot.voFile ? [[0, slot.voDur ?? slot.dur]] : [], mix.app, mix.appUnderVoice)}
                style={{ width: "100%", height: "100%", transform: slot.zoom ? `scale(${slot.zoom.scale})` : undefined, transformOrigin: slot.zoom ? `${slot.zoom.x}% ${slot.zoom.y}%` : undefined }}
              />
            ) : (
              <Slate slot={slot} />
            )}
            {slot.sfx?.map((n, i) => (
              <Sequence key={i} from={Math.round(n.at * fps)}>
                <Audio src={staticFile(n.file)} volume={duck(n.at, slot.voFile ? [[0, slot.voDur ?? slot.dur]] : [], mix.app, mix.appUnderVoice)} />
              </Sequence>
            ))}
            {slot.overlay ? (
              <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
                <div style={{ background: C.ink, color: C.sand, fontFamily: MONO, fontSize: 56, lineHeight: 1.4, padding: "28px 44px", textAlign: "center" }}>
                  {slot.overlay.split(/(?<=\.)\s/).map((line, i) => (
                    <div key={i}>{line}</div>
                  ))}
                </div>
              </AbsoluteFill>
            ) : null}
            {slot.label ? <LowerThird text={slot.label} /> : null}
            {slot.voFile ? <Audio src={staticFile(slot.voFile)} volume={mix.voice} /> : null}
          </Sequence>
        );
      })}
      {music ? (
        <Audio
          src={staticFile(music)}
          loop
          volume={(f) => duck(f / fps, voices, mix.music, mix.musicUnderVoice) * interpolate(f / fps, [0, 1, end - 2, end], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
        />
      ) : null}
      <Captions cues={cues} />
    </AbsoluteFill>
  );
}
