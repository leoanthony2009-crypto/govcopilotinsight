# GovCopilot Insight – IDSR Governor Briefing

Turns a school's Ofsted Inspection Data Summary Report (IDSR) into a one-page governor briefing, a full briefing with an evidence trail, and an editable Word document.

**Status:** pilot, version 3.1. Checked against the IDSR release of 25 September 2026, mainly on primary-school data. Secondary and special-school handling exists but has had little testing.

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

With "Hide small numbers" ticked (the default), counts of 5 or fewer are shown as "5 or fewer", and suspension and exclusion reasons are left out, on screen, in print and in the Word file. The line follows the IDSR, which suppresses cohorts of 5 or fewer. Percentages are shown as the IDSR gives them.

## Tests

```
node --test tests/core.test.mjs
```

Needs Node 20 or later and no packages. The tests cover the number reader, the banding and significance rules, year ordering, small-number handling, escaping of uploaded text and the template check. Run them before every deploy, and add a case whenever Ofsted changes the IDSR.

When Ofsted publishes a new IDSR release: check a real file by hand against its briefing, then add the release date to `TESTED_RELEASES` in `core.js`.

## Limits

- The briefing supports governor scrutiny. It does not replace the IDSR or professional judgement, and it is not an Ofsted judgement, grade or prediction.
- Not affiliated with or endorsed by Ofsted or the Department for Education.
- Source data: Ofsted IDSR, © Crown copyright, provided to the school under Ofsted's IDSR conditions of use; not for publication.

Designed by and © W. Gopaul 2026. All rights reserved.
