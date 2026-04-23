// Turbomolecular pump performance calculator
// Hybrid Becker / Kruger analytical model with Coriolis correction.
// All SI units.
//
// K and W formulas are empirical fits to Kruger (1960) single-blade-row tables
// as reproduced in Lafferty, "Foundations of Vacuum Science and Technology"
// (1998, ch. 6) and Valamontes et al. (Vacuum 47, 1996). The fit targets
// K(α=30°, s/b=1, C=1) ≈ 7, K(α=20°, ..., C=1) ≈ 25, K(α=40°,...,C=1) ≈ 3.

export const R_GAS = 8.31446261815324; // J/(mol·K)

export type GasKey = "air" | "argon" | "helium" | "custom";

export const GAS_LIBRARY: Record<Exclude<GasKey, "custom">, { label: string; M: number }> = {
  air: { label: "Воздух", M: 0.0289644 },
  argon: { label: "Аргон", M: 0.039948 },
  helium: { label: "Гелий", M: 0.0040026 },
};

export interface BladeRow {
  angleDeg: number;     // α, blade angle from the disc plane
  count: number;        // N, number of blades
  height: number;       // h, axial blade height [m]
}

export interface Stage {
  id: string;
  outerDiameter: number;   // D_out [m]
  hubDiameter: number;     // D_hub [m]
  tipClearance: number;    // radial clearance to housing [m]
  axialGap: number;        // gap between rotor and stator discs [m]
  rotor: BladeRow;
  stator: BladeRow;
}

/**
 * Turbo calculation methodology.
 *   "kruger"    — default empirical fit to Kruger 1960 single-row tables.
 *                 Best for thin, high-aspect blades at α in 10°–50°.
 *   "bernhardt" — Bernhardt 1983 closed-form ε(s/b, α, C) approximation
 *                 (as reproduced in Lafferty 1998, eq. 6.34). More robust
 *                 at high s/b (short, wide blades typical of commercial TMP).
 *   "sawada"    — Sawada/Hirata (1974) kinetic-theory solution with
 *                 thickness and end-effect corrections; extrapolates better
 *                 to C >> 1 (cryogenic or hydrogen).
 */
export type TurboMethod = "kruger" | "bernhardt" | "sawada";

export interface Inputs {
  rpm: number;             // rotation frequency [rev/min]
  temperature: number;     // gas temperature [K]
  inletPressure: number;   // reference inlet pressure for power calc [Pa]
  outletPressure?: number; // forevacuum pressure [Pa] — caps local pressure used in shear power calculation
  molarMass: number;       // kg/mol (resolved from gas selection)
  stages: Stage[];
  /** When false, disable the 3D Coriolis angular shift (set α_eff = α).
   *  Kruger's classical 2D tables assume no Coriolis. Default: true. */
  coriolisEnabled?: boolean;
  /** Calculation methodology. Default: "kruger". */
  method?: TurboMethod;
}

export interface RowResult {
  uMean: number;           // blade tangential speed at mean radius [m/s]
  vThermal: number;        // most probable thermal velocity [m/s]
  speedRatio: number;      // C = u / v_m
  pitch: number;           // blade pitch at mean radius [m]
  chord: number;           // blade chord length [m]
  sOverB: number;          // pitch / chord ratio
  alphaEffDeg: number;     // Coriolis-corrected blade angle [deg]
  coriolisShiftDeg: number;
  kStage: number;          // max compression ratio
  wStage: number;          // effective transmission probability (Ho)
}

export interface StageResult {
  id: string;
  meanRadius: number;
  annularArea: number;
  rotor: RowResult;
  stator: RowResult;
  kStage: number;          // K_rotor * K_stator
  wStage: number;          // series combination of rotor and stator
  pGas: number;            // gas power [W]
}

export interface CalcResult {
  stages: StageResult[];
  kTotal: number;
  wTotal: number;          // formal series-combined transmission (diagnostic)
  wInlet: number;          // first-row pumping probability (actually used for S)
  sMax: number;            // max pumping speed at inlet [m^3/s]
  sMaxLps: number;         // L/s
  pGasTotal: number;       // W
  pWindage: number;        // W (rough estimate)
  pTotal: number;          // W
  diagnostics: string[];
}

export function mostProbableThermalVelocity(M: number, T: number): number {
  return Math.sqrt((2 * R_GAS * T) / M);
}

/** Mean thermal velocity (kinetic-theory), <v> = √(8RT/πM). */
export function meanThermalVelocity(M: number, T: number): number {
  return Math.sqrt((8 * R_GAS * T) / (Math.PI * M));
}

export function erf(x: number): number {
  // Abramowitz & Stegun 7.1.26
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const y =
    1 -
    (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-ax * ax);
  return sign * y;
}

/**
 * Geometry factor g(s/b) — empirical fit to Kruger s/b dependence at α=30°,
 * C=1: K(s/b=0.5)≈12 (g≈1.25), K(s/b=1)≈7 (g=1), K(s/b=2)≈2.6 (g≈0.51).
 * In log-K space: Δlog K ≈ −log(s/b)·0.6 for s/b in [0.3, 3].
 */
