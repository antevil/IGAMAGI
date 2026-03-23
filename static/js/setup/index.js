import { els } from "./dom.js";
import { state } from "./state.js";
import {
  addLinesToSelection,
  clearSelectionState,
  getLinesByPage,
  getSelectedLines,
  setSelectedIdArray,
  toggleLineSelection,
} from "./selection.js";
import {
  clearFigureSelection,
  finishFigureDraw,
  startFigureDraw,
  updateFigureDraw,
} from "./figure.js";
import {
  applyMode,
  createPageStack,
  refreshSelectionView,
  renderDragRect,
  renderFigureBoxes,
  updateFigureTexts,
} from "./render.js";
import {
  ensureNearbyPages,
  loadInitialPages,
  loadParagraphForEditData,
  loadFigureForEditData,
  reloadLoadedPages,
  saveFigure,
  saveParagraph,
  saveTitle,
  syncNextOrderIndex,
} from "./api.js";
import {
  normalizeRect,
  overlayPointFromEvent,
  rectIntersects,
  scaleX,
  scaleY,
  showToast,
  syncOverlaySize,
} from "./utils.js";

function setMode(mode) {
  state.mode = mode;

  if (!Array.isArray(state.figureCaptionSelectedLineIds)) {
    state.figureCaptionSelectedLineIds = [];
  }

  applyMode();
  refreshSelectionView();
  updateFigureTexts();
}

function updateTabUI() {
  els.tabParagraphBtn?.classList.toggle(
    "is-active",
    state.activeTab === "paragraph"
  );
  els.tabFigureBtn?.classList.toggle("is-active", state.activeTab === "figure");
  els.paragraphPanel?.classList.toggle("hidden", state.activeTab !== "paragraph");
  els.figurePanel?.classList.toggle("hidden", state.activeTab !== "figure");
}

function switchHeaderTab(tab) {
  state.activeTab = tab;
  updateTabUI();

  if (tab === "paragraph") {
    setMode("line");
  } else if (tab === "figure") {
    setMode("figure");
  } else {
    setMode("line");
  }
}

function clearSelection() {
  clearSelectionState();
  refreshSelectionView();
}

function clearFigure() {
  clearFigureSelection();
  state.figureCaptionSelectedLineIds = [];
  updateFigureTexts();
  renderFigureBoxes();
  refreshSelectionView();
}

function applyAutoHeadingFromBodySelection() {
  const headingLines = getSelectedLines("heading");
  if (headingLines.length > 0) return;

  const bodyLines = getSelectedLines("body");

  if (bodyLines.length < 2) return;

  const firstLineId = Number(bodyLines[0].id);
  const remainingBodyIds = bodyLines
    .slice(1)
    .map((line) => Number(line.id));

  setSelectedIdArray("heading", [firstLineId]);
  setSelectedIdArray("body", remainingBodyIds);
}

function getIntersectingLineIdsFromDrag() {
  const pageNo = Number(state.lineDrag.pageNo);

  const dragRect = normalizeRect({
    x0: state.lineDrag.x0,
    y0: state.lineDrag.y0,
    x1: state.lineDrag.x1,
    y1: state.lineDrag.y1,
  });

  const ids = [];
  for (const line of getLinesByPage(pageNo)) {
    const lineRect = {
      x0: scaleX(pageNo, line.x0),
      y0: scaleY(pageNo, line.y0),
      x1: scaleX(pageNo, line.x1),
      y1: scaleY(pageNo, line.y1),
    };

    if (rectIntersects(dragRect, lineRect)) {
      ids.push(Number(line.id));
    }
  }

  return ids;
}

function handleLinePointerDown(event) {
  if (event.button !== 0) return;

  const overlayEl = getOverlayFromEvent(event);
  if (!overlayEl) return;
  const pageNo = Number(overlayEl.dataset.pageNo);
  const point = overlayPointFromEvent(event, overlayEl);
  const lineBox = event.target.closest(".line-box");

  const isLineMode = state.mode === "line";
  const isFigureCaptionMode = state.mode === "figure" && !!lineBox;
  if (!isLineMode && !isFigureCaptionMode) return;

  if (!Array.isArray(state.figureCaptionSelectedLineIds)) {
    state.figureCaptionSelectedLineIds = [];
  }

  state.lineDrag.active = true;
  state.lineDrag.moved = false;
  state.lineDrag.captureStarted = false;
  state.lineDrag.x0 = point.x;
  state.lineDrag.y0 = point.y;
  state.lineDrag.x1 = point.x;
  state.lineDrag.y1 = point.y;
  state.lineDrag.pointerId = event.pointerId ?? 1;
  state.lineDrag.startedOnLineId = lineBox ? Number(lineBox.dataset.lineId) : null;
  state.lineDrag.pageNo = pageNo;
  state.lineDrag.overlayEl = overlayEl;
  state.lineDrag.target = event.shiftKey ? "heading" : "body";
}

