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
  refreshSelectionView,
  renderDragRect,
  renderFigureBoxes,
  updateFigureTexts,
} from "./render.js";
import {
  loadAllPages,
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
  els.tabFigureBtn?.classList.toggle(
    "is-active",
    state.activeTab === "figure"
  );

  els.paragraphPanel?.classList.toggle(
    "hidden",
    state.activeTab !== "paragraph"
  );
  els.figurePanel?.classList.toggle(
    "hidden",
    state.activeTab !== "figure"
  );
}
function switchHeaderTab(tab) {
  state.activeTab = tab;
  updateTabUI();

  if (tab === "paragraph") {
    setMode("line");
  } else if (tab === "figure") {
    setMode("figure");
  } else {
    // 文書メタでは line に戻しておくと、誤って figure 描画状態が残りにくい
    setMode("line");
  }
}

function clearSelection() {
  clearSelectionState();
  refreshSelectionView();
}

function clearFigure() {
  clearFigureSelection();

  if (!Array.isArray(state.figureCaptionSelectedLineIds)) {
    state.figureCaptionSelectedLineIds = [];
  } else {
    state.figureCaptionSelectedLineIds = [];
  }

  updateFigureTexts();
  renderFigureBoxes();
  refreshSelectionView();
}

function applyAutoHeadingFromBodySelection() {
  const headingLines = getSelectedLines("heading");
  if (headingLines.length > 0) return;

  const bodyLines = getSelectedLines("body");

  // 1行しかない時まで heading にすると body が空になって保存できなくなるので回避
  if (bodyLines.length < 2) return;

  const firstLineId = Number(bodyLines[0].id);
  const remainingBodyIds = bodyLines.slice(1).map((line) => Number(line.id));

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

  const overlayEl = event.currentTarget;
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

  const overlayEl = event.currentTarget;
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

  const overlayEl = event.currentTarget;
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

function bindPageOverlayEvents() {
  for (const page of state.pageDomByNo.values()) {
    page.lineOverlay.addEventListener("pointerdown", handleLinePointerDown);
    page.lineOverlay.addEventListener("pointermove", handleLinePointerMove);
    page.lineOverlay.addEventListener("pointerup", handleLinePointerUp);
    page.lineOverlay.addEventListener("pointercancel", handleLinePointerUp);
    page.lineOverlay.addEventListener("dragstart", (event) =>
      event.preventDefault()
    );

    page.lineOverlay.addEventListener("mousedown", (event) => {
      if (state.mode !== "figure") return;
      if (event.target.closest(".line-box")) return;

      const started = startFigureDraw(
        event,
        Number(page.lineOverlay.dataset.pageNo),
        page.lineOverlay
      );

      if (!started) return;

      event.preventDefault();
      renderFigureBoxes();
    });
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
    syncOverlaySize(Number(page.lineOverlay.dataset.pageNo));
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
    saveFigure().catch((err) => showToast(err.message, true));
  });

  els.pageSelect?.addEventListener("change", () => {
    const pageNo = Number(els.pageSelect.value);
    const page = state.pageDomByNo.get(pageNo);

    page?.block?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  });

  els.reloadBtn?.addEventListener("click", () => {
    loadAllPages()
      .then(() => {
        bindPageOverlayEvents();
      })
      .catch((err) => showToast(err.message, true));
  });

  window.addEventListener("resize", () => {
    for (const pageMeta of state.pages) {
      syncOverlaySize(pageMeta.page_no);
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
      return;
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

function scrollToCurrentPage() {
  const page = state.pageDomByNo.get(Number(state.pageNo));
  page?.block?.scrollIntoView({
    behavior: "auto",
    block: "start",
  });
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

  bindEvents();

  switchHeaderTab("paragraph");

  refreshSelectionView();
  updateFigureTexts();

  await loadAllPages();
  await syncNextOrderIndex(); // 最新の order_index を取得しておく
  bindPageOverlayEvents();

  if (els.pageSelect) {
    els.pageSelect.value = String(state.pageNo || 0);
  }

  scrollToCurrentPage();
}

init().catch((err) => {
  console.error(err);
  showToast(err.message || "初期化に失敗しました", true);
});