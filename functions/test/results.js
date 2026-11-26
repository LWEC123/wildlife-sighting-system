// Read-only (run in Google Cloud Shell): the combined suggested result of every AI pre-marked test.
//
//   cd functions && node test/results.js            (all pre-marked tests)
//   cd functions && node test/results.js us335815 m01
//
// Online tests: multiple choice and true/false scored by the portal's key, written questions by
// the AI, against the paper's pass mark. Answer sheets: the AI's own total. Nothing is changed.

const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
initializeApp({ projectId: process.env.GCLOUD_PROJECT || 'lwec-field-logbook' });
const db = getFirestore();
const [onlyCid, onlyMid] = process.argv.slice(2);

(async () => {
  const snap = await db.collection('premarks').where('status', '==', 'done').get();
  const rows = [];
  for (const d of snap.docs) {
    const p = d.data();
    if ((onlyCid && p.cid !== onlyCid) || (onlyMid && p.mid !== onlyMid) || p.uid === 'ai-live-check') continue;
    const [en, prog, res] = await Promise.all([db.doc('enrol/us335815_' + p.uid).get(), db.doc('progress/' + p.cid + '_' + p.uid).get(), db.doc('results/' + p.cid + '_' + p.uid).get()]);
    const name = (en.data() || {}).name || p.uid;
    const pm = (((prog.data() || {}).mods) || {})[p.mid] || {};
    const marked = ((((res.data() || {}).marks) || {})[p.mid] || {}).outcome;
    const r = p.result || {};
    let total = r.total, max = r.max_total, pass = 70, mc = '';
    if (pm.testAtt) {
      const att = pm.testAtt, a = (await db.doc('attempts/' + p.cid + '_' + p.uid + '_' + p.mid + '_' + att).get()).data() || {};
      const ver = a.ver || 'A', tk = p.cid + '_' + p.mid + '_' + ver;
      const [paper, keys, ans] = await Promise.all([db.doc('tests/' + tk).get(), db.doc('testkeys/' + tk).get(), db.collection('answers').where('cid', '==', p.cid).where('uid', '==', p.uid).where('mid', '==', p.mid).where('att', '==', att).get()]);
      const qs = (paper.data() || {}).questions || [], k = (keys.data() || {}).keys || {}, A = {};
      ans.docs.forEach(x => A[x.data().n] = x.data().a);
      pass = (paper.data() || {}).pass || 70;
      let auto = 0, autoMax = 0, wr = 0, wrMax = 0;
      qs.forEach(q => {
        if (q.type === 'WRITTEN') { const aq = (r.questions || []).find(x => x.n === q.n); wr += aq ? aq.mark : 0; wrMax += q.marks; }
        else { autoMax += q.marks; if (A[q.n] && k[q.n] && A[q.n] === k[q.n].answer) auto += q.marks; }
      });
      total = auto + wr; max = autoMax + wrMax; mc = ' (multiple choice ' + auto + '/' + autoMax + ' + written ' + wr + '/' + wrMax + ')';
    }
    const pct = max ? Math.round(total / max * 100) : 0;
    const sug = pm.testAtt ? (pct >= pass ? 'C' : 'NYC') + (r.recommendation === 'UNSURE' ? ' (AI unsure on written part)' : '') : r.recommendation;
    rows.push(name + ', ' + p.cid.toUpperCase() + ' ' + p.mid.toUpperCase() + ': ' + total + '/' + max + ' = ' + pct + '%' + mc + ', pass ' + pass + '% → suggested ' + sug + (marked ? '  [already marked ' + marked + ']' : ''));
  }
  console.log(rows.length ? rows.sort().join('\n') : 'No AI pre-marked tests found.');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
