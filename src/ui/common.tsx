import { useEffect, useState, type InputHTMLAttributes } from 'react';
import {
  fmtGrams,
  fmtPct,
  fmtTempRange,
  fmtWhen,
  stepCalendarLink,
  type Plan,
} from '../api';

type NumFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & {
  value: number;
  onValue: (n: number) => void;
};

/**
 * Number box that behaves on a phone: clearing it leaves it empty instead of showing 0,
 * no leading zeros ("02"), and tapping it selects the number so you can type over it.
 * The last valid number is kept while the box is blank and restored if you leave it blank.
 */
export function NumField({ value, onValue, onFocus, onBlur, ...rest }: NumFieldProps) {
  const [text, setText] = useState(String(value));

  useEffect(() => {
    if (text === '' || Number(text) !== value) setText(String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <input
      {...rest}
      // Plain text with the number keypad: a type="number" box rewrites partial entries like "70." while typing.
      type="text"
      inputMode="decimal"
      value={text}
      onFocus={(e) => {
        e.currentTarget.select();
        onFocus?.(e);
      }}
      onChange={(e) => {
        // Commas from some keypads count as decimal points; drop anything else that isn't part of a number.
        const raw = e.target.value.replace(',', '.').replace(/[^\d.-]/g, '').replace(/^0+(?=\d)/, '');
        setText(raw);
        if (raw !== '' && !Number.isNaN(Number(raw))) onValue(Number(raw));
      }}
      onBlur={(e) => {
        if (text === '' || Number.isNaN(Number(text))) setText(String(value));
        onBlur?.(e);
      }}
    />
  );
}

type Recipe = Plan['recipe'];
type Yeast = Plan['yeast'];
type Water = Plan['water'];
type StepLike = { key: string; label: string; at: Date | string; detail: string };

export function RecipeView({ recipe, yeast, water, unit }: { recipe: Recipe; yeast: Yeast; water: Water; unit: 'F' | 'C' }) {
  return (
    <section className="card recipe-card">
      <p className="eyebrow">Ready for the scales</p><h2>Recipe</h2>
      {recipe.parts.map((part) => (
        <div key={part.title}>
          {recipe.parts.length > 1 && <h3>{part.title}</h3>}
          <table className="ingredients">
            <tbody>
              {part.ingredients.map((i) => (
                <tr key={i.key}>
                  <td>{i.name}</td>
                  <td className="num">{fmtGrams(i.grams)}</td>
                  <td className="muted">{i.tsp ?? fmtPct(i.pct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
      <p className="muted small">
        Makes {fmtGrams(recipe.grossDoughG)} of dough. Yeast: {yeast.basis === 'estimate' ? 'estimate. ' : ''}
        {yeast.note}
      </p>
      {yeast.warning && <p className="warn">{yeast.warning}</p>}
      <h3 className="water-heading">Water temperature</h3>
      {water.map((w) => (
        <p className="water-value" key={w.label}>
          <b>{w.label}:</b> {fmtTempRange(w.lowF, w.highF, unit)}{' '}
          <span className="muted small">{w.basis === 'calculated' ? w.note : ''}</span>
          {w.warning && <span className="warn"> {w.warning}</span>}
        </p>
      ))}
    </section>
  );
}

export function Timeline({ steps, title, onIcs }: { steps: StepLike[]; title: string; onIcs: () => void }) {
  return (
    <section className="card">
      <div className="row between">
        <h2>Timeline</h2>
        <button className="small" onClick={onIcs}>
          Add all to calendar
        </button>
      </div>
      <ol className="timeline">
        {steps.map((s) => (
          <li key={s.key + String(s.at)}>
            <div className="row between">
              <b>{s.label}</b>
              <a className="small" href={stepCalendarLink(s as never, title)} target="_blank" rel="noreferrer">
                + Google
              </a>
            </div>
            <div className="step-time">{fmtWhen(s.at)}</div>
            <div className="muted small">{s.detail}</div>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function download(filename: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Share a file through the phone's share sheet (e.g. to Google Drive); falls back to a download. */
export async function shareOrDownload(filename: string, text: string, type: string) {
  const file = new File([text], filename, { type });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return;
    } catch {
      // cancelled or failed: fall through to download
    }
  }
  download(filename, text, type);
}

export function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const fToC = (f: number) => ((f - 32) * 5) / 9;
export const cToF = (c: number) => (c * 9) / 5 + 32;

export function Chips<T extends string>({
  value,
  options,
  onChange,
}: {
  value?: T;
  options: { v: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="chips">
      {options.map((o) => (
        <button aria-pressed={value === o.v} key={o.v} className={value === o.v ? 'chip on' : 'chip'} onClick={() => onChange(o.v)} type="button">
          {o.label}
        </button>
      ))}
    </div>
  );
}
