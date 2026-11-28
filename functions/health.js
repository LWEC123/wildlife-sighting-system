// Daily website health check (runs inside dailySummary at 07:00, result goes at the top of the email).
//
//  1. Learning Portal page is up (GitHub Pages)
//  2. College website is up (limpopowildlifeecocollege.com)
//  3. College website can send email (the LWEC helper snippet reports the last sent / failed email
//     and, if nothing was sent for a day, sends one small test email to the college inbox)
//  4. Stuck sign-ups on the website: accounts whose email is not confirmed yet, and duplicate accounts
//  5. Help chat: requests passed to the college in the last 24 hours
//
// Safe fix it does by itself: a student whose website sign-up has been stuck (email not confirmed)
// for more than 12 hours and less than 10 days gets ONE fresh "Confirm my email" link from the
// college address (at most 5 a day). Only the owner of that mailbox can use it. Nothing is deleted.

const crypto = require('crypto');
const PORTAL = 'https://lwec123.github.io/wildlife-sighting-system/LWECCourses.html';
const WEBSITE = 'https://limpopowildlifeecocollege.com';
const H = 3600000, DAY = 24 * H;
const AUTO_VERIFY = { minHours: 12, maxDays: 10, perDay: 5 };

function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function emailKey(e) { return crypto.createHash('sha256').update('lwec-verify:' + String(e).toLowerCase()).digest('hex').slice(0, 32); }
function ago(t, now) { const h = Math.round((now - t) / H); return h < 1 ? 'less than an hour ago' : h < 48 ? h + ' h ago' : Math.round(h / 24) + ' days ago'; }

async function pageUp(fetchFn, url, mustContain) {
  try {
    const r = await fetchFn(url, { redirect: 'follow', signal: AbortSignal.timeout(20000), headers: { 'User-Agent': 'LWEC-health-check/1.0' } });
    const t = await r.text();
    if (!r.ok) return { ok: false, detail: 'answered with error ' + r.status };
    if (mustContain && !t.includes(mustContain)) return { ok: false, detail: 'opened, but the page looks wrong (no "' + mustContain + '")' };
    return { ok: true };
  } catch (e) { return { ok: false, detail: 'did not answer (' + String(e.message || e).slice(0, 80) + ')' }; }
}

function confirmMail(name, link) {
  return '<p>Hello' + (name ? ' ' + esc(name) : '') + ',</p><p>You signed up on the Limpopo Wildlife Eco College website, but your email is not confirmed yet, so you cannot sign in. Click the button to confirm it:</p>'
    + '<p><a href="' + esc(link) + '" style="background:#2e6b34;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">Confirm my email</a></p>'
    + '<p>The link works for 3 days. Please do not register again. If you did not sign up, ignore this email.</p><p>Limpopo Wildlife Eco College</p>';
}

