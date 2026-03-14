// setup.js
// ------------------------------------------------------------
// setup画面の司令塔です。
// 描画・イベント・保存処理の中心になります。
// ------------------------------------------------------------

const state = window.readerState;
const els = window.readerEls;
const api = window.readerApi;
const geo = window.readerGeometry;

// HTMLエスケープ
function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// 開始行 / 終了行の表示更新
function updateSelectionFields() {
  if (els.startLineId) els.startLineId.value = state.startLineId ?? "";
  if (els.endLineId) els.endLineId.value = state.endLineId ?? "";

  if (!els.selectionStatus) return;

  if (!state.startLineId && !state.endLineId) {
    els.selectionStatus.textContent = "開始行と終了行を選択";
  } else if (state.startLineId && !state.endLineId) {
    els.selectionStatus.textContent = "終了行を選択してください";
  } else {
    els.selectionStatus.textContent = "保存できます";
  }
}

// figure bbox テキスト表示更新
function updateFigureTexts() {
  if (els.figurePageNo) els.figurePageNo.value = state.pageNo;
  if (els.imageBboxText) {
    els.imageBboxText.textContent =
      `image_bbox: ${state.imageBBox ? JSON.stringify(state.imageBBox) : "未選択"}`;
  }
  if (els.captionBboxText) {
    els.captionBboxText.textContent =
      `caption_bbox: ${state.captionBBox ? JSON.stringify(state.captionBBox) : "未選択"}`;
  }
}

// line の順序比較
function compareLineOrder(a, b) {
  if (a.page_no !== b.page_no) return a.page_no - b.page_no;
  return a.line_no - b.line_no;
}

// 選択範囲に line が含まれているか
function isWithinSelectedRange(line) {
  if (!state.startLineId || !state.endLineId) return false;

  const start = state.lines.find((x) => x.id === state.startLineId);
  const end = state.lines.find((x) => x.id === state.endLineId);

  if (!start || !end || start.page_no !== end.page_no) return false;

  const [lo, hi] = [start.line_no, end.line_no].sort((a, b) => a - b);
  return line.line_no >= lo && line.line_no <= hi;
}

// line を描く
function renderLines() {
  if (!els.lineOverlay) return;
  els.lineOverlay.innerHTML = "";

  const fragment = document.createDocumentFragment();

  for (const line of state.lines) {
    const div = document.createElement("button");
    div.type = "button";
    div.className = "line-box";

    if (line.id === state.startLineId) div.classList.add("selected-start");
    if (line.id === state.endLineId) div.classList.add("selected-end");
    if (isWithinSelectedRange(line) && line.id !== state.startLineId && line.id !== state.endLineId) {
      div.classList.add("selected-between");
    }

    div.style.left = `${geo.scaleX(line.x0)}px`;
    div.style.top = `${geo.scaleY(line.y0)}px`;
    div.style.width = `${Math.max(3, geo.scaleX(line.x1) - geo.scaleX(line.x0))}px`;
    div.style.height = `${Math.max(3, geo.scaleY(line.y1) - geo.scaleY(line.y0))}px`;

    div.title = `${line.line_no}: ${line.text}`;
    div.addEventListener("click", () => selectLine(line));
    fragment.appendChild(div);
  }

  els.lineOverlay.appendChild(fragment);
}

// 共通矩形配置
function placeRect(el, bbox) {
  el.style.left = `${geo.scaleX(bbox.x0)}px`;
  el.style.top = `${geo.scaleY(bbox.y0)}px`;
  el.style.width = `${geo.scaleX(bbox.x1) - geo.scaleX(bbox.x0)}px`;
  el.style.height = `${geo.scaleY(bbox.y1) - geo.scaleY(bbox.y0)}px`;
}

// figure bbox を描く
function renderFigureBoxes() {
  if (!els.figureOverlay) return;

  els.figureOverlay.querySelectorAll(".draw-rect").forEach((el) => el.remove());

  if (state.imageBBox) {
    const rect = document.createElement("div");
    rect.className = "draw-rect";
    placeRect(rect, state.imageBBox);
    els.figureOverlay.appendChild(rect);
  }

  if (state.captionBBox) {
    const rect = document.createElement("div");
    rect.className = "draw-rect caption";
    placeRect(rect, state.captionBBox);
    els.figureOverlay.appendChild(rect);
  }
}

