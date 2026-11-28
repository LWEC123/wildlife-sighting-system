/* LWEC Help chat bubble. Used on the Learning Portal and on the college website.
   Add to any page:  <script src="https://lwec123.github.io/wildlife-sighting-system/help/lwec-help-chat.js" defer></script>
   It talks to the Cloud Function helpChat (functions/help.js). No cookies, no tracking. */
(function () {
  if (window.__lwecHelp) return; window.__lwecHelp = 1;
  var API = 'https://africa-south1-lwec-field-logbook.cloudfunctions.net/helpChat';
  var SITE = /lwec123\.github\.io|localhost|127\.0\.0\.1/.test(location.hostname) ? 'portal' : 'website';
  var KEY = 'lwecHelpChat';
  var CHIPS = SITE === 'portal'
    ? ["I can't sign in", 'I forgot my password', "My access code doesn't work", 'How do I hand in my test?', "The video won't play", 'I want to talk to a person']
    : ["I can't sign in", 'I forgot my password', "I didn't get the confirm email", 'I want to talk to a person'];

  var state = { sid: '', msgs: [] };
  try { var s = JSON.parse(sessionStorage.getItem(KEY) || 'null'); if (s && Array.isArray(s.msgs)) state = s; } catch (e) {}
  if (!state.sid) state.sid = 'c' + Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
  function save() { try { sessionStorage.setItem(KEY, JSON.stringify({ sid: state.sid, msgs: state.msgs.slice(-24) })); } catch (e) {} }

  var css = '#lwh-btn{position:fixed;right:16px;bottom:16px;z-index:2147483000;background:#2e6b34;color:#fff;border:0;border-radius:28px;padding:12px 18px;font:600 16px/1.2 Arial,sans-serif;box-shadow:0 3px 12px rgba(0,0,0,.3);cursor:pointer}'
    + '#lwh-box{position:fixed;right:16px;bottom:76px;z-index:2147483001;width:360px;max-width:calc(100vw - 32px);height:520px;max-height:calc(100vh - 100px);background:#fff;color:#222;border-radius:12px;box-shadow:0 6px 28px rgba(0,0,0,.35);display:none;flex-direction:column;overflow:hidden;font:15px/1.45 Arial,sans-serif}'
    + '#lwh-box.open{display:flex}#lwh-head{background:#2e6b34;color:#fff;padding:10px 12px;display:flex;align-items:center;gap:8px}#lwh-head b{flex:1;font-size:16px}'
    + '#lwh-head button{background:transparent;border:0;color:#fff;font-size:20px;cursor:pointer;padding:0 4px}'
    + '#lwh-log{flex:1;overflow-y:auto;padding:10px;background:#f4f6f2}.lwh-m{margin:6px 0;padding:8px 10px;border-radius:10px;max-width:88%;white-space:pre-wrap;word-wrap:break-word}'
    + '.lwh-u{background:#dcefd9;margin-left:auto}.lwh-a{background:#fff;border:1px solid #e1e4dc}.lwh-note{font-size:12px;color:#666;margin:4px 2px 8px}'
    + '#lwh-chips{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0}#lwh-chips button{background:#fff;border:1px solid #2e6b34;color:#2e6b34;border-radius:16px;padding:6px 10px;font:14px Arial,sans-serif;cursor:pointer}'
    + '#lwh-form{display:flex;gap:6px;padding:8px;border-top:1px solid #ddd;background:#fff}#lwh-in{flex:1;border:1px solid #bbb;border-radius:8px;padding:8px;font:15px Arial,sans-serif;resize:none;height:40px}'
    + '#lwh-send{background:#2e6b34;color:#fff;border:0;border-radius:8px;padding:0 14px;font:600 15px Arial,sans-serif;cursor:pointer}#lwh-send:disabled{opacity:.5}'
    + '@media (max-width:480px){#lwh-box{right:8px;left:8px;width:auto;max-width:none;bottom:70px;height:calc(100vh - 90px)}#lwh-btn{right:10px;bottom:10px}}';
  // On the portal stay UNDER its full-screen viewer and pop-ups (z-index 300+), so the bubble never covers course material.
  if (SITE === 'portal') css = css.replace('z-index:2147483000', 'z-index:290').replace('z-index:2147483001', 'z-index:291');
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  var btn = document.createElement('button'); btn.id = 'lwh-btn'; btn.type = 'button'; btn.textContent = '💬 Help'; btn.setAttribute('aria-label', 'Open LWEC Help chat');
  var box = document.createElement('div'); box.id = 'lwh-box'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', 'LWEC Help');
  box.innerHTML = '<div id="lwh-head"><b>LWEC Help</b><button type="button" id="lwh-new" title="Start a new chat">↺</button><button type="button" id="lwh-x" aria-label="Close">✕</button></div>'
    + '<div id="lwh-log" aria-live="polite"></div>'
    + '<form id="lwh-form"><textarea id="lwh-in" maxlength="1500" placeholder="Type your question…" aria-label="Your question"></textarea><button id="lwh-send" type="submit">Send</button></form>';
  function mount() { document.body.appendChild(btn); document.body.appendChild(box); render(); }
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);

  var log = box.querySelector('#lwh-log'), input = box.querySelector('#lwh-in'), send = box.querySelector('#lwh-send');
  function bubble(role, text) { var d = document.createElement('div'); d.className = 'lwh-m ' + (role === 'user' ? 'lwh-u' : 'lwh-a'); d.textContent = text; log.appendChild(d); return d; }
  function render() {
    log.innerHTML = '';
    bubble('assistant', 'Hi! I am the LWEC Help assistant. I can help with signing in, passwords, codes, handing in tests and videos. What is the problem?');
    var n = document.createElement('div'); n.className = 'lwh-note'; n.textContent = 'Never type your password or access code here. The college can read this chat to help you.'; log.appendChild(n);
    if (!state.msgs.length) {
      var c = document.createElement('div'); c.id = 'lwh-chips';
      CHIPS.forEach(function (t) { var b = document.createElement('button'); b.type = 'button'; b.textContent = t; b.onclick = function () { ask(t); }; c.appendChild(b); });
      log.appendChild(c);
    }
    state.msgs.forEach(function (m) { bubble(m.role, m.content); });
    log.scrollTop = log.scrollHeight;
  }
  var busy = false;
  function ask(text) {
    text = String(text || '').trim(); if (!text || busy) return;
    state.msgs.push({ role: 'user', content: text.slice(0, 1500) }); save(); render();
    busy = true; send.disabled = true;
    var wait = bubble('assistant', 'Typing…'); log.scrollTop = log.scrollHeight;
    fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ site: SITE, sid: state.sid, messages: state.msgs }) })
      .then(function (r) { return r.json().catch(function () { return {}; }); })
      .then(function (j) { state.msgs.push({ role: 'assistant', content: j.reply || 'Sorry, something went wrong. Please email the LWEC office.' }); })
      .catch(function () { state.msgs.push({ role: 'assistant', content: 'I could not connect. Check your internet and try again, or email the LWEC office.' }); })
      .then(function () { busy = false; send.disabled = false; save(); wait.remove(); render(); input.focus(); });
  }
  btn.onclick = function () { box.classList.toggle('open'); if (box.classList.contains('open')) { log.scrollTop = log.scrollHeight; input.focus(); } };
  box.querySelector('#lwh-x').onclick = function () { box.classList.remove('open'); };
  box.querySelector('#lwh-new').onclick = function () { state = { sid: 'c' + Math.random().toString(36).slice(2, 12) + Date.now().toString(36), msgs: [] }; save(); render(); };
  box.querySelector('#lwh-form').onsubmit = function (e) { e.preventDefault(); var t = input.value; input.value = ''; ask(t); };
  input.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); box.querySelector('#lwh-form').onsubmit(e); } });
  window.lwecHelpOpen = function (text) { box.classList.add('open'); if (text) ask(text); };
})();
