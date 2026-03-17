import { state } from "./state.js";

function compareLineOrder(a, b) {
  if (Number(a.page_no) !== Number(b.page_no)) {
    return Number(a.page_no) - Number(b.page_no);
  }
  return Number(a.line_no) - Number(b.line_no);
}

function sortLines(lines) {
  return [...lines].sort(compareLineOrder);
}

function getLineById(id) {
  return state.lineIndex.get(Number(id)) || null;
}

function uniqueIds(ids) {
  return [...new Set(ids.map((x) => Number(x)))];
}

export function getCaptionSelectedIds() {
  return state.captionSelectedLineIds || [];
}

export function setCaptionSelectedIds(ids) {
  state.captionSelectedLineIds = uniqueIds(ids);
}

export function isCaptionLineSelected(lineId) {
  return getCaptionSelectedIds().includes(Number(lineId));
}

export function getCaptionSelectedLines() {
  return sortLines(
    getCaptionSelectedIds()
      .map((id) => getLineById(id))
      .filter(Boolean)
  );
}

export function buildCaptionText() {
  return getCaptionSelectedLines()
    .map((line) => String(line.text || "").trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildCaptionBBox() {
  const lines = getCaptionSelectedLines();
  if (!lines.length) return null;

  let x0 = Number(lines[0].x0);
  let y0 = Number(lines[0].y0);
  let x1 = Number(lines[0].x1);
  let y1 = Number(lines[0].y1);

  for (const line of lines.slice(1)) {
    x0 = Math.min(x0, Number(line.x0));
    y0 = Math.min(y0, Number(line.y0));
    x1 = Math.max(x1, Number(line.x1));
    y1 = Math.max(y1, Number(line.y1));
  }

  return { x0, y0, x1, y1 };
}

export function toggleCaptionLineSelection(lineId) {
  const current = getCaptionSelectedIds();
  const id = Number(lineId);

  if (current.includes(id)) {
    setCaptionSelectedIds(current.filter((x) => x !== id));
  } else {
    setCaptionSelectedIds([...current, id]);
  }
}

export function addCaptionLinesToSelection(lineIds) {
  const current = getCaptionSelectedIds();
  setCaptionSelectedIds([...current, ...lineIds]);
}

export function clearCaptionSelectionState() {
  state.captionSelectedLineIds = [];
}

export function syncCaptionFields(els) {
  const text = buildCaptionText();
  const bbox = buildCaptionBBox();

  state.captionBBox = bbox;

  if (els.captionTextInput) {
    els.captionTextInput.value = text;
  }

  if (els.captionBboxText) {
    els.captionBboxText.textContent = `caption_bbox: ${
      bbox ? JSON.stringify(bbox) : "未選択"
    }`;
  }
}