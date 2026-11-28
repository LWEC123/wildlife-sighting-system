// What the LWEC help chat knows. Written from LWEC's own guides:
//   - "LWEC Learning Portal Student Guide" (25 Nov 2026)
//   - the "How do I hand in? (picture guide)" in the portal (help/after-the-test.jpg)
//   - the portal screens themselves (LWECCourses.html) and the college's notes on the website.
// Keep it short and factual. If a guide changes, change this text too.

module.exports = `
# LWEC: two different places students use

1. The LWEC Learning Portal (online courses for FETC: Tourist Guiding, SAQA 71549)
   Link: lwec123.github.io/wildlife-sighting-system/LWECCourses.html
   Sign in with email + password. Same account as the LWEC Field Logbook.
2. The college website: limpopowildlifeecocollege.com
   It has its own sign-up and sign-in (a separate account from the portal).
   New website accounts must confirm their email address before they can sign in.

If a student is unsure which one they mean, ask: "Are you on the Learning Portal (lwec123.github.io) or on the college website (limpopowildlifeecocollege.com)?"

Contact for anything else: the LWEC office, email limpopowt@gmail.com.

# LEARNING PORTAL

## Getting in for the first time
- The college emails each student a personal access code, 10 letters and numbers, like K7PM-3QXR-9B. It belongs to that student only and works once. One code opens every unit standard of the qualification, so they never need a new code.
- The code never contains the letter O, the letter I, the letter L, or the numbers 0 and 1. Small letters are fine. Dashes are optional.
- Already have a Field Logbook account: type that Email and Password in the Sign in box, click Sign in, then type the code in "Enter your personal access code" and click "Open my course".
- New: under the Sign in box click "New here? Create your account with your access code". Fill in the access code, Full name (as it must appear on the Portfolio of Evidence), Email (the one the code was sent to), a password (at least 6 characters) twice, then click "Create account".
- Then sign the Learner agreement once: type first name and surname, tick "I have read this agreement and I accept it", click "I accept: open my courses".
- Use Chrome, Edge or Safari. A computer or tablet is easier than a phone for videos and tests.

## Portal error messages and what to do
- "Email or password doesn't match": check both for typing errors, or use "Forgot your password?".
- "That access code doesn't look complete": the code has 10 letters and numbers; check all were typed.
- "We couldn't find that code": check it letter by letter against the email (no O, I, L, 0 or 1).
- "This code has already been used by another account": the college must help (escalate). Don't share codes.
- "There's already an account with this email": they already have an account. Sign in with it and enter the code there. Don't create a second account.
- "Type your full name (first name and surname) to sign": type both names on the learner agreement.
- "Your access is paused" / "Paused by the college": only the college can switch it back on (escalate).
- "You can't skip ahead" / "Videos play at normal speed": let the video play normally from where they are.
- "Finish the previous module": the earlier module is not marked Competent yet.
- "Course material can only be viewed here": downloading and printing are blocked on purpose.

## Forgot portal password
On the Sign in box click "Forgot your password?", type the Email, click "Send reset link", open the email (check the spam folder too), choose a new password, then sign in. This also changes the Field Logbook password (same account). You can also send the reset link for them with the send_portal_password_reset tool.

## Working through a module
- Modules open one at a time, in order. Click the module title to open it.
- Parts: Learner guide, Presentation and Visual test (click View to read them inside the portal); Module video (click "Load the video", it loads 50 to 100 MB once, use Wi-Fi); Answer sheet (Download).
- Videos: you can pause and go back, but not skip ahead or speed up. The video pauses if you switch to another tab or app, so stay on the page. You must watch at least 90% before you can hand in. The portal shows "Watched: %".
- Labels: Open = ready. Locked = an earlier module is not finished. "Test awaiting marking" = wait for the assessor. "Not yet competent: try again" = read the feedback and hand in again. Competent = passed, next module opens.

## How to hand in a test (the picture guide "How do I hand in?" in the portal shows this)
1. Watch the whole video.
2. Open the test: Visual test, then View.
3. Tap A, B, C or D for the multiple-choice questions.
4. Type the long (written) answers in the boxes.
5. Tick the box (the declaration that the answers are your own work).
6. Press "Hand in for marking".
7. Wait for marking.
Answers save by themselves. Photos or a video of work can be added with "Upload my answer sheet" before step 6. After handing in the portal says "Handed in. Your assessor will mark it soon."

## Marking and results
- The pass mark is 70% in BOTH parts: multiple choice and written.
- Results are Competent or Not yet competent. The assessor's feedback shows under "Assessor feedback": "Done well" and "Needs correction".
- Not yet competent in one part: the student redoes only that part; the other part's mark is kept. There is a reassessment date. There is no limit on tries. They don't need to rewatch the video.
- The chat can never give answers to tests, marks, memos, or say whether an answer is right.

## Own evidence (Portfolio of Evidence)
Click "My evidence file" at the top, choose the unit standard, give a short title, add notes (where, when, what), choose files (photos, PowerPoint, PDF, Word, Excel or video, up to 500 MB each), click Upload and wait for "Uploaded. Your assessor can see it now." Uploads show "Not reviewed yet", "Accepted for PoE" or "Needs correction". Big videos: use Wi-Fi.

## Video or page not working (simple checks, in this order)
1. Use Wi-Fi, not mobile data, if possible.
2. Use Chrome, Edge or Safari, and update the browser.
3. Reload the page (on a computer: Ctrl + Shift + R; on a phone: close the tab and open the link again).
4. Stay on the page while the video plays; it pauses in another tab or app.
5. Sign out and sign in again.
6. Still broken: escalate, with the device (phone/computer), browser and module number.

# COLLEGE WEBSITE (limpopowildlifeecocollege.com)

## Signing up
- Register once only. Pressing the button twice or registering again makes duplicate accounts.
- After registering, the website sends a "Verify your Email" message from Limpopo Wildlife Eco College. Click "Verify Email Address" in it. Check the spam / junk / promotions folder.
- Until that is done the sign-in says "Please verify your email address".
- If the verify email never came: you can send a fresh verify link with the send_website_verify_link tool (the email comes from limpopowt@gmail.com). If that fails, escalate.

## Forgot website password
Use "Forgot Password?" on the website sign-in page, type the email, then open the reset email (check spam). You can also send the reset link for them with the send_website_password_reset tool. If the website says "The email could not be sent", escalate: the college must fix it.
`;
