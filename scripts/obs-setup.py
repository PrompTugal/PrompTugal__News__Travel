#!/usr/bin/env python3
"""Make travel.promptugal.news's own observability lane (travel.b@PrompTugal.dinis, 18 November 2026).

Dinis, 18 Nov 2026, ~14:55 UTC (PrompTugal__News__Website board/guidance/2026-11-18-keys-issues-rebuilds-observability.md):
"Observability ... you can create a token, it's fine ... Just make sure you share with you": each site lead makes its own
lane and append tokens on account B, keeps them out of the repository and every log, and shares the drain credentials
with conductor.b@ sealed to conductor.b@'s key (conductor.b-promptugal). Adapted from the main site's
newsroom/tools/obs/obs_setup.py (Apache-2.0).

    SG_SEND_ACCESS_TOKEN=... SG_SEND_PASSPHRASE=... python3 -I scripts/obs-setup.py

1. A private data vault (travel-obs-data) on dev.send.sgraph.ai: a README, the drain key (an RSA-4096 pair made here;
   only its public half leaves the vault), identity/lanes.json; then four append lanes ('site') configured on it.
2. The public half for this site: src/assets/obs/obs.json (the endpoint, the vault id, the four append tokens and the
   drain's public key; public on purpose: a token can only append to its lane, the key can only encrypt).
3. The credentials (the vault key, the enum key, the tokens) in ~/.sg-send/obs-travel/creds.json (0600), outside the
   repository, and sealed to conductor.b-promptugal with `sgit pki encrypt` into ~/.sg-send/obs-travel/creds.conductor.enc,
   which travel.b@ sends to conductor.b@ (ciphertext only).
Run once. Prints no credential.
"""
import datetime, hashlib, json, os, secrets, subprocess, sys, urllib.request

sys.dont_write_bytecode = True
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HOST = 'https://dev.send.sgraph.ai'
AGENT = 'travel.b@PrompTugal.dinis'
CONDUCTOR = 'sha256:05e955d1ea81f4d9'      # conductor.b-promptugal, from PrompTugal__News__Website board/keys.json
MINE = 'sha256:609d2f8354bd6aeb'           # travel.b-promptugal (team/keys.json), signs the sealed file
DIR = os.path.expanduser('~/.sg-send/obs-travel')
CREDS = os.path.join(DIR, 'creds.json')
VAULTS = os.path.expanduser('~/vaults')
h = lambda s: hashlib.sha256(s.encode()).hexdigest()

def post(url, body, headers):
    req = urllib.request.Request(url, data=json.dumps(body).encode(), method='POST', headers={'Content-Type': 'application/json', **headers})
    with urllib.request.urlopen(req, timeout=60) as r: return json.loads(r.read() or b'{}')

def sgit(cwd, *a):
    r = subprocess.run(['sgit', *a], cwd=cwd, capture_output=True, text=True)
    if r.returncode: sys.exit(f'obs-setup: sgit {a[0]} failed (exit {r.returncode}): ' + (r.stderr or r.stdout).strip().splitlines()[-1][:200])
    return r.stdout

def wjson(p, obj, mode=None):
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, 'w') as f: f.write(json.dumps(obj, indent=2, ensure_ascii=False) + '\n')
    if mode: os.chmod(p, mode)

