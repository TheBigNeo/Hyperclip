# Hyperclip

A small Chrome extension that adds one-click **copy buttons** to websites you use every day, so you can paste a
ready-made link or snippet instead of assembling it by hand. The icon is a paperclip with Clippy-style eyes.

Hyperclip is built with Manifest V3, plain JavaScript and no runtime dependencies.

## What it does

| Site | What you get |
| ---- | ------------ |
| [thecodinglove.com](https://thecodinglove.com/) | Three buttons below every GIF: **Copy GIF URL**, **Copy for Gitea**, **Copy for Skirnir** |
| [github.com](https://github.com/) | The issue / pull request number in the header becomes a copy link |

### thecodinglove.com

| Button | Copies |
| ------ | ------ |
| Copy GIF URL | `https://thecodinglove.com/content/053/KJlyCIr.gif` |
| Copy for Gitea | A Markdown heading linking to the post, followed by the GIF as an image |
| Copy for Skirnir | Only the linked Markdown heading, padded with blank lines |

For example, **Copy for Skirnir** on the post "When I comment out the failing test instead of fixing the code"
copies:

```markdown
### [When I comment out the failing test instead of fixing the code](https://thecodinglove.com/when-i-comment-out-the-failing-test-instead-of-fixing-the-code)
```

### github.com

On issue and pull request pages, clicking the number in the header (e.g. `#1123`) copies the number **and** the
title in one go, without the `#`:

```text
1123 ASP.NET Core 2.3 end of support - April 13, 2027
```

A small "Copied" tooltip confirms the click and follows GitHub's light / dark theme. Hovering the number shows
the text that a click would copy. This also works in the sticky header that appears while scrolling.

## Install

Hyperclip is not in the Chrome Web Store, so you load it as an unpacked extension. You need
[Node.js](https://nodejs.org/) 18 or newer for the build step; there is nothing to `npm install`.

1. Clone this repository.
2. Run `npm run publish`. This copies the extension files into the `publish/` folder.
3. Open `chrome://extensions` and enable **Developer mode** (top right).
4. Click **Load unpacked** and select the `publish/` folder.
5. Reload any open thecodinglove.com or GitHub tab.

After changing the code, run `npm run publish` again and click the reload icon of the extension.

## How it works

Each site has its own content script in `scripts/sites/`. Both share the same approach: find the right elements,
attach the copy behavior, and keep watching the page (`MutationObserver`), because both sites load content
dynamically.

**thecodinglove.com**

- Finds every `<video>` (also ones loaded later by infinite scroll).
- Reads the GIF URL from the `<object data="...gif">` fallback. If that is missing, it swaps `.webm` / `.mp4` in
  the video source for `.gif`.
- Reads title and permalink from the post's `<h1>`.

**github.com**

- Only acts on `/<owner>/<repo>/issues/<n>` and `/<owner>/<repo>/pull/<n>` pages, and only on the page's own
  number, never on references to other issues.
- GitHub's CSS class names are hashed, so the number is found by its text (`#<n>`) instead. The title is looked up
  with fallbacks: the `.markdown-title` element near the number, then the page heading, then the document title.
  If no title can be found, the number is left alone rather than copying something wrong.
- GitHub navigates without page reloads and replaces `<body>`, so the script observes `document` and re-checks the
  element again at click time.

Copying uses the Clipboard API with an `execCommand("copy")` fallback (`scripts/shared.js`).

## Project structure

```text
manifest.json                    Extension manifest (has to stay in the project root)
scripts/shared.js                Code shared by all sites (copyText)
scripts/sites/thecodinglove.js   Content script for thecodinglove.com
scripts/sites/github.js          Content script for github.com
styles/                          One stylesheet per site
icons/                           Extension icons (generated)
dev-scripts/publish.js           Build: copies the files referenced by manifest.json into publish/
dev-scripts/generate-icons.js    Renders icons/*.png without any dependencies
publish/                         Build output (git-ignored), the folder you load in Chrome
```

## Adding a site

1. Create `scripts/sites/<site>.js` and, if needed, `styles/<site>.css`.
2. Add a `content_scripts` entry to `manifest.json` that lists `scripts/shared.js`, your script and your stylesheet.
3. Run `npm run publish`. The build picks up every file the manifest references, so there is no second list to
   maintain. It aborts without touching the previous build if a referenced file does not exist.

See [AGENTS.md](AGENTS.md) for the code conventions.

## Known limitations

- **GitHub:** only issue and pull request detail pages are covered. Issue / PR lists, commits, file links with line
  numbers and repository URLs are not (yet).
- **GitHub markup:** the script depends on GitHub rendering the number as `#<n>` inside a `<span>`. If GitHub
  changes this, the number simply stops being clickable.
- **thecodinglove.com:** the `.mp4` -> `.gif` fallback assumes the GIF lives next to the video file.
- The extension has been tested on the live sites with the real scripts injected, but there are no automated tests.

## License

[MIT](LICENSE)

## Disclaimer

Not affiliated with or endorsed by thecodinglove.com, GitHub or Microsoft. Clippy is a Microsoft character; the
icon is only a loose homage.
