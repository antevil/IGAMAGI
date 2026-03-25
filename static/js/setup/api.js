import { els } from "./dom.js";
import { state } from "./state.js";
import {
  clearSelectionState,
  getRepresentativeRangeIds,
  getSelectedLines,
} from "./selection.js";
import { clearFigureSelection } from "./figure.js";
import {
  applyMode,
  ensurePageShell,
  refreshSelectionView,
  renderFigureBoxes,
  renderLinesForPage,
  updateFigureTexts,
  updateSelectionUI,
} from "./render.js";
import { fetchJSON, showToast, syncOverlaySize } from "./utils.js";

function getPageNumbers() {
  return state.pages.map((page) => Number(page.page_no)).sort((a, b) => a - b);
}

function getNearbyPageNos(centerPageNo, radius = state.preloadRadius) {
  const pageNos = getPageNumbers();
  const index = pageNos.indexOf(Number(centerPageNo));

  if (index < 0) {
    return pageNos.length ? [pageNos[0]] : [];
  }

  const result = [];
  const start = Math.max(0, index - radius);
  const end = Math.min(pageNos.length - 1, index + radius);

  for (let i = start; i <= end; i += 1) {
    result.push(pageNos[i]);
  }

  return result;
}

function buildPreviewUrl(pageNo, { cacheBust = false } = {}) {
  const base = `/api/docs/${state.docId}/pages/${pageNo}/preview`;
  return cacheBust ? `${base}?ts=${Date.now()}` : base;
}

function resetLoadedPageState() {
  state.linesByPage.clear();
  state.pageNaturalSizeByPage.clear();
  state.lineIndex.clear();
  state.loadedPageNos.clear();
  state.loadingPagePromises.clear();
}

async function loadPageImage(pageNo, { force = false, cacheBust = false } = {}) {
  const page = ensurePageShell(pageNo);
  if (!page?.img) {
    return;
  }

  const nextSrc = buildPreviewUrl(pageNo, { cacheBust });

  if (
    !force &&
    page.img.dataset.loaded === "1" &&
    page.img.dataset.src === nextSrc
  ) {
    return;
  }

  await new Promise((resolve, reject) => {
    page.img.onload = () => {
      page.img.dataset.loaded = "1";
      page.img.dataset.src = nextSrc;
      resolve();
    };

    page.img.onerror = (event) => {
      reject(new Error(`image load failed: page ${pageNo}`));
    };

    page.img.src = nextSrc;
  });
}

function replacePageLines(pageNo, lines) {
  const oldLines = state.linesByPage.get(Number(pageNo)) || [];
  for (const oldLine of oldLines) {
    state.lineIndex.delete(Number(oldLine.id));
  }

  state.linesByPage.set(Number(pageNo), lines);

  for (const line of lines) {
    state.lineIndex.set(Number(line.id), line);
  }
}

export async function loadSinglePage(
  pageNo,
  { force = false, cacheBust = false } = {}
) {
  const normalizedPageNo = Number(pageNo);

  if (!force && state.loadedPageNos.has(normalizedPageNo)) {
    return;
  }

  if (!force && state.loadingPagePromises.has(normalizedPageNo)) {
    return state.loadingPagePromises.get(normalizedPageNo);
  }

  const task = (async () => {
    ensurePageShell(normalizedPageNo);

    await loadPageImage(normalizedPageNo, { force, cacheBust });
    const payload = await fetchJSON(
      `/api/docs/${state.docId}/pages/${normalizedPageNo}/lines`
    );
    state.pageNaturalSizeByPage.set(normalizedPageNo, {
      width: payload.page_width || 1,
      height: payload.page_height || 1,
    });

    const lines = Array.isArray(payload.lines) ? payload.lines : [];
    replacePageLines(normalizedPageNo, lines);

    syncOverlaySize(normalizedPageNo);
    renderLinesForPage(normalizedPageNo);
    applyMode();
    updateSelectionUI();

    if (state.figurePageNo === normalizedPageNo) {
      renderFigureBoxes();
      updateFigureTexts();
    }

    state.loadedPageNos.add(normalizedPageNo);
  })();

  state.loadingPagePromises.set(normalizedPageNo, task);

  try {
    await task;
  } finally {
    state.loadingPagePromises.delete(normalizedPageNo);
  }
}

export async function ensureNearbyPages(pageNo, options = {}) {
  const { force = false, cacheBust = false } = options;
  const targets = getNearbyPageNos(pageNo);
  await Promise.all(
    targets.map((targetPageNo) =>
      loadSinglePage(targetPageNo, { force, cacheBust })
    )
  );
}

export async function loadInitialPages(pageNo = state.pageNo) {
  resetLoadedPageState();
  await ensureNearbyPages(pageNo, { force: true, cacheBust: false });
}

export async function reloadLoadedPages() {
  const targets = state.loadedPageNos.size
    ? [...state.loadedPageNos]
    : getNearbyPageNos(state.pageNo);

  await Promise.all(
    targets.map((pageNo) =>
      loadSinglePage(pageNo, { force: true, cacheBust: true })
    )
  );

  refreshSelectionView(targets);
  renderFigureBoxes();
  updateFigureTexts();
}