def main():
    if os.path.exists(CREDS): sys.exit(f'obs-setup: {CREDS} exists; the lane is made already')
    token = os.environ['SG_SEND_ACCESS_TOKEN']
    from sgit_ai.crypto.PKI__Crypto import PKI__Crypto
    from sgit_ai.crypto.Vault__Crypto import Vault__Crypto
    pki, today = PKI__Crypto(), datetime.datetime.now(datetime.timezone.utc).strftime('%-d %B %Y')
    os.makedirs(DIR, exist_ok=True); os.chmod(DIR, 0o700)

    # 1. the private data vault, with the drain key inside it
    os.makedirs(VAULTS, exist_ok=True)
    data = os.path.join(VAULTS, 'travel-obs-data')
    if os.path.exists(data): sys.exit(f'obs-setup: {data} exists; this runs once')
    sgit(VAULTS, 'create', 'travel-obs-data', '--base-url', HOST, '--token', token, '--no-push')
    open(os.path.join(data, 'README.md'), 'w').write(
        f'# travel.promptugal.news observability: the data vault (private)\n\nMade by {AGENT} on {today}, at Dinis Cruz\'s word, '
        'with scripts/obs-setup.py in PrompTugal/PrompTugal__News__Travel. Page views and reads from travel.promptugal.news '
        '(src/assets/obs/obs.js, lane "travel") arrive sealed to the drain key (identity/) on this vault\'s append lanes. '
        'conductor.b@PrompTugal.dinis drains it. Private: its key would give out the lanes\' enum key and the drain key.\n')
    priv, pub = pki.generate_encryption_key_pair()
    pub_pem, priv_pem = pki.export_public_key_pem(pub), pki.export_private_key_pem(priv)
    fp = pki.compute_fingerprint(pub)
    os.makedirs(os.path.join(data, 'identity', 'private'), exist_ok=True)
    open(os.path.join(data, 'identity', 'private', 'private_key.pem'), 'w').write(priv_pem)
    wjson(os.path.join(data, 'identity', 'public-bundle.json'), {'encrypt': pub_pem, 'fingerprint': fp, 'label': 'travel.promptugal.news observability drain'})
    names = ['site 1', 'site 2', 'site 3', 'site 4']
    toks = [secrets.token_hex(32) for _ in names]
    wjson(os.path.join(data, 'identity', 'lanes.json'), {'about': 'The append lanes, in order, by the SHA-256 of each token (the anchor the server holds).',
                                                         'lanes': [{'name': n, 'anchor': h(t)} for n, t in zip(names, toks)]})
    sgit(data, 'commit', 'the data vault: README, the drain key, the lanes'); sgit(data, 'push')
    data_vk = open(os.path.join(data, '.sg_vault', 'local', 'vault_key')).read().strip()
    data_id = data_vk.split(':')[-1]
    enum_key = secrets.token_hex(32)
    write_key = Vault__Crypto().derive_keys_from_vault_key(data_vk)['write_key']
    r = post(f'{HOST}/api/vault/append/configure/{data_id}', {'append_anchors': [h(t) for t in toks], 'enum_key_hash': h(enum_key)},
             {'x-sgraph-vault-write-key': write_key, 'x-sgraph-access-token': token})
    if r.get('status') != 'configured': sys.exit(f'obs-setup: configure answered {r.get("status")}')

    # 2. the public half, for this site
    wjson(os.path.join(ROOT, 'src', 'assets', 'obs', 'obs.json'), {
        'about': f'travel.promptugal.news\'s observability lane "travel" ({AGENT}, {today}, at Dinis Cruz\'s word). Public on purpose: each append token can only write to its lane, and the key can only encrypt. Used by assets/obs/obs.js on every page. The data vault is private; conductor.b@PrompTugal.dinis drains it.',
        'enabled': True, 'lane': 'travel', 'endpoint': HOST, 'vault_id': data_id,
        'lanes': {'site': toks},
        'recipient': {'fingerprint': fp, 'encrypt': pub_pem},
        'geo': ['https://ipapi.co/json/', 'https://ipwho.is/']})

    # 3. the credentials: outside the repository, and sealed to conductor.b@
    creds = {'type': 'promptugal.obs/creds', 'site': 'travel.promptugal.news', 'lane': 'travel', 'host': HOST, 'vault_id': data_id,
             'vault_key': data_vk, 'enum_key': enum_key, 'tokens': toks, 'lane_names': names, 'drain_key_fingerprint': fp,
             'drain_key_in_vault': 'identity/private/private_key.pem', 'made': today, 'by': AGENT}
    wjson(CREDS, creds, 0o600)
    out = os.path.join(DIR, 'creds.conductor.enc')
    r = subprocess.run(['sgit', 'pki', 'encrypt', CREDS, '--recipient', CONDUCTOR, '--fingerprint', MINE, '--output', out], capture_output=True, text=True)
    if r.returncode: sys.exit('obs-setup: sealing to conductor.b@ failed: ' + (r.stderr or r.stdout).strip().splitlines()[-1][:200])
    os.chmod(out, 0o600)
    print(f'obs-setup: data vault {data_id} (private, 4 lanes configured); drain key {fp}; src/assets/obs/obs.json written; '
          f'credentials in {CREDS.replace(os.path.expanduser("~"), "~")} and sealed to conductor.b@ in {out.replace(os.path.expanduser("~"), "~")}')

if __name__ == '__main__': main()