// line選択
function selectLine(line) {
  if (!state.startLineId || (state.startLineId && state.endLineId)) {
    state.startLineId = line.id;
    state.endLineId = null;
  } else {
    state.endLineId = line.id;
    const start = state.lines.find((x) => x.id === state.startLineId);
    if (start && compareLineOrder(line, start) < 0) {
      state.endLineId = state.startLineId;
      state.startLineId = line.id;
    }
  }

  updateSelectionFields();
  renderLines();
}

// 段落選択クリア
function clearSelection() {
  state.startLineId = null;
  state.endLineId = null;
  updateSelectionFields();
  renderLines();
}

// figure 選択クリア
function clearFigureSelection() {
  state.imageBBox = null;
  state.captionBBox = null;
  state.drawing = null;
  updateFigureTexts();
  renderFigureBoxes();
}

// ページ読み込み
// ここが今回の修正ポイントです。
// 先に lines + page geometry を取り、そのあと画像表示後に描画します。
async function loadPage(pageNo) {
  state.pageNo = Number(pageNo);

  const payload = await api.fetchPageLines(state.pageNo);
  state.pageCoordWidth = payload.page_width;
  state.pageCoordHeight = payload.page_height;
  state.lines = payload.lines;

  els.pageImage.onload = () => {
    geo.syncOverlaySize();
    renderLines();
    renderFigureBoxes();
    updateFigureTexts();
  };

  els.pageImage.src = `/api/docs/${state.docId}/pages/${state.pageNo}/preview?ts=${Date.now()}`;
}

// タイトル保存
async function saveTitle() {
  await api.saveTitleRequest();
  api.showToast("タイトルを保存しました");
}

// 段落カード
function paragraphCard(paragraph) {
  const card = document.createElement("div");
  card.className = "rounded-xl border border-zinc-800 bg-zinc-950/70 p-4 space-y-3";
  card.innerHTML = `
    <div class="font-medium">#${paragraph.order_index} ${escapeHtml(paragraph.heading_text || "(no heading)")}</div>
    <div class="text-xs text-zinc-400">${escapeHtml(paragraph.unit_type)} / p.${paragraph.page_no + 1} - ${paragraph.end_page_no + 1}</div>
    <div class="text-sm leading-6 text-zinc-300 whitespace-pre-wrap">${escapeHtml(paragraph.raw_text || "")}</div>
  `;
  return card;
}

// 段落一覧読み込み
async function loadParagraphs() {
  state.paragraphCache = await api.fetchParagraphs();
  if (!els.paragraphList) return;

  els.paragraphList.innerHTML = "";
  for (const p of state.paragraphCache) {
    els.paragraphList.appendChild(paragraphCard(p));
  }
}

// 段落保存
async function saveParagraph() {
  if (!state.startLineId || !state.endLineId) {
    api.showToast("開始行と終了行を選択してください", true);
    return;
  }

  const payload = {
    start_line_id: Number(state.startLineId),
    end_line_id: Number(state.endLineId),
    order_index: Number(els.orderIndex.value || 0),
    unit_type: els.unitType.value,
    heading_text: els.headingText.value.trim(),
  };

  const result = await api.createParagraph(payload);
  await api.splitParagraph(result.paragraph_id);
  const translateResult = await api.translateParagraph(result.paragraph_id);

  if (!translateResult.deepl_enabled) {
    api.showToast("段落保存。DeepLキー未設定のため翻訳は空です");
  } else {
    api.showToast("段落保存・文分割・翻訳まで完了しました");
  }

  els.orderIndex.value = Number(els.orderIndex.value || 0) + 1;
  clearSelection();
  await loadParagraphs();
}

// figure カード
function figureCard(figure) {
  const card = document.createElement("div");
  card.className = "rounded-xl border border-zinc-800 bg-zinc-950/70 p-4 space-y-3";
  const imgSrc = figure.image_path ? `/${figure.image_path}` : "";

  card.innerHTML = `
    <div>
      <div class="font-medium">${escapeHtml(figure.fig_no)}</div>
      <div class="text-xs text-zinc-400">page ${figure.page_no + 1}</div>
    </div>
    ${imgSrc ? `<img src="${imgSrc}" alt="${escapeHtml(figure.fig_no)}" class="w-full rounded-lg border border-zinc-800 bg-white">` : ""}
    <div class="text-sm leading-6 text-zinc-300 whitespace-pre-wrap">${escapeHtml(figure.caption_text || "")}</div>
  `;
  return card;
}

// figure 一覧読み込み
async function loadFigures() {
  state.figureCache = await api.fetchFigures();
  if (!els.figureList) return;

  els.figureList.innerHTML = "";
  for (const fig of state.figureCache) {
    els.figureList.appendChild(figureCard(fig));
  }
}

