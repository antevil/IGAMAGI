import { els } from "./dom.js";
import { state } from "./state.js";
import {
  buildTextFromLines,
  getLinesByPage,
  getSelectedLines,
  isLineSelected,
} from "./selection.js";
import { escapeHtml, normalizeRect, scaleX, scaleY } from "./utils.js";

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

    const wrap = document.createElement("div");
    wrap.className = "pdf-wrap";

    const img = document.createElement("img");
    img.className = "page-image";
    img.alt = `Page ${pageNo + 1}`;
    img.draggable = false;

    const lineOverlay = document.createElement("div");
    lineOverlay.className = "pdf-overlay";
    lineOverlay.dataset.pageNo = String(pageNo);

    wrap.appendChild(img); 
    wrap.appendChild(lineOverlay);

    block.appendChild(label);
    block.appendChild(wrap);
    fragment.appendChild(block);

    state.pageDomByNo.set(pageNo, {
      block,
      wrap,
      img,
      lineOverlay,
    });
  }

  els.pdfStack.appendChild(fragment);
}

export function applyMode() {
  const isLineMode = state.mode === "line";
  const isFigureMode = state.mode === "figure";

  for (const page of state.pageDomByNo.values()) {
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
  const bodyText = buildTextFromLines(bodyLines);

  els.targetHeadingBtn?.classList.toggle(
    "is-active",
    state.selectionTarget === "heading"
  );
  els.targetBodyBtn?.classList.toggle(
    "is-active",
    state.selectionTarget === "body"
  );

  if (els.selectionTargetHint) {
    els.selectionTargetHint.textContent =
      state.selectionTarget === "heading"
        ? "現在: Heading選択。クリックで追加/解除、ドラッグで複数追加できます。"
        : "現在: Body選択。クリックで追加/解除、ドラッグで複数追加できます。";
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
  const page = state.pageDomByNo.get(Number(pageNo));
  if (!page) return;

  page.lineOverlay.innerHTML = "";

  const fragment = document.createDocumentFragment();
  const lines = getLinesByPage(pageNo);

  for (const line of lines) {
    const div = document.createElement("div");
    div.className = "line-box";
    div.dataset.lineId = String(line.id);

    // まず保存済み状態の色を付ける
    if (line.usage_type === "paragraph_heading") {
      div.classList.add("used-heading");
    } else if (line.usage_type === "paragraph_body") {
      div.classList.add("used-body");
    } else if (line.usage_type === "figure_caption") {
      div.classList.add("used-caption");
    }

    // 次に「今選択中」の色を上書き気味で付ける
    const inHeading = isLineSelected(line.id, "heading");
    const inBody = isLineSelected(line.id, "body");

    if (inHeading && inBody) {
      div.classList.add("selected-both");
    } else if (inHeading) {
      div.classList.add("selected-heading");
    } else if (inBody) {
      div.classList.add("selected-body");
    }

    div.style.left = `${scaleX(pageNo, line.x0)}px`;
    div.style.top = `${scaleY(pageNo, line.y0)}px`;
    div.style.width = `${Math.max(3, scaleX(pageNo, line.x1) - scaleX(pageNo, line.x0))}px`;
    div.style.height = `${Math.max(3, scaleY(pageNo, line.y1) - scaleY(pageNo, line.y0))}px`;
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
  for (const pageMeta of state.pages) {
    renderLinesForPage(pageMeta.page_no);
  }
}

function getOrCreateDragRectElement() {
  const page = state.pageDomByNo.get(Number(state.lineDrag.pageNo));
  if (!page) return null;

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
    page.lineOverlay.querySelectorAll(".draw-rect").forEach((el) => el.remove());
  }

  if (state.figurePageNo == null) return;

  const page = state.pageDomByNo.get(Number(state.figurePageNo));
  if (!page) return;

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

function paragraphCard(paragraph) {
  //あとで削除
  const card = document.createElement("div");
  card.className = "rounded-xl border border-zinc-800 bg-zinc-950/70 p-4 space-y-3";
  card.innerHTML = `
    <div class="text-base font-semibold">#${paragraph.order_index} ${escapeHtml(paragraph.heading_text || "(no heading)")}</div>
    <div class="text-sm text-zinc-400">${escapeHtml(paragraph.unit_type)} / p.${paragraph.page_no + 1} - ${paragraph.end_page_no + 1}</div>
    <div class="text-sm text-zinc-200 whitespace-pre-wrap">${escapeHtml(paragraph.raw_text || "")}</div>
  `;
  return card;
}

export function renderParagraphList() {
  //あとで削除
  if (!els.paragraphList) return;

  els.paragraphList.innerHTML = "";
  for (const paragraph of state.paragraphCache) {
    els.paragraphList.appendChild(paragraphCard(paragraph));
  }
}

export function renderFigureList() {
  //あとで削除
  if (!els.figureList) return;

  els.figureList.innerHTML = "";
  for (const figure of state.figureCache) {
    els.figureList.appendChild(figureCard(figure));
  }
}

export function refreshSelectionView() {
  updateSelectionUI();
  renderAllLines();
}