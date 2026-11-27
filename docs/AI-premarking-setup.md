# AI pre-marking: setup and going live

The AI suggests marks; the registered assessor decides. When a student hands in a module test
(answer sheet in Word, PDF or photos, typed answers, or the written questions of an online test),
a Cloud Function sends the work and the assessor memo to Claude (`claude-opus-5-5`) and saves
suggested marks, comments and a Competent / Not yet competent recommendation in
`premarks/<cid>_<uid>_<mid>` (staff only). The assessor gets an email, checks the marks on the
Marking page, edits them, and clicks Competent or Not yet competent. Only that decision counts
and goes into the PoE; the record also keeps what the AI suggested and how many marks the
assessor changed.

## What is in the repo

| Part | Where |
| --- | --- |
| Cloud Functions `premarkOnHandIn` (on hand-in) and `premarkNow` (staff button) | `functions/index.js`, `functions/premark.js` |
| Marking page: AI table, "Copy the AI feedback", "Run AI pre-mark again", memo upload, 🤖 count on the Marking tab | `LWECCourses.html` |
| Student notice (learner agreement clause 7 and a line on the course page) | `LWECCourses.html` |
| Rules: `premarks` (staff read, server write), `memos` (staff), `aiconsent` (old opt-in records, no longer used), Storage `memos/` (nobody can read from a browser) | `firestore.rules`, `storage.rules` |
| Local tests with the Firebase emulator and a stand-in for Claude | `functions/test/` |

## One-time setup (Zeriah)

### 1. Claude API key and credit (about 10 minutes)
1. Go to **https://console.anthropic.com** and sign in (or sign up) with limpopowt@gmail.com.
2. Left menu **Settings › Billing**: add a card and buy credit. **USD 10 is plenty to start** (see cost below). Leave auto-reload **off** so it can never spend more than you put in.
3. Left menu **API keys › Create key**. Name it `LWEC portal marking`. Click **Copy**. The key starts with `sk-ant-` and is shown only once: paste it into Notepad for step 4. **Do not send it in a chat or email.**

### 2. Gmail app password for the notification emails (about 5 minutes)
1. Go to **https://myaccount.google.com/security** (signed in as limpopowt@gmail.com). Under "How you sign in to Google", make sure **2-Step Verification** is **On**.
2. Go to **https://myaccount.google.com/apppasswords**. App name: `LWEC portal`. Click **Create**.
3. Copy the 16-letter password into the same Notepad. (It only lets the portal send email as limpopowt@gmail.com; you can delete it there at any time.)

### 3. Switch Firebase to the Blaze plan (about 5 minutes)
Cloud Functions need the pay-as-you-go **Blaze** plan. The free allowance stays; at this size the Firebase part should cost nothing or a few cents a month.
1. Go to **https://console.firebase.google.com**, open **lwec-field-logbook**.
2. Bottom of the left menu: next to **Spark**, click **Upgrade** › **Blaze** › choose or create a billing account (card) › **Continue**.
3. When it offers a **budget alert**, set **USD 5**. You get an email if it ever gets near that.

### 4. Deploy (Claude can do this with you)
In **Google Cloud Shell** (https://shell.cloud.google.com, signed in as limpopowt@gmail.com, it has the Firebase tools built in). The database is in africa-south1 (Johannesburg), so the functions run there too:

```bash
git clone https://github.com/LWEC123/wildlife-sighting-system.git && cd wildlife-sighting-system
git checkout claude/project-thread-61ga44          # or main, once the pull request is merged
gcloud firestore databases describe --database='(default)' --project lwec-field-logbook --format='value(locationId)'
# If that does not say nam5 or us-central1, change REGION in functions/index.js and FN_REGION in
# LWECCourses.html to the matching functions region before deploying.
firebase use lwec-field-logbook
firebase functions:secrets:set ANTHROPIC_API_KEY     # paste the sk-ant- key when asked (it stays hidden)
firebase functions:secrets:set GMAIL_APP_PASSWORD    # paste the 16-letter app password
cd functions && npm ci && cd ..
firebase deploy --only functions
```

### 5. Rules
Paste the two files from the project folder **learning-portal/ai-premarking/** into the Firebase console:
- `firestore-rules.txt` → **Firestore Database › Rules** › select all › paste › **Publish**
- `storage-rules.txt` → **Storage › Rules** › select all › paste › **Publish**

(Those files are the rules that are live now plus the AI part, so nothing else changes.)

### 6. Memos for answer sheets
Marking page › **🤖 Memos for AI pre-marking** › choose the unit standard › choose all files in
`05 Answers › Assessor CONF` › **Upload memos**. Online tests already have their memos (from the
imported test files), so they work without this step.

## Cost
Claude Opus 5.5 costs USD 4 per million input tokens and USD 20 per million output tokens.
One answer sheet (memo plus 2 to 4 photographed pages, or a Word/PDF file) is roughly 8,000 to
20,000 input tokens and 3,000 to 8,000 output tokens (marks, comments and the AI's own checking),
so **about USD 0.10 to 0.30 (roughly R2 to R6) per test**. Eleven students doing all 17 tests of
US 335802 is about 190 tests, **about USD 20 to 55 for the whole unit standard**. Typed online-test
answers are cheaper. Firebase (functions, email trigger) stays within the free allowance at this size.

## POPIA
Every hand-in is pre-marked; students do not choose who marks. They are told in clause 7 of the
learner agreement and in a line on their course page that an AI tool (Claude, by Anthropic) reads
their hand-ins to suggest marks, that the assessor makes every decision, and that the work may be
processed outside South Africa (POPIA s18 notice; s72 transfer needed for their training). Anthropic
does not train on API data and keeps it only for a limited time. Memos sit in Storage `memos/`,
which no browser can read; only the function reads them.

## Testing locally
```bash
cd functions && npm ci && cd ..
PREMARK_FAKE=1 firebase emulators:exec --config firebase.test.json --project demo-lwec \
  --only functions,firestore,storage "node functions/test/emulator-check.js"
```
`PREMARK_FAKE=1` swaps Claude for `functions/test/fake-claude.js`, so tests cost nothing.
`functions/test/ui-check.js` drives a copy of the portal wired to the emulators with Playwright.

## WhatsApp alerts (optional)

Each pre-marked test also sends a short WhatsApp message to the assessor's own number through
CallMeBot (free). It has no student names, only the course, module and the Marking page link.
Secrets: `CALLMEBOT_KEY` (the key CallMeBot sends you on WhatsApp) and `WHATSAPP_TO` (your number,
e.g. 2782...). Test it with `cd functions && node test/whatsapp-test.js`.