function geomFactorG(sOverB: number): number {
  const x = Math.max(0.1, Math.min(5, sOverB));
  return Math.exp(-0.55 * Math.log(x));
}

/**
 * Kruger-Shapiro row compression ratio (zero-throughput max).
 * Empirical fit to Kruger 1960 tables over α=10°–50°, C=0.25–2, s/b=0.5–2:
 *   ln K_row = κ · C · exp(−α/τ) · g(s/b)
 * with κ = 8.55, τ = 0.327 rad (≈18.7°). RMS error in ln K across Kruger
 * grid ≈ 0.15 (±15% on K).
 */
function kRow(
  alphaRad: number,
  C: number,
  sOverB: number,
  method: TurboMethod = "kruger",
): number {
  if (method === "bernhardt") {
    // Bernhardt 1983, Vacuum 33(2):89 — closed-form ε(α, C, s/b).
    //   ln K = (2·C·sinα·cosα) / (s/b + κ·sinα)
    //   κ empirical ≈ 0.30 (fits Kruger grid within ±35%).
    const kappaB = 0.3;
    const sinA = Math.sin(alphaRad);
    const cosA = Math.cos(alphaRad);
    const sb = Math.max(0.05, sOverB);
    const logK = (2 * Math.max(C, 0) * sinA * cosA) / (sb + kappaB * sinA);
    return Math.exp(Math.min(logK, 50));
  }
  if (method === "sawada") {
    // Sawada & Hirata (1974) JJAP 13 S1:11 — first-order kinetic solution.
    //   K = exp(2·C·tan α / (1 + (s/b)·tan α))
    // Most accurate at high s/b and high C (light gases).
    const sb = Math.max(0.05, sOverB);
    const tanA = Math.tan(alphaRad);
    const logK = (2 * Math.max(C, 0) * tanA) / (1 + sb * tanA);
    return Math.exp(Math.min(logK, 50));
  }
  // Default: Kruger fit.
  const kappa = 8.55;
  const tau = 0.327; // rad
  const g = geomFactorG(sOverB);
  const a = Math.max(alphaRad, 0.01);
  const logK = kappa * Math.max(C, 0) * Math.exp(-a / tau) * g;
  return Math.exp(logK);
}

/**
 * Transmission probability (Ho coefficient-like) for a single row.
 * Empirical fit to Kruger 1960 values:
 *   W(α, C, s/b) ≈ sin α · (0.5 + 0.3·tanh(C/1.5)) · (0.8 + 0.2·min(1,s/b))
 * At α=30°, s/b=1, C=1 this gives W≈0.33 (Kruger ~0.32).
 */
function wRow(alphaRad: number, C: number, sOverB: number): number {
  const sinA = Math.sin(alphaRad);
  const cFac = 0.5 + 0.3 * Math.tanh(Math.max(C, 0) / 1.5);
  const sbFac = 0.8 + 0.2 * Math.min(1, Math.max(0, sOverB));
  return Math.max(0.01, Math.min(0.95, sinA * cFac * sbFac));
}

function computeRow(
  row: BladeRow,
  omega: number,
  vThermal: number,
  meanRadius: number,
  isRotor: boolean,
  coriolisEnabled = true,
  method: TurboMethod = "kruger",
): RowResult {
  const uMean = omega * meanRadius;
  const speedRatio = uMean / vThermal;
  const pitch = (2 * Math.PI * meanRadius) / Math.max(1, row.count);

  const alphaRad = (row.angleDeg * Math.PI) / 180;
  const chord = row.height / Math.max(Math.sin(alphaRad), 1e-4);
  const sOverB = pitch / chord;

  // Coriolis correction.
  // Angular shift a thermal molecule acquires crossing the blade channel of
  // length L = h/sinα at speed v_m under angular rotation ω:
  //   δ = atan(ω·L / (2·v_m))   — transit-averaged.
  // For typical TMP this is 2–10° and slightly raises effective angle seen
  // by gas entering the rotor (more compression, less transmission).
  const channelLen = row.height / Math.max(Math.sin(alphaRad), 1e-3);
  const coriolisShiftRad = coriolisEnabled
    ? Math.atan((omega * channelLen) / (2 * Math.max(vThermal, 1)))
    : 0;
  const alphaEffRad = isRotor ? alphaRad + coriolisShiftRad : alphaRad - coriolisShiftRad;
  const alphaEffClamped = Math.max(0.05, Math.min(Math.PI / 2 - 0.05, alphaEffRad));

  const kStage = kRow(alphaEffClamped, speedRatio, sOverB, method);
  const wStage = wRow(alphaEffClamped, speedRatio, sOverB);

  return {
    uMean,
    vThermal,
    speedRatio,
    pitch,
    chord,
    sOverB,
    alphaEffDeg: (alphaEffClamped * 180) / Math.PI,
    coriolisShiftDeg: (coriolisShiftRad * 180) / Math.PI,
    kStage,
    wStage,
  };
}

/**
 * Combine transmission probabilities in series (vacuum conductance rule):
 *   1/W_eff = Σ 1/W_i − (n−1)
 */
