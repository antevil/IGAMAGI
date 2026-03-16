import { state } from "./state.js";
import { naturalPointFromEvent, normalizeRect } from "./utils.js";

export function clearFigureSelection() {
  state.imageBBox = null;
  state.captionBBox = null;
  state.figurePageNo = null;
  state.drawing = null;
}

export function startFigureDraw(event, pageNo, overlayEl) {
  if (state.mode !== "figure") return false;
  if (event.button !== 0) return false;
  if (!event.shiftKey && !event.altKey) return false;

  const kind = event.shiftKey ? "image" : "caption";
  const point = naturalPointFromEvent(event, pageNo, overlayEl);

  state.drawing = {
    kind,
    pageNo: Number(pageNo),
    overlayEl,
    x0: point.x,
    y0: point.y,
    x1: point.x,
    y1: point.y,
  };

  return true;
}

export function updateFigureDraw(event) {
  if (!state.drawing) return;

  const point = naturalPointFromEvent(
    event,
    state.drawing.pageNo,
    state.drawing.overlayEl
  );

  state.drawing.x1 = point.x;
  state.drawing.y1 = point.y;
}

export function finishFigureDraw() {
  if (!state.drawing) return false;

  const bbox = normalizeRect({
    x0: state.drawing.x0,
    y0: state.drawing.y0,
    x1: state.drawing.x1,
    y1: state.drawing.y1,
  });

  if (state.drawing.kind === "image") {
    state.imageBBox = bbox;
  } else {
    state.captionBBox = bbox;
  }

  state.figurePageNo = Number(state.drawing.pageNo);
  state.drawing = null;
  return true;
}