// figure 保存
async function saveFigure() {
  if (!state.imageBBox) {
    api.showToast("図本体のbboxを選択してください", true);
    return;
  }

  const payload = {
    fig_no: els.figNoInput.value.trim() || "FIG",
    page_no: state.pageNo,
    image_bbox: state.imageBBox,
    caption_bbox: state.captionBBox,
    caption_text: els.captionTextInput.value.trim(),
  };

  await api.createFigure(payload);

  api.showToast("Figureを保存しました");
  clearFigureSelection();
  els.figNoInput.value = "";
  els.captionTextInput.value = "";
  await loadFigures();
}

// ドラッグ開始
function startDraw(event) {
  if (!(event.shiftKey || event.altKey)) return;
  event.preventDefault();

  const rect = els.figureOverlay.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;

  state.drawing = {
    mode: event.altKey ? "caption" : "image",
    x0: x,
    y0: y,
    x1: x,
    y1: y,
  };

  renderFigureBoxes();
}

// ドラッグ中
// 今回の修正版では、プレビュー矩形もいったん PDF座標に戻してから
// placeRect() で描くので、本番 bbox と同じ変換ルートになります。
function moveDraw(event) {
  if (!state.drawing) return;

  const rect = els.figureOverlay.getBoundingClientRect();
  state.drawing.x1 = Math.max(0, Math.min(rect.width, event.clientX - rect.left));
  state.drawing.y1 = Math.max(0, Math.min(rect.height, event.clientY - rect.top));

  renderFigureBoxes();

  const previewRect = document.createElement("div");
  previewRect.className = `draw-rect${state.drawing.mode === "caption" ? " caption" : ""}`;

  const previewBBox = geo.normalizeBBox({
    x0: geo.unscaleX(state.drawing.x0),
    y0: geo.unscaleY(state.drawing.y0),
    x1: geo.unscaleX(state.drawing.x1),
    y1: geo.unscaleY(state.drawing.y1),
  });

  placeRect(previewRect, previewBBox);
  els.figureOverlay.appendChild(previewRect);
}

// ドラッグ終了
function endDraw() {
  if (!state.drawing) return;

  const bbox = geo.normalizeBBox({
    x0: geo.unscaleX(state.drawing.x0),
    y0: geo.unscaleY(state.drawing.y0),
    x1: geo.unscaleX(state.drawing.x1),
    y1: geo.unscaleY(state.drawing.y1),
  });

  // 小さすぎる選択は無視
  if ((bbox.x1 - bbox.x0) >= 5 && (bbox.y1 - bbox.y0) >= 5) {
    const fixedBBox = {
      x0: Number(bbox.x0.toFixed(2)),
      y0: Number(bbox.y0.toFixed(2)),
      x1: Number(bbox.x1.toFixed(2)),
      y1: Number(bbox.y1.toFixed(2)),
    };

    if (state.drawing.mode === "caption") {
      state.captionBBox = fixedBBox;
    } else {
      state.imageBBox = fixedBBox;
    }
  }

  state.drawing = null;
  updateFigureTexts();
  renderFigureBoxes();
}

// イベント束ね
function bindEvents() {
  els.pageSelect?.addEventListener("change", () => loadPage(els.pageSelect.value));
  els.reloadBtn?.addEventListener("click", () => loadPage(state.pageNo));

  els.saveTitleBtn?.addEventListener("click", saveTitle);

  els.saveParagraphBtn?.addEventListener("click", saveParagraph);
  els.clearSelectionBtn?.addEventListener("click", clearSelection);
  els.loadParagraphsBtn?.addEventListener("click", loadParagraphs);

  els.saveFigureBtn?.addEventListener("click", saveFigure);
  els.clearFigureSelectionBtn?.addEventListener("click", clearFigureSelection);
  els.loadFiguresBtn?.addEventListener("click", loadFigures);

  window.addEventListener("resize", () => {
    geo.syncOverlaySize();
    renderLines();
    renderFigureBoxes();
  });

  els.figureOverlay?.addEventListener("mousedown", startDraw);
  window.addEventListener("mousemove", moveDraw);
  window.addEventListener("mouseup", endDraw);
}

// 初期化
async function init() {
  if (!state.docId) {
    console.error("docId がありません");
    return;
  }

  bindEvents();
  updateSelectionFields();
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
  api.showToast(err.message || "初期化に失敗しました", true);
});