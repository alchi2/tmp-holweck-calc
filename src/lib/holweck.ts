// Holweck drag-stage performance calculator.
// Model: single-start or multi-start helical grooves cut in a stationary
// cylindrical stator, smooth cylindrical rotor spinning concentrically inside.
// Free-molecular regime, diffuse reflection.
//
// Physics follows Sickafus, Nelson & Lowry (1961) "Holweck Type Molecular
// Pump", US-AEC report NYO-9256 (OSTI 4833839), combined with the
// Mongodin & Prévot (1957) integrated form, as reproduced in:
//   - A. Roth, "Vacuum Technology" (Elsevier, 3rd ed. 1990, §6.4)
//   - K. Jousten (ed.), "Handbook of Vacuum Technology" (Wiley 2008, §7.4)
//   - Giors, Subba & Zanino, J. Vac. Sci. Technol. A 24(4) 2006.
//
// Core formulas (SI, per groove, zero-throughput compression ratio):
//   u        = π · D · N / 60           peripheral speed at rotor surface
//   θ        = helix angle measured from the axial direction
//   L        = axial length of the drag stage
//   h        = groove depth, s = groove width, w = land width (circumferential)
//   δ        = radial clearance between rotor OD and stator ID (over lands)
//   n        = number of helix starts
//   v_m      = most-probable thermal velocity of the gas = √(2RT/M)
//
//   drift velocity along the groove:
//     v̄ = u · cos θ · (s / (s + w))        // duty cycle: moving wall fraction
//   drag-induced volumetric flow rate (per groove, at any cross-section):
//     Q_drag = v̄ · A_gr  = v̄ · h · s
//   pressure-driven molecular back-flow conductance per unit length
//   (Knudsen, rectangular channel ~ A²·v_m/C, plus clearance leakage over lands):
//     G / dL = (h·s)² · v_m · (4 / (3 · (2·h + 2·s)))                [groove]
//            + (w · δ)² · v_m · (4 / (3 · (2·w + 2·δ))) · (1/n)       [lands]
//   Net local mass balance (Sickafus eq.16):
//     Q_drag - G_total · dP/dξ = Q_net         with Q_net = const
//   Zero-throughput ⇒ K_max = exp(Q_drag · L_helix / G_total),
//   where L_helix = L / sin θ (path length in groove).
//
//   Using the commonly quoted engineering form:
//     ln K_max = (u · sin θ · cos θ · L) / (v_m · h_eff)
//     h_eff    = h + ((w/s) · δ² / h) · (1 / cos θ)
//   (see Jousten 2008 eq. 7.56 — equivalent to Sickafus after algebra.)
//
//   Pumping speed (molecular, per Sickafus eq.22 with drag limit):
//     S_drag  = v̄ · A_gr · n_start            // volumetric drag
//     S_therm = (v_m / 4) · A_inlet           // thermal diffusion at inlet
//     S_max   = min(S_drag, S_therm) · (1 − 1/K_local)
//   where A_inlet is the annular groove-end area n · h · s / sin θ.

import { R_GAS, mostProbableThermalVelocity } from "./tmp";

export interface HolweckStage {
  id: string;
  /** Outer rotor diameter [m]. */
  rotorDiameter: number;
  /** Axial length of the drag section [m]. */
  length: number;
  /** Helix angle θ from axial direction [deg]. Typical 6°–15°. */
  helixAngleDeg: number;
  /** Groove depth (radial) [m]. Typical 0.5–3 mm. */
  grooveDepth: number;
  /** Groove width (circumferential, top) [m]. */
  grooveWidth: number;
  /** Land width between grooves (circumferential) [m]. */
  landWidth: number;
  /** Radial clearance between rotor OD and stator lands [m]. */
  radialClearance: number;
  /** Number of helix starts (parallel grooves). Default 1. */
  startCount: number;
  /** Whether grooves are cut in the stator (true, classical Holweck) or rotor (false). */
  grooveOnStator: boolean;
}

export interface HolweckResult {
  id: string;
  /** Peripheral rotor velocity [m/s]. */
  uPeripheral: number;
  /** v_m [m/s]. */
  vThermal: number;
  /** Duty cycle s/(s+w). */
  duty: number;
  /** Drag drift velocity v̄ along the groove [m/s]. */
  vDrift: number;
  /** Geometrically-required number of starts n = π·D/(s+w). */
  nGeom: number;
  /** User-specified number of starts. */
  nSpec: number;
  /** Effective gap h_eff used in K integration [m]. */
  hEff: number;
  /** ln K_max. */
  logKmax: number;
  /** K_max = exp(ln K). Capped at 1e20 to avoid overflow. */
  kMax: number;
  /** Drag volumetric flow [m³/s] — the kinematic pumping speed upper bound. */
  sDrag: number;
  /** Thermal-diffusion limited inlet speed [m³/s]. */
  sTherm: number;
  /** S_max = min(sDrag, sTherm), throttled by clearance backflow. [m³/s] */
  sMax: number;
  /** Convenience [L/s]. */
  sMaxLps: number;
  /** Gas dissipated power [W] (rough: τ·ω ≈ ρ·u²·A_gap·ν_friction). */
  pGas: number;
}

export interface HolweckInputs {
  rpm: number;
  temperature: number;
  molarMass: number;
  /** Gas inlet pressure [Pa] used only for power estimate. */
  inletPressure: number;
  stages: HolweckStage[];
}

export interface HolweckCalc {
  stages: HolweckResult[];
  /** Π K_max over all Holweck stages. */
  kTotal: number;
  /** Min of stage S_max values (series conductance ~ weakest link at inlet). */
  sMaxLps: number;
  pGasTotal: number;
  diagnostics: string[];
}