function handleLinePointerMove(event) {
  if (!state.lineDrag.active) return;

  const overlayEl = getOverlayFromEvent(event);
  if (!overlayEl) return;
  const pageNo = Number(overlayEl.dataset.pageNo);
  if (Number(state.lineDrag.pageNo) !== pageNo) return;

  const point = overlayPointFromEvent(event, overlayEl);

  state.lineDrag.x1 = point.x;
  state.lineDrag.y1 = point.y;

  const dx = Math.abs(state.lineDrag.x1 - state.lineDrag.x0);
  const dy = Math.abs(state.lineDrag.y1 - state.lineDrag.y0);

  if (!state.lineDrag.moved && (dx > 4 || dy > 4)) {
    state.lineDrag.moved = true;
  }

  if (state.lineDrag.moved && !state.lineDrag.captureStarted) {
    overlayEl.setPointerCapture?.(state.lineDrag.pointerId);
    state.lineDrag.captureStarted = true;
  }

  renderDragRect();
}

function handleLinePointerUp(event) {
  if (!state.lineDrag.active) return;

  const overlayEl = getOverlayFromEvent(event);
  if (!overlayEl) return;
  const pageNo = Number(overlayEl.dataset.pageNo);
  if (Number(state.lineDrag.pageNo) !== pageNo) return;

  if (!Array.isArray(state.figureCaptionSelectedLineIds)) {
    state.figureCaptionSelectedLineIds = [];
  }

  const pointerId = state.lineDrag.pointerId;
  const moved = state.lineDrag.moved;
  const startedOnLineId = state.lineDrag.startedOnLineId;
  const didCapture = state.lineDrag.captureStarted;
  const isFigureMode = state.mode === "figure";
  const dragTarget = state.lineDrag.target || "body";

  if (moved) {
    const ids = getIntersectingLineIdsFromDrag();

    if (ids.length) {
      if (isFigureMode) {
        state.figureCaptionSelectedLineIds = [
          ...new Set([
            ...state.figureCaptionSelectedLineIds,
            ...ids.map((id) => Number(id)),
          ]),
        ];
      } else {
        addLinesToSelection(ids, dragTarget);
        if (dragTarget === "body") {
          applyAutoHeadingFromBodySelection();
        }
      }
    }
  } else if (startedOnLineId != null) {
    if (isFigureMode) {
      const id = Number(startedOnLineId);
      if (state.figureCaptionSelectedLineIds.includes(id)) {
        state.figureCaptionSelectedLineIds =
          state.figureCaptionSelectedLineIds.filter((x) => x !== id);
      } else {
        state.figureCaptionSelectedLineIds = [
          ...state.figureCaptionSelectedLineIds,
          id,
        ];
      }
    } else {
      toggleLineSelection(startedOnLineId, dragTarget);
      if (dragTarget === "body") {
        applyAutoHeadingFromBodySelection();
      }
    }
  }

  state.lineDrag.active = false;
  state.lineDrag.moved = false;
  state.lineDrag.pointerId = null;
  state.lineDrag.startedOnLineId = null;
  state.lineDrag.captureStarted = false;
  state.lineDrag.pageNo = null;
  state.lineDrag.overlayEl = null;
  state.lineDrag.target = "body";

  if (didCapture && pointerId != null) {
    overlayEl.releasePointerCapture?.(pointerId);
  }

  refreshSelectionView();
  updateFigureTexts();

  event.preventDefault();
  event.stopPropagation();
}

