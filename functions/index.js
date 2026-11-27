// Cloud Functions for the LWEC Learning Portal (Firebase project lwec-field-logbook).
//
//  premarkOnHandIn  runs when a student hands in a module test (progress/<cid>_<uid> changes)
//  premarkNow       the staff button "Run AI pre-mark again" on the Marking page
//  dailySummary     07:00 every day: summary email + Student monitor spreadsheet (daily.js)
//  monitorReports   lets the college computer download the saved spreadsheets (key-protected)
//
// Both write SUGGESTED marks to premarks/<cid>_<uid>_<mid> (staff only) and email the
// assessor. The assessor's own decision on the Marking page is the only result that counts.
//
// Secrets (set once, see docs/AI-premarking-setup.md):
//   ANTHROPIC_API_KEY    the Claude API key
//   GMAIL_APP_PASSWORD   a Google "app password" for the notification sender address
//   CALLMEBOT_KEY        CallMeBot WhatsApp key (free, sends only to the assessor's own number)
//   WHATSAPP_TO          the assessor's WhatsApp number, e.g. 2782...

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
const { premark, newHandIns, callClaudeReal, onlineParts } = require('./premark');

// Must match the Firestore database location (checked when deploying) and REGION in LWECCourses.html.
const REGION = 'africa-south1';   // Johannesburg, same as the Firestore database
const NOTIFY_FROM = 'limpopowt@gmail.com';
const NOTIFY_TO = 'limpopowt@gmail.com';
const PORTAL = 'https://lwec123.github.io/wildlife-sighting-system/LWECCourses.html#marking';

const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');
const GMAIL_APP_PASSWORD = defineSecret('GMAIL_APP_PASSWORD');
const CALLMEBOT_KEY = defineSecret('CALLMEBOT_KEY');
const WHATSAPP_TO = defineSecret('WHATSAPP_TO');

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

const OPTS = { secrets: [ANTHROPIC_API_KEY, GMAIL_APP_PASSWORD, CALLMEBOT_KEY, WHATSAPP_TO], timeoutSeconds: 540, memory: '1GiB' };

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
  const REC = { C: 'Competent', NYC: 'Not yet competent', UNSURE: 'unsure, check carefully' };
  let parts = null;
  if (p.status === 'done') {
    const pm = ((((await db.doc('progress/' + cid + '_' + uid).get()).data() || {}).mods) || {})[mid] || {};
    if (pm.testAtt) { try { parts = await onlineParts(db, cid, uid, mid, pm.testAtt, r); } catch (e) { console.error('parts', e.message); } }
  }
  if (p.status === 'done' && parts) {
    body += '<p>Multiple choice <b>' + parts.mc.s + ' / ' + parts.mc.max + ' (' + parts.mc.pct + '%)</b> · written (AI) <b>' + parts.wr.s + ' / ' + parts.wr.max + ' (' + parts.wr.pct + '%)</b> · pass mark ' + parts.pass + '% in each part.</p>'
      + '<p>Suggested result: <b>' + REC[parts.outcome] + '</b>' + (parts.redo.length ? ' (redo the ' + parts.redo.join(' and ') + ' part)' : '') + (r.recommendation === 'UNSURE' ? '. The AI was unsure about the written answers: check them.' : '') + '</p>'
      + (r.notes ? '<p>Check: ' + escH(r.notes) + '</p>' : '')
      + '<p>Nothing counts until you confirm it. Open the test below and click <b>Confirm the AI result</b>, or change anything first.</p>';
  } else if (p.status === 'done') {
    body += '<p>AI suggestion: <b>' + r.total + ' / ' + r.max_total + ' (' + r.percent + '%)</b>, recommendation <b>' + escH(REC[r.recommendation] || r.recommendation) + '</b>.</p>'
      + (r.notes ? '<p>Check: ' + escH(r.notes) + '</p>' : '')
      + ((p.warnings || []).length ? '<p>' + p.warnings.map(escH).join('<br>') + '</p>' : '')
      + '<p>Nothing counts until you confirm it. Open the test below and click <b>Confirm the AI result</b>, or change anything first.</p>';
  } else if (p.status === 'error') body += '<p>The AI could not pre-mark it (' + escH(p.error) + '). Please mark it yourself.</p>';
  else if (p.status === 'no-consent') body += '<p>The student has not agreed to AI pre-marking, so the AI did not read it. Please mark it yourself.</p>';
  else if (p.status === 'no-memo') body += '<p>There is no memo for this module for the AI yet. Upload it on the Marking page (Memos for AI pre-marking), then click "Run AI pre-mark" on the student\'s test.</p>';
  else body += '<p>' + ((p.warnings || []).map(escH).join('<br>') || 'The AI found no file it could read.') + '</p>';
  body += '<p><a href="' + PORTAL + '-' + cid + '-' + uid + '-' + mid + '">' + (p.status === 'done' ? 'Open this test and confirm' : 'Open the Marking page') + '</a></p><p style="color:#888;font-size:12px">LWEC Learning Portal · this email has no marks for the student; only your confirmed decision counts.</p>';
  const tr = nodemailer.createTransport({ service: 'gmail', auth: { user: NOTIFY_FROM, pass: pass.replace(/\s+/g, '') } });
  try {
    await tr.sendMail({ from: 'LWEC Learning Portal <' + NOTIFY_FROM + '>', to: NOTIFY_TO, subject: SUBJECT[p.status] + ': ' + name + ', ' + code + ' ' + modName.split(':')[0], html: body });
    await ref.update({ mailedFor: p.forSub + ':' + p.status });
  } catch (e) { console.error('email failed', e.message); }
}

