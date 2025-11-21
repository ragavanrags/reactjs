import pdfMake from "pdfmake/build/pdfmake";
import pdfFonts from "pdfmake/build/vfs_fonts";

pdfMake.vfs = pdfFonts;

/**
 * This function iterates over all of the columns to create a row of header cells
 */
const getHeaderToExport = (gridApi) => {
  const columns = gridApi.columnModel.getAllDisplayedColumns();

  return columns.map((column) => {
    const { field } = column.getColDef();
    // const sort = column.getSort();
    // Enables export when row grouping
    const headerName = column.getColDef().headerName ?? field;
    const headerNameUppercase =      headerName[0].toUpperCase() + headerName.slice(1);
    const headerCell = {
      text: headerNameUppercase,

      // styles
      bold: true,
      margin: [0, 12, 0, 0],
      fillColor: "#401664",
      color: "#ffffff",
    };
    return headerCell;
  });
};

/**
 * This function iterates over all of the rows and columns to create
 * a matrix of cells
 */

const getRowsToExport = (gridApi) => {
  const columns = gridApi.columnModel.getAllDisplayedColumns();
  const rowsToExport = [];

  const rowCount = gridApi.getDisplayedRowCount();
  const skipMap = new Map(); // key: rowIndex, value: Set of colIds to skip
  const maxRowSpanPerRow = new Map(); // key: rowIndex, value: max rowspan in that row

  for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {
    const node = gridApi.getDisplayedRowAtIndex(rowIndex);
    const row = [];

    let maxRowSpanInThisRow = 1;

    columns.forEach((column) => {
      const colId = column.getColId();
      const colDef = column.getColDef();
      const value = colDef.exportValueGetter
        ? colDef.exportValueGetter({
          data: node.data, node, colDef, column
        })
        : gridApi.getValue(column, node) ?? "";
      const cellStyle = colDef.cellStyle || {};

      const supportsRowSpan = typeof column.getRowSpan === "function";
      const rowSpan = supportsRowSpan ? column.getRowSpan(node) : 1;

      // Track max rowspan in this row
      if (rowSpan > maxRowSpanInThisRow) {
        maxRowSpanInThisRow = rowSpan;
      }

      // Skip if this cell is part of a previous rowspan
      if (skipMap.has(rowIndex) && skipMap.get(rowIndex).has(colId)) {
        row.push(""); // placeholder for spanned cell
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
          noWrap: false,
        });
      } else {
        // Regular cell
        row.push({
          text: value,
          ...cellStyle,
          margin: [2, 2, 2, 2],
          noWrap: false,
        });
      }
    });

    // Save max rowspan for this row
    maxRowSpanPerRow.set(rowIndex, maxRowSpanInThisRow);

    rowsToExport.push(row);
  }

  // Attach getRowSpanOfRow as a helper for external use
  getRowsToExport.getRowSpanOfRow = (rowIndex) => maxRowSpanPerRow.get(rowIndex) || 1;

  return rowsToExport;
};

/**
 * Returns a pdfMake shaped config for export, for more information
 * regarding pdfMake configuration, please see the pdfMake documentation.
 */

const getDocument = (gridApi) => {
  const columns = gridApi.columnModel.getAllDisplayedColumns();
  const headerRow = getHeaderToExport(gridApi);
  const rows = getRowsToExport(gridApi);

  return {
    pageOrientation: "landscape",
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
          widths: `${100 / columns.length}%`,
          body: [headerRow, ...rows],
          heights: (rowIndex) => (rowIndex === 0 ? 40 : "auto"),
          dontBreakRows: false,
        },
        pageBreakBefore: (currentNode, followingNodesOnPage, nodesOnNextPage) => {
          const { rowIndex } = currentNode.tableBodyNode;
          const rowSpan = getRowsToExport.getRowSpanOfRow(rowIndex); // implement this to query rowSpan info
          const rowsLeft = followingNodesOnPage.length + nodesOnNextPage.length;
          if (rowSpan > 1 && rowsLeft < rowSpan) {
            return true;
          }
          return false;
        },
        layout: {
          fillColor: (rowIndex) => {
            if (rowIndex === 0) return "#401664"; // header
            return rowIndex % 2 === 0 ? "#fcfcfc" : "#fff"; // alternating rows
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

// eslint-disable-next-line import/prefer-default-export
export const exportToPDF = (gridApi) => {
  const doc = getDocument(gridApi);
  pdfMake.createPdf(doc).download();
};
