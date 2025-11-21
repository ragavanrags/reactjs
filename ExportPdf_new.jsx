import pdfMake from "pdfmake/build/pdfmake";
import pdfFonts from "pdfmake/build/vfs_fonts";

pdfMake.vfs = pdfFonts;

const PAGE_HEIGHT = 770; // Approx A4 landscape usable page height in pdfMake units
const HEADER_ROW_HEIGHT = 40;
const NORMAL_ROW_HEIGHT = 80;
const PINNED_BOTTOM_ROW_HEIGHT = 40;

/**
 * Builds header cells with style
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
 * Extract text from live rendered cell if possible, else fallback to raw value
 */
const getCellTextFromRenderer = (gridApi, column, node) => {
  const instances = gridApi.getCellRendererInstances({
    rowNodes: [node],
    columns: [column],
  });

  if (instances.length > 0) {
    const rendererInstance = instances[0];
    if (typeof rendererInstance.getExportValue === "function") {
      return rendererInstance.getExportValue();
    }
    if (rendererInstance.gui) {
      return rendererInstance.gui.innerText || "";
    }
  }
  return gridApi.getValue(column, node) ?? "";
};

/**
 * Returns true if adding a row with given height will overflow the page
 */
const willRowSplitPage = (currentHeight, rowHeight) => currentHeight + rowHeight > PAGE_HEIGHT;

/**
 * Build all rows to export including pinned bottom rows,
 * inserting manual page breaks to prevent splitting of multi-row rowspans
 */
const getRowsToExport = (gridApi) => {
  const columns = gridApi.columnModel.getAllDisplayedColumns();
  const rowsToExport = [];
  const skipMap = new Map();

  let currentPageHeight = HEADER_ROW_HEIGHT;

  const processRow = (node, isPinnedBottom = false) => {
    if (!node) return;
    const row = [];
    const cellRowSpans = [];

    for (const column of columns) {
      const colId = column.getColId();

      if (skipMap.has(node.rowIndex) && skipMap.get(node.rowIndex).has(colId)) {
        row.push("");
        cellRowSpans.push(0);
        continue;
      }

      const cellText = getCellTextFromRenderer(gridApi, column, node);
      const colDef = column.getColDef();
      const supportsRowSpan = typeof column.getRowSpan === "function";
      const rowSpan = supportsRowSpan ? column.getRowSpan(node) : 1;

      if (rowSpan > 1) {
        for (let i = 1; i < rowSpan; i++) {
          const skipRow = node.rowIndex + i;
          if (!skipMap.has(skipRow)) skipMap.set(skipRow, new Set());
          skipMap.get(skipRow).add(colId);
        }
      }

      cellRowSpans.push(rowSpan);

      row.push({
        text: cellText,
        rowSpan: rowSpan > 1 ? rowSpan : undefined,
        alignment: rowSpan > 1 ? "center" : "left",
        margin: [2, 5, 2, 5],
        noWrap: false,
        ...colDef.cellStyle,
      });
    }

    // Calculate row height based on rowspan - for pinned bottom rows use fixed smaller height
    const maxRowSpan = Math.max(...cellRowSpans);
    const rowHeight = isPinnedBottom ? PINNED_BOTTOM_ROW_HEIGHT : maxRowSpan * NORMAL_ROW_HEIGHT;

    if (willRowSplitPage(currentPageHeight, rowHeight)) {
      rowsToExport.push([{ text: "", pageBreak: "before", colSpan: columns.length }]);
      currentPageHeight = 0;
    }

    rowsToExport.push(row);
    currentPageHeight += rowHeight;
  };

  // Process body rows
  gridApi.forEachNodeAfterFilterAndSort((node) => {
    processRow(node);
  });

  // Process pinned bottom rows
  const pinnedCount = gridApi.getPinnedBottomRowCount ? gridApi.getPinnedBottomRowCount() : 0;
  for (let i = 0; i < pinnedCount; i++) {
    const pinnedNode = gridApi.getPinnedBottomRow(i);
    if (pinnedNode) {
      processRow(pinnedNode, true);
    }
  }

  return rowsToExport;
};

/**
 * Compose whole PDF document definition
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
          heights: (rowIndex) => (rowIndex === 0 ? HEADER_ROW_HEIGHT : "auto"),
          dontBreakRows: true,
        },
        layout: {
          fillColor: (rowIndex) => (rowIndex === 0 ? "#401664" : rowIndex % 2 === 0 ? "#fcfcfc" : "#fff"),
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
 * Export function available to call with gridApi
 */
export const exportToPDF = (gridApi) => {
  const docDefinition = getDocument(gridApi);
  pdfMake.createPdf(docDefinition).download();
};
