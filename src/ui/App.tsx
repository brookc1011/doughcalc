import { useEffect, useState } from 'react';
import { getSettings, requestPersistence, type Settings } from '../api';
import { BatchScreen } from './BatchScreen';
import { HistoryScreen } from './HistoryScreen';
import { PlanScreen } from './PlanScreen';
import { SettingsScreen } from './SettingsScreen';

export type Route = { name: 'plan' } | { name: 'history' } | { name: 'settings' } | { name: 'batch'; id: string };

export function App() {
  const [route, setRoute] = useState<Route>({ name: 'plan' });
  const [settings, setSettings] = useState<Settings | null>(null);

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
        {route.name === 'plan' && <PlanScreen settings={settings} go={setRoute} onSaved={reloadSettings} />}
        {route.name === 'history' && <HistoryScreen settings={settings} go={setRoute} />}
        {route.name === 'settings' && <SettingsScreen settings={settings} onChange={reloadSettings} />}
        {route.name === 'batch' && (
          <BatchScreen id={route.id} settings={settings} go={setRoute} onSaved={reloadSettings} />
        )}
      </main>
      <nav className="tabs">
        <button className={route.name === 'plan' ? 'on' : ''} onClick={() => setRoute({ name: 'plan' })}>
          Plan
        </button>
        <button
          className={route.name === 'history' || route.name === 'batch' ? 'on' : ''}
          onClick={() => setRoute({ name: 'history' })}
        >
          Bakes
        </button>
        <button className={route.name === 'settings' ? 'on' : ''} onClick={() => setRoute({ name: 'settings' })}>
          Settings
        </button>
      </nav>
    </div>
  );
}
