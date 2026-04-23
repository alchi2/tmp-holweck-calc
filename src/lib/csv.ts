// CSV import/export of turbo-stage geometry.
//
// Format (one row per stage, header line required):
//   id,outerDiameter,hubDiameter,tipClearance,axialGap,
//   rotorAngleDeg,rotorCount,rotorHeight,
//   statorAngleDeg,statorCount,statorHeight
//
// All lengths in meters, angles in degrees.
// Comments starting with "#" are ignored.

import type { Stage } from "./tmp";

export const CSV_HEADER =
  "id,outerDiameter,hubDiameter,tipClearance,axialGap," +
  "rotorAngleDeg,rotorCount,rotorHeight," +
  "statorAngleDeg,statorCount,statorHeight";

export const CSV_EXAMPLE = [
  "# Пример CSV с турбо-ступенями. Длины в метрах, углы в градусах.",
  "# Строки, начинающиеся с #, игнорируются.",
  CSV_HEADER,
  "Т-1,0.16,0.05,0.0005,0.001,40,40,0.012,40,40,0.012",
  "Т-2,0.155,0.05,0.0005,0.001,35,44,0.012,35,44,0.012",
  "Т-3,0.15,0.05,0.0005,0.001,30,48,0.010,30,48,0.010",
  "Т-4,0.145,0.05,0.0005,0.001,25,52,0.008,25,52,0.008",
].join("\n");

export function stagesToCSV(stages: Stage[]): string {
  const lines = [CSV_HEADER];
  for (const s of stages) {
    lines.push(
      [
        s.id,
        s.outerDiameter,
        s.hubDiameter,
        s.tipClearance,
        s.axialGap,
        s.rotor.angleDeg,
        s.rotor.count,
        s.rotor.height,
        s.stator.angleDeg,
        s.stator.count,
        s.stator.height,
      ].join(","),
    );
  }
  return lines.join("\n");
}

export function csvToStages(csv: string): { stages: Stage[]; errors: string[] } {
  const errors: string[] = [];
  const stages: Stage[] = [];
  const lines = csv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"));

  if (lines.length === 0) {
    errors.push("CSV пустой.");
    return { stages, errors };
  }

  const hdr = lines[0].split(",").map((s) => s.trim());
  const expected = CSV_HEADER.split(",");
  if (hdr.length !== expected.length || hdr[0] !== "id") {
    errors.push(
      `Неверный заголовок. Ожидалось: ${CSV_HEADER}. Получено: ${lines[0]}`,
    );
  }

  for (let i = 1; i < lines.length; i++) {
    const row = lines[i].split(",").map((s) => s.trim());
    if (row.length !== expected.length) {
      errors.push(
        `Строка ${i + 1}: ожидалось ${expected.length} полей, получено ${row.length}.`,
      );
      continue;
    }
    const [id, oD, hD, tC, aG, rA, rN, rH, sA, sN, sH] = row;
    const n = (x: string) => {
      const v = parseFloat(x);
      return Number.isFinite(v) ? v : NaN;
    };
    const stage: Stage = {
      id: id || `Т-${i}`,
      outerDiameter: n(oD),
      hubDiameter: n(hD),
      tipClearance: n(tC),
      axialGap: n(aG),
      rotor: { angleDeg: n(rA), count: Math.max(1, Math.round(n(rN))), height: n(rH) },
      stator: { angleDeg: n(sA), count: Math.max(1, Math.round(n(sN))), height: n(sH) },
    };
    if (
      [stage.outerDiameter, stage.hubDiameter, stage.tipClearance, stage.axialGap, stage.rotor.angleDeg, stage.rotor.height, stage.stator.angleDeg, stage.stator.height].some(
        (v) => !Number.isFinite(v) || v < 0,
      )
    ) {
      errors.push(`Строка ${i + 1}: некорректные числовые значения.`);
      continue;
    }
    stages.push(stage);
  }
  return { stages, errors };
}
