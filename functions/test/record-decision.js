// Records the assessor's Not-yet-competent decision, feedback and reassessment date for a
// one-part resit, on the assessor's instruction (run in Google Cloud Shell as the project owner):
//
//   cd functions && node test/record-decision.js us335815 m01 2026-11-30 "Johann" "Reynhardt"          (preview only)
//   cd functions && node test/record-decision.js us335815 m01 2026-11-30 "Johann" "Reynhardt" --save   (writes it)
//
// It uses the AI pre-mark of the latest hand-in, works out both parts (multiple choice by the key,
// written by the AI), and only records students below the pass mark in exactly one part.

const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');
initializeApp({ projectId: process.env.GCLOUD_PROJECT || 'lwec-field-logbook' });
const db = getFirestore();
const { onlineParts } = require('../premark');

const ASSESSOR = { name: 'E.Z. Wessels', reg: '613/A/00337/2020', email: 'limpopowt@gmail.com' };
const args = process.argv.slice(2), save = args.includes('--save');
const [cid, mid, date, ...names] = args.filter(a => a !== '--save');
if (!/^[a-z0-9]+$/.test(cid || '') || !/^m\d\d[a-j]?$/.test(mid || '') || !/^\d{4}-\d\d-\d\d$/.test(date || '') || !names.length) {
  console.error('Usage: node test/record-decision.js <cid> <mid> <YYYY-MM-DD> "<name>" ... [--save]'); process.exit(1);
}
const longDate = new Date(date + 'T12:00:00Z').toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

(async () => {
  const users = await db.collection('users').where('email', '==', ASSESSOR.email).get();
  const byUid = users.empty ? '' : users.docs[0].id;
  const enrol = (await db.collection('enrol').get()).docs.map(d => d.data());
  for (const nm of names) {
    const e = enrol.find(x => String(x.name || '').toLowerCase().includes(nm.toLowerCase()) && x.uid);
    if (!e) { console.log('✘ ' + nm + ': no student with that name.'); continue; }
    const uid = e.uid, who = e.name;
    const pm = (((((await db.doc('progress/' + cid + '_' + uid).get()).data() || {}).mods) || {})[mid]) || {};
    const pre = (await db.doc('premarks/' + cid + '_' + uid + '_' + mid).get()).data() || {};
    if (!pm.testAtt || pre.status !== 'done') { console.log('✘ ' + who + ': no AI pre-marked online test to record.'); continue; }
    const res = (await db.doc('results/' + cid + '_' + uid).get()).data() || {};
    const cur = (res.marks || {})[mid];
    if (cur && cur.att === pm.testAtt && cur.outcome === 'C') { console.log('✘ ' + who + ': already marked Competent, left as it is.'); continue; }
    const x = await onlineParts(db, cid, uid, mid, pm.testAtt, pre.result);
    if (x.redo.length !== 1) { console.log('✘ ' + who + ': ' + (x.redo.length ? 'below the pass mark in both parts' : 'passed both parts') + ', so this is not a one-part resit. Mark it on the Marking page.'); continue; }
    const keepName = x.redo[0] === 'written' ? 'multiple-choice' : 'written', kp = x.redo[0] === 'written' ? x.mc : x.wr, rp = x.redo[0] === 'written' ? x.wr : x.mc;
    const good = 'Well done on the ' + keepName + ' part: ' + kp.s + '/' + kp.max + ' (' + kp.pct + '%). You keep that result and do not need to redo it.'
      + (pre.result.good ? '\n' + pre.result.good : '');
    const fix = 'To be competent you need ' + x.pass + '% in both parts. Your ' + x.redo[0] + ' answers scored ' + rp.s + '/' + rp.max + ' (' + rp.pct + '%). '
      + 'Please redo only the ' + x.redo[0] + ' questions in the portal by ' + longDate + '.'
      + (pre.result.fix ? '\nWhat to improve: ' + pre.result.fix : '');
    console.log('— ' + who + ' (' + cid.toUpperCase() + ' ' + mid.toUpperCase() + ', attempt ' + pm.testAtt + ')');
    console.log('  Result: Not yet competent · multiple choice ' + x.mc.s + '/' + x.mc.max + ' · written ' + x.wr.s + '/' + x.wr.max + ' · reassessment by ' + longDate);
    console.log('  Done well: ' + good.replace(/\n/g, '\n             '));
    console.log('  Needs correction: ' + fix.replace(/\n/g, '\n             '));
    if (!save) continue;
    const keep = x.redo[0] === 'written' ? { mc: x.mc } : { wr: x.wr };
    const a = (await db.doc('attempts/' + cid + '_' + uid + '_' + mid + '_' + pm.testAtt).get()).data() || {};
    const base = { outcome: 'NYC', good, fix, by: ASSESSOR.name, reg: ASSESSOR.reg, byUid, reassessBy: date, redo: x.redo, keep,
      recordedFor: 'Recorded by the portal assistant on the assessor\'s instruction (27 Nov 2026)' };
    const ai = { model: pre.model || '', at: pre.at || null, total: pre.result.total, max: pre.result.max_total, rec: pre.result.recommendation, changed: 0, agreed: true, oneClick: true };
    const mk = Object.assign({}, base, { at: FieldValue.serverTimestamp(), att: pm.testAtt, ver: a.ver || '', total: x.total, max: x.max, ai });
    const rec = Object.assign({}, base, { at: Timestamp.now(), submittedAt: pm.submittedAt || null, att: pm.testAtt, ver: a.ver || '', total: x.total, max: x.max,
      parts: { mc: x.mc, wr: x.wr, pass: x.pass }, ai, answers: '', link: '', paper: false });
    if (cur && cur.att === pm.testAtt && cur.outcome === 'NYC') {
      // Already marked Not yet competent on the Marking page: add the feedback, date and resit details to that decision.
      const up = {}; Object.keys(base).forEach(k => { up['marks.' + mid + '.' + k] = base[k]; });
      up['marks.' + mid + '.total'] = x.total; up['marks.' + mid + '.max'] = x.max;
      const h = ((res.hist || {})[mid] || []).map(r => r.att === pm.testAtt && r.outcome === 'NYC' ? Object.assign({}, r, base, { parts: { mc: x.mc, wr: x.wr, pass: x.pass } }) : r);
      if (h.length) up['hist.' + mid] = h;
      await db.doc('results/' + cid + '_' + uid).update(up);
      console.log('  ✔ Added to ' + who + '\'s existing Not yet competent decision.');
      continue;
    }
    const passed = { [mid]: false }; if (mid.length > 3) passed[mid.slice(0, 3)] = false;
    const fields = ['uid', 'cid', 'passed.' + mid, 'marks.' + mid, 'hist.' + mid].concat(mid.length > 3 ? ['passed.' + mid.slice(0, 3)] : []);
    await db.doc('results/' + cid + '_' + uid).set({ uid, cid, passed, marks: { [mid]: mk }, hist: { [mid]: FieldValue.arrayUnion(rec) } }, { mergeFields: fields });
    console.log('  ✔ Saved in ' + who + '\'s record and PoE.');
  }
  if (!save) console.log('\nPreview only. Nothing was saved. Add --save at the end to record it.');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
