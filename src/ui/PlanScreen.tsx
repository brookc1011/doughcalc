import { defaultStart, READY_WINDOW_SOURCE, TIMING_HINTS } from './presentation';
import { FLOUR_SOURCES, HELP_COPY } from './helpCopy';
import { useEffect, useMemo, useState } from 'react';
import {
  allDoughs, lastDoughId, timingModes, type Product,
  ballForDiameter,
  cloneDough,
  DEFAULT_EAT_HOUR,
  FLOUR_LABELS,
  defaultBalls,
  defaultStageH,
  fmtTemp,
  fmtWhen,
  isPreset,
  lockIn,
  makePlan,
  planIcs,
  saveDough,
  type BallGroup,
  type Flour,
  type Formula,
  type Settings,
  type TimingMode,
  type YeastType,
} from '../api';
import type { Route } from './App';
import { Chips, cToF, download, fToC, Info, NumField, RecipeView, Timeline, toLocalInput } from './common';

function tomorrowAt(hour: number, minute = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(hour, minute, 0, 0);
  return d;
}


const TIMING_OPTIONS: { v: TimingMode; label: string }[] = [
  { v: 'eat', label: 'Bake at' },
  { v: 'start', label: 'Start at' },
  { v: 'both', label: 'Both' },
];

const TIMING_INTRO: Record<TimingMode, string> = {
  eat: 'Pick your dough. We’ll work back from when the first pizza goes in.',
  start: 'Pick your dough. We’ll tell you when it’s ready.',
  both: 'Pick your dough. We’ll fit it between start and bake.',
};

