// ACC-015: every non-merge commit a push adds to dev must carry a readable Agent: trailer,
// read the way git reads it: git log --format=%(trailers:key=Agent,valueonly).
// Usage: node scripts/check-commits.mjs <before> <after>   (the pushed range, before..after)
// A commit is skipped only if it is an ancestor of TRUSTED_BASE below (control 8: ancestry alone decides; never
// a date, file, path, message or name). History is not rewritten (ACC-015). A commit with no parent in the range
// fails (control 6). Prints OK or lists each commit that fails and exits 1.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

// dev's head when this rule was written (19 Nov 2026). Moving it forward is a person's decision, made in a commit.
const TRUSTED_BASE = '75dc63dfa3aa2dc52519246067c823721902f518';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const tryGit = (...args) => { try { return git(...args); } catch { return null; } };
const lines = (s) => (s ? s.split('\n').filter(Boolean) : []);
const isAncestor = (c, of) => { try { execFileSync('git', ['merge-base', '--is-ancestor', c, of], { stdio: 'ignore' }); return true; } catch { return false; } };

const [beforeArg, afterArg] = process.argv.slice(2);
const after = afterArg || 'HEAD';
if (!tryGit('rev-parse', '--verify', '--quiet', `${after}^{commit}`)) { console.error(`check-commits: unknown commit ${after}`); process.exit(1); }
if (!tryGit('rev-parse', '--verify', '--quiet', `${TRUSTED_BASE}^{commit}`)) { console.error(`check-commits: the trusted base ${TRUSTED_BASE} is not in this clone (a shallow clone?)`); process.exit(1); }

// A new branch, a forced push or a manual run has no usable "before": check everything not in the base.
const zero = /^0+$/;
const before = beforeArg && !zero.test(beforeArg) && tryGit('rev-parse', '--verify', '--quiet', `${beforeArg}^{commit}`);
const range = before ? [`${before}..${after}`] : [after];
const all = lines(git('rev-list', ...range));          // merges included
const added = lines(git('rev-list', '--no-merges', ...range));

// A role may be dotted, role.speciality (Dinis, 16 Nov 2026: "we definitely should allow dots because that's our terminology").
const agentShape = /^[a-z0-9]+(?:[.-][a-z0-9]+)*@agenticcells\.[a-z0-9][a-z0-9.-]*$/i;
// Exemptions (specialist.code@, 2026-11-16). CI checks from the last release tag, so one failing commit
// would block every later release, and history is never rewritten. A person may exempt that one commit in
// scripts/commit-exemptions.json: [{ "commit": "<full 40-hex sha>", "reason": "...", "approved_by": "Dinis Cruz",
// "date": "YYYY-MM-DD" }]. Each entry names exactly one commit; malformed entries fail the check.
const exempt = new Map();
const EX = 'scripts/commit-exemptions.json';
if (existsSync(EX)) {
  let list;
  try { list = JSON.parse(readFileSync(EX, 'utf8')); } catch (e) { console.error(`${EX}: not JSON (${e.message})`); process.exit(1); }
  if (!Array.isArray(list)) { console.error(`${EX}: must be a list`); process.exit(1); }
  for (const x of list) {
    if (!x || !/^[0-9a-f]{40}$/.test(x.commit || '') || !(x.reason || '').trim() || !(x.approved_by || '').trim() || !/^\d{4}-\d{2}-\d{2}$/.test(x.date || '')) {
      console.error(`${EX}: each entry needs a full 40-hex commit, a reason, approved_by and a date`); process.exit(1);
    }
    exempt.set(x.commit, x);
  }
}
const errors = [];
let checked = 0, exempted = 0, skipped = 0;
// Control 6: a commit with no parent is a new history. It is never skipped except as an ancestor of the base
// (the repository's own first commit), and no exemption covers it.
for (const c of all) {
  if (isAncestor(c, TRUSTED_BASE)) continue;
  if (git('rev-list', '--parents', '-n', '1', c).split(' ').length === 1) errors.push(`${c.slice(0, 7)} ${git('log', '-1', '--format=%s', c)}: a commit with no parent (an orphan history)`);
}
for (const c of added) {
  if (isAncestor(c, TRUSTED_BASE)) { skipped++; continue; }
  if (exempt.has(c)) { exempted++; continue; }
  checked++;
  const agents = lines(git('log', '-1', '--format=%(trailers:key=Agent,valueonly)', c)).map((s) => s.trim());
  const subject = git('log', '-1', '--format=%s', c);
  if (!agents.length) errors.push(`${c.slice(0, 7)} ${subject}: no readable Agent: trailer (it must sit in the final trailer block)`);
  else if (!agents.every((a) => agentShape.test(a))) errors.push(`${c.slice(0, 7)} ${subject}: Agent: trailer is not role@agenticcells.person (${agents.join(', ')})`);
}

if (errors.length) {
  console.error(errors.join('\n'));
  console.error(`FAILED (${errors.length} of ${checked} commits checked)`);
  process.exit(1);
}
console.log(`OK (${checked} commits checked, ${exempted} exempted, ${skipped} in the trusted base skipped)`);
