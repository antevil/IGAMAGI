(() => {
  const boot = window.READER_BOOTSTRAP;
  if (!boot || !boot.docId) return;

  const state = {
    docId: boot.docId,
    pageNo: boot.initialPageNo || 0,
    lines: [],
    pageNaturalWidth: 1,
    pageNaturalHeight: 1,

    selectionTarget: "body", // "heading" | "body"
    headingSelectedLineIds: [],
    bodySelectedLineIds: [],

    lineDrag: {
      active: false,
      moved: false,
      x0: 0,
      y0: 0,
      x1: 0,
      y1: 0,
      pointerId: null,
      startedOnLineId: null,
    },

    imageBBox: null,
    captionBBox: null,
    drawing: null,

    paragraphCache: [],
    figureCache: [],

    mode: "line", // "line" | "figure"
  };

  const $ = (id) => document.getElementById(id);

  const els = {
    pageSelect: $("pageSelect"),
    reloadBtn: $("reloadBtn"),

    titleInput: $("titleInput"),
    saveTitleBtn: $("saveTitleBtn"),

    pageImage: $("pageImage"),
    pdfWrap: $("pdfWrap"),
    lineOverlay: $("lineOverlay"),
    figureOverlay: $("figureOverlay"),

    lineModeBtn: $("lineModeBtn"),
    figureModeBtn: $("figureModeBtn"),
    modeHint: $("modeHint"),

    targetHeadingBtn: $("targetHeadingBtn"),
    targetBodyBtn: $("targetBodyBtn"),
    selectionTargetHint: $("selectionTargetHint"),
    headingCountBadge: $("headingCountBadge"),
    bodyCountBadge: $("bodyCountBadge"),

    orderIndex: $("orderIndex"),
    unitType: $("unitType"),
    headingText: $("headingText"),
    headingPreview: $("headingPreview"),
    bodyPreview: $("bodyPreview"),
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

  window.debugState = state;
  window.debugEls = els;

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

  function syncOverlaySize() {
    const rect = els.pageImage.getBoundingClientRect();
    els.lineOverlay.style.width = `${rect.width}px`;
    els.lineOverlay.style.height = `${rect.height}px`;
    els.figureOverlay.style.width = `${rect.width}px`;
    els.figureOverlay.style.height = `${rect.height}px`;
  }

  function getImageRect() {
    return els.pageImage.getBoundingClientRect();
  }

  function scaleX(x) {
    const rect = getImageRect();
    return (x / state.pageNaturalWidth) * rect.width;
  }

  function scaleY(y) {
    const rect = getImageRect();
    return (y / state.pageNaturalHeight) * rect.height;
  }

  function unscaleX(x) {
    const rect = getImageRect();
    return (x / rect.width) * state.pageNaturalWidth;
  }

  function unscaleY(y) {
    const rect = getImageRect();
    return (y / rect.height) * state.pageNaturalHeight;
  }

  function overlayPointFromEvent(event) {
    const rect = els.lineOverlay.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(rect.width, event.clientX - rect.left)),
      y: Math.max(0, Math.min(rect.height, event.clientY - rect.top)),
    };
  }

  function normalizeRect(rect) {
    const x0 = Math.min(rect.x0, rect.x1);
    const y0 = Math.min(rect.y0, rect.y1);
    const x1 = Math.max(rect.x0, rect.x1);
    const y1 = Math.max(rect.y0, rect.y1);
    return { x0, y0, x1, y1 };
  }

  function rectIntersects(a, b) {
    return !(
      a.x1 < b.x0 ||
      a.x0 > b.x1 ||
      a.y1 < b.y0 ||
      a.y0 > b.y1
    );
  }

  function compareLineOrder(a, b) {
    if (a.page_no !== b.page_no) return a.page_no - b.page_no;
    return a.line_no - b.line_no;
  }

  function sortLines(lines) {
    return [...lines].sort(compareLineOrder);
  }

  function getLineById(id) {
    return state.lines.find((line) => line.id === id) || null;
  }

  function getSelectedIdArray(target) {
    return target === "heading"
      ? state.headingSelectedLineIds
      : state.bodySelectedLineIds;
  }

  function setSelectedIdArray(target, ids) {
    const uniqueIds = [...new Set(ids.map(Number))];

    if (target === "heading") {
      state.headingSelectedLineIds = uniqueIds;
    } else {
      state.bodySelectedLineIds = uniqueIds;
    }
  }

  function getSelectedLines(target) {
    const ids = getSelectedIdArray(target);
    const selected = ids
      .map((id) => getLineById(id))
      .filter(Boolean);
    return sortLines(selected);
  }

  function buildTextFromLines(lines) {
    return lines
      .map((line) => String(line.text || "").trim())
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function buildTextFromTarget(target) {
    return buildTextFromLines(getSelectedLines(target));
  }

  function getRepresentativeRangeIds(target) {
    const lines = getSelectedLines(target);
    if (!lines.length) {
      return { start_line_id: null, end_line_id: null };
    }
    return {
      start_line_id: Number(lines[0].id),
      end_line_id: Number(lines[lines.length - 1].id),
    };
  }

  function isLineSelected(lineId, target) {
    return getSelectedIdArray(target).includes(Number(lineId));
  }

  function toggleLineSelection(lineId, target = state.selectionTarget) {
    const current = getSelectedIdArray(target);
    const id = Number(lineId);

    if (current.includes(id)) {
      setSelectedIdArray(
        target,
        current.filter((x) => x !== id)
      );
    } else {
      setSelectedIdArray(target, [...current, id]);
    }

    syncHeadingTextFromSelection();
    updateSelectionUI();
    renderLines();
  }

  function addLinesToSelection(lineIds, target = state.selectionTarget) {
    const current = getSelectedIdArray(target);
    setSelectedIdArray(target, [...current, ...lineIds]);
    syncHeadingTextFromSelection();
    updateSelectionUI();
    renderLines();
  }

  function clearSelection() {
    state.headingSelectedLineIds = [];
    state.bodySelectedLineIds = [];
    state.lineDrag.active = false;
    state.lineDrag.moved = false;
    state.lineDrag.pointerId = null;
    state.lineDrag.startedOnLineId = null;

    removeDragRect();
    syncHeadingTextFromSelection();
    updateSelectionUI();
    renderLines();
  }

  function setSelectionTarget(target) {
    state.selectionTarget = target;

    els.targetHeadingBtn?.classList.toggle("is-active", target === "heading");
    els.targetBodyBtn?.classList.toggle("is-active", target === "body");

    if (els.selectionTargetHint) {
      els.selectionTargetHint.textContent =
        target === "heading"
          ? "現在: Heading選択。クリックで追加/解除、ドラッグで複数追加できます。"
          : "現在: Body選択。クリックで追加/解除、ドラッグで複数追加できます。";
    }
  }

  function syncHeadingTextFromSelection() {
    const autoHeading = buildTextFromTarget("heading");
    if (document.activeElement !== els.headingText) {
      els.headingText.value = autoHeading;
    }
  }

  function updateSelectionUI() {
    const headingLines = getSelectedLines("heading");
    const bodyLines = getSelectedLines("body");
    const headingText = buildTextFromLines(headingLines);
    const bodyText = buildTextFromLines(bodyLines);

    if (els.headingCountBadge) {
      els.headingCountBadge.textContent = `Heading ${headingLines.length}行`;
    }
    if (els.bodyCountBadge) {
      els.bodyCountBadge.textContent = `Body ${bodyLines.length}行`;
    }

    if (els.headingPreview) {
      els.headingPreview.textContent = headingText || "(未選択)";
    }
    if (els.bodyPreview) {
      els.bodyPreview.textContent = bodyText || "(未選択)";
    }

    if (!els.selectionStatus) return;

    if (!bodyLines.length) {
      els.selectionStatus.textContent = "Body行を選択してください";
      return;
    }

    if (!headingLines.length && !els.headingText.value.trim()) {
      els.selectionStatus.textContent = "保存できます（heading は空でも可）";
      return;
    }

    els.selectionStatus.textContent = "保存できます";
  }

  function setMode(mode) {
    state.mode = mode;
    applyMode();
  }

  function applyMode() {
    const isLineMode = state.mode === "line";
    const isFigureMode = state.mode === "figure";

    if (els.lineOverlay) {
      els.lineOverlay.style.pointerEvents = isLineMode ? "auto" : "none";
      els.lineOverlay.style.zIndex = isLineMode ? "20" : "10";
    }

    if (els.figureOverlay) {
      els.figureOverlay.style.pointerEvents = isFigureMode ? "auto" : "none";
      els.figureOverlay.style.zIndex = isFigureMode ? "20" : "10";
    }

    els.lineModeBtn?.classList.toggle("is-active", isLineMode);
    els.figureModeBtn?.classList.toggle("is-active", isFigureMode);

    if (els.modeHint) {
      els.modeHint.textContent = isLineMode
        ? "現在: Line選択モード"
        : "現在: Figure選択モード（Shift=図 / Alt=caption）";
    }
  }

  function renderLines() {
    if (!els.lineOverlay) return;

    els.lineOverlay.innerHTML = "";
    const fragment = document.createDocumentFragment();

    for (const line of state.lines) {
      const div = document.createElement("button");
      div.type = "button";
      div.className = "line-box";
      div.dataset.lineId = String(line.id);

      const inHeading = isLineSelected(line.id, "heading");
      const inBody = isLineSelected(line.id, "body");

      if (inHeading && inBody) {
        div.classList.add("selected-both");
      } else if (inHeading) {
        div.classList.add("selected-heading");
      } else if (inBody) {
        div.classList.add("selected-body");
      }

      div.style.left = `${scaleX(line.x0)}px`;
      div.style.top = `${scaleY(line.y0)}px`;
      div.style.width = `${Math.max(3, scaleX(line.x1) - scaleX(line.x0))}px`;
      div.style.height = `${Math.max(3, scaleY(line.y1) - scaleY(line.y0))}px`;
      div.title = `${line.line_no}: ${line.text}`;

      div.addEventListener("click", (event) => {
        if (state.mode !== "line") return;

        if (state.lineDrag.moved) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        toggleLineSelection(line.id);
      });

      fragment.appendChild(div);
    }

    els.lineOverlay.appendChild(fragment);

    if (state.lineDrag.active || state.lineDrag.moved) {
      renderDragRect();
    }
  }

  function getDragRectElement() {
    let el = els.lineOverlay.querySelector(".drag-rect");
    if (!el) {
      el = document.createElement("div");
      el.className = "drag-rect";
      els.lineOverlay.appendChild(el);
    }
    return el;
  }

  function removeDragRect() {
    els.lineOverlay.querySelector(".drag-rect")?.remove();
  }

  function renderDragRect() {
    if (!state.lineDrag.active && !state.lineDrag.moved) {
      removeDragRect();
      return;
    }

    const rect = normalizeRect({
      x0: state.lineDrag.x0,
      y0: state.lineDrag.y0,
      x1: state.lineDrag.x1,
      y1: state.lineDrag.y1,
    });

    const el = getDragRectElement();
    el.style.left = `${rect.x0}px`;
    el.style.top = `${rect.y0}px`;
    el.style.width = `${Math.max(1, rect.x1 - rect.x0)}px`;
    el.style.height = `${Math.max(1, rect.y1 - rect.y0)}px`;
  }

  function getIntersectingLineIdsFromDrag() {
    const dragRect = normalizeRect({
      x0: state.lineDrag.x0,
      y0: state.lineDrag.y0,
      x1: state.lineDrag.x1,
      y1: state.lineDrag.y1,
    });

    const ids = [];

    for (const line of state.lines) {
      const lineRect = {
        x0: scaleX(line.x0),
        y0: scaleY(line.y0),
        x1: scaleX(line.x1),
        y1: scaleY(line.y1),
      };
      if (rectIntersects(dragRect, lineRect)) {
        ids.push(Number(line.id));
      }
    }

    return ids;
  }

  function handleLinePointerDown(event) {
    if (state.mode !== "line") return;
    if (event.button !== 0) return;

    const point = overlayPointFromEvent(event);
    const lineBox = event.target.closest(".line-box");

    state.lineDrag.active = true;
    state.lineDrag.moved = false;
    state.lineDrag.x0 = point.x;
    state.lineDrag.y0 = point.y;
    state.lineDrag.x1 = point.x;
    state.lineDrag.y1 = point.y;
    state.lineDrag.pointerId = event.pointerId ?? 1;
    state.lineDrag.startedOnLineId = lineBox ? Number(lineBox.dataset.lineId) : null;

    els.lineOverlay.setPointerCapture?.(state.lineDrag.pointerId);
    renderDragRect();
  }

  function handleLinePointerMove(event) {
    if (!state.lineDrag.active) return;
    if (state.mode !== "line") return;

    const point = overlayPointFromEvent(event);
    state.lineDrag.x1 = point.x;
    state.lineDrag.y1 = point.y;

    const dx = Math.abs(state.lineDrag.x1 - state.lineDrag.x0);
    const dy = Math.abs(state.lineDrag.y1 - state.lineDrag.y0);

    if (dx > 4 || dy > 4) {
      state.lineDrag.moved = true;
    }

    renderDragRect();
  }

  function handleLinePointerUp(event) {
    if (!state.lineDrag.active) return;

    const pointerId = state.lineDrag.pointerId;
    const moved = state.lineDrag.moved;

    if (moved) {
      const ids = getIntersectingLineIdsFromDrag();
      if (ids.length) {
        addLinesToSelection(ids);
      }
    }

    state.lineDrag.active = false;
    state.lineDrag.moved = false;
    state.lineDrag.pointerId = null;
    state.lineDrag.startedOnLineId = null;

    removeDragRect();
    if (pointerId != null) {
      els.lineOverlay.releasePointerCapture?.(pointerId);
    }

    if (moved) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  function placeRect(el, bbox) {
    el.style.left = `${scaleX(bbox.x0)}px`;
    el.style.top = `${scaleY(bbox.y0)}px`;
    el.style.width = `${scaleX(bbox.x1) - scaleX(bbox.x0)}px`;
    el.style.height = `${scaleY(bbox.y1) - scaleY(bbox.y0)}px`;
  }

  function renderFigureBoxes() {
    if (!els.figureOverlay) return;

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

  function updateFigureTexts() {
    if (els.figurePageNo) els.figurePageNo.value = state.pageNo;

    if (els.imageBboxText) {
      els.imageBboxText.textContent = `image_bbox: ${
        state.imageBBox ? JSON.stringify(state.imageBBox) : "未選択"
      }`;
    }

    if (els.captionBboxText) {
      els.captionBboxText.textContent = `caption_bbox: ${
        state.captionBBox ? JSON.stringify(state.captionBBox) : "未選択"
      }`;
    }
  }

  function clearFigureSelection() {
    state.imageBBox = null;
    state.captionBBox = null;
    state.drawing = null;
    updateFigureTexts();
    renderFigureBoxes();
  }

  async function loadPage(pageNo) {
    state.pageNo = Number(pageNo);

    els.pageImage.src = `/api/docs/${state.docId}/pages/${state.pageNo}/preview?ts=${Date.now()}`;

    els.pageImage.onload = async () => {
      const payload = await fetchJSON(`/api/docs/${state.docId}/pages/${state.pageNo}/lines`);

      state.pageNaturalWidth = payload.page_width || 1;
      state.pageNaturalHeight = payload.page_height || 1;
      state.lines = payload.lines || [];

      syncOverlaySize();
      renderLines();
      renderFigureBoxes();
      updateFigureTexts();
      applyMode();
      updateSelectionUI();
    };
  }

  async function saveTitle() {
    await fetchJSON(`/api/docs/${state.docId}/title`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: els.titleInput.value.trim(),
      }),
    });

    showToast("タイトルを保存しました");
  }

  async function saveParagraph() {
    const bodyLines = getSelectedLines("body");
    if (!bodyLines.length) {
      showToast("Body行を選択してください", true);
      return;
    }

    const headingLines = getSelectedLines("heading");
    const bodyRange = getRepresentativeRangeIds("body");

    const bodySelectedLineIds = bodyLines.map((line) => Number(line.id));
    const headingSelectedLineIds = headingLines.map((line) => Number(line.id));

    const headingText =
      els.headingText.value.trim() || buildTextFromLines(headingLines);

    const payload = {
      start_line_id: bodyRange.start_line_id,
      end_line_id: bodyRange.end_line_id,
      selected_line_ids: bodySelectedLineIds,
      heading_line_ids: headingSelectedLineIds,
      order_index: Number(els.orderIndex.value || 0),
      unit_type: els.unitType.value,
      heading_text: headingText,
    };

    const result = await fetchJSON(`/api/docs/${state.docId}/paragraphs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    await fetchJSON(`/api/paragraphs/${result.paragraph_id}/split_sentences`, {
      method: "POST",
    });

    const translateResult = await fetchJSON(
      `/api/paragraphs/${result.paragraph_id}/translate`,
      {
        method: "POST",
      }
    );

    if (els.unitType.value === "title") {
      const titleText = buildTextFromLines(bodyLines);
      if (titleText) {
        els.titleInput.value = titleText;
        await fetchJSON(`/api/docs/${state.docId}/title`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: titleText,
          }),
        });
      }
    }

    if (!translateResult.deepl_enabled) {
      showToast("保存しました。DeepLキー未設定のため翻訳は空です");
    } else {
      showToast("保存・文分割・翻訳まで完了しました");
    }

    els.orderIndex.value = Number(els.orderIndex.value || 0) + 1;
    clearSelection();
    await loadParagraphs();
  }

  function paragraphCard(paragraph) {
    const card = document.createElement("div");
    card.className = "rounded-xl border border-zinc-800 bg-zinc-950/70 p-4 space-y-3";

    card.innerHTML = `
      <div class="font-medium">#${paragraph.order_index} ${escapeHtml(paragraph.heading_text || "(no heading)")}</div>
      <div class="text-sm text-zinc-400">${escapeHtml(paragraph.unit_type)} / p.${paragraph.page_no + 1} - ${paragraph.end_page_no + 1}</div>
      <div class="text-sm whitespace-pre-wrap break-words">${escapeHtml(paragraph.raw_text || "")}</div>
    `;

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
      <div class="font-medium">${escapeHtml(figure.fig_no)}</div>
      <div class="text-sm text-zinc-400">page ${figure.page_no + 1}</div>
      ${imgSrc ? `<img src="${imgSrc}" alt="${escapeHtml(figure.fig_no)}" class="max-h-48 rounded-lg border border-zinc-800">` : ""}
      <div class="text-sm whitespace-pre-wrap break-words">${escapeHtml(figure.caption_text || "")}</div>
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
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    showToast("Figureを保存しました");
    clearFigureSelection();
    els.figNoInput.value = "";
    els.captionTextInput.value = "";
    await loadFigures();
  }

  function startDraw(event) {
    if (state.mode !== "figure") return;
    if (!(event.shiftKey || event.altKey)) return;

    const rect = els.figureOverlay.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    state.drawing = {
      kind: event.shiftKey ? "image" : "caption",
      x0: x,
      y0: y,
      x1: x,
      y1: y,
    };
  }

  function updateDraw(event) {
    if (!state.drawing) return;

    const rect = els.figureOverlay.getBoundingClientRect();
    state.drawing.x1 = Math.max(0, Math.min(rect.width, event.clientX - rect.left));
    state.drawing.y1 = Math.max(0, Math.min(rect.height, event.clientY - rect.top));

    const bbox = {
      x0: unscaleX(Math.min(state.drawing.x0, state.drawing.x1)),
      y0: unscaleY(Math.min(state.drawing.y0, state.drawing.y1)),
      x1: unscaleX(Math.max(state.drawing.x0, state.drawing.x1)),
      y1: unscaleY(Math.max(state.drawing.y0, state.drawing.y1)),
    };

    if (state.drawing.kind === "image") {
      state.imageBBox = bbox;
    } else {
      state.captionBBox = bbox;
    }

    updateFigureTexts();
    renderFigureBoxes();
  }

  function finishDraw() {
    state.drawing = null;
  }

  function bindEvents() {
    els.saveTitleBtn?.addEventListener("click", () => {
      saveTitle().catch((err) => showToast(err.message, true));
    });

    els.lineModeBtn?.addEventListener("click", () => setMode("line"));
    els.figureModeBtn?.addEventListener("click", () => setMode("figure"));

    els.targetHeadingBtn?.addEventListener("click", () => setSelectionTarget("heading"));
    els.targetBodyBtn?.addEventListener("click", () => setSelectionTarget("body"));

    els.clearSelectionBtn?.addEventListener("click", clearSelection);
    els.saveParagraphBtn?.addEventListener("click", () => {
      saveParagraph().catch((err) => showToast(err.message, true));
    });
    els.loadParagraphsBtn?.addEventListener("click", () => {
      loadParagraphs().catch((err) => showToast(err.message, true));
    });

    els.loadFiguresBtn?.addEventListener("click", () => {
      loadFigures().catch((err) => showToast(err.message, true));
    });
    els.clearFigureSelectionBtn?.addEventListener("click", clearFigureSelection);
    els.saveFigureBtn?.addEventListener("click", () => {
      saveFigure().catch((err) => showToast(err.message, true));
    });

    els.pageSelect?.addEventListener("change", () => {
      loadPage(els.pageSelect.value).catch((err) => showToast(err.message, true));
    });

    els.reloadBtn?.addEventListener("click", () => {
      loadPage(state.pageNo).catch((err) => showToast(err.message, true));
    });

    window.addEventListener("resize", () => {
      syncOverlaySize();
      renderLines();
      renderFigureBoxes();
    });

    els.lineOverlay?.addEventListener("pointerdown", handleLinePointerDown);
    els.lineOverlay?.addEventListener("pointermove", handleLinePointerMove);
    els.lineOverlay?.addEventListener("pointerup", handleLinePointerUp);
    els.lineOverlay?.addEventListener("pointercancel", handleLinePointerUp);
    els.lineOverlay?.addEventListener("dragstart", (event) => event.preventDefault());

    els.figureOverlay?.addEventListener("mousedown", (event) => {
      if (state.mode !== "figure") return;
      if (!(event.shiftKey || event.altKey)) return;
      event.preventDefault();
      startDraw(event);
    });

    window.addEventListener("mousemove", (event) => {
      if (!state.drawing) return;
      updateDraw(event);
    });

    window.addEventListener("mouseup", () => {
      if (!state.drawing) return;
      finishDraw();
    });
  }

  async function init() {
    bindEvents();
    setSelectionTarget("body");
    applyMode();
    updateSelectionUI();
    await loadPage(state.pageNo);
    await loadParagraphs();
    await loadFigures();
  }

  init().catch((err) => {
    console.error(err);
    showToast(err.message || "初期化に失敗しました", true);
  });
})();