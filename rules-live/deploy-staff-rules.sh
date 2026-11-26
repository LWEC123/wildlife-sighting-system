#!/bin/bash
# Adds the Staff resources part to the Firestore and Storage rules that are LIVE right now,
# publishes them, and marks the college's own staff login (limpopowt@gmail.com) as an
# assessor so it can see the confidential files. Everything already live is kept exactly
# as it is. Safe to run twice: a part that is already live is left alone.
set -e
cd "$(dirname "$0")/.."
P=lwec-field-logbook
ASSESSOR_EMAIL="limpopowt@gmail.com"
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
sfs = open('rules-live/staff-firestore.part').read()
sst = open('rules-live/staff-storage.part').read()
if 'match /staffdocs/' in fs:
    print('Firestore: Staff resources part already live, keeping it as it is.')
else:
    if 'function isCourseStaff()' not in fs:
        sys.exit('STOPPED: the live Firestore rules have no isCourseStaff(). Nothing was changed.')
    body = fs.rstrip()
    if not body.endswith('}') or body.count('match /databases/{database}/documents') != 1:
        sys.exit('STOPPED: the live Firestore rules do not look as expected. Nothing was changed.')
    i = body[:-1].rstrip()
    assert i.endswith('}'); i = i[:-1].rstrip()
    fs = i + '\n\n' + sfs + '  }\n}\n'
    print('Firestore: adding the Staff resources part (staffdocs, staffviews).')
if 'match /staff/{cid}' in st:
    print('Storage: Staff resources part already live, keeping it as it is.')
else:
    k = '    match /{all=**} {'
    if st.count(k) != 1 or 'function signedIn()' not in st:
        sys.exit('STOPPED: the live Storage rules do not look as expected. Nothing was changed.')
    st = st.replace(k, sst + '\n' + k)
    print('Storage: adding the Staff resources part (staff/ folder).')
open('.rules-out/firestore.rules', 'w').write(fs)
open('.rules-out/storage.rules', 'w').write(st)
PY
echo "--- What changes in Firestore:"; diff .rules-out/live-firestore.rules .rules-out/firestore.rules | grep '^[<>]' | head -60 || true
echo "--- What changes in Storage:";   diff .rules-out/live-storage.rules .rules-out/storage.rules | grep '^[<>]' | head -40 || true
firebase deploy --config firebase.rules.json --project $P --only firestore:rules,storage
# Give the college's staff login the assessor role (only adds the 'role' field).
SUID=$(curl -s -X POST -H "Authorization: Bearer $T" -H "Content-Type: application/json" -H "x-goog-user-project: $P" \
  "https://identitytoolkit.googleapis.com/v1/projects/$P/accounts:lookup" -d "{\"email\":[\"$ASSESSOR_EMAIL\"]}" \
  | python3 -c 'import sys,json;u=json.load(sys.stdin).get("users",[]);print(u[0]["localId"] if u else "")')
if [ -z "$SUID" ]; then echo "Could not find the login $ASSESSOR_EMAIL - role not set."; else
  curl -s -o /dev/null -w "Role set for $ASSESSOR_EMAIL: HTTP %{http_code}\n" -X PATCH -H "Authorization: Bearer $T" -H "Content-Type: application/json" \
    "https://firestore.googleapis.com/v1/projects/$P/databases/(default)/documents/mentors/$SUID?updateMask.fieldPaths=role&currentDocument.exists=true" \
    -d '{"fields":{"role":{"stringValue":"assessor"}}}'
fi
echo "STAFF RULES DONE"
