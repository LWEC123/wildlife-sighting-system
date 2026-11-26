# Publishing rules safely

Never paste old rules files into Firebase. Each script here fetches the rules that are LIVE
right now, adds only its own part, shows the difference and publishes. Running a script twice
does nothing the second time.

- `deploy-rules.sh` + `ai-*.part`: AI pre-marking (premarks, memos, aiconsent, memos/ folder).
- `deploy-staff-rules.sh` + `staff-*.part`: Staff resources tab (staffdocs, staffviews, staff/
  folder) and sets the role 'assessor' on limpopowt@gmail.com's staff record.

Staff roles live in Firestore `mentors/<uid>.role`: `facilitator` (or no role), `assessor`,
`moderator`. Facilitators see course material and Facilitator documents; assessors and
moderators also see the confidential Assessor CONF files and the access log. A staff login
that also has a student enrolment sees no staff resources.

Run in Google Cloud Shell, signed in as limpopowt@gmail.com:

    cd ~ && rm -rf wss && git clone -q https://github.com/LWEC123/wildlife-sighting-system.git wss && bash wss/rules-live/deploy-staff-rules.sh
