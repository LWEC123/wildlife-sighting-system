// Offline tests of the help chat and the website health check: node test/help.test.js
const assert = require('assert');
const fakeDb = require('./fake-db');
const fakeClaude = require('./fake-help-claude');
const { handleChat, tidyMessages, normEmail, LIMITS } = require('../help');
const { runHealth, healthHtml } = require('../health');

function deps(extra) {
  const sent = [], wa = [], wpCalls = [];
  const d = Object.assign({
    db: fakeDb(), now: () => Date.parse('2026-11-28T08:00:00Z'), claude: fakeClaude,
    auth: { generatePasswordResetLink: async e => { if (e === 'nobody@example.com') { const er = new Error('no user'); er.code = 'auth/user-not-found'; throw er; } return 'https://reset.example/?oob=1'; } },
    mail: async (to, subject, html) => { sent.push({ to, subject, html }); },
    whatsapp: async text => { wa.push(text); return { ok: true }; },
    wp: async (a, b) => { wpCalls.push([a, b]); return a === 'reset' ? { status: 'mail_failed' } : { status: 'ok' }; }
  }, extra || {});
  return { d, sent, wa, wpCalls };
}

(async () => {
  // message tidying
  assert.strictEqual(tidyMessages([]), null);
  assert.strictEqual(tidyMessages([{ role: 'assistant', content: 'hi' }]), null);
  const t = tidyMessages([{ role: 'system', content: 'evil' }, { role: 'user', content: 'a' }, { role: 'user', content: 'b' }]);
  assert.deepStrictEqual(t, [{ role: 'user', content: '<student>a\nb</student>' }]);
  assert.strictEqual(normEmail(' Kyle@Example.COM '), 'kyle@example.com');
  assert.strictEqual(normEmail('not an email'), null);

  // plain answer
  let { d, sent } = deps();
  let r = await handleChat(d, { site: 'portal', sid: 'abcdefgh12', messages: [{ role: 'user', content: 'I forgot my password' }] }, '1.2.3.4');
  assert.strictEqual(r.status, 200); assert.match(r.reply, /Forgot your password/);
  assert.ok(d.db.store.get('helpchats/abcdefgh12').transcript.length === 2);

  // portal reset: mail goes to the student; unknown email gets the same reply and no mail
  r = await handleChat(d, { site: 'portal', sid: 'abcdefgh12', messages: [{ role: 'user', content: 'reset kyle@example.com' }] }, '1.2.3.4');
  assert.strictEqual(sent.length, 1); assert.strictEqual(sent[0].to, 'kyle@example.com'); assert.match(sent[0].html, /reset\.example/);
  const r2 = await handleChat(d, { site: 'portal', sid: 'abcdefgh13', messages: [{ role: 'user', content: 'reset nobody@example.com' }] }, '1.2.3.4');
  assert.strictEqual(sent.length, 1);
  assert.strictEqual(r.reply.replace('kyle@example.com', 'X'), r2.reply.replace('nobody@example.com', 'X'));

  // per-email limit
  for (let i = 0; i < LIMITS.perEmailDay + 1; i++) r = await handleChat(d, { site: 'portal', messages: [{ role: 'user', content: 'reset kyle@example.com' }] }, '1.2.3.' + i);
  assert.match(r.reply, /Already sent/); assert.strictEqual(sent.length, LIMITS.perEmailDay);

  // website reset when the website cannot send mail -> tells the model to escalate
  r = await handleChat(d, { site: 'website', messages: [{ role: 'user', content: 'website reset ann@example.com' }] }, '9.9.9.9');
  assert.match(r.reply, /could not send/);

  // escalation: email to the college with transcript + WhatsApp without names
  ({ d, sent } = deps()); const wa = deps().wa;
  const dd = Object.assign({}, d, { whatsapp: async x => { wa.push(x); } });
  r = await handleChat(dd, { site: 'website', sid: 'escal12345', messages: [{ role: 'user', content: 'I want a person, ann@example.com' }] }, '5.5.5.5');
  assert.strictEqual(sent.length, 1); assert.match(sent[0].subject, /Test Student/); assert.match(sent[0].html, /I want a person/);
  assert.strictEqual(wa.length, 1); assert.ok(!/Test Student|ann@/.test(wa[0]));
  const hd = [...d.db.store.keys()].filter(k => k.startsWith('helpdesk/'));
  assert.strictEqual(hd.length, 1);
  // a second and third escalation in the same chat: only 2 allowed
  await handleChat(dd, { site: 'website', sid: 'escal12345', messages: [{ role: 'user', content: 'person again ann@example.com' }] }, '5.5.5.5');
  await handleChat(dd, { site: 'website', sid: 'escal12345', messages: [{ role: 'user', content: 'person again ann@example.com' }] }, '5.5.5.5');
  assert.strictEqual([...d.db.store.keys()].filter(k => k.startsWith('helpdesk/')).length, 2);

  // per-IP limit
  ({ d } = deps());
  for (let i = 0; i < LIMITS.perIpDay; i++) await handleChat(d, { messages: [{ role: 'user', content: 'hi' }] }, '7.7.7.7');
  r = await handleChat(d, { messages: [{ role: 'user', content: 'hi' }] }, '7.7.7.7');
  assert.strictEqual(r.status, 429);

  // Claude failing -> friendly message, no crash
  ({ d } = deps({ claude: async () => { throw new Error('down'); } }));
  r = await handleChat(d, { messages: [{ role: 'user', content: 'hi' }] }, '1.1.1.1');
  assert.match(r.reply, /not working right now/);

  // ---------- health check ----------
  const now = Date.parse('2026-11-28T05:00:00Z');
  const okFetch = async url => ({ ok: true, status: 200, text: async () => url.includes('LWECCourses') ? '<title>LWEC Learning Portal</title>' : '<html>site</html>' });
  let mails = [];
  const hdb = fakeDb();
  const wpH = async (a, b) => a === 'health' ? { mail: { last_ok: now / 1000 - 3600, last_fail: 0 }, verify_supported: true,
    unverified: [{ id: 60, name: 'Old Person', email: 'old@example.com', registered: now / 1000 - 20 * 86400 },
      { id: 70, name: 'New Person', email: 'new@example.com', registered: now / 1000 - 2 * 86400 }],
    duplicates: [{ email: 'dup@example.com', count: 2 }] } : a === 'verify-link' ? { status: 'ok', link: 'https://site/?lwec_verify=x' } : {};
  let h = await runHealth({ fetch: okFetch, wp: wpH, db: hdb, now: () => now, mail: async (to, s, html) => mails.push({ to, s, html }) });
  assert.strictEqual(h.items.find(i => i.name === 'Learning Portal').ok, true);
  assert.strictEqual(h.items.find(i => i.name === 'Website email').ok, true);
  assert.strictEqual(h.ok, false);                        // stuck sign-ups
  assert.deepStrictEqual(mails.map(m => m.to), ['new@example.com']);   // too old one is skipped
  assert.strictEqual(h.fixed.length, 1);
  // second day: no second link to the same person
  mails = [];
  h = await runHealth({ fetch: okFetch, wp: wpH, db: hdb, now: () => now + 86400000, mail: async (to) => mails.push(to) });
  assert.strictEqual(mails.length, 0);
  let html = healthHtml(h, now);
  assert.match(html, /New Person/); assert.match(html, /confirm link sent/); assert.match(html, /dup@example\.com/);

  // website can't send mail + portal down
  const badFetch = async url => url.includes('LWECCourses') ? { ok: false, status: 404, text: async () => '' } : { ok: true, status: 200, text: async () => '' };
  h = await runHealth({ fetch: badFetch, wp: async a => a === 'health' ? { mail: { last_ok: 100, last_fail: 200, last_error: 'SMTP Error: Could not authenticate.' }, unverified: [], duplicates: [] } : {}, db: fakeDb(), now: () => now, mail: async () => {} });
  html = healthHtml(h, now);
  assert.match(html, /CANNOT send email/); assert.match(html, /Could not authenticate/); assert.match(html, /error 404/);
  // helper not installed
  h = await runHealth({ fetch: okFetch, wp: async () => { throw new Error('website answered 404 rest_no_route'); }, db: fakeDb(), now: () => now, mail: async () => {} });
  assert.match(healthHtml(h, now), /did not answer/);

  console.log('help + health tests passed');
})().catch(e => { console.error(e); process.exit(1); });
