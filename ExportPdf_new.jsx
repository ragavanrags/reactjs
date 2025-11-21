
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

  // -----------------------------
  // 1) Build preliminary rows with FULL rowSpan logic
  // -----------------------------
  const tempRows = [];

  for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {
    const node = gridApi.getDisplayedRowAtIndex(rowIndex) ?? { data: {} };
    const rowData = node.data || {};
    const isTotal = rowData?.justification === "Total";

    const rowCells = [];

    columns.forEach((column) => {
      const colDef = column.getColDef() || {};
      const colId = column.getColId();

      let val = "";
      try {
        if (typeof colDef.exportValueGetter === "function") {
          val =
            colDef.exportValueGetter({ data: rowData, node, colDef, column }) ??
            "";
        } else if (typeof gridApi.getValue === "function") {
          val = gridApi.getValue(column, node) ?? "";
        } else if (colDef.field) {
          val = rowData[colDef.field] ?? "";
        }
      } catch {
        val = "";
      }

      let cell = {
        text: val,
        alignment: "center",
        margin: isTotal ? [0, 30, 0, 30] : [2, 6, 2, 6],
        border: [true, true, true, true],
      };

      // -----------------------------
      // GENERIC rowSpan logic
      // -----------------------------
      if (rowSpanCols.has(colId)) {
        const span = column.getRowSpan ? column.getRowSpan(node) : 1;

        // mark group rows for later page-break logic
        cell._isSpan = true;

        const prevNode = gridApi.getDisplayedRowAtIndex(rowIndex - 1);
        const prevSpan =
          prevNode && column.getRowSpan
            ? column.getRowSpan(prevNode)
            : 1;

        // TOP
        if (span > 1) {
          cell.border = [true, true, true, false];
        }
        // MIDDLE
        else if (prevSpan > 1 && span === 1) {
          cell.border = [true, false, true, false];
          cell._isMiddle = true;
        }
        // CONTINUATION MIDDLE
        else if (span === 0) {
          cell.border = [true, false, true, false];
          cell._isMiddle = true;
        }
        // BOTTOM
        else if (prevSpan === 0 && span === 1) {
          cell.border = [true, false, true, true];
        }

        // merged look
        cell.margin = [0, 30, 0, 30];
      }

      rowCells.push(cell);
    });

    tempRows.push(rowCells);
  }

  // -----------------------------
  // 2) PRE-CALCULATE PAGE BREAKS
  // -----------------------------
  const pageHeight = 515;
  let usedHeight = 40; // header occupies 40
  const pageStartRows = new Set();
  const pageEndRows = new Set();

  for (let i = 0; i < tempRows.length; i++) {
    const node = gridApi.getDisplayedRowAtIndex(i);
    const data = node?.data || {};
    let height = data.justification === "Total" ? 80 : 40;

    // check rowSpan top rows
    columns.forEach((column, colIndex) => {
      const colId = column.getColId();
      if (tempRows[i][colIndex]._isSpan) {
        const span = column.getRowSpan(node);
        if (span > 1) height = span * 40; // rowSpan top row height
      }
    });

    // check for overflow
    if (usedHeight + height > pageHeight) {
      pageStartRows.add(i);     // this row is first on new page
      pageEndRows.add(i - 1);   // previous row is last on old page
      usedHeight = height;      // reset for new page
    } else {
      usedHeight += height;
    }
  }

  // -----------------------------
  // 3) APPLY FINAL BORDER FIXES
  // -----------------------------
  for (let rowIndex = 0; rowIndex < tempRows.length; rowIndex++) {
    const row = tempRows[rowIndex];

    row.forEach((cell) => {
      if (!cell._isMiddle) return;

      // If this row is last middle row before page break → add bottom border
      if (pageEndRows.has(rowIndex)) {
        cell.border[3] = true;
      }

      // If this row is first middle row on new page → remove top border
      if (pageStartRows.has(rowIndex)) {
        cell.border[1] = false;
      }
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
