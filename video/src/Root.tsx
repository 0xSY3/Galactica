import { Composition } from "remotion";
import { GalacticaDemo } from "./GalacticaDemo";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="GalacticaDemo"
        component={GalacticaDemo}
        durationInFrames={30 * 60 * 4}
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};
