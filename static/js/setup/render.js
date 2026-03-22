import { els } from "./dom.js";
import { state } from "./state.js";
import {
  getLinesByPage,
  getSelectedLines,
  isLineSelected,
} from "./selection.js";
import { normalizeRect, scaleX, scaleY } from "./utils.js";

export function createPageStack() {
  if (!els.pdfStack) return;

  els.pdfStack.innerHTML = "";
  state.pageDomByNo.clear();

  const fragment = document.createDocumentFragment();

  for (const pageMeta of state.pages) {
    const pageNo = Number(pageMeta.page_no);

    const block = document.createElement("section");
    block.className = "page-block";
    block.dataset.pageNo = String(pageNo);

    const label = document.createElement("div");
    label.className = "page-label";
    label.textContent = `Page ${pageNo + 1}`;

    // 最初は軽いプレースホルダだけ置く
    const mount = document.createElement("div");
    mount.className = "page-shell-mount";
    mount.dataset.pageNo = String(pageNo);
    mount.style.minHeight = "240px";

    block.appendChild(label);
    block.appendChild(mount);
    fragment.appendChild(block);

    state.pageDomByNo.set(pageNo, {
      block,
      mount,
      wrap: null,
      img: null,
      lineOverlay: null,
    });
  }

  els.pdfStack.appendChild(fragment);
}

export function ensurePageShell(pageNo) {
  const page = state.pageDomByNo.get(Number(pageNo));
  if (!page) return null;

  if (page.wrap && page.img && page.lineOverlay) {
    return page;
  }

  const wrap = document.createElement("div");
  wrap.className = "pdf-wrap";

  const img = document.createElement("img");
  img.className = "page-image";
  img.alt = `Page ${Number(pageNo) + 1}`;
  img.draggable = false;
  img.loading = "lazy";

  const lineOverlay = document.createElement("div");
  lineOverlay.className = "pdf-overlay";
  lineOverlay.dataset.pageNo = String(pageNo);

  wrap.appendChild(img);
  wrap.appendChild(lineOverlay);
  page.mount.appendChild(wrap);

  page.wrap = wrap;
  page.img = img;
  page.lineOverlay = lineOverlay;

  return page;
}

export function applyMode() {
  const isLineMode = state.mode === "line";
  const isFigureMode = state.mode === "figure";

  for (const page of state.pageDomByNo.values()) {
    if (!page.lineOverlay) continue;
    page.lineOverlay.style.pointerEvents = "auto";
    page.lineOverlay.style.zIndex = "20";
  }

  els.lineModeBtn?.classList.toggle("is-active", isLineMode);
  els.figureModeBtn?.classList.toggle("is-active", isFigureMode);

  if (els.modeHint) {
    els.modeHint.textContent = isLineMode
      ? "現在: Line選択モード"
      : "現在: Figure選択モード（ドラッグでbbox）";
  }
}

export function updateSelectionUI() {
  const headingLines = getSelectedLines("heading");
  const bodyLines = getSelectedLines("body");

  if (els.selectionTargetHint) {
    els.selectionTargetHint.textContent =
      "通常ドラッグ/クリックで Body、Shift+ドラッグ/クリックで Heading を選択できます。";
  }

  if (els.headingCountBadge) {
    els.headingCountBadge.textContent = `Heading ${headingLines.length}行`;
  }

  if (els.bodyCountBadge) {
    els.bodyCountBadge.textContent = `Body ${bodyLines.length}行`;
  }

  if (!bodyLines.length) {
    els.selectionStatus.textContent = "Body行を選択してください";
  } else if (!headingLines.length) {
    els.selectionStatus.textContent = "保存できます（heading は空でも可）";
  } else {
    els.selectionStatus.textContent = "保存できます";
  }
}

