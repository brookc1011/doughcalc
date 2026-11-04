import { useEffect, useState } from 'react';
import {
  bookOriginal,
  cloneDough,
  DEFAULT_EAT_HOUR,
  defaultBalls,
  doughLibrary,
  fmtGrams,
  fmtPct,
  removeDough,
  resetDough,
  restoreDough,
  saveDough,
  type BallGroup,
  type DoughEntry,
  type Formula,
} from '../api';
import type { Route } from './App';

export function DoughsScreen({ go, onChange }: { go: (r: Route) => void; onChange: () => void }) {
  const [lib, setLib] = useState<DoughEntry[]>([]);
  const [baseId, setBaseId] = useState('');
  const [newName, setNewName] = useState('');
  const [error, setError] = useState('');

  const load = () => doughLibrary().then((l) => {
    setLib(l);
    setBaseId((id) => id || l.find((e) => !e.hidden)?.formula.id || l[0]?.formula.id || '');
  });
  useEffect(() => {
    load();
  }, []);

  const shown = lib.filter((e) => !e.hidden);
  const hidden = lib.filter((e) => e.hidden);

  const remove = async (e: DoughEntry) => {
    const msg =
      e.kind === 'book'
        ? `Hide ${e.formula.name}? You can bring it back any time.`
        : `Delete ${e.formula.name}? This can't be undone. Past bakes keep their recipe.`;
    if (!confirm(msg)) return;
    try {
      setError('');
      await removeDough(e.formula.id);
      await load();
      onChange();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const create = async () => {
    const base = lib.find((e) => e.formula.id === baseId)?.formula;
    if (!base || !newName.trim()) return;
    const mine = await cloneDough(base, newName.trim());
    setNewName('');
    go({ name: 'dough', id: mine.id });
  };

  return (
    <div className="pad">
      <button className="link" onClick={() => go({ name: 'settings' })}>
        ← Settings
      </button>
      <p className="eyebrow">Your recipe box</p>
      <h1>Doughs</h1>
      <p className="intro">Edit what each dough starts with, add your own, or hide the ones you don’t use.</p>

      {error && (
        <p className="warn" role="alert">
          {error}
        </p>
      )}

      <section className="card">
        {shown.map((e) => (
          <div className="session" key={e.formula.id}>
            <div className="row between">
              <b>{e.formula.name}</b>
              <span className="muted small">{e.kind === 'book' ? (e.edited ? 'Book, edited' : 'Book') : 'Mine'}</span>
            </div>
            <div className="muted small">
              {summary(e.formula)} · {e.formula.source}
            </div>
            <div className="row">
              <button className="small" onClick={() => go({ name: 'dough', id: e.formula.id })}>
                Edit
              </button>
              <button className="small" onClick={() => remove(e)}>
                {e.kind === 'book' ? 'Hide' : 'Delete'}
              </button>
            </div>
          </div>
        ))}
      </section>

      <section className="card">
        <h2>New dough</h2>
        <p className="muted small">Starts as a copy of an existing dough, so it keeps that dough’s yeast schedule and sources.</p>
        <label>
          Start from
          <select value={baseId} onChange={(e) => setBaseId(e.target.value)}>
            {lib.map((e) => (
              <option key={e.formula.id} value={e.formula.id}>
                {e.formula.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Name
          <input value={newName} placeholder="e.g. Friday night pies" onChange={(e) => setNewName(e.target.value)} />
        </label>
        <button className="primary" disabled={!newName.trim()} onClick={create}>
          Create and edit
        </button>
      </section>

      {hidden.length > 0 && (
        <section className="card">
          <h2>Hidden book doughs</h2>
          {hidden.map((e) => (
            <div className="row between" key={e.formula.id}>
              <span>{e.formula.name}</span>
              <button
                className="small"
                onClick={async () => {
                  await restoreDough(e.formula.id);
                  await load();
                  onChange();
                }}
              >
                Restore
              </button>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

function summary(f: Formula): string {
  const balls = defaultBalls(f)
    .map((b) => `${b.count} × ${fmtGrams(b.grams)}`)
    .join(' + ');
  return `${fmtPct(f.hydration)} water · starts at ${balls}`;
}

const pct = (v: number) => +(v * 100).toFixed(2);

export function DoughEditor({ id, go, onChange }: { id: string; go: (r: Route) => void; onChange: () => void }) {
  const [entry, setEntry] = useState<DoughEntry | null>(null);
  const [f, setF] = useState<Formula | null>(null);
  const [balls, setBalls] = useState<BallGroup[]>([]);
  const [eatHour, setEatHour] = useState(DEFAULT_EAT_HOUR);
  const [mixer, setMixer] = useState<'hand' | 'mixer' | ''>('');
  const [saved, setSaved] = useState(false);

  const load = async () => {
    const e = (await doughLibrary()).find((x) => x.formula.id === id) ?? null;
    setEntry(e);
    if (!e) return;
    setF(e.formula);
    setBalls(defaultBalls(e.formula));
    setEatHour(e.formula.defaults?.eatHour ?? DEFAULT_EAT_HOUR);
    setMixer(e.formula.defaults?.mixer ?? '');
  };
  useEffect(() => {
    load();
  }, [id]);

  if (!entry || !f) return <p className="pad">Loading…</p>;
  const book = entry.kind === 'book' ? bookOriginal(f.id) : undefined;

  const patch = (p: Partial<Formula>) => {
    setF({ ...f, ...p });
    setSaved(false);
  };
  const setBall = (i: number, p: Partial<BallGroup>) => {
    setBalls(balls.map((b, j) => (j === i ? { ...b, ...p } : b)));
    setSaved(false);
  };

  const save = async () => {
    const next: Formula = {
      ...f,
      defaults: { balls: balls.filter((b) => b.count > 0), eatHour, mixer: mixer || undefined },
    };
    await saveDough(next);
    await load();
    setSaved(true);
    onChange();
  };

  return (
    <div className="pad">
      <button className="link" onClick={() => go({ name: 'doughs' })}>
        ← Doughs
      </button>
      <p className="eyebrow">{entry.kind === 'book' ? (entry.edited ? 'Book dough, edited' : 'Book dough') : 'My dough'}</p>
      <h1>{f.name}</h1>
      <p className="muted small">{f.source}</p>

      <section className="card">
        <h2>When I pick this dough, start with</h2>
        <div className="label">
          Dough balls <span className="field-hint">count × grams each</span>
        </div>
        {balls.map((b, i) => (
          <div className="row ball" key={i}>
            <input type="number" min={0} value={b.count} aria-label="Count" onChange={(e) => setBall(i, { count: Number(e.target.value) })} />
            <span>×</span>
            <input type="number" min={50} value={b.grams} aria-label="Grams each" onChange={(e) => setBall(i, { grams: Number(e.target.value) })} />
            <span>g</span>
            <input
              className="ball-label"
              value={b.label ?? ''}
              placeholder="pizza"
              aria-label="Label"
              onChange={(e) => setBall(i, { label: e.target.value })}
            />
            {balls.length > 1 && (
              <button className="small" aria-label={`Remove ball group ${i + 1}`} onClick={() => setBalls(balls.filter((_, j) => j !== i))}>
                ✕
              </button>
            )}
          </div>
        ))}
        <button className="small" onClick={() => setBalls([...balls, { count: 1, grams: 200, label: 'focaccia' }])}>
          + another size
        </button>
        <label>
          Eat at (time of day)
          <select value={eatHour} onChange={(e) => { setEatHour(Number(e.target.value)); setSaved(false); }}>
            {Array.from({ length: 24 }, (_, h) => (
              <option key={h} value={h}>
                {new Date(2000, 0, 1, h).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
              </option>
            ))}
          </select>
        </label>
        <label>
          Mixing
          <select value={mixer} onChange={(e) => { setMixer(e.target.value as 'hand' | 'mixer' | ''); setSaved(false); }}>
            <option value="">Same as last time</option>
            <option value="hand">By hand</option>
            <option value="mixer">Stand mixer</option>
          </select>
        </label>
      </section>

      <section className="card">
        <h2>Recipe</h2>
        <label>
          Name
          <input value={f.name} onChange={(e) => patch({ name: e.target.value })} />
        </label>
        <div className="row">
          <label className="grow">
            Water %
            <input type="number" step={0.5} value={pct(f.hydration)} onChange={(e) => patch({ hydration: Number(e.target.value) / 100 })} />
          </label>
          <label className="grow">
            Salt %
            <input type="number" step={0.1} value={pct(f.salt)} onChange={(e) => patch({ salt: Number(e.target.value) / 100 })} />
          </label>
        </div>
        <div className="row">
          <label className="grow">
            Olive oil %
            <input type="number" step={0.5} value={pct(f.oil)} onChange={(e) => patch({ oil: Number(e.target.value) / 100 })} />
          </label>
          <label className="grow">
            Sugar %
            <input type="number" step={0.5} value={pct(f.sugar)} onChange={(e) => patch({ sugar: Number(e.target.value) / 100 })} />
          </label>
        </div>
        <div className="row">
          <label className="grow">
            Reference ball (g)
            <input type="number" value={f.ballG} onChange={(e) => patch({ ballG: Number(e.target.value) })} />
          </label>
          <label className="grow">
            for a pizza of (in)
            <input type="number" value={f.ballDiameterIn} onChange={(e) => patch({ ballDiameterIn: Number(e.target.value) })} />
          </label>
        </div>
        <p className="muted small">
          The reference ball sets the thickness used by “Set ball for size” on the Plan screen. Yeast and timing come from:{' '}
          {f.anchors.map((a) => a.source).join('; ')}.
          {book && ` Book recipe: ${fmtPct(book.hydration)} water, ${fmtPct(book.salt)} salt.`}
        </p>
        <label>
          Notes
          <textarea rows={3} value={f.notes ?? ''} onChange={(e) => patch({ notes: e.target.value || undefined })} />
        </label>
      </section>

      <button className="primary" onClick={save}>
        {saved ? 'Saved' : 'Save dough'}
      </button>
      {entry.kind === 'book' && entry.edited && (
        <button
          className="link"
          onClick={async () => {
            if (!confirm(`Put ${f.name} back to the book recipe and defaults?`)) return;
            await resetDough(f.id);
            await load();
            onChange();
          }}
        >
          Reset to book recipe
        </button>
      )}
    </div>
  );
}
