// Daily summary email for the assessor (LWEC Learning Portal).
//
// Every morning at 07:00 South African time the Cloud Function dailySummary (index.js) reads the
// portal data and emails ONE short summary to the assessor:
//   - tests waiting to be marked (oldest first) and whether the AI pre-mark is ready
//   - new evidence uploads (last 24 hours) and evidence still to review
//   - who worked yesterday, who has gone quiet (7+ days), and each student's progress
//   - reminders before deadlines (e.g. the Google Cloud free trial)
//
// It only READS: no Firestore write, no Storage access, and it never opens memos/, testkeys/
// or any marks/feedback text. buildSummary() is a pure function so it can be tested offline.

const DAY = 86400000;
const QUIET_DAYS = 7;
const PK = 'us335815';

// Dates Zeriah must act on. Each shows from `from` days before, as a reminder line.
const REMINDERS = [
  { date: '2027-02-24', from: 30, text: 'Google Cloud free trial ends. Click Upgrade to a paid account in Firebase, or the portal stops working.', how: 'console.firebase.google.com › lwec-field-logbook › Upgrade' }
];

function ms(t) { if (!t) return 0; if (typeof t.toMillis === 'function') return t.toMillis(); if (t instanceof Date) return t.getTime(); if (typeof t === 'object' && t._seconds != null) return t._seconds * 1000; return +t || 0; }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function sast(t) { return new Date(t + 2 * 3600000); }   // South Africa: UTC+2, no daylight saving
function fmtDay(t) { const d = sast(t); return d.getUTCDate() + ' ' + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()]; }
function daysAgo(t, now) { return Math.floor((now - t) / DAY); }
function agoText(t, now) { if (!t) return 'never'; const d = daysAgo(t, now); return d <= 0 ? 'today' : d === 1 ? 'yesterday' : d + ' days ago'; }

function courseInfo(courses, cid) {
  const d = courses[cid] || {}, n = cid.replace(/^us/i, '');
  return { code: d.code || 'US' + n, nmods: Math.max(1, Math.min(40, parseInt(d.nmods, 10) || (cid === PK ? 12 : 10))), published: d.published !== undefined ? d.published !== false : cid === PK };
}
function modLabel(mid) { return 'M' + mid.slice(1, 3) + (mid.length > 3 ? mid[3].toUpperCase() : ''); }

/**
 * data = { enrol:[{uid,name,email,active}], progress:{'cid_uid':{mods,lastSeen,totalSec}},
 *          results:{'cid_uid':{passed,marks}}, premarks:{'cid_uid_mid':{status,forSub,result}},
 *          evidence:[{uid,name,us,at,review}], sessions:[{uid,last,start,sec}], courses:{cid:{...}} }
 * Returns { subject, html, text, counts }.
 */
