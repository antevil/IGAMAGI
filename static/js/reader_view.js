(() => {
  const boot = window.READER_BOOTSTRAP;
  if (!boot || !boot.docId) return;

  const state = {
    docId: boot.docId,
    paragraphCache: [],
    figureCache: [],
    openParagraphId: null,
    openFigureId: null,
    currentSentenceId: null,
    currentFigureId: null,
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
      .replaceAll("'", "&#39;");
  }

  function getQueryParam(name) {
    const url = new URL(window.location.href);
    return url.searchParams.get(name);
  }

  function applyInitialParagraphFromQuery() {
    const paragraphId = getQueryParam("paragraph_id");
    if (!paragraphId) return;
    const id = Number(paragraphId);
    if (!Number.isFinite(id)) return;
    state.openParagraphId = id;
  }

  function applyInitialFigureFromQuery() {
    const figureId = getQueryParam("figure_id");
    if (!figureId) return;
    const id = Number(figureId);
    if (!Number.isFinite(id)) return;
    state.openFigureId = id;
  }

  function paragraphCard(paragraph) {
    const isOpen = state.openParagraphId === paragraph.id;

    const card = document.createElement("div");
    card.dataset.paragraphId = String(paragraph.id);
    card.className = isOpen
      ? "rounded-xl border border-zinc-700 bg-zinc-900/80"
      : "rounded-xl border border-zinc-800 bg-zinc-950/70";

    const head = document.createElement("button");
    head.type = "button";
    head.className =
      "w-full p-4 text-left flex items-start justify-between gap-3 hover:bg-zinc-900/60";
    head.innerHTML = `
      <div class="min-w-0">
        <div class="font-medium text-zinc-100">
          #${paragraph.order_index} ${escapeHtml(paragraph.heading_text || "(no heading)")}
        </div>
        <div class="mt-1 text-xs text-zinc-400">
          ${escapeHtml(paragraph.unit_type)} / p.${paragraph.page_no + 1} - ${paragraph.end_page_no + 1}
        </div>
      </div>
      <div class="shrink-0 text-zinc-400">${isOpen ? "▲" : "▼"}</div>
    `;

    const body = document.createElement("div");
    body.className = `px-4 pb-4 space-y-3 ${isOpen ? "" : "hidden"}`;

    const actionRow = document.createElement("div");
    actionRow.className = "flex justify-end gap-2";
    actionRow.innerHTML = `
      <button class="editBtn rounded-lg border border-zinc-700 px-3 py-1.5 text-sm hover:bg-zinc-900/70">
        再編集
      </button>
      <button class="splitBtn rounded-lg border border-zinc-700 px-3 py-1.5 text-sm hover:bg-zinc-900/70">
        再分割+再翻訳
      </button>
    `;
    body.appendChild(actionRow);

    for (const sentence of paragraph.sentences || []) {
      const block = document.createElement("div");
      block.className =
        "sentence-block rounded-lg border border-zinc-800 bg-zinc-900/70 p-3 space-y-2";
      block.dataset.sentenceId = String(sentence.id);
      block.innerHTML = `
        <div class="text-sm text-zinc-100">${escapeHtml(sentence.source_text)}</div>
        <div class="text-sm text-zinc-300">${escapeHtml(sentence.translated_text || "")}</div>
      `;
      body.appendChild(block);
    }

    if (!paragraph.sentences || paragraph.sentences.length === 0) {
      const empty = document.createElement("div");
      empty.className = "text-sm text-zinc-400";
      empty.textContent = "まだ文がありません";
      body.appendChild(empty);
    }

    head.addEventListener("click", () => {
      state.openParagraphId =
        state.openParagraphId === paragraph.id ? null : paragraph.id;
      renderParagraphList();
      scrollToOpenParagraph();
    });

    card.appendChild(head);
    card.appendChild(body);

    body.querySelector(".editBtn").addEventListener("click", (event) => {
      event.stopPropagation();
      window.location.href = `/docs/${state.docId}/setup?page=${paragraph.page_no}&edit_paragraph_id=${paragraph.id}`;
    });

    body.querySelector(".splitBtn").addEventListener("click", async (event) => {
      event.stopPropagation();
      await fetchJSON(`/api/paragraphs/${paragraph.id}/split_sentences`, {
        method: "POST",
      });
      await fetchJSON(`/api/paragraphs/${paragraph.id}/translate`, {
        method: "POST",
      });
      await loadParagraphs();
      state.openParagraphId = paragraph.id;
      renderParagraphList();
      showToast("段落を再分割・再翻訳しました");
    });

    return card;
  }

  function addParagraphCard() {
    const wrap = document.createElement("div");
    wrap.className = "flex justify-center py-2";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className =
      "h-12 w-12 rounded-full border border-dashed border-zinc-600 text-2xl text-zinc-300 hover:bg-zinc-900/70";
    btn.textContent = "＋";
    btn.addEventListener("click", () => {
      const last = state.paragraphCache.at(-1);
      const page = last ? last.end_page_no : 0;
      window.location.href = `/docs/${state.docId}/setup?page=${page}`;
    });

    wrap.appendChild(btn);
    return wrap;
  }

  function renderParagraphList() {
    if (!els.paragraphList) return;
    els.paragraphList.innerHTML = "";
    for (const p of state.paragraphCache) {
      els.paragraphList.appendChild(paragraphCard(p));
    }
    els.paragraphList.appendChild(addParagraphCard());
  }

  async function loadParagraphs() {
    state.paragraphCache = await fetchJSON(`/api/docs/${state.docId}/paragraphs`);
    renderParagraphList();
  }

  function scrollToOpenParagraph() {
    if (!els.paragraphList) return;
    if (state.openParagraphId == null) return;

    const card = els.paragraphList.querySelector(
      `[data-paragraph-id="${state.openParagraphId}"]`
    );
    if (!card) return;

    requestAnimationFrame(() => {
      card.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function figureCard(figure) {
    const isOpen = state.openFigureId === figure.id;

    const card = document.createElement("div");
    card.dataset.figureId = String(figure.id);
    card.className = isOpen
      ? "figure-card rounded-xl border border-zinc-700 bg-zinc-900/80 p-4 space-y-3"
      : "figure-card rounded-xl border border-zinc-800 bg-zinc-950/70 p-4 space-y-3";

    const imgSrc = figure.image_path || "";

    card.innerHTML = `
      <div class="flex items-start justify-between gap-3">
        <div>
          <div class="font-medium text-zinc-100">${escapeHtml(figure.fig_no || "FIG")}</div>
          <div class="mt-1 text-xs text-zinc-400">page ${Number(figure.page_no) + 1}</div>
        </div>
        <button class="editFigureBtn rounded-lg border border-zinc-700 px-3 py-1.5 text-sm hover:bg-zinc-900/70">
          編集
        </button>
      </div>

      ${imgSrc ? `<img src="${escapeHtml(imgSrc)}" class="w-full rounded-lg border border-zinc-800" alt="${escapeHtml(figure.fig_no || "figure")}">` : ""}

      <div class="space-y-2">
        <div class="text-sm text-zinc-300 whitespace-pre-wrap">
          ${escapeHtml(figure.caption_normalized_text || figure.caption_text || "")}
        </div>
        <div class="text-sm text-zinc-400 whitespace-pre-wrap">
          ${escapeHtml(figure.caption_translated_text || "")}
        </div>
      </div>
    `;

    card.querySelector(".editFigureBtn").addEventListener("click", () => {
      window.location.href = `/docs/${state.docId}/setup?page=${figure.page_no}&edit_figure_id=${figure.id}`;
    });

    return card;
  }

  function addFigureCard() {
    const wrap = document.createElement("div");
    wrap.className = "flex justify-center py-2";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className =
      "h-12 w-12 rounded-full border border-dashed border-zinc-600 text-2xl text-zinc-300 hover:bg-zinc-900/70";
    btn.textContent = "＋";
    btn.addEventListener("click", () => {
      const last = state.figureCache.at(-1);
      const page = last ? last.page_no : 0;
      const nextFigNo = String(state.figureCache.length + 1);

      window.location.href =
        `/docs/${state.docId}/setup?page=${page}&mode=figure&next_fig_no=${encodeURIComponent(nextFigNo)}`;
    });

    wrap.appendChild(btn);
    return wrap;
  }

  function renderFigureList() {
    if (!els.figureList) return;
    els.figureList.innerHTML = "";
    for (const fig of state.figureCache) {
      els.figureList.appendChild(figureCard(fig));
    }
    els.figureList.appendChild(addFigureCard());
  }

  let saveTimer = null;

  function scheduleSaveReadingPosition() {
    clearTimeout(saveTimer);

    saveTimer = setTimeout(async () => {
      const sentenceId = getCurrentSentenceId();
      if (!sentenceId) return;

      if (state.currentSentenceId === sentenceId) return;

      state.currentSentenceId = sentenceId;

      try {
        await fetchJSON(`/api/docs/${state.docId}/reading_position`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ sentence_id: sentenceId }),
        });
      } catch (err) {
        console.error("save reading position failed", err);
      }
    }, 1500);
  }
  function getCurrentSentenceId() {
    const container = els.paragraphList;
    if (!container) return null;

    const blocks = container.querySelectorAll(".sentence-block");
    if (!blocks.length) return null;

    const containerRect = container.getBoundingClientRect();
    const centerY = containerRect.top + containerRect.height / 2;

    let best = null;
    let bestDist = Infinity;

    for (const el of blocks) {
      const rect = el.getBoundingClientRect();
      const elCenter = rect.top + rect.height / 2;
      const dist = Math.abs(elCenter - centerY);

      if (dist < bestDist) {
        bestDist = dist;
        best = el;
      }
    }

    return best ? Number(best.dataset.sentenceId) : null;
  }

  function getCurrentFigureId() {
  const container = els.figureList;
  if (!container) return null;

  const cards = container.querySelectorAll(".figure-card");
  if (!cards.length) return null;

  const containerRect = container.getBoundingClientRect();
  const centerY = containerRect.top + containerRect.height / 2;

  let best = null;
  let bestDist = Infinity;

  for (const el of cards) {
    const rect = el.getBoundingClientRect();
    const elCenter = rect.top + rect.height / 2;
    const dist = Math.abs(elCenter - centerY);

    if (dist < bestDist) {
      bestDist = dist;
      best = el;
    }
  }

  return best ? Number(best.dataset.figureId) : null;
}

let saveFigureTimer = null;

function scheduleSaveFigurePosition() {
  clearTimeout(saveFigureTimer);

  saveFigureTimer = setTimeout(async () => {
    const figureId = getCurrentFigureId();
    if (!figureId) return;

    if (state.currentFigureId === figureId) return;

    state.currentFigureId = figureId;

    try {
      await fetchJSON(`/api/docs/${state.docId}/reading_position`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ figure_id: figureId }),
      });
    } catch (err) {
      console.error("save figure position failed", err);
    }
  }, 1500);
}

  async function restoreReadingPosition() {
  try {
    const data = await fetchJSON(`/api/docs/${state.docId}/reading_position`);
    const sentenceId = data.last_sentence_id;

    if (!sentenceId) return;

    const ownerParagraph = state.paragraphCache.find((paragraph) =>
      (paragraph.sentences || []).some((sentence) => Number(sentence.id) === sentenceId)
    );
    if (!ownerParagraph) return;

    state.openParagraphId = ownerParagraph.id;
    renderParagraphList();

    requestAnimationFrame(() => {
      const el = document.querySelector(
        `.sentence-block[data-sentence-id="${sentenceId}"]`
      );
      if (!el) return;

      el.scrollIntoView({ behavior: "auto", block: "center" });

      // 軽くハイライト
      el.classList.add("ring-2", "ring-indigo-500");
      setTimeout(() => {
        el.classList.remove("ring-2", "ring-indigo-500");
      }, 1500);
    });
  } catch (err) {
    console.error("restore failed", err);
  }
}

