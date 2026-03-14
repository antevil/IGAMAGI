// api.js
// ------------------------------------------------------------
// サーバー通信専用ファイルです。
// fetchまわりはここに寄せます。
// ------------------------------------------------------------

const state = window.readerState;
const els = window.readerEls;

// 汎用 JSON fetch
async function fetchJSON(url, options = {}) {
  const res = await fetch(url, options);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
}

// トースト表示
function showToast(message, isError = false) {
  if (!els.toast) return;

  els.toast.textContent = message;
  els.toast.classList.remove("hidden");
  els.toast.classList.toggle("border-rose-700", isError);
  els.toast.classList.toggle("bg-rose-950", isError);
  els.toast.classList.toggle("border-zinc-700", !isError);
  els.toast.classList.toggle("bg-zinc-900", !isError);

  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => els.toast.classList.add("hidden"), 2500);
}

// タイトル保存
async function saveTitleRequest() {
  return fetchJSON(`/api/docs/${state.docId}/title`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: els.titleInput?.value.trim() || "",
    }),
  });
}

// page geometry + lines を取得
// ここが今回かなり重要です。
// lines だけでなく page_width / page_height を返す前提です。
async function fetchPageLines(pageNo) {
  return fetchJSON(`/api/docs/${state.docId}/pages/${pageNo}/lines`);
}

// paragraph 一覧
async function fetchParagraphs() {
  return fetchJSON(`/api/docs/${state.docId}/paragraphs`);
}

// figure 一覧
async function fetchFigures() {
  return fetchJSON(`/api/docs/${state.docId}/figures`);
}

// paragraph 作成
async function createParagraph(payload) {
  return fetchJSON(`/api/docs/${state.docId}/paragraphs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

// paragraph の文分割
async function splitParagraph(paragraphId) {
  return fetchJSON(`/api/paragraphs/${paragraphId}/split_sentences`, {
    method: "POST",
  });
}

// paragraph の翻訳
async function translateParagraph(paragraphId) {
  return fetchJSON(`/api/paragraphs/${paragraphId}/translate`, {
    method: "POST",
  });
}

// figure 作成
async function createFigure(payload) {
  return fetchJSON(`/api/docs/${state.docId}/figures`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

// グローバル公開
window.readerApi = {
  fetchJSON,
  showToast,
  saveTitleRequest,
  fetchPageLines,
  fetchParagraphs,
  fetchFigures,
  createParagraph,
  splitParagraph,
  translateParagraph,
  createFigure,
};