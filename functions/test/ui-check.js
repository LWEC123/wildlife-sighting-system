// Emulator UI check: seed a staff user and a pre-marked hand-in, open a TEST COPY of the
// portal wired to the emulators, and screenshot the Marking page and the student consent card.
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const { chromium } = require('playwright');
initializeApp({ projectId: 'demo-lwec' });
const db = getFirestore(), auth = getAuth(), OUT = process.env.SP;
(async () => {
  const staff = await auth.createUser({ email: 'staff@test.local', password: 'secret123', displayName: 'Zee Staff' });
  const stu = await auth.createUser({ email: 'stu@test.local', password: 'secret123', displayName: 'Thandi Test' });
  await db.doc('mentors/' + staff.uid).set({ name: 'Zee Staff' });
  await db.doc('users/' + staff.uid).set({ name: 'Zee Staff', role: 'mentor' });
  await db.doc('users/' + stu.uid).set({ name: 'Thandi Test', role: 'student' });
  await db.doc('enrol/us335815_' + stu.uid).set({ uid: stu.uid, cid: 'us335815', name: 'Thandi Test', email: 'stu@test.local', active: true, code: 'X' });
  await db.doc('agree/' + stu.uid).set({ uid: stu.uid, name: 'Thandi Test', at: Timestamp.now() });
  await db.doc('aiconsent/' + stu.uid).set({ uid: stu.uid, ok: true, at: Timestamp.now() });
  const sub = Timestamp.fromMillis(Date.now() - 3600e3);
  await db.doc('progress/us335815_' + stu.uid).set({ uid: stu.uid, cid: 'us335815', mods: { m01: { sheets: ['ev1'], answers: '', submittedAt: sub } } });
  await db.doc('evidence/ev1').set({ uid: stu.uid, cid: 'us335815', mid: 'm01', kind: 'sheet', name: 'M01 answer sheet.docx', path: 'evidence/' + stu.uid + '/a.docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: 24000, at: sub, us: 'US335815' });
  await db.doc('premarks/us335815_' + stu.uid + '_m01').set({ cid: 'us335815', uid: stu.uid, mid: 'm01', forSub: sub.toMillis(), status: 'done', model: 'claude-opus-5-5', memo: 'M01_Savanna_Memo.docx', files: ['M01 answer sheet.docx'], warnings: [], at: Timestamp.now(),
    result: { version: 'A', total: 17.5, max_total: 24, percent: 73, recommendation: 'C', good: 'Clear answers on the savanna food web and fire.', fix: 'Question 9: name two grasses and say why they matter to grazers.', notes: 'Question 10 handwriting is faint in places.',
      questions: [{ n: 1, max: 2, mark: 2, student_answer: 'B', comment: 'Correct.', confidence: 'high' }, { n: 9, max: 6, mark: 3.5, student_answer: 'Red grass is palatable…', comment: 'Two of three memo points; grasses not named.', confidence: 'medium' }, { n: 10, max: 4, mark: 2, student_answer: 'Fire keeps the bush open…', comment: 'Partly legible.', confidence: 'low' }] } });
  const b = await chromium.launch();
  const FB = process.env.FBJS; // local copy of the firebase npm package (the CDN is not reachable in the test box)
  const route = async ctx => ctx.route(/gstatic\.com\/firebasejs\/11\.10\.0\/(.*)$/, (r) => { const f = r.request().url().split('/').pop(); r.fulfill({ path: FB + '/' + f, contentType: 'text/javascript' }); });
  const c1 = await b.newContext({ viewport: { width: 1200, height: 1000 } }); await route(c1); const pg = await c1.newPage();
  pg.on('console', m => console.log('console:', m.type(), m.text().slice(0,200))); pg.on('pageerror', e => console.log('pageerror:', e.message)); pg.on('requestfailed', r => console.log('reqfail:', r.url().slice(0,100), r.failure()?.errorText));
  await pg.goto('http://127.0.0.1:8765/LWECCourses.html#marking');
  await pg.waitForSelector('#li_email', { state: 'visible', timeout: 30000 }).catch(async e => { await pg.screenshot({ path: OUT + '/dbg.png' }); throw e; });
  await pg.fill('#li_email', 'staff@test.local'); await pg.fill('#li_pass', 'secret123'); await pg.click('#li_btn');
  await pg.waitForSelector('#tab-marking:not([hidden])', { timeout: 20000 }).catch(() => {});
  await pg.waitForTimeout(4000);
  console.log('badge:', await pg.textContent('#markBadge'));
  await pg.click('text=Copy the AI feedback into the boxes').catch(e => console.log('no copy btn', e.message));
  await pg.screenshot({ path: OUT + '/marking.png', fullPage: true });
  console.log('feedback box:', await pg.$eval('[id^="ff-"]', e => e.value).catch(() => 'none'));
  console.log('total:', await pg.$eval('[id^="tot-"]', e => e.textContent).catch(() => 'none'));
  await pg.fill('[id^="sc-"][id$="-9"]', '4');
  await pg.click('text=Competent: open next module');
  await pg.waitForTimeout(2500);
  const res = (await db.doc('results/us335815_' + stu.uid).get()).data() || {};
  console.log('saved mark:', JSON.stringify(res.marks && res.marks.m01 && { outcome: res.marks.m01.outcome, total: res.marks.m01.total, max: res.marks.m01.max, ai: Object.assign({}, res.marks.m01.ai, { at: undefined }) }), 'passed:', JSON.stringify(res.passed));
  // student: consent card
  await db.doc('aiconsent/' + stu.uid).delete();
  const c2 = await b.newContext({ viewport: { width: 420, height: 900 } }); await route(c2); const p2 = await c2.newPage();
  await p2.goto('http://127.0.0.1:8765/LWECCourses.html');
  await p2.waitForSelector('#li_email', { state: 'visible', timeout: 30000 });
  await p2.fill('#li_email', 'stu@test.local'); await p2.fill('#li_pass', 'secret123'); await p2.click('#li_btn');
  await p2.waitForTimeout(5000);
  console.log('aiCard visible:', await p2.isVisible('#aiCard'));
  await p2.screenshot({ path: OUT + '/consent.png', fullPage: true });
  await p2.click('text=Yes, the AI may help mark my work').catch(e => console.log('no yes', e.message));
  await p2.waitForTimeout(2000);
  console.log('consent saved:', JSON.stringify((await db.doc('aiconsent/' + stu.uid).get()).data()?.ok), 'card hidden now:', !(await p2.isVisible('#aiCard')));
  await b.close(); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
