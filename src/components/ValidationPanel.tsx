import { PRESETS, type Preset } from "../lib/presets";
import type { PumpResult } from "../lib/pump";
import { fmtExp } from "../lib/format";

export function ValidationPanel({
  selectedId,
  onSelect,
  result,
  activePreset,
  outletPressure,
}: {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  result: PumpResult;
  activePreset: Preset | null;
  outletPressure: number;
}) {
  const groups: { title: string; presets: Preset[] }[] = [
    {
      title: "Турбо — одиночный ряд (Kruger 1960)",
      presets: PRESETS.filter((p) => p.kind === "turboSingleRow"),
    },
    {
      title: "Турбо — коммерческие насосы",
      presets: PRESETS.filter((p) => p.kind === "turboFull"),
    },
    {
      title: "Holweck — одиночная ступень",
      presets: PRESETS.filter((p) => p.kind === "holweckSingle"),
    },
    {
      title: "Комбинированные (турбо + Holweck)",
      presets: PRESETS.filter((p) => p.kind === "combined"),
    },
  ];

  return (
    <>
      <h2>Проверочные данные</h2>
      <p className="muted small">
        Выберите пресет: геометрия, частота, газ и режим расчёта загрузятся
        автоматически. Ниже — сравнение расчёта с эталоном и подсветка
        отклонений (≤20% зелёный, ≤50% жёлтый, иначе красный).
      </p>

      <label className="num-input">
        <span className="num-label">Пресет</span>
        <select
          value={selectedId ?? ""}
          onChange={(e) => onSelect(e.target.value || null)}
        >
          <option value="">— Свободный расчёт —</option>
          {groups.map((g) => (
            <optgroup label={g.title} key={g.title}>
              {g.presets.map((p) => (
                <option value={p.id} key={p.id}>
                  {p.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>

      {activePreset && (
        <ComparisonView
          preset={activePreset}
          result={result}
          outletPressure={outletPressure}
        />
      )}
    </>
  );
}

function deviationColor(dev: number): string {
  const a = Math.abs(dev);
  if (a <= 20) return "dev-ok";
  if (a <= 50) return "dev-warn";
  return "dev-bad";
}

function ComparisonView({
  preset,
  result,
  outletPressure,
}: {
  preset: Preset;
  result: PumpResult;
  outletPressure: number;
}) {
  const { expected } = preset;
  let kCalc: number | undefined;
  let wCalc: number | undefined;

  if (preset.kind === "turboSingleRow" && result.turbo && result.turbo.stages[0]) {
    kCalc = result.turbo.stages[0].rotor.kStage;
    wCalc = result.turbo.stages[0].rotor.wStage;
  } else {
    kCalc = result.kTotal;
    wCalc = result.turbo?.wInlet;
  }
  // For Holweck / combined presets we derive S at the actual operating
  // foreline pressure: S_op = S_max · (1 − P_out/(K · P_in)). This matches
  // how datasheets report S (measured at a specific foreline tolerance).
  let sCalc = result.sMaxLps;
  const needsForelineCorrection =
    (preset.kind === "holweckSingle" || preset.kind === "combined") &&
    expected.outletPressure !== undefined &&
    outletPressure > 0 &&
    result.kTotal > 1;
  if (needsForelineCorrection) {
    const pIn = preset.inletPressure > 0 ? preset.inletPressure : 1e-3;
    const pOut = expected.outletPressure ?? outletPressure;
    const factor = Math.max(0, 1 - pOut / (result.kTotal * pIn));
    sCalc = result.sMaxLps * factor;
  }

  const rows: {
    label: string;
    calc: number | undefined;
    exp: number | undefined;
  }[] = [];
  if (expected.K !== undefined) rows.push({ label: "K", calc: kCalc, exp: expected.K });
  if (expected.W !== undefined)
    rows.push({ label: "W (вход)", calc: wCalc, exp: expected.W });
  if (expected.sMaxLps !== undefined)
    rows.push({
      label: needsForelineCorrection
        ? `S [л/с] (P_вых = ${expected.outletPressure ?? outletPressure} Па)`
        : "S [л/с]",
      calc: sCalc,
      exp: expected.sMaxLps,
    });

  return (
    <div className="preset-panel">
      <div className="preset-meta">
        <div>
          <b>{preset.label}</b>
          <div className="muted small">{preset.description}</div>
        </div>
        <div className="muted small">
          Источник:{" "}
          {preset.sourceUrl ? (
            <a href={preset.sourceUrl} target="_blank" rel="noreferrer">
              {preset.source}
            </a>
          ) : (
            preset.source
          )}
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Параметр</th>
              <th>Расчёт</th>
              <th>Эталон</th>
              <th>Δ</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              if (row.exp === undefined || row.calc === undefined) {
                return (
                  <tr key={row.label}>
                    <td>{row.label}</td>
                    <td>{fmtExp(row.calc)}</td>
                    <td>{fmtExp(row.exp)}</td>
                    <td>—</td>
                  </tr>
                );
              }
              const dev = ((row.calc - row.exp) / row.exp) * 100;
              return (
                <tr key={row.label}>
                  <td>{row.label}</td>
                  <td>{fmtExp(row.calc)}</td>
                  <td>{fmtExp(row.exp)}</td>
                  <td className={deviationColor(dev)}>
                    {dev > 0 ? "+" : ""}
                    {dev.toFixed(0)}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {preset.notes && <div className="notes">{preset.notes}</div>}
    </div>
  );
}