function buildSummary(data, now) {
  const courses = data.courses || {};
  const students = (data.enrol || []).filter(e => e.uid && e.active !== false);
  const nameOf = uid => { const e = (data.enrol || []).find(x => x.uid === uid) || {}; return e.name || e.email || 'Unknown student'; };
  const since = now - DAY;

  // 1. Tests waiting to be marked (same rule as the Marking page).
  const waiting = [];
  Object.entries(data.progress || {}).forEach(([key, p]) => {
    const cut = key.indexOf('_'); if (cut < 0) return;
    const cid = key.slice(0, cut), uid = key.slice(cut + 1);
    if (!students.find(e => e.uid === uid)) return;
    const r = (data.results || {})[key] || {}, passed = r.passed || {}, marks = r.marks || {};
    Object.entries(p.mods || {}).forEach(([mid, pm]) => {
      const sub = ms(pm && pm.submittedAt); if (!sub || passed[mid] === true) return;
      if (marks[mid] && ms(marks[mid].at) >= sub) return;
      const pre = (data.premarks || {})[key + '_' + mid];
      let ai = 'mark yourself';
      if (pre && pre.forSub === sub) {
        if (pre.status === 'done') ai = 'AI pre-mark ready' + (pre.result && pre.result.percent != null ? ' (' + pre.result.percent + '%)' : '');
        else if (pre.status === 'running') ai = 'AI busy';
        else if (pre.status === 'error') ai = 'AI failed, mark yourself';
        else if (pre.status === 'no-memo') ai = 'no memo for AI, mark yourself';
        else if (pre.status === 'no-consent') ai = 'no AI consent, mark yourself';
        else if (pre.status === 'not-needed') ai = 'auto-marked test';
      }
      waiting.push({ name: nameOf(uid), code: courseInfo(courses, cid).code, mod: modLabel(mid), sub, ai });
    });
  });
  waiting.sort((a, b) => a.sub - b.sub);

  // 2. Evidence uploads.
  const ev = (data.evidence || []).filter(v => students.find(e => e.uid === v.uid));
  const newEv = ev.filter(v => ms(v.at) >= since);
  const toReview = ev.filter(v => !(v.review && v.review.status));
  const newEvBy = {};
  newEv.forEach(v => { const n = nameOf(v.uid); newEvBy[n] = (newEvBy[n] || 0) + 1; });

  // 3. Activity and progress.
  const seen = uid => Math.max(0, ...(data.sessions || []).filter(s => s.uid === uid).map(s => ms(s.last)),
    ...Object.entries(data.progress || {}).filter(([k]) => k.endsWith('_' + uid)).map(([, p]) => ms(p.lastSeen)));
  const mins24 = uid => Math.round((data.sessions || []).filter(s => s.uid === uid && ms(s.last) >= since).reduce((a, s) => a + (s.sec || 0), 0) / 60);
  const activeCids = [...new Set([PK, ...Object.keys(courses).filter(c => courseInfo(courses, c).published),
    ...Object.keys(data.progress || {}).map(k => k.slice(0, k.indexOf('_')))])].sort();
  const rows = students.map(e => {
    const last = seen(e.uid);
    const prog = activeCids.map(cid => {
      const passed = ((data.results || {})[cid + '_' + e.uid] || {}).passed || {};
      const done = Object.keys(passed).filter(m => passed[m] === true && m.length === 3).length;
      const started = !!(data.progress || {})[cid + '_' + e.uid];
      return started || done ? courseInfo(courses, cid).code + ' ' + done + '/' + courseInfo(courses, cid).nmods : null;
    }).filter(Boolean).join(', ') || 'not started';
    return { name: e.name || e.email, last, mins: mins24(e.uid), prog };
  }).sort((a, b) => b.last - a.last);
  const activeToday = rows.filter(r => r.last >= since);
  const quiet = rows.filter(r => r.last < now - QUIET_DAYS * DAY);

  // 4. Reminders.
  const reminders = REMINDERS.map(r => ({ r, left: Math.ceil((Date.parse(r.date + 'T00:00:00+02:00') - now) / DAY) }))
    .filter(x => x.left >= 0 && x.left <= x.r.from)
    .map(x => '<b>' + x.left + ' day' + (x.left === 1 ? '' : 's') + ' left:</b> ' + esc(x.r.text) + ' <span style="color:#666">(' + esc(x.r.how) + ')</span>');

  // ---- email ----
  const PORTAL = 'https://lwec123.github.io/wildlife-sighting-system/LWECCourses.html';
  const h = [];
  const li = a => '<ul style="margin:4px 0 12px 18px;padding:0">' + a.map(x => '<li>' + x + '</li>').join('') + '</ul>';
  h.push('<p style="font-size:15px">Good morning Zeriah. Here is the portal for ' + fmtDay(now) + '.</p>');
  if (reminders.length) h.push('<h3 style="color:#a33;margin-bottom:2px">⏰ Reminder</h3>' + li(reminders));

  h.push('<h3 style="margin-bottom:2px">📝 To mark: ' + waiting.length + '</h3>');
  if (waiting.length) {
    h.push(li(waiting.slice(0, 15).map(w => esc(w.name) + ', ' + esc(w.code) + ' ' + esc(w.mod) + ' · handed in ' + agoText(w.sub, now) + ' · ' + esc(w.ai))
      .concat(waiting.length > 15 ? ['…and ' + (waiting.length - 15) + ' more'] : [])));
    h.push('<p style="margin-top:0">To mark: <a href="' + PORTAL + '#marking">open the portal</a> › sign in › click <b>Marking</b> › check the marks › click <b>Competent</b> or <b>Not yet competent</b>.</p>');
  } else h.push('<p style="margin-top:0">Nothing waiting.</p>');

  h.push('<h3 style="margin-bottom:2px">📎 Evidence: ' + newEv.length + ' new, ' + toReview.length + ' to review</h3>');
  if (newEv.length) h.push(li(Object.entries(newEvBy).map(([n, c]) => esc(n) + ': ' + c + ' file' + (c === 1 ? '' : 's'))));
  if (toReview.length) h.push('<p style="margin-top:0">To review: portal › <b>Student monitor</b> › click the student › under each file click <b>✔ Accept for PoE</b> or <b>Needs correction</b>.</p>');

  h.push('<h3 style="margin-bottom:2px">👥 Worked in the last 24 hours: ' + activeToday.length + ' of ' + rows.length + '</h3>');
  if (activeToday.length) h.push(li(activeToday.map(r => esc(r.name) + (r.mins ? ' (' + r.mins + ' min)' : '') + ' · ' + esc(r.prog))));
  if (quiet.length) h.push('<p style="margin:0 0 2px"><b>Quiet for ' + QUIET_DAYS + '+ days</b> (maybe send a WhatsApp):</p>' + li(quiet.map(r => esc(r.name) + ' · last seen ' + agoText(r.last, now) + ' · ' + esc(r.prog))));

  const others = rows.filter(r => r.last < since && r.last >= now - QUIET_DAYS * DAY);
  if (others.length) h.push('<p style="margin:0 0 2px">Others this week:</p>' + li(others.map(r => esc(r.name) + ' · ' + agoText(r.last, now) + ' · ' + esc(r.prog))));

  h.push('<p style="color:#888;font-size:12px">LWEC Learning Portal daily summary, sent at 07:00. It never contains memos or student answers. "US335815 3/12" means 3 of 12 modules competent.</p>');

  const subject = 'Portal today: ' + waiting.length + ' to mark, ' + newEv.length + ' new upload' + (newEv.length === 1 ? '' : 's') + ', ' + activeToday.length + ' active'
    + (reminders.length ? ' · reminder' : '');
  const html = '<div style="font-family:Arial,sans-serif;font-size:14px;color:#222;max-width:640px">' + h.join('') + '</div>';
  const text = html.replace(/<li>/g, '\n- ').replace(/<\/(p|h3|ul)>/g, '\n').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/\n{3,}/g, '\n\n').trim();
  return { subject, html, text, counts: { waiting: waiting.length, newEvidence: newEv.length, toReview: toReview.length, active: activeToday.length, quiet: quiet.length, students: rows.length } };
}