/** deps = { fetch, wp(action, body), db, mail(to, subject, html), now() } */
async function runHealth(deps) {
  const now = deps.now(), items = [], fixed = [];
  const add = (name, ok, detail, fix) => items.push({ name, ok, detail: detail || '', fix: fix || '' });

  const p = await pageUp(deps.fetch, PORTAL, 'LWEC Learning Portal');
  add('Learning Portal', p.ok, p.ok ? 'up' : p.detail, p.ok ? '' : 'Open the portal yourself. If it is down for everyone, tell Claude in the project chat.');

  const w = await pageUp(deps.fetch, WEBSITE, '');
  add('College website', w.ok, w.ok ? 'up' : w.detail, w.ok ? '' : 'Open limpopowildlifeecocollege.com. If it does not open, contact your web host.');

  let wh = null;
  try { wh = await deps.wp('health', {}); } catch (e) { wh = { error: String(e.message || e).slice(0, 120) }; }
  let unverified = [], duplicates = [];
  if (!wh || wh.error || !wh.mail) {
    add('Website email and sign-ups', false, 'the LWEC helper on the website did not answer' + (wh && wh.error ? ' (' + wh.error + ')' : ''),
      'WP Admin › Snippets: check that "LWEC helper" is switched on. If it is, tell Claude in the project chat.');
  } else {
    const m = wh.mail, lastOk = (m.last_ok || 0) * 1000, lastFail = (m.last_fail || 0) * 1000;
    const failing = (m.test && m.test.sent === false) || (lastFail > 0 && lastFail > lastOk);
    if (failing) add('Website email', false, 'the website CANNOT send email' + (m.last_error ? ' (' + m.last_error + ')' : '') + '. Students get no password-reset or confirm emails.',
      'WP Admin › GoSMTP › Settings: put in a new Gmail app password (make one at myaccount.google.com/apppasswords), Save, then GoSMTP › Test Mail.');
    else add('Website email', true, lastOk ? 'working (last email sent ' + ago(lastOk, now) + ')' : 'working');
    unverified = (wh.unverified || []).filter(u => u && u.email);
    duplicates = (wh.duplicates || []).filter(d => d && d.count > 1);

    // Safe fix: one fresh confirm link per stuck sign-up, sent from the portal's own Gmail sender.
    if (wh.verify_supported) {
      let sent = 0;
      for (const u of unverified) {
        const age = now - (u.registered || 0) * 1000;
        if (sent >= AUTO_VERIFY.perDay || age < AUTO_VERIFY.minHours * H || age > AUTO_VERIFY.maxDays * DAY) continue;
        const ref = deps.db.doc('helpverify/' + emailKey(u.email));
        if ((await ref.get()).exists) { u.autoSent = true; continue; }
        try {
          const r = await deps.wp('verify-link', { email: u.email });
          if (!r || r.status !== 'ok' || !r.link) continue;
          await deps.mail(u.email, 'Confirm your email for the Limpopo Wildlife Eco College website', confirmMail(u.name, r.link));
          await ref.set({ at: new Date(now), uid: u.id || null });
          u.autoSent = true; sent++; fixed.push('Sent a fresh "Confirm my email" link to ' + (u.name || u.email));
        } catch (e) { console.error('auto verify', e.message); }
      }
    }
    add('Website sign-ups', !unverified.length && !duplicates.length,
      unverified.length ? unverified.length + ' account' + (unverified.length === 1 ? '' : 's') + ' not confirmed yet' + (duplicates.length ? ', ' + duplicates.length + ' email(s) with duplicate accounts' : '')
        : duplicates.length ? duplicates.length + ' email(s) with duplicate accounts' : 'none stuck',
      unverified.length ? 'If you know the person: WP Admin › Users › hover over the name › click "Mark email verified". Or wait: they got a confirm link by email.' : '');
  }

  let helpList = [];
  try {
    const s = await deps.db.collection('helpdesk').where('at', '>=', new Date(now - DAY)).get();
    helpList = s.docs.map(d => Object.assign({ id: d.id }, d.data()));
  } catch (e) { console.error('helpdesk read', e.message); }

  return { ok: items.every(i => i.ok), items, unverified, duplicates, fixed, help: { count: helpList.length, list: helpList } };
}

function healthHtml(h, now) {
  const li = a => '<ul style="margin:4px 0 12px 18px;padding:0">' + a.map(x => '<li>' + x + '</li>').join('') + '</ul>';
  const out = [];
  out.push('<h3 style="margin-bottom:2px;color:' + (h.ok ? '#2e6b34' : '#a33') + '">' + (h.ok ? '✅ Websites: all OK' : '⚠️ Websites: something needs you') + '</h3>');
  out.push(li(h.items.map(i => (i.ok ? '✅ ' : '❌ ') + '<b>' + esc(i.name) + '</b>: ' + esc(i.detail) + (!i.ok && i.fix ? '<br><span style="color:#555">What to do: ' + esc(i.fix) + '</span>' : ''))));
  if (h.unverified.length) out.push('<p style="margin:0 0 2px"><b>Website sign-ups not confirmed:</b></p>' + li(h.unverified.slice(0, 15).map(u => esc(u.name || '(no name)') + ' · ' + esc(u.email)
    + ' · signed up ' + ago((u.registered || 0) * 1000, now) + (u.autoSent ? ' · confirm link sent' : '') + (u.fix_url ? ' · <a href="' + esc(u.fix_url) + '">open in Users</a>' : ''))));
  if (h.duplicates.length) out.push('<p style="margin:0 0 2px"><b>Duplicate website accounts</b> (same email signed up more than once):</p>' + li(h.duplicates.slice(0, 10).map(d => esc(d.email) + ': ' + d.count + ' accounts')));
  if (h.fixed.length) out.push('<p style="margin:0 0 2px"><b>Fixed by itself:</b></p>' + li(h.fixed.map(esc)));
  out.push('<p style="margin:0 0 12px">💬 Help chat: ' + (h.help.count ? '<b>' + h.help.count + ' student' + (h.help.count === 1 ? '' : 's') + ' asked for you</b> in the last 24 hours (you got an email for each).' : 'no requests for you in the last 24 hours.') + '</p>');
  return out.join('');
}

module.exports = { runHealth, healthHtml, pageUp, confirmMail, AUTO_VERIFY, PORTAL, WEBSITE };