function getEditParagraphId() {
  const raw = getQueryParam("edit_paragraph_id");
  if (raw == null) return null;

  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? id : null;
}
function getEditFigureId() {
  const raw = getQueryParam("edit_figure_id");
  if (raw == null) return null;

  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function getModeParam() {
  return getQueryParam("mode");
}

function getNextFigureNo() {
  const raw = getQueryParam("next_fig_no");
  if (raw == null) return null;
  const value = String(raw).trim();
  return value || null;
}

async function restoreFigureForEdit(figureId) {
  const result = await loadFigureForEditData(figureId);

  state.editFigureId = Number(figureId);

  const figure = result.figure || result;
  const captionIds = Array.isArray(result.caption_line_ids)
    ? result.caption_line_ids.map((id) => Number(id))
    : [];

  state.figurePageNo = Number(figure.page_no);
  state.pageNo = Number(figure.page_no);
  state.figureCaptionSelectedLineIds = captionIds;
  state.imageBBox = figure.image_bbox
    ? JSON.parse(figure.image_bbox)
    : null;

  if (els.figNoInput) {
    els.figNoInput.value = figure.fig_no || "FIG";
  }

  switchHeaderTab("figure");
}

async function restoreParagraphForEdit(paragraphId) {
  const result = await loadParagraphForEditData(paragraphId);

  state.editParagraphId = Number(paragraphId);

  const paragraph = result.paragraph || result;
  const headingIds =
    result.heading_line_ids || result.headingSelectedLineIds || [];
  const bodyIds =
    result.body_line_ids || result.selected_line_ids || result.bodySelectedLineIds || [];

  setSelectedIdArray("heading", headingIds);
  setSelectedIdArray("body", bodyIds);

  if (els.orderIndex && paragraph.order_index != null) {
    els.orderIndex.value = String(paragraph.order_index);
  }

  if (els.unitType && paragraph.unit_type) {
    els.unitType.value = paragraph.unit_type;
  }

  if (Number.isFinite(Number(paragraph.page_no))) {
    state.pageNo = Number(paragraph.page_no);
  }

  refreshSelectionView();
}

function bindPageOverlayEvents() {
  if (!els.pdfStack) return;

  els.pdfStack.addEventListener("pointerdown", (event) => {
    if (!event.target.closest(".pdf-overlay")) return;
    handleLinePointerDown(event);
  });

  els.pdfStack.addEventListener("pointermove", (event) => {
    if (!state.lineDrag.active) return;
    handleLinePointerMove(event);
  });

  els.pdfStack.addEventListener("pointerup", (event) => {
    if (!state.lineDrag.active) return;
    handleLinePointerUp(event);
  });

  els.pdfStack.addEventListener("pointercancel", (event) => {
    if (!state.lineDrag.active) return;
    handleLinePointerUp(event);
  });

  els.pdfStack.addEventListener("dragstart", (event) => {
    if (event.target.closest(".pdf-overlay")) {
      event.preventDefault();
    }
  });

  els.pdfStack.addEventListener("mousedown", (event) => {
    const overlayEl = event.target.closest(".pdf-overlay");
    if (!overlayEl) return;
    if (state.mode !== "figure") return;
    if (event.target.closest(".line-box")) return;

    const started = startFigureDraw(
      event,
      Number(overlayEl.dataset.pageNo),
      overlayEl
    );

    if (!started) return;

    event.preventDefault();
    renderFigureBoxes();
  });
}
function setupPageObserver() {
  state.pageObserver?.disconnect();

  if (typeof IntersectionObserver !== "function") {
    return;
  }

  state.pageObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;

        const pageNo = Number(entry.target.dataset.pageNo);
        ensureNearbyPages(pageNo).catch((err) => {
          console.error(err);
        });
      }
    },
    {
      root: null,
      rootMargin: "1200px 0px",
      threshold: 0.01,
    }
  );

  for (const page of state.pageDomByNo.values()) {
    state.pageObserver.observe(page.block);
  }
}

function clampZoom(value) {
  return Math.max(state.minZoom, Math.min(state.maxZoom, value));
}

function updateZoomLabel() {
  if (!els.zoomLabel) return;

  const percent = Math.round(state.zoom * 100);
  els.zoomLabel.textContent = `${percent}%`;

  if (els.zoomResetBtn) {
    els.zoomResetBtn.textContent = `${percent}%`;
  }
}

function applyZoom() {
  for (const page of state.pageDomByNo.values()) {
    if (page.block) {
      page.block.style.width = `${Math.round(state.zoom * 100)}%`;
      page.block.style.marginLeft = "auto";
      page.block.style.marginRight = "auto";
    }

     if (page.lineOverlay) {
      syncOverlaySize(Number(page.lineOverlay.dataset.pageNo));
    }
  }

  refreshSelectionView();
  renderFigureBoxes();
  updateFigureTexts();
  updateZoomLabel();
}

function setZoom(nextZoom) {
  state.zoom = clampZoom(nextZoom);
  applyZoom();
}

function zoomIn() {
  setZoom(state.zoom + state.zoomStep);
}

function zoomOut() {
  setZoom(state.zoom - state.zoomStep);
}

function resetZoom() {
  setZoom(1);
}

function isTypingTarget(target) {
  if (!target) return false;

  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  );
}

async function jumpToPage(pageNo, behavior = "smooth") {

  state.pageNo = Number(pageNo);

  if (els.pageSelect) {
    els.pageSelect.value = String(state.pageNo);
  }


  const page = state.pageDomByNo.get(state.pageNo);

  page?.block?.scrollIntoView({
    behavior,
    block: "start",
  });
}

