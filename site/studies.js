/** Studies page: open course note PDFs in a modal lightbox (desktop).
 *
 * On coarse / non-hover pointers (phones, most tablets), follow the real
 * PDF href so the browser can use its native viewer — iframe embeds on iOS
 * Safari are a poor preview, not the system PDF UI.
 *
 * Shareable deep links: /studies.html?notes=<pdf-slug>&page=<n>
 * e.g. ?notes=learning-from-data&page=25
 */
(function () {
  const root = document.querySelector(".doc--studies");
  if (!root) return;

  const dialog = root.querySelector(".studies-lightbox");
  const frame = root.querySelector(".studies-lightbox-frame");
  const titleEl = root.querySelector(".studies-lightbox-title");
  const openLink = root.querySelector(".studies-lightbox-open");
  const closeBtn = root.querySelector(".studies-lightbox-close");
  if (!dialog || !frame || !titleEl || !openLink || !closeBtn) return;

  /** @type {string | null} */
  let activeSlug = null;
  /** @type {number | null} */
  let activePage = null;

  /** Desktop-class pointer: keep the in-page lightbox. */
  function useLightbox() {
    return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  }

  function pdfSlug(href) {
    if (!href) return "";
    try {
      const path = new URL(href, location.href).pathname;
      const base = path.split("/").pop() || "";
      return base.replace(/\.pdf$/i, "");
    } catch {
      return "";
    }
  }

  function parsePage(raw) {
    if (raw == null || raw === "") return null;
    const n = Number.parseInt(String(raw), 10);
    if (!Number.isFinite(n) || n < 1) return null;
    return n;
  }

  function withPage(href, page) {
    const base = String(href || "").split("#")[0];
    if (!base) return "";
    return page ? `${base}#page=${page}` : base;
  }

  function findNotesLink(slug) {
    if (!slug) return null;
    const links = root.querySelectorAll("[data-studies-pdf]");
    for (let i = 0; i < links.length; i += 1) {
      const link = links[i];
      if (pdfSlug(link.getAttribute("data-studies-pdf")) === slug) {
        return link;
      }
    }
    return null;
  }

  function syncUrl(slug, page) {
    const url = new URL(location.href);
    if (slug) {
      url.searchParams.set("notes", slug);
      if (page) url.searchParams.set("page", String(page));
      else url.searchParams.delete("page");
    } else {
      url.searchParams.delete("notes");
      url.searchParams.delete("page");
    }
    history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }

  function setTitle(label) {
    const kind = document.createElement("span");
    kind.className = "studies-lightbox-title-kind";
    kind.textContent = " lecture notes";
    titleEl.replaceChildren(label, kind);
  }

  function openPdf(src, title, opts = {}) {
    const slug = opts.slug || pdfSlug(src);
    const page = opts.page != null ? opts.page : null;
    const href = withPage(src, page);
    const label = title || "Course notes";

    activeSlug = slug || null;
    activePage = page;

    frame.src = href;
    frame.title = `${label} lecture notes PDF`;
    setTitle(label);
    openLink.href = href;
    if (typeof dialog.showModal === "function") {
      dialog.showModal();
    } else {
      dialog.setAttribute("open", "");
    }
    if (opts.updateUrl !== false) {
      syncUrl(activeSlug, activePage);
    }
    // Keep focus in the dialog chrome so Escape closes us, not the PDF viewer.
    closeBtn.focus();
  }

  function closePdf() {
    if (dialog.open) {
      dialog.close();
    } else {
      dialog.removeAttribute("open");
      resetViewer();
    }
  }

  function resetViewer() {
    frame.src = "";
    frame.title = "Course notes PDF";
    titleEl.textContent = "";
    openLink.removeAttribute("href");
    activeSlug = null;
    activePage = null;
    syncUrl(null, null);
  }

  dialog.addEventListener("close", resetViewer);

  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) closePdf();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !dialog.open) return;
    event.preventDefault();
    closePdf();
  });

  root.addEventListener("click", (event) => {
    const link = event.target.closest("[data-studies-pdf]");
    if (!link || !root.contains(link)) return;
    // Let modified / non-primary clicks use the real PDF href.
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    // Phones / tablets: navigate to the PDF (native viewer).
    if (!useLightbox()) return;
    event.preventDefault();
    openPdf(
      link.getAttribute("data-studies-pdf"),
      link.getAttribute("data-studies-title") || "Notes",
      { slug: pdfSlug(link.getAttribute("data-studies-pdf")), page: null }
    );
  });

  closeBtn.addEventListener("click", closePdf);

  // Deep link: ?notes=<slug>&page=<n>
  const params = new URLSearchParams(location.search);
  const notesSlug = (params.get("notes") || "").trim();
  const page = parsePage(params.get("page"));
  if (notesSlug) {
    const link = findNotesLink(notesSlug);
    if (link) {
      const src = link.getAttribute("data-studies-pdf");
      if (!useLightbox()) {
        location.replace(withPage(src, page));
      } else {
        openPdf(src, link.getAttribute("data-studies-title") || "Notes", {
          slug: notesSlug,
          page,
          updateUrl: true,
        });
      }
    }
  }
})();
