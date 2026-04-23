import type { Stage } from "./tmp";

export function mkTurboStage(id: string): Stage {
  return {
    id,
    outerDiameter: 0.16,
    hubDiameter: 0.05,
    tipClearance: 0.0005,
    axialGap: 0.001,
    rotor: { angleDeg: 40, count: 40, height: 0.012 },
    stator: { angleDeg: 40, count: 40, height: 0.012 },
  };
}
