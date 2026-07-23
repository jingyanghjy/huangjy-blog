(() => {
  "use strict";

  function getSearchUrl(root, query) {
    const url = new URL("/search/", window.location.origin);
    const basePath = new URL(root || "/", window.location.origin).pathname;

    if (basePath !== "/") {
      url.pathname = `${basePath.replace(/\/$/, "")}/search/`;
    }

    url.searchParams.set("q", query);
    return url;
  }

  function initSearchRedirect() {
    const wrapper = document.getElementById("search-wrapper");
    const input = document.getElementById("search-query");

    if (!wrapper || !input) {
      return;
    }

    input.addEventListener(
      "keydown",
      (event) => {
        if (event.key !== "Enter") {
          return;
        }

        const query = input.value.trim();

        if (!query) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();

        window.location.href = getSearchUrl(wrapper.dataset.url, query).toString();
      },
      true
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initSearchRedirect, { once: true });
  } else {
    initSearchRedirect();
  }
})();
