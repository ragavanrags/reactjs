// import pdfMake from "pdfmake/build/pdfmake";
// import pdfFonts from "pdfmake/build/vfs_fonts";

// pdfMake.vfs = pdfFonts;

// /**
//  * This function iterates over all of the columns to create a row of header cells
//  */
// const getHeaderToExport = (gridApi) => {
//   const columns = gridApi.columnModel.getAllDisplayedColumns();

//   return columns.map((column) => {
//     const { field } = column.getColDef();
//     // const sort = column.getSort();
//     // Enables export when row grouping
//     const headerName = column.getColDef().headerName ?? field;
//     const headerNameUppercase =      headerName[0].toUpperCase() + headerName.slice(1);
//     const headerCell = {
//       text: headerNameUppercase,

//       // styles
//       bold: true,
//       margin: [0, 12, 0, 0],
//       fillColor: "#401664",
//       color: "#ffffff",
//     };
//     return headerCell;
//   });
// };

// /**
//  * This function iterates over all of the rows and columns to create
//  * a matrix of cells
//  */

// const getRowsToExport = (gridApi) => {
//   const columns = gridApi.columnModel.getAllDisplayedColumns();
//   const rowsToExport = [];

//   const rowCount = gridApi.getDisplayedRowCount();
//   const skipMap = new Map(); // key: rowIndex, value: Set of colIds to skip

//   for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {
//     const node = gridApi.getDisplayedRowAtIndex(rowIndex);
//     const row = [];

//     columns.forEach((column) => {
//       const colId = column.getColId();
//       const colDef = column.getColDef();
//       const value = colDef.exportValueGetter
//         ? colDef.exportValueGetter({
//           data: node.data, node, colDef, column
//         }) : gridApi.getValue(column, node) ?? "";
//       const cellStyle = colDef.cellStyle || {};

//       const supportsRowSpan = typeof column.getRowSpan === "function";
//       const rowSpan = supportsRowSpan ? column.getRowSpan(node) : 1;

//       // Skip if this cell is part of a previous rowSpan
//       if (skipMap.has(rowIndex) && skipMap.get(rowIndex).has(colId)) {
//         row.push(""); // placeholder for spanned cell
//         return;
//       }

//       if (rowSpan > 1) {
//         // Mark future rows to skip this column
//         for (let i = 1; i < rowSpan; i++) {
//           const skipRow = rowIndex + i;
//           if (!skipMap.has(skipRow)) skipMap.set(skipRow, new Set());
//           skipMap.get(skipRow).add(colId);
//         }

//         row.push({
//           text: value,
//           ...(rowSpan > 1 ? { rowSpan, alignment: "center" } : {}),
//           ...cellStyle,
//           margin: [0, 50, 0, 0],
//           noWrap: false
//         });
//       } else {
//         // Regular cell
//         row.push({
//           text: value,
//           ...cellStyle,
//           margin: [2, 2, 2, 2],
//           noWrap: false
//         });
//       }
//     });

//     rowsToExport.push(row);
//   }

//   return rowsToExport;
// };

// /**
//  * Returns a pdfMake shaped config for export, for more information
//  * regarding pdfMake configuration, please see the pdfMake documentation.
//  */

// const getDocument = (gridApi) => {
//   const columns = gridApi.columnModel.getAllDisplayedColumns();
//   const headerRow = getHeaderToExport(gridApi);
//   const rows = getRowsToExport(gridApi);

//   return {
//     pageOrientation: "landscape",
//     pageMargins: [10, 40, 10, 40],

//     header: {
//       text: "Exported Data",
//       alignment: "right",
//       style: "header",
//       margin: [0, 10, 10, 0]
//     },

//     footer: (currentPage, pageCount) => ({
//       columns: [
//         { text: "Information Classification - Confidential", alignment: "left", margin: [10, 0, 0, 10] },
//         { text: `Page ${currentPage} of ${pageCount}`, alignment: "right", margin: [0, 0, 10, 10] }
//       ]
//     }),

//     content: [
//       {
//         table: {
//           headerRows: 1,
//           widths: `${100 / columns.length}%`,
//           body: [headerRow, ...rows],
//           heights: (rowIndex) => (rowIndex === 0 ? 40 : "auto"),
//           dontBreakRows: true
//         },
//         layout: {
//           fillColor: (rowIndex) => {
//             if (rowIndex === 0) return "#401664"; // header
//             return rowIndex % 2 === 0 ? "#fcfcfc" : "#fff"; // alternating rows
//           },
//           hLineWidth: () => 1,
//           vLineWidth: () => 1,
//           hLineColor: () => "#dde2eb",
//           vLineColor: () => "#dde2eb"
//         }
//       }
//     ],

//     styles: {
//       header: {
//         fontSize: 16,
//         bold: true
//       }
//     }
//   };
// };

// // eslint-disable-next-line import/prefer-default-export
// export const exportToPDF = (gridApi) => {
//   const doc = getDocument(gridApi);
//   pdfMake.createPdf(doc).download();
// };

import pdfMake from "pdfmake/build/pdfmake";
import pdfFonts from "pdfmake/build/vfs_fonts";

pdfMake.vfs = pdfFonts;

/**
 * Detect dynamic row-span columns.
 */
const getRowSpanColumns = (gridApi) => {
  const columns = gridApi.columnModel.getAllDisplayedColumns();
  const rowSpanCols = new Set();
  const rowCount = gridApi.getDisplayedRowCount();

  for (let r = 0; r < rowCount; r++) {
    const node = gridApi.getDisplayedRowAtIndex(r);

    columns.forEach((col) => {
      const supportsRowSpan = typeof col.getRowSpan === "function";
      if (!supportsRowSpan) return;

      const span = col.getRowSpan(node);
      if (span && span > 1) {
        rowSpanCols.add(col.getColId());
      }
    });
  }

  return rowSpanCols;
};

