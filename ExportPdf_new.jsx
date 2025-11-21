import pdfMake from "pdfmake/build/pdfmake";
import pdfFonts from "pdfmake/build/vfs_fonts";

pdfMake.vfs = pdfFonts;

/**
 * Build PDF header
 */
const getHeaderToExport = (gridApi) => {
  const columns = gridApi.columnModel.getAllDisplayedColumns();

  return columns.map((column) => {
    const { field } = column.getColDef();
    const headerName = column.getColDef().headerName ?? field;

    return {
      text: headerName[0].toUpperCase() + headerName.slice(1),
      bold: true,
      margin: [0, 12, 0, 0],
      fillColor: "#401664",
      color: "#ffffff"
    };
  });
};

/**
 * Build all body rows (normal + pinned bottom)
 */
const getRowsToExport = (gridApi) => {
  const columns = gridApi.columnModel.getAllDisplayedColumns();
  const rowsToExport = [];

  const normalRowCount = gridApi.getDisplayedRowCount();
  const pinnedCount = gridApi.getPinnedBottomRowCount();

  const getRowData = (rowIndex, pinned = false) => {
    return pinned
      ? gridApi.getPinnedBottomRow(rowIndex)
      : gridApi.getDisplayedRowAtIndex(rowIndex);
  };

  const totalRows = normalRowCount + pinnedCount;

  for (let i = 0; i < totalRows; i++) {
    const isPinnedBottom = i >= normalRowCount;
    const pinnedIndex = i - normalRowCount;

    const node = getRowData(pinnedIndex, isPinnedBottom);
    const rowData = node.data || {};
    const isTotalRow = rowData.justification === "Total"; // your logic
    const isPinnedTotal = isPinnedBottom; // treat pinned bottom row as special

    const row = [];

    columns.forEach((column) => {
      const colDef = column.getColDef();
      const value =
        colDef.exportValueGetter
          ? colDef.exportValueGetter({
              data: node.data,
              node,
              colDef,
              column
            })
          : gridApi.getValue(column, node) ?? "";

      const cellStyle = colDef.cellStyle || {};

      row.push({
        text: value,
        ...cellStyle,

        alignment: "center",

        // Taller row for Total and pinned bottom
        margin:
          isTotalRow || isPinnedTotal ? [2, 20, 2, 20] : [2, 4, 2, 4],

        // Remove vertical borders only for tall rows
        border: isTotalRow || isPinnedTotal ? [false, true, false, true] : true,

        noWrap: false
      });
    });

    rowsToExport.push(row);
  }

  return rowsToExport;
};

/**
 * Build PDF doc
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
          body: [headerRow, ...rows],

          heights: (rowIndex) => {
            if (rowIndex === 0) return 40; // header

            const normalRowCount = gridApi.getDisplayedRowCount();
            const pinnedCount = gridApi.getPinnedBottomRowCount();

            const index = rowIndex - 1;

            let node =
              index < normalRowCount
                ? gridApi.getDisplayedRowAtIndex(index)
                : gridApi.getPinnedBottomRow(index - normalRowCount);

            if (!node) return 40;

            const rowData = node.data || {};

            if (rowData.justification === "Total") return 80;
            if (index >= normalRowCount) return 80; // pinned bottom

            return 40;
          },

          dontBreakRows: true
        },

        layout: {
          fillColor: (rowIndex) => {
            if (rowIndex === 0) return "#401664"; // header
            return rowIndex % 2 === 0 ? "#fcfcfc" : "#fff";
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

// export
export const exportToPDF = (gridApi) => {
  const doc = getDocument(gridApi);
  pdfMake.createPdf(doc).download();
};
