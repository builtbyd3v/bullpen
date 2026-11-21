import { Composition, registerRoot } from "remotion";
import timeline from "../timeline.json";
import { Film } from "./Film";
import { TitleCard } from "./TitleCard";
import type { FilmProps, Slot } from "./types";

const fps = timeline.fps;
const slots = timeline.slots as Slot[];

function Root() {
  return (
    <>
      <Composition
        id="Film"
        component={Film}
        width={1920}
        height={1080}
        fps={fps}
        durationInFrames={1}
        defaultProps={{ slots, cues: [] } satisfies FilmProps}
        calculateMetadata={({ props }) => ({
          durationInFrames: props.slots.reduce((sum, s) => sum + Math.round(s.dur * fps), 0),
        })}
      />
      <Composition
        id="Title"
        component={TitleCard}
        width={1920}
        height={1080}
        fps={fps}
        durationInFrames={5 * fps}
        defaultProps={{ tagline: "Source control for AI agents" }}
      />
    </>
  );
}

registerRoot(Root);
