(() => {
  const boot = window.READER_BOOTSTRAP;
  if (!boot || !boot.docId) return;

  const state = {
    docId: boot.docId,
    paragraphCache: [],
    figureCache: [],
    openParagraphId: null,
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
      <div class="space-y-1">
        <div class="font-semibold text-zinc-100">
          #${paragraph.order_index} ${escapeHtml(paragraph.heading_text || "(no heading)")}
        </div>
        <div class="text-xs text-zinc-400">
          ${escapeHtml(paragraph.unit_type)} / p.${paragraph.page_no + 1} - ${paragraph.end_page_no + 1}
        </div>
      </div>
      <div class="shrink-0 text-zinc-400">
        ${isOpen ? "▲" : "▼"}
      </div>
    `;

    const body = document.createElement("div");
    body.className = `px-4 pb-4 space-y-3 ${isOpen ? "" : "hidden"}`;

    const actionRow = document.createElement("div");
    actionRow.className = "flex justify-end";
    actionRow.innerHTML = `
      <button class="editBtn rounded-lg border border-zinc-700 px-3 py-1 text-sm hover:bg-zinc-800">
        再編集
      </button>
      <button class="splitBtn rounded-lg border border-zinc-700 px-3 py-1 text-sm hover:bg-zinc-800">
        再分割+再翻訳
      </button>
    `;
    body.appendChild(actionRow);

    for (const sentence of paragraph.sentences || []) {
      const block = document.createElement("div");
      block.className = "rounded-lg border border-zinc-800 bg-zinc-900/70 p-3 space-y-2";
      block.innerHTML = `
        <div class="text-sm text-zinc-100 whitespace-pre-wrap">
          ${escapeHtml(sentence.source_text)}
        </div>
        <div class="text-sm text-sky-200 whitespace-pre-wrap">
          ${escapeHtml(sentence.translated_text || "")}
        </div>
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
      if (state.openParagraphId === paragraph.id) {
        state.openParagraphId = null;
      } else {
        state.openParagraphId = paragraph.id;
      }
      renderParagraphList();
      scrollToOpenParagraph();
    });

    card.appendChild(head);
    card.appendChild(body);

    body.querySelector(".editBtn").addEventListener("click", (event) => {
      //パラグラフ編集ボタンのクリックイベント
       event.stopPropagation();
  window.location.href =
    `/docs/${state.docId}/setup?page=${paragraph.page_no}&edit_paragraph_id=${paragraph.id}`;
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
      card.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
}
  function figureCard(figure) {
    const card = document.createElement("div");
    card.className = "rounded-xl border border-zinc-800 bg-zinc-950/70 p-4 space-y-3";
    const imgSrc = figure.image_path || "";

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
  applyInitialParagraphFromQuery();
  await loadParagraphs();
  scrollToOpenParagraph();
  await loadFigures();
}

  init().catch((err) => {
    console.error(err);
    showToast(err.message || "初期化に失敗しました", true);
  });
})();