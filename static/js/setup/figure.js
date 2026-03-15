import { els } from "./dom.js";
import { state } from "./state.js";
import { unscaleX, unscaleY } from "./utils.js";

export function clearFigureSelection() {
  state.imageBBox = null;
  state.captionBBox = null;
  state.drawing = null;
}

export function startFigureDraw(event) {
  if (state.mode !== "figure") return false;
  if (!(event.shiftKey || event.altKey)) return false;

  const rect = els.figureOverlay.getBoundingClientRect();

  state.drawing = {
    kind: event.shiftKey ? "image" : "caption",
    x0: event.clientX - rect.left,
    y0: event.clientY - rect.top,
    x1: event.clientX - rect.left,
    y1: event.clientY - rect.top,
  };

  return true;
}

export function updateFigureDraw(event) {
  if (!state.drawing) return;

  const rect = els.figureOverlay.getBoundingClientRect();

  state.drawing.x1 = Math.max(0, Math.min(rect.width, event.clientX - rect.left));
  state.drawing.y1 = Math.max(0, Math.min(rect.height, event.clientY - rect.top));
}

export function finishFigureDraw() {
  if (!state.drawing) return false;

  const x0 = Math.min(state.drawing.x0, state.drawing.x1);
  const y0 = Math.min(state.drawing.y0, state.drawing.y1);
  const x1 = Math.max(state.drawing.x0, state.drawing.x1);
  const y1 = Math.max(state.drawing.y0, state.drawing.y1);

  if (x1 - x0 < 5 || y1 - y0 < 5) {
    state.drawing = null;
    return false;
  }

  const bbox = {
    x0: Number(unscaleX(x0).toFixed(2)),
    y0: Number(unscaleY(y0).toFixed(2)),
    x1: Number(unscaleX(x1).toFixed(2)),
    y1: Number(unscaleY(y1).toFixed(2)),
  };

  if (state.drawing.kind === "caption") {
    state.captionBBox = bbox;
  } else {
    state.imageBBox = bbox;
  }

  state.drawing = null;
  return true;
}