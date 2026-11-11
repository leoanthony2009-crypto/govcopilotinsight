# GovCopilot Insight – IDSR Governor Briefing

Turns a school's Ofsted Inspection Data Summary Report (IDSR) into a one-page governor briefing, a full briefing with an evidence trail, and an editable Word document.

**Status:** pilot, version 3.3. Checked against the IDSR release of 25 September 2026, mainly on primary-school data. Secondary and special-school handling exists but has had little testing.

## How it works

- **Rule-based. No AI.** Fixed rules read the IDSR tables; the same file always gives the same briefing.
- **No upload.** The file is read in the browser. There is no server, no storage and no analytics.
- **Traceable.** Every headline points to its IDSR row in the evidence trail, and a data-coverage appendix lists what was read, what was missing and what to check by hand.
- **Fails loudly.** If the expected tables or columns are not found, no briefing is produced. An IDSR released after the last checked release loads with a warning.

## Files

| File | What it holds |
| --- | --- |
| `index.html` | Page markup and styles |
| `core.js` | Parser, analysis rules and the two on-screen briefings |
| `app.js` | Word export and page behaviour |
| `sample.js` | The example school. **Every school figure in it is invented.** National comparison figures are published statistics |
| `vendor/docx-9.5.1.iife.js` | The Word library (MIT licence, see `vendor/docx-LICENSE.txt`), hosted with the site so nothing loads from a third party |
| `_headers` | Security headers for Netlify, including the content security policy |
| `tests/core.test.mjs` | Rule tests |

There is no build step. Deploy by publishing the folder as a static site.

## Privacy and security

- The content security policy in `_headers` sets `connect-src 'none'`, so the page cannot send data to any server, and scripts load only from this site. This is what makes "your data stays on this device" checkable by a school's data protection officer. It only applies on a host that honours `_headers` (Netlify does).
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
```

The browser tests serve the site under its real security headers and use it as a person would: both briefings, the small-numbers switch, edits, Word export, uploads that should work and uploads that should be refused, hostile files, phone and narrow layouts. Fixtures are in `tests/fixtures/` and use invented figures only.

Vendored library check: `vendor/docx-9.5.1.iife.js` is the unmodified npm `docx@9.5.1` build, sha256 `bb2908d72ffd8a3d896b455563733d3a2e708e1384a5140e05b3c6dd0b2f676d` (the rule tests assert this). The tests cover the number reader, the banding and significance rules, year ordering, small-number handling, escaping of uploaded text and the template check. Run them before every deploy, and add a case whenever Ofsted changes the IDSR.

When Ofsted publishes a new IDSR release: check a real file by hand against its briefing, then add the release date to `TESTED_RELEASES` in `core.js`.

## Limits

- The briefing supports governor scrutiny. It does not replace the IDSR or professional judgement, and it is not an Ofsted judgement, grade or prediction.
- Not affiliated with or endorsed by Ofsted or the Department for Education.
- Source data: Ofsted IDSR, © Crown copyright, provided to the school under Ofsted's IDSR conditions of use; not for publication.

Designed by and © W. Gopaul 2026. All rights reserved.
