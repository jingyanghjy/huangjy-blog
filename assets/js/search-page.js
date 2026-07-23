(() => {
  "use strict";

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function stripHtml(value) {
    const div = document.createElement("div");
    div.innerHTML = value || "";
    return div.textContent || div.innerText || "";
  }

  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function getSearchTerms(query) {
    const terms = String(query || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    if (terms.length > 1) {
      terms.unshift(String(query).trim());
    }

    return Array.from(new Set(terms)).sort((a, b) => b.length - a.length);
  }

  function highlightText(value, terms) {
    const text = String(value || "");

    if (!text || !terms.length) {
      return escapeHtml(text);
    }

    const pattern = terms.map(escapeRegExp).join("|");
    const matcher = new RegExp(`(${pattern})`, "gi");

    return escapeHtml(text).replace(matcher, '<mark class="hj-search-highlight">$1</mark>');
  }

  function buildExcerpt(item, terms) {
    const source = stripHtml(item.summary || item.content || "");
    const content = stripHtml(item.content || "");
    const haystack = content || source;
    const lowerHaystack = haystack.toLocaleLowerCase();
    let index = -1;

    for (const term of terms) {
      const nextIndex = lowerHaystack.indexOf(term.toLocaleLowerCase());

      if (nextIndex !== -1 && (index === -1 || nextIndex < index)) {
        index = nextIndex;
      }
    }

    if (index === -1) {
      return source.slice(0, 180);
    }

    const start = Math.max(0, index - 70);
    const end = Math.min(haystack.length, index + 140);
    const prefix = start > 0 ? "..." : "";
    const suffix = end < haystack.length ? "..." : "";

    return `${prefix}${haystack.slice(start, end)}${suffix}`;
  }

  function getSearchUrl(root, query, titleOnly) {
    const url = new URL("/search/", window.location.origin);
    const basePath = new URL(root || "/", window.location.origin).pathname;

    if (basePath !== "/") {
      url.pathname = `${basePath.replace(/\/$/, "")}/search/`;
    }

    url.searchParams.set("q", query);

    if (titleOnly) {
      url.searchParams.set("scope", "title");
    }

    return url;
  }

  function renderResults(results, resultsNode, query, titleOnly) {
    const terms = getSearchTerms(query);

    resultsNode.innerHTML = results
      .map((result) => {
        const item = result.item;
        const title = highlightText(item.title, terms);
        const section = escapeHtml(item.section || "");
        const date = escapeHtml(item.date || "");
        const summary = titleOnly
          ? escapeHtml(stripHtml(item.summary || item.content || "")).slice(0, 180)
          : highlightText(buildExcerpt(item, terms), terms);
        const href = item.externalUrl || item.permalink || "#";
        const target = item.externalUrl ? ' target="_blank" rel="noopener"' : "";

        return `
          <article class="rounded-md border border-neutral-300 p-4 hover:border-primary-500 dark:border-neutral-700">
            <a class="block decoration-primary-500 hover:underline" href="${escapeHtml(href)}"${target}>
              <h2 class="text-xl font-bold text-neutral-900 dark:text-neutral">${title}</h2>
              <div class="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                ${section}${date ? `<span class="px-2 text-primary-500">&middot;</span>${date}` : ""}
              </div>
              ${summary ? `<p class="mt-2 text-sm text-neutral-700 dark:text-neutral-300">${summary}</p>` : ""}
            </a>
          </article>
        `;
      })
      .join("");
  }

  function initSearchPage() {
    const root = document.querySelector("[data-search-page]");

    if (!root || !window.Fuse) {
      return;
    }

    const form = root.querySelector("[data-search-page-form]");
    const input = root.querySelector("[data-search-page-input]");
    const titleOnlyInput = root.querySelector("[data-search-title-only]");
    const status = root.querySelector("[data-search-page-status]");
    const resultsNode = root.querySelector("[data-search-page-results]");
    const baseUrl = root.dataset.url || "/";
    const searchParams = new URL(window.location.href).searchParams;
    const query = searchParams.get("q") || "";
    const titleOnly = searchParams.get("scope") === "title";

    input.value = query;
    titleOnlyInput.checked = titleOnly;
    input.focus();

    form.addEventListener("submit", (event) => {
      const nextQuery = input.value.trim();

      if (!nextQuery) {
        return;
      }

      event.preventDefault();
      window.location.href = getSearchUrl(
        baseUrl,
        nextQuery,
        titleOnlyInput.checked
      ).toString();
    });

    titleOnlyInput.addEventListener("change", () => {
      const nextQuery = input.value.trim();

      if (!nextQuery) {
        return;
      }

      window.location.href = getSearchUrl(
        baseUrl,
        nextQuery,
        titleOnlyInput.checked
      ).toString();
    });

    if (!query.trim()) {
      return;
    }

    status.textContent = "正在搜索...";

    fetch(`${baseUrl.replace(/\/?$/, "/")}index.json`)
      .then((response) => response.json())
      .then((data) => {
        const indexData = data.filter((item) => {
          return !["tags", "categories"].includes(item.type);
        });

        const keys = titleOnly
          ? [{ name: "title", weight: 1.0 }]
          : [
              { name: "title", weight: 0.8 },
              { name: "section", weight: 0.2 },
              { name: "summary", weight: 0.6 },
              { name: "content", weight: 0.4 },
            ];

        const fuse = new Fuse(indexData, {
          shouldSort: true,
          ignoreLocation: true,
          threshold: 0.2,
          keys,
        });

        const results = fuse.search(query.trim());

        const scopeText = titleOnly ? "标题" : "标题和内容";

        status.textContent = results.length
          ? `在${scopeText}中搜索“${query.trim()}”，共找到 ${results.length} 条结果。`
          : `在${scopeText}中没有找到包含“${query.trim()}”的结果。`;

        renderResults(results, resultsNode, query.trim(), titleOnly);
      })
      .catch(() => {
        status.textContent = "搜索索引加载失败，请稍后再试。";
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initSearchPage, { once: true });
  } else {
    initSearchPage();
  }
})();
