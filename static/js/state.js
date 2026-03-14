// state.js
// ------------------------------------------------------------
// このファイルは「共有状態」と「DOM参照」をまとめる場所です。
// ほかのファイルはここから state / els を使います。
// ------------------------------------------------------------

// HTML側で先に window.READER_BOOTSTRAP を定義しておく前提
// 例:
// window.READER_BOOTSTRAP = {
//   docId: 1,
//   initialPageNo: 0
// };
const boot = window.READER_BOOTSTRAP || {};

// 現在の画面状態をまとめて持つ
// ここで大事なのは pageCoordWidth / pageCoordHeight です。
// これは「PDF内部座標系の幅高さ」で、line座標と同じ単位です。
// 以前の pageNaturalWidth / pageNaturalHeight は廃止します。
window.readerState = {
  docId: boot.docId ?? null,
  pageNo: boot.initialPageNo || 0,

  // 現在ページの lines 一覧
  lines: [],

  // PDFページ内部の座標系サイズ
  // APIから受け取る値をここに入れる
  pageCoordWidth: 1,
  pageCoordHeight: 1,

  // 段落選択用
  startLineId: null,
  endLineId: null,

  // Figure / Caption 選択用
  imageBBox: null,
  captionBBox: null,

  // ドラッグ中の一時状態
  drawing: null,

  // 一覧キャッシュ
  paragraphCache: [],
  figureCache: [],
};

// DOM取得ヘルパ
const $ = (id) => document.getElementById(id);

// setup画面で使う要素をまとめる
window.readerEls = {
  pageSelect: $("pageSelect"),
  reloadBtn: $("reloadBtn"),

  titleInput: $("titleInput"),
  saveTitleBtn: $("saveTitleBtn"),

  pageImage: $("pageImage"),
  lineOverlay: $("lineOverlay"),
  figureOverlay: $("figureOverlay"),

  startLineId: $("startLineId"),
  endLineId: $("endLineId"),
  orderIndex: $("orderIndex"),
  unitType: $("unitType"),
  headingText: $("headingText"),
  saveParagraphBtn: $("saveParagraphBtn"),
  clearSelectionBtn: $("clearSelectionBtn"),
  selectionStatus: $("selectionStatus"),

  paragraphList: $("paragraphList"),
  loadParagraphsBtn: $("loadParagraphsBtn"),

  figNoInput: $("figNoInput"),
  figurePageNo: $("figurePageNo"),
  captionTextInput: $("captionTextInput"),
  imageBboxText: $("imageBboxText"),
  captionBboxText: $("captionBboxText"),
  saveFigureBtn: $("saveFigureBtn"),
  clearFigureSelectionBtn: $("clearFigureSelectionBtn"),

  figureList: $("figureList"),
  loadFiguresBtn: $("loadFiguresBtn"),

  toast: $("toast"),
};