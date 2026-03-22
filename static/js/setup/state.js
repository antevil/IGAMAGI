import { boot } from "./dom.js";

export const state = {
  docId: boot.docId,
  pageNo: boot.initialPageNo || 0,
  pages: Array.isArray(boot.pages) ? boot.pages : [],

  linesByPage: new Map(),
  pageNaturalSizeByPage: new Map(),
  pageDomByNo: new Map(),
  lineIndex: new Map(),

  activeTab: "paragraph",

  headingSelectedLineIds: [],
  bodySelectedLineIds: [],

  lineDrag: {
    active: false,
    moved: false,
    x0: 0,
    y0: 0,
    x1: 0,
    y1: 0,
    pointerId: null,
    startedOnLineId: null,
    captureStarted: false,
    pageNo: null,
    overlayEl: null,
    target: "body",
  },

  imageBBox: null,
  figurePageNo: null,
  drawing: null,

  figureCache: [],

  zoom: 1,
  minZoom: 0.6,
  maxZoom: 1.6,
  zoomStep: 0.1,

  editParagraphId: null,

  mode: "line",
};

window.debugState = state;