# AGENTS.md

Guidance for AI coding agents and human contributors working on this repository.

## Project

Hyperclip is a Chrome extension (Manifest V3) that adds copy buttons / copy links to websites. Plain JavaScript,
no framework, no bundler, no runtime dependencies. See [README.md](README.md) for what it does.

## Commands

```bash
npm run publish   # copy the files referenced by manifest.json into publish/ (load that folder in Chrome)
npm run icons     # regenerate icons/*.png
```

There is no test suite, linter or formatter configured. Do not add dependencies without a good reason; the
project is deliberately dependency-free. Requires Node.js 18+.

## Structure

```text
manifest.json                    Must stay in the project root. Every file the extension needs is listed here.
scripts/shared.js                Shared helpers, exposed as globalThis.hyperclip
scripts/sites/<site>.js          One content script per website
styles/<site>.css                One stylesheet per website
dev-scripts/                     Node scripts for development (build, icon generation). Not part of the extension.
publish/                         Build output, git-ignored. Never edit it by hand.
```

`dev-scripts/publish.js` builds from `manifest.json`: a file only ends up in `publish/` if the manifest references
it. When adding a script or stylesheet, add it to the manifest, not to a list in the build script.

## Code style

- JavaScript (CommonJS in `dev-scripts/`, plain browser scripts in `scripts/`), 2 spaces, double quotes,
  semicolons, max. 120 characters per line. `.editorconfig` has the details.
- Content scripts are wrapped in an IIFE `(() => { ... })();` so they do not leak names into the global scope
  that all content scripts of one manifest entry share. The only shared global is `globalThis.hyperclip`.
- Prefer small functions with a single job and descriptive names (`getGifUrl`, `titleFromHeading`) over long
  functions with inline explanations.
- Name constants instead of using magic numbers (`TOAST_MS`, `SCAN_THROTTLE_MS`).
- Use `const`, early returns and `for...of`. No `var`.
- Prefix everything the extension adds to a page with `hyperclip-` (CSS classes, `data-` attributes), so it can
  never collide with the site's own names.
- Do not change the language of the project: code, comments, commit messages and docs are in English.

## Comments

Write comments for humans. Explain **why** something is done, or what a non-obvious piece of code is for. Do not
restate what the code already says.

- Start each file with one or two lines on what it is for.
- Comment decisions that are not obvious from the code, especially workarounds for a site's behavior
  (for example why the observer watches `document` instead of `<body>`).
- Do not comment every line, and do not leave commented-out code behind.

## Working on site scripts

- **Be defensive about foreign markup.** Sites change their HTML without notice. Look for stable things (text,
  roles, URLs) instead of generated class names, resolve text at click time rather than at scan time, and
  prefer doing nothing over copying something wrong.
- **Handle dynamic pages.** Both sites load content after the initial page load. Use a `MutationObserver` and make
  the scan idempotent (mark handled elements).
- **Keep scans cheap.** They run on every DOM change, so throttle or debounce them.
- **Copy through `hyperclip.copyText`** so the Clipboard API and its fallback stay in one place.
- Avoid inline scripts or styles that a page's Content Security Policy could block.

## Testing

There are no automated tests, so verify changes manually:

1. Run `npm run publish`, load `publish/` as an unpacked extension (or reload it) and open the affected site.
2. Click each button / link and paste the result somewhere to check the exact text, including whitespace.
3. For `github.com`, also check: a normal issue, a pull request, the pull request's `/files` tab, the sticky header
   (scroll down) and navigating between pages without a reload.

When testing with browser automation: GitHub's CSP blocks injected inline scripts, so load the content scripts as
init scripts. `scripts/sites/github.js` observes `document` and works that way; `scripts/sites/thecodinglove.js`
needs `document.body` and has to be injected after the page loaded.

## Commits and pull requests

- Keep commits small and focused; write the message in the imperative mood ("Add Skirnir button").
- Update `README.md` when behavior changes, and `AGENTS.md` when conventions change.
- Do not commit `publish/`, IDE settings or local tooling files (see `.gitignore`).
