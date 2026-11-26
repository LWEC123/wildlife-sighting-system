// One-off (run in Google Cloud Shell, signed in as the project owner):
//
//   cd functions && node test/rerun-skipped.js
//
// AI pre-marks every hand-in that was skipped under the old student opt-in ("no-consent"),
// so the assessor can confirm them on the Marking page. It reads the Claude key from
// Secret Manager; no student data is changed apart from the premarks/ suggestions.

const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');
const { execSync } = require('child_process');
const Anthropic = require('@anthropic-ai/sdk');
const sharp = require('sharp');
const { premark, callClaudeReal } = require('../premark');

const PROJECT = process.env.GCLOUD_PROJECT || 'lwec-field-logbook';
initializeApp({ projectId: PROJECT, storageBucket: PROJECT + '.firebasestorage.app' });
const db = getFirestore(), bucket = getStorage().bucket();

(async () => {
  const key = execSync('gcloud secrets versions access latest --secret=ANTHROPIC_API_KEY --project ' + PROJECT).toString().trim();
  const client = new Anthropic({ apiKey: key, timeout: 8 * 60 * 1000 });
  const deps = { db, bucket, sharp, now: () => FieldValue.serverTimestamp(), callClaude: (memo, work) => callClaudeReal(client, memo, work) };
  const snap = await db.collection('premarks').where('status', '==', 'no-consent').get();
  if (snap.empty) { console.log('Nothing was skipped. All done.'); process.exit(0); }
  console.log(snap.size + ' skipped hand-in(s). The AI marks them one by one (1 to 3 minutes each)…');
  for (const d of snap.docs) {
    const { cid, uid, mid } = d.data();
    const en = await db.doc('enrol/us335815_' + uid).get();
    const who = ((en.data() || {}).name || uid) + ', ' + cid.toUpperCase() + ' ' + mid.toUpperCase();
    try {
      const r = await premark(deps, cid, uid, mid, { force: true });
      const p = (await d.ref.get()).data() || {};
      const res = p.result || {};
      console.log('✔ ' + who + ': ' + r.status + (p.status === 'done' ? ' · ' + res.total + '/' + res.max_total + ' (' + res.percent + '%) → ' + res.recommendation : ' ' + (p.error || '')));
    } catch (e) { console.log('✘ ' + who + ': ' + e.message); }
  }
  console.log('Finished. Open the Marking page to confirm the results.');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
