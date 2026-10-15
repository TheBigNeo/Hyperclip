// Code shared by all site scripts.
// Content scripts listed in the same manifest entry share one global scope, so this is
// exposed as `globalThis.hyperclip` and picked up by the site scripts that are loaded after it.
(() => {
  // Fallback for pages where the async Clipboard API is denied (e.g. missing focus or permission policy).
  function copyWithTextarea(text) {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();

    try {
      return document.execCommand("copy");
    } catch {
      return false;
    } finally {
      textarea.remove();
    }
  }

  globalThis.hyperclip = {
    // Copies `text` to the clipboard. Resolves to true on success, false otherwise.
    async copyText(text) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        return copyWithTextarea(text);
      }
    },
  };
})();
