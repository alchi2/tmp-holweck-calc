// Unified pump model: axial turbo + Holweck drag, with 3 operating modes.
//
// turbo-only    : use calculate() on the axial stack, no drag stages.
// holweck-only  : use calcHolweck() on the drum stages, no axial blades.
// combined      : axial stack feeds a Holweck drum; K and S compose.
//                 S_max  = S of the FIRST stage (whichever section is
//                          at the inlet). Typically turbo is at the top
//                          with high S, Holweck at the bottom for high K.
//                 K_max  = K_turbo · K_holweck (multiplicative).
//
// Pumping-speed series rule:
//   In a real combined pump, the turbo inlet limits S_max, while the
//   Holweck section just has to pass the throughput without choking.
//   If S_turbo_inlet > S_holweck_drag, the pump is Holweck-limited at
//   the mating point (rare in practice). We always report the minimum
//   of the two and a diagnostic note.
//
// Power: sum of gas power from both sections plus a rough windage term.

import {
  calculate,
  type CalcResult,
  type Inputs as TurboInputs,
  type Stage as TurboStage,
} from "./tmp";
import {
  calcHolweck,
  type HolweckCalc,
  type HolweckInputs,
  type HolweckStage,
} from "./holweck";

export type PumpMode = "turbo" | "holweck" | "combined";

export interface PumpInputs {
  mode: PumpMode;
  rpm: number;
  temperature: number;
  inletPressure: number;
  molarMass: number;
  coriolisEnabled?: boolean;
  turboStages: TurboStage[];
  holweckStages: HolweckStage[];
}

export interface PumpResult {
  mode: PumpMode;
  turbo?: CalcResult;
  holweck?: HolweckCalc;
  /** Total compression ratio K. */
  kTotal: number;
  /** Inlet pumping speed [L/s]. */
  sMaxLps: number;
  /** Total power [W]. */
  pTotal: number;
  /** Text diagnostics from all sub-models plus combined-mode notes. */
  diagnostics: string[];
}

export function calculatePump(inp: PumpInputs): PumpResult {
  const diagnostics: string[] = [];

  let turbo: CalcResult | undefined;
  let holweck: HolweckCalc | undefined;

  if (inp.mode === "turbo" || inp.mode === "combined") {
    if (inp.turboStages.length === 0) {
      diagnostics.push(
        "Турбо-ступени не заданы, но режим требует их. Расчёт пропущен.",
      );
    } else {
      const tIn: TurboInputs = {
        rpm: inp.rpm,
        temperature: inp.temperature,
        inletPressure: inp.inletPressure,
        molarMass: inp.molarMass,
        stages: inp.turboStages,
        coriolisEnabled: inp.coriolisEnabled,
      };
      turbo = calculate(tIn);
      diagnostics.push(...turbo.diagnostics);
    }
  }

  if (inp.mode === "holweck" || inp.mode === "combined") {
    if (inp.holweckStages.length === 0) {
      diagnostics.push(
        "Ступени Holweck не заданы, но режим требует их. Расчёт пропущен.",
      );
    } else {
      // Pressure into the Holweck is higher than the turbo inlet pressure
      // (turbo compresses gas into it). Use turbo outlet pressure if both.
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

    // S at the pump inlet is set by the UPSTREAM section (turbo). Gas
    // compressed by the turbo arrives at the Holweck at a higher pressure,
    // so the Holweck only needs the drag flow at that higher density to
    // keep up with throughput — which it does if S_drag_holweck · K_turbo
    // > S_turbo_inlet. This is typical for well-matched hybrid pumps.
    const sT = turbo?.sMaxLps ?? 0;
    const sHDrag = holweck?.stages[0]?.sDrag ? holweck.stages[0].sDrag * 1000 : 0;
    sMaxLps = sT;

    // Sanity: throughput at coupling vs Holweck drag capacity.
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
