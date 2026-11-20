import { Easing, interpolate, useCurrentFrame } from "remotion";
import { copy, timeline, type } from "../config";
import { Card } from "../components/Card";
import { Caption } from "../components/Caption";
import { Eyebrow } from "../components/Eyebrow";
import { Keycap } from "../components/Keycap";
import { Scene } from "../components/Scene";
import { AppTopBar } from "../components/app/AppTopBar";
import { AssistantPanelView, type AssistantTimes } from "../components/app/AssistantPanelView";
import { AdminDashboardView } from "../components/app/Dashboards";
import { useStage } from "../lib/layout";
import { fadeOut, progress } from "../lib/motion";
import { beatAt, sceneFrames, sec } from "../lib/time";

const T = timeline.assistant;
/** A little under the other scenes, so the whole confirm card fits in the panel. */
const ZOOM = 1.22;
/** The panel's width in the app (sm:w-[26rem]). */
const PANEL = 416;

/**
 * Scene 4 (48–65s), hero: Ctrl+J opens the real assistant panel beside the
 * dashboard. It answers a data question, then proposes an event and waits
 * for Confirm before anything is saved.
 */
/** The scene's key frames (scene-local), shared with the audio cues in Main. */
export function assistantTimes() {
  const ctrlAt = beatAt("assistant", T.ctrl);
  const jAt = ctrlAt + Math.max(4, sec(T.j - T.ctrl));
  const panelAt = sec(T.panel);
  const times: AssistantTimes = {
    typeQ1: sec(T.typeQ1),
    sendQ1: beatAt("assistant", T.sendQ1),
    answerQ1: sec(T.answerQ1),
    typeQ2: sec(T.typeQ2),
    sendQ2: beatAt("assistant", T.sendQ2),
    answerQ2: sec(T.answerQ2),
    confirmCard: beatAt("assistant", T.confirmCard),
    confirm: beatAt("assistant", T.confirm),
  };
  return { ctrlAt, jAt, panelAt, times };
}

export const Assistant: React.FC = () => {
  const frame = useCurrentFrame();
  const stage = useStage();
  const { u, top, cardLeft, cardWidth } = stage;
  // 60px taller than the other scenes (the gap above the caption allows it) so the whole action card fits.
  const cardHeight = stage.cardHeight + 60 * u;
  const { ctrlAt, jAt, panelAt, times } = assistantTimes();

  const zoom = ZOOM * u;
  const slide = progress(frame, panelAt, 10, Easing.out(Easing.cubic));
  const keysIn = progress(frame, 0, 12);
  const keysOut = fadeOut(frame, panelAt + 4, 10);

  return (
    <Scene duration={sceneFrames("assistant")}>
      <Eyebrow scene={copy.assistant.eyebrow} />
      <div style={{ position: "absolute", top, left: cardLeft }}>
        <Card title="School System" width={cardWidth} height={cardHeight} zoom={zoom}>
          <div className="relative h-full overflow-hidden bg-background">
            <AppTopBar assistantActive={frame >= panelAt} />
            <div style={{ width: `calc(100% - ${PANEL}px)` }}>
              <AdminDashboardView columns={1} />
            </div>
            {frame >= panelAt && (
              <div
                className="absolute inset-y-0 end-0 border-s shadow-2xl"
                style={{ width: PANEL, transform: `translateX(${(1 - slide) * 100}%)` }}
              >
                <AssistantPanelView times={times} />
              </div>
            )}
          </div>
        </Card>
      </div>
      {keysOut > 0 && (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: top + cardHeight / 2 - 75 * u + type.windowBar * u * 0.5,
            display: "flex",
            justifyContent: "center",
            gap: 26 * u,
            opacity: Math.min(keysIn, keysOut),
            transform: `scale(${interpolate(keysIn, [0, 1], [0.9, 1])})`,
          }}
        >
          <Keycap label="Ctrl" at={ctrlAt} minWidth={190} />
          <Keycap label="J" at={jAt} />
        </div>
      )}
      <Caption text={copy.assistant.caption} sub={copy.assistant.sub} enterAt={sec(T.caption)} />
    </Scene>
  );
};
