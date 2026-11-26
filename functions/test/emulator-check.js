// Emulator test: seed a student, a memo, an uploaded answer sheet (Word + photo), hand in, check premarks.
const N='firebase-admin/'; const {initializeApp}=require(N+'app'); const {getFirestore,Timestamp}=require(N+'firestore'); const {getStorage}=require(N+'storage');
const fs = require('fs');
initializeApp({ projectId: 'demo-lwec', storageBucket: 'demo-lwec.appspot.com' });
const db = getFirestore(), bucket = getStorage().bucket();
const SP = process.env.SP, sleep = ms => new Promise(r => setTimeout(r, ms));
async function waitFor(id, pred, s = 40) { for (let i = 0; i < s; i++) { const d = await db.doc('premarks/' + id).get(); if (d.exists && pred(d.data())) return d.data(); await sleep(1000); } const d = await db.doc('premarks/' + id).get(); return d.exists ? d.data() : null; }
(async () => {
  const cid = 'us335802', uid = 'stu1', mid = 'm01';
  await db.doc('enrol/us335815_stu1').set({ uid, cid: 'us335815', name: 'Test Student', active: true });
  await db.doc('courses/us335802').set({ code: 'US 335802' });
  await bucket.upload('/mnt/project-files/us335802-out/05 Answers/Assessor CONF/M01_Culture_and_Heritage_Memo.docx', { destination: 'memos/us335802/m01.docx' });
  await db.doc('memos/us335802_m01').set({ cid, mid, name: 'M01_Culture_and_Heritage_Memo.docx', path: 'memos/us335802/m01.docx' });
  await bucket.upload(SP + '/filled_sheet.docx', { destination: 'evidence/stu1/x/US335802/e1_sheet.docx' });
  await bucket.upload('/mnt/project-files/student-email-work/johann/knp/53668.jpg', { destination: 'evidence/stu1/x/US335802/e2_page.jpg', contentType: 'image/jpeg' });
  await db.doc('evidence/e1').set({ uid, cid, mid, kind: 'sheet', name: 'sheet.docx', path: 'evidence/stu1/x/US335802/e1_sheet.docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', at: new Date() });
  await db.doc('evidence/e2').set({ uid, cid, mid, kind: 'sheet', name: 'page.jpg', path: 'evidence/stu1/x/US335802/e2_page.jpg', type: 'image/jpeg', at: new Date() });
  const id = cid + '_' + uid + '_' + mid;
  // 1) no consent yet
  await db.doc('progress/us335802_stu1').set({ uid, cid, mods: { m01: { sheets: ['e1', 'e2'], answers: '', submittedAt: Timestamp.fromMillis(Date.now()) } } });
  let p = await waitFor(id, d => d.status !== 'running');
  console.log('1 no consent ->', p && p.status);
  // 2) consent yes, hand in again
  await db.doc('aiconsent/stu1').set({ uid, ok: true, at: new Date() });
  await db.doc('progress/us335802_stu1').set({ mods: { m01: { submittedAt: Timestamp.fromMillis(Date.now() + 5) } } }, { merge: true });
  p = await waitFor(id, d => d.status !== 'running' && d.status !== 'no-consent');
  console.log('2 consent ->', p && p.status, JSON.stringify(p && { files: p.files, memo: p.memo, warnings: p.warnings, total: p.result && p.result.total, max: p.result && p.result.max_total, pct: p.result && p.result.percent, q3: p.result && p.result.questions[2] }));
  console.log('   sent to AI:', fs.readFileSync('/tmp/premark-fake.json', 'utf8').slice(0, 1500));
  // 3) a watch-time write (no new hand-in) must not re-run
  const before = p.at.toMillis();
  await db.doc('progress/us335802_stu1').set({ totalSec: 60 }, { merge: true });
  await sleep(5000);
  p = (await db.doc('premarks/' + id).get()).data();
  console.log('3 unrelated write re-ran?', p.at.toMillis() !== before);
  // 4) module without memo or test keys
  await db.doc('progress/us335802_stu1').set({ mods: { m02: { sheets: ['e1'], submittedAt: Timestamp.now() } } }, { merge: true });
  p = await waitFor(cid + '_' + uid + '_m02', d => d.status !== 'running');
  console.log('4 no memo ->', p && p.status);
  // 5) online test with a written question, memo from testkeys
  await db.doc('tests/us335802_m03_A').set({ cid, mid: 'm03', ver: 'A', pass: 70, questions: [{ n: 1, type: 'MC', marks: 1, text: 'Pick', options: ['x', 'y'] }, { n: 2, type: 'WRITTEN', marks: 4, text: 'Explain ubuntu.' }] });
  await db.doc('testkeys/us335802_m03_A').set({ cid, mid: 'm03', ver: 'A', keys: { 1: { answer: 'a' }, 2: { memo: 'Humanity towards others; community; respect.' } } });
  await db.doc('attempts/us335802_stu1_m03_1').set({ cid, uid, mid: 'm03', att: 1, ver: 'A' });
  await db.doc('answers/us335802_stu1_m03_1_2').set({ cid, uid, mid: 'm03', att: 1, n: 2, a: 'Ubuntu means I am because we are.' });
  await db.doc('progress/us335802_stu1').set({ mods: { m03: { testAtt: 1, submittedAt: Timestamp.now() } } }, { merge: true });
  p = await waitFor(cid + '_' + uid + '_m03', d => d.status !== 'running');
  console.log('5 online test ->', p && p.status, p && p.memo);
  console.log('   sent to AI:', fs.readFileSync('/tmp/premark-fake.json', 'utf8').slice(0, 900));
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
