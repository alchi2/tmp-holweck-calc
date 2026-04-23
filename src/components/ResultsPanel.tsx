import type { PumpInputs, PumpResult } from "../lib/pump";
import { calcKCurve, calcSCurve } from "../lib/pump";
import { fmt } from "../lib/format";
import { SCurvePlot, type Series } from "./SCurvePlot";
import { LogLogPlot, type XYSeries } from "./LogLogPlot";
import type { Preset } from "../lib/presets";

export function ResultsPanel({
  result,
  inputs,
  outletPressure,
  qMaxPaLps,
  activePreset,
}: {
  result: PumpResult;
  inputs: PumpInputs;
  outletPressure: number;
  qMaxPaLps: number;
  activePreset: Preset | null;
}) {
  const { turbo, holweck } = result;

  const showPlot = result.mode === "holweck" || result.mode === "combined";
  const calcCurve = showPlot
    ? calcSCurve(result, outletPressure, inputs, qMaxPaLps)
    : [];
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
            Модель Sawada 1979 / Skovorodko 2002 (переходный Couette–
            Poiseuille-режим в drag-канале):
            <code>S(P_вх) = min(S_max·f_vi·stall, Q_max/P_вх)</code>.
            Слева — компрессионный предел P_вх &lt; P_вых/K_эф.
            В середине — молекулярное плато.
            Справа — верхняя огибающая по пропускной способности
            форвакуумной линии (Q = S·P_вх &lt; Q_max), задаётся в общих
            параметрах. Плюс Sawada-спад K(P):
            <code>ln K = ln K_fm · Kn/(Kn+1)</code>, Kn = λ·P<sub>ref</sub>/(h·P).
            Подробнее см. раздел 6c «Справки».
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

      {showPlot && <KPlotBlock result={result} inputs={inputs} activePreset={activePreset} />}

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

function KPlotBlock({
  result,
  inputs,
  activePreset,
}: {
  result: PumpResult;
  inputs: PumpInputs;
  activePreset: Preset | null;
}) {
  const expPts = activePreset?.kCurve ?? [];
  const hasExp = expPts.length > 0;
  const expXs = expPts.map((p) => p.pOut);
  const pMin = hasExp ? Math.min(...expXs, 0.1) / 10 : undefined;
  const pMax = hasExp ? Math.max(...expXs, 1e4) * 3 : undefined;
  const kPts = calcKCurve(result, inputs, pMin, pMax);
  if (kPts.length === 0 && !hasExp) return null;

  const series: XYSeries[] = [];
  if (kPts.length > 0) {
    series.push({
      label: "Расчёт K(P_вых) (Sawada-переход)",
      color: "#4f9dff",
      points: kPts.map((p) => ({ x: p.pOut, y: p.K })),
    });
  }
  if (hasExp) {
    series.push({
      label: `Эксперимент — ${activePreset!.label}`,
      color: "#f0a35c",
      points: expPts.map((p) => ({ x: p.pOut, y: p.K })),
      dashed: true,
      markers: true,
    });
  }

  return (
    <div className="panel-subsection">
      <h3>Компрессионная кривая K(P_вых) при нулевом расходе</h3>
      <p className="muted small">
        Степень сжатия при запертом входе как функция давления на выхлопе.
        В молекулярном пределе (Kn ≫ 1) K = K_fm; с ростом P_вых число Кнудсена
        Kn = λ·P_ref/(h·P_вых) падает, и по Sawada 1979{" "}
        <code>ln K = ln K_fm · Kn/(Kn+1)</code>, т.е. K → 1 при P_вых &gt;&gt; P_knee.
        Это кривая типа Fig. 4 статьи Sawada-Sugiyama 1999 и Fig. 7 статьи
        Sharipov 2005. Точки — оцифровка эксперимента из статьи.
      </p>
      <LogLogPlot
        series={series}
        xLabel="P_вых, Па"
        yLabel="K"
        yFormat={(v) => (v >= 100 ? v.toExponential(0) : v.toFixed(v >= 10 ? 0 : 1))}
      />
    </div>
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
