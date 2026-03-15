import { boot } from "./dom.js";

export const state = {
  docId: boot.docId,
  pageNo: boot.initialPageNo || 0,
  lines: [],
  pageNaturalWidth: 1,
  pageNaturalHeight: 1,

  selectionTarget: "body",
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
  },

  imageBBox: null,
  captionBBox: null,
  drawing: null,

  paragraphCache: [],
  figureCache: [],

  mode: "line",
};

window.debugState = state;