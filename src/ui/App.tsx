import { useEffect, useRef, useState } from 'react';
import { getSettings, requestPersistence, type Settings } from '../api';
import { BatchScreen } from './BatchScreen';
import { DoughEditor, DoughsScreen } from './DoughsScreen';
import { HistoryScreen } from './HistoryScreen';
import { PlanScreen } from './PlanScreen';
import { SettingsScreen } from './SettingsScreen';

export type Route =
  | { name: 'plan' }
  | { name: 'history' }
  | { name: 'settings' }
  | { name: 'batch'; id: string }
  | { name: 'doughs' }
  | { name: 'dough'; id: string };

const same = (a?: Route, b?: Route) => !!a && !!b && JSON.stringify(a) === JSON.stringify(b);

export function App() {
  const [route, setRoute] = useState<Route>({ name: 'plan' });
  const [settings, setSettings] = useState<Settings | null>(null);
  // Screens visited, mirrored in the browser history so Android's back swipe steps back through them.
  const stack = useRef<Route[]>([{ name: 'plan' }]);
  const idx = useRef(0);

  // Read before the history reset below drops it from the address.
  const openBatch = useRef(new URLSearchParams(location.search).get('batch'));

  useEffect(() => {
    history.replaceState({ idx: 0 }, '', location.pathname);
    const onPop = (e: PopStateEvent) => {
      const i = typeof e.state?.idx === 'number' ? e.state.idx : 0;
      idx.current = i;
      setRoute(stack.current[i] ?? { name: 'plan' });
    };
    addEventListener('popstate', onPop);
    return () => removeEventListener('popstate', onPop);
  }, []);

  /** Open a screen. Going to the screen you just came from counts as going back. */
  const go = (r: Route) => {
    if (same(r, stack.current[idx.current])) return;
    if (same(r, stack.current[idx.current - 1])) {
      history.back();
      return;
    }
    idx.current += 1;
    stack.current = [...stack.current.slice(0, idx.current), r];
    history.pushState({ idx: idx.current }, '');
    setRoute(r);
  };

  // A tapped reminder opens its batch: ?batch=<id> on a cold start, or a message from the service worker.
  useEffect(() => {
    if (openBatch.current) go({ name: 'batch', id: openBatch.current });
    const onMsg = (e: MessageEvent) => {
      if (e.data?.type === 'open-batch' && typeof e.data.batchId === 'string') go({ name: 'batch', id: e.data.batchId });
    };
    navigator.serviceWorker?.addEventListener('message', onMsg);
    return () => navigator.serviceWorker?.removeEventListener('message', onMsg);
  }, []);

  useEffect(() => { window.scrollTo(0, 0); }, [route.name]);

  const reloadSettings = () => getSettings().then(setSettings);

  useEffect(() => {
    reloadSettings().then(async () => {
      const s = await getSettings();
      if (s.persisted === undefined) {
        await requestPersistence();
        await reloadSettings();
      }
    });
  }, []);

  if (!settings) return <p className="pad">Loading…</p>;

  return (
    <div className="app">
      <main>
        {route.name === 'plan' && <PlanScreen settings={settings} go={go} onSaved={reloadSettings} />}
        {route.name === 'history' && <HistoryScreen settings={settings} go={go} />}
        {route.name === 'settings' && <SettingsScreen settings={settings} onChange={reloadSettings} go={go} />}
        {route.name === 'doughs' && <DoughsScreen go={go} onChange={reloadSettings} />}
        {route.name === 'dough' && <DoughEditor key={route.id} id={route.id} go={go} onChange={reloadSettings} />}
        {route.name === 'batch' && (
          <BatchScreen id={route.id} settings={settings} go={go} onSaved={reloadSettings} />
        )}
      </main>
      <nav className="tabs" aria-label="Main navigation">
        <button aria-current={route.name === 'plan' ? 'page' : undefined} className={route.name === 'plan' ? 'on' : ''} onClick={() => go({ name: 'plan' })}>
          Plan
        </button>
        <button
          aria-current={route.name === 'history' || route.name === 'batch' ? 'page' : undefined}
          className={route.name === 'history' || route.name === 'batch' ? 'on' : ''}
          onClick={() => go({ name: 'history' })}
        >
          Bakes
        </button>
        <button
          aria-current={['settings', 'doughs', 'dough'].includes(route.name) ? 'page' : undefined}
          className={['settings', 'doughs', 'dough'].includes(route.name) ? 'on' : ''}
          onClick={() => go({ name: 'settings' })}
        >
          Settings
        </button>
      </nav>
    </div>
  );
}
