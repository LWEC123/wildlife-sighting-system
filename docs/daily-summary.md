# Daily summary email

Every morning at **07:00 South African time** the Cloud Function `dailySummary` emails the
assessor (limpopowt@gmail.com) one short summary of the LWEC Learning Portal:

- **To mark**: tests handed in and not yet marked, oldest first, and whether the AI pre-mark is ready
- **Evidence**: files uploaded in the last 24 hours, and how many still need Accept / Needs correction
- **Students**: who worked in the last 24 hours (minutes and modules competent), who has been quiet for 7+ days
- **Reminders**: dates to act on (now: the Google Cloud free trial ends 24 Feb 2027; shown from 30 days before)

Attached to the email, and saved every day in Storage `reports/` (no browser can read it), are two
spreadsheets for CATHSSETA monitoring evidence:
- `student-monitor/US335815/LWEC-student-monitor-US335815-YYYY-MM-DD.csv`: the same columns as
  "Download as spreadsheet (CSV)" on the Student monitor page (one file per published unit standard)
- `staff-access-log/LWEC-staff-access-log-YYYY-MM-DD.csv`: the same as "Download the log (spreadsheet)"
  on the Staff resources page (who opened which staff file, all entries)

The college computer copies them into OneDrive every day (see "Daily download to OneDrive" below).

The subject line gives the numbers, e.g. `Portal today: 2 to mark, 3 new uploads, 4 active`.

## Safe by design
- The function only reads Firestore (`enrol`, `progress`, `results`, `premarks`, `evidence`, `sessions`,
  `courses`, `agree`, `choice`, `staffviews`) and writes only the two spreadsheets to Storage `reports/`.
- It never reads `memos`, `testkeys` or `answers`, and it drops student answers, drafts, AI comments and
  feedback text as soon as it loads a document. The email has names, module numbers, dates, counts and
  the AI percentage only.
- It reuses the `GMAIL_APP_PASSWORD` secret that the AI pre-marking emails already use. No new keys.
- Cloud Scheduler does not run in africa-south1, so this one function runs in **europe-west1**
  (Belgium). The data stays in Firestore in Johannesburg; the function only reads it to build the email.
- Cost: one run a day is far inside the free allowance (Cloud Scheduler gives 3 free jobs per account).

## Switch it on (once, about 5 minutes)
In **Google Cloud Shell** (https://shell.cloud.google.com, signed in as limpopowt@gmail.com):

```bash
cd ~ && rm -rf wildlife-sighting-system && git clone https://github.com/LWEC123/wildlife-sighting-system.git && cd wildlife-sighting-system
git checkout claude/project-thread-hzqvsk          # or skip this line once the pull request is merged
cd functions && npm ci && cd ..
firebase deploy --only functions:dailySummary,functions:monitorReports --project lwec-field-logbook
```
If it asks to enable the Cloud Scheduler API, type `y` and press Enter.

Send a test email right away (instead of waiting for 07:00):
```bash
gcloud scheduler jobs run firebase-schedule-dailySummary-europe-west1 --location europe-west1 --project lwec-field-logbook
```

## Daily download to OneDrive
`monitorReports` (africa-south1, HTTPS) lets one computer fetch the saved spreadsheets. It answers only
requests that carry the right key in the `x-lwec-key` header; the code holds only the key's SHA-256, and
the key itself is only in `get-reports.ps1` on the college computer. It serves only files named like the
two reports above, from the last 60 days.

`tools/daily-reports/` has the Windows files (the real key replaces `__KEY__` on the computer):
`get-reports.ps1` (download any missing days), `install.ps1` + `Switch-on.cmd` (create the Windows task
"LWEC daily reports download", daily 07:30 or when the computer is next on) and `README.txt`.
They live in OneDrive at `Tourist Guiding 71549\09 STUDENTS\00 Daily reports\_download`, and the
reports land in `..\Student monitor` and `..\Staff access log`.

To change the key: put a new random key in `get-reports.ps1` on the computer and its SHA-256 in
`MONITOR_KEY_SHA256` in `functions/index.js`, then deploy `functions:monitorReports`.

## Change it
- Time: `schedule` in `functions/index.js` (`'0 7 * * *'` = 07:00 every day; `'0 7 * * 1-5'` = weekdays).
- Reminders: the `REMINDERS` list at the top of `functions/daily.js`.
- Stop it: `firebase functions:delete dailySummary --region europe-west1 --project lwec-field-logbook`
  (and `monitorReports --region africa-south1` for the download).

## Tests
```bash
node functions/test/daily.test.js        # offline, no Firebase needed
MONITOR_KEY=<key> firebase emulators:exec --config firebase.test.json --project demo-lwec --only functions,firestore,storage "node functions/test/daily-emulator-check.js"
```
