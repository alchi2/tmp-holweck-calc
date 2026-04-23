import type { PumpInputs, PumpResult } from "../lib/pump";
import { calcSCurve } from "../lib/pump";
import { fmt } from "../lib/format";
import { SCurvePlot, type Series } from "./SCurvePlot";
import type { Preset } from "../lib/presets";

export function ResultsPanel({
  result,
  inputs,
  outletPressure,
  activePreset,
}: {
  result: PumpResult;
  inputs: PumpInputs;
  outletPressure: number;
  activePreset: Preset | null;
}) {
  const { turbo, holweck } = result;

  const showPlot = result.mode === "holweck" || result.mode === "combined";
  const calcCurve = showPlot ? calcSCurve(result, outletPressure, inputs) : [];
  const series: Series[] = [];
  if (calcCurve.length > 0) {
    series.push({
      label: `Расчёт при P_вых = ${fmt(outletPressure, 2)} Па`,
      color: "#4f9dff",
      points: calcCurve.map((p) => ({ pIn: p.pIn, S: p.S })),
    });
  }
  if (showPlot && activePreset?.sCurve && activePreset.sCurve.length > 0) {
    series.push({
      label: `Эксперимент / datasheet — ${activePreset.label}`,
      color: "#f0a35c",
      points: activePreset.sCurve,
      dashed: true,
      markers: true,
    });
  }

  return (
    <>
      <h2>Интегральные результаты</h2>
      <div className="results-grid">
        <ResultCard
          title="Максимальная степень сжатия K"
          value={fmt(result.kTotal, 3)}
          hint={
            result.mode === "combined"
              ? `K = K_турбо · K_Holweck = ${fmt(turbo?.kTotal ?? 1, 2)} · ${fmt(holweck?.kTotal ?? 1, 2)}`
              : `Π K по ступеням`
          }
        />
        <ResultCard
          title="Быстрота действия S"
          value={`${fmt(result.sMaxLps, 1)} л/с`}
          hint={
            result.mode === "combined"
              ? `Определяется турбо-секцией (верхняя часть насоса)`
              : result.mode === "turbo"
                ? `S = (v_m/4)·A·W_вх, W_вх=${fmt(turbo?.wInlet ?? 0, 3)}`
                : `S = min(S_drag, S_thermal)·(1−1/K)`
          }
        />
        <ResultCard
          title="Мощность"
          value={`${fmt(result.pTotal, 2)} Вт`}
          hint={
            result.mode === "combined"
              ? `P_турбо=${fmt(turbo?.pTotal ?? 0, 2)} + P_Holweck=${fmt(holweck?.pGasTotal ?? 0, 2)}`
              : `Газовые + ветровые потери`
          }
        />
      </div>

      {result.diagnostics.length > 0 && (
        <div className="diag">
          {result.diagnostics.map((d, i) => (
            <div key={i}>⚠ {d}</div>
          ))}
        </div>
      )}

      {showPlot && (
        <div className="panel-subsection">
          <h3>
            Кривая быстроты действия S(P_вх) при P_вых = {fmt(outletPressure, 2)} Па
          </h3>
          <p className="muted small">
            S(P_вх) = S_max · stall(P_вх, P_вых, K) · viscous(P_вх).
            Спад слева — компрессионный предел P_вх &lt; P_вых/K (пумпа не может
            удержать компрессию). Спад справа — переход в вязкий режим при
            Kn ≈ 1 (средний свободный пробег ≈ минимальный канал пумпы, см.
            раздел 6c «Справки»). Меняйте P_вых в общих параметрах — левая
            граница сдвигается; меняя геометрию (axial gap / groove depth) —
            сдвигается правая.
          </p>
          {series.length > 0 ? (
            <SCurvePlot series={series} />
          ) : (
            <p className="muted small">
              Не удалось построить: K ≤ 1 или S = 0 (проверьте параметры).
            </p>
          )}
        </div>
      )}

      {turbo && (result.mode === "turbo" || result.mode === "combined") && (
        <>
          <h3>Турбо-ступени</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Ступень</th>
                  <th>r̄ [мм]</th>
                  <th>A [см²]</th>
                  <th>u [м/с]</th>
                  <th>C=u/v_m</th>
                  <th>α_eff ротор</th>
                  <th>Δα Кориолис</th>
                  <th>K_ст</th>
                  <th>W_ст</th>
                  <th>P_газ [Вт]</th>
                </tr>
              </thead>
              <tbody>
                {turbo.stages.map((s) => (
                  <tr key={s.id}>
                    <td>{s.id}</td>
                    <td>{fmt(s.meanRadius * 1000, 1)}</td>
                    <td>{fmt(s.annularArea * 1e4, 2)}</td>
                    <td>{fmt(s.rotor.uMean, 1)}</td>
                    <td>{fmt(s.rotor.speedRatio, 2)}</td>
                    <td>{fmt(s.rotor.alphaEffDeg, 1)}°</td>
                    <td>{fmt(s.rotor.coriolisShiftDeg, 2)}°</td>
                    <td>{fmt(s.kStage, 3)}</td>
                    <td>{fmt(s.wStage, 3)}</td>
                    <td>{fmt(s.pGas, 2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {holweck && (result.mode === "holweck" || result.mode === "combined") && (
        <>
          <h3>Ступени Holweck</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Ступень</th>
                  <th>u [м/с]</th>
                  <th>v̄ [м/с]</th>
                  <th>n_зах (геом)</th>
                  <th>duty s/(s+w)</th>
                  <th>h_эфф [мкм]</th>
                  <th>ln K</th>
                  <th>K_max</th>
                  <th>S_drag [л/с]</th>
                  <th>S_терм [л/с]</th>
                </tr>
              </thead>
              <tbody>
                {holweck.stages.map((s) => (
                  <tr key={s.id}>
                    <td>{s.id}</td>
                    <td>{fmt(s.uPeripheral, 1)}</td>
                    <td>{fmt(s.vDrift, 1)}</td>
                    <td>
                      {fmt(s.nGeom, 0)}
                      {Math.abs(s.nGeom - s.nSpec) > 1 && (
                        <span className="muted"> (задано {s.nSpec})</span>
                      )}
                    </td>
                    <td>{fmt(s.duty, 2)}</td>
                    <td>{fmt(s.hEff * 1e6, 1)}</td>
                    <td>{fmt(s.logKmax, 2)}</td>
                    <td>{fmt(s.kMax, 3)}</td>
                    <td>{fmt(s.sDrag * 1000, 2)}</td>
                    <td>{fmt(s.sTherm * 1000, 2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}

function ResultCard({
  title,
  value,
  hint,
}: {
  title: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="result-card">
      <div className="result-title">{title}</div>
      <div className="result-value">{value}</div>
      {hint && <div className="result-hint">{hint}</div>}
    </div>
  );
}
