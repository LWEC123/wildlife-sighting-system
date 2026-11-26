// One-off LIVE check after deploying (run in Google Cloud Shell, signed in as the project owner):
//
//   cd functions && node test/live-check.js us335802 m01 < answers.txt
//   (or paste the answers with a heredoc: node test/live-check.js us335802 m01 <<'EOF' ... EOF)
//
// It pretends a test learner ("AI test learner", uid ai-live-check) typed those answers and
// handed in, so the real function runs end to end: memo, Claude, premarks/, email. It prints the
// AI's suggestion, then deletes the test learner's records again. No real student is touched,
// and the test learner never appears in the Marking list (no enrolment).

const { initializeApp } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');

const [cid, mid] = process.argv.slice(2);
if (!/^[a-z0-9]+$/.test(cid || '') || !/^m\d\d[a-j]?$/.test(mid || '')) {
  console.error('Usage: node test/live-check.js <course id, e.g. us335802> <module, e.g. m01> < answers.txt');
  process.exit(1);
}
initializeApp({ projectId: process.env.GCLOUD_PROJECT || 'lwec-field-logbook' });
const db = getFirestore();
const UID = 'ai-live-check', sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  let answers = '';
  for await (const chunk of process.stdin) answers += chunk;
  answers = answers.trim();
  if (!answers) { console.error('No answers given on standard input.'); process.exit(1); }
  const pre = db.doc('premarks/' + cid + '_' + UID + '_' + mid);
  const prog = db.doc('progress/' + cid + '_' + UID);
  const cons = db.doc('aiconsent/' + UID);
  await pre.delete();
  await cons.set({ uid: UID, ok: true, name: 'AI test learner', at: Timestamp.now(), test: true });
  await prog.set({ uid: UID, cid, test: true, mods: { [mid]: { answers, link: '', paper: false, sheets: [], submittedAt: Timestamp.now() } } });
  console.log('Handed in as the AI test learner. Waiting for the AI (usually 1 to 3 minutes)…');
  let p = null;
  for (let i = 0; i < 60; i++) {
    await sleep(5000);
    const d = await pre.get();
    if (d.exists && d.data().status !== 'running') { await sleep(15000); p = (await pre.get()).data(); break; }
    process.stdout.write('.');
  }
  console.log('');
  if (!p) console.log('No result after 5 minutes. Check: firebase functions:log --only premarkOnHandIn');
  else if (p.status !== 'done') console.log('Status:', p.status, p.error || '', (p.warnings || []).join(' '));
  else {
    const r = p.result;
    console.log('Model:', p.model, '· memo:', p.memo, '· tokens in/out:', p.usage && p.usage.in, '/', p.usage && p.usage.out);
    r.questions.forEach(q => console.log('Q' + q.n + ': ' + q.mark + '/' + q.max + ' [' + q.confidence + '] ' + q.comment));
    console.log('TOTAL', r.total + '/' + r.max_total, '(' + r.percent + '%)', '→', r.recommendation);
    console.log('Done well:', r.good);
    console.log('To fix:', r.fix);
    if (r.notes) console.log('Notes:', r.notes);
    console.log('Email sent:', p.mailedFor ? 'yes' : 'not recorded (check the inbox and: firebase functions:log)');
  }
  await Promise.all([prog.delete(), cons.delete(), pre.delete()]);
  console.log('Test records removed.');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
