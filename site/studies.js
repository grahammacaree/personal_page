/** Studies page: open course note PDFs in a modal lightbox. */
(function () {
  const root = document.querySelector(".doc--studies");
  if (!root) return;

  const dialog = root.querySelector(".studies-lightbox");
  const frame = root.querySelector(".studies-lightbox-frame");
  const titleEl = root.querySelector(".studies-lightbox-title");
  const openLink = root.querySelector(".studies-lightbox-open");
  const closeBtn = root.querySelector(".studies-lightbox-close");
  if (!dialog || !frame || !titleEl || !openLink || !closeBtn) return;

  function openPdf(src, title) {
    const label = title || "Course notes";
    frame.src = src;
    frame.title = `${label} PDF`;
    titleEl.textContent = label;
    openLink.href = src;
    if (typeof dialog.showModal === "function") {
      dialog.showModal();
    } else {
      dialog.setAttribute("open", "");
    }
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
  }

  dialog.addEventListener("close", resetViewer);

  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) closePdf();
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
    event.preventDefault();
    openPdf(
      link.getAttribute("data-studies-pdf"),
      link.getAttribute("data-studies-title") || "Notes"
    );
  });

  closeBtn.addEventListener("click", closePdf);
})();
