// Reads seeded data through loadData() against the Firestore emulator:
// firebase emulators:exec --config firebase.test.json --project demo-lwec --only firestore "node functions/test/daily-emulator-check.js"
const assert = require('assert');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const { loadData, buildSummary } = require('../daily');
initializeApp({ projectId: 'demo-lwec' });
const db = getFirestore();
(async () => {
  const now = Date.now(), T = x => Timestamp.fromMillis(x);
  await db.doc('enrol/us335815_u1').set({ uid: 'u1', cid: 'us335815', name: 'Test Student', active: true });
  await db.doc('enrol/us335802_u1').set({ uid: 'u1', cid: 'us335802', name: 'Should be ignored', active: true });
  await db.doc('progress/us335815_u1').set({ lastSeen: T(now - 3600e3), totalSec: 900, mods: { m01: { submittedAt: T(now - 7200e3), draft: 'secret draft', form: { 1: 'answer' } } } });
  await db.doc('results/us335815_u1').set({ passed: {}, marks: {} });
  await db.doc('premarks/us335815_u1_m01').set({ status: 'done', forSub: now - 7200e3, result: { percent: 75, good: 'x', questions: [{ n: 1 }] } });
  await db.doc('evidence/e1').set({ uid: 'u1', us: 'US335815', name: 'photo.jpg', at: T(now - 60e3) });
  await db.collection('sessions').add({ uid: 'u1', start: T(now - 5000e3), last: T(now - 3600e3), sec: 1200 });
  await db.collection('sessions').add({ uid: 'u1', start: T(now - 40 * 86400e3), last: T(now - 40 * 86400e3), sec: 999 });
  await db.doc('courses/us335802').set({ code: 'US335802', nmods: 12, published: false });
  const d = await loadData(db, now);
  assert.strictEqual(d.enrol.length, 1);
  assert.strictEqual(d.sessions.length, 1);
  assert.ok(!JSON.stringify(d).includes('secret draft') && !JSON.stringify(d.premarks).includes('questions'));
  const s = buildSummary(d, now);
  console.log(s.text);
  assert.deepStrictEqual(s.counts, { waiting: 1, newEvidence: 1, toReview: 1, active: 1, quiet: 0, students: 1 });
  assert.match(s.text, /AI pre-mark ready \(75%\)/);
  assert.match(s.text, /Test Student \(20 min\) · US335815 0\/12/);
  console.log('emulator check: OK');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
