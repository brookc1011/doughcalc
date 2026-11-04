import { useEffect, useMemo, useState } from 'react';
import {
  allDoughs,
  ballForDiameter,
  cloneDough,
  DEFAULT_EAT_HOUR,
  defaultBalls,
  defaultStageH,
  fmtGrams,
  isPreset,
  lockIn,
  makePlan,
  planIcs,
  saveDough,
  STYLE_TF,
  STYLE_TF_SOURCE,
  type BallGroup,
  type Formula,
  type Settings,
} from '../api';
import type { Route } from './App';
import { cToF, download, fToC, NumField, RecipeView, Timeline, toLocalInput } from './common';

function tomorrowAt(hour: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(hour, 0, 0, 0);
  return d;
}

export function PlanScreen({ settings, go, onSaved }: { settings: Settings; go: (r: Route) => void; onSaved: () => void }) {
  const unit = settings.unit;
  const [doughs, setDoughs] = useState<Formula[]>([]);
  const [doughId, setDoughId] = useState(settings.lastDoughId);
  const [balls, setBalls] = useState<BallGroup[]>(settings.lastBalls);
  const [eatAt, setEatAt] = useState(toLocalInput(tomorrowAt(18)));
  const [room, setRoom] = useState(Math.round(unit === 'F' ? settings.roomF : fToC(settings.roomF)));
  const [mixer, setMixer] = useState<'hand' | 'mixer'>(settings.mixer);
  const [details, setDetails] = useState(false);
  const [stageH, setStageH] = useState<number | undefined>();
  const [mixAt, setMixAt] = useState('');
  const [manualYeast, setManualYeast] = useState('');
  const [edits, setEdits] = useState<{ hydration?: number; salt?: number }>({});
  const [saving, setSaving] = useState(false);
  const [defaultsSaved, setDefaultsSaved] = useState(false);

  /** Load a dough's own starting values: balls, eat-at time, mixer. */
  const applyDefaults = (f: Formula) => {
    setDoughId(f.id);
    setBalls(defaultBalls(f));
    setEatAt(toLocalInput(tomorrowAt(f.defaults?.eatHour ?? DEFAULT_EAT_HOUR)));
    setMixer(f.defaults?.mixer ?? settings.mixer);
    setDefaultsSaved(false);
  };

  useEffect(() => {
    allDoughs().then((list) => {
      setDoughs(list);
      const start = list.find((d) => d.id === settings.lastDoughId) ?? list[0];
      if (start) applyDefaults(start);
    });
  }, []);

  // Any change after saving re-enables "Always start this dough this way".
  useEffect(() => setDefaultsSaved(false), [balls, eatAt, mixer]);

  const base = doughs.find((d) => d.id === doughId) ?? doughs[0];
  const formula: Formula | undefined = base && { ...base, ...edits };
  const edited = Object.keys(edits).length > 0;

  const plan = useMemo(() => {
    if (!formula) return null;
    return makePlan(
      {
        formula,
        balls,
        eatAt: new Date(eatAt),
        roomF: unit === 'F' ? room : cToF(room),
        stageH,
        mixer,
        mixAt: mixAt ? new Date(mixAt) : undefined,
        manualYeastPct: manualYeast ? Number(manualYeast) / 100 : undefined,
      },
      settings,
    );
  }, [formula, balls, eatAt, room, stageH, mixer, mixAt, manualYeast, settings, unit]);

  if (!formula || !plan) return <p className="pad">Loading…</p>;

  const setBall = (i: number, patch: Partial<BallGroup>) =>
    setBalls(balls.map((b, j) => (j === i ? { ...b, ...patch } : b)));

  const pickDough = (id: string) => {
    setEdits({});
    setStageH(undefined);
    const f = doughs.find((d) => d.id === id);
    if (f) applyDefaults(f);
  };

  /** Save the current balls, eat-at hour and mixer as this dough's starting values. */
  const saveDefaults = async () => {
    if (!base) return;
    await saveDough({
      ...base,
      defaults: { balls: balls.filter((b) => b.count > 0), eatHour: new Date(eatAt).getHours(), mixer },
    });
    setDoughs(await allDoughs());
    setDefaultsSaved(true);
  };

  const saveAsMine = async () => {
    const name = prompt('Name for this dough', `My ${formula.name}`);
    if (!name) return;
    const mine = await cloneDough(formula, name);
    setDoughs(await allDoughs());
    setDoughId(mine.id);
    setEdits({});
  };

  const lock = async () => {
    setSaving(true);
    try {
      const batch = await lockIn(plan, mixer);
      onSaved();
      go({ name: 'batch', id: batch.id });
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const stageLabel = formula.family === 'poolish' ? 'Poolish ripening (hours)' : 'Bulk ferment (hours)';

  return (
    <div className="pad">
      <p className="eyebrow">A little planning. Great pizza.</p>
      <h1>Plan a bake</h1>
      <p className="intro">Pick your dough. We’ll work back from dinner.</p>

      <section className="card plan-inputs">
        <label>
          <span className="row between">
            Dough
            <button type="button" className="link small" onClick={() => go({ name: 'doughs' })}>
              Manage doughs
            </button>
          </span>
          <select value={doughId} onChange={(e) => pickDough(e.target.value)}>
            {doughs.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>

        <div className="label">Dough balls <span className="field-hint">count × grams each</span></div>
        {balls.map((b, i) => (
          <div className="row ball" key={i}>
            <NumField value={b.count} onValue={(n) => setBall(i, { count: n })} aria-label="Count" />
            <span>×</span>
            <NumField value={b.grams} onValue={(n) => setBall(i, { grams: n })} aria-label="Grams each" />
            <span>g</span>
            {balls.length > 1 && (
              <button className="small" aria-label={`Remove ball group ${i + 1}`} onClick={() => setBalls(balls.filter((_, j) => j !== i))}>
                ✕
              </button>
            )}
          </div>
        ))}
        <details className="size-options"><summary>Labels, sizes & diameter</summary>
          {balls.map((b, i) => <label key={i}>Ball group {i + 1} label
            <input
              className="grow ball-label"
              value={b.label ?? ''}
              placeholder="pizza"
              onChange={(e) => setBall(i, { label: e.target.value })}
              aria-label="Label"
            />
</label>)}
        <div className="row">
          <button className="small" onClick={() => setBalls([...balls, { count: 1, grams: 200, label: 'focaccia' }])}>
            + another size
          </button>
          <SizeHelper formula={formula} onPick={(g) => setBall(0, { grams: Math.round(g) })} />
        </div>

        </details>
        <button type="button" className="link small" onClick={saveDefaults} disabled={defaultsSaved}>
          {defaultsSaved ? `Saved as the starting point for ${formula.name}` : 'Always start this dough this way'}
        </button>
        <label>
          Eat at
          <input type="datetime-local" value={eatAt} onChange={(e) => setEatAt(e.target.value)} />
        </label>
        <label>
          Room temperature (°{unit})
          <NumField value={room} onValue={setRoom} />
        </label>
      </section>

      <button className="details-toggle" aria-expanded={details} onClick={() => setDetails(!details)}>
        {details ? '− Hide details' : '+ Details'}
      </button>
      {details && (
        <section className="card">
          <label>
            Mixing
            <select value={mixer} onChange={(e) => setMixer(e.target.value as 'hand' | 'mixer')}>
              <option value="hand">By hand</option>
              <option value="mixer">Stand mixer</option>
            </select>
          </label>
          <label>
            {stageLabel}
            <NumField value={stageH ?? defaultStageH(formula)} onValue={setStageH} />
          </label>
          <label>
            Fixed mix time (optional)
            <input type="datetime-local" value={mixAt} onChange={(e) => setMixAt(e.target.value)} />
          </label>
          <label>
            Yeast % override (optional)
            <input
              type="number"
              step={0.01}
              value={manualYeast}
              placeholder={(plan.yeast.pct * 100).toFixed(3)}
              onChange={(e) => setManualYeast(e.target.value)}
            />
          </label>
          <div className="row">
            <label className="grow">
              Hydration %
              <NumField
                value={+(formula.hydration * 100).toFixed(1)}
                onValue={(n) => setEdits({ ...edits, hydration: n / 100 })}
              />
            </label>
            <label className="grow">
              Salt %
              <NumField value={+(formula.salt * 100).toFixed(2)} onValue={(n) => setEdits({ ...edits, salt: n / 100 })} />
            </label>
          </div>
          {(edited || isPreset(formula)) && (
            <button className="small" onClick={saveAsMine}>
              Save as My Dough
            </button>
          )}
          <details>
            <summary className="small">Style thickness reference</summary>
            <p className="muted small">
              Your current ball: {fmtGrams(formula.ballG)} for {formula.ballDiameterIn}". Bands from {STYLE_TF_SOURCE}, oz per sq in.
            </p>
            <ul className="small">
              {STYLE_TF.map((t) => (
                <li key={t.style}>
                  {t.style}: {t.low === t.high ? t.low : `${t.low}-${t.high}`}
                </li>
              ))}
            </ul>
          </details>
        </section>
      )}

      {plan.errors.map((e) => (
        <p className="warn" role="alert" key={e}>
          {e}
        </p>
      ))}

      <RecipeView recipe={plan.recipe} yeast={plan.yeast} water={plan.water} unit={unit} />
      <Timeline
        steps={plan.schedule.steps}
        title={formula.name}
        onIcs={() => download('dough-plan.ics', planIcs(plan), 'text/calendar')}
      />

      <div className="plan-action"><button className="primary" disabled={plan.errors.length > 0 || saving} onClick={lock}>
        {saving ? 'Saving your batch…' : 'Lock in & start'}
      </button></div>
    </div>
  );
}

function SizeHelper({ formula, onPick }: { formula: Formula; onPick: (grams: number) => void }) {
  const [d, setD] = useState('');
  return (
    <span className="row">
      <input
        type="number"
        placeholder='size "'
        value={d}
        onChange={(e) => setD(e.target.value)}
        aria-label="Pizza diameter in inches"
        style={{ width: '5.5em' }}
      />
      <button
        className="small"
        disabled={!d}
        onClick={() => onPick(ballForDiameter(formula.ballG, formula.ballDiameterIn, Number(d)))}
        title={`Keeps the thickness of ${formula.ballG} g on ${formula.ballDiameterIn}"`}
      >
        Set ball for size
      </button>
    </span>
  );
}