function bindEvents() {
  els.saveTitleBtn?.addEventListener("click", () => {
    saveTitle().catch((err) => showToast(err.message, true));
  });

  els.zoomInBtn?.addEventListener("click", zoomIn);
  els.zoomOutBtn?.addEventListener("click", zoomOut);
  els.zoomResetBtn?.addEventListener("click", resetZoom);

  els.tabMetaBtn?.addEventListener("click", () => switchHeaderTab("meta"));
  els.tabParagraphBtn?.addEventListener("click", () =>
    switchHeaderTab("paragraph")
  );
  els.tabFigureBtn?.addEventListener("click", () => switchHeaderTab("figure"));

  els.clearSelectionBtn?.addEventListener("click", clearSelection);

  els.saveParagraphBtn?.addEventListener("click", () => {
    saveParagraph().catch((err) => showToast(err.message, true));
  });

  els.saveParagraphAndOpenBtn?.addEventListener("click", () => {
    saveParagraph({ openViewer: true }).catch((err) =>
      showToast(err.message, true)
    );
  });

  els.clearFigureSelectionBtn?.addEventListener("click", clearFigure);
  els.saveFigureBtn?.addEventListener("click", () => {
    saveFigure({ openViewer: true }).catch((err) =>
      showToast(err.message, true)
    );
  });

  els.pageSelect?.addEventListener("change", () => {
    const pageNo = Number(els.pageSelect.value);
    jumpToPage(pageNo).catch((err) => showToast(err.message, true));
  });

  els.reloadBtn?.addEventListener("click", () => {
    reloadLoadedPages().catch((err) => showToast(err.message, true));
  });

  window.addEventListener("resize", () => {
    for (const pageNo of state.loadedPageNos) {
      syncOverlaySize(pageNo);
    }
    refreshSelectionView();
    renderFigureBoxes();
  });

  window.addEventListener("keydown", (event) => {
    if (isTypingTarget(event.target)) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.repeat) return;

    const key = event.key.toLowerCase();

    if (key === "w") {
      event.preventDefault();
      zoomIn();
      return;
    }

    if (key === "s") {
      event.preventDefault();
      zoomOut();
    }
  });

  window.addEventListener("mousemove", (event) => {
    updateFigureDraw(event);
    renderFigureBoxes();
  });

  window.addEventListener("mouseup", () => {
    const changed = finishFigureDraw();
    if (!changed) return;

    updateFigureTexts();
    renderFigureBoxes();
  });
}

function getQueryParam(name) {
  const url = new URL(window.location.href);
  return url.searchParams.get(name);
}

function getOverlayFromEvent(event) {
  return event.target.closest(".pdf-overlay") || state.lineDrag.overlayEl || null;
}

async function init() {
  if (!state.docId) return;

  if (!Array.isArray(state.figureCaptionSelectedLineIds)) {
    state.figureCaptionSelectedLineIds = [];
  }

  const pageParam = getQueryParam("page");
  if (pageParam !== null) {
    state.pageNo = Number(pageParam);
  }
  const editParagraphId = getEditParagraphId();
  const editFigureId = getEditFigureId();
  const mode = getModeParam();
  const nextFigureNo = getNextFigureNo();

  bindEvents();

  if (mode === "figure") {
    switchHeaderTab("figure");
  } else {
    switchHeaderTab("paragraph");
  }

  createPageStack();

  bindPageOverlayEvents();

  if (editParagraphId) {
    await restoreParagraphForEdit(editParagraphId);
  } else if (editFigureId) {
    await restoreFigureForEdit(editFigureId);
  } else {
    await syncNextOrderIndex();

    if (mode === "figure") {
      switchHeaderTab("figure");
    }

    if (mode === "figure" && nextFigureNo && els.figNoInput) {
      els.figNoInput.value = nextFigureNo;
    }
  }
 // 1回目: 仮の block へ飛んで lazy 開始条件を作る
  await jumpToPage(state.pageNo, "auto");

  // 近傍ページを実ロード
  await loadInitialPages(state.pageNo);
  // 2回目: 画像ロード後の高さ変化を補正して正しい位置へ飛び直す
  await jumpToPage(state.pageNo, "auto");
  if (els.pageSelect) {
    els.pageSelect.value = String(state.pageNo || 0);
  }

  setupPageObserver();
  
  refreshSelectionView();
  updateFigureTexts();
}

init().catch((err) => {
  console.error(err);
  showToast(err.message || "初期化に失敗しました", true);
});