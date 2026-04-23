import type { HolweckStage } from "../lib/holweck";
import { defaultHolweckStage } from "../lib/holweck";
import { NumberInput } from "./NumberInput";

export function HolweckStagesEditor({
  stages,
  setStages,
}: {
  stages: HolweckStage[];
  setStages: (next: HolweckStage[]) => void;
}) {
  function updateStage(idx: number, patch: Partial<HolweckStage>) {
    const next = [...stages];
    next[idx] = { ...next[idx], ...patch };
    setStages(next);
  }
  function addStage() {
    setStages([...stages, defaultHolweckStage(`H-${stages.length + 1}`)]);
  }
  function removeStage(idx: number) {
    setStages(stages.filter((_, i) => i !== idx));
  }
  function duplicateStage(idx: number) {
    const copy: HolweckStage = { ...stages[idx], id: `${stages[idx].id}'` };
    const next = [...stages];
    next.splice(idx + 1, 0, copy);
    setStages(next);
  }

  return (
    <>
      <div className="panel-header">
        <h2>Ступени Holweck</h2>
        <button type="button" className="primary" onClick={addStage}>
          + Добавить ступень
        </button>
      </div>
      <p className="muted small">
        Holweck-ступень — молекулярный drag: спиральные канавки на статоре и
        гладкий ротор-цилиндр. Типовые параметры: глубина канавки 0.3–1 мм,
        угол винта 6–15°, зазор ротор-статор 0.1–0.3 мм, 20–80 заходов винта.
      </p>

      {stages.length === 0 && (
        <p className="muted small">
          Ступени Holweck не заданы. Нажмите «Добавить ступень».
        </p>
      )}

      {stages.map((st, idx) => (
        <div className="stage" key={`${st.id}-${idx}`}>
          <div className="stage-header">
            <input
              className="stage-id"
              value={st.id}
              onChange={(e) => updateStage(idx, { id: e.target.value })}
            />
            <div className="stage-actions">
              <button type="button" onClick={() => duplicateStage(idx)}>
                Дублировать
              </button>
              <button
                type="button"
                className="danger"
                onClick={() => removeStage(idx)}
              >
                Удалить
              </button>
            </div>
          </div>

          <div className="row">
            <NumberInput
              label="Внешний Ø ротора"
              value={st.rotorDiameter}
              step={0.001}
              min={0.005}
              unit="м"
              onChange={(v) => updateStage(idx, { rotorDiameter: v })}
            />
            <NumberInput
              label="Длина ступени (осевая)"
              value={st.length}
              step={0.001}
              min={0.001}
              unit="м"
              onChange={(v) => updateStage(idx, { length: v })}
            />
            <NumberInput
              label="Угол винта θ от оси"
              value={st.helixAngleDeg}
              step={0.5}
              min={1}
              unit="°"
              help="Угол направления канавки относительно оси вращения. Типично 6–15°."
              onChange={(v) => updateStage(idx, { helixAngleDeg: v })}
            />
            <NumberInput
              label="Число заходов винта"
              value={st.startCount}
              step={1}
              min={1}
              unit="шт"
              help="Количество параллельных спиралей (n). Обычно выбирается так, чтобы (s+w)·n ≈ π·D."
              onChange={(v) =>
                updateStage(idx, { startCount: Math.max(1, Math.round(v)) })
              }
            />
          </div>
          <div className="row">
            <NumberInput
              label="Глубина канавки h"
              value={st.grooveDepth}
              step={0.0001}
              min={0.00005}
              unit="м"
              onChange={(v) => updateStage(idx, { grooveDepth: v })}
            />
            <NumberInput
              label="Ширина канавки s"
              value={st.grooveWidth}
              step={0.0001}
              min={0.0001}
              unit="м"
              onChange={(v) => updateStage(idx, { grooveWidth: v })}
            />
            <NumberInput
              label="Ширина перегородки w"
              value={st.landWidth}
              step={0.0001}
              min={0.00005}
              unit="м"
              help="Ширина «земли» (land) между соседними канавками по окружности."
              onChange={(v) => updateStage(idx, { landWidth: v })}
            />
            <NumberInput
              label="Радиальный зазор δ"
              value={st.radialClearance}
              step={0.00005}
              min={0.00001}
              unit="м"
              onChange={(v) => updateStage(idx, { radialClearance: v })}
            />
          </div>
        </div>
      ))}
    </>
  );
}
