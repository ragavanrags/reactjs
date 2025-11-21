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
 * Build PDF table rows
 * Replaces rowSpan with tall rows
 */
const getRowsToExport = (gridApi) => {
  const columns = gridApi.columnModel.getAllDisplayedColumns();
  const rowsToExport = [];
  const rowCount = gridApi.getDisplayedRowCount();

  for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {
    const node = gridApi.getDisplayedRowAtIndex(rowIndex);
    const rowData = node.data;
    const isTotalRow = rowData?.justification === "Total"; // your logic
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

        // ⬇⬇ Instead of rowSpan → make row taller visually
        margin: isTotalRow ? [2, 20, 2, 20] : [2, 4, 2, 4],

        noWrap: false
      });
    });

    rowsToExport.push(row);
  }

  return rowsToExport;
};

/**
 * Build full PDF document
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

          // evenly spaced columns
          widths: `${100 / columns.length}%`,

          body: [headerRow, ...rows],

          // PDF row height
          heights: (rowIndex) => {
            if (rowIndex === 0) return 40; // header
            const rowData = gridApi.getDisplayedRowAtIndex(rowIndex - 1).data;
            return rowData?.justification === "Total" ? 80 : 40;
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

// export function
export const exportToPDF = (gridApi) => {
  const doc = getDocument(gridApi);
  pdfMake.createPdf(doc).download();
};
