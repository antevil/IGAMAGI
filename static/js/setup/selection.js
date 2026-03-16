import { state } from "./state.js";

export function compareLineOrder(a, b) {
  if (a.page_no !== b.page_no) return a.page_no - b.page_no;
  return a.line_no - b.line_no;
}

export function sortLines(lines) {
  return [...lines].sort(compareLineOrder);
}

export function getLineById(id) {
  return state.lineIndex.get(Number(id)) || null;
}

export function getLinesByPage(pageNo) {
  return state.linesByPage.get(Number(pageNo)) || [];
}

export function getAllLines() {
  return sortLines([...state.lineIndex.values()]);
}

export function getSelectedIdArray(target) {
  return target === "heading"
    ? state.headingSelectedLineIds
    : state.bodySelectedLineIds;
}

export function setSelectedIdArray(target, ids) {
  const uniqueIds = [...new Set(ids.map((x) => Number(x)))];
  if (target === "heading") {
    state.headingSelectedLineIds = uniqueIds;
  } else {
    state.bodySelectedLineIds = uniqueIds;
  }
}

export function isLineSelected(lineId, target) {
  return getSelectedIdArray(target).includes(Number(lineId));
}

export function getSelectedLines(target) {
  const ids = getSelectedIdArray(target);
  return sortLines(ids.map((id) => getLineById(id)).filter(Boolean));
}

export function buildTextFromLines(lines) {
  return lines
    .map((line) => String(line.text || "").trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildTextFromTarget(target) {
  return buildTextFromLines(getSelectedLines(target));
}

export function getRepresentativeRangeIds(target) {
  const lines = getSelectedLines(target);
  if (!lines.length) {
    return { start_line_id: null, end_line_id: null };
  }

  return {
    start_line_id: Number(lines[0].id),
    end_line_id: Number(lines[lines.length - 1].id),
  };
}

export function toggleLineSelection(lineId, target = state.selectionTarget) {
  const current = getSelectedIdArray(target);
  const id = Number(lineId);

  if (current.includes(id)) {
    setSelectedIdArray(target, current.filter((x) => x !== id));
  } else {
    setSelectedIdArray(target, [...current, id]);
  }
}

export function addLinesToSelection(lineIds, target = state.selectionTarget) {
  const current = getSelectedIdArray(target);
  setSelectedIdArray(target, [...current, ...lineIds]);
}

export function clearSelectionState() {
  state.headingSelectedLineIds = [];
  state.bodySelectedLineIds = [];

  state.lineDrag.active = false;
  state.lineDrag.moved = false;
  state.lineDrag.pointerId = null;
  state.lineDrag.startedOnLineId = null;
  state.lineDrag.captureStarted = false;
  state.lineDrag.pageNo = null;
  state.lineDrag.overlayEl = null;
}

export function setSelectionTarget(target) {
  state.selectionTarget = target;
}