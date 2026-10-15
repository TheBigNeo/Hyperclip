// github.com: turns the issue / pull request number in the page header (e.g. "#1123") into a copy link.
// A click copies "<number> <title>", e.g. "1123 ASP.NET Core 2.3 end of support - April 13, 2027".
(() => {
  const { copyText } = globalThis.hyperclip;

  const MARK_ATTR = "data-hyperclip-number";
  const TOAST_CLASS = "hyperclip-toast";
  const TOAST_MS = 1500; // how long the toast stays visible
  const TOAST_GAP = 8; // distance between number and toast / toast and viewport edge, in px
  const SCAN_THROTTLE_MS = 200;
  const MAX_TITLE_DEPTH = 3; // how many parents above the number are searched for the title

  const normalizeText = (text) => text.replace(/\s+/g, " ").trim();

  // The issue / PR of the current page, or null on any other page.
  // `exact` is false on sub pages such as /files or /commits.
  function pageInfo() {
    const match = location.pathname.match(/^\/[^/]+\/[^/]+\/(issues|pull)\/(\d+)(\/.*)?$/);
    if (!match) return null;
    const [, kind, number, rest] = match;
    return { kind, number, exact: !rest || rest === "/" };
  }

  // True if the element shows exactly this page's number, e.g. "#1123".
  const isOwnNumber = (el, info) => normalizeText(el.textContent) === `#${info.number}`;

  // --- Title lookup -------------------------------------------------------------------------------------------
  // GitHub's class names are hashed, so the title is found by what stays stable. Three strategies, in order
  // of preference:

  // 1. The .markdown-title element near the number. Issue header, PR header and both sticky headers nest it
  //    at different depths, so walk up a few parents.
  function titleNearNumber(numberEl) {
    let scope = numberEl.parentElement;
    for (let depth = 0; depth < MAX_TITLE_DEPTH && scope; depth++, scope = scope.parentElement) {
      const title = scope.querySelector(".markdown-title");
      if (title) return normalizeText(title.textContent);
    }
    return null;
  }

  // 2. The page heading, which ends with the number (also as screen-reader text: "Title - #123").
  function titleFromHeading(info) {
    const suffix = new RegExp(`[\\s-]*#${info.number}$`);
    for (const heading of document.querySelectorAll("h1")) {
      const text = normalizeText(heading.textContent);
      if (suffix.test(text)) return text.replace(suffix, "");
    }
    return null;
  }

  // 3. The document title. Only reliable on the main page: sub pages are titled "Files changed", "Commits", ...
  function titleFromDocument(info) {
    if (!info.exact) return null;
    const author = info.kind === "pull" ? "(?: by \\S+)?" : "";
    const match = document.title.match(new RegExp(`^(.+?)${author} · (?:Issue|Pull Request) #${info.number}(?: · |$)`));
    return match ? normalizeText(match[1]) : null;
  }

  // The text to copy for a marked element, or null if it no longer is this page's issue / PR number
  // (the user navigated away, or React reused the element).
  function getCopyText(numberEl) {
    const info = pageInfo();
    if (!info || !numberEl.isConnected || !isOwnNumber(numberEl, info)) return null;

    const title = titleNearNumber(numberEl) || titleFromHeading(info) || titleFromDocument(info);
    return title ? `${info.number} ${title}` : null;
  }

  // --- Marking the number -------------------------------------------------------------------------------------

  // Marks the page's own number as clickable and drops marks that went stale. Cheap enough to run often.
  function scan() {
    const info = pageInfo();

    for (const el of document.querySelectorAll(`[${MARK_ATTR}]`)) {
      if (!info || !isOwnNumber(el, info)) el.removeAttribute(MARK_ATTR);
    }
    if (!info) return;

    for (const el of document.querySelectorAll("span")) {
      if (el.hasAttribute(MARK_ATTR) || el.childElementCount) continue;
      // Only the page's own number, never a link or a reference to another issue
      if (!isOwnNumber(el, info) || el.closest("a")) continue;
      // Only mark it if there is a title to copy, otherwise a click would do nothing useful
      if (getCopyText(el)) el.setAttribute(MARK_ATTR, "1");
    }
  }

  // --- Feedback toast -----------------------------------------------------------------------------------------
  // One fixed-position element on <body>. Ancestors with overflow: hidden (e.g. the sticky header) cannot clip
  // it, and it does not inherit the header's large font.
  let toast = null;
  let toastTimer = null;

  function showToast(anchor, ok) {
    if (!toast || !toast.isConnected) {
      toast = document.createElement("div");
      toast.className = TOAST_CLASS;
      toast.setAttribute("role", "status");
      (document.body || document.documentElement).appendChild(toast);
    }

    const icon = document.createElement("span");
    icon.className = `${TOAST_CLASS}-icon`;
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = ok ? "✓" : "✗";
    toast.replaceChildren(icon, ok ? "Copied" : "Copy failed");
    toast.dataset.state = ok ? "ok" : "fail";

    // Prefer below the number, flip above when there is no room. Keep it inside the viewport horizontally.
    const rect = anchor.getBoundingClientRect();
    const { offsetWidth: width, offsetHeight: height } = toast;
    const fitsBelow = rect.bottom + TOAST_GAP + height <= window.innerHeight;
    const centered = rect.left + rect.width / 2 - width / 2;
    const left = Math.min(Math.max(centered, TOAST_GAP), window.innerWidth - width - TOAST_GAP);
    toast.style.left = `${left}px`;
    toast.style.top = `${fitsBelow ? rect.bottom + TOAST_GAP : rect.top - TOAST_GAP - height}px`;
    toast.dataset.placement = fitsBelow ? "below" : "above";

    toast.setAttribute("data-visible", "");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.removeAttribute("data-visible"), TOAST_MS);
  }

  // --- Events -------------------------------------------------------------------------------------------------

  const closestMarked = (e) => e.target.closest && e.target.closest(`[${MARK_ATTR}]`);

  // One delegated listener instead of one per element: it survives React replacing elements, and the text is
  // resolved at click time. Capture phase, so GitHub's own handlers cannot swallow the click.
  document.addEventListener(
    "click",
    async (e) => {
      const el = closestMarked(e);
      if (!el) return;
      e.preventDefault();
      e.stopPropagation();

      const text = getCopyText(el);
      if (!text) {
        el.removeAttribute(MARK_ATTR);
        return;
      }
      showToast(el, await copyText(text));
    },
    true
  );

  // Show what a click would copy as the native tooltip
  document.addEventListener("mouseover", (e) => {
    const el = closestMarked(e);
    const text = el && getCopyText(el);
    if (text) el.title = `Copy "${text}"`;
  });

  // GitHub navigates without page reloads and renders its headers via React, so keep scanning. Throttle instead
  // of debounce, so constant DOM activity cannot postpone the scan forever.
  let scanScheduled = false;
  function scheduleScan() {
    if (scanScheduled) return;
    scanScheduled = true;
    setTimeout(() => {
      scanScheduled = false;
      scan();
    }, SCAN_THROTTLE_MS);
  }

  // Observe the document itself, not <body>: Turbo replaces the <body> element on navigation,
  // which would orphan the observer.
  new MutationObserver(scheduleScan).observe(document, { childList: true, subtree: true });
  for (const type of ["turbo:render", "turbo:load", "soft-nav:end", "pjax:end"]) {
    document.addEventListener(type, scheduleScan);
  }
  window.addEventListener("popstate", scheduleScan);

  scan();
})();