// ---------- WhatsApp alert to the assessor (CallMeBot), one per pre-marked hand-in ----------
// No student names or ids go to WhatsApp (POPIA): only the course, module and the Marking link.
const { sendWhatsApp } = require('./whatsapp');
async function whatsappAlert(cid, uid, mid) {
  const ref = db.doc('premarks/' + cid + '_' + uid + '_' + mid);
  const p = (await ref.get()).data() || {};
  if (!SUBJECT[p.status] || p.waFor === p.forSub + ':' + p.status) return;
  const code = ((await db.doc('courses/' + cid).get()).data() || {}).code || cid.toUpperCase();
  const mod = 'Module ' + (parseInt(mid.slice(1, 3), 10) || mid) + mid.slice(3).toUpperCase();
  const text = (p.status === 'done' ? 'LWEC: a test is waiting for your Confirm (' : 'LWEC: a test needs you to mark it yourself (') + code + ' ' + mod + '). Open the Marking page: ' + PORTAL;
  try {
    const r = await sendWhatsApp(CALLMEBOT_KEY.value(), WHATSAPP_TO.value(), text);
    if (r.ok) await ref.update({ waFor: p.forSub + ':' + p.status }); else console.error('whatsapp failed', r.reply);
  } catch (e) { console.error('whatsapp failed', e.message); }
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
    if (r.status !== 'skipped' && r.status !== 'not-handed-in' && r.status !== 'not-needed') {
      await notify(after.cid, after.uid, mid);
      await whatsappAlert(after.cid, after.uid, mid);
    }
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

// ---------- daily summary email + Student monitor spreadsheet, 07:00 South African time ----------
// Cloud Scheduler is not offered in africa-south1, so this one function runs in europe-west1.
// It reads Firestore (see daily.js), saves the day's Student monitor spreadsheet and the staff
// resources access log in Storage reports/ (no browser can read that folder) and sends one
// email to the assessor with both attached.
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onRequest } = require('firebase-functions/v2/https');
const crypto = require('crypto');
const { buildSummary, loadData, buildMonitorCsv, monitorCids, buildStaffLogCsv } = require('./daily');
const REPORTS = 'reports/';
// <folder>/<file>.csv as saved below; the only names the download endpoint serves.
const REPORT_NAME = /^(student-monitor\/US\d+\/LWEC-student-monitor-US\d+|staff-access-log\/LWEC-staff-access-log)-\d{4}-\d{2}-\d{2}\.csv$/;