// Reads everything the summary needs. Read-only: only .get() calls.
async function loadData(db, now) {
  const all = async c => (await db.collection(c).get()).docs;
  const [enrol, progress, results, premarks, evidence, sessions, courses, agree, choice] = await Promise.all([
    db.collection('enrol').where('cid', '==', PK).get().then(s => s.docs),
    all('progress'), all('results'), all('premarks'), all('evidence'),
    db.collection('sessions').where('start', '>=', new Date(now - 90 * DAY)).get().then(s => s.docs),
    all('courses'), all('agree'), all('choice')
  ]);
  const map = docs => Object.fromEntries(docs.map(d => [d.id, d.data()]));
  const list = docs => docs.map(d => d.data());
  // Keep only the fields the summary uses (premarks: no questions/feedback text).
  const pre = {};
  premarks.forEach(d => { const p = d.data(); pre[d.id] = { status: p.status, forSub: p.forSub, result: p.result ? { percent: p.result.percent } : null }; });
  const res = {};
  results.forEach(d => { const r = d.data(); res[d.id] = { passed: r.passed || {}, marks: Object.fromEntries(Object.entries(r.marks || {}).map(([m, v]) => [m, { at: v && v.at }])) }; });
  return {
    enrol: list(enrol).map(e => ({ uid: e.uid, name: e.name, email: e.email, active: e.active, paused: e.paused || {} })),
    progress: Object.fromEntries(progress.map(d => { const p = d.data(); return [d.id, { lastSeen: p.lastSeen, totalSec: p.totalSec, current: p.current ? { mid: p.current.mid, item: p.current.item, at: p.current.at } : null, mods: Object.fromEntries(Object.entries(p.mods || {}).map(([m, v]) => [m, { submittedAt: v && v.submittedAt, opened: Object.fromEntries(Object.keys((v && v.opened) || {}).map(k => [k, 1])) }])) }]; })),
    results: res, premarks: pre,
    evidence: list(evidence).map(v => ({ uid: v.uid, us: v.us, at: v.at, review: v.review ? { status: v.review.status } : null })),
    sessions: list(sessions).map(s => ({ uid: s.uid, last: s.last, start: s.start, sec: s.sec })),
    courses: map(courses),
    agree: Object.fromEntries(agree.map(d => [d.id, { at: d.data().at }])),
    choice: Object.fromEntries(choice.map(d => [d.id, { opt: d.data().opt }]))
  };
}

module.exports = { buildSummary, loadData, REMINDERS };

