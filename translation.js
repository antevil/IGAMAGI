// translation.js
(() => {

  const cache = new Map();
  let controller = null;

  function findTranslationEl(index) {
    return document.querySelector(
      `[data-index="${index}"] .js-translation`
    );
  }

  function setText(index, text) {
    const el = findTranslationEl(index);
    if (!el) return;
    el.textContent = text;
  }

  async function fetchTranslation(index, text) {
    const qs = new URLSearchParams({
      index: String(index),
      text: text || ""
    });

    const res = await fetch(`/api/translate_mock?${qs}`);
    if (!res.ok) throw new Error("API error");

    const data = await res.json();
    return data.translation;
  }

  async function update(index, unit) {
    if (cache.has(index)) {
      setText(index, cache.get(index));
      return;
    }

    setText(index, "（翻訳中…）");

    if (controller) controller.abort();
    controller = new AbortController();

    try {
      const text = unit?.text || "";
      const result = await fetchTranslation(index, text);
      cache.set(index, result);
      setText(index, result);
    } catch (e) {
      if (e.name !== "AbortError") {
        setText(index, "（翻訳失敗）");
      }
    }
  }

  // ここだけがReaderとの接点
  window.addEventListener("currentchange", (e) => {
    const { index, unit } = e.detail || {};
    if (typeof index !== "number") return;
    update(index, unit);
  });

})();