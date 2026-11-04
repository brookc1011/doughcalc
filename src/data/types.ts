import type { Survey } from '../engine/advice';
import type { Recipe } from '../engine/formula';
import type { WaterTemp } from '../engine/temperature';
import type { BallGroup, Formula, YeastResult } from '../engine/types';

export const SCHEMA_VERSION = 1;

export interface Oven {
  id: string;
  name: string;
}

export interface Settings {
  id: 'settings';
  unit: 'F' | 'C';
  roomF: number;
  warmUpH: number;
  bandLowF: number;
  bandHighF: number;
  mixer: 'hand' | 'mixer';
  frictionHandF: number;
  frictionMixerF: number;
  /** Baker-set yeast multiplier. 1 = as calculated. Never changed by the app. */
  kitchenFactor: number;
  lastDoughId: string;
  lastBalls: BallGroup[];
  ovens: Oven[];
  lastOvenId: string;
  /** Doughs removed from the picker. Book doughs are only hidden, so they can be restored. */
  hiddenDoughIds: string[];
  lastBackupAt?: string;
  bakesSinceBackup: number;
  persisted?: boolean;
  /** Random id naming this phone's reminder slot on the server. Created on first "Remind me". */
  pushDeviceId?: string;
}

export interface StepRecord {
  key: string;
  label: string;
  at: string; // ISO
  detail: string;
}

/** What was planned when the batch was locked in. Never edited afterwards. */
export interface PlannedSnapshot {
  formula: Formula;
  balls: BallGroup[];
  eatAt: string;
  roomF: number;
  stageH: number;
  warmUpH: number;
  mixer: 'hand' | 'mixer';
  yeast: YeastResult;
  recipe: Recipe;
  water: WaterTemp[];
  steps: StepRecord[];
}

/** What actually happened. Editable any time. */
export interface Actual {
  mixAt?: string;
  ballAt?: string;
  roomF?: number;
  finalDoughF?: number;
  notes?: string;
  /** Steps checked off on the batch checklist: step key → ISO time. Optional, so no migration. */
  done?: Record<string, string>;
  /** Whether phone reminders are on for this batch. */
  reminders?: boolean;
}

export interface BakeSession {
  id: string;
  at: string;
  ovenId: string;
  balls: number;
  survey: Survey;
  note?: string;
  photoId?: string;
}

export interface Batch {
  id: string;
  createdAt: string;
  title: string;
  planned: PlannedSnapshot;
  actual: Actual;
  sessions: BakeSession[];
  /** Suggestion carried into the next bake ("Try: ..."). */
  nextTry?: string;
}

export interface Photo {
  id: string;
  blob: Blob;
}

export interface ExportFile {
  app: 'dough-app';
  schema: number;
  exportedAt: string;
  settings: Settings;
  doughs: Formula[];
  batches: Batch[];
  photos: { id: string; dataUrl: string }[];
}
