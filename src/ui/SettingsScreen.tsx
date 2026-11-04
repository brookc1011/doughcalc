import { useState } from 'react';
import { exportBackup, fmtWhen, importBackup, saveSettings, type Settings } from '../api';
import type { Route } from './App';
import { cToF, fToC, Info, NumField, shareOrDownload } from './common';

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
          <span>
            Warm-up out of the fridge (hours)
            <Info>
              How long balls sit out of the fridge before you stretch them. Cold dough tears and springs back. PizzaBlab:
              typically 0.5-3 h, until the ball is at least 50°F.
            </Info>
          </span>
          <NumField value={s.warmUpH} onValue={(n) => save({ ...s, warmUpH: n })} />
        </label>
        <label>
          <span>
            Kitchen adjustment (yeast multiplier)
            <Info>
              Multiplies the yeast for every bake. 1 means as calculated. The Bakes tab counts how often your dough was
              early, on time or late. Mostly early: go a little below 1. Mostly late: a little above. Change it in small
              steps.
            </Info>
          </span>
          <NumField value={s.kitchenFactor} onValue={(n) => save({ ...s, kitchenFactor: n })} />
        </label>
      </section>

      <details className="card"><summary>Water temperature</summary>
        <p className="small">
          Water temperature sets how warm the dough is after mixing, and that sets how fast it rises. When your room is in
          this range, use the book’s water. Outside it, the app works out a water temperature that lands the dough at the
          book’s target.
          <Info
            links={[
              {
                href: 'https://www.kingarthurbaking.com/blog/2018/05/29/desired-dough-temperature',
                text: 'King Arthur: Desired dough temperature',
              },
              {
                href: 'https://www.kingarthurbaking.com/blog/2018/08/27/determining-the-friction-factor-in-baking',
                text: 'King Arthur: Determining the friction factor',
              },
            ]}
          >
            The math is King Arthur’s: 3 × target dough temp, minus room, flour and friction temps (4 × with a poolish).
            Friction is the heat mixing adds. A mixer adds much more than hands.
          </Info>
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
        <p className="muted small">
          Name each setup you bake with, like “steel, 550°F, top rack”. Every rating records which one you used, so you
          can compare. Only matters if you use more than one.
        </p>
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
