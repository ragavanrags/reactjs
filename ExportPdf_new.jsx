
import pdfMake from "pdfmake/build/pdfmake";
import pdfFonts from "pdfmake/build/vfs_fonts";

pdfMake.vfs = pdfFonts;

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

  // 1) PRECOMPUTE ROWSPAN GROUPS FOR EACH COLUMN
  const rowspanGroups = {};

  columns.forEach((column) => {
    const colId = column.getColId();
    const groups = [];
    let r = 0;

    while (r < rowCount) {
      const node = gridApi.getDisplayedRowAtIndex(r);
      const span = column.getRowSpan ? column.getRowSpan(node) : 1;

      if (span > 1) {
        groups.push({ start: r, end: r + span - 1 });
        r += span;
      } else {
        r++;
      }
    }

    if (groups.length) rowspanGroups[colId] = groups;
  });

  const rowsToExport = [];
  // 2) BUILD ROWS
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
            data: rowData, node, colDef, column
          })
            ?? "";
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
        margin: isTotalRow ? [0, 30, 0, 30] : [2, 6, 2, 6],
        border: [true, true, true, true], // default
        noWrap: false
      };
      
     // Horizontal alignment for all cells can be controlled here
      cell.alignment = column.getColDef().alignment || 'left';

      // 3) APPLY ROWSPAN LOGIC IF THIS COLUMN HAS GROUPS
      const groups = rowspanGroups[colId];
      if (groups) {
        const group = groups.find((g) => rowIndex >= g.start && rowIndex <= g.end);

        if (group) {
          const isTop = rowIndex === group.start;
          const isBottom = rowIndex === group.end;
          const rowSpanCount = group.end - group.start + 1;

          if (isTop) {
            // FIX 1: VERTICAL CENTER ALIGNMENT
            // Calculate a top margin to push the content to the vertical center.
            // Base row height is 40. Content is pushed down by 6 (default paddingTop).
            const baseRowHeight = 40;
            const defaultPadding = 6;
            const estimatedTextHeight = 16; 
            const totalHeight = rowSpanCount * baseRowHeight;
            
            // Calculate margin to hit the center point, accounting for default padding
            const verticalCenterMargin = Math.max(
                (totalHeight / 2) - (estimatedTextHeight / 2) - defaultPadding,
                defaultPadding
            );

            // Apply calculated margin for vertical centering and horizontal center alignment
            cell.margin = [2, verticalCenterMargin, 2, 6];
            cell.alignment = "center";
            cell.rowSpan = rowSpanCount;
            
            // 💡 FIX 2: BORDER CLEANUP
            // The top cell should only have a bottom border if it's a single-row span (span=1).
            // Since we only process span > 1 here, we remove the bottom border.
            cell.border = [true, true, true, false]; // [Left, Top, Right, Bottom]
            
          } else { // This is a middle or bottom row of the span (row-span cell below top cell)
            // For all subsequent rows in the span, the cell must be an empty object
            // to be correctly skipped by pdfmake's table construction.
            // Note: Use an empty string for `text` to maintain cell structure for border application.
            cell.text = ""; 
            
            // Overwrite the cell to be an empty object as required by pdfmake rowSpan
            // We use cell.text = "" only for logic, but pdfmake requires an empty object for a skipped cell.
            // However, since you are applying borders *inside* the cell object, we need to keep it.
            // We set the borders for middle/bottom rows:
            if (isBottom) {
              cell.border = [true, false, true, true]; // Only Left, Right, Bottom borders
            } else { // Middle row
              cell.border = [true, false, true, false]; // Only Left and Right borders
            }
            // For all rows except the top one, pdfmake requires an empty object {} in the row body array
            // if the cell is part of a rowspan from a previous row. Your logic seems to be adding
            // the 'cell' object to the 'row' array for all rows. 
            // The standard pdfmake approach is to push an empty string/object for spanned cells:
            row.push({}); // Pushes an empty object for spanned cells

            // Continue to the next column as the cell for this column is handled.
            continue; 
          }
        }
      }

      row.push(cell);
    });

    rowsToExport.push(row);
  }

  // 4) PINNED BOTTOM ROWS (unchanged)
  const pinnedCount = gridApi.getPinnedBottomRowCount();

  for (let i = 0; i < pinnedCount; i++) {
    const node = gridApi.getPinnedBottomRow(i);
    const rowData = node?.data ?? {};
    const row = [];

    columns.forEach((column) => {
      const colDef = column.getColDef() || {};

      let value = "";
      try {
        if (typeof colDef.exportValueGetter === "function") {
          value = colDef.exportValueGetter({
            data: rowData, node, colDef, column
          })
            ?? "";
        } else if (typeof gridApi.getValue === "function") {
          value = gridApi.getValue(column, node) ?? "";
        } else if (colDef.field) {
          value = rowData[colDef.field] ?? "";
        }
      } catch {
        value = "";
      }

      row.push({
        text: value,
        alignment: "center",
        bold: true,
        fillColor: "#f0f0f0",
        margin: [2, 8, 2, 8],
        border: [true, true, true, true]
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
