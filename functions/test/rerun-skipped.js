// One-off (run in Google Cloud Shell, signed in as the project owner):
//
//   cd functions && node test/rerun-skipped.js
//   cd functions && node test/rerun-skipped.js us335815 m01 Reynhardt    (re-run one student's test again)
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
const { premark, callClaudeReal, onlineParts } = require('../premark');

const PROJECT = process.env.GCLOUD_PROJECT || 'lwec-field-logbook';
initializeApp({ projectId: PROJECT, storageBucket: PROJECT + '.firebasestorage.app' });
const db = getFirestore(), bucket = getStorage().bucket();

(async () => {
  const key = execSync('gcloud secrets versions access latest --secret=ANTHROPIC_API_KEY --project ' + PROJECT).toString().trim();
  const client = new Anthropic({ apiKey: key, timeout: 8 * 60 * 1000 });
  const deps = { db, bucket, sharp, now: () => FieldValue.serverTimestamp(), callClaude: (memo, work) => callClaudeReal(client, memo, work) };
  const [cid1, mid1, who1] = process.argv.slice(2);
  let docs;
  if (who1) {
    const en = await db.collection('enrol').get();
    const uids = en.docs.map(d => d.data()).filter(e => String(e.name || '').toLowerCase().includes(who1.toLowerCase())).map(e => e.uid);
    docs = [];
    for (const u of [...new Set(uids)]) { const r = db.doc('premarks/' + cid1 + '_' + u + '_' + mid1); docs.push({ ref: r, data: () => ({ cid: cid1, uid: u, mid: mid1 }) }); }
  } else docs = (await db.collection('premarks').where('status', '==', 'no-consent').get()).docs;
  const snap = { size: docs.length, docs };
  if (!docs.length) { console.log(who1 ? 'No student found with that name.' : 'Nothing was skipped. All done.'); process.exit(0); }
  console.log(snap.size + ' hand-in(s). The AI marks them one by one (1 to 3 minutes each)…');
  for (const d of snap.docs) {
    const { cid, uid, mid } = d.data();
    const en = await db.doc('enrol/us335815_' + uid).get();
    const who = ((en.data() || {}).name || uid) + ', ' + cid.toUpperCase() + ' ' + mid.toUpperCase();
    try {
      const r = await premark(deps, cid, uid, mid, { force: true });
      const p = (await d.ref.get()).data() || {};
      const res = p.result || {};
      let line = r.status + (p.status === 'done' ? ' · AI ' + res.total + '/' + res.max_total + ' (' + res.percent + '%) → ' + res.recommendation : ' ' + (p.error || ''));
      const pm = (((((await db.doc('progress/' + cid + '_' + uid).get()).data() || {}).mods) || {})[mid]) || {};
      if (p.status === 'done' && pm.testAtt) {
        const x = await onlineParts(db, cid, uid, mid, pm.testAtt, res);
        line = 'multiple choice ' + x.mc.s + '/' + x.mc.max + ' (' + x.mc.pct + '%), written ' + x.wr.s + '/' + x.wr.max + ' (' + x.wr.pct + '%) → suggested ' + x.outcome + (x.redo.length ? ', redo the ' + x.redo.join(' and ') + ' part' : '') + (res.recommendation === 'UNSURE' ? ' (AI still unsure: check it)' : '');
      }
      if (p.usage && p.usage.searches) line += ' · checked ' + p.usage.searches + ' web source search(es)';
      console.log('✔ ' + who + ': ' + line);
      (res.questions || []).filter(q => /source|confirm|not in the memo/i.test(q.comment || '')).forEach(q => console.log('    Q' + q.n + ': ' + q.comment));
    } catch (e) { console.log('✘ ' + who + ': ' + e.message); }
  }
  console.log('Finished. Open the Marking page to confirm the results.');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
