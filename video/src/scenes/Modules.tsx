import { AbsoluteFill, Sequence, useCurrentFrame } from "remotion";
import { copy, timeline } from "../config";
import { Card } from "../components/Card";
import { Caption } from "../components/Caption";
import { Eyebrow } from "../components/Eyebrow";
import { Scene } from "../components/Scene";
import { AttendanceView, CalendarView, ExamResultsView, FeesView, LibraryView } from "../components/app/ModuleViews";
import { useStage } from "../lib/layout";
import { fadeOut } from "../lib/motion";
import { beatAt, sceneFrames, sec } from "../lib/time";

const T = timeline.modules;
type Module = (typeof T.order)[number];
/** UI zoom per beat: as large as each screen allows while fitting the card. */
const ZOOM: Record<Module, number> = { attendance: 1.3, exams: 1.3, fees: 1.3, calendar: 1.1, library: 1.2 };

/** One module beat: its eyebrow, the screen in a card, its caption; fades out at the end unless last. */
function Beat({ module, length, last, children }: { module: Module; length: number; last: boolean; children: React.ReactNode }) {
  const frame = useCurrentFrame();
  const { u, top, cardLeft, cardWidth, cardHeight } = useStage();
  const c = copy.modules[module];
  return (
    <AbsoluteFill style={{ opacity: last ? 1 : fadeOut(frame, length - 10, 10) }}>
      <Eyebrow scene={c.eyebrow} />
      <div style={{ position: "absolute", top, left: cardLeft }}>
        <Card title={c.eyebrow} width={cardWidth} height={cardHeight} zoom={ZOOM[module] * u}>
          {children}
        </Card>
      </div>
      <Caption text={c.caption} enterAt={6} />
    </AbsoluteFill>
  );
}

/** Scene 2 (8–28s): five modules, ~4s each, one real screen per beat. */
/**
 * Each beat's key frames, local to its beat (beat i starts at i × beat).
 * Shared with the audio cues in Main.
 */
export function moduleTimes() {
  const beat = sec(T.beat);
  /** Frame within beat `i` for `s` seconds into it, snapped to the music. */
  const at = (i: number, s: number) => beatAt("modules", i * T.beat + s) - i * beat;
  return {
    beat,
    attendance: { taps: T.attendance.taps.map((s) => at(0, s)), save: at(0, T.attendance.save) },
    exams: { rowsAt: sec(T.exams.rows), gap: sec(T.exams.rowGap) },
    fees: { payButton: at(2, T.fees.payButton), amount: sec(T.fees.amount), record: at(2, T.fees.record), updated: sec(T.fees.updated) },
    calendar: { eventsAt: sec(T.calendar.events), gap: sec(T.calendar.eventGap) },
    library: { filter: at(4, T.library.filter), rowsAt: sec(T.library.rows), gap: sec(T.library.rowGap), shared: at(4, T.library.shared) },
  };
}

export const Modules: React.FC = () => {
  const m = moduleTimes();
  const beat = m.beat;

  const views: Record<Module, React.ReactNode> = {
    attendance: <AttendanceView {...m.attendance} />,
    exams: <ExamResultsView {...m.exams} />,
    fees: <FeesView {...m.fees} />,
    calendar: <CalendarView {...m.calendar} />,
    library: <LibraryView {...m.library} />,
  };

  return (
    <Scene duration={sceneFrames("modules")}>
      {T.order.map((module, i) => {
        const last = i === T.order.length - 1;
        const length = last ? sceneFrames("modules") - i * beat : beat;
        return (
          <Sequence key={module} from={i * beat} durationInFrames={length} layout="none">
            <Beat module={module} length={length} last={last}>
              {views[module]}
            </Beat>
          </Sequence>
        );
      })}
    </Scene>
  );
};
