import { BATCH_TARGETS, HOME_SCREEN_HELP, reminderStatus, stepPresentation } from './presentation';
import { HELP_COPY } from './helpCopy';
import { useEffect, useState } from 'react';
import {
  addSession,
  batchIcs,
  batchProgress,
  checkStep,
  deleteBatch,
  exportBackup,
  fmtTemp,
  fmtWhen,
  getBatch,
  photoUrl,
  pushPermission,
  remindersOff,
  remindersOn,
  suggestions,
  uncheckStep,
  updateActual,
  type Batch,
  type Settings,
  type Suggestion,
  type Survey,
} from '../api';
import type { Route } from './App';
import { Chips, cToF, download, fToC, Info, jumpTo, KitchenMark, NumField, RecipeView, shareOrDownload, toLocalInput } from './common';

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

  useEffect(() => { if (rating) jumpTo(BATCH_TARGETS.rating); }, [rating]);
  useEffect(() => { if (result) jumpTo(BATCH_TARGETS.result); }, [result]);

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
    <div className="pad batch-screen">
      <button className="link" onClick={() => go({ name: 'history' })}>
        ← Bakes
      </button>
      <h1>{batch.title}</h1>
      <p className="muted small">Locked in {fmtWhen(batch.createdAt)}</p>

      <nav className="batch-jumps" aria-label="Batch shortcuts">
        <button onClick={() => jumpTo(BATCH_TARGETS.steps)}>Steps</button>
        <button onClick={() => jumpTo(BATCH_TARGETS.recipe)}>Recipe</button>
        <button onClick={() => { setRating(true); jumpTo(BATCH_TARGETS.rating); }}>Rate</button>
      </nav>

      {result && (
        <section id={BATCH_TARGETS.result} tabIndex={-1} className="card highlight" role="status">
          <p className="eyebrow">Bake saved</p>
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

      <Checklist batch={batch} onChange={setBatch} />

<section id={BATCH_TARGETS.recipe} tabIndex={-1} aria-label="Batch recipe">
      <RecipeView recipe={p.recipe} yeast={p.yeast} water={p.water} unit={unit} />
      <p className="muted small">
        Planned for {fmtWhen(p.eatAt)}, room {fmtTemp(p.roomF, unit)}, {p.mixer === 'hand' ? 'mixed by hand' : 'stand mixer'}.
      </p>
</section>

      <section id={BATCH_TARGETS.rating} tabIndex={-1} aria-label="Bake feedback">
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

      </section>

      <ActualForm batch={batch} unit={unit} onSave={async (a) => setBatch(await updateActual(batch.id, a))} />

      {batch.sessions.length > 0 && (
        <details className="card"><summary>Bakes from this batch ({batch.sessions.length})</summary>
          {batch.sessions.map((s) => (
            <SessionRow key={s.id} session={s} ovenName={settings.ovens.find((o) => o.id === s.ovenId)?.name ?? ''} />
          ))}
        </details>
      )}


      <button className="link danger" onClick={remove}>
        Delete batch
      </button>
    </div>
  );
}

const timeOnly = (d: Date) => d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

