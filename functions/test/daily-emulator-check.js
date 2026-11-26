// Emulator check of the daily summary, the saved spreadsheets and the download endpoint:
// MONITOR_KEY=<key> GMAIL_APP_PASSWORD=none firebase emulators:exec --config firebase.test.json --project demo-lwec \
//   --only functions,firestore,storage "node functions/test/daily-emulator-check.js"
const assert = require('assert');
process.env.GMAIL_APP_PASSWORD = 'none';
const fns = require('../index');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');
const { loadData, buildSummary } = require('../daily');
const db = getFirestore();
(async () => {
  const now = Date.now(), T = x => Timestamp.fromMillis(x);
  await db.doc('enrol/us335815_u1').set({ uid: 'u1', cid: 'us335815', name: 'Test Student', email: 't@x', active: true });
  await db.doc('enrol/us335802_u1').set({ uid: 'u1', cid: 'us335802', name: 'Should be ignored', active: true });
  await db.doc('progress/us335815_u1').set({ lastSeen: T(now - 3600e3), totalSec: 900, current: { mid: 'm01', item: 'sheet', at: T(now - 3600e3) },
    mods: { m01: { submittedAt: T(now - 7200e3), opened: { guide: T(now - 9000e3) }, draft: 'secret draft', form: { 1: 'answer' } } } });
  await db.doc('results/us335815_u1').set({ passed: {}, marks: {} });
  await db.doc('premarks/us335815_u1_m01').set({ status: 'done', forSub: now - 7200e3, result: { percent: 75, good: 'x', questions: [{ n: 1 }] } });
  await db.doc('evidence/e1').set({ uid: 'u1', us: 'US335815', name: 'photo.jpg', at: T(now - 60e3) });
  await db.doc('agree/u1').set({ at: T(now - 86400e3), text: 'long agreement' });
  await db.collection('sessions').add({ uid: 'u1', start: T(now - 5000e3), last: T(now - 3600e3), sec: 1200 });
  await db.collection('sessions').add({ uid: 'u1', start: T(now - 100 * 86400e3), last: T(now - 100 * 86400e3), sec: 999 });
  await db.collection('staffviews').add({ uid: 's1', name: 'Zeriah Wessels', email: 'z@x', cid: 'us335815', tier: 'course', title: 'Module 1 · Learner guide', at: T(now - 600e3) });
  await db.doc('courses/us335802').set({ code: 'US335802', nmods: 12, published: false });

  const d = await loadData(db, now);
  assert.strictEqual(d.enrol.length, 1);
  assert.strictEqual(d.sessions.length, 1);
  assert.ok(!JSON.stringify(d).includes('secret draft') && !JSON.stringify(d).includes('long agreement') && !JSON.stringify(d.premarks).includes('questions'));
  const s = buildSummary(d, now);
  assert.deepStrictEqual(s.counts, { waiting: 1, newEvidence: 1, toReview: 1, active: 1, quiet: 0, students: 1 });

  // Run the scheduled function itself (email skipped: no password) and check what it saved.
  await fns.dailySummary.run({ scheduleTime: new Date(now).toISOString() });
  const [files] = await getStorage().bucket().getFiles({ prefix: 'reports/' });
  const names = files.map(f => f.name).sort();
  console.log(names.join('\n'));
  assert.strictEqual(names.length, 2);
  const [mon] = await getStorage().bucket().file(names.find(n => n.includes('student-monitor'))).download();
  console.log(mon.toString());
  assert.match(mon.toString(), /"Test Student","t@x","on",.*"Module 1 · Answer sheet \(1 h ago\)","0","1","20","15","1","Handed in"/);

  // Download endpoint through the functions emulator.
  const url = 'http://127.0.0.1:5001/demo-lwec/africa-south1/monitorReports';
  assert.strictEqual((await fetch(url + '?list=1')).status, 403);
  assert.strictEqual((await fetch(url + '?list=1', { headers: { 'x-lwec-key': 'wrong' } })).status, 403);
  const H = { headers: { 'x-lwec-key': process.env.MONITOR_KEY } };
  const list = await (await fetch(url + '?list=1', H)).json();
  console.log(list);
  assert.strictEqual(list.length, 2);
  const got = await fetch(url + '?file=' + encodeURIComponent(list[0]), H);
  assert.strictEqual(got.status, 200);
  assert.ok((await got.text()).length > 50);
  assert.strictEqual((await fetch(url + '?file=' + encodeURIComponent('../memos/us335815/m01.docx'), H)).status, 400);
  console.log('emulator check: OK');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
