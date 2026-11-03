// Guards the dough math and storage against accidental edits during a UI restyle.
// `check`  fails if any protected file differs from protected.lock.json.
// `update` rewrites the lock after an intentional engine/data change (Claude does this, with tests passing).
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const PROTECTED = ['src/engine', 'src/data', 'src/api.ts'];
const LOCK = 'protected.lock.json';

function files(p) {
  if (statSync(p).isFile()) return [p];
  return readdirSync(p).flatMap((f) => files(join(p, f)));
}

function hashes() {
  const out = {};
  for (const f of PROTECTED.flatMap(files).sort()) {
    // Normalize line endings so Windows and Linux checkouts hash the same.
    const text = readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
    out[f.replace(/\\/g, '/')] = createHash('sha256').update(text).digest('hex');
  }
  return out;
}

const mode = process.argv[2];
if (mode === 'update') {
  writeFileSync(LOCK, JSON.stringify(hashes(), null, 2) + '\n');
  console.log(`Updated ${LOCK}`);
} else {
  const want = JSON.parse(readFileSync(LOCK, 'utf8'));
  const have = hashes();
  const changed = [...new Set([...Object.keys(want), ...Object.keys(have)])].filter((f) => want[f] !== have[f]);
  if (changed.length) {
    console.error('Protected files changed (engine, data or api). A UI pass must not touch these:');
    for (const f of changed) console.error(`  ${f}`);
    process.exit(1);
  }
  console.log('Protected files unchanged.');
}