/** The batch's steps as a checklist. Checking one off re-times the steps after it. */
function Checklist({ batch, onChange }: { batch: Batch; onChange: (b: Batch) => void }) {
  const prog = batchProgress(batch);
  const [pickFor, setPickFor] = useState<string | null>(null);
  const [pickAt, setPickAt] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const remindOn = !!batch.actual.reminders;
  const perm = pushPermission();
  const allDone = !prog.nextKey;

  const check = async (key: string, at?: Date) => {
    setPickFor(null);
    onChange(await checkStep(batch.id, key, at));
  };

  const toggleReminders = async () => {
    setBusy(true);
    setMsg('');
    try {
      onChange(remindOn ? await remindersOff(batch.id) : await remindersOn(batch.id));
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section id={BATCH_TARGETS.steps} tabIndex={-1} className="card checklist" aria-label="Batch steps">
      <div className="row between">
        <h2>Steps</h2>
        <button className="link small" onClick={() => download('dough-batch.ics', batchIcs(batch), 'text/calendar')}>
          Add to calendar
        </button>
      </div>

      {/* Optional review item: reminders above the step list. */}
      {!allDone && (
        <div className="remind-row">
          <button
            className={remindOn ? 'small remind on' : 'small remind'}
            aria-pressed={remindOn}
            disabled={busy || perm === 'unsupported' || perm === 'not-set-up'}
            onClick={toggleReminders}
          >
            <KitchenMark kind="bell" />
            {busy ? 'One moment…' : remindOn ? 'Reminders on' : 'Remind me'}
          </button>
          <span className="muted small">
            {reminderStatus(perm, remindOn)}
            <Info label="reminder privacy">{HELP_COPY["reminder privacy"]}</Info>
          </span>
          {perm === 'unsupported' && (
            <details className="home-screen-help">
              <summary>How to add on iPhone</summary>
              <p className="muted small">{HOME_SCREEN_HELP}</p>
            </details>
          )}
          {msg && (
            <p className="warn" role="alert">
              {msg}
            </p>
          )}
        </div>
      )}

      {prog.movedTo && (
        <p className="warn" role="status">
          Running behind: the balls need their full rest, so dinner moves to {fmtWhen(prog.movedTo)}.
        </p>
      )}

      <ol className="timeline checklist-steps">
        {prog.steps.map((s) => {
          const state = stepPresentation(s, prog.nextKey);
          return (
            <li key={s.key} className={state} aria-current={state === 'next' ? 'step' : undefined}>
              {state === 'next' && <p className="eyebrow next-label">Up next</p>}
              <div className="step-heading">
                <b>{s.doneAt ? '✓ ' : ''}{s.label}</b>
                {s.doneAt && (
                  <button className="link small" aria-label={`Undo ${s.label}`} onClick={async () => onChange(await uncheckStep(batch.id, s.key))}>
                    Undo
                  </button>
                )}
              </div>
              <div className="step-time">
                {s.doneAt ? `Done ${fmtWhen(s.doneAt)}` : s.passed ? 'Not ticked' : fmtWhen(s.at)}
              </div>
              {!s.doneAt && !s.passed && <div className="muted small step-detail">{s.detail}</div>}
              {!s.doneAt && !s.passed && (
                <div className="step-actions">
                  <button className={state === 'next' ? 'small primary-small' : 'small'} aria-label={`Mark ${s.label} done now`} onClick={() => check(s.key)}>
                    Done now
                  </button>
                  <button
                    className="link small"
                    aria-expanded={pickFor === s.key}
                    aria-label={`Choose completion time for ${s.label}`}
                    onClick={() => {
                      setPickFor(pickFor === s.key ? null : s.key);
                      setPickAt(toLocalInput(new Date()));
                    }}
                  >
                    Choose time
                  </button>
                </div>
              )}
              {pickFor === s.key && (
                <div className="step-picker">
                  <label>
                    When did you do this?
                    <input
                      type="datetime-local"
                      aria-label={`When you did: ${s.label}`}
                      value={pickAt}
                      onChange={(e) => setPickAt(e.target.value)}
                    />
                  </label>
                  <div className="row">
                    <button className="small primary-small" disabled={!pickAt} onClick={() => check(s.key, new Date(pickAt))}>
                      Save time
                    </button>
                    <button className="link small" onClick={() => setPickFor(null)}>Cancel</button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ol>
      {allDone && <p className="muted small">All steps done. Dinner was {timeOnly(prog.eatAt)}. Rate it below.</p>}
    </section>
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
  const [step, setStep] = useState(0);
  const [error, setError] = useState('');
  const set = (patch: Partial<Survey>) => setSurvey({ ...survey, ...patch });

  return (
    <section className="card rating-card" aria-label="Rate this bake">
      <p className="eyebrow">A quick bake check-in</p>
      <h2>How did it go?</h2>
      <div className="rating-tabs" aria-label="Rating sections">{['Dough', 'Bake', 'Verdict'].map((label, i) => <button key={label} aria-current={step === i ? 'step' : undefined} className={step === i ? 'on' : ''} onClick={() => setStep(i)}>{i + 1}. {label}</button>)}</div>
      <p className="muted small">Tap what fits. Skip anything you’re unsure of.</p>
      <div hidden={step !== 0}>
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
      </div><div hidden={step !== 1}>
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
      </div><div hidden={step !== 2}>
      <div className="label">Overall <span className="field-hint">1 = rough · 5 = loved it</span></div>
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
          <NumField value={balls} onValue={setBalls} style={{ width: '5em' }} />
        </label>
      </div>
      <details className="optional-notes"><summary>Add a note or photo (optional)</summary>
      <label>
        Note (optional)
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
      </label>
      <label>
        Photo (optional)
        <input type="file" accept="image/*" capture="environment" onChange={(e) => setPhoto(e.target.files?.[0])} />
      </label>
      </details></div>
      {error && <p className="warn" role="alert">{error}</p>}
      <div className="rating-actions">
        {step > 0 && <button onClick={() => setStep(step - 1)}>Back</button>}
        {step < 2 && <button className="primary" onClick={() => setStep(step + 1)}>Next →</button>}
        <button
          className={step === 2 ? "primary" : "link"}
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError('');
            try {
              await onSave({ ovenId, balls, survey, note: note || undefined, photo });
            } catch {
              setError('Couldn’t save. Your answers are still here. Try again.');
            } finally { setBusy(false); }
          }}
        >
          {busy ? 'Saving…' : 'Save rating'}
        </button>
        <button className="link" disabled={busy} onClick={onCancel}>
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
      <button className="details-toggle actual-toggle" onClick={() => setOpen(true)}>
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
