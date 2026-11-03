import { useEffect, useMemo, useState } from 'react';
import {
  allDoughs,
  ballForDiameter,
  cloneDough,
  defaultStageH,
  fmtGrams,
  isPreset,
  lockIn,
  makePlan,
  planIcs,
  STYLE_TF,
  STYLE_TF_SOURCE,
  type BallGroup,
  type Formula,
  type Settings,
} from '../api';
import type { Route } from './App';
import { cToF, download, fToC, RecipeView, Timeline, toLocalInput } from './common';

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

  useEffect(() => {
    allDoughs().then(setDoughs);
  }, []);

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
    setDoughId(id);
    setEdits({});
    setStageH(undefined);
    const f = doughs.find((d) => d.id === id);
    if (f) setBalls(balls.map((b) => (b.label === 'pizza' || balls.length === 1 ? { ...b, grams: f.ballG } : b)));
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
      <h1>Plan a bake</h1>

      <section className="card">
        <label>
          Dough
          <select value={doughId} onChange={(e) => pickDough(e.target.value)}>
            {doughs.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>

        <div className="label">Dough balls</div>
        {balls.map((b, i) => (
          <div className="row ball" key={i}>
            <input
              type="number"
              min={0}
              value={b.count}
              onChange={(e) => setBall(i, { count: Number(e.target.value) })}
              aria-label="Count"
            />
            <span>×</span>
            <input
              type="number"
              min={50}
              value={b.grams}
              onChange={(e) => setBall(i, { grams: Number(e.target.value) })}
              aria-label="Grams each"
            />
            <span>g</span>
            <input
              className="grow"
              value={b.label ?? ''}
              placeholder="pizza"
              onChange={(e) => setBall(i, { label: e.target.value })}
              aria-label="Label"
            />
            {balls.length > 1 && (
              <button className="small" onClick={() => setBalls(balls.filter((_, j) => j !== i))}>
                ✕
              </button>
            )}
          </div>
        ))}
        <div className="row">
          <button className="small" onClick={() => setBalls([...balls, { count: 1, grams: 200, label: 'focaccia' }])}>
            + another size
          </button>
          <SizeHelper formula={formula} onPick={(g) => setBall(0, { grams: Math.round(g) })} />
        </div>

        <label>
          Eat at
          <input type="datetime-local" value={eatAt} onChange={(e) => setEatAt(e.target.value)} />
        </label>
        <label>
          Room temperature (°{unit})
          <input type="number" value={room} onChange={(e) => setRoom(Number(e.target.value))} />
        </label>
      </section>

      <button className="link" onClick={() => setDetails(!details)}>
        {details ? 'Hide details' : 'Details'}
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
            <input
              type="number"
              step={0.5}
              value={stageH ?? defaultStageH(formula)}
              onChange={(e) => setStageH(Number(e.target.value))}
            />
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
              <input
                type="number"
                step={0.5}
                value={+(formula.hydration * 100).toFixed(1)}
                onChange={(e) => setEdits({ ...edits, hydration: Number(e.target.value) / 100 })}
              />
            </label>
            <label className="grow">
              Salt %
              <input
                type="number"
                step={0.1}
                value={+(formula.salt * 100).toFixed(2)}
                onChange={(e) => setEdits({ ...edits, salt: Number(e.target.value) / 100 })}
              />
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
        <p className="warn" key={e}>
          {e}
        </p>
      ))}

      <RecipeView recipe={plan.recipe} yeast={plan.yeast} water={plan.water} unit={unit} />
      <Timeline
        steps={plan.schedule.steps}
        title={formula.name}
        onIcs={() => download('dough-plan.ics', planIcs(plan), 'text/calendar')}
      />

      <button className="primary" disabled={plan.errors.length > 0 || saving} onClick={lock}>
        Lock in & start
      </button>
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
