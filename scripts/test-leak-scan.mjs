// Tests for scripts/leak-scan.mjs's key rules (security@'s ruling of 19 Nov 2026: each rule has a test).
// travel.b@PrompTugal.dinis. Node 18+, no dependencies. Every key-shaped string here is built from parts at run time,
// so this file does not match the scan's own patterns. Each case checks the reason it fails, not only that it fails.
import { scanText } from './leak-scan.mjs';

const D = '-'.repeat(5);
const block = kind => `${D}BEGIN ${kind}${D}\n${'AB'.repeat(32)}\n${D}END ${kind}${D}`;   // low-entropy filler body
const sshPub = (type) => `${type} AAAA` + 'abcd'.repeat(12);   // the key-line shape with low-entropy filler
let fails = 0;
const expect = (name, path, text, kind) => {
  const kinds = scanText(path, text).map(f => f.kind);
  const ok = kind ? kinds.includes(kind) : kinds.length === 0;
  if (!ok) { fails++; console.error(`FAIL ${name}: expected ${kind || 'nothing'}, got ${JSON.stringify(kinds)}`); }
};

// 1. Every private key header fails, everywhere, with no exemption (team/keys.json included).
for (const k of ['OPENSSH PRIVATE KEY', 'RSA PRIVATE KEY', 'EC PRIVATE KEY', 'DSA PRIVATE KEY', 'ENCRYPTED PRIVATE KEY', 'PRIVATE KEY'])
  for (const path of ['notes.md', 'team/keys.json', 'src/assets/obs/obs.json'])
    expect(`${k} in ${path}`, path, block(k), 'private key block');

// 2. An OpenSSH public key line outside the published keys file is flagged. (Its exemption inside team/keys.json's
// ssh_signing.public_key field is not built yet: it waits on the signed-commits work and an approval.)
for (const t of ['ssh-ed25519', 'ssh-rsa', 'ecdsa-sha2-nistp256'])
  expect(`${t} public key in a note`, 'board/team/travel/status.json', `{"k": "${sshPub(t)}"}`, 'ssh public key outside team/keys');

// 3. A PEM public key block outside team/keys is flagged.
expect('PEM public key outside team/keys', 'docs/x.md', block('PUBLIC KEY'), 'public key outside team/keys');

// 4. Plain prose naming the key types does not fail.
expect('prose naming key types', 'docs/x.md', 'Commits are signed with ssh-ed25519 keys; see team/keys.json.', null);

if (fails) { console.error(`test-leak-scan: ${fails} failed`); process.exit(1); }
console.log('test-leak-scan: OK');