// ---------- Student monitor spreadsheet (same columns as "Download as spreadsheet (CSV)") ----------
const ITEM_LABELS = { guide: 'Learner guide', slides: 'Presentation', video: 'Module video', test: 'Visual test', sheet: 'Answer sheet', module: 'module overview' };
const TZ = 'Africa/Johannesburg';
function csvDate(t) { return new Date(t).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric', timeZone: TZ }); }
function csvDateTime(t) { return new Date(t).toLocaleString('en-ZA', { timeZone: TZ }); }
function csvAgo(t, now) { const x = ms(t); if (!x) return 'never'; const d = (now - x) / 1000; if (d < 90) return 'just now'; if (d < 3600) return Math.round(d / 60) + ' min ago'; if (d < 86400) return Math.round(d / 3600) + ' h ago'; return Math.round(d / 86400) + ' days ago'; }
function ymd(t) { return sast(t).toISOString().slice(0, 10); }

// Unit standards to export: US 335815 and every course switched to published.
function monitorCids(courses) {
  return [...new Set([PK, ...Object.keys(courses || {})])].filter(c => courseInfo(courses, c).published).sort();
}

function buildMonitorCsv(data, cid, now) {
  const courses = data.courses || {}, info = courseInfo(courses, cid), cdoc = courses[cid] || {};
  const ch = cdoc.choice && cdoc.choice.slot && (cdoc.choice.options || []).length ? cdoc.choice : null;
  const base = Array.from({ length: info.nmods }, (_, i) => 'm' + String(i + 1).padStart(2, '0'));
  const head = ['Student', 'Email', 'Access', 'Agreement signed', 'Last on', 'Busy with', 'Modules competent', 'Tests to mark', 'Time this week (min)', 'Time on unit standard (min)', 'Sessions (90 days)'].concat(base.map((m, i) => 'Module ' + (i + 1)));
  const lines = [head];
  const enrol = (data.enrol || []).slice().sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  const allCids = [...new Set([PK, ...Object.keys(courses)])];
  enrol.forEach(e => {
    const key = cid + '_' + e.uid, p = (data.progress || {})[key] || {}, r = (data.results || {})[key] || {};
    const passed = r.passed || {}, marks = r.marks || {};
    const opt = ((data.choice || {})[key] || {}).opt;
    const mids = base.map(m => ch && m === ch.slot && opt ? m + opt : m);
    const sess = (data.sessions || []).filter(s => s.uid === e.uid && ms(s.start) >= now - 90 * DAY);
    const lastSeen = Math.max(0, ...sess.map(s => ms(s.last)), ...allCids.map(c => ms(((data.progress || {})[c + '_' + e.uid] || {}).lastSeen)));
    const weekSec = sess.filter(s => ms(s.start) >= now - 7 * DAY).reduce((a, s) => a + (s.sec || 0), 0);
    const done = mids.filter(m => passed[m] === true).length;
    const waiting = mids.filter(m => { const pm = (p.mods || {})[m] || {}; return pm.submittedAt && passed[m] !== true && (!marks[m] || ms(marks[m].at) < ms(pm.submittedAt)); }).length;
    let busy;
    if (done === mids.length) busy = 'Finished this unit standard 🎉';
    else if (!p.current || !p.current.mid) busy = 'Not started yet';
    else {
      const cm = p.current.mid, n = parseInt(cm.slice(1, 3), 10) || '', on = ch && cm.length > 3 ? (ch.options || [])['abcdefghij'.indexOf(cm[3])] || '' : '';
      const what = p.current.item === 'test-submitted' ? 'handed in the test' : (ITEM_LABELS[p.current.item] || p.current.item);
      busy = 'Module ' + n + (on ? ' (' + on + ')' : '') + ' · ' + what + ' (' + csvAgo(p.current.at, now) + ')';
    }
    const agree = (data.agree || {})[e.uid];
    lines.push([e.name || '', e.email || '', e.active === false ? 'paused' : (e.paused || {})[cid] ? 'unit standard paused' : 'on',
      agree && ms(agree.at) ? csvDate(ms(agree.at)) : 'no', lastSeen ? csvDateTime(lastSeen) : 'never', busy, done, waiting,
      Math.round(weekSec / 60), Math.round((p.totalSec || 0) / 60), sess.length]
      .concat(mids.map(m => { const pm = (p.mods || {})[m] || {}; return passed[m] === true ? 'Competent' : pm.submittedAt ? 'Handed in' : (pm.opened && Object.keys(pm.opened).length) ? 'Started' : ''; })));
  });
  const csv = '﻿' + lines.map(r => r.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\r\n');
  return { code: info.code, name: 'LWEC-student-monitor-' + info.code + '-' + ymd(now) + '.csv', csv };
}

module.exports.buildMonitorCsv = buildMonitorCsv;
module.exports.monitorCids = monitorCids;
module.exports.ymd = ymd;

// ---------- Staff resources access log (same columns as "Download the log (spreadsheet)") ----------
function buildStaffLogCsv(views, courses, now) {
  const q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
  const rows = (views || []).slice().sort((a, b) => ms(b.at) - ms(a.at));
  const lines = [['Date and time', 'Name', 'Email', 'Unit standard', 'File', 'Section'].map(q).join(',')]
    .concat(rows.map(r => [ms(r.at) ? csvDateTime(ms(r.at)) : '', r.name, r.email, courseInfo(courses || {}, r.cid || PK).code, r.title,
      r.tier === 'conf' ? 'Confidential' : r.tier === 'fac' ? 'Facilitator' : 'Course material'].map(q).join(',')));
  return { name: 'LWEC-staff-access-log-' + ymd(now) + '.csv', csv: '﻿' + lines.join('\r\n'), count: rows.length };
}
module.exports.buildStaffLogCsv = buildStaffLogCsv;
