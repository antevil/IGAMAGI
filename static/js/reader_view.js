(() => {
  const boot = window.READER_BOOTSTRAP;
  if (!boot || !boot.docId) return;

  const state = {
    docId: boot.docId,
    paragraphCache: [],
    figureCache: [],
  };

  const $ = (id) => document.getElementById(id);
  const els = {
    paragraphList: $("paragraphList"),
    loadParagraphsBtn: $("loadParagraphsBtn"),
    figureList: $("figureList"),
    loadFiguresBtn: $("loadFiguresBtn"),
    toast: $("toast"),
  };

  function showToast(message, isError = false) {
    if (!els.toast) return;
    els.toast.textContent = message;
    els.toast.classList.remove("hidden");
    els.toast.classList.toggle("border-rose-700", isError);
    els.toast.classList.toggle("bg-rose-950", isError);
    els.toast.classList.toggle("border-zinc-700", !isError);
    els.toast.classList.toggle("bg-zinc-900", !isError);
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => els.toast.classList.add("hidden"), 2500);
  }

  async function fetchJSON(url, options = {}) {
    const res = await fetch(url, options);
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `HTTP ${res.status}`);
    }
    return res.json();
  }

  function escapeHtml(text) {
    return String(text)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function paragraphCard(paragraph) {
    const card = document.createElement("div");
    card.className = "rounded-xl border border-zinc-800 bg-zinc-950/70 p-4 space-y-3";

    const head = document.createElement("div");
    head.innerHTML = `
      <div class="flex items-center justify-between gap-3">
        <div>
          <div class="font-medium">#${paragraph.order_index} ${escapeHtml(paragraph.heading_text || "(no heading)")}</div>
          <div class="text-xs text-zinc-400">${escapeHtml(paragraph.unit_type)} / p.${paragraph.page_no + 1} - ${paragraph.end_page_no + 1}</div>
        </div>
        <button class="splitBtn rounded-lg bg-zinc-800 px-3 py-2 text-xs hover:bg-zinc-700">再分割+再翻訳</button>
      </div>
    `;

    const body = document.createElement("div");
    body.className = "space-y-2";

    for (const sentence of paragraph.sentences || []) {
      const block = document.createElement("div");
      block.className = "rounded-lg border border-zinc-800 bg-zinc-900/70 p-3 space-y-2";
      block.innerHTML = `
        <div class="text-sm leading-6 text-zinc-100">${escapeHtml(sentence.source_text)}</div>
        <div class="text-sm leading-6 text-indigo-300">${escapeHtml(sentence.translated_text || "")}</div>
      `;
      body.appendChild(block);
    }

    if (!paragraph.sentences || paragraph.sentences.length === 0) {
      const empty = document.createElement("div");
      empty.className = "text-sm text-zinc-400";
      empty.textContent = "まだ文がありません";
      body.appendChild(empty);
    }

    card.appendChild(head);
    card.appendChild(body);

    head.querySelector(".splitBtn").addEventListener("click", async () => {
      await fetchJSON(`/api/paragraphs/${paragraph.id}/split_sentences`, { method: "POST" });
      await fetchJSON(`/api/paragraphs/${paragraph.id}/translate`, { method: "POST" });
      await loadParagraphs();
      showToast("段落を再分割・再翻訳しました");
    });

    return card;
  }

  async function loadParagraphs() {
    state.paragraphCache = await fetchJSON(`/api/docs/${state.docId}/paragraphs`);
    if (!els.paragraphList) return;
    els.paragraphList.innerHTML = "";
    for (const p of state.paragraphCache) {
      els.paragraphList.appendChild(paragraphCard(p));
    }
  }

  function figureCard(figure) {
    const card = document.createElement("div");
    card.className = "rounded-xl border border-zinc-800 bg-zinc-950/70 p-4 space-y-3";
    const imgSrc = figure.image_path ? `/${figure.image_path}` : "";

    card.innerHTML = `
      <div>
        <div class="font-medium">${escapeHtml(figure.fig_no)}</div>
        <div class="text-xs text-zinc-400">page ${figure.page_no + 1}</div>
      </div>
      ${imgSrc ? `<img src="${imgSrc}" alt="${escapeHtml(figure.fig_no)}" class="w-full rounded-lg border border-zinc-800 bg-white">` : ""}
      <div class="text-sm leading-6 text-zinc-300 whitespace-pre-wrap">${escapeHtml(figure.caption_text || "")}</div>
    `;
    return card;
  }

  async function loadFigures() {
    state.figureCache = await fetchJSON(`/api/docs/${state.docId}/figures`);
    if (!els.figureList) return;
    els.figureList.innerHTML = "";
    for (const fig of state.figureCache) {
      els.figureList.appendChild(figureCard(fig));
    }
  }

  function bindEvents() {
    els.loadParagraphsBtn?.addEventListener("click", loadParagraphs);
    els.loadFiguresBtn?.addEventListener("click", loadFigures);
  }

  async function init() {
    bindEvents();
    await loadParagraphs();
    await loadFigures();
  }

  init().catch((err) => {
    console.error(err);
    showToast(err.message || "初期化に失敗しました", true);
  });
})();