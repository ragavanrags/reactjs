import pdfMake from "pdfmake/build/pdfmake";
import pdfFonts from "pdfmake/build/vfs_fonts";

pdfMake.vfs = pdfFonts;

/**
 * Helper function to safely get pinned bottom nodes in any AG Grid Row Model (v25+)
 */
const getPinnedBottomNodes = (gridApi) => {
  const rowModel = gridApi.getModel();
  const pinnedNodes = [];
  
  if (rowModel && rowModel.getPinnedBottomRowCount) {
      const count = rowModel.getPinnedBottomRowCount();
      for (let i = 0; i < count; i++) {
          const node = rowModel.getPinnedBottomRow(i);
          if (node) {
              pinnedNodes.push(node);
          }
      }
  }
  return pinnedNodes;
};

/**
 * Build header (No changes needed here)
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
      margin: [0, 12, 0, 0],
      alignment: "center"
    };
  });
};

/**
 * Helper function to process a collection of row nodes (Main, Pinned)
 */
const processRowNodes = (nodes, columns, rowspanGroups, rowSpanColId) => {
    const rows = [];
    
    nodes.forEach((node) => {
        const row = [];
        const rowData = node.data || {};
        const isTotalRow = rowData.justification === "Total";
        const rowIndex = node.rowIndex; 

        for (const column of columns) {
            const colId = column.getColId();
            let value = node.data ? node.data[colId] : '';

            // Set default cell styles
            const cell = {
                text: value,
                alignment: column.getColDef().alignment || 'left',
                margin: isTotalRow ? [0, 30, 0, 30] : [2, 6, 2, 6],
                noWrap: false
            };

            // APPLY ROWSPAN LOGIC (ONLY for main body rows)
            const groups = rowspanGroups[colId];
            let isRowSpanHandled = false;

            // Check for rowSpan only on the main body (unpinned) rows
            if (groups && rowSpanColId && node.rowPinned !== 'bottom') {
                const group = groups.find((g) => rowIndex >= g.start && rowIndex <= g.end);

                if (group) {
                    const isTop = rowIndex === group.start;
                    
                    if (isTop) {
                        // FIX 1: VERTICAL CENTER ALIGNMENT
                        const baseRowHeight = 40;
                        const defaultPadding = 6;
                        const estimatedTextHeight = 16; 
                        const rowSpanCount = group.end - group.start + 1;
                        const totalHeight = rowSpanCount * baseRowHeight;
                        
                        const verticalCenterMargin = Math.max(
                            (totalHeight / 2) - (estimatedTextHeight / 2) - defaultPadding,
                            defaultPadding
                        );

                        // Apply calculated margin for vertical centering and horizontal center alignment
                        cell.margin = [2, verticalCenterMargin, 2, 6];
                        cell.alignment = "center";
                        cell.rowSpan = rowSpanCount;
                        
                        // Apply Left/Right border property to the cell (for the column)
                        if (colId === rowSpanColId) {
                             cell.border = [true, false, true, false]; 
                        }
                        
                    } else { // This is a middle or bottom row of the span (spanned cell)
                        // CRITICAL FIX: Push an empty object and skip to the next column.
                        row.push({}); 
                        isRowSpanHandled = true;
                    }
                }
            }
            
            if (isRowSpanHandled) {
                continue; // Move to the next column
            }
            
            // For all non-spanned cells (or the top cell of a span, or pinned cells)
            row.push(cell);
        } // End of for...of column loop

        rows.push(row);
    });

    return rows;
};


/**
 * Build displayed rows + pinned bottom rows + merged-cell styling
 */
