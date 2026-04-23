// Unified pump model: axial turbo + Holweck drag, with 3 operating modes.
//
// turbo-only    : axial stack, no drag stages.
// holweck-only  : drum stages only.
// combined      : axial stack feeds a Holweck drum; K and S compose.

import {
  calculate,
  type CalcResult,
  type Inputs as TurboInputs,
  type Stage as TurboStage,
  type TurboMethod,
} from "./tmp";
import {
  calcHolweck,
  type HolweckCalc,
  type HolweckInputs,
  type HolweckMethod,
  type HolweckStage,
} from "./holweck";

export type PumpMode = "turbo" | "holweck" | "combined";

export interface PumpInputs {
  mode: PumpMode;
  rpm: number;
  temperature: number;
  /** Inlet (high-vacuum side) pressure [Pa]. */
  inletPressure: number;
  /** Forevacuum (exhaust) pressure [Pa]. Used for the S(P) curve. */
  outletPressure?: number;
  molarMass: number;
  coriolisEnabled?: boolean;
  turboStages: TurboStage[];
  holweckStages: HolweckStage[];
  turboMethod?: TurboMethod;
  holweckMethod?: HolweckMethod;
}

export interface PumpResult {
  mode: PumpMode;
  turbo?: CalcResult;
  holweck?: HolweckCalc;
  kTotal: number;
  sMaxLps: number;
  pTotal: number;
  diagnostics: string[];
}

export function calculatePump(inp: PumpInputs): PumpResult {
  const diagnostics: string[] = [];

  let turbo: CalcResult | undefined;
  let holweck: HolweckCalc | undefined;

  if (inp.mode === "turbo" || inp.mode === "combined") {
    if (inp.turboStages.length === 0) {
      diagnostics.push("Турбо-ступени не заданы, но режим требует их. Расчёт пропущен.");
    } else {
      const tIn: TurboInputs = {
        rpm: inp.rpm,
        temperature: inp.temperature,
        inletPressure: inp.inletPressure,
        molarMass: inp.molarMass,
        stages: inp.turboStages,
        coriolisEnabled: inp.coriolisEnabled,
        method: inp.turboMethod,
      };
      turbo = calculate(tIn);
      diagnostics.push(...turbo.diagnostics);
    }
  }

  if (inp.mode === "holweck" || inp.mode === "combined") {
    if (inp.holweckStages.length === 0) {
      diagnostics.push("Ступени Holweck не заданы, но режим требует их. Расчёт пропущен.");
    } else {
      const pIntoHolweck =
        inp.mode === "combined" && turbo
          ? inp.inletPressure * turbo.kTotal
          : inp.inletPressure;
      const hIn: HolweckInputs = {
        rpm: inp.rpm,
        temperature: inp.temperature,
        inletPressure: pIntoHolweck,
        molarMass: inp.molarMass,
        stages: inp.holweckStages,
        method: inp.holweckMethod,
      };
      holweck = calcHolweck(hIn);
      diagnostics.push(...holweck.diagnostics);
    }
  }

  let kTotal = 1;
  let sMaxLps = 0;
  let pTotal = 0;

  if (inp.mode === "turbo" && turbo) {
    kTotal = turbo.kTotal;
    sMaxLps = turbo.sMaxLps;
    pTotal = turbo.pTotal;
  } else if (inp.mode === "holweck" && holweck) {
    kTotal = holweck.kTotal;
    sMaxLps = holweck.sMaxLps;
    pTotal = holweck.pGasTotal;
  } else if (inp.mode === "combined") {
    const kT = turbo?.kTotal ?? 1;
    const kH = holweck?.kTotal ?? 1;
    kTotal = kT * kH;
    const sT = turbo?.sMaxLps ?? 0;
    const sHDrag = holweck?.stages[0]?.sDrag ? holweck.stages[0].sDrag * 1000 : 0;
    sMaxLps = sT;
    if (sT > 0 && sHDrag > 0 && sHDrag * kT < sT) {
      diagnostics.push(
        "Holweck-секция может ограничивать поток: её drag-скорость недостаточна для сжатой турбо-порции.",
      );
    }
    pTotal = (turbo?.pTotal ?? 0) + (holweck?.pGasTotal ?? 0);
  }

  return {
    mode: inp.mode,
    turbo,
    holweck,
    kTotal,
    sMaxLps,
    pTotal,
    diagnostics,
  };
}

