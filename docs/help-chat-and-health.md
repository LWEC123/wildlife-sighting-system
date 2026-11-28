# Student help chat and daily website check

## What it does
**💬 Help chat** (bottom-right bubble on the Learning Portal and on limpopowildlifeecocollege.com)
- Answers common problems from LWEC's own guides (`functions/help-kb.js`): signing in, passwords,
  access codes, the learner agreement, handing in a test, videos, evidence uploads, website sign-up.
- Safe self-service fixes, done for the email the student types:
  - portal password-reset link (Firebase), sent from the college Gmail
  - website password-reset email (WordPress "Forgot password")
  - website "Confirm my email" link (only the mailbox owner can use it)
  - "does a website account with this email exist / is it confirmed" (yes/no only)
  The student gets the same answer whether or not an account exists.
- Everything else goes to the assessor: an email with the student's name, contact, problem and the
  whole chat (reply-to = the student), plus a WhatsApp alert through CallMeBot **without** names.
- Never gives test answers, marks or memo content, never asks for passwords or codes.
- Limits: 60 messages per device address a day, 600 a day in total, 3 reset/confirm emails per
  address a day, 2 hand-overs per chat. Uses Claude (`claude-opus-5-5`, low effort). Rough cost:
  well under USD 0.05 per question.
- Chats are kept in Firestore `helpchats/`, hand-overs in `helpdesk/` (no browser can read either:
  the rules have no match for them, so **no rules change is needed**).

**🩺 Daily website check** (top of the 07:00 summary email)
- Learning Portal page up? College website up?
- Can the website send email? (the LWEC helper snippet records every sent/failed website email; if
  nothing was sent for 20 hours it sends one small test email to the site's admin address)
- Stuck website sign-ups (email not confirmed) and duplicate accounts.
- How many students the help chat handed to you in the last 24 hours.
- Fixes by itself: each stuck sign-up (12 hours to 10 days old) gets ONE fresh "Confirm my email"
  link, at most 5 a day. Nothing is ever deleted.
- The subject line gets "⚠️ website problem" when something is wrong.

## How the website and the portal trust each other (no password)
The website endpoints (`/?rest_route=/lwec/v1/...`) accept only a Google-signed identity token of
the `lwec-field-logbook` Cloud Functions service account, for the audience
`https://limpopowildlifeecocollege.com`. The snippet checks Google's signature itself. Nothing secret
is stored on the website or typed by anyone.

## Switch it on

### Step 1. Cloud Shell (about 5 minutes)
Open https://shell.cloud.google.com (signed in as the college Google account) and paste:
```bash
cd ~ && rm -rf wildlife-sighting-system && git clone https://github.com/LWEC123/wildlife-sighting-system.git && cd wildlife-sighting-system
git checkout claude/project-thread-kc8ysa          # skip this line once the pull request is merged
cd functions && npm ci && cd ..
firebase deploy --only functions:helpChat,functions:dailySummary --project lwec-field-logbook
```
If it asks to delete other functions, type **N**. When it says `Deploy complete!`, reply "merge NN".

### Step 2. WordPress (about 5 minutes, in WP Admin)
1. **Plugins › Add New Plugin**. In the search box type `Code Snippets`. On the card "Code Snippets"
   (by Code Snippets Pro) click **Install Now**, then **Activate**.
2. In the left menu click **Snippets › Add New**.
3. Title: `LWEC helper`.
4. Open https://raw.githubusercontent.com/LWEC123/wildlife-sighting-system/main/wordpress/lwec-helper.php
   in a new tab, press **Ctrl+A**, **Ctrl+C**, go back to the snippet, click in the big code box,
   press **Ctrl+V**.
5. Under the code box choose **Run snippet everywhere**.
6. Click **Save Changes and Activate**.
7. Check: **Tools › LWEC helper** opens a page with "LWEC helper 1.0". Tell Claude "helper is on".

Claude then reads that page to see how Tutor LMS Pro marks unconfirmed emails on this site, and gives
you one line to change in the snippet (`LWEC_VERIFY_KEY`). Until then the help chat and the daily check
already work; only the "Confirm my email" links and "Mark email verified" wait for that line.

### Step 3. Test
- Open the portal (Ctrl+Shift+R), click **💬 Help**, click **I forgot my password**.
- Run the daily email now:
  `gcloud scheduler jobs run firebase-schedule-dailySummary-europe-west1 --location europe-west1 --project lwec-field-logbook`

## Files
- `functions/help.js`, `functions/help-kb.js`: the chat (tools, limits, hand-over)
- `functions/health.js`, `functions/wpclient.js`: the daily check and the website caller
- `functions/index.js`: `helpChat` endpoint (africa-south1) and the check inside `dailySummary`
- `help/lwec-help-chat.js`: the bubble (portal and website)
- `wordpress/lwec-helper.php`: the website snippet; `wordpress/test/token-test.php`
- Tests: `cd functions && node test/help.test.js`, `php wordpress/test/token-test.php`