const getRowsToExport = (gridApi) => {
  const columns = gridApi.columnModel.getAllDisplayedColumns();
  
  // Get all displayed nodes (main body - handles filter/sort)
  const displayedNodes = [];
  gridApi.forEachNodeAfterFilterAndSort((node) => {
      displayedNodes.push(node);
  });
  
  // 💡 FIX: Use the robust helper function to get pinned nodes
  const pinnedBottomRowNodes = getPinnedBottomNodes(gridApi);
  
  const rowSpanColId = columns[0] ? columns[0].getColId() : null;
  const rowCount = displayedNodes.length; // Count only the main body rows for span calculation

  // 1) PRECOMPUTE ROWSPAN GROUPS FOR EACH COLUMN
  const rowspanGroups = {};

  if (rowSpanColId) {
      const column = columns.find(c => c.getColId() === rowSpanColId);
      if (column) {
          const groups = [];
          let r = 0;

          while (r < rowCount) {
              const node = displayedNodes[r]; 
              if (node.rowPinned !== 'bottom') {
                  const span = column.getRowSpan ? column.getRowSpan(node) : 1;
    
                  if (span > 1) {
                      groups.push({
                          start: node.rowIndex, 
                          end: node.rowIndex + span - 1
                      });
                  }
                  r += span;
              } else {
                  r++; 
              }
          }
          rowspanGroups[rowSpanColId] = groups;
      }
  }

  // 2) PROCESS ROWS
  const bodyRows = processRowNodes(displayedNodes, columns, rowspanGroups, rowSpanColId);
  const pinnedRows = processRowNodes(pinnedBottomRowNodes, columns, {}, null); 
  
  // 3) COMBINE
  return { 
      allRows: [...bodyRows, ...pinnedRows],
      rowspanGroups: rowspanGroups, 
      rowSpanColId: rowSpanColId
  };
};

/**
 * Main export function (ExportPdf_new)
 */
const exportToPdf = (gridApi, fileName) => {
  const columns = gridApi.columnModel.getAllDisplayedColumns();
  const headerRow = getHeaderToExport(gridApi);
  
  const { allRows, rowspanGroups, rowSpanColId } = getRowsToExport(gridApi); 
  
  const docDefinition = {
    pageSize: "A4",
    pageOrientation: "landscape",
    pageMargins: [10, 10, 10, 30], // [left, top, right, bottom]
    footer: (currentPage, pageCount) => ({
      columns: [
        {
          text: "AG Grid - Confidential",
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
          widths: columns.map(() => `${100 / columns.length}%`),
          body: [headerRow, ...allRows], 

          heights: (rowIndex) => {
            if (rowIndex === 0) return 40; // header
            
            // Re-calculate nodes for height check
            const bodyIndex = rowIndex - 1;
            const displayedNodes = [];
            gridApi.forEachNodeAfterFilterAndSort((node) => {
                displayedNodes.push(node);
            });
            
            // 💡 FIX: Use the robust helper function here too
            const pinnedBottomNodes = getPinnedBottomNodes(gridApi); 
            
            let node;
            if (bodyIndex < displayedNodes.length) {
                node = displayedNodes[bodyIndex];
            } else if (bodyIndex < displayedNodes.length + pinnedBottomNodes.length) {
                node = pinnedBottomNodes[bodyIndex - displayedNodes.length];
            }
            
            const rowData = node?.data || {};
            // Return 80 height for Total rows, 40 for standard rows
            return rowData.justification === "Total" ? 80 : 40;
          },
          dontBreakRows: true 
        },

        /** FINAL FIX: CUSTOM LAYOUT FOR BORDER HANDLING */
        layout: {
          fillColor: (rowIndex) => {
            if (rowIndex === 0) return "#401664";
            return rowIndex % 2 === 0 ? "#fcfcfc" : "#fff"; 
          },

          vLineWidth: (i, node) => 1,
          vLineColor: (i, node) => "#dde2eb",
          
          hLineWidth: (i, node) => {
             // i is the line index (0 is top of header, node.table.body.length is bottom of table)
             if (i === 0 || i === node.table.body.length) return 1; // Top/Bottom outer border

             // Check if this line index 'i' is the *end* of a row-span group
             const groups = rowspanGroups[rowSpanColId];
             if (groups) {
                // Check if the row *above* this line (i-1) is the end of a span (i is the line index)
                const isEndOfSpan = groups.some(g => g.end + 1 === i);

                // If we are at the end of a span, draw the line. This helps with page-break border issue.
                if (isEndOfSpan) {
                    return 1;
                }
                
                // If we are inside a span, suppress the line
                const isInsideSpan = groups.some(g => g.start + 1 <= i && i <= g.end);
                if (isInsideSpan) {
                     return 0; // Inside a row-span group: no horizontal line
                }
             }

             // All other non-spanned rows get a line
             return 1; 
          },
          hLineColor: () => "#dde2eb",

          paddingLeft: () => 4,
          paddingRight: () => 4,
          paddingTop: () => 6,
          paddingBottom: () => 6
        }
      }
    ]
  };

  pdfMake.createPdf(docDefinition).download(fileName);
};
