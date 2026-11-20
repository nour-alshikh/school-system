import { AbsoluteFill } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { motion } from "./config";
import { Music, SoundEffects, type SfxAvailable } from "./audio";
import { Background } from "./components/Background";
import { blurFade } from "./lib/blurFade";
import { sceneFrames, sceneOrder, type SceneName } from "./lib/time";
import { Assistant } from "./scenes/Assistant";
import { DraftWithAI } from "./scenes/DraftWithAI";
import { Hook } from "./scenes/Hook";
import { Modules } from "./scenes/Modules";
import { Outro } from "./scenes/Outro";
import { Portals } from "./scenes/Portals";

export type MainProps = { sfx: SfxAvailable };

const SCENES: Record<SceneName, React.FC> = {
  hook: Hook,
  modules: Modules,
  draftWithAI: DraftWithAI,
  assistant: Assistant,
  portals: Portals,
  outro: Outro,
};

/**
 * The whole video: one Background driven by the global frame (so it keeps
 * drifting across cuts), the six scenes joined by 12-frame blur cross-fades
 * that start on the beat, the music bed and the sound effects.
 */
export const Main: React.FC<MainProps> = ({ sfx }) => (
  <AbsoluteFill>
    <Background />
    <TransitionSeries>
      {sceneOrder.flatMap((name, i) => {
        const Scene = SCENES[name];
        const items = [
          <TransitionSeries.Sequence key={name} durationInFrames={sceneFrames(name)}>
            <Scene />
          </TransitionSeries.Sequence>,
        ];
        if (i < sceneOrder.length - 1) {
          items.push(<TransitionSeries.Transition key={`${name}-out`} presentation={blurFade()} timing={linearTiming({ durationInFrames: motion.transition })} />);
        }
        return items;
      })}
    </TransitionSeries>
    <Music />
    <SoundEffects available={sfx} />
  </AbsoluteFill>
);
