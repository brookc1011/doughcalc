import { useState } from 'react';
import { exportBackup, fmtWhen, importBackup, saveSettings, type Settings } from '../api';
import type { Route } from './App';
import { cToF, fToC, NumField, shareOrDownload } from './common';

export function SettingsScreen({ settings, onChange, go }: { settings: Settings; onChange: () => void; go: (r: Route) => void }) {
  const [s, setS] = useState(settings);
  const [newOven, setNewOven] = useState('');
  const unit = s.unit;
  const show = (f: number) => Math.round(unit === 'F' ? f : fToC(f));
  const store = (v: string) => (unit === 'F' ? Number(v) : cToF(Number(v)));

  const save = async (next: Settings) => {
    setS(next);
    await saveSettings(next);
    onChange();
  };

  return (
    <div className="pad">
      <p className="eyebrow">Make yourself at home</p><h1>Settings</h1><p className="intro">Your kitchen, your defaults. Changes save as you go.</p>

      <section className="card">
        <h2>Doughs</h2>
        <p className="muted small">Set how many balls each dough starts with, add your own doughs, or hide the book ones.</p>
        <button className="small" onClick={() => go({ name: 'doughs' })}>
          Manage doughs
        </button>
      </section>

      <section className="card">
        <label>
          Units
          <select value={unit} onChange={(e) => save({ ...s, unit: e.target.value as 'F' | 'C' })}>
            <option value="F">°F</option>
            <option value="C">°C</option>
          </select>
        </label>
        <label>
          Warm-up out of the fridge (hours)
          <NumField value={s.warmUpH} onValue={(n) => save({ ...s, warmUpH: n })} />
          <span className="muted small">PizzaBlab: typically 0.5-3 h, until the ball is at least 50°F.</span>
        </label>
        <label>
          Kitchen adjustment (yeast multiplier)
          <NumField value={s.kitchenFactor} onValue={(n) => save({ ...s, kitchenFactor: n })} />
          <span className="muted small">1 = as calculated. Below 1 if your dough keeps running early, above 1 if late.</span>
        </label>
      </section>

      <details className="card"><summary>Water temperature</summary>
        <p className="muted small">
          Inside this room range the app shows the book's water temperature. Outside it, the app calculates water to hit the
          book's dough temperature.
        </p>
        <div className="row">
          <label className="grow">
            From (°{unit})
            <NumField value={show(s.bandLowF)} onValue={(n) => save({ ...s, bandLowF: store(String(n)) })} />
          </label>
          <label className="grow">
            To (°{unit})
            <NumField value={show(s.bandHighF)} onValue={(n) => save({ ...s, bandHighF: store(String(n)) })} />
          </label>
        </div>
        <div className="row">
          <label className="grow">
            Hand friction (°F)
            <NumField value={s.frictionHandF} onValue={(n) => save({ ...s, frictionHandF: n })} />
          </label>
          <label className="grow">
            Mixer friction (°F)
            <NumField value={s.frictionMixerF} onValue={(n) => save({ ...s, frictionMixerF: n })} />
          </label>
        </div>
        <p className="muted small">Defaults are assumptions inside King Arthur's ranges: 0-4°F gentle folds, 22-24°F KitchenAid.</p>
      </details>

      <section className="card">
        <h2>Ovens</h2>
        {s.ovens.map((o) => (
          <div className="row between" key={o.id}>
            <span>{o.name}</span>
            {s.ovens.length > 1 && (
              <button className="small" onClick={() => save({ ...s, ovens: s.ovens.filter((x) => x.id !== o.id) })}>
                Remove
              </button>
            )}
          </div>
        ))}
        <div className="row">
          <input aria-label="New oven name" className="grow" placeholder="e.g. Oven + steel, 550°F, top rack" value={newOven} onChange={(e) => setNewOven(e.target.value)} />
          <button
            className="small"
            disabled={!newOven}
            onClick={() => {
              save({ ...s, ovens: [...s.ovens, { id: `oven-${Date.now()}`, name: newOven }] });
              setNewOven('');
            }}
          >
            Add
          </button>
        </div>
      </section>

      <section className="card">
        <h2>Backup</h2>
        <p className="small">
          Last backup: {s.lastBackupAt ? fmtWhen(s.lastBackupAt) : 'never'}. Storage protected from clearing:{' '}
          {s.persisted ? 'yes' : 'no (back up regularly)'}.
        </p>
        <div className="row">
          <button
            className="small"
            onClick={async () => {
              const { filename, json } = await exportBackup();
              await shareOrDownload(filename, json, 'application/json');
              onChange();
            }}
          >
            Back up now
          </button>
          <label className="small filebtn">
            Restore from file
            <input
              type="file"
              accept="application/json"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                if (!confirm('Replace everything on this phone with this backup?')) return;
                try {
                  await importBackup(await f.text());
                  onChange();
                  alert('Restored.');
                } catch (err) {
                  alert((err as Error).message);
                }
              }}
            />
          </label>
        </div>
      </section>
    </div>
  );
}
