import { useRef, useState } from "react";
import type { Stage } from "../lib/tmp";
import { mkTurboStage } from "../lib/turboFactory";
import { csvToStages, stagesToCSV, CSV_EXAMPLE } from "../lib/csv";
import { NumberInput } from "./NumberInput";

export function TurboStagesEditor({
  stages,
  setStages,
}: {
  stages: Stage[];
  setStages: (next: Stage[]) => void;
}) {
  function updateStage(idx: number, patch: Partial<Stage>) {
    const next = [...stages];
    next[idx] = { ...next[idx], ...patch };
    setStages(next);
  }
  function updateRow(
    idx: number,
    which: "rotor" | "stator",
    patch: Partial<Stage["rotor"]>,
  ) {
    const next = [...stages];
    next[idx] = { ...next[idx], [which]: { ...next[idx][which], ...patch } };
    setStages(next);
  }
  function addStage() {
    setStages([...stages, mkTurboStage(`Т-${stages.length + 1}`)]);
  }
  function removeStage(idx: number) {
    setStages(stages.filter((_, i) => i !== idx));
  }
  function duplicateStage(idx: number) {
    const src = stages[idx];
    const copy: Stage = {
      ...src,
      id: `${src.id}'`,
      rotor: { ...src.rotor },
      stator: { ...src.stator },
    };
    const next = [...stages];
    next.splice(idx + 1, 0, copy);
    setStages(next);
  }

  const fileRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string>("");

  function downloadFile(name: string, content: string) {
    const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  }
  function onExport() {
    downloadFile("turbo-stages.csv", stagesToCSV(stages));
  }
  function onExample() {
    downloadFile("turbo-stages-example.csv", CSV_EXAMPLE);
  }
  function onImportClick() {
    fileRef.current?.click();
  }
  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setImportError("");
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const { stages: parsed, errors } = csvToStages(text);
      if (errors.length > 0) {
        setImportError(errors.join(" • "));
      }
      if (parsed.length > 0) {
        setStages(parsed);
      } else if (errors.length === 0) {
        setImportError("Ни одной корректной строки не найдено.");
      }
      if (fileRef.current) fileRef.current.value = "";
    };
    reader.readAsText(file);
  }

  return (
    <>
      <div className="panel-header">
        <h2>Турбо-ступени</h2>
        <div className="stage-actions">
          <button type="button" onClick={onExample} title="Скачать пример CSV">
            Пример CSV
          </button>
          <button type="button" onClick={onImportClick} title="Импорт CSV">
            Импорт CSV
          </button>
          <button
            type="button"
            onClick={onExport}
            title="Экспорт текущих ступеней в CSV"
            disabled={stages.length === 0}
          >
            Экспорт CSV
          </button>
          <button type="button" className="primary" onClick={addStage}>
            + Добавить ступень
          </button>
        </div>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        style={{ display: "none" }}
        onChange={onFileChange}
      />
      {importError && <div className="csv-error">Ошибки CSV: {importError}</div>}

      {stages.length === 0 && (
        <p className="muted small">
          Турбо-ступени не заданы. Нажмите «Добавить ступень» или загрузите
          пресет на вкладке «Валидация».
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
              label="Внешний диаметр колеса"
              value={st.outerDiameter}
              step={0.001}
              min={0.001}
              unit="м"
              onChange={(v) => updateStage(idx, { outerDiameter: v })}
            />
            <NumberInput
              label="Диаметр ступицы"
              value={st.hubDiameter}
              step={0.001}
              min={0}
              unit="м"
              onChange={(v) => updateStage(idx, { hubDiameter: v })}
            />
            <NumberInput
              label="Зазор корпус–лопатка"
              value={st.tipClearance}
              step={0.0001}
              min={0}
              unit="м"
              onChange={(v) => updateStage(idx, { tipClearance: v })}
            />
            <NumberInput
              label="Зазор ротор–статор (осевой)"
              value={st.axialGap}
              step={0.0001}
              min={0}
              unit="м"
              onChange={(v) => updateStage(idx, { axialGap: v })}
            />
          </div>

          <div className="rows-2">
            {(["rotor", "stator"] as const).map((which) => (
              <div className="subpanel" key={which}>
                <h3>{which === "rotor" ? "Ротор" : "Статор"}</h3>
                <div className="row">
                  <NumberInput
                    label="Угол лопаток"
                    value={st[which].angleDeg}
                    step={0.5}
                    min={1}
                    unit="°"
                    onChange={(v) => updateRow(idx, which, { angleDeg: v })}
                  />
                  <NumberInput
                    label="Количество лопаток"
                    value={st[which].count}
                    step={1}
                    min={2}
                    unit="шт"
                    onChange={(v) =>
                      updateRow(idx, which, { count: Math.round(v) })
                    }
                  />
                  <NumberInput
                    label="Высота лопатки"
                    value={st[which].height}
                    step={0.001}
                    min={0.0001}
                    unit="м"
                    onChange={(v) => updateRow(idx, which, { height: v })}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
