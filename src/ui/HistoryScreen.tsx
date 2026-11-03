import { useEffect, useState } from 'react';
import { doughHistory, fmtWhen, listBatches, timingTally, type Batch, type ReadyTally, type Settings } from '../api';
import type { Route } from './App';

type History = Awaited<ReturnType<typeof doughHistory>>;

export function HistoryScreen({ settings, go }: { settings: Settings; go: (r: Route) => void }) {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [hist, setHist] = useState<History>([]);
  const [tally, setTally] = useState<ReadyTally | null>(null);

  useEffect(() => {
    listBatches().then(setBatches);
    doughHistory().then(setHist);
    timingTally().then(setTally);
  }, []);

  const latestTry = batches.find((b) => b.nextTry)?.nextTry;

  return (
    <div className="pad">
      <h1>Bakes</h1>

      {latestTry && (
        <section className="card highlight">
          <h2>Try next time</h2>
          <p>{latestTry}</p>
        </section>
      )}

      {hist.length > 0 && (
        <section className="card">
          <h2>By dough</h2>
          {hist.map((h) => (
            <div key={h.doughId} className="session">
              <div className="row between">
                <b>{h.name}</b>
                <span>{h.avgOverall ? `${h.avgOverall.toFixed(1)}/5 avg` : ''}</span>
              </div>
              <div className="muted small">
                {h.bakes} bakes {h.scores.length > 1 && <Spark values={h.scores} />}
              </div>
              {h.bestBatchId && (
                <button className="link small" onClick={() => go({ name: 'batch', id: h.bestBatchId! })}>
                  Open best batch
                </button>
              )}
            </div>
          ))}
        </section>
      )}

      {tally && tally.early + tally.onTime + tally.late > 0 && (
        <section className="card">
          <h2>Dough timing</h2>
          <p>
            Early {tally.early} · On time {tally.onTime} · Late {tally.late}
          </p>
          <p className="muted small">
            If one side keeps winning, set a kitchen adjustment in Settings (now x{settings.kitchenFactor.toFixed(2)}).
          </p>
        </section>
      )}

      <section className="card">
        <h2>All batches</h2>
        {batches.length === 0 && <p className="muted">Nothing yet. Plan a bake and lock it in.</p>}
        {batches.map((b) => {
          const scores = b.sessions.map((s) => s.survey.overall).filter(Boolean);
          return (
            <button key={b.id} className="listrow" onClick={() => go({ name: 'batch', id: b.id })}>
              <div className="row between">
                <b>{b.title}</b>
                <span>{scores.length ? `${scores.join(', ')}/5` : 'not rated'}</span>
              </div>
              <div className="muted small">{fmtWhen(b.planned.eatAt)}</div>
            </button>
          );
        })}
      </section>
    </div>
  );
}

/** Tiny trend line of overall scores, oldest to newest. */
function Spark({ values }: { values: number[] }) {
  const w = 80;
  const h = 18;
  const pts = values
    .map((v, i) => `${(i / (values.length - 1)) * w},${h - ((v - 1) / 4) * h}`)
    .join(' ');
  return (
    <svg width={w} height={h} className="spark" aria-label="Score trend">
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
