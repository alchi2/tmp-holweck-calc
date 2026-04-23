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
        outletPressure: inp.outletPressure,
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
        outletPressure: inp.outletPressure,
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
 * Physical model (Sawada 1979 / Skovorodko 2002 transitional Couette-
 * Poiseuille balance for the Holweck channel, composited with the turbo
 * compression assumed pressure-independent):
 *
 *   S(P_in) = S_max · max(0, 1 − P_out/(K_eff(P_avg) · P_in))
 *
 * where the effective compression accounts for the progressive collapse of
 * K from its free-molecular value toward 1 as pressure rises:
 *
 *   K_holweck_eff(P) = 1 + (K_holweck_fm − 1) · f(Kn),
 *                       Kn = (λ·P)_air / (h_channel · P),  f = Kn/(Kn+1)
 *
 *   K_eff = K_turbo · K_holweck_eff(P_avg)
 *   P_avg = √(P_in · P_out)   (geometric mean inside the drag channel)
 *
 * At low P_in (high Kn everywhere), K_eff = K_fm and we get the usual
 * compression-limited rolloff at P_in = P_out/K_fm (far below visible range
 * for typical pumps). At high P_in, K_holweck_eff drops toward 1 and the
 * stall factor goes to zero as P_in → P_out — reproducing the characteristic
 * high-pressure dropoff observed in real datasheets.
 *
 * For pure turbo pumps (no Holweck) we fall back to a geometric Kn-based
 * rolloff using the smallest axial gap: a turbo's compression also drops in
 * the transitional regime, but the exact model (Sawada 1979, Sun 2024) is
 * stage-dependent and we approximate it by the same transition function
 * applied to K_turbo with h_channel = min(axial_gap).
 */
export interface SCurvePoint {
  pIn: number;
  S: number;
  /** Effective compression K at this P_in (for secondary plot). */
  K: number;
}

/** λ·P for air at 293 K, m·Pa. Used as a gas-agnostic default. */
const LAMBDA_P_AIR = 6.6e-3;

function smallestTurboGap(inp: PumpInputs): number {
  const gaps: number[] = [];
  for (const s of inp.turboStages) {
    if (s.axialGap > 0) gaps.push(s.axialGap);
  }
  return gaps.length === 0 ? 1e-3 : Math.min(...gaps);
}

function smallestHolweckGap(result: PumpResult): number {
  const hs = result.holweck?.stages ?? [];
  const gaps = hs
    .map((s) => s.hChannel)
    .filter((g): g is number => typeof g === "number" && g > 0);
  return gaps.length === 0 ? 1e-3 : Math.min(...gaps);
}

/**
 * Sawada 1979 transitional correction to the zero-throughput compression
 * ratio. Derivation (Couette–Poiseuille 1D balance):
 *     ln K(P) = ln K_fm · f(Kn)          f(Kn) = Kn / (Kn + α)
 * with α = 3/π ≈ 0.95 from matching Poiseuille back-flow to Knudsen
 * diffusion at Kn = 1. We use α = 1 for simplicity (<5% effect).
 *
 * At high Kn (molecular): K → K_fm.
 * At low  Kn (viscous):   K → K_fm^(π·Kn/3) → 1  (exponential collapse).
 */
function kAtPressure(kFm: number, h: number, P: number): number {
  if (!(kFm > 1) || !(h > 0) || !(P > 0)) return Math.max(1, kFm);
  const Kn = LAMBDA_P_AIR / (h * P);
  const f = Kn / (Kn + 1);
  return Math.pow(kFm, f);
}

/**
 * Sawada-style pumping speed correction: in the viscous regime the
 * kinetic-flux inlet conductance (v_m·A/4) drops because molecules collide
 * in the bulk and only a small Couette-drag component contributes. We
 * linearly blend between molecular and viscous plateaus with the same
 * f(Kn) transition function:
 *   S_eff(P) = S_max · (r_vi + (1 − r_vi)·f(Kn))
 * where r_vi ≈ 0.02 is the residual viscous-drag fraction (typical Holweck
 * drag in continuum is ~1–5% of the molecular inlet conductance).
 */
function sFractionAtPressure(h: number, P: number): number {
  const R_VISCOUS = 0.02;
  if (!(h > 0) || !(P > 0)) return 1;
  const Kn = LAMBDA_P_AIR / (h * P);
  const f = Kn / (Kn + 1);
  return R_VISCOUS + (1 - R_VISCOUS) * f;
}

