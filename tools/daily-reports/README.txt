LWEC Learning Portal: daily reports

Every morning the portal saves two spreadsheets for CATHSSETA (monitoring evidence):
  Student monitor   - the same as 'Download as spreadsheet (CSV)' on the Student monitor page
  Staff access log  - the same as 'Download the log (spreadsheet)' on the Staff resources page

This computer copies them into the 'Student monitor' and 'Staff access log' folders next to this one
every day at 07:30 (or when the computer is next switched on). OneDrive keeps them backed up.
The same files also arrive as attachments on the 07:00 email.

Switch on: double-click Switch-on.cmd once. It runs straight away and then daily.
Check: download-log.txt shows each run.
Switch off: Start menu > Task Scheduler > Task Scheduler Library > 'LWEC daily reports download' > Delete.

Keep get-reports.ps1 private: it contains the key that lets this computer fetch the reports.
