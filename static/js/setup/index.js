import { els } from "./dom.js";
import { state } from "./state.js";
import {
  addLinesToSelection,
  clearSelectionState,
  getLinesByPage,
  setSelectionTarget,
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
  loadFigures,
  loadParagraphs,
  saveFigure,
  saveParagraph,
  saveTitle,
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
import {
  addCaptionLinesToSelection,
  clearCaptionSelectionState,
  syncCaptionFields,
  toggleCaptionLineSelection,
} from "./caption_selection.js";

function setMode(mode) {
  state.mode = mode;
  applyMode();
}

function clearSelection() {
  clearSelectionState();
  refreshSelectionView();
}

function clearFigure() {
  clearFigureSelection();
  clearCaptionSelectionState();
  syncCaptionFields(els);
  updateFigureTexts();
  renderFigureBoxes();
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
  const captionMode = state.mode === "figure";
  if (state.mode !== "line" && !captionMode) return;
  if (event.button !== 0) return;

  const overlayEl = event.currentTarget;
  const pageNo = Number(overlayEl.dataset.pageNo);
  const point = overlayPointFromEvent(event, overlayEl);
  const lineBox = event.target.closest(".line-box");

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
}

function handleLinePointerMove(event) {
  if (!state.lineDrag.active) return;

  const captionMode = state.mode === "figure";
  if (state.mode !== "line" && !captionMode) return;

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

  const pointerId = state.lineDrag.pointerId;
  const moved = state.lineDrag.moved;
  const startedOnLineId = state.lineDrag.startedOnLineId;
  const didCapture = state.lineDrag.captureStarted;

  const captionMode = state.mode === "figure";

  if (moved) {
    const ids = getIntersectingLineIdsFromDrag();
    if (ids.length) {
      if (captionMode) {
        addCaptionLinesToSelection(ids);
        syncCaptionFields(els);
      } else {
        addLinesToSelection(ids);
      }
    }
  } else if (startedOnLineId != null) {
    if (captionMode) {
      toggleCaptionLineSelection(startedOnLineId);
      syncCaptionFields(els);
    } else {
      toggleLineSelection(startedOnLineId);
    }
  }

  state.lineDrag.active = false;
  state.lineDrag.moved = false;
  state.lineDrag.pointerId = null;
  state.lineDrag.startedOnLineId = null;
  state.lineDrag.captureStarted = false;
  state.lineDrag.pageNo = null;
  state.lineDrag.overlayEl = null;

  if (didCapture && pointerId != null) {
    overlayEl.releasePointerCapture?.(pointerId);
  }

  refreshSelectionView();
  event.preventDefault();
  event.stopPropagation();
}

function bindPageOverlayEvents() {
  for (const page of state.pageDomByNo.values()) {
    page.lineOverlay.addEventListener("pointerdown", handleLinePointerDown);
    page.lineOverlay.addEventListener("pointermove", handleLinePointerMove);
    page.lineOverlay.addEventListener("pointerup", handleLinePointerUp);
    page.lineOverlay.addEventListener("pointercancel", handleLinePointerUp);
    page.lineOverlay.addEventListener("dragstart", (event) => event.preventDefault());

    page.figureOverlay.addEventListener("mousedown", (event) => {
      const started = startFigureDraw(
        event,
        Number(page.figureOverlay.dataset.pageNo),
        page.figureOverlay
      );
      if (!started) return;

      event.preventDefault();
      renderFigureBoxes();
    });
  }
}

function bindEvents() {
  els.saveTitleBtn?.addEventListener("click", () => {
    saveTitle().catch((err) => showToast(err.message, true));
  });

  els.lineModeBtn?.addEventListener("click", () => setMode("line"));
  els.figureModeBtn?.addEventListener("click", () => setMode("figure"));

  els.targetHeadingBtn?.addEventListener("click", () => {
    setSelectionTarget("heading");
    refreshSelectionView();
  });

  els.targetBodyBtn?.addEventListener("click", () => {
    setSelectionTarget("body");
    refreshSelectionView();
  });

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

async function init() {
  if (!state.docId) return;

  bindEvents();
  setSelectionTarget("body");
  applyMode();
  refreshSelectionView();
  updateFigureTexts();

  await loadAllPages();
  bindPageOverlayEvents();

  if (els.pageSelect) {
    els.pageSelect.value = String(state.pageNo || 0);
  }

  await loadParagraphs();
  await loadFigures();
}

init().catch((err) => {
  console.error(err);
  showToast(err.message || "初期化に失敗しました", true);
});