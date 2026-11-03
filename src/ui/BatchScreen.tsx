import { useEffect, useState } from 'react';
import {
  addSession,
  batchIcs,
  deleteBatch,
  exportBackup,
  fmtTemp,
  fmtWhen,
  getBatch,
  photoUrl,
  suggestions,
  updateActual,
  type Batch,
  type Settings,
  type Suggestion,
  type Survey,
} from '../api';
import type { Route } from './App';
import { Chips, cToF, download, fToC, RecipeView, shareOrDownload, Timeline, toLocalInput } from './common';

export function BatchScreen({
  id,
  settings,
  go,
  onSaved,
}: {
  id: string;
  settings: Settings;
  go: (r: Route) => void;
  onSaved: () => void;
}) {
  const [batch, setBatch] = useState<Batch | null>(null);
  const [rating, setRating] = useState(false);
  const [result, setResult] = useState<{ suggestion?: Suggestion; backupDue: boolean } | null>(null);

  useEffect(() => {
    getBatch(id).then((b) => setBatch(b ?? null));
  }, [id]);

  if (!batch) return <p className="pad">Loading…</p>;
  const p = batch.planned;
  const unit = settings.unit;

  const remove = async () => {
    if (!confirm('Delete this batch and its ratings?')) return;
    await deleteBatch(batch.id);
    go({ name: 'history' });
  };

  return (
    <div className="pad">
      <button className="link" onClick={() => go({ name: 'history' })}>
        ← Bakes
      </button>
      <h1>{batch.title}</h1>
      <p className="muted">Locked in {fmtWhen(batch.createdAt)}</p>

      {result && (
        <section className="card highlight">
          {result.suggestion ? (
            <>
              <h2>One thing to try next time</h2>
              <p>{result.suggestion.text}</p>
              {result.suggestion.source && <p className="muted small">Source: {result.suggestion.source}</p>}
            </>
          ) : (
            <p>Nothing to change. Make it again the same way.</p>
          )}
          {result.backupDue && <BackupNudge onDone={onSaved} />}
        </section>
      )}

      {rating ? (
        <RateForm
          settings={settings}
          onCancel={() => setRating(false)}
          onSave={async (form) => {
            const r = await addSession(batch.id, form);
            setBatch(r.batch);
            setResult({ suggestion: r.suggestion, backupDue: r.backupDue });
            setRating(false);
            onSaved();
          }}
        />
      ) : (
        <button className="primary" onClick={() => setRating(true)}>
          Rate a bake from this batch
        </button>
      )}

      {batch.sessions.length > 0 && (
        <section className="card">
          <h2>Bakes from this batch</h2>
          {batch.sessions.map((s) => (
            <SessionRow key={s.id} session={s} ovenName={settings.ovens.find((o) => o.id === s.ovenId)?.name ?? ''} />
          ))}
        </section>
      )}

      <ActualForm batch={batch} unit={unit} onSave={async (a) => setBatch(await updateActual(batch.id, a))} />

      <RecipeView recipe={p.recipe} yeast={p.yeast} water={p.water} unit={unit} />
      <Timeline
        steps={p.steps}
        title={p.formula.name}
        onIcs={() => download('dough-batch.ics', batchIcs(batch), 'text/calendar')}
      />
      <p className="muted small">
        Planned for {fmtWhen(p.eatAt)}, room {fmtTemp(p.roomF, unit)}, {p.mixer === 'hand' ? 'mixed by hand' : 'stand mixer'}.
      </p>
      <button className="link danger" onClick={remove}>
        Delete batch
      </button>
    </div>
  );
}

function SessionRow({ session, ovenName }: { session: Batch['sessions'][number]; ovenName: string }) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (session.photoId) photoUrl(session.photoId).then(setUrl);
  }, [session.photoId]);
  const s = session.survey;
  const flags = [s.ready, s.stretch, s.rim, s.bottom, s.center].filter((x) => x && x !== 'good' && x !== 'onTime' && x !== 'set');
  const tips = suggestions(s);
  return (
    <div className="session">
      <div className="row between">
        <b>{fmtWhen(session.at)}</b>
        <span>{s.overall ? `${s.overall}/5` : ''}</span>
      </div>
      <div className="muted small">
        {session.balls} balls · {ovenName}
        {s.makeAgain !== undefined ? ` · make again: ${s.makeAgain ? 'yes' : 'no'}` : ''}
      </div>
      {flags.length > 0 && <div className="small">Flags: {flags.join(', ')}</div>}
      {tips[0] && <div className="small">Next: {tips[0].text}</div>}
      {session.note && <div className="small">“{session.note}”</div>}
      {url && <img src={url} alt="Bake" className="photo" />}
    </div>
  );
}

type RateFormValue = Parameters<typeof addSession>[1];

