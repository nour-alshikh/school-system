import { useCurrentFrame } from "remotion";
import { useTranslations } from "next-intl";
import { copy, timeline, type } from "../config";
import { Card } from "../components/Card";
import { Caption } from "../components/Caption";
import { Eyebrow } from "../components/Eyebrow";
import { Scene } from "../components/Scene";
import { VideoProviders } from "../components/VideoProviders";
import { ExamDraftView, type ExamDraftData, type ExamDraftTimes } from "../components/app/ExamDraftView";
import { useStage } from "../lib/layout";
import { fadeOut, progress } from "../lib/motion";
import { beatAt, sceneFrames, sec } from "../lib/time";
import { examDraft } from "../mock";

const T = timeline.draftWithAI;
/** The real UI is shown at this zoom inside the card, so it reads on a phone. */
const ZOOM = 1.22;

function ExamCard({ data, times, review, enterAt, width, height }: { data: ExamDraftData; times: ExamDraftTimes; review: string; enterAt: number; width: number; height: number }) {
  const t = useTranslations("ExamFormPage");
  const { u } = useStage();
  const zoom = ZOOM * u;
  const viewport = (height - type.windowBar * u) / zoom;
  return (
    <Card title={t("createHeading")} enterAt={enterAt} width={width} height={height} zoom={zoom}>
      <ExamDraftView data={data} times={times} viewport={viewport} reviewLabel={review} />
    </Card>
  );
}

/**
 * Scene 3 (28–48s), hero: the real exam builder. Draft with AI turns rough
 * notes into multiple-choice questions, filled field by field with the amber
 * AI ring; nothing is saved until the teacher presses Create exam. Then the
 * same flow in the Arabic UI.
 */
/** The scene's key frames (scene-local), shared with the audio cues in Main. */
export function draftTimes() {
  const en: ExamDraftTimes = {
    scrollToQuestions: sec(T.scrollToQuestions),
    openPopover: beatAt("draftWithAI", T.openPopover),
    typeNotes: sec(T.typeNotes),
    draft: beatAt("draftWithAI", T.draft),
    fill: sec(T.fill),
    questionGap: sec(T.questionGap),
    review: beatAt("draftWithAI", T.review),
  };
  const arStart = beatAt("draftWithAI", T.arabic);
  const ar: ExamDraftTimes = {
    scrollToQuestions: arStart + 8,
    openPopover: arStart + sec(0.5),
    typeNotes: sec(T.arabicTypeNotes),
    draft: beatAt("draftWithAI", T.arabicDraft),
    fill: sec(T.arabicFill),
    questionGap: sec(T.questionGap),
    review: beatAt("draftWithAI", T.arabicReview),
  };
  return { en, ar, arStart };
}

export const DraftWithAI: React.FC = () => {
  const frame = useCurrentFrame();
  const { top, cardLeft, cardWidth, cardHeight } = useStage();
  const { en, ar, arStart } = draftTimes();

  // English card out, Arabic card in, with a soft cross-fade and lift.
  const swap = progress(frame, arStart - 10, 18);
  const enOpacity = fadeOut(frame, arStart - 10, 14);

  return (
    <Scene duration={sceneFrames("draftWithAI")}>
      <Eyebrow scene={copy.draftWithAI.eyebrow} />
      <div style={{ position: "absolute", top, left: cardLeft }}>
        {enOpacity > 0 && (
          <div style={{ position: "absolute", opacity: enOpacity, transform: `translateY(${-20 * swap}px)` }}>
            <ExamCard data={examDraft.en} times={en} review={copy.draftWithAI.review} enterAt={0} width={cardWidth} height={cardHeight} />
          </div>
        )}
        {frame >= arStart - 10 && (
          <div style={{ position: "absolute", opacity: swap, transform: `translateY(${24 * (1 - swap)}px)` }}>
            <VideoProviders locale="ar">
              <ExamCard data={examDraft.ar} times={ar} review={copy.draftWithAI.reviewAr} enterAt={arStart - 10} width={cardWidth} height={cardHeight} />
            </VideoProviders>
          </div>
        )}
      </div>
      <Caption text={copy.draftWithAI.caption} sub={copy.draftWithAI.sub} enterAt={sec(T.caption)} />
    </Scene>
  );
};
