import { els } from "./dom.js";
import { state } from "./state.js";

export function showToast(message, isError = false) {
  if (!els.toast) return;

  els.toast.textContent = message;
  els.toast.classList.remove("hidden");
  els.toast.classList.toggle("border-rose-700", isError);
  els.toast.classList.toggle("bg-rose-950", isError);
  els.toast.classList.toggle("border-zinc-700", !isError);
  els.toast.classList.toggle("bg-zinc-900", !isError);

  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => {
    els.toast.classList.add("hidden");
  }, 2500);
}

export async function fetchJSON(url, options = {}) {
  const res = await fetch(url, options);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
}

export function escapeHtml(text) {
  return String(text ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function getImageRect() {
  return els.pageImage.getBoundingClientRect();
}

export function syncOverlaySize() {
  const rect = getImageRect();

  els.lineOverlay.style.width = `${rect.width}px`;
  els.lineOverlay.style.height = `${rect.height}px`;

  els.figureOverlay.style.width = `${rect.width}px`;
  els.figureOverlay.style.height = `${rect.height}px`;
}

export function scaleX(x) {
  const rect = getImageRect();
  return (x / state.pageNaturalWidth) * rect.width;
}

export function scaleY(y) {
  const rect = getImageRect();
  return (y / state.pageNaturalHeight) * rect.height;
}

export function unscaleX(x) {
  const rect = getImageRect();
  return (x / rect.width) * state.pageNaturalWidth;
}

export function unscaleY(y) {
  const rect = getImageRect();
  return (y / rect.height) * state.pageNaturalHeight;
}

export function overlayPointFromEvent(event, overlayEl) {
  const rect = overlayEl.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(rect.width, event.clientX - rect.left)),
    y: Math.max(0, Math.min(rect.height, event.clientY - rect.top)),
  };
}

export function normalizeRect(rect) {
  return {
    x0: Math.min(rect.x0, rect.x1),
    y0: Math.min(rect.y0, rect.y1),
    x1: Math.max(rect.x0, rect.x1),
    y1: Math.max(rect.y0, rect.y1),
  };
}

export function rectIntersects(a, b) {
  return !(
    a.x1 < b.x0 ||
    a.x0 > b.x1 ||
    a.y1 < b.y0 ||
    a.y0 > b.y1
  );
}