(() => {
    "use strict";
  
    function initCategoryFilter() {
      const filterPanel = document.querySelector("[data-category-filter]");
  
      if (!filterPanel) {
        return;
      }
  
      const buttons = Array.from(
        filterPanel.querySelectorAll(".hj-filter-chip")
      );
  
      const items = Array.from(
        document.querySelectorAll(".hj-filter-item")
      );
  
      const visibleCount =
        filterPanel.querySelector("[data-visible-count]");
  
      const emptyState =
        document.getElementById("hj-filter-empty");
  
      const availableTags = new Set(
        buttons
          .map((button) => button.dataset.tag || "")
          .filter(Boolean)
      );
  
      const selectedTags = new Set();
  
      /*
       * 支持通过 URL 保留筛选状态：
       * ?tag=LCD&tag=A133
       */
      const initialUrl = new URL(window.location.href);
  
      initialUrl.searchParams
        .getAll("tag")
        .forEach((tag) => {
          if (availableTags.has(tag)) {
            selectedTags.add(tag);
          }
        });
  
      function getItemTags(item) {
        const rawTags = item.dataset.tags || "";
  
        return rawTags
          .split("||")
          .map((tag) => tag.trim())
          .filter(Boolean);
      }
  
      function updateButtons() {
        buttons.forEach((button) => {
          const tag = button.dataset.tag || "";
  
          const active = tag
            ? selectedTags.has(tag)
            : selectedTags.size === 0;
  
          button.classList.toggle("is-active", active);
          button.setAttribute(
            "aria-pressed",
            active ? "true" : "false"
          );
        });
      }
  
      function updateUrl() {
        const url = new URL(window.location.href);
  
        url.searchParams.delete("tag");
  
        selectedTags.forEach((tag) => {
          url.searchParams.append("tag", tag);
        });
  
        window.history.replaceState(
          null,
          "",
          `${url.pathname}${url.search}${url.hash}`
        );
      }
  
      function applyFilter() {
        let count = 0;
  
        items.forEach((item) => {
          const itemTags = getItemTags(item);
  
          /*
           * 多标签采用 AND 逻辑：
           * LCD + A133 表示文章必须同时包含两个标签。
           */
          const matched = Array.from(selectedTags).every(
            (selectedTag) => itemTags.includes(selectedTag)
          );
  
          item.hidden = !matched;
  
          if (matched) {
            count += 1;
          }
        });
  
        if (visibleCount) {
          visibleCount.textContent = String(count);
        }
  
        if (emptyState) {
          emptyState.hidden = count !== 0;
        }
  
        updateButtons();
        updateUrl();
      }
  
      buttons.forEach((button) => {
        button.addEventListener("click", () => {
          const tag = button.dataset.tag || "";
  
          if (!tag) {
            selectedTags.clear();
          } else if (selectedTags.has(tag)) {
            selectedTags.delete(tag);
          } else {
            selectedTags.add(tag);
          }
  
          applyFilter();
        });
      });
  
      applyFilter();
    }
  
    if (document.readyState === "loading") {
      document.addEventListener(
        "DOMContentLoaded",
        initCategoryFilter,
        { once: true }
      );
    } else {
      initCategoryFilter();
    }
  })();