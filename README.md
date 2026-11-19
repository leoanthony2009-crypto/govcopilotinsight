# GovernorBrief – IDSR briefing for governors

Turns a school's Ofsted Inspection Data Summary Report (IDSR) into a one-page governor briefing, a full briefing with an evidence trail, and an editable Word document.

**Status:** pilot, version 3.4. Checked against the IDSR release of 25 September 2026, mainly on primary-school data. Secondary handling has had little testing; special schools are not yet supported.

## How it works

- **Rule-based. No AI.** Fixed rules read the IDSR tables; the same file always gives the same briefing.
- **No upload.** The IDSR file is read in the browser and never sent anywhere. The site has no storage and no analytics. The only things the site ever sends are the workshop enquiry form on `/contact` and the briefing sign-up form on `/subscribe` (an email address), which both go to Netlify Forms.
- **Traceable.** Every headline points to its IDSR row in the evidence trail, and a data-coverage appendix lists what was read, what was missing and what to check by hand.
- **Fails loudly.** If the expected tables or columns are not found, no briefing is produced. An IDSR released after the last checked release loads with a warning.

## Files

| File | What it holds |
| --- | --- |
| `index.html` | Landing page at `/`: headline, the three offers (Read, Prepare, Develop), about and closing call to action |
| `idsr.html` | The IDSR briefing tool at `/idsr`: page markup and styles. Netlify serves `idsr.html` at the clean address `/idsr` |
| `idsr-signup.html`, `idsr-signed-up.html` | Sign-up step for the tool. `/idsr-signup` is a Netlify form (`idsr-signup`: name, email, school or trust, role, a required confirmation of authorised use, an optional tick for pilot emails). `/idsr-signed-up` is shown after it is sent and saves a marker (`gb-idsr-signup`, holding only the date) in the browser's local storage. The tool hides its file chooser until that marker is present; the example school stays open. This is a sign-up step, not access control: anyone can set the marker by hand. The form lives on its own page because the tool page is forbidden from submitting forms. Submissions appear under Forms in Netlify; check that email notifications cover this form |
| `briefs/index.html`, `briefs/assurance-or-information.html`, `briefs/using-ai-safely.html`, `briefs/keeping-good-staff.html` | The 3 Minutes Before the Meeting series at `/briefs/`, and briefings 01 to 03. Titles not yet written are listed as forthcoming, never as links |
| `contact.html`, `enquiry-sent.html` | Workshop enquiry at `/contact`, using Netlify Forms (form name `enquiry`, with a hidden spam-trap field; `/contact?type=workshop` chooses the enquiry type in advance). After a submission Netlify shows `/enquiry-sent`; that page can also be opened directly, so it says "submitted", not "received". The local test server cannot imitate Netlify's spam filter or notifications |
| `subscribe.html`, `subscribed.html` | Sign-up for new briefings by email at `/subscribe`, using Netlify Forms (form name `briefing-updates`, one email field and the same hidden spam-trap field). After a submission Netlify shows `/subscribed`. Sign-ups are only collected: nothing is emailed automatically, so each new briefing has to be sent to the list by hand, and anyone who asks to stop has to be removed by hand. Check that Netlify's form notification covers this form as well as `enquiry` |
| `google25717b871bec80ca.html` | Proves ownership of the site to Google Search Console. Do not delete it |
| `core.js` | Parser, analysis rules and the two on-screen briefings |
| `app.js` | Word export and page behaviour |
| `sample.js` | The example school. **Every school figure in it is invented.** National comparison figures are published statistics |
| `vendor/docx-9.5.1.iife.js` | The Word library (MIT licence, see `vendor/docx-LICENSE.txt`), hosted with the site so nothing loads from a third party |
| `method.html` | Method note: every rule in words, with one headline traced from the IDSR row to the sentence |
| `sample-briefing-one-page.pdf`, `sample-briefing-full.pdf` | Sample briefings for the invented example school. Rebuild with `node tests/make-sample.cjs` after any change to the briefing |
| `_headers` | Security headers for Netlify, including the content security policy |
| `_redirects` | Forwards the old `govcopilot.netlify.app` address to `governorbrief.co.uk`, and returns "not found" for the tests folder, this README and the `.claude` and `.agents` folders |
| `.claude/skills/` | Marketing skills that Claude loads when working in this repository (copywriting, SEO, launch, pricing and others), copied from `coreyhaines31/marketingskills` under the MIT licence. Development files, not part of the public site. See `.claude/skills/README.md` |
| `robots.txt`, `sitemap.xml` | Tell search engines which pages to index |
| `404.html` | The "page not found" page |
| `link-preview.png` | The picture shown when the site's link is shared |
| `site.webmanifest`, `favicon.*`, `icon-*.png`, `apple-touch-icon.png`, `logo-*.svg` | App name, icons and logos. `logo-lockup-white.svg` is the symbol, name and strapline in white, used on the midnight-teal page header and the footer; `logo-header-*.svg` is the symbol and name without the strapline, for documents; `logo-mark*.svg` is the symbol alone. `favicon.svg` is a separate drawing of the symbol on a 32-pixel grid, so its straight lines stay sharp in a browser tab. The B is digital teal on light backgrounds and brass on dark ones. The logos are sized in the page at whole pixels (322 x 56 in the header and footer, 253 x 44 on phones); the browser tests check this, so change the sizes in `site.css` and `idsr.html` together and re-run them |
| `brand/` | Logo kit for documents and promotional material: `logo-usage.pdf` (one-page guide to clear space, minimum sizes and colour; `logo-usage.html` is its source, printed to PDF from a browser), the name-only logo, ready-to-place PNGs in `brand/png/`, and one-colour versions for single-colour printing in `brand/mono/` |
| `tests/make-logo.py` | Rebuilds every logo, icon and brand PNG from one definition: `python3 tests/make-logo.py` (needs `fonttools`, `brotli`, `uharfbuzz`, `Pillow` and `rsvg-convert`). Do not edit the logo files by hand |
| `services.html` | Services page at `/services`: the workshop, as a pilot with its pilot price and delivery area. The School Performance & Assurance Review was taken off the site in November 2026 until a first workshop pilot has been delivered |
| `workshop.html` | The workshop page at `/workshop`: outcomes, timed structure, practical details and the expression-of-interest enquiry route. The pilot price is published; no dates or availability are |
| `privacy.html`, `accessibility.html`, `terms.html` | Privacy notice, accessibility statement and terms of use |
| `site.css`, `site.js` | Shared styles and a small script (copyright year, copy-the-questions button, enquiry form) The tool page loads `site.js` only for the copyright year, and carries its own copy of the header and footer styles; a test checks that the navigation and footer are identical on every page |
| `sample-briefing-preview.png` | Picture of the sample one-page briefing (invented school), made from the sample PDF |
| `fonts/` | Plus Jakarta Sans (headlines) and Inter (body text), hosted on the site itself so nothing loads from outside. SIL Open Font Licence, see the `OFL-*.txt` files. The briefings themselves stay in Arial so the one-page version still fits A4 |
| `tests/browser.cjs`, `tests/serve.cjs`, `tests/make-sample.cjs`, `tests/fixtures/` | Browser checks, the local test server, the sample-PDF builder and invented test files |
| `tests/core.test.mjs` | Rule tests |