export function PlanScreen({ product, chooseProduct, settings, go, onSaved, repeat }: { product: Product; chooseProduct: (p: Product) => void; repeat?: Extract<Route, { name: 'plan' }>['repeat']; settings: Settings; go: (r: Route) => void; onSaved: () => void }) {
  const bread = product === 'bread';
  const loadDoughs = () => bread ? allDoughs(product) : allDoughs();
  const unit = settings.unit;
  const [doughs, setDoughs] = useState<Formula[]>([]);
  const [doughId, setDoughId] = useState(repeat?.formula.id ?? settings.lastDoughId);
  const [balls, setBalls] = useState<BallGroup[]>(repeat?.balls ?? settings.lastBalls);
  const [eatAt, setEatAt] = useState(toLocalInput(tomorrowAt(repeat?.formula.defaults?.eatHour ?? (bread ? 9 : 18), repeat?.formula.defaults?.eatMinute ?? (bread ? 15 : 0))));
  const [timing, setTiming] = useState<TimingMode>('eat');
  const [startAt, setStartAt] = useState(toLocalInput(defaultStart()));
  const [room, setRoom] = useState(Math.round(unit === 'F' ? settings.roomF : fToC(settings.roomF)));
  // Blank by default every time: a winter setback shouldn't carry into a summer bake.
  const [rise, setRise] = useState('');
  const [mixer, setMixer] = useState<'hand' | 'mixer'>(bread ? 'hand' : repeat?.mixer ?? settings.mixer);
  const [yeastType, setYeastType] = useState<YeastType>(repeat ? repeat.yeastType ?? 'instant' : settings.yeastType ?? 'instant');
  const [flour, setFlour] = useState<Flour | ''>(repeat ? repeat.flour ?? '' : settings.flour ?? '');
  const [useSnapshot, setUseSnapshot] = useState(!!repeat);
  const [details, setDetails] = useState(false);
  const [stageH, setStageH] = useState<number | undefined>();
  const [manualYeast, setManualYeast] = useState('');
  const [edits, setEdits] = useState<{ hydration?: number; salt?: number }>({});
  const [saving, setSaving] = useState(false);
  const [defaultsSaved, setDefaultsSaved] = useState(false);

  /** Load a dough's own starting values: balls, eat-at time, mixer. */
  const applyDefaults = (f: Formula) => {
    setDoughId(f.id);
    setBalls(defaultBalls(f));
    // In Start or Both mode the times you typed stay put when you switch dough.
    if (timing === 'eat') setEatAt(toLocalInput(tomorrowAt(f.defaults?.eatHour ?? DEFAULT_EAT_HOUR, f.defaults?.eatMinute ?? 0)));
    setMixer(bread ? 'hand' : f.defaults?.mixer ?? settings.mixer);
    setDefaultsSaved(false);
  };

  useEffect(() => {
    let active = true;
    Promise.all([loadDoughs(), lastDoughId(product)]).then(([list, last]) => {
      if (!active) return;
      setDoughs(list);
      const start = list.find((d) => d.id === last) ?? list[0];
      if (start && !repeat) {
        applyDefaults(start);
        if (bread && settings.lastLoaves?.length && last === start.id) setBalls(settings.lastLoaves);
      }
    });
    return () => { active = false; };
  }, []);

  // Any change after saving re-enables "Always start this dough this way".
  useEffect(() => setDefaultsSaved(false), [balls, eatAt, mixer]);

  const savedFormula = doughs.find((d) => d.id === doughId);
  const base = useSnapshot ? repeat?.formula : savedFormula ?? doughs[0];
  const formula: Formula | undefined = base && { ...base, ...edits };
  const edited = Object.keys(edits).length > 0;

  const riseNum = rise.trim() !== '' && Number.isFinite(Number(rise.replace(',', '.'))) ? Number(rise.replace(',', '.')) : undefined;
  const planFor = (f: Formula, ownStage = true) =>
    makePlan(
      {
        formula: f,
        balls,
        eatAt: new Date(eatAt),
        roomF: unit === 'F' ? room : cToF(room),
        riseF: riseNum === undefined ? undefined : unit === 'F' ? riseNum : cToF(riseNum),
        stageH: ownStage ? stageH : undefined,
        mixer,
        timing,
        startAt: timing === 'eat' ? undefined : new Date(startAt),
        manualYeastPct: manualYeast ? Number(manualYeast) / 100 : undefined,
        yeastType,
        flour: flour || undefined,
      },
      settings,
    );

  const plan = useMemo(
    () => (formula ? planFor(formula) : null),
    [formula, balls, eatAt, room, rise, stageH, mixer, timing, startAt, manualYeast, yeastType, flour, settings, unit],
  );

  // When start and eat times don't fit this dough, list the other doughs that do.
  const fitting = useMemo(() => {
    if (!plan || timing !== 'both' || plan.errors.length === 0) return [];
    return doughs.filter((d) => d.id !== doughId && planFor(d, false).errors.length === 0);
  }, [plan, doughs, doughId]);

  if (!formula || !plan) return <p className="pad">Loading…</p>;

  const setBall = (i: number, patch: Partial<BallGroup>) =>
    setBalls(balls.map((b, j) => (j === i ? { ...b, ...patch } : b)));

  const pickDough = (id: string) => {
    setUseSnapshot(false);
    setEdits({});
    setStageH(undefined);
    const f = doughs.find((d) => d.id === id);
    if (f) applyDefaults(f);
  };

  /** Save the current balls, eat-at hour and mixer as this dough's starting values. */
  const saveDefaults = async () => {
    const base = savedFormula;
    if (!base) return;
    if (bread) await saveDough({ ...base, defaults: { balls: balls.filter(b => b.count > 0), eatHour: new Date(eatAt).getHours(), eatMinute: new Date(eatAt).getMinutes(), mixer } });
    else await saveDough({
      ...base,
      defaults: { balls: balls.filter((b) => b.count > 0), eatHour: new Date(eatAt).getHours(), mixer },
    });
    setDoughs(bread ? await allDoughs(product) : await allDoughs());
    setDefaultsSaved(true);
  };

  const saveAsMine = async () => {
    const name = prompt('Name for this dough', `My ${formula.name}`);
    if (!name) return;
    const mine = await cloneDough(formula, name);
    setDoughs(bread ? await allDoughs(product) : await allDoughs());
    setUseSnapshot(false);
    setDoughId(mine.id);
    setEdits({});
  };

  const lock = async () => {
    setSaving(true);
    try {
      const batch = await lockIn(plan, mixer, flour || undefined);
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
      <p className="eyebrow">{bread ? "Your bread kitchen" : "A little planning. Great pizza."}</p>
      <h1>Plan a bake</h1>
      <Chips value={product} options={[{ v: 'pizza', label: 'Pizza' }, { v: 'bread', label: 'Bread' }]} onChange={chooseProduct} />
      <p className="intro">{useSnapshot ? 'Choose a new time for this dough.' : bread ? 'Choose your loaves and when to bake.' : TIMING_INTRO[timing]}</p>

      <section className="card plan-inputs">
        <div className="row between field-heading">
            <label htmlFor="plan-dough">Dough</label>
            <button type="button" className="link small" onClick={() => go({ name: 'doughs', fromPlan: true })}>
              Manage doughs
            </button>
        </div>
          <select id="plan-dough" value={doughId} onChange={(e) => pickDough(e.target.value)}>
            {useSnapshot && !savedFormula && <option value={doughId}>{base?.name}</option>}
            {doughs.map((d) => (
              <option key={d.id} value={d.id}>
                {useSnapshot && d.id === doughId ? base?.name : d.name}
              </option>
            ))}
          </select>

        <div className="label">
          {bread ? 'Loaves' : 'Dough balls'} <span className="field-hint">count × grams each</span>
          {!bread && <Info label="dough balls">{HELP_COPY["dough balls"]}</Info>}
        </div>
        {balls.map((b, i) => (
          <div className="row ball" key={i}>
            <NumField value={b.count} onValue={(n) => setBall(i, { count: n })} aria-label={`${bread ? 'Loaf' : 'Ball'} group ${i + 1}: count`} />
            <span>×</span>
            <NumField value={b.grams} onValue={(n) => setBall(i, { grams: n })} aria-label={`${bread ? 'Loaf' : 'Ball'} group ${i + 1}: grams each`} />
            <span>g</span>
            {balls.length > 1 && (
              <button className="small" aria-label={`Remove ball group ${i + 1}`} onClick={() => setBalls(balls.filter((_, j) => j !== i))}>
                ✕
              </button>
            )}
          </div>
        ))}
        <div className="save-defaults-row">
          <button type="button" className="small" onClick={saveDefaults} disabled={defaultsSaved || !savedFormula}>
            {defaultsSaved ? 'Saved' : 'Save defaults'}
          </button>
          <Info label="saved defaults">{bread ? 'Saves loaf sizes and bake time for this dough.' : HELP_COPY['saved defaults']}</Info>
        </div>
        {!bread && <details className="size-options"><summary>Sizes & diameter</summary>
        <p className="muted small">
          “Set ball for size” changes the first line’s grams so a bigger or smaller pizza keeps the same thickness as{' '}
          {formula.ballG} g on {formula.ballDiameterIn}".
        </p>
        <div className="row">
          <button className="small" onClick={() => setBalls([...balls, { count: 1, grams: 200, label: 'focaccia' }])}>
            + another size
          </button>
          <SizeHelper formula={formula} onPick={(g) => setBall(0, { grams: Math.round(g) })} />
        </div>

        </details>}
        <fieldset className="timing-group">
        <legend className="sr-only">Plan around</legend>
        <div className="timing-help">
          <span>Plan around</span>
          <Info label="planning times">{bread ? 'Bake at is when the loaves go in the oven. Start at works forward from the first step.' : HELP_COPY['planning times']}</Info>
        </div>
        <Chips value={timing} options={TIMING_OPTIONS.filter(o => timingModes(formula).includes(o.v))} onChange={setTiming} />
        <p className="timing-hint">{TIMING_HINTS[timing]}</p>
        {timing !== 'eat' && (
          <label>
            Start at <span className="field-hint">{formula.family === 'poolish' ? 'mixing the poolish' : 'first step'}</span>
            <input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} />
          </label>
        )}
        {timing !== 'start' && (
          <label>
            {bread ? 'Bake at' : 'First pizza in the oven at'}
            <input type="datetime-local" value={eatAt} onChange={(e) => setEatAt(e.target.value)} />
          </label>
        )}
        {bread && plan.schedule.steps.some(s => s.key === 'slice') && <dl className="bread-times">
          {plan.schedule.steps.filter(s => s.key === 'bake' || s.key === 'slice').map(s => <div key={s.key}><dt>{s.key === 'bake' ? 'Into the oven' : 'Ready to slice'}</dt><dd>{fmtWhen(s.at)}</dd></div>)}
        </dl>}
        {plan.window && (
          <div className="ready-window">
            <p className="eyebrow">Ready window</p>
            <p className="muted small">From this start, {formula.name}:</p>
            <dl>
              <div><dt>Ready from</dt><dd>{fmtWhen(plan.window.earliest)}</dd></div>
              <div><dt>Keeps in the fridge until</dt><dd>{fmtWhen(plan.window.latest)}</dd></div>
            </dl>
            <p className="muted small">{READY_WINDOW_SOURCE}
              {timing === 'start' ? ' Eat any time in this window.' : ''}
            </p>
          </div>
        )}
        {plan.fitNote && <p className="fit-note">{plan.fitNote}</p>}
        </fieldset>
        <label>
          <span>
            Room temperature (°{unit})
            <Info label="room temperature">{HELP_COPY["room temperature"]}</Info>
          </span>
          <NumField value={room} onValue={setRoom} />
        </label>
        <label>
          <span>
            Average room temperature over the whole rise (°{unit}) <span className="field-hint">Optional</span>
            <Info label="rise temperature">{HELP_COPY["rise temperature"]}</Info>
          </span>
          <input
            type="text"
            inputMode="decimal"
            value={rise}
            placeholder={String(room)}
            onChange={(e) => setRise(e.target.value)}
          />
        </label>
        {plan.yeast.basis === 'estimate' && plan.input.riseF !== undefined && plan.yeast.anchor && plan.input.riseF < plan.yeast.anchor.tempF && (
          <p className="fit-note">
            Your rise is cooler than the {fmtTemp(plan.yeast.anchor.tempF, unit)}{' '}
            {plan.yeast.anchor.tempAssumed ? 'the app assumes for the book amount' : 'the book uses'}, so the yeast is
            scaled up (estimate). Or keep the dough warmer, for example in the oven with only the light on (check it with a
            thermometer), and enter that temperature instead.
          </p>
        )}
        <fieldset className="bake-setup">
          <legend>{bread ? 'Ingredients' : 'Mixing & ingredients'}</legend>
          <div className="setup-fields">
            {!bread && <div className="setup-row">
              <label htmlFor="plan-mixing">Mixing</label>
              <Info label="mixing method">{HELP_COPY["mixing method"]}</Info>
              <select id="plan-mixing" value={mixer} onChange={(e) => setMixer(e.target.value as 'hand' | 'mixer')}>
                <option value="hand">By hand</option>
                <option value="mixer">Stand mixer</option>
              </select>
            </div>}
            <div className="setup-row">
              <label htmlFor="plan-yeast">Yeast</label>
              <Info label="yeast type">{HELP_COPY["yeast type"]}</Info>
              <select id="plan-yeast" value={yeastType} onChange={(e) => setYeastType(e.target.value as YeastType)}>
                <option value="instant">Instant</option>
                <option value="activeDry">Active dry</option>
              </select>
            </div>
            <div className="setup-row">
              <label htmlFor="plan-flour">Flour</label>
              <Info label="flour" links={bread ? undefined : FLOUR_SOURCES}>{bread ? 'Recorded with this bake for your flour history.' : HELP_COPY['flour']}</Info>
              <select id="plan-flour" value={flour} onChange={(e) => setFlour(e.target.value as Flour | '')}>
                <option value="">Not set</option>
                {(Object.keys(FLOUR_LABELS) as Flour[]).map((k) => (
                  <option key={k} value={k}>{FLOUR_LABELS[k]}</option>
                ))}
              </select>
            </div>
          </div>
        </fieldset>
      </section>

      {plan.errors.map((e) => (
        <p className="warn" role="alert" key={e}>
          {e}
        </p>
      ))}
      {fitting.length > 0 && (
        <section className="card fitting-card">
          <h2>A dough that fits</h2>
          <p className="small">These doughs fit your start and bake times on the book schedule:</p>
          {fitting.map((d) => (
            <div className="fit-option" key={d.id}>
              <span>{d.name}</span>
              <button className="small" aria-label={`Use ${d.name}`} onClick={() => pickDough(d.id)}>
                Use it
              </button>
            </div>
          ))}
        </section>
      )}

      <button className="details-toggle" aria-expanded={details} onClick={() => setDetails(!details)}>
        {details ? '− Hide details' : '+ Details'}
      </button>
      {details && (
        <section className="card">
          <h2>Fine-tune this bake</h2>
          <label>
            <span>
              {stageLabel}
              <Info label="ferment time">
                {formula.family === 'poolish'
                  ? 'How long the poolish sits out before the final mix.'
                  : bread ? 'Time from mixing to shaping the loaves.' : 'Time from mixing to dividing into balls.'}{' '}
                The book’s time uses the book’s yeast. Any other time scales the yeast and is labeled “estimate”.
              </Info>
            </span>
            <NumField value={stageH ?? defaultStageH(formula)} onValue={setStageH} />
          </label>
          <label>
            <span>
              Yeast % override (optional)
              <Info label="yeast override">{HELP_COPY["yeast override"]}</Info>
            </span>
            <input
              type="number"
              step={0.01}
              value={manualYeast}
              placeholder={(plan.yeast.pct * 100).toFixed(3)}
              onChange={(e) => setManualYeast(e.target.value)}
            />
          </label>
          <p className="muted small">
            Hydration and salt below change this bake only. “Save as My Dough” keeps them.
          </p>
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

          {(edited || useSnapshot || isPreset(formula)) && (
            <button className="small" onClick={saveAsMine}>
              Save as My Dough
            </button>
          )}
        </section>
      )}

      <RecipeView recipe={plan.recipe} yeast={plan.yeast} water={plan.water} unit={unit} />
      {/* A schedule that doesn't fit would show steps out of order (balling after dinner), so hide it until it fits. */}
      {plan.schedule.errors.length === 0 && <Timeline
        steps={plan.schedule.steps}
        title={formula.name}
        onIcs={() => download('dough-plan.ics', planIcs(plan), 'text/calendar')}
      />}

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