/**
 * Build header
 */
const getHeaderToExport = (gridApi) => {
  const columns = gridApi.columnModel.getAllDisplayedColumns();

  return columns.map((column) => {
    const { field } = column.getColDef();
    const headerName = column.getColDef().headerName ?? field ?? "";
    const title =      headerName.length > 0
      ? headerName[0].toUpperCase() + headerName.slice(1)
      : "";

    return {
      text: title,
      bold: true,
      fillColor: "#401664",
      color: "#ffffff",
      margin: [0, 12, 0, 0],
      alignment: "center"
    };
  });
};

/**
 * Build displayed rows + pinned bottom rows + merged-cell styling
 */
const getRowsToExport = (gridApi) => {
  const columns = gridApi.columnModel.getAllDisplayedColumns();
  const rowCount = gridApi.getDisplayedRowCount();
  const rowSpanCols = getRowSpanColumns(gridApi);
  const rowsToExport = [];

  /**
   * NORMAL DISPLAYED ROWS
   */
  for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {
    const node = gridApi.getDisplayedRowAtIndex(rowIndex) ?? { data: {} };
    const rowData = node.data || {};
    const isTotalRow = rowData?.justification === "Total";
    const row = [];

    columns.forEach((column) => {
      const colDef = column.getColDef() || {};
      const colId = column.getColId();

      let value = "";
      try {
        if (typeof colDef.exportValueGetter === "function") {
          value = colDef.exportValueGetter({
            data: rowData,
            node,
            colDef,
            column
          }) ?? "";
        } else if (typeof gridApi.getValue === "function") {
          value = gridApi.getValue(column, node) ?? "";
        } else if (colDef.field) {
          value = rowData[colDef.field] ?? "";
        }
      } catch {
        value = "";
      }

      const cell = {
        text: value,
        // alignment: "center",
        noWrap: false,
        margin: isTotalRow ? [0, 30, 0, 30] : [2, 6, 2, 6],
        border: true
      };

      // merged cell style
      if (rowSpanCols.has(colId)) {
        // cell.border = [false, false, false, false];
        cell.margin = [0, 30, 0, 30];
        cell.alignment = "center";
      }

      row.push(cell);
    });

    rowsToExport.push(row);
  }

  /**
   * PINNED BOTTOM ROWS
   */
  const pinnedCount = gridApi.getPinnedBottomRowCount();

  for (let i = 0; i < pinnedCount; i++) {
    const node = gridApi.getPinnedBottomRow(i);
    const rowData = node?.data ?? {};

    const row = [];

    columns.forEach((column) => {
      const colDef = column.getColDef() || {};
      const colId = column.getColId();

      let value = "";
      try {
        if (typeof colDef.exportValueGetter === "function") {
          value = colDef.exportValueGetter({
            data: rowData,
            node,
            colDef,
            column
          }) ?? "";
        } else if (typeof gridApi.getValue === "function") {
          value = gridApi.getValue(column, node) ?? "";
        } else if (colDef.field) {
          value = rowData[colDef.field] ?? "";
        }
      } catch {
        value = "";
      }

      const cell = {
        text: value,
        alignment: "center",
        bold: true,
        fillColor: "#f0f0f0",
        margin: [2, 8, 2, 8],
        border: true
      };

      if (rowSpanCols.has(colId)) {
        cell.border = [false, false, false, false];
      }

      row.push(cell);
    });

    rowsToExport.push(row);
  }

  return rowsToExport;
};

/**
 * Final PDF document
 */
const getDocument = (gridApi) => {
  const columns = gridApi.columnModel.getAllDisplayedColumns();
  const headerRow = getHeaderToExport(gridApi);
  const bodyRows = getRowsToExport(gridApi);

  return {
    pageOrientation: "landscape",
    pageMargins: [10, 40, 10, 40],

    header: {
      text: "Exported Data",
      alignment: "right",
      margin: [0, 10, 10, 0],
      style: "header"
    },

    footer: (currentPage, pageCount) => ({
      columns: [
        {
          text: "Information Classification - Confidential",
          alignment: "left",
          margin: [10, 0, 0, 10]
        },
        {
          text: `Page ${currentPage} of ${pageCount}`,
          alignment: "right",
          margin: [0, 0, 10, 10]
        }
      ]
    }),

    content: [
      {
        table: {
          headerRows: 1,
          widths: `${100 / columns.length}%`,
          body: [headerRow, ...bodyRows],

          heights: (rowIndex) => {
            if (rowIndex === 0) return 40; // header
            const bodyIndex = rowIndex - 1;
            const node = gridApi.getDisplayedRowAtIndex(bodyIndex);
            const rowData = node?.data || {};
            return rowData.justification === "Total" ? 80 : 40;
          },

          dontBreakRows: true
        },

        /** FIXED BORDER / MERGE HANDLING */
        layout: {
          fillColor: (rowIndex) => {
            if (rowIndex === 0) return "#401664";
            return rowIndex % 2 === 0 ? "#fcfcfc" : "#fff";
          },

          vLineWidth: () => 1,
          hLineWidth: () => 1,
          vLineColor: () => "#dde2eb",
          hLineColor: () => "#dde2eb",

          paddingLeft: () => 4,
          paddingRight: () => 4,
          paddingTop: () => 6,
          paddingBottom: () => 6
        }
      }
    ],

    styles: {
      header: { fontSize: 16, bold: true }
    }
  };
};

/**
 * Export to PDF
 */
export const exportToPDF = (gridApi) => {
  const doc = getDocument(gridApi);
  pdfMake.createPdf(doc).download();
};