There is no build step. Deploy by publishing the folder as a static site.

## Privacy and security

- The content security policy in `_headers` sets `connect-src 'none'`, so the page cannot send data to any server, and scripts load only from this site. This is what makes "your data stays on this device" checkable by a school's data protection officer. It only applies on a host that honours `_headers` (Netlify does).
- Forms may post only to this site (`form-action 'self'` in the header), which the enquiry form on `/contact` and the sign-up form on `/subscribe` need. Every other page forbids forms in its own policy tag, and the IDSR tool page is also sent a second policy header (`form-action 'none'`), so the tool cannot submit a form even if its tag were removed.
- The policy also stops the site being shown inside another page (`frame-ancestors 'none'`).
- Never commit a real IDSR, or figures taken from one, to this repository. Test files must use invented numbers.

## Small numbers

With "Hide small numbers" ticked (the default), on screen, in print and in the Word file:

- counts and cohort sizes of 5 or fewer are shown as "5 or fewer", and rows for cohorts of 5 or fewer are left out;
- suspension and exclusion reasons are left out;
- a suspension or persistent-absence percentage is withheld when, with its cohort size, it implies 5 or fewer pupils;
- a total is not printed where subtracting a shown part would reveal a hidden one.

The line follows the IDSR, which suppresses cohorts of 5 or fewer. Attainment percentages are shown as the IDSR gives them, even where they imply a small number of pupils: this is a deliberate choice, because hiding them would remove most higher-standard results for a one-form-entry school. Review it before sharing a briefing beyond the governing board.