/**
 * Build the S(P_in) curve. Additional parameters:
 *   qMaxPaLps  — maximum throughput the backing pump can handle [Pa·L/s].
 *               Datasheet curves are measured at a fixed foreline setup, so
 *               beyond Q = S·P_in > Q_max the foreline pressure rises, the
 *               pump stalls, and the observed S drops as 1/P_in. Defaults
 *               to 1000 Pa·L/s (≈ 10 L/s backing pump at ≤100 Pa foreline).
 */
/**
 * Zero-throughput compression curve K(P_out) — the quantity measured in
 * Sawada 1999 Fig. 4 and Sharipov 2005 Fig. 7. At P_out < P_knee (molecular
 * regime) K → K_fm; at high P_out the Sawada transition collapses K → 1.
 */
export interface KCurvePoint {
  pOut: number;
  K: number;
}

export function calcKCurve(
  result: PumpResult,
  inputs: PumpInputs,
  pMin?: number,
  pMax?: number,
  nPoints = 80,
): KCurvePoint[] {
  if (!(result.kTotal > 1)) return [];
  const kTurbo = result.turbo?.kTotal ?? 1;
  const kHolweckFm = result.holweck?.kTotal ?? 1;

  const hHolweck = smallestHolweckGap(result);
  const hTurbo = smallestTurboGap(inputs);

  const pLo = pMin ?? 1e-2;
  const pHi = pMax ?? 1e5;
  if (!(pHi > pLo)) return [];
  const logMin = Math.log10(pLo);
  const logMax = Math.log10(pHi);
  const step = (logMax - logMin) / (nPoints - 1);
  const pts: KCurvePoint[] = [];
  for (let i = 0; i < nPoints; i++) {
    const pOut = Math.pow(10, logMin + i * step);
    // For zero-flow K measurement the relevant Knudsen pressure is P_out
    // itself (inlet pressure is P_out/K which is much smaller and doesn't
    // affect transition).
    const kH = kHolweckFm > 1 ? kAtPressure(kHolweckFm, hHolweck, pOut) : 1;
    const kT = kTurbo > 1 ? kAtPressure(kTurbo, hTurbo, pOut) : 1;
    pts.push({ pOut, K: kT * kH });
  }
  return pts;
}

export function calcSCurve(
  result: PumpResult,
  pOut: number,
  inputs: PumpInputs,
  qMaxPaLps = 1000,
  nPoints = 80,
): SCurvePoint[] {
  if (!(result.sMaxLps > 0) || !(result.kTotal > 1)) return [];
  const pOutSafe = Math.max(pOut, 1e-6);
  const kTurbo = result.turbo?.kTotal ?? 1;
  const kHolweckFm = result.holweck?.kTotal ?? 1;

  const hHolweck = smallestHolweckGap(result);
  const hTurbo = smallestTurboGap(inputs);
  const hAny = Math.min(hHolweck, hTurbo);

  // Plot range: from the stall edge down a bit for context, up to where the
  // throughput-limited curve (Q_max / P_in) has dropped to ~0.5% of S_max.
  const pStall = pOutSafe / result.kTotal;
  const pThroughputFall = qMaxPaLps / (0.005 * result.sMaxLps);
  const pMin = Math.min(pStall * 0.3, 1e-7);
  const pMax = Math.max(pOutSafe * 2, pThroughputFall);
  if (!(pMax > pMin)) return [];

  const logMin = Math.log10(pMin);
  const logMax = Math.log10(pMax);
  const step = (logMax - logMin) / (nPoints - 1);
  const pts: SCurvePoint[] = [];
  for (let i = 0; i < nPoints; i++) {
    const pIn = Math.pow(10, logMin + i * step);
    const pAvg = Math.sqrt(pIn * pOutSafe);

    const kH = kHolweckFm > 1 ? kAtPressure(kHolweckFm, hHolweck, pAvg) : 1;
    const kT = kTurbo > 1 ? kAtPressure(kTurbo, hTurbo, pAvg) : 1;
    const K = kT * kH;

    const sFrac = sFractionAtPressure(hAny, pAvg);
    const stall = Math.max(0, 1 - pOutSafe / (K * pIn));
    const S_compression = result.sMaxLps * sFrac * stall;
    // Throughput-limited envelope (backing-pump capacity).
    const S_throughput = qMaxPaLps / Math.max(pIn, 1e-12);
    const S = Math.min(S_compression, S_throughput);
    pts.push({ pIn, S: Math.max(0, S), K });
  }
  return pts;
}
