import { BATCH_TARGETS, HOME_SCREEN_HELP, reminderStatus, stepPresentation, stepTimeText } from './presentation';
import { HELP_COPY } from './helpCopy';
import { useEffect, useState } from 'react';
import {
  productOf, addSession,
  batchIcs,
  batchProgress,
  checkStep,
  deleteBatch,
  exportBackup,
  FLOUR_LABELS,
  fmtTemp,
  fmtWhen,
  gapToNext,
  getBatch,
  photoUrl,
  pushPermission,
  recordBulkRoomTemp,
  remindersOff,
  startTimer,
  stopTimer,
  timerState,
  wantsBulkRoomTemp,
  remindersOn,
  suggestions,
  uncheckStep,
  updateActual,
  UserError,
  type Batch,
  type Settings,
  type StepTimer,
  type Suggestion,
  type Survey,
} from '../api';
import type { Route } from './App';
import { StepDetail, tempsIn, Chips, cToF, download, fToC, Info, jumpTo, KitchenMark, NumField, RecipeView, shareOrDownload, toLocalInput } from './common';

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
  const [missing, setMissing] = useState(false);
  const [rating, setRating] = useState(false);
  const [result, setResult] = useState<{ suggestion?: Suggestion; backupDue: boolean; survey?: Batch['sessions'][number]['survey'] } | null>(null);

  useEffect(() => { if (rating) jumpTo(BATCH_TARGETS.rating); }, [rating]);
  useEffect(() => { if (result) jumpTo(BATCH_TARGETS.result); }, [result]);

  useEffect(() => {
    getBatch(id).then((b) => {
      setBatch(b ?? null);
      setMissing(!b);
    });
  }, [id]);

  if (missing) {
    return (
      <div className="pad">
        <p>This bake was deleted, so there is nothing to show.</p>
        <button className="small" onClick={() => go({ name: 'history' })}>
          Go to Bakes
        </button>
      </div>
    );
  }
  if (!batch) return <p className="pad">Loading…</p>;
  const p = batch.planned;
  const bread = productOf(p.formula) === 'bread';
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
            <p>{noAdviceText(result.survey)}</p>
          )}
          {result.backupDue && <BackupNudge onDone={onSaved} />}
        </section>
      )}

      <Checklist batch={batch} unit={unit} onChange={setBatch} />

<section id={BATCH_TARGETS.recipe} tabIndex={-1} aria-label="Batch recipe">
      <RecipeView recipe={p.recipe} yeast={p.yeast} water={p.water} unit={unit} />
      <p className="muted small">
        Planned to bake {fmtWhen(p.eatAt)}, room {fmtTemp(p.roomF, unit)}{p.riseF !== undefined ? `, rise ${fmtTemp(p.riseF, unit)}` : ''}, {p.mixer === 'hand' ? 'mixed by hand' : 'stand mixer'}{p.yeastType === 'activeDry' ? ', active dry yeast' : ''}{p.flour ? `, ${/flour$/i.test(FLOUR_LABELS[p.flour]) ? FLOUR_LABELS[p.flour].toLowerCase() : `${FLOUR_LABELS[p.flour]} flour`}` : ''}, {p.coldBulk ? `fridge rise (${p.stageH} h in the fridge)` : 'room rise'}.
      </p>
      <button className="small" onClick={() => go({
        name: 'plan',
        fromBatch: batch.id,
        repeat: {
          formula: p.formula, balls: p.balls, mixer: p.mixer, yeastType: p.yeastType, flour: p.flour, coldBulk: p.coldBulk, riseF: p.riseF,
          stageH: p.coldBulk ? p.stageH : undefined,
          manualYeastPct: p.yeast.basis === 'manual' && p.yeast.pct > 0 ? p.yeast.pct : undefined,
        },
      })}>Same dough again</button>
