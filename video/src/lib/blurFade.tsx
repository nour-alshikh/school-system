import { AbsoluteFill } from "remotion";
import type { TransitionPresentation, TransitionPresentationComponentProps } from "@remotion/transitions";

type Props = { blur: number };

/** Soft cross-fade with a slight blur on the scene that is less visible. No wipes, no hard cuts. */
const BlurFade: React.FC<TransitionPresentationComponentProps<Props>> = ({ children, presentationDirection, presentationProgress, passedProps }) => {
  const visible = presentationDirection === "entering" ? presentationProgress : 1 - presentationProgress;
  return <AbsoluteFill style={{ opacity: visible, filter: `blur(${(1 - visible) * passedProps.blur}px)` }}>{children}</AbsoluteFill>;
};

export const blurFade = (props: Props = { blur: 6 }): TransitionPresentation<Props> => ({ component: BlurFade, props });
