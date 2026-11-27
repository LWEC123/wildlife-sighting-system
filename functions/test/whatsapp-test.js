// Test the WhatsApp alert (run in Google Cloud Shell, signed in as the project owner):
//
//   cd functions && node test/whatsapp-test.js
//
// Sends one test message to the assessor's WhatsApp using the CALLMEBOT_KEY and WHATSAPP_TO
// secrets, and says plainly whether it worked. No student data is sent.

const { execSync } = require('child_process');
const { sendWhatsApp } = require('../whatsapp');
const PROJECT = process.env.GCLOUD_PROJECT || 'lwec-field-logbook';
const secret = n => { try { return execSync('gcloud secrets versions access latest --secret=' + n + ' --project ' + PROJECT, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch (e) { return ''; } };

(async () => {
  const key = secret('CALLMEBOT_KEY'), to = secret('WHATSAPP_TO');
  if (!to) { console.log('✘ The WHATSAPP_TO secret is missing.'); process.exit(1); }
  if (!key) { console.log('✘ The CALLMEBOT_KEY secret is missing.'); process.exit(1); }
  const r = await sendWhatsApp(key, to, 'LWEC Learning Portal: test message. WhatsApp alerts for tests waiting for your Confirm are working.');
  if (r.ok) console.log('✔ Sent. Check WhatsApp on your phone for the test message.');
  else {
    console.log('✘ Not sent. CallMeBot said: ' + r.reply);
    console.log('  The key is probably wrong. Wait for the CallMeBot WhatsApp reply with your API key, then run:');
    console.log('    gcloud secrets versions add CALLMEBOT_KEY --data-file=- --project ' + PROJECT);
    console.log('  paste the key, press Enter, then Ctrl+D, and run this test again.');
  }
  process.exit(r.ok ? 0 : 1);
})().catch(e => { console.error('✘ ' + e.message); process.exit(1); });
