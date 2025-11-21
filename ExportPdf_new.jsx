import pdfMake from "pdfmake/build/pdfmake";
import pdfFonts from "pdfmake/build/vfs_fonts";

pdfMake.vfs = pdfFonts;

/**
 * Build PDF table header
 */
const getHeaderToExport = (gridApi) => {
  const columns = gridApi.columnModel.getAllDisplayedColumns();

  return columns.map((column) => {
    const { field } = column.getColDef();
    const headerName = column.getColDef().headerName ?? field;
    const headerNameUppercase =
      headerName[0].toUpperCase() + headerName.slice(1);

    return {
      text: headerNameUppercase,
      bold: true,
      margin: [0, 12, 0, 0],
      fillColor: "#401664",
      color: "#ffffff"
    };
  });
};

/**
 * Build PDF table rows for displayed rows
 */
const getRowsToExport = (gridApi) => {
  const columns = gridApi.columnModel.getAllDisplayedColumns();
  const rowsToExport = [];
  const rowCount = gridApi.getDisplayedRowCount();

  for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {
    const node = gridApi.getDisplayedRowAtIndex(rowIndex);
    const rowData = node.data;
    const isTotalRow = rowData?.justification === "Total";
    const row = [];

    columns.forEach((column) => {
      const colDef = column.getColDef();
      const value = colDef.exportValueGetter
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
        margin: isTotalRow ? [2, 25, 2, 25] : [2, 4, 2, 4],
        border: isTotalRow ? [false, true, false, true] : true,
        noWrap: false
      });
    });

    rowsToExport.push(row);
  }

  return rowsToExport;
};

/**
 * Build PDF table rows for pinned bottom rows
 */
const getPinnedBottomRowsToExport = (gridApi) => {
  const columns = gridApi.columnModel.getAllDisplayedColumns();
  const pinnedRows = [];
  const pinnedCount = gridApi.getPinnedBottomRowCount ? gridApi.getPinnedBottomRowCount() : 0;

  for (let i = 0; i < pinnedCount; i++) {
    const node = gridApi.getPinnedBottomRow(i);
    const rowData = node?.data || {};
    const row = [];

    columns.forEach((column) => {
      const colDef = column.getColDef();
      const value = colDef.exportValueGetter
        ? colDef.exportValueGetter({
            data: rowData,
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
        margin: [2, 4, 2, 4],
        noWrap: false
      });
    });

    pinnedRows.push(row);
  }

  return pinnedRows;
};

/**
 * Build full PDF document including displayed + pinned bottom rows
 */
const getDocumentWithPinnedBottom = (gridApi) => {
  const columns = gridApi.columnModel.getAllDisplayedColumns();
  const headerRow = getHeaderToExport(gridApi);
  const bodyRows = getRowsToExport(gridApi);
  const pinnedRows = getPinnedBottomRowsToExport(gridApi);

  // If there are pinned bottom rows, add a separator and then the pinned rows
  // You can replace the separator with custom logic or styling if desired
  const allRows = pinnedRows.length > 0
    ? [...bodyRows, ...pinnedRows]
    : bodyRows;

  return {
    pageOrientation: "landscape",
    pageMargins: [10, 40, 10, 40],

    header: {
      text: "Exported Data (Including Pinned Bottom Rows)",
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
          body: [headerRow, ...allRows],
          heights: (rowIndex) => {
            if (rowIndex === 0) return 40; // header
            // Check if rowIndex is in main rows or pinned
            const dataIndex = rowIndex - 1;
            // Main grid rows
            if (dataIndex >= 0 && dataIndex < bodyRows.length) {
              const node = gridApi.getDisplayedRowAtIndex(dataIndex);
              const rowData = node?.data || {};
              return rowData?.justification === "Total" ? 80 : 40;
            }
            // Pinned bottom rows
            if (dataIndex >= bodyRows.length) {
              return 40;
            }
            return 40;
          },
          dontBreakRows: true
        },

        layout: {
          fillColor: (rowIndex) => {
            if (rowIndex === 0) return "#401664";
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

/**
 * Export function: displayed rows + pinned bottom rows
 */
export const exportFullGridWithPinnedBottomToPDF = (gridApi) => {
  const doc = getDocumentWithPinnedBottom(gridApi);
  pdfMake.createPdf(doc).download();
};
