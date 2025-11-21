import pdfMake from "pdfmake/build/pdfmake";
import pdfFonts from "pdfmake/build/vfs_fonts";

pdfMake.vfs = pdfFonts;

const PAGE_HEIGHT = 770; // approx page height in pdfMake units (A4 landscape minus margins)
const HEADER_ROW_HEIGHT = 40;
const ROW_HEIGHT = 20;

/**
 * Create header row for PDF export
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
    };
  });
};

/**
 * Retrieve cell text using live cell renderer instance if available,
 * otherwise fallback to raw gridApi.getValue()
 */
const getCellTextFromRenderer = (gridApi, column, node) => {
  // Try to get live cell renderer instances for this cell (only for visible cells)
  const instances = gridApi.getCellRendererInstances({
    rowNodes: [node],
    columns: [column],
  });

  if (instances.length > 0) {
    const rendererInstance = instances[0];
    // Attempt to get exportable text from renderer instance
    // This requires your cellRenderer component to implement a method like getExportValue()
    if (typeof rendererInstance.getExportValue === "function") {
      return rendererInstance.getExportValue();
    }
    // Otherwise fallback to rendered inner text from DOM (if accessible)
    if (rendererInstance.gui) {
      return rendererInstance.gui.innerText || "";
    }
  }

  // Fallback: get raw value from gridApi
  return gridApi.getValue(column, node) ?? "";
};

/**
 * Checks if adding a row with given rowspan will overflow the page height
 */
const willRowSpanSplitPage = (currentHeight, rowSpan) => {
  return currentHeight + rowSpan * ROW_HEIGHT > PAGE_HEIGHT;
};

/**
 * Build rows to export including pinned bottom rows,
 * using live renderer values when possible,
 * and avoid splitting rowspans by inserting page breaks
 */
const getRowsToExport = (gridApi) => {
  const columns = gridApi.columnModel.getAllDisplayedColumns();
  const rowsToExport = [];
  const skipMap = new Map(); // to skip spanned cells in future rows
  let currentPageHeight = HEADER_ROW_HEIGHT;

  // Helper to process single row
  const processRow = (node) => {
    const row = [];
    const rowSpanHeights = [];

    for (const column of columns) {
      const colId = column.getColId();

      if (skipMap.has(node.rowIndex) && skipMap.get(node.rowIndex).has(colId)) {
        row.push("");
        rowSpanHeights.push(ROW_HEIGHT);
        continue;
      }

      // Get cell value from live renderer if available
      const cellText = getCellTextFromRenderer(gridApi, column, node);

      // Determine rowspan for this cell (if supported)
      const supportsRowSpan = typeof column.getRowSpan === "function";
      const rowSpan = supportsRowSpan ? column.getRowSpan(node) : 1;

      // Register future skip cells if rowSpan > 1
      if (rowSpan > 1) {
        for (let i = 1; i < rowSpan; i++) {
          const skipRow = node.rowIndex + i;
          if (!skipMap.has(skipRow)) skipMap.set(skipRow, new Set());
          skipMap.get(skipRow).add(colId);
        }
      }

      rowSpanHeights.push(rowSpan * ROW_HEIGHT);

      // Construct cell object for pdfMake
      row.push({
        text: cellText,
        rowSpan: rowSpan > 1 ? rowSpan : undefined,
        alignment: rowSpan > 1 ? "center" : "left",
        margin: [2, 2, 2, 2],
        noWrap: false,
        ...column.getColDef().cellStyle,
      });
    }

    // Check if row would overflow page and insert page break if needed
    const maxRowHeight = Math.max(...rowSpanHeights);
    if (willRowSpanSplitPage(currentPageHeight, maxRowHeight / ROW_HEIGHT)) {
      rowsToExport.push([{ text: "", pageBreak: "before", colSpan: columns.length }]);
      currentPageHeight = 0;
    }

    rowsToExport.push(row);
    currentPageHeight += maxRowHeight;
  };

  // Process all displayed rows (filtered, sorted)
  gridApi.forEachNodeAfterFilterAndSort((node) => {
    processRow(node);
  });

  // Process pinned bottom rows if any
  const pinnedRows = gridApi.getPinnedBottomRowCount ? gridApi.getPinnedBottomRowCount() : 0;
  for (let i = 0; i < pinnedRows; i++) {
    const pinnedNode = gridApi.getPinnedBottomRow(i);
    if (pinnedNode) {
      processRow(pinnedNode);
    }
  }

  return rowsToExport;
};

/**
 * Creates the full pdfMake document definition for export
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
          fillColor: (rowIndex) => {
            if (rowIndex === 0) return "#401664"; // header color
            return rowIndex % 2 === 0 ? "#fcfcfc" : "#fff"; // alternating rows
          },
          hLineWidth: () => 1,
          vLineWidth: () => 1,
          hLineColor: () => "#dde2eb",
          vLineColor: () => "#dde2eb",
        },
      },
    ],

    styles: {
      header: {
        fontSize: 16,
        bold: true,
      },
    },
  };
};

/**
 * Export function called externally
 */
export const exportToPDF = (gridApi) => {
  const docDefinition = getDocument(gridApi);
  pdfMake.createPdf(docDefinition).download();
};
