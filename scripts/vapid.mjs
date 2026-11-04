// Makes the key pair for phone reminders (VAPID).
// - The PUBLIC key is written to src/data/vapid.ts (safe to commit; phones need it).
// - The PRIVATE key is printed here only. Paste it into Cloudflare as the secret VAPID_PRIVATE_KEY.
//   It is never written to a file and must never go in git.
// Running it again makes a new pair; phones then need reminders turned off and on once.
import { generateKeyPairSync } from 'node:crypto';
import { writeFileSync } from 'node:fs';

const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const jwk = privateKey.export({ format: 'jwk' });
const b64u = (s) => Buffer.from(s, 'base64url');
const publicKey = Buffer.concat([Buffer.from([4]), b64u(jwk.x), b64u(jwk.y)]).toString('base64url');

writeFileSync(
  'src/data/vapid.ts',
  `// Public half of the VAPID key pair (safe to commit). Written by \`npm run vapid\`.\nexport const VAPID_PUBLIC_KEY = '${publicKey}';\n`,
);

console.log('Public key written to src/data/vapid.ts.\n');
console.log('Copy the whole line below into Cloudflare as the secret VAPID_PRIVATE_KEY:\n');
console.log(JSON.stringify({ kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y, d: jwk.d }));
console.log('\nThen close this window. Do not paste it anywhere else.');
