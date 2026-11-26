// Offline test of the daily summary: node test/daily.test.js
const assert = require('assert');
const { buildSummary } = require('../daily');

const now = Date.parse('2027-02-10T05:00:00Z');       // 07:00 in South Africa
const H = 3600000, D = 24 * H;
const data = {
  enrol: [
    { uid: 'a1', name: 'Anet Scheepers', active: true },
    { uid: 'b2', name: 'Shaun Vrey', active: true },
    { uid: 'c3', name: 'Kyle Talbot', active: true },
    { uid: 'p9', name: 'Paused Person', active: false }
  ],
  progress: {
    us335815_a1: { lastSeen: now - 3 * H, mods: { m01: { submittedAt: now - 2 * D }, m02: { submittedAt: now - 5 * H } } },
    us335815_b2: { lastSeen: now - 3 * D, mods: { m01: { submittedAt: now - 4 * D } } },
    us335815_c3: { lastSeen: now - 10 * D, mods: {} },
    us335815_p9: { lastSeen: now - 1 * H, mods: { m01: { submittedAt: now - 1 * H } } }
  },
  results: {
    us335815_a1: { passed: {}, marks: {} },
    us335815_b2: { passed: { m01: true }, marks: { m01: { at: now - 1 * D } } }
  },
  premarks: {
    us335815_a1_m01: { status: 'done', forSub: now - 2 * D, result: { percent: 82 } },
    us335815_a1_m02: { status: 'done', forSub: now - 9 * D, result: { percent: 50 } }   // older hand-in
  },
  evidence: [
    { uid: 'a1', at: now - 2 * H }, { uid: 'a1', at: now - 4 * H, review: { status: 'accepted' } },
    { uid: 'b2', at: now - 3 * D }, { uid: 'p9', at: now - 1 * H }
  ],
  sessions: [{ uid: 'a1', last: now - 3 * H, start: now - 4 * H, sec: 1800 }],
  courses: {}
};
const s = buildSummary(data, now);
console.log(s.subject + '\n\n' + s.text + '\n');
assert.deepStrictEqual(s.counts, { waiting: 2, newEvidence: 2, toReview: 2, active: 1, quiet: 1, students: 3 });
assert.match(s.text, /Anet Scheepers, US335815 M01 · handed in 2 days ago · AI pre-mark ready \(82%\)/);
assert.match(s.text, /M02 · handed in today · mark yourself/);          // pre-mark was for an older hand-in
assert.match(s.text, /Shaun Vrey · 3 days ago · US335815 1\/12/);
assert.match(s.text, /Quiet for 7\+ days[\s\S]*Kyle Talbot/);
assert.match(s.text, /14 days left: Google Cloud free trial ends/);
assert.doesNotMatch(s.text, /Paused Person/);
assert.ok(!buildSummary(data, Date.parse('2026-12-01T05:00:00Z')).text.includes('free trial'));   // >30 days before
console.log('daily summary test: OK');
