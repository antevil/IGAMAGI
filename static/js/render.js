function clampSize(v) {
  return Math.max(1, Number(v) || 1);
}

function makeRect(box, scaleX, scaleY) {
  const x0 = Number(box.x0 ?? 0);
  const y0 = Number(box.y0 ?? 0);
  const x1 = Number(box.x1 ?? 0);
  const y1 = Number(box.y1 ?? 0);

  const left = x0 * scaleX;
  const top = y0 * scaleY;
  const width = Math.max(1, (x1 - x0) * scaleX);
  const height = Math.max(1, (y1 - y0) * scaleY);

  return { left, top, width, height };
}

export function syncOverlaySize({ pageImage, lineOverlay, figureOverlay }) {
  if (!pageImage || !lineOverlay || !figureOverlay) return;

  const rect = pageImage.getBoundingClientRect();
  const width = clampSize(rect.width);
  const height = clampSize(rect.height);

  lineOverlay.style.width = `${width}px`;
  lineOverlay.style.height = `${height}px`;

  figureOverlay.style.width = `${width}px`;
  figureOverlay.style.height = `${height}px`;
}

export function renderLines({
  lines,
  startLineId,
  endLineId,
  pageNaturalWidth,
  pageNaturalHeight,
  pageImage,
  lineOverlay,
  mode,
  onLineClick
}) {
  if (!pageImage || !lineOverlay) return;

  lineOverlay.innerHTML = "";

  const rect = pageImage.getBoundingClientRect();
  const pageWidth = clampSize(pageNaturalWidth);
  const pageHeight = clampSize(pageNaturalHeight);
  const scaleX = rect.width / pageWidth;
  const scaleY = rect.height / pageHeight;

  const startIndex = lines.findIndex((x) => x.id === startLineId);
  const endIndex = lines.findIndex((x) => x.id === endLineId);

  let rangeMin = -1;
  let rangeMax = -1;

  if (startIndex >= 0 && endIndex >= 0) {
    rangeMin = Math.min(startIndex, endIndex);
    rangeMax = Math.max(startIndex, endIndex);
  }

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "bbox-btn line-bbox";
    btn.dataset.lineId = String(line.id);
    btn.title = line.text || `line ${line.id}`;

    const r = makeRect(line, scaleX, scaleY);
    btn.style.left = `${r.left}px`;
    btn.style.top = `${r.top}px`;
    btn.style.width = `${r.width}px`;
    btn.style.height = `${r.height}px`;

    if (line.id === startLineId) {
      btn.classList.add("is-start");
    }
    if (line.id === endLineId) {
      btn.classList.add("is-end");
    }
    if (rangeMin >= 0 && i >= rangeMin && i <= rangeMax) {
      btn.classList.add("is-in-range");
    }

    btn.style.pointerEvents = isLineMode(mode) ? "auto" : "none";

    btn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!isLineMode(mode)) return;
      onLineClick?.(line);
    });

    lineOverlay.appendChild(btn);
  }
}

export function renderFigures({
  figures,
  selectedFigureId,
  pageNaturalWidth,
  pageNaturalHeight,
  pageImage,
  figureOverlay,
  mode,
  onFigureClick
}) {
  if (!pageImage || !figureOverlay) return;

  figureOverlay.innerHTML = "";

  const rect = pageImage.getBoundingClientRect();
  const pageWidth = clampSize(pageNaturalWidth);
  const pageHeight = clampSize(pageNaturalHeight);
  const scaleX = rect.width / pageWidth;
  const scaleY = rect.height / pageHeight;

  for (const fig of figures) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "bbox-btn figure-bbox";
    btn.dataset.figureId = String(fig.id);
    btn.title = fig.label || `figure ${fig.id}`;

    const r = makeRect(fig, scaleX, scaleY);
    btn.style.left = `${r.left}px`;
    btn.style.top = `${r.top}px`;
    btn.style.width = `${r.width}px`;
    btn.style.height = `${r.height}px`;

    if (fig.id === selectedFigureId) {
      btn.classList.add("is-selected");
    }

    btn.style.pointerEvents = mode === "figure" ? "auto" : "none";

    btn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (mode !== "figure") return;
      onFigureClick?.(fig);
    });

    figureOverlay.appendChild(btn);
  }
}

export function isLineMode(mode) {
  return mode === "title" || mode === "summary" || mode === "paragraph";
}

export function applyOverlayMode({
  lineOverlay,
  figureOverlay,
  mode
}) {
  if (!lineOverlay || !figureOverlay) return;

  lineOverlay.style.pointerEvents = isLineMode(mode) ? "auto" : "none";
  figureOverlay.style.pointerEvents = mode === "figure" ? "auto" : "none";
}