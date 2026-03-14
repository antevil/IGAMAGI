// geometry.js
// ------------------------------------------------------------
// 座標変換専用ファイルです。
// ここが今回の「枠ズレ修正」の中心です。
// ------------------------------------------------------------

const gState = window.readerState;
const gEls = window.readerEls;

// overlay の見た目サイズを、実際の画像表示サイズに合わせる
function syncOverlaySize() {
  if (!gEls.pageImage || !gEls.lineOverlay || !gEls.figureOverlay) return;

  const width = gEls.pageImage.clientWidth;
  const height = gEls.pageImage.clientHeight;

  gEls.lineOverlay.style.width = `${width}px`;
  gEls.lineOverlay.style.height = `${height}px`;
  gEls.figureOverlay.style.width = `${width}px`;
  gEls.figureOverlay.style.height = `${height}px`;
}

// PDF座標 -> 画面座標
// line.x0 などのPDF内部座標を、画面上のpxへ変換する
function scaleX(x) {
  return (x / gState.pageCoordWidth) * gEls.pageImage.clientWidth;
}

function scaleY(y) {
  return (y / gState.pageCoordHeight) * gEls.pageImage.clientHeight;
}

// 画面座標 -> PDF座標
// ドラッグやクリックで得た見た目上のpxを、PDF内部座標へ戻す
function unscaleX(x) {
  return (x / gEls.pageImage.clientWidth) * gState.pageCoordWidth;
}

function unscaleY(y) {
  return (y / gEls.pageImage.clientHeight) * gState.pageCoordHeight;
}

// bboxを正規化
// 左上・右下の順になるように並べ替える
function normalizeBBox(bbox) {
  return {
    x0: Math.min(bbox.x0, bbox.x1),
    y0: Math.min(bbox.y0, bbox.y1),
    x1: Math.max(bbox.x0, bbox.x1),
    y1: Math.max(bbox.y0, bbox.y1),
  };
}

// グローバル公開
window.readerGeometry = {
  syncOverlaySize,
  scaleX,
  scaleY,
  unscaleX,
  unscaleY,
  normalizeBBox,
};