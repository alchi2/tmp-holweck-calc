import type { GasKey, Stage as TurboStage } from "./tmp";
import type { HolweckStage } from "./holweck";
import type { PumpMode } from "./pump";

export interface Preset {
  id: string;
  label: string;
  description: string;
  source: string;
  sourceUrl?: string;
  rpm: number;
  temperature: number;
  inletPressure: number;
  gas: GasKey;
  customM?: number;
  mode: PumpMode;
  turboStages: TurboStage[];
  holweckStages: HolweckStage[];
  /** What kind of comparison to do.
   *  'turboSingleRow' => use the rotor row of the first turbo stage (Kruger).
   *  'turboFull'      => full turbo pump (S and K_total).
   *  'holweckSingle'  => single Holweck stage (K_max, S).
   *  'combined'       => turbo+Holweck combined pump. */
  kind: "turboSingleRow" | "turboFull" | "holweckSingle" | "combined";
  coriolisEnabled: boolean;
  expected: {
    K?: number;
    W?: number;
    sMaxLps?: number;
    /** Forevacuum pressure [Pa] at which the expected K and S apply. */
    outletPressure?: number;
    /**
     * Backing-pump throughput capacity [Pa·L/s] used for S(P_in) envelope.
     * Sets where the high-P rolloff starts: S ≤ Q_max/P_in.
     */
    qMaxPaLps?: number;
  };
  /** Digitized S(P_in) reference curve from datasheet/paper. */
  sCurve?: { pIn: number; S: number }[];
  /** Digitized K(P_out) reference curve. */
  kCurve?: { pOut: number; K: number }[];
  notes?: string;
}

// ── Kruger presets (axial turbo single-row) ────────────────────────────────
const KRUGER_R_MEAN = 0.05;
const KRUGER_V_M = 411;

function singleRowStage(angleDeg: number, sOverB: number, h = 0.010): TurboStage {
  const alphaRad = (angleDeg * Math.PI) / 180;
  const chord = h / Math.sin(alphaRad);
  const pitchTarget = sOverB * chord;
  const N = Math.max(2, Math.round((2 * Math.PI * KRUGER_R_MEAN) / pitchTarget));
  const halfWidth = 0.005;
  return {
    id: "row",
    outerDiameter: 2 * (KRUGER_R_MEAN + halfWidth) + 2 * 0.0002,
    hubDiameter: 2 * (KRUGER_R_MEAN - halfWidth),
    tipClearance: 0.0002,
    axialGap: 0.001,
    rotor: { angleDeg, count: N, height: h },
    stator: { angleDeg: 88, count: 4, height: 0.001 },
  };
}

function rpmForC(C: number): number {
  const u = C * KRUGER_V_M;
  const omega = u / KRUGER_R_MEAN;
  return (omega * 60) / (2 * Math.PI);
}

// ── Helpers for full TMP presets ───────────────────────────────────────────
function turboStack(
  N: number,
  outer0: number,
  outerEnd: number,
  hub: number,
  angle0: number,
  angleEnd: number,
  count: number,
  h0: number,
  hEnd: number,
  tipClear = 0.0003,
  axialGap = 0.0008,
): TurboStage[] {
  return Array.from({ length: N }, (_, i) => {
    const f = i / Math.max(1, N - 1);
    const outer = outer0 + (outerEnd - outer0) * f;
    const angleDeg = angle0 + (angleEnd - angle0) * f;
    const h = h0 + (hEnd - h0) * f;
    return {
      id: `T-${i + 1}`,
      outerDiameter: outer,
      hubDiameter: hub,
      tipClearance: tipClear,
      axialGap,
      rotor: { angleDeg, count, height: h },
      stator: { angleDeg, count, height: h },
    };
  });
}