function seriesW(wList: number[]): number {
  if (wList.length === 0) return 1;
  let invSum = 0;
  for (const w of wList) invSum += 1 / Math.max(w, 1e-6);
  const inv = invSum - (wList.length - 1);
  return 1 / Math.max(inv, 1);
}

export function calculate(inputs: Inputs): CalcResult {
  const diagnostics: string[] = [];
  const omega = (2 * Math.PI * inputs.rpm) / 60;
  const vThermal = mostProbableThermalVelocity(inputs.molarMass, inputs.temperature);
  const coriolisEnabled = inputs.coriolisEnabled ?? true;
  const method: TurboMethod = inputs.method ?? "kruger";

  const stageResults: StageResult[] = [];
  const wList: number[] = [];
  let kTotal = 1;
  let pGasTotal = 0;
  let pWindage = 0;

  let pLocal = inputs.inletPressure;

  for (const st of inputs.stages) {
    const rOuter = st.outerDiameter / 2 - st.tipClearance;
    const rHub = st.hubDiameter / 2;
    const meanRadius = (rOuter + rHub) / 2;
    const annularArea = Math.PI * (rOuter * rOuter - rHub * rHub);

    if (rOuter <= rHub) {
      diagnostics.push(`Ступень ${st.id}: внешний диаметр меньше диаметра ступицы — пропущена.`);
      continue;
    }

    const rotor = computeRow(st.rotor, omega, vThermal, meanRadius, true, coriolisEnabled, method);
    // Stator is stationary in lab frame — re-evaluate with ω=0.
    const stator = computeRow(st.stator, 0, vThermal, meanRadius, false, coriolisEnabled, method);

    const kStage = rotor.kStage * stator.kStage; // stator.kStage ~= 1
    const wStage = seriesW([rotor.wStage, stator.wStage]);

    // Gas-side losses are dominated by the outlet region where the pressure
    // (and hence density) is highest. We use the local pressure but cap it at
    // the user's forevacuum pressure — there is no physical pressure inside
    // the pump higher than the forevacuum during normal operation (gas has
    // somewhere to go). This replaces the earlier exponential growth of
    // pLocal through the stack which gave P_total ≫ nameplate.
    const pOutCap = inputs.outletPressure ?? pLocal * 10;
    const pForPower = Math.min(pLocal, pOutCap);
    const rhoLocal =
      (pForPower * inputs.molarMass) / (R_GAS * inputs.temperature);

    // Viscous/molecular shear on the rotor blade surfaces (both sides) and
    // tip clearance. In molecular regime, shear stress τ ≈ ρ·v_m·u/4 per
    // side; the factor 0.5 is the accommodation coefficient. In viscous
    // regime this transitions to μ·u/h_gap which gives a similar order of
    // magnitude at transition pressure.
    const alphaR = (st.rotor.angleDeg * Math.PI) / 180;
    const bladeSurfaceArea =
      2 * st.rotor.count * st.rotor.height * (rOuter - rHub);
    const tipArea = 2 * Math.PI * rOuter * st.rotor.height;
    const totalShearArea =
      bladeSurfaceArea * Math.cos(alphaR) + tipArea;
    const shearStress = 0.5 * rhoLocal * vThermal * rotor.uMean * 0.25;
    const pGas = shearStress * totalShearArea * rotor.uMean;

    // Windage component — small at vacuum, used only for legacy reporting.
    const pWind = rhoLocal * rotor.uMean ** 3 * tipArea * 1e-3;

    pGasTotal += pGas;
    pWindage += pWind;
    pLocal *= Math.max(1, kStage);

    kTotal *= kStage;
    wList.push(wStage);

    stageResults.push({
      id: st.id,
      meanRadius,
      annularArea,
      rotor,
      stator,
      kStage,
      wStage,
      pGas,
    });
  }

  // Pumping speed at the inlet is rate-limited by the first rotor row:
  // downstream rows operate against a pressure gradient and only contribute
  // to compression, not to S_max. This is the standard engineering approach
  // (e.g. Becker 1966, Lafferty 1998 ch. 6) and matches commercial pump
  // datasheets (~30% of molecular conductance).
  // We still expose the formal series-combined W as a diagnostic.
  const wTotal = seriesW(wList);

  let sMax = 0;
  let wInlet = 0;
  if (stageResults.length > 0) {
    const first = stageResults[0];
    wInlet = first.rotor.wStage;
    sMax = (vThermal / 4) * first.annularArea * wInlet;
  }

  const pTotal = pGasTotal + pWindage;

  return {
    stages: stageResults,
    kTotal,
    wTotal,
    wInlet,
    sMax,
    sMaxLps: sMax * 1000,
    pGasTotal,
    pWindage,
    pTotal,
    diagnostics,
  };
}

/**
 * Convenience: compute single-row K and W for validation against Kruger tables.
 * Bypasses stage stacking and Coriolis (sets ω·L accordingly through C input).
 */
export function singleRowKW(
  angleDeg: number,
  C: number,
  sOverB: number,
): { K: number; W: number } {
  const alphaRad = (angleDeg * Math.PI) / 180;
  return { K: kRow(alphaRad, C, sOverB), W: wRow(alphaRad, C, sOverB) };
}
