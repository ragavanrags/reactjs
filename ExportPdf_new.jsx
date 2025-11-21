// ExportPdf_new.jsx

import pdfMake from "pdfmake/build/pdfmake";
import pdfFonts from "pdfmake/build/vfs_fonts";

pdfMake.vfs = pdfFonts;

/**
 * Detect dynamic row-span columns.
 * If any column returns rowSpan > 1 for any row → treat it as a row-span column.
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
    const title =
      headerName.length > 0
        ? headerName[0].toUpperCase() + headerName.slice(1)
        : "";

    return {
      text: title,
      bold: true,
      fillColor: "#401664",
      color: "#ffffff",
      margin: [0, 12, 0, 0]
    };
  });
};

/**
 * Build displayed rows + merged cell styling
 */
const getRowsToExport = (gridApi) => {
  const columns = gridApi.columnModel.getAllDisplayedColumns();
  const rowCount = gridApi.getDisplayedRowCount();
  const rowSpanCols = getRowSpanColumns(gridApi);
  const rowsToExport = [];

  /** -------------------------------------
   *  NORMAL DISPLAYED ROWS
   * -------------------------------------
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
          value =
            colDef.exportValueGetter({ data: rowData, node, colDef, column }) ??
            "";
        } else if (typeof gridApi.getValue === "function") {
          value = gridApi.getValue(column, node) ?? "";
        } else if (colDef.field) {
          value = rowData[colDef.field] ?? "";
        }
      } catch {
        value = "";
      }

      const removeBorder = rowSpanCols.has(colId);

      const cell = {
        text: value,
        alignment: "center",
        noWrap: false,
        margin: isTotalRow ? [0, 35, 0, 35] : [2, 4, 2, 4],
        border: removeBorder ? [false, true, false, true] : true
      };

      if (removeBorder) {
        cell.alignment = "center";
        cell.margin = [0, 35, 0, 35];
      }

      row.push(cell);
    });

    rowsToExport.push(row);
  }

  /** -------------------------------------
   *  ADDED — PINNED BOTTOM ROWS
   * -------------------------------------
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
          value =
            colDef.exportValueGetter({ data: rowData, node, colDef, column }) ??
            "";
        } else if (typeof gridApi.getValue === "function") {
          value = gridApi.getValue(column, node) ?? "";
        } else if (colDef.field) {
          value = rowData[colDef.field] ?? "";
        }
      } catch {
        value = "";
      }

      const removeBorder = rowSpanCols.has(colId);

      row.push({
        text: value,
        alignment: "center",
        margin: [0, 8, 0, 8], // different style for pinned bottom rows
        bold: true,
        fillColor: "#f0f0f0",
        border: removeBorder ? [false, true, false, true] : true
      });
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
  const rowSpanCols = getRowSpanColumns(gridApi);

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
            const dataIndex = rowIndex - 1;
            const node = gridApi.getDisplayedRowAtIndex(dataIndex);
            const rowData = node?.data || {};

            return rowData.justification === "Total" ? 80 : 40;
          },

          dontBreakRows: true
        },

        layout: {
          fillColor: (rowIndex) => {
            if (rowIndex === 0) return "#401664";
            return rowIndex % 2 === 0 ? "#fcfcfc" : "#fff";
          },

          // Remove outer & inner vertical lines for row-span columns
          vLineWidth: (i, node) => {
            const colIndex = i - 1;
            const col = columns[colIndex];

            if (col && rowSpanCols.has(col.getColId())) {
              return 0; // hide border for this col
            }

            return 1;
          },

          hLineWidth: () => 1,
          vLineColor: () => "#dde2eb",
          hLineColor: () => "#dde2eb"
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
export const exportFullGridWithPinnedBottomToPDF = (gridApi) => {
  const doc = getDocument(gridApi);
  pdfMake.createPdf(doc).download();
};
