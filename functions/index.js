// Cloud Functions for the LWEC Learning Portal (Firebase project lwec-field-logbook).
//
//  premarkOnHandIn  runs when a student hands in a module test (progress/<cid>_<uid> changes)
//  premarkNow       the staff button "Run AI pre-mark again" on the Marking page
//
// Both write SUGGESTED marks to premarks/<cid>_<uid>_<mid> (staff only) and email the
// assessor. The assessor's own decision on the Marking page is the only result that counts.
//
// Secrets (set once, see docs/AI-premarking-setup.md):
//   ANTHROPIC_API_KEY    the Claude API key
//   GMAIL_APP_PASSWORD   a Google "app password" for the notification sender address

const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { setGlobalOptions } = require('firebase-functions/v2');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');
const Anthropic = require('@anthropic-ai/sdk');
const sharp = require('sharp');
const nodemailer = require('nodemailer');
const { premark, newHandIns, callClaudeReal } = require('./premark');

// Must match the Firestore database location (checked when deploying) and REGION in LWECCourses.html.
const REGION = 'africa-south1';   // Johannesburg, same as the Firestore database
const NOTIFY_FROM = 'limpopowt@gmail.com';
const NOTIFY_TO = 'limpopowt@gmail.com';
const PORTAL = 'https://lwec123.github.io/wildlife-sighting-system/LWECCourses.html#marking';

const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');
const GMAIL_APP_PASSWORD = defineSecret('GMAIL_APP_PASSWORD');

setGlobalOptions({ region: REGION, maxInstances: 3 });
initializeApp();
const db = getFirestore();
const bucket = getStorage().bucket();

function deps() {
  // Local test only (Firebase emulator): a stand-in for Claude, so tests cost nothing.
  if (process.env.FUNCTIONS_EMULATOR === 'true' && process.env.PREMARK_FAKE === '1') {
    return { db, bucket, sharp, now: () => FieldValue.serverTimestamp(), callClaude: require('./test/fake-claude') };
  }
  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY.value(), timeout: 8 * 60 * 1000 });
  return { db, bucket, sharp, now: () => FieldValue.serverTimestamp(), callClaude: (memo, work) => callClaudeReal(client, memo, work) };
}

const OPTS = { secrets: [ANTHROPIC_API_KEY, GMAIL_APP_PASSWORD], timeoutSeconds: 540, memory: '1GiB' };

// ---------- email to the assessor, one per pre-marked hand-in ----------
const SUBJECT = {
  done: 'AI pre-mark ready to check',
  'no-consent': 'Test handed in: please mark it yourself (no AI consent)',
  'no-memo': 'Test handed in: please mark it yourself (no memo uploaded for AI)',
  'nothing-to-read': 'Test handed in: please check it yourself (nothing the AI could read)',
  error: 'Test handed in: AI pre-mark failed, please mark it yourself'
};
function escH(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

async function notify(cid, uid, mid) {
  const pass = GMAIL_APP_PASSWORD.value();
  if (!pass || pass === 'none') return;
  const ref = db.doc('premarks/' + cid + '_' + uid + '_' + mid);
  const p = (await ref.get()).data() || {};
  if (!SUBJECT[p.status] || p.mailedFor === p.forSub + ':' + p.status) return;
  const [en, us, mod] = await Promise.all([db.doc('enrol/us335815_' + uid).get(), db.doc('courses/' + cid).get(), db.doc('courses/' + cid + '/modules/' + mid).get()]);
  const name = (en.data() || {}).name || (en.data() || {}).email || 'A student';
  const code = (us.data() || {}).code || cid.toUpperCase();
  const mt = (mod.data() || {}).title;
  const modName = 'Module ' + (parseInt(mid.slice(1, 3), 10) || mid) + mid.slice(3).toUpperCase() + (mt ? ': ' + mt : '');
  const r = p.result || {};
  let body = '<p><b>' + escH(name) + '</b> handed in <b>' + escH(code + ' · ' + modName) + '</b>.</p>';
  if (p.status === 'done') {
    body += '<p>AI suggestion: <b>' + r.total + ' / ' + r.max_total + ' (' + r.percent + '%)</b>, recommendation <b>' + escH({ C: 'Competent', NYC: 'Not yet competent', UNSURE: 'unsure, check carefully' }[r.recommendation] || r.recommendation) + '</b>.</p>'
      + (r.notes ? '<p>Check: ' + escH(r.notes) + '</p>' : '')
      + ((p.warnings || []).length ? '<p>' + p.warnings.map(escH).join('<br>') + '</p>' : '')
      + '<p>Nothing counts until you confirm it. Open the Marking page, check the marks, change anything you disagree with, and click Competent or Not yet competent.</p>';
  } else if (p.status === 'error') body += '<p>The AI could not pre-mark it (' + escH(p.error) + '). Please mark it yourself.</p>';
  else if (p.status === 'no-consent') body += '<p>The student has not agreed to AI pre-marking, so the AI did not read it. Please mark it yourself.</p>';
  else if (p.status === 'no-memo') body += '<p>There is no memo for this module for the AI yet. Upload it on the Marking page (Memos for AI pre-marking), then click "Run AI pre-mark" on the student\'s test.</p>';
  else body += '<p>' + ((p.warnings || []).map(escH).join('<br>') || 'The AI found no file it could read.') + '</p>';
  body += '<p><a href="' + PORTAL + '">Open the Marking page</a></p><p style="color:#888;font-size:12px">LWEC Learning Portal · this email has no marks for the student; only your confirmed decision counts.</p>';
  const tr = nodemailer.createTransport({ service: 'gmail', auth: { user: NOTIFY_FROM, pass: pass.replace(/\s+/g, '') } });
  try {
    await tr.sendMail({ from: 'LWEC Learning Portal <' + NOTIFY_FROM + '>', to: NOTIFY_TO, subject: SUBJECT[p.status] + ': ' + name + ', ' + code + ' ' + modName.split(':')[0], html: body });
    await ref.update({ mailedFor: p.forSub + ':' + p.status });
  } catch (e) { console.error('email failed', e.message); }
}

// ---------- triggers ----------
exports.premarkOnHandIn = onDocumentWritten(Object.assign({ document: 'progress/{key}' }, OPTS), async ev => {
  const before = ev.data && ev.data.before && ev.data.before.exists ? ev.data.before.data() : null;
  const after = ev.data && ev.data.after && ev.data.after.exists ? ev.data.after.data() : null;
  if (!after || !after.cid || !after.uid) return;
  if (ev.params.key !== after.cid + '_' + after.uid) return;
  for (const mid of newHandIns(before, after)) {
    if (!/^m\d\d[a-j]?$/.test(mid)) continue;
    const r = await premark(deps(), after.cid, after.uid, mid);
    if (r.status !== 'skipped' && r.status !== 'not-handed-in' && r.status !== 'not-needed') await notify(after.cid, after.uid, mid);
  }
});

async function isFullMentor(uid) {
  const m = await db.doc('mentors/' + uid).get();
  return m.exists && (m.data().level || 'full') === 'full';
}

exports.premarkNow = onCall(OPTS, async req => {
  if (!req.auth || !(await isFullMentor(req.auth.uid))) throw new HttpsError('permission-denied', 'Staff only.');
  const { cid, uid, mid } = req.data || {};
  if (!/^[a-z0-9]+$/.test(cid || '') || !/^[A-Za-z0-9]+$/.test(uid || '') || !/^m\d\d[a-j]?$/.test(mid || '')) throw new HttpsError('invalid-argument', 'Bad module.');
  const r = await premark(deps(), cid, uid, mid, { force: true });
  return r;
});
