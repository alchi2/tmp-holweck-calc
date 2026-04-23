import { useMemo, useState } from "react";
import "./App.css";
import { GAS_LIBRARY, type GasKey, type Stage, type TurboMethod } from "./lib/tmp";
import type { HolweckStage, HolweckMethod } from "./lib/holweck";
import { calculatePump, type PumpMode } from "./lib/pump";
import { PRESETS, type Preset } from "./lib/presets";

import { NumberInput } from "./components/NumberInput";
import { TurboStagesEditor } from "./components/TurboStagesEditor";
import { mkTurboStage } from "./lib/turboFactory";
import { HolweckStagesEditor } from "./components/HolweckStagesEditor";
import { ResultsPanel } from "./components/ResultsPanel";
import { ValidationPanel } from "./components/ValidationPanel";
import { HelpPanel } from "./components/HelpPanel";
import { defaultHolweckStage } from "./lib/holweck";

type Tab = "turbo" | "holweck" | "validation" | "results" | "help";

const MODES: { id: PumpMode; label: string; desc: string }[] = [
  { id: "turbo", label: "Только турбо", desc: "Только осевые ступени." },
  { id: "holweck", label: "Только Holweck", desc: "Только drag-ступень." },
  {
    id: "combined",
    label: "Совмещённая работа",
    desc: "Турбо на входе + Holweck на выходе.",
  },
];

