import pdfMake from "pdfmake/build/pdfmake";
import pdfFonts from "pdfmake/build/vfs_fonts";
pdfMake.vfs = pdfFonts.pdfMake.vfs;

/***************************************
 CONSTANTS
****************************************/
const BASE_ROW_HEIGHT = 40;          // Normal row height
const HEADER_HEIGHT = 40;            // Header row
const PINNED_BOTTOM_HEIGHT = 40;     // Bottom row
const PAGE_HEIGHT_PT = 792;          // A4 portrait points
const PAGE_MARGIN_TOTAL = 80;        // combined top+bottom margins
const USABLE_HEIGHT = PAGE_HEIGHT_PT - PAGE_MARGIN_TOTAL;

/***************************************
 1. Extract renderCell DOM text
****************************************/
const getRenderedCellValue = (gridApi, column, rowIndex, node) => {
  try {
    const instances = gridApi.getCellRendererInstances({
      rowIndex,
      column
    });

    if (instances && instances.length > 0) {
      const inst = instances[0];
      if (inst?.eGui) {
        const text = inst.eGui.innerText?.trim() || inst.eGui.textContent?.trim();
        if (text) return text;
      }
    }
  } catch {}

  const raw = gridApi.getValue(column, node);
  return raw != null ? String(raw) : "";
};

/***************************************
 2. Build header
****************************************/
const buildHeaderRow = (gridApi) => {
  const columns = gridApi.columnModel.getAllDisplayedColumns();

  return columns.map((col) => ({
    text: col.getColDef().headerName || col.getColId(),
    bold: true,
    alignment: "left",
    fillColor: "#401664",
    color: "#fff",
    margin: [4, 10, 4, 10],
  }));
};

/***************************************
 3. Construct data rows (supports dynamic rowSpan)
****************************************/
const buildDataRows = (gridApi) => {
  const columns = gridApi.columnModel.getAllDisplayedColumns();
  const rowCount = gridApi.getDisplayedRowCount();
  const skipMap = new Map(); // rowIndex -> Set(colId)
  const rows = [];

  for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {
    if (!rows[rowIndex]) rows[rowIndex] = [];

    const node = gridApi.getDisplayedRowAtIndex(rowIndex);
    const row = [];
    const skipCols = skipMap.get(rowIndex) || new Set();

    columns.forEach((column) => {
      const colId = column.getColId();

      if (skipCols.has(colId)) {
        row.push(""); // spanning continuation
        return;
      }

      const colDef = column.getColDef();
      let rowSpan = 1;

      // dynamic rowSpan based on your AG Grid logic
      try {
        if (typeof column.getRowSpan === "function") {
          rowSpan = column.getRowSpan(node) || 1;
        } else if (typeof colDef.getRowSpan === "function") {
          rowSpan = colDef.getRowSpan(node) || 1;
        } else if (colDef.rowSpan) {
          rowSpan = colDef.rowSpan;
        }
      } catch {}

      // mark future rows to skip this col due to rowSpan
      if (rowSpan > 1) {
        for (let i = 1; i < rowSpan; i++) {
          const targetRow = rowIndex + i;
          if (!skipMap.has(targetRow)) skipMap.set(targetRow, new Set());
          skipMap.get(targetRow).add(colId);
        }
      }

      const value = getRenderedCellValue(gridApi, column, rowIndex, node);
      row.push({ text: value, rowSpan, margin: [4, 12, 4, 12] });
    });

    rows[rowIndex] = row;
  }

  return rows;
};

/***************************************
 4. Add pinned bottom row
****************************************/
const buildPinnedBottomRows = (gridApi) => {
  const result = [];
  const columns = gridApi.columnModel.getAllDisplayedColumns();

  const pinnedCount =
    gridApi.getPinnedBottomRowCount?.() ||
    (gridApi.getPinnedBottomRowData?.() || []).length;

  for (let i = 0; i < pinnedCount; i++) {
    const rowNode = gridApi.getPinnedBottomRow
      ? gridApi.getPinnedBottomRow(i)
      : { data: gridApi.getPinnedBottomRowData()[i] };

    const row = columns.map((column) => ({
      text: getRenderedCellValue(gridApi, column, null, rowNode),
      bold: true,
      margin: [4, 10, 4, 10],
    }));

    result.push(row);
  }

  return result;
};

/***************************************
 5. Calculate row height from rowSpan
****************************************/
const getRowHeightPt = (row) => {
  // find if any cell has rowSpan > 1
  let maxRowSpan = row.reduce((acc, c) => {
    if (c && typeof c === "object" && c.rowSpan > 1) {
      return Math.max(acc, c.rowSpan);
    }
    return acc;
  }, 1);

  return maxRowSpan * BASE_ROW_HEIGHT; // rowSpan * 40px
};

/***************************************
 6. Paginate rows to avoid splitting rowSpan
****************************************/
const paginateRows = (rows, headerRow, pinnedBottomRows) => {
  const pages = [];
  let pageRows = [];
  let heightUsed = HEADER_HEIGHT;

  for (const row of rows) {
    const h = getRowHeightPt(row);

    if (heightUsed + h > USABLE_HEIGHT) {
      pages.push(pageRows);
      pageRows = [];
      heightUsed = HEADER_HEIGHT;
    }

    pageRows.push(row);
    heightUsed += h;
  }

  if (pageRows.length) pages.push(pageRows);

  // add pinned bottom row to final page
  if (pinnedBottomRows.length) {
    if (heightUsed + PINNED_BOTTOM_HEIGHT > USABLE_HEIGHT) {
      pages.push([]);
    }
    pages[pages.length - 1].push(...pinnedBottomRows);
  }

  return pages;
};

/***************************************
 7. Build final pdfMake document
****************************************/
export const exportToPDF = (gridApi) => {
  const headerRow = buildHeaderRow(gridApi);
  const dataRows = buildDataRows(gridApi);
  const pinnedRows = buildPinnedBottomRows(gridApi);

  const pages = paginateRows(dataRows, headerRow, pinnedRows);

  const content = pages.map((pageRows) => ({
    table: {
      headerRows: 1,
      widths: "auto",
      body: [headerRow, ...pageRows],
    },
    layout: {
      fillColor: (i) => (i === 0 ? "#401664" : i % 2 === 0 ? "#fcfcfc" : "#fff"),
      hLineWidth: () => 0.5,
      vLineWidth: () => 0.5,
      hLineColor: () => "#dde2eb",
      vLineColor: () => "#dde2eb",
    },
    margin: [10, 10, 10, 10],
  }));

  pdfMake.createPdf({
    pageSize: "A4",
    pageMargins: [20, 40, 20, 40],
    content,
    footer: (p, pc) => ({
      columns: [
        { text: "Confidential", alignment: "left", margin: [10, 0] },
        { text: `Page ${p} of ${pc}`, alignment: "right", margin: [0, 0, 10, 0] }
      ]
    }),
  }).download("grid-export.pdf");
};