</section>

      <section id={BATCH_TARGETS.rating} tabIndex={-1} aria-label="Bake feedback">
      {rating ? (
        <RateForm bread={bread}
          settings={settings}
          onCancel={() => setRating(false)}
          onSave={async (form) => {
            const r = await addSession(batch.id, form);
            setBatch(r.batch);
            setResult({ suggestion: r.suggestion, backupDue: r.backupDue, survey: r.batch.sessions[r.batch.sessions.length - 1]?.survey });
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
            <SessionRow bread={bread} fridge={!!p.coldBulk} key={s.id} session={s} ovenName={settings.ovens.find((o) => o.id === s.ovenId)?.name ?? ''} />
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

function StepCountdown({ at }: { at: number }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const refresh = () => setNow(Date.now());
    const timer = window.setInterval(refresh, 15_000);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('pageshow', refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('pageshow', refresh);
    };
  }, []);
  const minutes = Math.ceil((at - now) / 60_000);
  if (minutes <= 0) return <> · due now</>;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const duration = hours ? [hours + ' hr', rest && rest + ' min'].filter(Boolean).join(' ') : minutes + ' min';
  return <> · in {duration}</>;
}

const clock = (ms: number) => {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** Timer for one step: countdown (sourced minutes) or stopwatch (no source gives a time). */
function StepTimerRow({ batch, stepKey, timer, run }: { batch: Batch; stepKey: string; timer: StepTimer; run: Run }) {
  const [now, setNow] = useState(Date.now);
  const st = timerState(batch, now);
  const running = st?.key === stepKey;
  useEffect(() => {
    if (!running) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [running]);
  const label = timer.kind === 'countdown' ? `Start ${timer.min} min timer` : 'Start stopwatch';
  return (
    <div className={running ? "step-timer active-timer" : "step-timer"}>
      {running && st ? (
        <>
          <div className="timer-reading">
            <span className="muted small">{timer.kind === 'stopwatch' ? 'Elapsed' : 'Time left'}</span>
            {st.done ? <strong role="status">Time’s up</strong> : <strong role="timer">{clock(st.ms)}</strong>}
          </div>
          <button className="link small" onClick={() => run(() => stopTimer(batch.id))}>
            {st.done ? 'Clear' : 'Stop'}
          </button>
        </>
      ) : (
        <button className="small" onClick={() => { setNow(Date.now()); return run(() => startTimer(batch.id, stepKey)); }}>
          {st && !running ? label.replace('Start ', 'Switch to ') : label}
        </button>
      )}
      <div className="muted small">
        {timer.kind === 'countdown'
          ? `${timer.source}${timer.upToMin ? `, up to ${timer.upToMin} min` : ''}`
          : timer.note}
      </div>
    </div>
  );
}

/** Runs one checklist action and shows the new batch, or an error if it didn't save. */
type Run = (action: () => Promise<Batch>) => Promise<void>;

/** After the fold: room temperature during the bulk rise, optional. */
function BulkRoomPrompt({ batch, unit, run }: { batch: Batch; unit: 'F' | 'C'; run: Run }) {
  const [v, setV] = useState('');
  return (
    <div className="bulk-room" role="group" aria-label="Room temperature during the rise">
      <label>
        Room temperature during the rise (°{unit}) <span className="field-hint">Optional</span>
        <input type="number" inputMode="decimal" value={v} onChange={(e) => setV(e.target.value)} />
      </label>
      <div className="step-actions">
        <button className="small primary-small" disabled={v === '' || !Number.isFinite(Number(v))} onClick={() => run(() => recordBulkRoomTemp(batch.id, Number(v), unit))}>
          Save
        </button>
        <button className="link small" onClick={() => run(() => recordBulkRoomTemp(batch.id, null, unit))}>
          Skip
        </button>
      </div>
    </div>
  );
}

/** The batch's steps as a checklist. Checking one off re-times the steps after it. */
function Checklist({ batch, unit, onChange }: { batch: Batch; unit: 'F' | 'C'; onChange: (b: Batch) => void }) {
  const prog = batchProgress(batch);
  const [pickFor, setPickFor] = useState<string | null>(null);
  const [pickAt, setPickAt] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const remindOn = !!batch.actual.reminders;
  const perm = pushPermission();
  const allDone = !prog.nextKey;
  const showBulkRoom = wantsBulkRoomTemp(batch);
  // Before anything is ticked, the first step starts whenever you do.
  const firstUntouched = prog.steps.some((s) => s.doneAt || s.passed) ? undefined : prog.steps[0]?.key;

  const run: Run = async (action) => {
    setErr('');
    try {
      onChange(await action());
    } catch (e) {
      setErr(e instanceof UserError ? e.message : 'Couldn’t save that. Nothing changed. Try again.');
    }
  };

  const check = async (key: string, at?: Date) => {
    setPickFor(null);
    await run(() => checkStep(batch.id, key, at));
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
          {batch.actual.reminderSync === 'pending' && (
            <p className="warn" role="status">
              Reminders may be out of date: the last update didn’t reach the server. The app retries when you’re back
              online.
            </p>
          )}
        </div>
      )}



      {prog.movedTo && (
        <p className="warn" role="status">
          {productOf(batch.planned.formula) === 'bread' || batch.planned.coldBulk
            ? `Bake time moved ${prog.movedTo.getTime() < Date.parse(batch.planned.eatAt) ? 'earlier' : 'later'} to ${fmtWhen(prog.movedTo)}.`
            : `Running behind: the balls need their full rest, so the bake moves to ${fmtWhen(prog.movedTo)}.`}
        </p>
      )}

      {prog.warnings.map((w) => (
        <p className="warn" role="status" key={w}>
          {w}
        </p>
      ))}

      {err && (
        <p className="warn" role="alert">
          {err}
        </p>
      )}

      <ol className="timeline checklist-steps">
        {prog.steps.map((s, i) => {
          const state = stepPresentation(s, prog.nextKey);
          const gap = gapToNext(prog.steps, i);
          return (
            <li key={s.key} className={state} aria-current={state === 'next' ? 'step' : undefined}>
              {state === 'next' && <p className="eyebrow next-label">Up next{firstUntouched !== s.key && <StepCountdown at={s.at.getTime()} />}</p>}
              <div className="step-heading">
                <b>{s.doneAt ? '✓ ' : ''}{s.label}</b>
                {s.doneAt && (
                  <button className="link small" aria-label={`Undo ${s.label}`} onClick={() => run(() => uncheckStep(batch.id, s.key))}>
                    Undo
                  </button>
                )}
              </div>
              <div className="step-time">{stepTimeText(s, firstUntouched === s.key, fmtWhen)}</div>
              {s.outOfOrder && (
                <div className="muted small step-note">Checked off before a step that comes ahead of it. That’s allowed; use Undo if the time is wrong.</div>
              )}
              {firstUntouched === s.key && (
                <div className="muted small">
                  Planned for {fmtWhen(s.at)}. The steps after it follow from when you tap Done.
                </div>
              )}
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
                      max={toLocalInput(new Date())}
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
              {!s.doneAt && !s.passed && <div className="muted small step-detail"><StepDetail unit={unit} stepKey={s.key} detail={s.cover === 'off' ? s.detail.replace(/ No cover needed while you shape\.$/, '') : s.detail} /></div>}
              {!s.doneAt && !s.passed && s.cover && (
                <div className="small step-cover">{s.cover === 'on' ? 'Lid on' : 'Lid off while shaping'}</div>
              )}
              {!s.doneAt && !s.passed && !!s.ingredients?.length && (
                <details key={state} open={state === 'next'} className="step-amounts">
                  <summary className="small">What goes in</summary>
                  <dl>
                    {s.ingredients.map((x) => (
                      <div key={x.name}>
                        <dt>{x.name}</dt><dd>{tempsIn(x.amount, unit)}</dd>
                      </div>
                    ))}
                  </dl>
                </details>
              )}
              {(s.doneAt || s.passed) && (
                <details className="step-amounts step-done-detail">
                  <summary className="small">Show instructions</summary>
                  <div className="muted small step-detail"><StepDetail unit={unit} stepKey={s.key} detail={s.cover === 'off' ? s.detail.replace(/ No cover needed while you shape\.$/, '') : s.detail} /></div>
                  {s.cover && <div className="small step-cover">{s.cover === 'on' ? 'Lid on' : 'Lid off while shaping'}</div>}
                  {!!s.ingredients?.length && (
                    <dl>
                      {s.ingredients.map((x) => (
                        <div key={x.name}>
                          <dt>{x.name}</dt><dd>{tempsIn(x.amount, unit)}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </details>
              )}
              {/* A running timer stays on screen after Done (Autolyse: Done starts the rest the timer counts). */}
              {s.timer && ((!s.doneAt && !s.passed) || batch.actual.timer?.key === s.key) && <StepTimerRow batch={batch} stepKey={s.key} timer={s.timer} run={run} />}
              {!s.doneAt && !s.passed && gap && <div className="small step-gap">{gap}</div>}
              {s.key === 'fold' && showBulkRoom && <BulkRoomPrompt batch={batch} unit={unit} run={run} />}
            </li>
          );
        })}
      </ol>
      {allDone && <p className="muted small">All steps done. Bake time was {timeOnly(prog.eatAt)}. Rate it below.</p>}
    </section>
  );
}

/** What the saved rating says when no answer points to a change: only a good rating earns "make it again". */
function noAdviceText(s?: Batch['sessions'][number]['survey']): string {
  const answered = !!s && Object.values(s).some((v) => v !== undefined);
  if (!answered) return 'Rating saved. You didn’t answer anything, so there’s no advice for next time.';
  if ((s.overall !== undefined && s.overall <= 2) || s.makeAgain === false) return 'Rating saved. Nothing in your answers points to one change to make.';
  return 'Nothing to change. Make it again the same way.';
}

function SessionRow({ session, ovenName, bread, fridge }: { bread: boolean; fridge: boolean; session: Batch['sessions'][number]; ovenName: string }) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (session.photoId) photoUrl(session.photoId).then(setUrl);
  }, [session.photoId]);
  const s = session.survey;
  const flags = [s.ready, s.stretch, s.rim, s.bottom, s.center, s.crust, s.loaf, s.crumb].filter((x) => x && x !== 'good' && x !== 'onTime' && x !== 'set');
  const tips = suggestions(s, { fridge });
  return (
    <div className="session">
      <div className="row between">
        <b>{fmtWhen(session.at)}</b>
        <span>{s.overall ? `${s.overall}/5` : ''}</span>
      </div>
      <div className="muted small">
        {session.balls} {bread ? session.balls === 1 ? 'loaf' : 'loaves' : 'balls'} · {ovenName}
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
  bread, settings,
  onSave,
  onCancel,
}: {
  settings: Settings;
  bread: boolean;
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
      <div hidden={bread} className="rating-tabs" aria-label="Rating sections">{['Dough', 'Bake', 'Verdict'].map((label, i) => <button key={label} aria-current={step === i ? 'step' : undefined} className={step === i ? 'on' : ''} onClick={() => setStep(i)}>{i + 1}. {label}</button>)}</div>
      <p className="muted small">Tap what fits. Skip anything you’re unsure of.</p>
      <div hidden={bread || step !== 0}>
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
      </div><div hidden={bread || step !== 1}>
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
      </div><div hidden={!bread && step !== 2}>
      <div className="label">Overall <span className="field-hint">1 = rough · 5 = loved it</span></div>
      <Chips
        value={survey.overall ? String(survey.overall) : undefined}
        onChange={(v) => set({ overall: Number(v) as Survey['overall'] })}
        options={['1', '2', '3', '4', '5'].map((n) => ({ v: n, label: n }))}
      />
      {bread && <details className="optional-notes"><summary>Add bread details</summary>
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
        <div className="label">Crust</div>
        <Chips value={survey.crust} onChange={v => set({ crust: v })} options={[{ v: 'pale', label: 'Pale' }, { v: 'good', label: 'Good' }, { v: 'dark', label: 'Dark' }]} />
        <div className="label">Loaf shape</div>
        <Chips value={survey.loaf} onChange={v => set({ loaf: v })} options={[{ v: 'flat', label: 'Flat' }, { v: 'good', label: 'Good' }, { v: 'tight', label: 'Tight' }]} />
        <div className="label">Crumb</div>
        <Chips value={survey.crumb} onChange={v => set({ crumb: v })} options={[{ v: 'gummy', label: 'Gummy' }, { v: 'good', label: 'Good' }]} />
      </details>}
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
          {bread ? 'Loaves baked' : 'Balls baked'}
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
        {!bread && step < 2 && <button className="primary" onClick={() => setStep(step + 1)}>Next →</button>}
        <button
          className={bread || step === 2 ? "primary" : "link"}
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
  const toUnit = (f?: number) => (f === undefined ? '' : String(Math.round(unit === 'F' ? f : fToC(f))));
  const fromUnit = (v: string) => (v === '' ? undefined : unit === 'F' ? Number(v) : cToF(Number(v)));
  // The form's values as of when it was opened, from the latest batch (check-offs fill some of them).
  const read = (a: Batch['actual']) => ({
    mixAt: a.mixAt ? toLocalInput(new Date(a.mixAt)) : '',
    ballAt: a.ballAt ? toLocalInput(new Date(a.ballAt)) : '',
    room: toUnit(a.roomF),
    fdt: toUnit(a.finalDoughF),
    notes: a.notes ?? '',
  });
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState(() => read(batch.actual));
  const [v, setV] = useState(start);
  const [error, setError] = useState('');
  const set = (p: Partial<typeof v>) => setV((cur) => ({ ...cur, ...p }));

  if (!open) {
    return (
      <button
        className="details-toggle actual-toggle"
        onClick={() => {
          const now = read(batch.actual);
          setStart(now);
          setV(now);
          setError('');
          setOpen(true);
        }}
      >
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
        <input type="datetime-local" value={v.mixAt} onChange={(e) => set({ mixAt: e.target.value })} />
      </label>
      <label>
        {productOf(batch.planned.formula) === 'bread' ? 'Shaped at' : 'Balled at'}
        <input type="datetime-local" value={v.ballAt} onChange={(e) => set({ ballAt: e.target.value })} />
      </label>
      <div className="row">
        <label className="grow">
          Room (°{unit})
          <input type="number" value={v.room} onChange={(e) => set({ room: e.target.value })} />
        </label>
        <label className="grow">
          Dough temp after mix (°{unit})
          <input type="number" value={v.fdt} onChange={(e) => set({ fdt: e.target.value })} />
        </label>
      </div>
      <label>
        Notes
        <textarea rows={2} value={v.notes} onChange={(e) => set({ notes: e.target.value })} />
      </label>
      {error && <p className="warn" role="alert">{error}</p>}
      <button
        className="small"
        onClick={async () => {
          // Save only the fields changed here, so nothing recorded by the checklist is overwritten.
          const patch: Batch['actual'] = {};
          if (v.mixAt !== start.mixAt) patch.mixAt = v.mixAt ? new Date(v.mixAt).toISOString() : undefined;
          if (v.ballAt !== start.ballAt) patch.ballAt = v.ballAt ? new Date(v.ballAt).toISOString() : undefined;
          if (v.room !== start.room) patch.roomF = fromUnit(v.room);
          if (v.fdt !== start.fdt) patch.finalDoughF = fromUnit(v.fdt);
          if (v.notes !== start.notes) patch.notes = v.notes || undefined;
          try {
            if (Object.keys(patch).length) await onSave(patch);
            setOpen(false);
          } catch {
            setError('Couldn’t save. Your entries are still here. Try again.');
          }
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
