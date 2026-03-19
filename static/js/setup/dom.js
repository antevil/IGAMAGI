export const boot = window.READER_BOOTSTRAP || {};

const $ = (id) => document.getElementById(id);

export const els = {
  pageSelect: $("pageSelect"),
  reloadBtn: $("reloadBtn"),

  titleInput: $("titleInput"),
  saveTitleBtn: $("saveTitleBtn"),

  pdfStack: $("pdfStack"),

  lineModeBtn: $("lineModeBtn"),
  figureModeBtn: $("figureModeBtn"),
  modeHint: $("modeHint"),

  targetHeadingBtn: $("targetHeadingBtn"),
  targetBodyBtn: $("targetBodyBtn"),
  selectionTargetHint: $("selectionTargetHint"),
  headingCountBadge: $("headingCountBadge"),
  bodyCountBadge: $("bodyCountBadge"),

  orderIndex: $("orderIndex"),
  unitType: $("unitType"),
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