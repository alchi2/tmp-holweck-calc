export function fmt(x: number, digits = 3): string {
  if (!isFinite(x)) return "—";
  if (x === 0) return "0";
  const abs = Math.abs(x);
  if (abs >= 1e4 || abs < 1e-3) return x.toExponential(digits);
  return x.toFixed(digits);
}

export function fmtExp(x: number | undefined, digits = 2): string {
  if (x === undefined || x === null) return "—";
  if (x === 0) return "0";
  if (Math.abs(x) >= 1e4 || Math.abs(x) < 1e-3) return x.toExponential(digits);
  return x.toFixed(3);
}
