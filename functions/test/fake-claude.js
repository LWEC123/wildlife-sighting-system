// Stand-in for Claude in local emulator tests: records what would be sent and returns
// a fixed, plausible marking result.
const fs = require('fs');
module.exports = async (memo, work) => {
  const summary = { memo: { kind: memo.kind, name: memo.name, chars: (memo.text || '').length, head: (memo.text || '').slice(0, 300) },
    work: work.map(b => b.type === 'text' ? { type: 'text', chars: b.text.length, head: b.text.slice(0, 300) } : { type: b.type, media: b.source.media_type, bytes: Math.round(b.source.data.length * 3 / 4) }) };
  fs.writeFileSync(process.env.PREMARK_FAKE_LOG || '/tmp/premark-fake.json', JSON.stringify(summary, null, 2));
  return { model: 'fake-model', usage: { in: 1, out: 1 }, result: {
    version: 'A', questions: [
      { n: 1, max: 2, mark: 2, student_answer: 'B', comment: 'Correct.', confidence: 'high' },
      { n: 2, max: 4, mark: 2.5, student_answer: 'Heritage is what we inherit…', comment: 'Two of three key points.', confidence: 'medium' },
      { n: 3, max: 4, mark: 9, student_answer: '(hard to read)', comment: 'Handwriting unclear.', confidence: 'low' }],
    total: 99, max_total: 10, percent: 99, recommendation: 'C', good: 'Good definitions.', fix: 'Q3: explain grading.', notes: 'Page 2 is blurred.' } };
};