## Governor questions and the Ofsted toolkit

Each question is produced by a fixed rule and linked to a theme in Ofsted's State-funded school inspection toolkit (v2.0, June 2026, for use from 7 September 2026). Version B and the Word file show, for each area, a short paraphrase of what the toolkit's expected standard looks for. The paraphrases live in `TOOLKIT` in `core.js`. They are not Ofsted's wording, and they must be re-read against the toolkit whenever Ofsted updates it. Leadership and governance is cited by area only. Safeguarding and personal development and wellbeing are not evidenced by IDSR data, so no questions are generated for them.

## Tests

```
node --test tests/core.test.mjs     # rule tests: Node 20 or later, no packages
node tests/browser.cjs              # browser tests: needs Playwright
node tests/make-sample.cjs          # rebuild the two sample PDFs
```

The browser tests serve the site under its real security headers and use it as a person would: both briefings, the small-numbers switch, edits, Word export, uploads that should work and uploads that should be refused, hostile files, phone and narrow layouts. Fixtures are in `tests/fixtures/` and use invented figures only.

Vendored library check: `vendor/docx-9.5.1.iife.js` is the unmodified npm `docx@9.5.1` build, sha256 `bb2908d72ffd8a3d896b455563733d3a2e708e1384a5140e05b3c6dd0b2f676d` (the rule tests assert this). When the test counts change, update the figures in the "How it's checked" panel in `idsr.html`.

The tests cover the number reader, the banding and significance rules, year ordering, small-number handling, escaping of uploaded text and the template check. Run them before every deploy, and add a case whenever Ofsted changes the IDSR.

When Ofsted publishes a new IDSR release: check a real file by hand against its briefing, then add the release date to `TESTED_RELEASES` in `core.js`.

## Limits

- The briefing supports governor scrutiny. It does not replace the IDSR or professional judgement, and it is not an Ofsted judgement, grade or prediction.
- Not affiliated with or endorsed by Ofsted or the Department for Education.
- Source data: Ofsted IDSR, © Crown copyright, provided to the school under Ofsted's IDSR conditions of use; not for publication.

Designed by Wendell Gopaul. © GovernorBrief 2026. All rights reserved.

## Sending briefing emails

Sign-ups from `/subscribe` are only collected; nothing is sent automatically. The privacy notice promises the steps below, so follow them every time.

1. **Confirm first.** When a sign-up arrives, send that address one short email asking them to reply to confirm. Add them to the list only when they reply. Delete unconfirmed addresses within one month.
2. **Never put the list in To or Cc.** Send each briefing with mail merge (one email per person) from the enquiry mailbox, so no subscriber sees another's address. Do not rely on typing addresses into Bcc by hand.
3. **Every email carries the same footer:** who it is from (GovernorBrief, enquiry@governorbrief.co.uk), why they are receiving it, and "To stop these emails, reply with STOP".
4. **Stopping.** When someone asks to stop, remove them from the list the same day. Within one month, delete their address from the list, the mailbox and the Netlify form store. Keep a dated note that the request was handled, without the address.
5. **Scope.** Subscribers agreed to briefing emails only. Do not use the list to promote the workshop or anything else.

## Hosting notes

- Do not rename or delete the Netlify site (`govcopilot`). The `www` address and old links point at `govcopilot.netlify.app`; if that name were released, someone else could claim it.
- Keep auto-renew, registrar lock and two-step sign-in switched on for the domain and for Netlify.

## Release checklist

1. Run `node --test tests/core.test.mjs` and `node tests/browser.cjs`. Both must pass.
2. Open the Netlify deploy preview for the pull request and check the home page, `/idsr` (load the example school) and `/briefs/`.
3. Send one test enquiry from `/contact` on the preview. Check that it appears under Forms in Netlify and that the notification email reaches the enquiry mailbox. Check the Spam list if it does not.
4. In Netlify, Forms must show form detection as enabled and an email notification set for both forms, `enquiry` and `briefing-updates`.
5. Delete test enquiries from Netlify afterwards. Real enquiries that do not lead to a workshop are deleted within 12 months (see the privacy notice); Netlify does not do this automatically.
6. Merge, then check the live site.
