import { els } from "./dom.js";
import { state } from "./state.js";
import {
  addLinesToSelection,
  clearSelectionState,
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
  loadFigures,
  loadPage,
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
  updateFigureTexts();
  renderFigureBoxes();
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

  const point = overlayPointFromEvent(event, els.lineOverlay);
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
}

function handleLinePointerMove(event) {
  if (!state.lineDrag.active) return;
  if (state.mode !== "line") return;

  const point = overlayPointFromEvent(event, els.lineOverlay);
  state.lineDrag.x1 = point.x;
  state.lineDrag.y1 = point.y;

  const dx = Math.abs(state.lineDrag.x1 - state.lineDrag.x0);
  const dy = Math.abs(state.lineDrag.y1 - state.lineDrag.y0);

  if (!state.lineDrag.moved && (dx > 4 || dy > 4)) {
    state.lineDrag.moved = true;
  }

  if (state.lineDrag.moved && !state.lineDrag.captureStarted) {
    els.lineOverlay.setPointerCapture?.(state.lineDrag.pointerId);
    state.lineDrag.captureStarted = true;
  }

  renderDragRect();
}

function handleLinePointerUp(event) {
  if (!state.lineDrag.active) return;

  const pointerId = state.lineDrag.pointerId;
  const moved = state.lineDrag.moved;
  const startedOnLineId = state.lineDrag.startedOnLineId;
  const didCapture = state.lineDrag.captureStarted;

  if (moved) {
    const ids = getIntersectingLineIdsFromDrag();
    if (ids.length) {
      addLinesToSelection(ids);
    }
  } else if (startedOnLineId != null) {
    toggleLineSelection(startedOnLineId);
  }

  state.lineDrag.active = false;
  state.lineDrag.moved = false;
  state.lineDrag.pointerId = null;
  state.lineDrag.startedOnLineId = null;
  state.lineDrag.captureStarted = false;

  if (didCapture && pointerId != null) {
    els.lineOverlay.releasePointerCapture?.(pointerId);
  }

  refreshSelectionView();
  event.preventDefault();
  event.stopPropagation();
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
    loadPage(els.pageSelect.value).catch((err) => showToast(err.message, true));
  });

  els.reloadBtn?.addEventListener("click", () => {
    loadPage(state.pageNo).catch((err) => showToast(err.message, true));
  });

  window.addEventListener("resize", () => {
    syncOverlaySize();
    refreshSelectionView();
    renderFigureBoxes();
  });

  els.lineOverlay?.addEventListener("pointerdown", handleLinePointerDown);
  els.lineOverlay?.addEventListener("pointermove", handleLinePointerMove);
  els.lineOverlay?.addEventListener("pointerup", handleLinePointerUp);
  els.lineOverlay?.addEventListener("pointercancel", handleLinePointerUp);
  els.lineOverlay?.addEventListener("dragstart", (event) => event.preventDefault());

  els.figureOverlay?.addEventListener("mousedown", (event) => {
    const started = startFigureDraw(event);
    if (!started) return;

    event.preventDefault();
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