// ── PRESETS ────────────────────────────────────────────────────────────────
export const PRESETS: Preset[] = [
  // ── Kruger 1960 single-blade-row ────────────────────────────────────────
  {
    id: "kruger-a30-C1-sb1",
    label: "Kruger 1960: α=30°, s/b=1, C=1",
    description:
      "Классический тест одного ряда лопаток по таблицам Kruger 1960 (методом Монте-Карло).",
    source: "Kruger, PhD thesis MIT 1960 / Lafferty 1998, ch. 6",
    rpm: rpmForC(1.0),
    temperature: 293.15,
    inletPressure: 1e-4,
    gas: "air",
    mode: "turbo",
    turboStages: [singleRowStage(30, 1.0)],
    holweckStages: [],
    kind: "turboSingleRow",
    coriolisEnabled: false,
    expected: { K: 7.0, W: 0.32 },
    notes: "Эталонные K и W взяты из сводных таблиц Kruger, α=30°, s/b=1, C=1.",
  },
  {
    id: "kruger-a20-C1-sb1",
    label: "Kruger 1960: α=20°, s/b=1, C=1",
    description: "Узкий угол лопатки — высокое сжатие, низкая проводимость.",
    source: "Kruger 1960",
    rpm: rpmForC(1.0),
    temperature: 293.15,
    inletPressure: 1e-4,
    gas: "air",
    mode: "turbo",
    turboStages: [singleRowStage(20, 1.0)],
    holweckStages: [],
    kind: "turboSingleRow",
    coriolisEnabled: false,
    expected: { K: 25, W: 0.22 },
  },
  {
    id: "kruger-a40-C1-sb1",
    label: "Kruger 1960: α=40°, s/b=1, C=1",
    description: "Широкий угол лопатки — низкое сжатие, высокая проводимость.",
    source: "Kruger 1960",
    rpm: rpmForC(1.0),
    temperature: 293.15,
    inletPressure: 1e-4,
    gas: "air",
    mode: "turbo",
    turboStages: [singleRowStage(40, 1.0)],
    holweckStages: [],
    kind: "turboSingleRow",
    coriolisEnabled: false,
    expected: { K: 3.0, W: 0.40 },
  },
  {
    id: "kruger-a30-C2-sb1",
    label: "Kruger 1960: α=30°, s/b=1, C=2",
    description: "Высокая скорость ротора, K растёт экспоненциально с C.",
    source: "Kruger 1960",
    rpm: rpmForC(2.0),
    temperature: 293.15,
    inletPressure: 1e-4,
    gas: "air",
    mode: "turbo",
    turboStages: [singleRowStage(30, 1.0)],
    holweckStages: [],
    kind: "turboSingleRow",
    coriolisEnabled: false,
    expected: { K: 50, W: 0.40 },
  },
  {
    id: "kruger-a30-C05-sb05",
    label: "Kruger 1960: α=30°, s/b=0.5, C=1",
    description: "Плотная упаковка лопаток — многократное отражение повышает K.",
    source: "Kruger 1960",
    rpm: rpmForC(1.0),
    temperature: 293.15,
    inletPressure: 1e-4,
    gas: "air",
    mode: "turbo",
    turboStages: [singleRowStage(30, 0.5)],
    holweckStages: [],
    kind: "turboSingleRow",
    coriolisEnabled: false,
    expected: { K: 12, W: 0.28 },
  },

  // ── Commercial pure-turbo TMPs ──────────────────────────────────────────
  {
    id: "pfeiffer-hipace-300",
    label: "Pfeiffer HiPace 300 (только турбо-секция)",
    description:
      "12-ступенчатый осевой стек (K-Holweck здесь не учитывается). Для полного насоса используйте пресет 'combined'.",
    source: "Pfeiffer Vacuum — HiPace 300 datasheet",
    sourceUrl:
      "https://www.pfeiffer-vacuum.com/en/products/turbopumps/hybrid-bearing/hipace-300/",
    rpm: 60000,
    temperature: 293.15,
    inletPressure: 1e-3,
    gas: "air",
    mode: "turbo",
    turboStages: turboStack(12, 0.10, 0.085, 0.045, 15, 40, 40, 0.012, 0.008),
    holweckStages: [],
    kind: "turboFull",
    coriolisEnabled: true,
    expected: { sMaxLps: 260 },
    notes:
      "Только осевой стек. Полная компрессия K>1e11 у реального насоса включает выходную Holweck-ступень.",
  },

  // ── Holweck single-stage presets (pure drag pump) ──────────────────────
  {
    id: "holweck-textbook-1",
    label: "Holweck учебный пример (N₂, 30k об/мин)",
    description:
      "Типичная конфигурация Holweck по Jousten 2008 (§7.4): D=80 мм, L=40 мм, θ=12°, h=0.5 мм.",
    source: "Jousten (ed.), Handbook of Vacuum Technology (Wiley 2008), §7.4",
    rpm: 30000,
    temperature: 293.15,
    inletPressure: 1e-2,
    gas: "air",
    mode: "holweck",
    turboStages: [],
    holweckStages: [
      {
        id: "H-1",
        rotorDiameter: 0.08,
        length: 0.04,
        helixAngleDeg: 12,
        grooveDepth: 0.0005,
        grooveWidth: 0.005,
        landWidth: 0.001,
        radialClearance: 0.00015,
        startCount: 40,
        grooveOnStator: true,
      },
    ],
    kind: "holweckSingle",
    coriolisEnabled: false,
    expected: { K: 1e3, sMaxLps: 15, outletPressure: 0.1, qMaxPaLps: 150 },
    // Типичная S(P_вх) Holweck-ступени (Jousten §7.4, Fig.7.31):
    // плоская до ~1 Па, затем вязкий спад до ~30 Па.
    sCurve: [
      { pIn: 1e-3, S: 15 },
      { pIn: 1e-2, S: 15 },
      { pIn: 0.1, S: 15 },
      { pIn: 1, S: 14 },
      { pIn: 5, S: 10 },
      { pIn: 10, S: 5 },
      { pIn: 20, S: 1 },
      { pIn: 30, S: 0 },
    ],
    notes:
      "Типичная одноступенчатая Holweck-секция. K в диапазоне 500–2000, S ~15 л/с по N₂, форвакуум ≤ 100 Па.",
  },
  {
    id: "holweck-giors-2006",
    label: "Holweck Giors 2006 (DSMC, N₂, 60k об/мин)",
    description:
      "Тестовая геометрия из статьи Giors/Subba/Zanino 2006 (J. Vac. Sci. Technol. A): D=60 мм, L=30 мм.",
    source: "Giors, Subba, Zanino — JVSTA 24(4), 2006",
    sourceUrl: "https://doi.org/10.1116/1.2210946",
    rpm: 60000,
    temperature: 293.15,
    inletPressure: 1e-3,
    gas: "air",
    mode: "holweck",
    turboStages: [],
    holweckStages: [
      {
        id: "H-1",
        rotorDiameter: 0.06,
        length: 0.03,
        helixAngleDeg: 10,
        grooveDepth: 0.0003,
        grooveWidth: 0.003,
        landWidth: 0.0003,
        radialClearance: 0.0001,
        startCount: 57,
        grooveOnStator: true,
      },
    ],
    kind: "holweckSingle",
    coriolisEnabled: false,
    expected: { K: 500, sMaxLps: 5, outletPressure: 0.01, qMaxPaLps: 300 },
    // Giors 2006 Fig.6-7 — S(P_in) в молекулярном режиме плоская,
    // вязкий спад в переходной области Kn~1 (~60 Па для этой геометрии).
    sCurve: [
      { pIn: 1e-4, S: 5 },
      { pIn: 1e-3, S: 5 },
      { pIn: 1e-2, S: 5 },
      { pIn: 0.1, S: 5 },
      { pIn: 1, S: 4.9 },
      { pIn: 10, S: 4.3 },
      { pIn: 50, S: 2 },
      { pIn: 100, S: 0.3 },
      { pIn: 200, S: 0 },
    ],
    notes:
      "Значения K и S извлечены из графиков статьи, геометрия по описанию в тексте. Указанные эталонные значения — порядок величины.",
  },
  {
    id: "holweck-helium",
    label: "Holweck по He (низкое K для лёгких газов)",
    description:
      "Та же геометрия Giors 2006, но для гелия — демонстрирует падение K для лёгких газов.",
    source: "Kuang et al. 2025, Phys. Fluids (DSMC + эксперимент)",
    sourceUrl: "https://doi.org/10.1063/5.0302992",
    rpm: 60000,
    temperature: 293.15,
    inletPressure: 1e-3,
    gas: "helium",
    mode: "holweck",
    turboStages: [],
    holweckStages: [
      {
        id: "H-1",
        rotorDiameter: 0.06,
        length: 0.03,
        helixAngleDeg: 10,
        grooveDepth: 0.0003,
        grooveWidth: 0.003,
        landWidth: 0.0003,
        radialClearance: 0.0001,
        startCount: 57,
        grooveOnStator: true,
      },
    ],
    kind: "holweckSingle",
    coriolisEnabled: false,
    expected: { K: 10, sMaxLps: 8, outletPressure: 10 },
    notes:
      "Для He v_m в 2.6 раза выше, чем для N₂ → показатель экспоненты K падает, K ≈ 10.",
  },

  // ── Combined turbo+Holweck commercial pumps ────────────────────────────
  {
    id: "twistorr74-combined",
    label: "Agilent TwisTorr 74 FS (турбо + drag)",
    description:
      "Гибридный насос: 5 осевых ступеней + Siegbahn-style drag. 70k об/мин, N₂: S=60 л/с, K=10⁹.",
    source: "Agilent — TwisTorr 74 FS datasheet",
    sourceUrl:
      "https://idealvac.com/files/manuals/Ideal_Vacuum_Agilent-TwisTorr-74-FS-data-sheet.pdf",
    rpm: 70000,
    temperature: 293.15,
    inletPressure: 1e-3,
    gas: "air",
    mode: "combined",
    turboStages: turboStack(5, 0.065, 0.055, 0.025, 18, 38, 36, 0.010, 0.006),
    holweckStages: [
      {
        id: "H-1",
        rotorDiameter: 0.055,
        length: 0.03,
        helixAngleDeg: 9,
        grooveDepth: 0.0005,
        grooveWidth: 0.003,
        landWidth: 0.0005,
        radialClearance: 0.0001,
        startCount: 50,
        grooveOnStator: true,
      },
    ],
    kind: "combined",
    coriolisEnabled: true,
    expected: { K: 1e9, sMaxLps: 60, outletPressure: 1, qMaxPaLps: 200 },
    // Agilent TwisTorr 74 FS: S плоская от 10⁻₇ до ~1 Па, вязкий спад
    // в диапазоне 5–50 Па. Foreline tolerance = 12 мбар ≈ 1200 Па.
    sCurve: [
      { pIn: 1e-7, S: 60 },
      { pIn: 1e-5, S: 60 },
      { pIn: 1e-3, S: 60 },
      { pIn: 1e-2, S: 60 },
      { pIn: 0.1, S: 60 },
      { pIn: 1, S: 60 },
      { pIn: 3, S: 55 },
      { pIn: 10, S: 35 },
      { pIn: 30, S: 8 },
      { pIn: 60, S: 0 },
    ],
    notes:
      "Siegbahn-тип (спиральный плоский) аппроксимирован как Holweck-дисковый эквивалент. S(P_in) и foreline tolerance взяты из Agilent datasheet.",
  },
  {
    id: "hipace-300-combined",
    label: "Pfeiffer HiPace 300 (турбо + Holweck)",
    description:
      "Полный гибридный насос: 12 осевых ступеней + выходная Holweck-ступень. 60k об/мин, N₂: S=260 л/с, K>10¹¹.",
    source: "Pfeiffer Vacuum — HiPace 300 datasheet",
    sourceUrl:
      "https://www.pfeiffer-vacuum.com/en/products/turbopumps/hybrid-bearing/hipace-300/",
    rpm: 60000,
    temperature: 293.15,
    inletPressure: 1e-3,
    gas: "air",
    mode: "combined",
    turboStages: turboStack(10, 0.10, 0.085, 0.045, 15, 38, 40, 0.012, 0.008),
    holweckStages: [
      {
        id: "H-1",
        rotorDiameter: 0.08,
        length: 0.05,
        helixAngleDeg: 10,
        grooveDepth: 0.0005,
        grooveWidth: 0.004,
        landWidth: 0.001,
        radialClearance: 0.0002,
        startCount: 50,
        grooveOnStator: true,
      },
    ],
    kind: "combined",
    coriolisEnabled: true,
    expected: { K: 1e11, sMaxLps: 260, outletPressure: 1, qMaxPaLps: 700 },
    // Pfeiffer HiPace 300: S_N2 = 260 L/s, max foreline 15 мбар.
    // Datasheet graph: S плоская до ~1 Па, вязкий спад 5–50 Па.
    sCurve: [
      { pIn: 1e-7, S: 260 },
      { pIn: 1e-5, S: 260 },
      { pIn: 1e-3, S: 260 },
      { pIn: 0.1, S: 260 },
      { pIn: 1, S: 260 },
      { pIn: 3, S: 255 },
      { pIn: 10, S: 190 },
      { pIn: 30, S: 60 },
      { pIn: 60, S: 5 },
      { pIn: 100, S: 0 },
    ],
    notes:
      "Геометрия оценена по общему классу. S(P_in) и foreline — по datasheet Pfeiffer. Holweck-ступень на выходе — типично h=0.3–0.5 мм.",
  },
];
