// Read-only (run in Google Cloud Shell): the combined suggested result of every AI pre-marked test.
//
//   cd functions && node test/results.js            (all pre-marked tests)
//   cd functions && node test/results.js us335815 m01
//
// Online tests: multiple choice and true/false scored by the portal's key, written questions by
// the AI; the learner must reach the pass mark in EACH part. Answer sheets: the AI's own total. Nothing is changed.

const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
initializeApp({ projectId: process.env.GCLOUD_PROJECT || 'lwec-field-logbook' });
const db = getFirestore();
const { onlineParts } = require('../premark');
const [onlyCid, onlyMid] = process.argv.slice(2);

(async () => {
  const snap = await db.collection('premarks').where('status', '==', 'done').get();
  const rows = [];
  for (const d of snap.docs) {
    const p = d.data();
    if ((onlyCid && p.cid !== onlyCid) || (onlyMid && p.mid !== onlyMid) || p.uid === 'ai-live-check') continue;
    const [en, prog, res] = await Promise.all([db.doc('enrol/us335815_' + p.uid).get(), db.doc('progress/' + p.cid + '_' + p.uid).get(), db.doc('results/' + p.cid + '_' + p.uid).get()]);
    const name = (en.data() || {}).name || p.uid;
    const pm = (((prog.data() || {}).mods) || {})[p.mid] || {};
    const marked = ((((res.data() || {}).marks) || {})[p.mid] || {}).outcome;
    const r = p.result || {};
    let line;
    if (pm.testAtt) {
      const x = await onlineParts(db, p.cid, p.uid, p.mid, pm.testAtt, r);
      line = 'multiple choice ' + x.mc.s + '/' + x.mc.max + ' (' + x.mc.pct + '%), written ' + x.wr.s + '/' + x.wr.max + ' (' + x.wr.pct + '%), pass ' + x.pass + '% in each part → suggested '
        + x.outcome + (x.redo.length ? ': redo the ' + x.redo.join(' and ') + ' part' : '') + (r.recommendation === 'UNSURE' ? ' (AI unsure on the written part: check it)' : '');
    } else line = r.total + '/' + r.max_total + ' (' + r.percent + '%) → suggested ' + r.recommendation;
    rows.push(name + ', ' + p.cid.toUpperCase() + ' ' + p.mid.toUpperCase() + ': ' + line + (marked ? '  [already marked ' + marked + ']' : ''));
  }
  console.log(rows.length ? rows.sort().join('\n') : 'No AI pre-marked tests found.');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