function RateForm({
  settings,
  onSave,
  onCancel,
}: {
  settings: Settings;
  onSave: (f: RateFormValue) => Promise<void>;
  onCancel: () => void;
}) {
  const [survey, setSurvey] = useState<Survey>({});
  const [ovenId, setOvenId] = useState(settings.lastOvenId);
  const [balls, setBalls] = useState(1);
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState<File>();
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<Survey>) => setSurvey({ ...survey, ...patch });

  return (
    <section className="card">
      <h2>How did it go?</h2>
      <div className="label">Dough was ready</div>
      <Chips
        value={survey.ready}
        onChange={(v) => set({ ready: v })}
        options={[
          { v: 'early', label: 'Early' },
          { v: 'onTime', label: 'On time' },
          { v: 'late', label: 'Late' },
        ]}
      />
      <div className="label">Stretching</div>
      <Chips
        value={survey.stretch}
        onChange={(v) => set({ stretch: v })}
        options={[
          { v: 'tore', label: 'Tore' },
          { v: 'good', label: 'Good' },
          { v: 'snapped', label: 'Snapped back' },
        ]}
      />
      <div className="label">Rim</div>
      <Chips
        value={survey.rim}
        onChange={(v) => set({ rim: v })}
        options={[
          { v: 'flat', label: 'Flat' },
          { v: 'good', label: 'Good' },
          { v: 'puffy', label: 'Too puffy' },
        ]}
      />
      <div className="label">Bottom</div>
      <Chips
        value={survey.bottom}
        onChange={(v) => set({ bottom: v })}
        options={[
          { v: 'pale', label: 'Pale' },
          { v: 'good', label: 'Good' },
          { v: 'burnt', label: 'Burnt' },
        ]}
      />
      <div className="label">Center</div>
      <Chips
        value={survey.center}
        onChange={(v) => set({ center: v })}
        options={[
          { v: 'gummy', label: 'Gummy' },
          { v: 'set', label: 'Cooked through' },
        ]}
      />
      <div className="label">Overall</div>
      <Chips
        value={survey.overall ? String(survey.overall) : undefined}
        onChange={(v) => set({ overall: Number(v) as Survey['overall'] })}
        options={['1', '2', '3', '4', '5'].map((n) => ({ v: n, label: n }))}
      />
      <div className="label">Make it again?</div>
      <Chips
        value={survey.makeAgain === undefined ? undefined : survey.makeAgain ? 'yes' : 'no'}
        onChange={(v) => set({ makeAgain: v === 'yes' })}
        options={[
          { v: 'yes', label: 'Yes' },
          { v: 'no', label: 'No' },
        ]}
      />
      <div className="row">
        <label className="grow">
          Oven
          <select value={ovenId} onChange={(e) => setOvenId(e.target.value)}>
            {settings.ovens.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Balls baked
          <input type="number" min={1} value={balls} onChange={(e) => setBalls(Number(e.target.value))} style={{ width: '5em' }} />
        </label>
      </div>
      <label>
        Note (optional)
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
      </label>
      <label>
        Photo (optional)
        <input type="file" accept="image/*" capture="environment" onChange={(e) => setPhoto(e.target.files?.[0])} />
      </label>
      <div className="row">
        <button
          className="primary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await onSave({ ovenId, balls, survey, note: note || undefined, photo });
            setBusy(false);
          }}
        >
          Save
        </button>
        <button className="link" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </section>
  );
}

function ActualForm({ batch, unit, onSave }: { batch: Batch; unit: 'F' | 'C'; onSave: (a: Batch['actual']) => Promise<void> }) {
  const a = batch.actual;
  const [open, setOpen] = useState(false);
  const toUnit = (f?: number) => (f === undefined ? '' : String(Math.round(unit === 'F' ? f : fToC(f))));
  const [mixAt, setMixAt] = useState(a.mixAt ? toLocalInput(new Date(a.mixAt)) : '');
  const [ballAt, setBallAt] = useState(a.ballAt ? toLocalInput(new Date(a.ballAt)) : '');
  const [room, setRoom] = useState(toUnit(a.roomF));
  const [fdt, setFdt] = useState(toUnit(a.finalDoughF));
  const [notes, setNotes] = useState(a.notes ?? '');
  const fromUnit = (v: string) => (v === '' ? undefined : unit === 'F' ? Number(v) : cToF(Number(v)));

  if (!open) {
    return (
      <button className="link" onClick={() => setOpen(true)}>
        What actually happened (optional)
      </button>
    );
  }
  return (
    <section className="card">
      <h2>What actually happened</h2>
      <p className="muted small">Only fill in what differed from the plan.</p>
      <label>
        Mixed at
        <input type="datetime-local" value={mixAt} onChange={(e) => setMixAt(e.target.value)} />
      </label>
      <label>
        Balled at
        <input type="datetime-local" value={ballAt} onChange={(e) => setBallAt(e.target.value)} />
      </label>
      <div className="row">
        <label className="grow">
          Room (°{unit})
          <input type="number" value={room} onChange={(e) => setRoom(e.target.value)} />
        </label>
        <label className="grow">
          Dough temp after mix (°{unit})
          <input type="number" value={fdt} onChange={(e) => setFdt(e.target.value)} />
        </label>
      </div>
      <label>
        Notes
        <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>
      <button
        className="small"
        onClick={async () => {
          await onSave({
            mixAt: mixAt ? new Date(mixAt).toISOString() : undefined,
            ballAt: ballAt ? new Date(ballAt).toISOString() : undefined,
            roomF: fromUnit(room),
            finalDoughF: fromUnit(fdt),
            notes: notes || undefined,
          });
          setOpen(false);
        }}
      >
        Save
      </button>
    </section>
  );
}

export function BackupNudge({ onDone }: { onDone: () => void }) {
  const [done, setDone] = useState(false);
  if (done) return <p className="muted small">Backup saved.</p>;
  return (
    <div className="nudge">
      <p className="small">It has been a few bakes since your last backup. Save one to Google Drive?</p>
      <button
        className="small"
        onClick={async () => {
          const { filename, json } = await exportBackup();
          await shareOrDownload(filename, json, 'application/json');
          setDone(true);
          onDone();
        }}
      >
        Back up now
      </button>
    </div>
  );
}