export default function App() {
  const [rpm, setRpm] = useState(60000);
  const [temperature, setTemperature] = useState(293.15);
  const [inletPressure, setInletPressure] = useState(0.001);
  const [gas, setGas] = useState<GasKey>("air");
  const [customM, setCustomM] = useState(0.028);
  const [coriolisEnabled, setCoriolisEnabled] = useState(true);

  const [mode, setMode] = useState<PumpMode>("combined");
  const [outletPressure, setOutletPressure] = useState<number>(500);
  const [turboMethod, setTurboMethod] = useState<TurboMethod>("kruger");
  const [holweckMethod, setHolweckMethod] = useState<HolweckMethod>("sickafus");
  const [turboStages, setTurboStages] = useState<Stage[]>([
    mkTurboStage("Т-1"),
    mkTurboStage("Т-2"),
    mkTurboStage("Т-3"),
  ]);
  const [holweckStages, setHolweckStages] = useState<HolweckStage[]>([
    defaultHolweckStage("H-1"),
  ]);
  const [presetId, setPresetId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("results");

  const molarMass = gas === "custom" ? customM : GAS_LIBRARY[gas].M;

  const result = useMemo(
    () =>
      calculatePump({
        mode,
        rpm,
        temperature,
        inletPressure,
        outletPressure,
        molarMass,
        turboStages,
        holweckStages,
        coriolisEnabled,
        turboMethod,
        holweckMethod,
      }),
    [
      mode,
      rpm,
      temperature,
      inletPressure,
      outletPressure,
      molarMass,
      turboStages,
      holweckStages,
      coriolisEnabled,
      turboMethod,
      holweckMethod,
    ],
  );

  const activePreset: Preset | null =
    PRESETS.find((p) => p.id === presetId) ?? null;

  function loadPreset(id: string | null) {
    if (!id) {
      setPresetId(null);
      return;
    }
    const p = PRESETS.find((x) => x.id === id);
    if (!p) return;
    setRpm(p.rpm);
    setTemperature(p.temperature);
    setInletPressure(p.inletPressure);
    setGas(p.gas);
    if (p.customM) setCustomM(p.customM);
    setMode(p.mode);
    setTurboStages(
      p.turboStages.map((s, i) => ({
        ...s,
        id: s.id || `Т-${i + 1}`,
        rotor: { ...s.rotor },
        stator: { ...s.stator },
      })),
    );
    setHolweckStages(p.holweckStages.map((s) => ({ ...s })));
    setCoriolisEnabled(p.coriolisEnabled);
    if (p.expected.outletPressure !== undefined) {
      setOutletPressure(p.expected.outletPressure);
    }
    setPresetId(p.id);
  }

  const tabs: { id: Tab; label: string; show?: boolean }[] = [
    { id: "turbo", label: "Турбо-ступени", show: mode !== "holweck" },
    { id: "holweck", label: "Holweck-ступени", show: mode !== "turbo" },
    { id: "validation", label: "Проверка" },
    { id: "results", label: "Результаты" },
    { id: "help", label: "Справка" },
  ];

  return (
    <div className="app">
      <header className="app-header">
        <h1>Турбомолекулярный / Holweck насос — расчёт</h1>
        <p className="subtitle">
          Осевые ступени (Becker/Kruger) и drag-ступень (Sickafus/Jousten) с
          поправкой на Кориолис. Свободно-молекулярный режим.
        </p>
      </header>

      <section className="panel">
        <h2>Режим расчёта</h2>
        <div className="mode-row">
          {MODES.map((m) => (
            <label
              key={m.id}
              className={`mode-card ${mode === m.id ? "active" : ""}`}
            >
              <input
                type="radio"
                name="mode"
                checked={mode === m.id}
                onChange={() => setMode(m.id)}
              />
              <div className="mode-label">{m.label}</div>
              <div className="mode-desc">{m.desc}</div>
            </label>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2>Общие параметры</h2>
        <div className="row">
          <NumberInput
            label="Частота вращения"
            value={rpm}
            step={100}
            min={0}
            unit="об/мин"
            onChange={setRpm}
          />
          <NumberInput
            label="Температура газа"
            value={temperature}
            step={1}
            min={1}
            unit="K"
            onChange={setTemperature}
          />
          <NumberInput
            label="Давление на входе P_вх"
            value={inletPressure}
            step={1e-5}
            min={0}
            unit="Па"
            onChange={setInletPressure}
            help="Рабочая точка на кривой S(P_вх); используется для мощности"
          />
          <NumberInput
            label="Давление форвакуума P_вых"
            value={outletPressure}
            step={10}
            min={0}
            unit="Па"
            onChange={setOutletPressure}
            help="Задаёт форму кривой S(P_вх): падение у P_вх ≈ P_вых/K"
          />
          <label className="num-input">
            <span className="num-label">Газ</span>
            <select
              value={gas}
              onChange={(e) => setGas(e.target.value as GasKey)}
            >
              <option value="air">Воздух (M=0.02896)</option>
              <option value="argon">Аргон (M=0.0399)</option>
              <option value="helium">Гелий (M=0.004)</option>
              <option value="custom">Свой</option>
            </select>
          </label>
          {gas === "custom" && (
            <NumberInput
              label="Молярная масса"
              value={customM}
              step={0.001}
              min={0.001}
              unit="кг/моль"
              onChange={setCustomM}
            />
          )}
          <label className="num-input checkbox">
            <input
              type="checkbox"
              checked={coriolisEnabled}
              onChange={(e) => setCoriolisEnabled(e.target.checked)}
            />
            <span>
              Кориолис — учитывать
              <div className="muted small">
                (для Kruger 1960 таблиц отключить)
              </div>
            </span>
          </label>
        </div>
      </section>

      <section className="panel">
        <h2>Методика расчёта</h2>
        <div className="row">
          {mode !== "holweck" && (
            <label className="num-input">
              <span className="num-label">
                Турбо-ступени (K)
              </span>
              <select
                value={turboMethod}
                onChange={(e) => setTurboMethod(e.target.value as TurboMethod)}
              >
                <option value="kruger">Kruger 1960 fit (по умолчанию)</option>
                <option value="bernhardt">Bernhardt 1983 closed-form</option>
                <option value="sawada">Sawada-Hirata 1974 кинетическая</option>
              </select>
            </label>
          )}
          {mode !== "turbo" && (
            <label className="num-input">
              <span className="num-label">
                Holweck-ступень (K)
              </span>
              <select
                value={holweckMethod}
                onChange={(e) => setHolweckMethod(e.target.value as HolweckMethod)}
              >
                <option value="sickafus">Sickafus/Jousten (по умолчанию)</option>
                <option value="boulon-audi">Boulon-Audi (TwisTorr)</option>
                <option value="gaede">Gaede 1913 классическая Couette</option>
              </select>
            </label>
          )}
        </div>
        <p className="muted small">
          Формулы всех методик приведены на вкладке Справка. Разные методики дают
          K в пределах ≈×3 от друг друга в типичной геометрии.
        </p>
      </section>

      <nav className="tabs">
        {tabs
          .filter((t) => t.show !== false)
          .map((t) => (
            <button
              key={t.id}
              type="button"
              className={`tab ${tab === t.id ? "active" : ""}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
      </nav>

      <section className="panel">
        {tab === "turbo" && (
          <TurboStagesEditor stages={turboStages} setStages={setTurboStages} />
        )}
        {tab === "holweck" && (
          <HolweckStagesEditor
            stages={holweckStages}
            setStages={setHolweckStages}
          />
        )}
        {tab === "validation" && (
          <ValidationPanel
            selectedId={presetId}
            onSelect={loadPreset}
            result={result}
            activePreset={activePreset}
            outletPressure={outletPressure}
          />
        )}
        {tab === "results" && (
          <ResultsPanel
            result={result}
            outletPressure={outletPressure}
            activePreset={activePreset}
          />
        )}
        {tab === "help" && <HelpPanel />}
      </section>
    </div>
  );
}
