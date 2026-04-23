/**
 * Log-log plot of S(P_in) at fixed P_out:
 *   - blue line: model prediction S_calc(P_in) = S_max · (1 − P_out/(K · P_in))
 *   - orange dots: reference S(P_in) digitized from a datasheet/paper preset
 */
export interface Series {
  label: string;
  color: string;
  points: { pIn: number; S: number }[];
  dashed?: boolean;
  markers?: boolean;
}

export function SCurvePlot({
  series,
  width = 680,
  height = 360,
  xMin,
  xMax,
  yMin,
  yMax,
}: {
  series: Series[];
  width?: number;
  height?: number;
  xMin?: number;
  xMax?: number;
  yMin?: number;
  yMax?: number;
}) {
  const M = { l: 60, r: 16, t: 16, b: 44 };
  const W = width - M.l - M.r;
  const H = height - M.t - M.b;

  const all = series.flatMap((s) => s.points.filter((p) => p.pIn > 0 && p.S >= 0));
  if (all.length === 0) {
    return (
      <div className="plot-empty">
        Недостаточно данных для графика (K ≤ 1 или S = 0).
      </div>
    );
  }
  const xs = all.map((p) => p.pIn);
  const ys = all.map((p) => Math.max(p.S, 1e-6));
  const xLo = xMin ?? Math.pow(10, Math.floor(Math.log10(Math.min(...xs))));
  const xHi = xMax ?? Math.pow(10, Math.ceil(Math.log10(Math.max(...xs))));
  const yLo = yMin ?? Math.max(0.05, Math.min(...ys) * 0.5);
  const yHi = yMax ?? Math.max(...ys) * 1.2;

  const logXLo = Math.log10(xLo);
  const logXHi = Math.log10(xHi);
  const logYLo = Math.log10(yLo);
  const logYHi = Math.log10(yHi);

  const xScale = (p: number) => ((Math.log10(p) - logXLo) / (logXHi - logXLo)) * W;
  const yScale = (v: number) =>
    H - ((Math.log10(Math.max(v, 1e-9)) - logYLo) / (logYHi - logYLo)) * H;

  // Grid decades.
  const xTicks: number[] = [];
  for (let k = Math.floor(logXLo); k <= Math.ceil(logXHi); k++) {
    xTicks.push(Math.pow(10, k));
  }
  const yTicks: number[] = [];
  for (let k = Math.floor(logYLo); k <= Math.ceil(logYHi); k++) {
    yTicks.push(Math.pow(10, k));
  }

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} className="splot">
      <g transform={`translate(${M.l},${M.t})`}>
        {/* Grid */}
        {xTicks.map((t) => (
          <line
            key={`vx${t}`}
            x1={xScale(t)}
            x2={xScale(t)}
            y1={0}
            y2={H}
            stroke="#2b303d"
            strokeDasharray="2 3"
          />
        ))}
        {yTicks.map((t) => (
          <line
            key={`vy${t}`}
            x1={0}
            x2={W}
            y1={yScale(t)}
            y2={yScale(t)}
            stroke="#2b303d"
            strokeDasharray="2 3"
          />
        ))}

        {/* Axes */}
        <line x1={0} y1={H} x2={W} y2={H} stroke="#9aa4b2" />
        <line x1={0} y1={0} x2={0} y2={H} stroke="#9aa4b2" />

        {/* X tick labels */}
        {xTicks.map((t) => (
          <text
            key={`lx${t}`}
            x={xScale(t)}
            y={H + 14}
            fill="#9aa4b2"
            fontSize={10}
            textAnchor="middle"
          >
            10{sup(Math.round(Math.log10(t)))}
          </text>
        ))}
        <text x={W / 2} y={H + 34} fill="#e5e7eb" fontSize={12} textAnchor="middle">
          P_вх, Па
        </text>

        {/* Y tick labels */}
        {yTicks.map((t) => (
          <text
            key={`ly${t}`}
            x={-6}
            y={yScale(t) + 3}
            fill="#9aa4b2"
            fontSize={10}
            textAnchor="end"
          >
            {t >= 1 ? t.toFixed(0) : t.toFixed(2)}
          </text>
        ))}
        <text
          x={-40}
          y={H / 2}
          fill="#e5e7eb"
          fontSize={12}
          textAnchor="middle"
          transform={`rotate(-90 -40 ${H / 2})`}
        >
          S, л/с
        </text>

        {/* Series */}
        {series.map((s, idx) => {
          const pts = s.points.filter((p) => p.pIn > 0).map((p) => ({
            x: xScale(p.pIn),
            y: yScale(Math.max(p.S, 1e-6)),
            v: p.S,
          }));
          const d = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
          return (
            <g key={idx}>
              <path
                d={d}
                stroke={s.color}
                strokeWidth={2}
                fill="none"
                strokeDasharray={s.dashed ? "5 4" : undefined}
              />
              {s.markers &&
                pts.map((p, i) => (
                  <circle key={i} cx={p.x} cy={p.y} r={3.5} fill={s.color} />
                ))}
            </g>
          );
        })}
      </g>

      {/* Legend */}
      <g transform={`translate(${M.l + 10}, ${M.t + 6})`}>
        {series.map((s, i) => (
          <g key={i} transform={`translate(0, ${i * 18})`}>
            <line
              x1={0}
              x2={20}
              y1={6}
              y2={6}
              stroke={s.color}
              strokeWidth={2}
              strokeDasharray={s.dashed ? "5 4" : undefined}
            />
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
    "0": "⁰",
    "1": "¹",
    "2": "²",
    "3": "³",
    "4": "⁴",
    "5": "⁵",
    "6": "⁶",
    "7": "⁷",
    "8": "⁸",
    "9": "⁹",
  };
  return String(n)
    .split("")
    .map((c) => m[c] ?? c)
    .join("");
}
