# Marketing skills for Claude

These folders are agent skills from [coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills) (version 2.14.12, commit `1f83744`, copied 15 November 2026). MIT licence, see `LICENSE-marketingskills.txt`.

Claude loads them automatically when it works in this repository. They are development files and are not part of the public site: `_redirects` returns "not found" for everything under `/.claude/`.

- Start with `product-marketing`: it writes `.agents/product-marketing.md`, the positioning and audience note the other skills read first.
- The upstream `evals/` folders (test prompts for skill authors) were left out.
- To update, copy the upstream `skills/` folder over this one again.

The site itself is unchanged by these files. In particular, `conversion-tracking` holds reference snippets only; nothing here adds analytics or tracking to GovernorBrief.