function applyLineUsageLocally(lineIds, usageType) {
  for (const id of lineIds) {
    const line = state.lineIndex.get(Number(id));
    if (!line) continue;
    line.usage_type = usageType;
  }
}

export async function saveTitle() {
  if (
    !Array.isArray(state.titleSelectedLineIds) ||
    state.titleSelectedLineIds.length === 0
  ) {
    showToast("タイトル行を選択してください", true);
    return;
  }

  const result = await fetchJSON(`/api/docs/${state.docId}/title`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      line_ids: state.titleSelectedLineIds,
    }),
  });

  if (els.titleInput && result.title) {
    els.titleInput.value = result.title;
  }

  showToast("タイトルを保存しました");

  applyLineUsageLocally(state.titleSelectedLineIds, "document_title");

  state.titleEditMode = false;
  state.titleSelectedLineIds = [];

  state.activeTab = "paragraph";
  state.mode = "line";

  applyMode();
  refreshSelectionView();
}
export async function syncNextOrderIndex() {
  if (!state.docId || !els.orderIndex) return;

  const result = await fetchJSON(
    `/api/docs/${state.docId}/paragraphs/next_order_index`
  );

  els.orderIndex.value = String(result.next_order_index ?? 1);
}

export async function saveParagraph(options = {}) {
  const { openViewer = false } = options;

  const bodyLines = getSelectedLines("body");
  if (!bodyLines.length) {
    showToast("Body行を選択してください", true);
    return;
  }

  const headingLines = getSelectedLines("heading");
  const bodyRange = getRepresentativeRangeIds("body");

  const payload = {
    start_line_id: bodyRange.start_line_id,
    end_line_id: bodyRange.end_line_id,
    selected_line_ids: bodyLines.map((line) => Number(line.id)),
    heading_line_ids: headingLines.map((line) => Number(line.id)),
    order_index: Number(els.orderIndex.value || 0),
    unit_type: els.unitType.value,
  };

  const isEdit =
    Number.isFinite(state.editParagraphId) && state.editParagraphId > 0;

  const result = isEdit
    ? await fetchJSON(`/api/paragraphs/${state.editParagraphId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
    : await fetchJSON(`/api/docs/${state.docId}/paragraphs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

  await fetchJSON(`/api/paragraphs/${result.paragraph_id}/split_sentences`, {
    method: "POST",
  });

  const translateResult = await fetchJSON(
    `/api/paragraphs/${result.paragraph_id}/translate`,
    {
      method: "POST",
    }
  );

  showToast(
    !translateResult.deepl_enabled
      ? isEdit
        ? "段落を更新しました。DeepLキー未設定のため翻訳は空です"
        : "保存しました。DeepLキー未設定のため翻訳は空です"
      : isEdit
      ? "段落を更新して再翻訳しました"
      : "保存・文分割・翻訳まで完了しました"
  );

  applyLineUsageLocally(
    bodyLines.map((line) => Number(line.id)),
    "paragraph_body",
    result.paragraph_id
  );

  applyLineUsageLocally(
    headingLines.map((line) => Number(line.id)),
    "paragraph_heading",
    result.paragraph_id
  );
  clearSelectionState();
  refreshSelectionView();

  if (!isEdit) {
    await syncNextOrderIndex();
  }

  if (openViewer) {
    window.location.href = `/docs/${state.docId}/reader?paragraph_id=${result.paragraph_id}`;
  }
}

export async function loadParagraphForEditData(paragraphId) {
  return await fetchJSON(`/api/paragraphs/${paragraphId}`);
}

export async function loadFigureForEditData(figureId) {
  return await fetchJSON(`/api/figures/${figureId}`);
}

export async function saveFigure(options = {}) {
  const { openViewer = false } = options;

  if (!state.imageBBox) {
    showToast("図本体のbboxを選択してください", true);
    return;
  }

  if (state.figurePageNo == null) {
    showToast("figure の page が不明です", true);
    return;
  }

  if (!Array.isArray(state.figureCaptionSelectedLineIds)) {
    state.figureCaptionSelectedLineIds = [];
  }

  if (state.figureCaptionSelectedLineIds.length === 0) {
    showToast("caption line を選択してください", true);
    return;
  }

  const payload = {
    fig_no: els.figNoInput.value.trim() || "FIG",
    page_no: Number(state.figurePageNo),
    image_bbox: state.imageBBox,
    caption_line_ids: state.figureCaptionSelectedLineIds,
  };

  const isEdit =
    Number.isFinite(state.editFigureId) && state.editFigureId > 0;

  const result = isEdit
    ? await fetchJSON(`/api/figures/${state.editFigureId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })
    : await fetchJSON(`/api/docs/${state.docId}/figures`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

  showToast(isEdit ? "Figureを更新しました" : "Figureを保存しました");

  clearFigureSelection();
  state.figureCaptionSelectedLineIds = [];

  if (!isEdit) {
    state.editFigureId = null;
    if (els.figNoInput) {
      els.figNoInput.value = "FIG";
    }
  }

  updateFigureTexts();
  renderFigureBoxes();
  refreshSelectionView();

  if (openViewer) {
    window.location.href = `/docs/${state.docId}/reader?figure_id=${result.figure_id}`;
  }
}