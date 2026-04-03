(() => {
  const boot = window.READER_BOOTSTRAP;
  if (!boot || !boot.docId) return;

  const JA_UI_STORAGE_KEY = `igamagi_reader_ja_ui_${boot.docId}`;
  const READER_LAYOUT_STORAGE_KEY = `igamagi_reader_layout_${boot.docId}`;

  const state = {
    docId: boot.docId,
    paragraphCache: [],
    figureCache: [],
    openParagraphId: null,
    openFigureId: null,
    currentSentenceId: null,
    currentFigureId: null,

    // 日本語表示制御
    allJapaneseOpen: false,
    openSentenceIds: [],

    // レイアウト制御
    textPaneRatio: 0.58,
    isDraggingDivider: false,
  };

  const $ = (id) => document.getElementById(id);

  const els = {
    paragraphList: $("paragraphList"),
    figureList: $("figureList"),
    toast: $("toast"),
    openAllJaBtn: $("openAllJaBtn"),
    closeAllJaBtn: $("closeAllJaBtn"),

    readerSplitRoot: $("readerSplitRoot"),
    textPane: $("textPane"),
    figurePane: $("figurePane"),
    splitDivider: $("splitDivider"),
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
    return String(text ?? "")
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

  function uniqueNumberArray(values) {
    return [...new Set((values || []).map((x) => Number(x)).filter((x) => Number.isFinite(x)))];
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function saveJapaneseUiState() {
    try {
      const payload = {
        allJapaneseOpen: Boolean(state.allJapaneseOpen),
        openSentenceIds: uniqueNumberArray(state.openSentenceIds),
      };
      localStorage.setItem(JA_UI_STORAGE_KEY, JSON.stringify(payload));
    } catch (err) {
      console.error("saveJapaneseUiState failed", err);
    }
  }

  function loadJapaneseUiState() {
    try {
      const raw = localStorage.getItem(JA_UI_STORAGE_KEY);
      if (!raw) return;

      const data = JSON.parse(raw);
      state.allJapaneseOpen = Boolean(data?.allJapaneseOpen);
      state.openSentenceIds = uniqueNumberArray(data?.openSentenceIds || []);
    } catch (err) {
      console.error("loadJapaneseUiState failed", err);
      state.allJapaneseOpen = false;
      state.openSentenceIds = [];
    }
  }

  function saveReaderLayoutState() {
    try {
      const payload = {
        textPaneRatio: Number(state.textPaneRatio),
      };
      localStorage.setItem(READER_LAYOUT_STORAGE_KEY, JSON.stringify(payload));
    } catch (err) {
      console.error("saveReaderLayoutState failed", err);
    }
  }

  function loadReaderLayoutState() {
    try {
      const raw = localStorage.getItem(READER_LAYOUT_STORAGE_KEY);
      if (!raw) return;

      const data = JSON.parse(raw);
      const ratio = Number(data?.textPaneRatio);
      if (!Number.isFinite(ratio)) return;

      state.textPaneRatio = clamp(ratio, 0.25, 0.75);
    } catch (err) {
      console.error("loadReaderLayoutState failed", err);
      state.textPaneRatio = 0.58;
    }
  }

  function applyReaderLayout() {
    if (!els.textPane || !els.figurePane) return;

    const ratio = clamp(Number(state.textPaneRatio) || 0.58, 0.25, 0.75);
    state.textPaneRatio = ratio;

    els.textPane.style.width = `${ratio * 100}%`;
    els.figurePane.style.width = `${(1 - ratio) * 100}%`;
  }

  function updateReaderLayoutFromClientX(clientX) {
    if (!els.readerSplitRoot) return;

    const rect = els.readerSplitRoot.getBoundingClientRect();
    if (!rect.width) return;

    const nextRatio = (clientX - rect.left) / rect.width;
    state.textPaneRatio = clamp(nextRatio, 0.25, 0.75);
    applyReaderLayout();
  }

  function startDividerDrag(event) {
    event.preventDefault();
    state.isDraggingDivider = true;
    document.body.classList.add("select-none");
  }

  function handleDividerPointerMove(event) {
    if (!state.isDraggingDivider) return;
    updateReaderLayoutFromClientX(event.clientX);
  }

  function stopDividerDrag() {
    if (!state.isDraggingDivider) return;
    state.isDraggingDivider = false;
    document.body.classList.remove("select-none");
    saveReaderLayoutState();
  }

  function handleDividerKeydown(event) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;

    event.preventDefault();

    if (event.key === "ArrowLeft") {
      state.textPaneRatio = clamp(state.textPaneRatio - 0.03, 0.25, 0.75);
    } else if (event.key === "ArrowRight") {
      state.textPaneRatio = clamp(state.textPaneRatio + 0.03, 0.25, 0.75);
    } else if (event.key === "Home") {
      state.textPaneRatio = 0.35;
    } else if (event.key === "End") {
      state.textPaneRatio = 0.65;
    }

    applyReaderLayout();
    saveReaderLayoutState();
  }

  function isJapaneseOpen(sentenceId) {
    if (state.allJapaneseOpen) return true;
    return state.openSentenceIds.includes(Number(sentenceId));
  }

  function setJapaneseOpenForSentence(sentenceId, shouldOpen) {
    const id = Number(sentenceId);
    if (!Number.isFinite(id)) return;

    const current = new Set(state.openSentenceIds);
    if (shouldOpen) {
      current.add(id);
    } else {
      current.delete(id);
    }
    state.openSentenceIds = [...current];
    saveJapaneseUiState();
  }

  function openAllJapanese() {
    state.allJapaneseOpen = true;
    saveJapaneseUiState();
    renderParagraphList();
    refreshCurrentSentenceHighlight();
    showToast("日本語をすべて表示しました");
  }

  function closeAllJapanese() {
    state.allJapaneseOpen = false;
    state.openSentenceIds = [];
    saveJapaneseUiState();
    renderParagraphList();
    refreshCurrentSentenceHighlight();
    showToast("日本語をすべて閉じました");
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

  function getSentenceOwnerParagraph(sentenceId) {
    const targetId = Number(sentenceId);
    return state.paragraphCache.find((paragraph) =>
      (paragraph.sentences || []).some((sentence) => Number(sentence.id) === targetId)
    ) || null;
  }

  function findSentencePosition(sentenceId) {
    const targetId = Number(sentenceId);

    for (let pIndex = 0; pIndex < state.paragraphCache.length; pIndex += 1) {
      const paragraph = state.paragraphCache[pIndex];
      const sentences = paragraph.sentences || [];

      for (let sIndex = 0; sIndex < sentences.length; sIndex += 1) {
        if (Number(sentences[sIndex].id) === targetId) {
          return { pIndex, sIndex };
        }
      }
    }

    return null;
  }

  function getAdjacentSentenceId(currentSentenceId, step) {
    const pos = findSentencePosition(currentSentenceId);
    if (!pos) return null;

    const { pIndex, sIndex } = pos;
    const sentences = state.paragraphCache[pIndex].sentences || [];

    if (step > 0) {
      if (sIndex + 1 < sentences.length) {
        return Number(sentences[sIndex + 1].id);
      }

      for (let i = pIndex + 1; i < state.paragraphCache.length; i += 1) {
        const nextSentences = state.paragraphCache[i].sentences || [];
        if (nextSentences.length) {
          return Number(nextSentences[0].id);
        }
      }
    } else if (step < 0) {
      if (sIndex - 1 >= 0) {
        return Number(sentences[sIndex - 1].id);
      }

      for (let i = pIndex - 1; i >= 0; i -= 1) {
        const prevSentences = state.paragraphCache[i].sentences || [];
        if (prevSentences.length) {
          return Number(prevSentences[prevSentences.length - 1].id);
        }
      }
    }

    return null;
  }

  function updateCurrentSentenceVisual() {
    if (!els.paragraphList) return;

    const blocks = els.paragraphList.querySelectorAll(".sentence-block");
    for (const block of blocks) {
      const sentenceId = Number(block.dataset.sentenceId);
      const isCurrent = Number(state.currentSentenceId) === sentenceId;

      block.classList.toggle("ring-1", isCurrent);
      block.classList.toggle("ring-indigo-500", isCurrent);
      block.classList.toggle("border-indigo-500/60", isCurrent);
      block.classList.toggle("border-zinc-800", !isCurrent);
    }
  }

  function refreshCurrentSentenceHighlight() {
    requestAnimationFrame(() => {
      updateCurrentSentenceVisual();
    });
  }

  function flashSentence(sentenceId) {
    requestAnimationFrame(() => {
      const el = document.querySelector(`.sentence-block[data-sentence-id="${sentenceId}"]`);
      if (!el) return;

      el.classList.add("ring-2", "ring-indigo-400");
      setTimeout(() => {
        el.classList.remove("ring-2", "ring-indigo-400");
      }, 900);
    });
  }

  async function saveReadingPosition(sentenceId) {
    const id = Number(sentenceId);
    if (!id) return;

    try {
      await fetchJSON(`/api/docs/${state.docId}/reading_position`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sentence_id: id }),
      });
    } catch (err) {
      console.error("save reading position failed", err);
    }
  }

  function focusSentence(sentenceId, options = {}) {
    const id = Number(sentenceId);
    if (!Number.isFinite(id)) return;

    const {
      behavior = "smooth",
      shouldFlash = false,
      savePosition = true,
    } = options;

    const ownerParagraph = getSentenceOwnerParagraph(id);
    if (!ownerParagraph) return;

    state.openParagraphId = ownerParagraph.id;
    state.currentSentenceId = id;
    renderParagraphList();

    requestAnimationFrame(() => {
      const el = document.querySelector(`.sentence-block[data-sentence-id="${id}"]`);
      if (!el) return;

      el.scrollIntoView({ behavior, block: "center" });
      updateCurrentSentenceVisual();

      if (shouldFlash) {
        flashSentence(id);
      }

      if (savePosition) {
        saveReadingPosition(id);
      }
    });
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

  function getActiveSentenceId() {
    if (Number.isFinite(Number(state.currentSentenceId)) && Number(state.currentSentenceId) > 0) {
      return Number(state.currentSentenceId);
    }
    return getCurrentSentenceId();
  }

  function moveSentence(step) {
    const currentId = getActiveSentenceId();
    if (!currentId) return;

    const nextId = getAdjacentSentenceId(currentId, step);
    if (!nextId) {
      showToast(step > 0 ? "最後の文です" : "最初の文です");
      return;
    }

    focusSentence(nextId, {
      behavior: "smooth",
      shouldFlash: true,
      savePosition: true,
    });
  }

  function openJapaneseForCurrentSentence() {
    const sentenceId = getActiveSentenceId();
    if (!sentenceId) return;

    setJapaneseOpenForSentence(sentenceId, true);
    renderParagraphList();

    requestAnimationFrame(() => {
      const el = document.querySelector(`.sentence-block[data-sentence-id="${sentenceId}"]`);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      state.currentSentenceId = sentenceId;
      updateCurrentSentenceVisual();
      flashSentence(sentenceId);
    });
  }

  function closeJapaneseForCurrentSentence() {
    const sentenceId = getActiveSentenceId();
    if (!sentenceId) return;

    if (state.allJapaneseOpen) {
      showToast("全部オープン中です。ボタンで閉じてください");
      return;
    }

    setJapaneseOpenForSentence(sentenceId, false);
    renderParagraphList();

    requestAnimationFrame(() => {
      const el = document.querySelector(`.sentence-block[data-sentence-id="${sentenceId}"]`);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      state.currentSentenceId = sentenceId;
      updateCurrentSentenceVisual();
      flashSentence(sentenceId);
    });
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
    `;
    body.appendChild(actionRow);

    for (const sentence of paragraph.sentences || []) {
      const sentenceId = Number(sentence.id);
      const jaOpen = isJapaneseOpen(sentenceId);
      const isCurrent = Number(state.currentSentenceId) === sentenceId;

      const block = document.createElement("div");
      block.className = [
        "sentence-block rounded-lg border bg-zinc-900/70 p-3 space-y-2 transition",
        isCurrent ? "ring-1 ring-indigo-500 border-indigo-500/60" : "border-zinc-800",
      ].join(" ");
      block.dataset.sentenceId = String(sentenceId);

      block.innerHTML = `
        <div class="text-xs text-zinc-500">Sentence ${sentenceId}</div>
        <div class="text-sm leading-7 text-zinc-100 whitespace-pre-wrap">
          ${escapeHtml(sentence.source_text)}
        </div>
        <div class="${jaOpen ? "" : "hidden"} text-sm leading-7 text-zinc-300 whitespace-pre-wrap" data-role="jaText">
          ${escapeHtml(sentence.translated_text || "")}
        </div>
      `;

      block.addEventListener("click", () => {
        state.currentSentenceId = sentenceId;
        updateCurrentSentenceVisual();
      });

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

  let saveTimer = null;

  function scheduleSaveReadingPosition() {
    clearTimeout(saveTimer);

    saveTimer = setTimeout(async () => {
      const sentenceId = getCurrentSentenceId();
      if (!sentenceId) return;

      if (state.currentSentenceId === sentenceId) return;

      state.currentSentenceId = sentenceId;
      updateCurrentSentenceVisual();
      await saveReadingPosition(sentenceId);
    }, 1500);
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
    if (state.openParagraphId) return;

    try {
      const data = await fetchJSON(`/api/docs/${state.docId}/reading_position`);
      const sentenceId = Number(data.last_sentence_id);
      if (!sentenceId) return;

      focusSentence(sentenceId, {
        behavior: "auto",
        shouldFlash: true,
        savePosition: false,
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
        const el = document.querySelector(`.figure-card[data-figure-id="${figureId}"]`);
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

  function isEditableTarget(target) {
    if (!target) return false;
    const tag = target.tagName;
    return (
      tag === "INPUT" ||
      tag === "TEXTAREA" ||
      tag === "SELECT" ||
      target.isContentEditable
    );
  }

  function handleKeydown(event) {
    if (isEditableTarget(event.target)) return;

    const key = String(event.key || "").toLowerCase();

    if (event.target === els.splitDivider) {
      if (["arrowleft", "arrowright", "home", "end"].includes(key)) {
        handleDividerKeydown(event);
        return;
      }
    }

    if (event.repeat) return;
    if (!["w", "a", "s", "d"].includes(key)) return;

    event.preventDefault();

    if (key === "w") {
      moveSentence(-1);
      return;
    }

    if (key === "s") {
      moveSentence(1);
      return;
    }

    if (key === "d") {
      openJapaneseForCurrentSentence();
      return;
    }

    if (key === "a") {
      closeJapaneseForCurrentSentence();
    }
  }

  function bindEvents() {
    els.paragraphList?.addEventListener("scroll", () => {
      scheduleSaveReadingPosition();
    });

    els.figureList?.addEventListener("scroll", () => {
      scheduleSaveFigurePosition();
    });

    els.openAllJaBtn?.addEventListener("click", () => {
      openAllJapanese();
    });

    els.closeAllJaBtn?.addEventListener("click", () => {
      closeAllJapanese();
    });

    els.splitDivider?.addEventListener("mousedown", startDividerDrag);
    document.addEventListener("mousemove", handleDividerPointerMove);
    document.addEventListener("mouseup", stopDividerDrag);
    document.addEventListener("mouseleave", stopDividerDrag);
    els.splitDivider?.addEventListener("keydown", handleDividerKeydown);

    window.addEventListener("resize", () => {
      applyReaderLayout();
    });

    document.addEventListener("keydown", handleKeydown);
  }

  async function init() {
    loadJapaneseUiState();
    loadReaderLayoutState();
    applyReaderLayout();

    bindEvents();
    applyInitialParagraphFromQuery();
    applyInitialFigureFromQuery();

    await loadParagraphs();
    await restoreReadingPosition();
    await loadFigures();
    await restoreFigurePosition();

    scrollToOpenParagraph();
    scrollToOpenFigure();

    if (!state.currentSentenceId) {
      const firstParagraphWithSentence = state.paragraphCache.find(
        (paragraph) => (paragraph.sentences || []).length > 0
      );

      if (firstParagraphWithSentence) {
        state.openParagraphId = state.openParagraphId || firstParagraphWithSentence.id;
        state.currentSentenceId = Number(firstParagraphWithSentence.sentences[0].id);
        renderParagraphList();
        refreshCurrentSentenceHighlight();
      }
    }
  }

  init().catch((err) => {
    console.error(err);
    showToast(err.message || "初期化に失敗しました", true);
  });
})();