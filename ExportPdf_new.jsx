import pdfMake from "pdfmake/build/pdfmake";
import pdfFonts from "pdfmake/build/vfs_fonts";

pdfMake.vfs = pdfFonts;

const PAGE_HEIGHT = 770; // Approx A4 landscape usable page height in pdfMake units
const HEADER_ROW_HEIGHT = 40;
const NORMAL_ROW_HEIGHT = 80;
const PINNED_BOTTOM_ROW_HEIGHT = 40;

/**
 * Build header cells with styling
 */
const getHeaderToExport = (gridApi) => {
  const columns = gridApi.columnModel.getAllDisplayedColumns();
  return columns.map((column) => {
    const { field, headerName } = column.getColDef();
    const headerText = headerName ?? field ?? "";
    return {
      text: headerText[0]?.toUpperCase() + headerText.slice(1),
      bold: true,
      margin: [0, 12, 0, 0],
      fillColor: "#401664",
      color: "#ffffff",
      alignment: "center",
      noWrap: true,
    };
  });
};

/**
 * Build all rows for export, including pinned bottom rows,
 * with no row splitting across pages.
 */
const getRowsToExport = (gridApi) => {
  const columns = gridApi.columnModel.getAllDisplayedColumns();
  const rowsToExport = [];
  const rowCount = gridApi.getDisplayedRowCount();
  const skipMap = new Map(); // key: rowIndex, value: Set of colIds to skip
  const maxRowSpanPerRow = new Map(); // key: rowIndex, value: max rowspan in that row

  let currentPageHeight = HEADER_ROW_HEIGHT;

  // Helper for a single row
  const processRow = (rowIndex, node, isPinnedBottom = false) => {
    if (!node) return;
    const row = [];
    let maxRowSpanInThisRow = 1;

    columns.forEach((column) => {
      const colId = column.getColId();
      const colDef = column.getColDef();
      const value = colDef.exportValueGetter
        ? colDef.exportValueGetter({ data: node.data, node, colDef, column })
        : gridApi.getValue(column, node) ?? "";
      const cellStyle = colDef.cellStyle || {};
      const supportsRowSpan = typeof column.getRowSpan === "function";
      const rowSpan = supportsRowSpan ? column.getRowSpan(node) : 1;
      if (rowSpan > maxRowSpanInThisRow) maxRowSpanInThisRow = rowSpan;

      // Skip if part of previous rowspan
      if (skipMap.has(rowIndex) && skipMap.get(rowIndex).has(colId)) {
        row.push(""); // placeholder
        return;
      }

      if (rowSpan > 1) {
        // Mark future rows to skip this column
        for (let i = 1; i < rowSpan; i++) {
          const skipRow = rowIndex + i;
          if (!skipMap.has(skipRow)) skipMap.set(skipRow, new Set());
          skipMap.get(skipRow).add(colId);
        }
        row.push({
          text: value,
          rowSpan,
          alignment: "center",
          ...cellStyle,
          margin: [0, 50, 0, 0],
          noWrap: false
        });
      } else {
        row.push({
          text: value,
          ...cellStyle,
          margin: [2, 2, 2, 2],
          noWrap: false
        });
      }
    });

    maxRowSpanPerRow.set(rowIndex, maxRowSpanInThisRow);

    // Determine row height
    const rowHeight = isPinnedBottom
      ? PINNED_BOTTOM_ROW_HEIGHT
      : maxRowSpanInThisRow * NORMAL_ROW_HEIGHT;

    // Manual page break if not enough space for full row
    if (currentPageHeight + rowHeight > PAGE_HEIGHT) {
      const breakRow = Array(columns.length).fill("");
      breakRow[0] = { text: "", pageBreak: "before", colSpan: columns.length };
      rowsToExport.push(breakRow);
      currentPageHeight = HEADER_ROW_HEIGHT;
    }

    rowsToExport.push(row);
    currentPageHeight += rowHeight;
  };

  // Normal rows
  for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {
    const node = gridApi.getDisplayedRowAtIndex(rowIndex);
    processRow(rowIndex, node);
  }
  // Pinned bottom rows
  const pinnedCount = gridApi.getPinnedBottomRowCount ? gridApi.getPinnedBottomRowCount() : 0;
  for (let i = 0; i < pinnedCount; i++) {
    const pinnedNode = gridApi.getPinnedBottomRow(i);
    // Use rowIndex beyond body rows to avoid collisions in Map
    processRow(rowCount + i, pinnedNode, true);
  }

  getRowsToExport.getRowSpanOfRow = (rowIndex) =>
    maxRowSpanPerRow.get(rowIndex) || 1;

  return rowsToExport;
};

/**
 * PDF document definition creator
 */
const getDocument = (gridApi) => {
  const columns = gridApi.columnModel.getAllDisplayedColumns();
  const headerRow = getHeaderToExport(gridApi);
  const rows = getRowsToExport(gridApi);

  return {
    pageOrientation: "landscape",
    pageSize: "A4",
    pageMargins: [10, 40, 10, 40],
    header: {
      text: "Exported Data",
      alignment: "right",
      style: "header",
      margin: [0, 10, 10, 0],
    },
    footer: (currentPage, pageCount) => ({
      columns: [
        { text: "Information Classification - Confidential", alignment: "left", margin: [10, 0, 0, 10] },
        { text: `Page ${currentPage} of ${pageCount}`, alignment: "right", margin: [0, 0, 10, 10] },
      ],
    }),
    content: [
      {
        table: {
          headerRows: 1,
          widths: columns.map(() => `${100 / columns.length}%`),
          body: [headerRow, ...rows],
          heights: (rowIndex) =>
            rowIndex === 0
              ? HEADER_ROW_HEIGHT
              : "auto",
          dontBreakRows: true // Ensures PDF never splits a row
        },
        layout: {
          fillColor: (rowIndex) =>
            rowIndex === 0
              ? "#401664"
              : rowIndex % 2 === 0
              ? "#fcfcfc"
              : "#fff",
          hLineWidth: () => 1,
          vLineWidth: () => 1,
          hLineColor: () => "#dde2eb",
          vLineColor: () => "#dde2eb",
        },
      },
    ],
    styles: {
      header: { fontSize: 16, bold: true },
    },
  };
};

/**
 * Export trigger function.
 */
export const exportToPDF = (gridApi) => {
  const docDefinition = getDocument(gridApi);
  pdfMake.createPdf(docDefinition).download();
};
