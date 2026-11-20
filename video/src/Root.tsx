import { Composition, type CalculateMetadataFunction } from "remotion";
import { video } from "./config";
import { findSfx } from "./audio";
import { Main, type MainProps } from "./Main";
import { withBackground } from "./components/Scene";
import { Hook } from "./scenes/Hook";
import { DraftWithAI } from "./scenes/DraftWithAI";
import { Outro } from "./scenes/Outro";
import { Assistant } from "./scenes/Assistant";
import { Modules } from "./scenes/Modules";
import { Portals } from "./scenes/Portals";
import { sceneFrames, sec, type SceneName } from "./lib/time";

/** Each scene as its own composition, for previewing alone (square and wide). */
const SCENES: { id: string; name: SceneName; component: React.FC }[] = [
  { id: "Hook", name: "hook", component: Hook },
  { id: "Modules", name: "modules", component: Modules },
  { id: "DraftWithAI", name: "draftWithAI", component: DraftWithAI },
  { id: "Assistant", name: "assistant", component: Assistant },
  { id: "Portals", name: "portals", component: Portals },
  { id: "Outro", name: "outro", component: Outro },
];

/** Before rendering Main, check which SFX files exist so missing ones are skipped. */
const withSfx: CalculateMetadataFunction<MainProps> = ({ props }) => {
  const sfx = findSfx();
  console.log(`[sfx] available: ${JSON.stringify(sfx)}`);
  return { props: { ...props, sfx } };
};
const noSfx: MainProps = { sfx: { click: false, pop: false, whoosh: false } };

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="Main" component={Main} defaultProps={noSfx} calculateMetadata={withSfx} durationInFrames={sec(video.duration)} fps={video.fps} width={video.width} height={video.height} />
    <Composition id="MainWide" component={Main} defaultProps={noSfx} calculateMetadata={withSfx} durationInFrames={sec(video.duration)} fps={video.fps} width={video.wide.width} height={video.wide.height} />
    {SCENES.map(({ id, name, component }) => (
      <Composition key={id} id={`Scene-${id}`} component={withBackground(component)} durationInFrames={sceneFrames(name)} fps={video.fps} width={video.width} height={video.height} />
    ))}
    {SCENES.map(({ id, name, component }) => (
      <Composition key={`${id}-wide`} id={`Scene-${id}-Wide`} component={withBackground(component)} durationInFrames={sceneFrames(name)} fps={video.fps} width={video.wide.width} height={video.wide.height} />
    ))}
  </>
);
