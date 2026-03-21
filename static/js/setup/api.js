import { els } from "./dom.js";
import { state } from "./state.js";
import {
  getRepresentativeRangeIds,
  getSelectedLines,
} from "./selection.js";
import {
  createPageStack,
  renderAllLines,
  renderFigureBoxes,
  refreshSelectionView,
  updateFigureTexts,
  applyMode,
} from "./render.js";
import { clearFigureSelection } from "./figure.js";
import { clearSelectionState } from "./selection.js";
import { fetchJSON, showToast, syncOverlaySize } from "./utils.js";

async function loadSinglePage(pageNo) {
  //ここって削除してよい？
  const page = state.pageDomByNo.get(Number(pageNo));
  if (!page) return;

  page.img.src = `/api/docs/${state.docId}/pages/${pageNo}/preview?ts=${Date.now()}`;

  await new Promise((resolve, reject) => {
    page.img.onload = resolve;
    page.img.onerror = reject;
  });

  const payload = await fetchJSON(`/api/docs/${state.docId}/pages/${pageNo}/lines`);

  state.pageNaturalSizeByPage.set(Number(pageNo), {
    width: payload.page_width || 1,
    height: payload.page_height || 1,
  });

  const lines = Array.isArray(payload.lines) ? payload.lines : [];
  state.linesByPage.set(Number(pageNo), lines);

  for (const line of lines) {
    state.lineIndex.set(Number(line.id), line);
  }

  syncOverlaySize(pageNo);
  renderAllLines();
  renderFigureBoxes();
  updateFigureTexts();
  applyMode();
  refreshSelectionView();
}

export async function loadAllPages() {
  state.linesByPage.clear();
  state.pageNaturalSizeByPage.clear();
  state.lineIndex.clear();

  createPageStack();

  const tasks = state.pages.map((page) => loadSinglePage(page.page_no));
  await Promise.all(tasks);

  applyMode();
  refreshSelectionView();
  renderFigureBoxes();
  updateFigureTexts();
}

export async function saveTitle() {
  await fetchJSON(`/api/docs/${state.docId}/title`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title: els.titleInput.value.trim(),
    }),
  });

  showToast("タイトルを保存しました");
}

export async function saveParagraph(options = {}) {
  const { openViewer = false } = options;
  const bodyLines = getSelectedLines("body");
  if (!bodyLines.length) {
    showToast("Body行を選択してください", true);
    return;
  }

  const headingLines = getSelectedLines("heading");
  const bodyRange = getRepresentativeRangeIds("body"); //不明の関数。パラグラフのlineのリストなのかな？

  const payload = {
    start_line_id: bodyRange.start_line_id, //この辺も消していきたいな。
    end_line_id: bodyRange.end_line_id,
    selected_line_ids: bodyLines.map((line) => Number(line.id)), //ここはintに修正するのはバックエンドでやるからなくしてもいいのでは？
    heading_line_ids: headingLines.map((line) => Number(line.id)),
    order_index: Number(els.orderIndex.value || 0),
    unit_type: els.unitType.value,
  };

  const result = await fetchJSON(`/api/docs/${state.docId}/paragraphs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
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

  if (els.unitType.value === "title") {
    const titleText = buildTextFromLines(bodyLines);
    if (titleText) {
      els.titleInput.value = titleText;

      await fetchJSON(`/api/docs/${state.docId}/title`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: titleText,
        }),
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

  if (openViewer) {
    const url = `/docs/${state.docId}/reader?paragraph_id=${result.paragraph_id}`;
    window.location.href = url;
  }

}

export async function saveFigure() {
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

  await fetchJSON(`/api/docs/${state.docId}/figures`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  showToast("Figureを保存しました");

  clearFigureSelection();
  state.figureCaptionSelectedLineIds = [];

  updateFigureTexts();
  renderFigureBoxes();

  if (typeof loadFigures === "function") {
    await loadFigures();
  }

  refreshSelectionView();
}