exports.dailySummary = onSchedule({ schedule: '0 7 * * *', timeZone: 'Africa/Johannesburg', region: 'europe-west1', secrets: [GMAIL_APP_PASSWORD], timeoutSeconds: 120, memory: '512MiB', retryCount: 1 }, async () => {
  const now = Date.now();
  const data = await loadData(db, now);
  const s = buildSummary(data, now);
  const sheets = monitorCids(data.courses).map(cid => buildMonitorCsv(data, cid, now)).map(f => Object.assign({ dir: 'student-monitor/' + f.code + '/' }, f));
  try { sheets.push(Object.assign({ dir: 'staff-access-log/', code: 'staff access log' }, buildStaffLogCsv((await db.collection('staffviews').get()).docs.map(d => d.data()), data.courses, now))); }
  catch (e) { console.error('staff access log failed', e.message); }
  for (const f of sheets) {
    try { await bucket.file(REPORTS + f.dir + f.name).save(f.csv, { contentType: 'text/csv; charset=utf-8', resumable: false }); }
    catch (e) { console.error('saving spreadsheet failed', f.name, e.message); }
  }
  console.log('daily summary', JSON.stringify(s.counts), sheets.map(f => f.name).join(', '));
  const pass = GMAIL_APP_PASSWORD.value();
  if (!pass || pass === 'none') { console.warn('no GMAIL_APP_PASSWORD, email not sent'); return; }
  const tr = nodemailer.createTransport({ service: 'gmail', auth: { user: NOTIFY_FROM, pass: pass.replace(/\s+/g, '') } });
  await tr.sendMail({ from: 'LWEC Learning Portal <' + NOTIFY_FROM + '>', to: NOTIFY_TO, subject: s.subject,
    html: s.html + '<p style="color:#888;font-size:12px;font-family:Arial,sans-serif">Attached for your records: today\'s Student monitor spreadsheet and the staff resources access log (who opened what), the same as the download buttons in the portal.</p>',
    text: s.text + '\n\nAttached: today\'s Student monitor spreadsheet and the staff resources access log.',
    attachments: sheets.map(f => ({ filename: f.name, content: f.csv, contentType: 'text/csv; charset=utf-8' })) });
});

// ---------- the college computer fetches the saved spreadsheets into its OneDrive folder ----------
// Used only by the small Windows task "LWEC student monitor download" (tools/student-monitor/).
// The key lives only in that script on the college computer; here is only its SHA-256.
//   GET ?list=1          -> ["student-monitor/US335815/LWEC-student-monitor-US335815-2026-11-27.csv",
//                            "staff-access-log/LWEC-staff-access-log-2026-11-27.csv", ...] (last 60 days)
//   GET ?file=<one of those> -> the CSV
const MONITOR_KEY_SHA256 = '04a16154d8e4620a7b1c31e61670ca84fc7884c6466e73bc55349bdb9acc43d6';
function keyOk(k) {
  const h = crypto.createHash('sha256').update(String(k || '')).digest();
  return crypto.timingSafeEqual(h, Buffer.from(MONITOR_KEY_SHA256, 'hex'));
}
exports.monitorReports = onRequest({ timeoutSeconds: 60, memory: '256MiB', maxInstances: 1 }, async (req, res) => {
  res.set('Cache-Control', 'no-store');
  if (req.method !== 'GET' || !keyOk(req.get('x-lwec-key'))) { res.status(403).send('Forbidden'); return; }
  if (req.query.list) {
    const [files] = await bucket.getFiles({ prefix: REPORTS });
    const cut = Date.now() - 60 * 86400000;
    res.json(files.map(f => f.name.slice(REPORTS.length)).filter(n => REPORT_NAME.test(n) && Date.parse(n.slice(-14, -4)) >= cut).sort());
    return;
  }
  const name = String(req.query.file || '');
  if (!REPORT_NAME.test(name)) { res.status(400).send('Bad file'); return; }
  const f = bucket.file(REPORTS + name);
  const [ok] = await f.exists();
  if (!ok) { res.status(404).send('Not found'); return; }
  const [buf] = await f.download();
  res.set('Content-Type', 'text/csv; charset=utf-8').send(buf);
});
