// Emulator-only stand-in for Claude in the help chat (HELP_FAKE=1): costs nothing.
// "reset <email>" -> uses send_portal_password_reset, "person" -> escalates, anything else -> a fixed answer.
module.exports = async function fakeHelpClaude(p) {
  const last = p.messages[p.messages.length - 1];
  if (Array.isArray(last.content)) return { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Done: ' + last.content.map(r => r.content).join(' ') }] };
  const t = String(last.content), em = (t.match(/[^\s<>]+@[^\s<>]+/) || [])[0];
  if (/reset/i.test(t) && em) return { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 't1', name: /website/i.test(t) ? 'send_website_password_reset' : 'send_portal_password_reset', input: { email: em } }] };
  if (/person/i.test(t) && em) return { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 't2', name: 'escalate_to_college', input: { student_name: 'Test Student', student_email: em, student_phone: '', problem: 'Wants a person.', urgent: false } }] };
  return { stop_reason: 'end_turn', content: [{ type: 'text', text: 'On the Sign in box click "Forgot your password?".' }] };
};
