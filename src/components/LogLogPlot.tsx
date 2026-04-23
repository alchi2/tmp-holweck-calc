/**
 * Generic log-log plot with arbitrary axis labels. Used for both S(P_in)
 * and K(P_out) plots, with overlays of digitized experimental data.
 */
export interface XYSeries {
  label: string;
  color: string;
  points: { x: number; y: number }[];
  dashed?: boolean;
  markers?: boolean;
}

export function LogLogPlot({
  series,
  width = 680,
  height = 360,
  xMin,
  xMax,
  yMin,
  yMax,
  xLabel,
  yLabel,
  yFormat,
}: {
  series: XYSeries[];
  width?: number;
  height?: number;
  xMin?: number;
  xMax?: number;
  yMin?: number;
  yMax?: number;
  xLabel: string;
  yLabel: string;
  yFormat?: (v: number) => string;
}) {
  const M = { l: 60, r: 16, t: 16, b: 44 };
  const W = width - M.l - M.r;
  const H = height - M.t - M.b;

  const all = series.flatMap((s) => s.points.filter((p) => p.x > 0 && p.y > 0));
  if (all.length === 0) {
    return (
      <div className="plot-empty">Недостаточно данных для графика.</div>
    );
  }
  const xs = all.map((p) => p.x);
  const ys = all.map((p) => p.y);
  const xLo = xMin ?? Math.pow(10, Math.floor(Math.log10(Math.min(...xs))));
  const xHi = xMax ?? Math.pow(10, Math.ceil(Math.log10(Math.max(...xs))));
  const yLo = yMin ?? Math.pow(10, Math.floor(Math.log10(Math.min(...ys))));
  const yHi = yMax ?? Math.pow(10, Math.ceil(Math.log10(Math.max(...ys))));

  const logXLo = Math.log10(xLo);
  const logXHi = Math.log10(xHi);
  const logYLo = Math.log10(yLo);
  const logYHi = Math.log10(yHi);

  const xScale = (p: number) => ((Math.log10(p) - logXLo) / (logXHi - logXLo)) * W;
  const yScale = (v: number) =>
    H - ((Math.log10(Math.max(v, 1e-9)) - logYLo) / (logYHi - logYLo)) * H;

  const xTicks: number[] = [];
  for (let k = Math.floor(logXLo); k <= Math.ceil(logXHi); k++) {
    xTicks.push(Math.pow(10, k));
  }
  const yTicks: number[] = [];
  for (let k = Math.floor(logYLo); k <= Math.ceil(logYHi); k++) {
    yTicks.push(Math.pow(10, k));
  }
  const fmtY = yFormat ?? ((v: number) => (v >= 1 ? v.toFixed(0) : v.toFixed(2)));

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} className="splot">
      <g transform={`translate(${M.l},${M.t})`}>
        {xTicks.map((t) => (
          <line key={`vx${t}`} x1={xScale(t)} x2={xScale(t)} y1={0} y2={H}
            stroke="#2b303d" strokeDasharray="2 3" />
        ))}
        {yTicks.map((t) => (
          <line key={`vy${t}`} x1={0} x2={W} y1={yScale(t)} y2={yScale(t)}
            stroke="#2b303d" strokeDasharray="2 3" />
        ))}
        <line x1={0} y1={H} x2={W} y2={H} stroke="#9aa4b2" />
        <line x1={0} y1={0} x2={0} y2={H} stroke="#9aa4b2" />
        {xTicks.map((t) => (
          <text key={`lx${t}`} x={xScale(t)} y={H + 14} fill="#9aa4b2"
            fontSize={10} textAnchor="middle">
            10{sup(Math.round(Math.log10(t)))}
          </text>
        ))}
        <text x={W / 2} y={H + 34} fill="#e5e7eb" fontSize={12} textAnchor="middle">
          {xLabel}
        </text>
        {yTicks.map((t) => (
          <text key={`ly${t}`} x={-6} y={yScale(t) + 3} fill="#9aa4b2"
            fontSize={10} textAnchor="end">
            {fmtY(t)}
          </text>
        ))}
        <text x={-40} y={H / 2} fill="#e5e7eb" fontSize={12} textAnchor="middle"
          transform={`rotate(-90 -40 ${H / 2})`}>
          {yLabel}
        </text>

        {series.map((s, idx) => {
          const pts = s.points
            .filter((p) => p.x > 0 && p.y > 0)
            .map((p) => ({ x: xScale(p.x), y: yScale(p.y) }));
          const d = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
          return (
            <g key={idx}>
              <path d={d} stroke={s.color} strokeWidth={2} fill="none"
                strokeDasharray={s.dashed ? "5 4" : undefined} />
              {s.markers &&
                pts.map((p, i) => (
                  <circle key={i} cx={p.x} cy={p.y} r={3.5} fill={s.color} />
                ))}
            </g>
          );
        })}
      </g>

      <g transform={`translate(${M.l + 10}, ${M.t + 6})`}>
        {series.map((s, i) => (
          <g key={i} transform={`translate(0, ${i * 18})`}>
            <line x1={0} x2={20} y1={6} y2={6} stroke={s.color} strokeWidth={2}
              strokeDasharray={s.dashed ? "5 4" : undefined} />
            {s.markers && <circle cx={10} cy={6} r={3} fill={s.color} />}
            <text x={26} y={10} fill="#e5e7eb" fontSize={11}>
              {s.label}
            </text>
          </g>
        ))}
      </g>
    </svg>
  );
}

function sup(n: number): string {
  const m: Record<string, string> = {
    "-": "⁻",
    "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴",
    "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹",
  };
  return String(n).split("").map((c) => m[c] ?? c).join("");
}
