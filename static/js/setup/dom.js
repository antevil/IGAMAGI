export const boot = window.READER_BOOTSTRAP || {};

const $ = (id) => document.getElementById(id);

export const els = {
  pageSelect: $("pageSelect"),
  reloadBtn: $("reloadBtn"),

  titleInput: $("titleInput"),
  saveTitleBtn: $("saveTitleBtn"),

  pdfStack: $("pdfStack"),

  tabMetaBtn: $("tabMetaBtn"),
  tabParagraphBtn: $("tabParagraphBtn"),
  tabFigureBtn: $("tabFigureBtn"),

  metaPanel: $("metaPanel"),
  paragraphPanel: $("paragraphPanel"),
  figurePanel: $("figurePanel"),

  lineModeBtn: $("lineModeBtn"),
  figureModeBtn: $("figureModeBtn"),
  modeHint: $("modeHint"),

  targetHeadingBtn: $("targetHeadingBtn"),
  targetBodyBtn: $("targetBodyBtn"),
  selectionTargetHint: $("selectionTargetHint"),
  saveParagraphAndOpenBtn: $("saveParagraphAndOpenBtn"),
  headingCountBadge: $("headingCountBadge"),
  bodyCountBadge: $("bodyCountBadge"),

  orderIndex: $("orderIndex"),
  unitType: $("unitType"),
  saveParagraphBtn: $("saveParagraphBtn"),
  clearSelectionBtn: $("clearSelectionBtn"),
  selectionStatus: $("selectionStatus"),

  figNoInput: $("figNoInput"),
  figurePageNo: $("figurePageNo"),
  captionTextInput: $("captionTextInput"),
  imageBboxText: $("imageBboxText"),
  saveFigureBtn: $("saveFigureBtn"),
  clearFigureSelectionBtn: $("clearFigureSelectionBtn"),

  figureList: $("figureList"),
  toast: $("toast"),
  
  zoomOutBtn: $("zoomOutBtn"),
  zoomResetBtn: $("zoomResetBtn"),
  zoomInBtn: $("zoomInBtn"),
  zoomLabel: $("zoomLabel"),
};