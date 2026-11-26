// Offline test of the daily summary: node test/daily.test.js
const assert = require('assert');
const { buildSummary, buildMonitorCsv, monitorCids } = require('../daily');

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

// Student monitor spreadsheet: same columns as the portal's CSV export.
data.enrol[0].paused = {};
data.progress.us335815_a1.current = { mid: 'm02', item: 'sheet', at: now - 5 * H };
data.progress.us335815_a1.totalSec = 3600;
data.progress.us335815_a1.mods.m03 = { opened: { guide: now } };
data.agree = { a1: { at: now - 5 * D } };
const f = buildMonitorCsv(data, 'us335815', now);
assert.strictEqual(f.name, 'LWEC-student-monitor-US335815-2027-02-10.csv');
const rows = f.csv.slice(1).split('\r\n').map(r => JSON.parse('[' + r + ']'));
console.log(rows.map(r => r.join(' | ')).join('\n'));
assert.strictEqual(rows[0].length, 11 + 12);
assert.deepStrictEqual(rows[0].slice(0, 7), ['Student', 'Email', 'Access', 'Agreement signed', 'Last on', 'Busy with', 'Modules competent']);
const anet = rows.find(r => r[0] === 'Anet Scheepers');
assert.deepStrictEqual([anet[2], anet[3], anet[5], anet[6], anet[7], anet[8], anet[9], anet[10]], ['on', '05 Feb 2027', 'Module 2 · Answer sheet (5 h ago)', '0', '2', '30', '60', '1']);
assert.deepStrictEqual(anet.slice(11, 14), ['Handed in', 'Handed in', 'Started']);
assert.strictEqual(rows.find(r => r[0] === 'Paused Person')[2], 'paused');
assert.strictEqual(rows.find(r => r[0] === 'Shaun Vrey')[11], 'Competent');
assert.deepStrictEqual(monitorCids({ us335802: { published: false } }), ['us335815']);
assert.deepStrictEqual(monitorCids({ us335802: { published: true, nmods: 12 } }), ['us335802', 'us335815']);
console.log('daily summary test: OK');
{
  const { buildStaffLogCsv } = require('../daily');
  const g = buildStaffLogCsv([
    { at: now - 2 * D, name: 'Zeriah Wessels', email: 'z@x', cid: 'us335815', title: 'Module 1: The Savanna Biome · Learner guide', tier: 'course' },
    { at: now - 1 * H, name: 'Diederick', email: 'd@x', cid: 'us335802', title: 'M12 memo', tier: 'conf' }
  ], {}, now);
  const r = g.csv.slice(1).split('\r\n').map(x => JSON.parse('[' + x + ']'));
  assert.strictEqual(g.name, 'LWEC-staff-access-log-2027-02-10.csv');
  assert.deepStrictEqual(r[0], ['Date and time', 'Name', 'Email', 'Unit standard', 'File', 'Section']);
  assert.deepStrictEqual(r[1], ['2027/02/10, 06:00:00', 'Diederick', 'd@x', 'US335802', 'M12 memo', 'Confidential']);
  assert.strictEqual(r[2][5], 'Course material');
  console.log('staff log test: OK');
}