export function renderLinesForPage(pageNo) {
  const page = ensurePageShell(pageNo);
  if (!page || !page.lineOverlay) return;

  page.lineOverlay.innerHTML = "";

  const fragment = document.createDocumentFragment();
  const lines = getLinesByPage(pageNo);

  for (const line of lines) {
    const div = document.createElement("div");
    div.className = "line-box";
    div.dataset.lineId = String(line.id);

    if (line.usage_type === "paragraph_heading") {
      div.classList.add("used-heading");
    } else if (line.usage_type === "paragraph_body") {
      div.classList.add("used-body");
    } else if (line.usage_type === "figure_caption") {
      div.classList.add("used-caption");
    }

    const inHeading = isLineSelected(line.id, "heading");
    const inBody = isLineSelected(line.id, "body");
    const inFigureCaption =
      Array.isArray(state.figureCaptionSelectedLineIds) &&
      state.figureCaptionSelectedLineIds.includes(Number(line.id));

    if (state.mode === "figure" && inFigureCaption) {
      div.classList.add("selected-caption");
    } else if (inHeading && inBody) {
      div.classList.add("selected-both");
    } else if (inHeading) {
      div.classList.add("selected-heading");
    } else if (inBody) {
      div.classList.add("selected-body");
    }

    div.style.left = `${scaleX(pageNo, line.x0)}px`;
    div.style.top = `${scaleY(pageNo, line.y0)}px`;
    div.style.width = `${Math.max(
      3,
      scaleX(pageNo, line.x1) - scaleX(pageNo, line.x0)
    )}px`;
    div.style.height = `${Math.max(
      3,
      scaleY(pageNo, line.y1) - scaleY(pageNo, line.y0)
    )}px`;
    div.title = `${line.line_no}: ${line.text || ""}`;

    fragment.appendChild(div);
  }

  page.lineOverlay.appendChild(fragment);

  if (
    state.lineDrag.active &&
    state.lineDrag.moved &&
    Number(state.lineDrag.pageNo) === Number(pageNo)
  ) {
    renderDragRect();
  }
}

export function renderAllLines() {
  for (const pageNo of state.loadedPageNos) {
    renderLinesForPage(pageNo);
  }
}

function getOrCreateDragRectElement() {
  const page = state.pageDomByNo.get(Number(state.lineDrag.pageNo));
  if (!page?.lineOverlay) return null;

  let el = page.lineOverlay.querySelector(".drag-rect");
  if (!el) {
    el = document.createElement("div");
    el.className = "drag-rect";
    page.lineOverlay.appendChild(el);
  }
  return el;
}

export function removeDragRect() {
  for (const page of state.pageDomByNo.values()) {
    if (!page.lineOverlay) continue;
    page.lineOverlay.querySelector(".drag-rect")?.remove();
  }
}

export function renderDragRect() {
  if (!state.lineDrag.active || !state.lineDrag.moved) {
    removeDragRect();
    return;
  }

  const rect = normalizeRect({
    x0: state.lineDrag.x0,
    y0: state.lineDrag.y0,
    x1: state.lineDrag.x1,
    y1: state.lineDrag.y1,
  });

  const el = getOrCreateDragRectElement();
  if (!el) return;

  el.style.left = `${rect.x0}px`;
  el.style.top = `${rect.y0}px`;
  el.style.width = `${Math.max(1, rect.x1 - rect.x0)}px`;
  el.style.height = `${Math.max(1, rect.y1 - rect.y0)}px`;
}

function placeRect(pageNo, el, bbox) {
  el.style.left = `${scaleX(pageNo, bbox.x0)}px`;
  el.style.top = `${scaleY(pageNo, bbox.y0)}px`;
  el.style.width = `${scaleX(pageNo, bbox.x1) - scaleX(pageNo, bbox.x0)}px`;
  el.style.height = `${scaleY(pageNo, bbox.y1) - scaleY(pageNo, bbox.y0)}px`;
}

export function renderFigureBoxes() {
  for (const page of state.pageDomByNo.values()) {
    if (!page.lineOverlay) continue;
    page.lineOverlay
      .querySelectorAll(".draw-rect")
      .forEach((el) => el.remove());
  }

  if (state.figurePageNo == null) return;

  const page = ensurePageShell(state.figurePageNo);
  if (!page?.lineOverlay) return;

  if (state.imageBBox) {
    const rect = document.createElement("div");
    rect.className = "draw-rect";
    placeRect(state.figurePageNo, rect, state.imageBBox);
    page.lineOverlay.appendChild(rect);
  }
}

export function updateFigureTexts() {
  if (els.figurePageNo) {
    els.figurePageNo.value =
      state.figurePageNo == null ? "" : String(Number(state.figurePageNo) + 1);
  }

  if (els.imageBboxText) {
    els.imageBboxText.textContent = `image_bbox: ${
      state.imageBBox ? JSON.stringify(state.imageBBox) : "未選択"
    }`;
  }
}

export function refreshSelectionView(pageNos = null) {
  updateSelectionUI();

  const targets =
    Array.isArray(pageNos) && pageNos.length
      ? pageNos
      : [...state.loadedPageNos];

  for (const pageNo of targets) {
    renderLinesForPage(pageNo);
  }
}