/**
 * Compute ln K_max and S for one Holweck stage with the Sickafus/Jousten model.
 */
export function calcHolweckStage(
  stage: HolweckStage,
  omega: number,
  vThermal: number,
  inletPressure: number,
  molarMass: number,
  temperature: number,
): HolweckResult {
  const D = Math.max(stage.rotorDiameter, 1e-4);
  const u = omega * D * 0.5;
  const thetaRad = Math.max(
    0.5 * (Math.PI / 180),
    Math.min(
      (stage.helixAngleDeg * Math.PI) / 180,
      (80 * Math.PI) / 180,
    ),
  );

  const h = Math.max(stage.grooveDepth, 1e-6);
  const s = Math.max(stage.grooveWidth, 1e-6);
  const w = Math.max(stage.landWidth, 1e-7);
  const delta = Math.max(stage.radialClearance, 1e-7);
  const n = Math.max(1, Math.round(stage.startCount));
  const L = Math.max(stage.length, 1e-4);

  const duty = s / (s + w);
  const vDrift = u * Math.cos(thetaRad) * duty;

  // Effective gap accounting for back-flow through land clearance:
  //   h_eff = h + (w/s)·(δ² / h)·(1/cos θ)
  // Bigger δ or smaller groove ⇒ more leakage ⇒ smaller K.
  const hEff =
    h + (w / s) * ((delta * delta) / h) * (1 / Math.max(Math.cos(thetaRad), 1e-3));

  //   ln K_max = (u · sin θ · cos θ · L) / (v_m · h_eff)
  // Multi-start grooves do NOT multiply K (same path length).
  // Sickafus argument: for multiple-start spirals the drag flow rises as n,
  // but so does the back-flow cross-section, so K is unchanged.
  const logKmax =
    (u * Math.sin(thetaRad) * Math.cos(thetaRad) * L) /
    Math.max(vThermal * hEff, 1e-9);
  const kMax = Math.exp(Math.min(logKmax, 50));

  // Geometric consistency check. In a multi-start Holweck the n helical
  // grooves fill the circumference, so (s+w)·n ≈ π·D. We compute the
  // "geometric" n from (s+w) and use it for flow rates (the user-supplied
  // startCount is kept for documentation / display only).
  const nGeom = Math.max(1, (Math.PI * D) / Math.max(s + w, 1e-6));

  // Axial cross-section open to gas (annulus restricted by duty cycle):
  //   A_inlet = π·D · h · duty
  const AInlet = Math.PI * D * h * duty;

  // Volumetric drag (kinematic) flow — all n grooves combined:
  //   S_drag = n · v̄ · h · s  =  (π·D/(s+w)) · (u·cosθ·duty) · h · s
  //          = π·D · h · u · cos θ · duty²
  const sDrag = Math.PI * D * h * u * Math.cos(thetaRad) * duty * duty;

  // Thermal diffusion limit at the annular inlet.
  const sTherm = (vThermal / 4) * AInlet;

  // For high K, S_max approaches the kinematic drag speed; for low K it
  // is throttled by back-flow: S_max = S_drag · (1 − 1/K_stage).
  const throttle = kMax > 1 ? 1 - 1 / kMax : 0;
  const sMax = Math.min(sDrag, sTherm) * throttle;

  // Gas power: rough τ·ω ≈ ρ·u²·(π D L)·f_friction (f≈0.02 for molecular slip).
  const rho = (inletPressure * molarMass) / (R_GAS * temperature);
  const aSide = Math.PI * D * L;
  const pGas = rho * u * u * aSide * 0.02;

  return {
    id: stage.id,
    uPeripheral: u,
    vThermal,
    duty,
    vDrift,
    nGeom,
    nSpec: n,
    hEff,
    logKmax,
    kMax,
    sDrag,
    sTherm,
    sMax,
    sMaxLps: sMax * 1000,
    pGas,
  };
}

export function calcHolweck(inputs: HolweckInputs): HolweckCalc {
  const diagnostics: string[] = [];
  const omega = (2 * Math.PI * inputs.rpm) / 60;
  const vThermal = mostProbableThermalVelocity(
    inputs.molarMass,
    inputs.temperature,
  );

  const results: HolweckResult[] = [];
  let pGasTotal = 0;
  let kTotal = 1;

  for (const st of inputs.stages) {
    const r = calcHolweckStage(
      st,
      omega,
      vThermal,
      inputs.inletPressure,
      inputs.molarMass,
      inputs.temperature,
    );
    results.push(r);
    kTotal *= r.kMax;
    pGasTotal += r.pGas;
  }

  // Series: S at inlet is the minimum of stage S (each stage downstream
  // limits throughput once fully pressurized).
  let sMaxLps = Infinity;
  for (const r of results) sMaxLps = Math.min(sMaxLps, r.sMaxLps);
  if (!isFinite(sMaxLps)) sMaxLps = 0;

  if (results.some((r) => r.logKmax > 40)) {
    diagnostics.push(
      "Одна или более ступеней достигли предела по K (exp(40)≈2·10¹⁷). Значение обрезано.",
    );
  }

  return {
    stages: results,
    kTotal,
    sMaxLps,
    pGasTotal,
    diagnostics,
  };
}

export function defaultHolweckStage(id = "H-1"): HolweckStage {
  return {
    id,
    rotorDiameter: 0.08,
    length: 0.04,
    helixAngleDeg: 10,
    grooveDepth: 0.002,
    grooveWidth: 0.003,
    landWidth: 0.001,
    radialClearance: 0.0002,
    startCount: 4,
    grooveOnStator: true,
  };
}
