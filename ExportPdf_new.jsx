import pdfMake from "pdfmake/build/pdfmake";
import pdfFonts from "pdfmake/build/vfs_fonts";

pdfMake.vfs = pdfFonts;

/**
 * Builds header row for the PDF export by getting all visible columns
 */
const getHeaderToExport = (gridApi) => {
  const columns = gridApi.columnModel.getAllDisplayedColumns();

  return columns.map((column) => {
    const { field, headerName } = column.getColDef();
    const headerText = headerName ?? field ?? "";
    const headerNameUppercase = headerText[0]?.toUpperCase() + headerText.slice(1);
    return {
      text: headerNameUppercase,
      bold: true,
      margin: [0, 12, 0, 0],
      fillColor: "#401664",
      color: "#ffffff",
      alignment: "center"
    };
  });
};

/**
 * Helper to get cell export value, supports custom exportValueGetter from colDef
 */
const getCellExportValue = (colDef, params) => {
  if (typeof colDef.exportValueGetter === "function") {
    return colDef.exportValueGetter(params);
  }
  // fallback to raw value or empty string
  return params.value ?? "";
};

/**
 * Estimates if adding a row with rowspan will overflow current page height.
 * For simplicity, assumes fixed row heights; adjust as needed.
 */
const willRowSpanSplitPage = (currentHeight, pageHeight, rowSpan, rowHeight) => {
  return currentHeight + rowSpan * rowHeight > pageHeight;
};

/**
 * Builds rows to export including handling of rowspans and preventing their splitting by page breaks
 */
const getRowsToExport = (gridApi) => {
  const columns = gridApi.columnModel.getAllDisplayedColumns();
  const rowsToExport = [];
  const skipMap = new Map(); // tracks cells spanned by rowspan
  const PAGE_HEIGHT = 770; // approx page height in pdfMake units (A4 landscape minus margins)
  const HEADER_ROW_HEIGHT = 40;
  const ROW_HEIGHT = 20;

  let currentPageHeight = HEADER_ROW_HEIGHT; // start accounting from after header row

  const rowCount = gridApi.getDisplayedRowCount();

  for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {
    const node = gridApi.getDisplayedRowAtIndex(rowIndex);
    const row = [];

    const rowSpanHeights = [];

    for (const column of columns) {
      const colId = column.getColId();
      const colDef = column.getColDef();

      // Skip cells that are covered by previous rowspan
      if (skipMap.has(rowIndex) && skipMap.get(rowIndex).has(colId)) {
        row.push("");
        continue;
      }

      // Get value using exportValueGetter if present
      const value = getCellExportValue(colDef, {
        value: gridApi.getValue(column, node),
        data: node.data,
        node,
        colDef,
        column,
        columnApi: gridApi.columnApi,
        api: gridApi
      });

      // Check rowspan support
      const supportsRowSpan = typeof column.getRowSpan === "function";
      const rowSpan = supportsRowSpan ? column.getRowSpan(node) : 1;

      // If rowSpan > 1, mark following rows to skip this col
      if (rowSpan > 1) {
        for (let i = 1; i < rowSpan; i++) {
          const skipRow = rowIndex + i;
          if (!skipMap.has(skipRow)) skipMap.set(skipRow, new Set());
          skipMap.get(skipRow).add(colId);
        }
        rowSpanHeights.push(rowSpan * ROW_HEIGHT);
      } else {
        rowSpanHeights.push(ROW_HEIGHT);
      }

      // Cell content object
      const cellContent = {
        text: value,
        alignment: rowSpan > 1 ? "center" : "left",
        rowSpan: rowSpan > 1 ? rowSpan : undefined,
        margin: [2, 2, 2, 2],
        noWrap: false,
        ...colDef.cellStyle,
      };

      row.push(cellContent);
    }

    // Determine the tallest rowspan in this row (max rowSpan height)
    const maxRowHeight = Math.max(...rowSpanHeights);

    // Check if this row would overflow the page
    if (willRowSpanSplitPage(currentPageHeight, PAGE_HEIGHT, maxRowHeight / ROW_HEIGHT, ROW_HEIGHT)) {
      // Insert manual page break before current row to prevent split
      rowsToExport.push([{ text: "", pageBreak: "before", colSpan: columns.length, fillColor: "#fff" }]);
      currentPageHeight = 0; // reset for new page
    }

    rowsToExport.push(row);
    currentPageHeight += maxRowHeight;
  }
  return rowsToExport;
};

/**
 * Creates the full pdfMake document definition
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
      margin: [0, 10, 10, 0]
    },

    footer: (currentPage, pageCount) => ({
      columns: [
        { text: "Information Classification - Confidential", alignment: "left", margin: [10, 0, 0, 10] },
        { text: `Page ${currentPage} of ${pageCount}`, alignment: "right", margin: [0, 0, 10, 10] }
      ]
    }),

    content: [
      {
        table: {
          headerRows: 1,
          widths: columns.map(() => `${100 / columns.length}%`),
          body: [headerRow, ...rows],
          heights: (rowIndex) => (rowIndex === 0 ? 40 : "auto"),
          dontBreakRows: true
        },
        layout: {
          fillColor: (rowIndex) => {
            if (rowIndex === 0) return "#401664"; // header
            return rowIndex % 2 === 0 ? "#fcfcfc" : "#fff"; // alternating stripes
          },
          hLineWidth: () => 1,
          vLineWidth: () => 1,
          hLineColor: () => "#dde2eb",
          vLineColor: () => "#dde2eb"
        }
      }
    ],

    styles: {
      header: {
        fontSize: 16,
        bold: true
      }
    }
  };
};

/**
 * Trigger PDF export
 */
export const exportToPDF = (gridApi) => {
  const doc = getDocument(gridApi);
  pdfMake.createPdf(doc).download();
};