/**
 * S(P_in) curve at fixed P_out (forevacuum pressure).
 *
 * Physical model combining three regimes (free-molecular → transitional →
 * viscous) to reproduce the characteristic shape of TMP / Holweck datasheets:
 *
 *   S(P_in) = S_max · stall(P_in) · viscous(P_in)
 *
 *   stall(P_in)  = max(0, 1 − P_out/(K · P_in))
 *     Compression limit: below P_out/K the pump cannot hold that inlet
 *     pressure against the foreline. Usually invisible on datasheet curves
 *     because P_out/K ≪ operating range.
 *
 *   viscous(P_in) = 1 / (1 + (P_in / P_knee)^3)
 *     Transitional/viscous rolloff: pumping speed collapses when the mean
 *     free path λ becomes comparable to the smallest relevant dimension
 *     (blade gap or groove depth). We take the knee at Kn ≈ 1:
 *        P_knee = (λ_ref · P_ref) / L_char    [λ·P constant in air @ 293 K
 *                                             is 6.6·10⁻³ m·Pa].
 *     L_char = min over all section gaps (tip clearance, axial gap,
 *     Holweck groove depth, radial clearance).
 *
 * This matches published curves: TwisTorr 74 FS (h ≈ 0.5 mm, P_knee ≈ 13 Pa,
 * drop starts 1–10 Pa), HiPace 300 (h ≈ 0.5 mm, similar), Giors 2006 Holweck
 * (h = 0.3 mm, P_knee ≈ 22 Pa, drop starts ~5 Pa).
 */
export interface SCurvePoint {
  pIn: number;
  S: number;
}

/** λ·P for air at 293 K, m·Pa. */
const LAMBDA_P_AIR = 6.6e-3;

/**
 * Characteristic length for the viscous rolloff — taken as the smallest
 * BULK FLOW channel (axial gap for turbo, groove depth for Holweck). Sealing
 * gaps (tip clearance, radial clearance) are *not* used: they throttle back-
 * flow but don't define where Kn → 1 in the main transport path.
 */
function characteristicGap(inp: PumpInputs): number {
  const gaps: number[] = [];
  if (inp.mode !== "holweck") {
    for (const s of inp.turboStages) {
      if (s.axialGap > 0) gaps.push(s.axialGap);
    }
  }
  if (inp.mode !== "turbo") {
    for (const s of inp.holweckStages) {
      if (s.grooveDepth > 0) gaps.push(s.grooveDepth);
    }
  }
  if (gaps.length === 0) return 1e-3; // fallback 1 mm
  return Math.min(...gaps);
}

export function calcSCurve(
  result: PumpResult,
  pOut: number,
  inputs: PumpInputs,
  nPoints = 60,
): SCurvePoint[] {
  if (!(result.sMaxLps > 0) || !(result.kTotal > 1)) return [];
  const K = result.kTotal;
  const pOutSafe = Math.max(pOut, 1e-6);
  const pStall = pOutSafe / K;

  const Lchar = characteristicGap(inputs);
  // Molar-mass correction for mean free path: λ ∝ 1/(σ·n) ∝ T/P (ideal gas)
  // but weakly depends on gas via σ. Use air value; the factor-of-2 precision
  // is enough for the shape.
  const pKnee = LAMBDA_P_AIR / Math.max(Lchar, 1e-6);

  // Plot range: one decade below operating low end to ~10× P_knee.
  const pMin = Math.min(pStall * 5, 1e-7);
  const pMax = Math.max(pKnee * 20, 10);
  if (!(pMax > pMin)) return [];
  const logMin = Math.log10(pMin);
  const logMax = Math.log10(pMax);
  const step = (logMax - logMin) / (nPoints - 1);
  const pts: SCurvePoint[] = [];
  for (let i = 0; i < nPoints; i++) {
    const pIn = Math.pow(10, logMin + i * step);
    const stall = Math.max(0, 1 - pOutSafe / (K * pIn));
    const viscous = 1 / (1 + Math.pow(pIn / pKnee, 3));
    const S = result.sMaxLps * stall * viscous;
    pts.push({ pIn, S: Math.max(0, S) });
  }
  return pts;
}