async function restoreFigurePosition() {
  try {
    const data = await fetchJSON(`/api/docs/${state.docId}/reading_position`);
    const figureId = Number(data.last_figure_id);
    if (!figureId) return;

    requestAnimationFrame(() => {
      const el = document.querySelector(
        `.figure-card[data-figure-id="${figureId}"]`
      );
      if (!el) return;

      el.scrollIntoView({ behavior: "auto", block: "center" });
      el.classList.add("ring-2", "ring-indigo-500");

      setTimeout(() => {
        el.classList.remove("ring-2", "ring-indigo-500");
      }, 1500);
    });
  } catch (err) {
    console.error("restore figure failed", err);
  }
}

  async function loadFigures() {
    state.figureCache = await fetchJSON(`/api/docs/${state.docId}/figures`);
    renderFigureList();
  }

  function scrollToOpenFigure() {
    if (!els.figureList) return;
    if (state.openFigureId == null) return;

    const card = els.figureList.querySelector(
      `[data-figure-id="${state.openFigureId}"]`
    );
    if (!card) return;

    requestAnimationFrame(() => {
      card.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function bindEvents() {
    els.loadParagraphsBtn?.addEventListener("click", loadParagraphs);
    els.loadFiguresBtn?.addEventListener("click", loadFigures);

    els.paragraphList?.addEventListener("scroll", () => {
      scheduleSaveReadingPosition();
    });

    els.figureList?.addEventListener("scroll", () => {
      scheduleSaveFigurePosition();
    });
  }

  async function init() {
    bindEvents();
    applyInitialParagraphFromQuery();
    applyInitialFigureFromQuery();

    await loadParagraphs();
    await restoreReadingPosition();
    await loadFigures();
    await restoreFigurePosition();
    scrollToOpenParagraph();
    scrollToOpenFigure();
  }

  init().catch((err) => {
    console.error(err);
    showToast(err.message || "初期化に失敗しました", true);
  });
})();