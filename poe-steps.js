/* LWEC Learning Portal: the "My to-do list" in every module.
   For each unit standard and module it says WHAT the student must do for their Portfolio of
   Evidence (PoE), HOW (a few words), and WHEN, in the order they do it.
   Every step links to something that already exists in the portal, so nothing new is stored:
     watch  the module video (ticked from the watch time already saved)
     test   the module test (ticked when handed in / competent)
     up     an upload into a PoE task slot (poe-defs.js item id). mod:true counts only uploads
            made from this module; min = how many files make it done.
     items  PoE forms the student fills in and signs (poe-defs.js item ids; labels = short button names)
     third  a feedback link for tourists or the mentor (X-CLIENT / X-MENTOR)
     wait   something staff do (assessor, facilitator); the student only waits for it
     log    the LWEC Field Logbook (separate app, signed by the mentor)
   Modules are keyed by their base number (m05 covers m05a…m05f).  Public file: no memos. */

const W = {t:'watch', ico:'🎬', what:'Watch the whole video', how:'Below, under 🎬 Module video.', when:'First'};
const T = {t:'test', ico:'📝', what:'Do the test and hand it in', how:'Below. Answer on screen, then press Hand in for marking.', when:'After the video'};
const START = {t:'items', ids:['L-POPIA','L-COND','L-NEEDS','L-SELF'], labels:['Privacy (POPIA)','Code of conduct','About me','Self-check'], ico:'✍️', what:'Sign your 4 start-up forms',
  how:'Press each button, fill in, sign with your finger.', when:'Before you start'};
const PLAN = {t:'items', ids:['L-PLAN'], ico:'🤝', what:'Accept your assessment plan',
  how:'Your assessor makes the plan. You read it and sign.', when:'When your assessor sends it'};

const BIO_SIGN = {t:'up', slot:'U-SIGNS', mod:true, min:1, ico:'🐾', what:'Photo 1 animal sign or sound',
  how:'A track, dung, nest or call. Take a photo or voice note with your phone, then press Upload.', when:'Next time you are outside'};
const LOG_DAY = {t:'log', ico:'📒', what:'Write your field day in the Field Logbook',
  how:'Date, place, what you saw. Your mentor signs it.', when:'The same day'};

const B12 = [
  {t:'items', ids:['L-DECL'], ico:'✋', what:'Sign: "This is my own work"', how:'Declaration of authenticity. Press the button and sign.', when:'Before the final test'},
  Object.assign({}, T, {what:'Do the final test and hand it in', when:'After you signed step 1'}),
  {t:'wait', ids:['A-ORAL'], ico:'📞', what:'Answer your assessor\'s questions', how:'Your assessor phones you or meets you and asks a few questions.', when:'After the final test'},
  {t:'up', slot:'U-VIDEO', min:1, ico:'🎥', what:'Film yourself guiding (5 to 10 min)', how:'Someone films you at one stop on your tour. Press Upload.', when:'On your practical tour day'},
  {t:'wait', ids:['A-OBS'], ico:'👀', what:'Your assessor watches your tour', how:'They tick a checklist while you guide. Nothing to upload.', when:'On your practical tour day'},
  {t:'third', ids:['X-CLIENT'], ico:'⭐', what:'Get 4 tourists to rate you', how:'Press Get link. Send it by WhatsApp, or let them scan the QR code.', when:'Right after the tour'},
  {t:'third', ids:['X-MENTOR'], ico:'🧑‍💼', what:'Get your mentor\'s report', how:'Press Get link and send it to your mentor or boss.', when:'After the tour'},
  {t:'items', ids:['L-REFL'], ico:'💭', what:'Say how your tour went', how:'What went well, what to do better. Fill in and sign.', when:'After the tour'},
  {t:'items', ids:['L-EVAL'], ico:'🗳️', what:'Tell us what you thought of the course', how:'A short form. Fill in and sign.', when:'At the end'},
  {t:'items', ids:['L-ACK'], ico:'🏁', what:'Read your result and sign', how:'Your assessor sends your result and feedback.', when:'When your assessor sends it'}
];

const BIOME = [W, BIO_SIGN, LOG_DAY, T];

export const POE_STEPS = {
  US335815: {
    m01: [START, PLAN, W, BIO_SIGN, LOG_DAY, T],
    m02: BIOME, m03: BIOME, m04: BIOME, m05: BIOME, m06: BIOME, m07: BIOME, m08: BIOME, m09: BIOME,
    m10: [W,
      {t:'up', slot:'U-PLAN', min:1, ico:'🗺️', what:'Plan your practical tour', how:'Tour plan, route map, risk list and equipment list. One Word or PDF file, or clear photos.', when:'Before your practical tour'},
      {t:'up', slot:'U-BRIEF', min:1, ico:'🗣️', what:'Write your welcome and safety talk', how:'One page: what you will say before the tour. A voice note is a bonus.', when:'Before your practical tour'},
      {t:'log', ico:'🚶', what:'Guide 5 groups (15 hours in total)', how:'Log each one in the Field Logbook. Your mentor signs each one.', when:'Start now. Finish before Module 12.'},
      T],
    m11: [W,
      {t:'up', slot:'U-FILE', min:1, ico:'📘', what:'Hand in your biome file', how:'Your own words about YOUR biome: map, plants, 10 species, food web, climate, parks. One Word or PDF file.', when:'Before Module 12'},
      {t:'up', slot:'U-SIGNS', min:10, ico:'🐾', what:'Have 10 animal signs or sounds uploaded', how:'Add more photos or calls if you have fewer than 10.', when:'Before Module 12'},
      T],
    m12: B12
  },
  US335802: {
    m01: [START, PLAN, W, T],
    m02: [W, T], m03: [W, T], m04: [W, T],
    m05: [W,
      {t:'log', ico:'📒', what:'Visit a heritage site in your province', how:'Log it in the Field Logbook with photos. Your mentor signs it.', when:'While you do this module'},
      T],
    m06: [W,
      {t:'up', slot:'U-SITE', min:1, ico:'🏛️', what:'Hand in your site research report', how:'One site: its story, 3 viewpoints, footprint map, protocol card. One Word or PDF file.', when:'Before Module 9'},
      T],
    m07: [W,
      {t:'log', ico:'🙏', what:'Ask the site\'s custodians for permission', how:'Write who you asked and what they said in your Field Logbook.', when:'Before your practical tour'},
      T],
    m08: [W,
      {t:'up', slot:'U-GROUP', min:1, ico:'👥', what:'Describe your tour group', how:'Who they are, what they need, what they like. One Word or PDF file.', when:'Before Module 9'},
      T],
    m09: [W,
      {t:'up', slot:'U-ITIN', min:1, ico:'🗓️', what:'Hand in your itinerary', how:'Day, time, place, activity. Meals, stops, contacts and a Plan B.', when:'Before your practical tour'},
      T],
    m10: [W,
      {t:'up', slot:'U-BRIEF', min:1, ico:'🗣️', what:'Write your briefing and risk check', how:'What you will say before the visit, and a risk table. A voice note is a bonus.', when:'Before your practical tour'},
      {t:'log', ico:'🚶', what:'Guide 5 groups (15 hours in total)', how:'Log each one in the Field Logbook. Your mentor signs each one.', when:'Start now. Finish before Module 12.'},
      T],
    m11: [W, T],
    m12: B12
  }
};
