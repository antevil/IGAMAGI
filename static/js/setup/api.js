import { els } from "./dom.js";
import { state } from "./state.js";
import {
  buildTextFromLines,
  getRepresentativeRangeIds,
  getSelectedLines,
} from "./selection.js";
import {
  renderFigureBoxes,
  renderFigureList,
  renderLines,
  renderParagraphList,
  refreshSelectionView,
  updateFigureTexts,
  applyMode,
} from "./render.js";
import { clearFigureSelection } from "./figure.js";
import { clearSelectionState } from "./selection.js";
import { fetchJSON, showToast, syncOverlaySize } from "./utils.js";

export async function loadPage(pageNo) {
  state.pageNo = Number(pageNo);

  els.pageImage.src = `/api/docs/${state.docId}/pages/${state.pageNo}/preview?ts=${Date.now()}`;

  await new Promise((resolve, reject) => {
    els.pageImage.onload = resolve;
    els.pageImage.onerror = reject;
  });

  const payload = await fetchJSON(`/api/docs/${state.docId}/pages/${state.pageNo}/lines`);

  state.pageNaturalWidth = payload.page_width || 1;
  state.pageNaturalHeight = payload.page_height || 1;
  state.lines = payload.lines || [];

  syncOverlaySize();
  renderLines();
  renderFigureBoxes();
  updateFigureTexts();
  applyMode();
  refreshSelectionView();
}

export async function saveTitle() {
  await fetchJSON(`/api/docs/${state.docId}/title`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: els.titleInput.value.trim(),
    }),
  });

  showToast("タイトルを保存しました");
}

export async function loadParagraphs() {
  state.paragraphCache = await fetchJSON(`/api/docs/${state.docId}/paragraphs`);
  renderParagraphList();
}

export async function saveParagraph() {
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
    heading_text: els.headingText.value.trim() || buildTextFromLines(headingLines),
  };

  const result = await fetchJSON(`/api/docs/${state.docId}/paragraphs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  await fetchJSON(`/api/paragraphs/${result.paragraph_id}/split_sentences`, {
    method: "POST",
  });

  const translateResult = await fetchJSON(
    `/api/paragraphs/${result.paragraph_id}/translate`,
    { method: "POST" }
  );

  if (els.unitType.value === "title") {
    const titleText = buildTextFromLines(bodyLines);
    if (titleText) {
      els.titleInput.value = titleText;

      await fetchJSON(`/api/docs/${state.docId}/title`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: titleText }),
      });
    }
  }

  if (!translateResult.deepl_enabled) {
    showToast("保存しました。DeepLキー未設定のため翻訳は空です");
  } else {
    showToast("保存・文分割・翻訳まで完了しました");
  }

  els.orderIndex.value = Number(els.orderIndex.value || 0) + 1;

  clearSelectionState();
  refreshSelectionView();
  await loadParagraphs();
}

export async function loadFigures() {
  state.figureCache = await fetchJSON(`/api/docs/${state.docId}/figures`);
  renderFigureList();
}

export async function saveFigure() {
  if (!state.imageBBox) {
    showToast("図本体のbboxを選択してください", true);
    return;
  }

  const payload = {
    fig_no: els.figNoInput.value.trim() || "FIG",
    page_no: state.pageNo,
    image_bbox: state.imageBBox,
    caption_bbox: state.captionBBox,
    caption_text: els.captionTextInput.value.trim(),
  };

  await fetchJSON(`/api/docs/${state.docId}/figures`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  showToast("Figureを保存しました");

  clearFigureSelection();
  updateFigureTexts();
  renderFigureBoxes();

  els.figNoInput.value = "";
  els.captionTextInput.value = "";

  await loadFigures();
}