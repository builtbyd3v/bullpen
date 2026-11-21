import { AbsoluteFill, Audio, OffthreadVideo, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { TitleCard } from "./TitleCard";
import { C, MONO, type Cue, type FilmProps, type Slot } from "./types";

// Shown until the team drops the recording into video/raw/.
function Slate({ slot }: { slot: Slot }) {
  return (
    <AbsoluteFill style={{ background: C.ink, color: C.sand, fontFamily: MONO, padding: 120, justifyContent: "center", gap: 28 }}>
      <div style={{ fontSize: 30, color: C.gold }}>PLACEHOLDER, {slot.dur} s</div>
      <div style={{ fontSize: 72 }}>raw/{slot.id}.mp4</div>
      <div style={{ fontSize: 36, lineHeight: 1.4, maxWidth: 1400 }}>{slot.shot}</div>
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

export function Film({ slots, cues }: FilmProps) {
  const { fps } = useVideoConfig();
  let at = 0;
  return (
    <AbsoluteFill style={{ background: C.ink }}>
      {slots.map((slot) => {
        const from = at;
        const frames = Math.round(slot.dur * fps);
        at += frames;
        return (
          <Sequence key={slot.id} from={from} durationInFrames={frames}>
            {slot.kind === "title" ? (
              <TitleCard tagline={slot.tagline ?? ""} />
            ) : slot.clip ? (
              <OffthreadVideo
                src={staticFile(slot.clip)}
                trimBefore={Math.round((slot.start ?? 0) * fps)}
                playbackRate={slot.rate ?? 1}
                muted={!slot.keepAudio}
                volume={0.25}
                style={{ width: "100%", height: "100%" }}
              />
            ) : (
              <Slate slot={slot} />
            )}
            {slot.label ? <LowerThird text={slot.label} /> : null}
            {slot.voFile ? <Audio src={staticFile(slot.voFile)} /> : null}
          </Sequence>
        );
      })}
      <Captions cues={cues} />
    </AbsoluteFill>
  );
}
