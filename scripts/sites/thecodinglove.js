// thecodinglove.com: adds three copy buttons below every post GIF (served as <video> with a GIF fallback).
(() => {
  const { copyText } = globalThis.hyperclip;

  const BUTTON_CLASS = "hyperclip-button";
  const GROUP_CLASS = "hyperclip-button-group";
  const MARK_ATTR = "data-hyperclip-buttons";
  const FEEDBACK_MS = 1500; // how long "Copied ✓" / "Failed ✗" stays on the button
  const SCAN_DEBOUNCE_MS = 200;

  // The GIF URL: prefer the <object> fallback, otherwise derive it from the webm/mp4 source.
  // Returns null if the video has neither.
  function getGifUrl(video) {
    const object = video.querySelector('object[data$=".gif"], object[type="image/gif"]');
    if (object && object.data) return object.data;

    const source = video.querySelector("source[src]");
    return source ? source.src.replace(/\.(webm|mp4)(\?.*)?$/i, ".gif") : null;
  }

  // The post's title and permalink, read from the <h1> of the surrounding article
  // (falling back to the first <h1> on the page, and to the current URL).
  function getPost(video) {
    const scope = video.closest("article") || document;
    const heading = scope.querySelector("h1") || document.querySelector("h1");
    const title = heading ? heading.textContent.replace(/\s+/g, " ").trim() : "";
    const link = heading && heading.querySelector("a[href]");
    return { title, href: link ? link.href : location.href };
  }

  // Markdown formats. The blank lines are part of the format: they are what the target tools expect.
  const formats = {
    // Gitea: a linked heading followed by the GIF as an image
    gitea: ({ title, href }, gifUrl) => `\n### [${title}](${href})\n![${title}](${gifUrl})`,
    // Skirnir: only the linked heading, padded with blank lines
    skirnir: ({ title, href }) => `\n\n### [${title}](${href})\n`,
  };

  // A button that copies `getText()` when clicked and briefly shows whether that worked.
  function createButton(label, getText) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = BUTTON_CLASS;
    button.textContent = label;

    button.addEventListener("click", async (e) => {
      // Do not let surrounding links or handlers react to the click
      e.preventDefault();
      e.stopPropagation();

      const ok = await copyText(getText());
      button.textContent = ok ? "Copied ✓" : "Failed ✗";
      button.classList.toggle("hyperclip-ok", ok);
      button.classList.toggle("hyperclip-fail", !ok);

      setTimeout(() => {
        button.textContent = label;
        button.classList.remove("hyperclip-ok", "hyperclip-fail");
      }, FEEDBACK_MS);
    });

    return button;
  }

  function addButtons(video) {
    if (video.hasAttribute(MARK_ATTR)) return;
    const gifUrl = getGifUrl(video);
    if (!gifUrl) return;
    video.setAttribute(MARK_ATTR, "1");

    const urlButton = createButton("Copy GIF URL", () => gifUrl);
    urlButton.title = gifUrl;
    const giteaButton = createButton("Copy for Gitea", () => formats.gitea(getPost(video), gifUrl));
    const skirnirButton = createButton("Copy for Skirnir", () => formats.skirnir(getPost(video)));

    const group = document.createElement("div");
    group.className = GROUP_CLASS;
    group.append(urlButton, giteaButton, skirnirButton);
    video.insertAdjacentElement("afterend", group);
  }

  function scan() {
    document.querySelectorAll("video").forEach(addButtons);
  }

  scan();

  // Cover dynamically loaded content (infinite scroll, navigation)
  let timer = null;
  new MutationObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(scan, SCAN_DEBOUNCE_MS);
  }).observe(document.body, { childList: true, subtree: true });
})();
