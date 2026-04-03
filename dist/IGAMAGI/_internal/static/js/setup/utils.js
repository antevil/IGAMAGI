import { els } from "./dom.js";
import { state } from "./state.js";

export async function fetchJSON(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    ...options,
  });

  const contentType = response.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");

  if (!response.ok) {
    if (isJson) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || data.message || `HTTP ${response.status}`);
    }

    const text = await response.text().catch(() => "");
    throw new Error(text || `HTTP ${response.status}`);
  }

  if (!isJson) {
    return null;
  }

  return response.json();
}

export function showToast(message, isError = false) {
  if (!els.toast) return;

  els.toast.textContent = message;
  els.toast.classList.remove("hidden");
  els.toast.style.borderColor = isError ? "rgb(190 24 93)" : "rgb(63 63 70)";
  els.toast.style.background = isError ? "rgb(76 5 25)" : "rgb(24 24 27)";

  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => {
    els.toast.classList.add("hidden");
  }, 2600);
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
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

export function getPageDom(pageNo) {
  return state.pageDomByNo.get(Number(pageNo)) || null;
}

export function getNaturalSize(pageNo) {
  return state.pageNaturalSizeByPage.get(Number(pageNo)) || {
    width: 1,
    height: 1,
  };
}

export function syncOverlaySize(pageNo) {
  const page = getPageDom(pageNo);
  if (!page?.img || !page?.lineOverlay) return;

  const rect = page.img.getBoundingClientRect();
  const width = rect.width;
  const height = rect.height;

  page.lineOverlay.style.width = `${width}px`;
  page.lineOverlay.style.height = `${height}px`;
}

export function scaleX(pageNo, x) {
  const page = getPageDom(pageNo);
  if (!page?.img) return x;

  const natural = getNaturalSize(pageNo);
  const displayWidth = page.img.getBoundingClientRect().width || page.img.width || 1;
  return (Number(x) / Math.max(1, natural.width)) * displayWidth;
}

export function scaleY(pageNo, y) {
  const page = getPageDom(pageNo);
  if (!page?.img) return y;

  const natural = getNaturalSize(pageNo);
  const displayHeight = page.img.getBoundingClientRect().height || page.img.height || 1;
  return (Number(y) / Math.max(1, natural.height)) * displayHeight;
}

export function unscaleX(pageNo, x) {
  const page = getPageDom(pageNo);
  if (!page?.img) return x;

  const natural = getNaturalSize(pageNo);
  const displayWidth = page.img.getBoundingClientRect().width || page.img.width || 1;
  return (Number(x) / Math.max(1, displayWidth)) * natural.width;
}

export function unscaleY(pageNo, y) {
  const page = getPageDom(pageNo);
  if (!page?.img) return y;

  const natural = getNaturalSize(pageNo);
  const displayHeight = page.img.getBoundingClientRect().height || page.img.height || 1;
  return (Number(y) / Math.max(1, displayHeight)) * natural.height;
}

export function overlayPointFromEvent(event, overlayEl) {
  const rect = overlayEl.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
}

export function naturalPointFromEvent(event, pageNo, overlayEl) {
  const p = overlayPointFromEvent(event, overlayEl);
  return {
    x: unscaleX(pageNo, p.x),
    y: unscaleY(pageNo, p.y),
  };
}