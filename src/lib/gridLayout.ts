export interface GridLayoutDimensions {
  rows: number;
  cols: number;
}

const GRID_LAYOUT_PATTERN = /^([1-9]\d*)x([1-9]\d*)$/;

export const parseGridLayout = (
  layout: string,
): GridLayoutDimensions | null => {
  const match = GRID_LAYOUT_PATTERN.exec(layout);
  if (!match) {
    return null;
  }

  const rows = Number(match[1]);
  const cols = Number(match[2]);

  if (!Number.isInteger(rows) || !Number.isInteger(cols)) {
    return null;
  }

  return { rows, cols };
};

export const getGridLayoutPaneCount = (layout: string): number => {
  const parsed = parseGridLayout(layout);
  if (!parsed) {
    return 1;
  }
  return parsed.rows * parsed.cols;
};

export const buildGridLayoutId = (
  rows: number,
  cols: number,
): `${number}x${number}` => {
  const safeRows = Math.max(1, Math.floor(rows));
  const safeCols = Math.max(1, Math.floor(cols));
  return `${safeRows}x${safeCols}`;
};
