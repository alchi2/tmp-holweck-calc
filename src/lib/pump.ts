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
 * Compute the S(P_in) curve at fixed P_out (forevacuum pressure).
 *
 * Physical model (steady state, free-molecular, single-volume throat):
 *   Q = S · P_in = S_max · (P_in − P_out / K_max)
 *   ⇒ S(P_in) = S_max · (1 − P_out / (K_max · P_in))
 *
 * For P_in · K_max < P_out the pump stalls; we clamp S at 0.
 *
 * For the P_in axis we use 40 log-spaced points between
 * 1.5·P_out/K_max and ~10⁻³·P_out (the usual pump operating range).
 */
export interface SCurvePoint {
  pIn: number;
  S: number;
}

export function calcSCurve(
  result: PumpResult,
  pOut: number,
  nPoints = 60,
): SCurvePoint[] {
  if (!(result.sMaxLps > 0) || !(result.kTotal > 1) || !(pOut > 0)) return [];
  const pStall = pOut / result.kTotal;
  const pMax = Math.max(pOut * 0.5, pStall * 1e6);
  const pMin = pStall * 1.02;
  if (!(pMax > pMin)) return [];
  const logMin = Math.log10(pMin);
  const logMax = Math.log10(pMax);
  const step = (logMax - logMin) / (nPoints - 1);
  const pts: SCurvePoint[] = [];
  for (let i = 0; i < nPoints; i++) {
    const pIn = Math.pow(10, logMin + i * step);
    const S = result.sMaxLps * (1 - pOut / (result.kTotal * pIn));
    pts.push({ pIn, S: Math.max(0, S) });
  }
  return pts;
}
