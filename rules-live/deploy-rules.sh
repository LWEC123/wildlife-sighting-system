#!/bin/bash
# Publishes the Firestore and Storage rules with the AI pre-marking part added, but ONLY if the
# rules live right now are exactly the ones we expect (rules-live/base-*.rules). Otherwise it
# stops and shows the difference, so nothing newer is overwritten.
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
get cloud.firestore > /tmp/live-firestore.rules
get "firebase.storage/$P.firebasestorage.app" > /tmp/live-storage.rules
ok=1
if ! diff -wB /tmp/live-firestore.rules rules-live/base-firestore.rules > /tmp/fs.diff; then ok=0; echo "FIRESTORE rules live now differ from what we expected:"; head -40 /tmp/fs.diff; fi
if ! diff -wB /tmp/live-storage.rules rules-live/base-storage.rules > /tmp/st.diff; then ok=0; echo "STORAGE rules live now differ from what we expected:"; head -40 /tmp/st.diff; fi
if [ $ok = 0 ]; then echo; echo "STOPPED: nothing was changed. Send Claude a screenshot of this."; exit 1; fi
echo "Live rules are as expected. Publishing the rules with AI pre-marking added…"
firebase deploy --config firebase.rules.json --project $P --only firestore:rules,storage
echo "RULES DONE"
