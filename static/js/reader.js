(() => {
  const boot = window.READER_BOOTSTRAP;
  const state = {
    docId: boot.docId,
    pageNo: boot.initialPageNo || 0,
    lines: [],
    pageNaturalWidth: 1,
    pageNaturalHeight: 1,
    startLineId: null,
    endLineId: null,
    imageBBox: null,
    captionBBox: null,
    drawing: null,
    paragraphCache: [],
    figureCache: [],
  };

  const $ = (id) => document.getElementById(id);
  const els = {
    pageSelect: $("pageSelect"),
    reloadBtn: $("reloadBtn"),
    titleInput: $("titleInput"),
    saveTitleBtn: $("saveTitleBtn"),
    pageImage: $("pageImage"),
    lineOverlay: $("lineOverlay"),
    figureOverlay: $("figureOverlay"),
    startLineId: $("startLineId"),
    endLineId: $("endLineId"),
    orderIndex: $("orderIndex"),
    unitType: $("unitType"),
    headingText: $("headingText"),
    saveParagraphBtn: $("saveParagraphBtn"),
    clearSelectionBtn: $("clearSelectionBtn"),
    selectionStatus: $("selectionStatus"),
    paragraphList: $("paragraphList"),
    loadParagraphsBtn: $("loadParagraphsBtn"),
    figNoInput: $("figNoInput"),
    figurePageNo: $("figurePageNo"),
    captionTextInput: $("captionTextInput"),
    imageBboxText: $("imageBboxText"),
    captionBboxText: $("captionBboxText"),
    saveFigureBtn: $("saveFigureBtn"),
    clearFigureSelectionBtn: $("clearFigureSelectionBtn"),
    figureList: $("figureList"),
    loadFiguresBtn: $("loadFiguresBtn"),
    toast: $("toast"),
  };

  function showToast(message, isError = false) {
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

  function syncOverlaySize() {
    const rect = els.pageImage.getBoundingClientRect();
    const wrap = els.pageImage.parentElement;
    els.lineOverlay.style.width = `${rect.width}px`;
    els.lineOverlay.style.height = `${rect.height}px`;
    els.figureOverlay.style.width = `${rect.width}px`;
    els.figureOverlay.style.height = `${rect.height}px`;
  }

  function scaleX(x) {
    return x / state.pageNaturalWidth * els.pageImage.clientWidth;
  }

  function scaleY(y) {
    return y / state.pageNaturalHeight * els.pageImage.clientHeight;
  }

  function unscaleX(x) {
    return x / els.pageImage.clientWidth * state.pageNaturalWidth;
  }

  function unscaleY(y) {
    return y / els.pageImage.clientHeight * state.pageNaturalHeight;
  }

  function updateSelectionFields() {
    els.startLineId.value = state.startLineId ?? "";
    els.endLineId.value = state.endLineId ?? "";
    if (!state.startLineId && !state.endLineId) {
      els.selectionStatus.textContent = "開始行と終了行を選択";
    } else if (state.startLineId && !state.endLineId) {
      els.selectionStatus.textContent = "終了行を選択してください";
    } else {
      els.selectionStatus.textContent = "保存できます";
    }
  }

  function compareLineOrder(a, b) {
    if (a.page_no !== b.page_no) return a.page_no - b.page_no;
    return a.line_no - b.line_no;
  }

  function isWithinSelectedRange(line) {
    if (!state.startLineId || !state.endLineId) return false;
    const start = state.lines.find((x) => x.id === state.startLineId);
    const end = state.lines.find((x) => x.id === state.endLineId);
    if (!start || !end || start.page_no !== end.page_no) return false;
    const [lo, hi] = [start.line_no, end.line_no].sort((a, b) => a - b);
    return line.line_no >= lo && line.line_no <= hi;
  }

  function renderLines() {
    els.lineOverlay.innerHTML = "";
    const fragment = document.createDocumentFragment();
    for (const line of state.lines) {
      const div = document.createElement("button");
      div.type = "button";
      div.className = "line-box";
      if (line.id === state.startLineId) div.classList.add("selected-start");
      if (line.id === state.endLineId) div.classList.add("selected-end");
      if (isWithinSelectedRange(line) && line.id !== state.startLineId && line.id !== state.endLineId) {
        div.classList.add("selected-between");
      }
      div.style.left = `${scaleX(line.x0)}px`;
      div.style.top = `${scaleY(line.y0)}px`;
      div.style.width = `${Math.max(3, scaleX(line.x1) - scaleX(line.x0))}px`;
      div.style.height = `${Math.max(3, scaleY(line.y1) - scaleY(line.y0))}px`;
      div.title = `${line.line_no}: ${line.text}`;
      div.addEventListener("click", () => selectLine(line));
      fragment.appendChild(div);
    }
    els.lineOverlay.appendChild(fragment);
  }

  function renderFigureBoxes() {
    els.figureOverlay.querySelectorAll(".draw-rect").forEach((el) => el.remove());
    if (state.imageBBox) {
      const rect = document.createElement("div");
      rect.className = "draw-rect";
      placeRect(rect, state.imageBBox);
      els.figureOverlay.appendChild(rect);
    }
    if (state.captionBBox) {
      const rect = document.createElement("div");
      rect.className = "draw-rect caption";
      placeRect(rect, state.captionBBox);
      els.figureOverlay.appendChild(rect);
    }
  }

  function placeRect(el, bbox) {
    el.style.left = `${scaleX(bbox.x0)}px`;
    el.style.top = `${scaleY(bbox.y0)}px`;
    el.style.width = `${scaleX(bbox.x1) - scaleX(bbox.x0)}px`;
    el.style.height = `${scaleY(bbox.y1) - scaleY(bbox.y0)}px`;
  }

  function updateFigureTexts() {
    els.figurePageNo.value = state.pageNo;
    els.imageBboxText.textContent = `image_bbox: ${state.imageBBox ? JSON.stringify(state.imageBBox) : "未選択"}`;
    els.captionBboxText.textContent = `caption_bbox: ${state.captionBBox ? JSON.stringify(state.captionBBox) : "未選択"}`;
  }

  function selectLine(line) {
    if (!state.startLineId || (state.startLineId && state.endLineId)) {
      state.startLineId = line.id;
      state.endLineId = null;
    } else {
      state.endLineId = line.id;
      const start = state.lines.find((x) => x.id === state.startLineId);
      if (start && compareLineOrder(line, start) < 0) {
        state.endLineId = state.startLineId;
        state.startLineId = line.id;
      }
    }
    updateSelectionFields();
    renderLines();
  }

  function clearSelection() {
    state.startLineId = null;
    state.endLineId = null;
    updateSelectionFields();
    renderLines();
  }

  function clearFigureSelection() {
    state.imageBBox = null;
    state.captionBBox = null;
    updateFigureTexts();
    renderFigureBoxes();
  }

  async function loadPage(pageNo) {
    state.pageNo = Number(pageNo);
    els.pageImage.src = `/api/docs/${state.docId}/pages/${state.pageNo}/preview?ts=${Date.now()}`;
    els.pageImage.onload = async () => {
      state.pageNaturalWidth = els.pageImage.naturalWidth;
      state.pageNaturalHeight = els.pageImage.naturalHeight;
      syncOverlaySize();
      state.lines = await fetchJSON(`/api/docs/${state.docId}/pages/${state.pageNo}/lines`);
      renderLines();
      renderFigureBoxes();
      updateFigureTexts();
    };
  }

  async function saveTitle() {
    await fetchJSON(`/api/docs/${state.docId}/title`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: els.titleInput.value.trim() }),
    });
    showToast("タイトルを保存しました");
  }

  async function saveParagraph() {
    if (!state.startLineId || !state.endLineId) {
      showToast("開始行と終了行を選択してください", true);
      return;
    }
    const payload = {
      start_line_id: Number(state.startLineId),
      end_line_id: Number(state.endLineId),
      order_index: Number(els.orderIndex.value || 0),
      unit_type: els.unitType.value,
      heading_text: els.headingText.value.trim(),
    };
    const result = await fetchJSON(`/api/docs/${state.docId}/paragraphs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    await fetchJSON(`/api/paragraphs/${result.paragraph_id}/split_sentences`, { method: "POST" });
    const translateResult = await fetchJSON(`/api/paragraphs/${result.paragraph_id}/translate`, { method: "POST" });
    if (!translateResult.deepl_enabled) {
      showToast("段落保存。DeepLキー未設定のため翻訳は空です");
    } else {
      showToast("段落保存・文分割・翻訳まで完了しました");
    }
    els.orderIndex.value = Number(els.orderIndex.value || 0) + 1;
    clearSelection();
    await loadParagraphs();
  }

  function paragraphCard(paragraph) {
    const card = document.createElement("div");
    card.className = "rounded-xl border border-zinc-800 bg-zinc-950/70 p-4 space-y-3";
    const head = document.createElement("div");
    head.innerHTML = `
      <div class="flex items-center justify-between gap-3">
        <div>
          <div class="font-medium">#${paragraph.order_index} ${paragraph.heading_text || "(no heading)"}</div>
          <div class="text-xs text-zinc-400">${paragraph.unit_type} / p.${paragraph.page_no + 1} - ${paragraph.end_page_no + 1}</div>
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
    els.figureList.innerHTML = "";
    for (const fig of state.figureCache) {
      els.figureList.appendChild(figureCard(fig));
    }
  }

  async function saveFigure() {
    if (!state.imageBBox) {
      showToast("図本体のbboxを選択してください", true);
      return;
    }
    const payload = {
      fig_no: els.figNoInput.value.trim() || "FIG",
      page_no: state.pageNo,
      image_bbox: state.imageBBox,
      caption_bbox: state.captionBBox,
      caption_text: els.captionTextInput.value.trim(),
    };
    await fetchJSON(`/api/docs/${state.docId}/figures`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    showToast("Figureを保存しました");
    clearFigureSelection();
    els.figNoInput.value = "";
    els.captionTextInput.value = "";
    await loadFigures();
  }

  function escapeHtml(text) {
    return String(text)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function startDraw(event) {
    if (!(event.shiftKey || event.altKey)) return;
    event.preventDefault();
    const rect = els.figureOverlay.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    state.drawing = {
      mode: event.altKey ? "caption" : "image",
      x0: x,
      y0: y,
      x1: x,
      y1: y,
    };
    renderFigureBoxes();
  }

  function moveDraw(event) {
    if (!state.drawing) return;
    const rect = els.figureOverlay.getBoundingClientRect();
    state.drawing.x1 = Math.max(0, Math.min(rect.width, event.clientX - rect.left));
    state.drawing.y1 = Math.max(0, Math.min(rect.height, event.clientY - rect.top));

    const previewRect = document.createElement("div");
    previewRect.className = `draw-rect${state.drawing.mode === "caption" ? " caption" : ""}`;
    const x0 = Math.min(state.drawing.x0, state.drawing.x1);
    const y0 = Math.min(state.drawing.y0, state.drawing.y1);
    const x1 = Math.max(state.drawing.x0, state.drawing.x1);
    const y1 = Math.max(state.drawing.y0, state.drawing.y1);
    previewRect.style.left = `${x0}px`;
    previewRect.style.top = `${y0}px`;
    previewRect.style.width = `${x1 - x0}px`;
    previewRect.style.height = `${y1 - y0}px`;
    renderFigureBoxes();
    els.figureOverlay.appendChild(previewRect);
  }

  function endDraw() {
    if (!state.drawing) return;
    const x0 = Math.min(state.drawing.x0, state.drawing.x1);
    const y0 = Math.min(state.drawing.y0, state.drawing.y1);
    const x1 = Math.max(state.drawing.x0, state.drawing.x1);
    const y1 = Math.max(state.drawing.y0, state.drawing.y1);
    if (x1 - x0 >= 5 && y1 - y0 >= 5) {
      const bbox = {
        x0: Number(unscaleX(x0).toFixed(2)),
        y0: Number(unscaleY(y0).toFixed(2)),
        x1: Number(unscaleX(x1).toFixed(2)),
        y1: Number(unscaleY(y1).toFixed(2)),
      };
      if (state.drawing.mode === "caption") {
        state.captionBBox = bbox;
      } else {
        state.imageBBox = bbox;
      }
    }
    state.drawing = null;
    updateFigureTexts();
    renderFigureBoxes();
  }

  function bindEvents() {
    els.pageSelect.addEventListener("change", () => loadPage(els.pageSelect.value));
    els.reloadBtn.addEventListener("click", () => loadPage(state.pageNo));
    els.saveTitleBtn.addEventListener("click", saveTitle);
    els.saveParagraphBtn.addEventListener("click", saveParagraph);
    els.clearSelectionBtn.addEventListener("click", clearSelection);
    els.loadParagraphsBtn.addEventListener("click", loadParagraphs);
    els.saveFigureBtn.addEventListener("click", saveFigure);
    els.clearFigureSelectionBtn.addEventListener("click", clearFigureSelection);
    els.loadFiguresBtn.addEventListener("click", loadFigures);
    window.addEventListener("resize", () => {
      syncOverlaySize();
      renderLines();
      renderFigureBoxes();
    });
    els.figureOverlay.addEventListener("mousedown", startDraw);
    window.addEventListener("mousemove", moveDraw);
    window.addEventListener("mouseup", endDraw);
  }

  async function init() {
    bindEvents();
    updateSelectionFields();
    updateFigureTexts();
    if (els.pageSelect) {
      els.pageSelect.value = String(state.pageNo);
    }
    await loadPage(state.pageNo);
    await loadParagraphs();
    await loadFigures();
  }

  init().catch((err) => {
    console.error(err);
    showToast(err.message || "初期化に失敗しました", true);
  });
})();
