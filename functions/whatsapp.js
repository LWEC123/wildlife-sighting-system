// WhatsApp message to the assessor's own number through CallMeBot (free, personal use).
// Returns { ok, reply }. ok is false when CallMeBot rejects the key or number.

async function sendWhatsApp(key, to, text) {
  key = String(key || '').trim(); to = String(to || '').replace(/[^\d]/g, '');
  if (!key || key === 'none' || !to) return { ok: false, reply: 'not set up' };
  const url = 'https://api.callmebot.com/whatsapp.php?phone=%2B' + to + '&text=' + encodeURIComponent(text) + '&apikey=' + encodeURIComponent(key);
  const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
  const reply = (await res.text()).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300);
  return { ok: res.ok && /queued|sent|success/i.test(reply) && !/invalid|error|not\s+(?:valid|activated)/i.test(reply), reply };
}

module.exports = { sendWhatsApp };
