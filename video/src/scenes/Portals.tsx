import { Easing, interpolate, useCurrentFrame } from "remotion";
import { useTranslations } from "next-intl";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { copy, timeline } from "../config";
import { Card } from "../components/Card";
import { Caption } from "../components/Caption";
import { Eyebrow } from "../components/Eyebrow";
import { Scene } from "../components/Scene";
import { VideoProviders } from "../components/VideoProviders";
import { AdminDashboardView, ParentDashboardView, StudentDashboardView, TeacherDashboardView } from "../components/app/Dashboards";
import { useStage } from "../lib/layout";
import { progress } from "../lib/motion";
import { beatAt, sceneFrames, sec } from "../lib/time";

const T = timeline.portals;
const ZOOM = 1.15;
const ROLES = ["admin", "teacher", "parent", "student"] as const;
type Role = (typeof ROLES)[number];

const VIEWS: Record<Role, React.FC> = {
  admin: () => <AdminDashboardView />,
  teacher: TeacherDashboardView,
  parent: ParentDashboardView,
  student: StudentDashboardView,
};

/** The role tabs (the app's real Tabs) over the chosen role's dashboard, cross-fading on each switch. */
function PortalWindow({ role, switchedAt }: { role: Role; switchedAt: number }) {
  const frame = useCurrentFrame();
  const t = useTranslations("LoginChooserPage");
  const View = VIEWS[role];
  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex shrink-0 justify-center border-b p-3">
        <Tabs value={role}>
          <TabsList>
            {ROLES.map((r) => (
              <TabsTrigger key={r} value={r}>
                {t(r)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>
      <div style={{ opacity: progress(frame, switchedAt, 8) }}>
        <View />
      </div>
    </div>
  );
}

/**
 * Scene 5 (65–72s): Admin, Teacher, Parent and Student dashboards switch
 * every ~1.2s, then the whole UI flips from English to Arabic (RTL).
 */
export const Portals: React.FC = () => {
  const frame = useCurrentFrame();
  const { u, top, cardLeft, cardWidth, cardHeight } = useStage();

  const switches = T.tabs.map((s, i) => (i === 0 ? sec(s) : beatAt("portals", s)));
  let index = 0;
  switches.forEach((f, i) => {
    if (frame >= f) index = i;
  });
  const role = ROLES[index]!;

  // The flip: English turns away to 90°, Arabic turns in from -90°.
  const flipAt = beatAt("portals", T.flip);
  const half = sec(T.flipLength) / 2;
  const out = progress(frame, flipAt, half, Easing.in(Easing.cubic));
  const back = progress(frame, flipAt + half, half, Easing.out(Easing.cubic));
  const arabic = frame >= flipAt + half;
  const angle = arabic ? interpolate(back, [0, 1], [-90, 0]) : interpolate(out, [0, 1], [0, 90]);

  const card = (
    <Card title="School System" width={cardWidth} height={cardHeight} zoom={ZOOM * u}>
      <PortalWindow role={arabic ? "admin" : role} switchedAt={arabic ? flipAt + half : (switches[index] ?? 0)} />
    </Card>
  );

  return (
    <Scene duration={sceneFrames("portals")}>
      <Eyebrow scene={copy.portals.eyebrow} />
      <div style={{ position: "absolute", top, left: cardLeft, perspective: 1600 * u }}>
        <div style={{ transform: `rotateY(${angle}deg)`, transformOrigin: "50% 50%" }}>
          {arabic ? <VideoProviders locale="ar">{card}</VideoProviders> : card}
        </div>
      </div>
      <Caption text={copy.portals.caption} sub={copy.portals.sub} enterAt={6} subEnterAt={flipAt + half} />
    </Scene>
  );
};
