#!/bin/bash
# Adds the AI pre-marking part to the Firestore and Storage rules that are LIVE right now,
# and publishes them. Everything already live is kept exactly as it is. Safe to run twice:
# if the AI part is already there, that file is left alone.
set -e
cd "$(dirname "$0")/.."
P=lwec-field-logbook
T=$(gcloud auth print-access-token)
get() {
  local rel
  rel=$(curl -s -H "Authorization: Bearer $T" "https://firebaserules.googleapis.com/v1/projects/$P/releases/$1" \
    | python3 -c 'import sys,json;print(json.load(sys.stdin)["rulesetName"])')
  curl -s -H "Authorization: Bearer $T" "https://firebaserules.googleapis.com/v1/$rel" \
    | python3 -c 'import sys,json;print(json.load(sys.stdin)["source"]["files"][0]["content"])'
}
mkdir -p .rules-out
get cloud.firestore > .rules-out/live-firestore.rules
get "firebase.storage/$P.firebasestorage.app" > .rules-out/live-storage.rules
python3 - <<'PY'
import sys
fs = open('.rules-out/live-firestore.rules').read()
st = open('.rules-out/live-storage.rules').read()
afs = open('rules-live/ai-firestore.part').read()
ast = open('rules-live/ai-storage.part').read()
if 'match /premarks/' in fs:
    print('Firestore: AI part already live, keeping it as it is.')
else:
    body = fs.rstrip()
    if not body.endswith('}') or body.count('match /databases/{database}/documents') != 1:
        sys.exit('STOPPED: the live Firestore rules do not look as expected. Nothing was changed.')
    i = body.rstrip()[:-1].rstrip()       # remove the last '}' (service)
    assert i.endswith('}'); i = i[:-1].rstrip()   # remove the '}' of match /databases
    fs = i + '\n\n' + afs + '  }\n}\n'
    print('Firestore: adding the AI part (premarks, memos, aiconsent).')
if 'match /memos/' in st:
    print('Storage: AI part already live, keeping it as it is.')
else:
    k = '    match /{all=**} {'
    if st.count(k) != 1:
        sys.exit('STOPPED: the live Storage rules do not look as expected. Nothing was changed.')
    st = st.replace(k, ast + k)
    print('Storage: adding the AI part (locked memos folder).')
open('.rules-out/firestore.rules', 'w').write(fs)
open('.rules-out/storage.rules', 'w').write(st)
PY
echo "--- What changes in Firestore:"; diff .rules-out/live-firestore.rules .rules-out/firestore.rules | grep '^[<>]' | head -40 || true
echo "--- What changes in Storage:";   diff .rules-out/live-storage.rules .rules-out/storage.rules | grep '^[<>]' | head -20 || true
firebase deploy --config firebase.rules.json --project $P --only firestore:rules,storage
echo "RULES DONE"
