import pdfMake from "pdfmake/build/pdfmake";
import pdfFonts from "pdfmake/build/vfs_fonts";

pdfMake.vfs = pdfFonts;

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
    
    // We need to keep a running index relative to the *start* of the main grid for accurate rowSpan mapping.
    // However, since pinned rows are usually just summaries, we treat them as individual, non-spanned rows.
    
    nodes.forEach((node) => {
        const row = [];
        const rowData = node.data || {};
        const isTotalRow = rowData.justification === "Total";
        const rowIndex = node.rowIndex; // Use AG Grid's natural index for displayed rows

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

            // APPLY ROWSPAN LOGIC
            const groups = rowspanGroups[colId];
            let isRowSpanHandled = false;

            if (groups && rowSpanColId) { // Only check for rowSpan on the main grid body rows
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
            
            // For all non-spanned cells (or the top cell of a span)
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
  
  // Get all displayed nodes (including filter/sort, excluding pinned)
  const displayedNodes = [];
  gridApi.forEachNodeAfterFilterAndSort((node) => {
      displayedNodes.push(node);
  });
  
  // Get Pinned Bottom Nodes (reinstated)
  const pinnedBottomNodes = gridApi.getPinnedBottomRowNodes(); 
  
  const rowSpanColId = columns[0] ? columns[0].getColId() : null;
  const rowCount = displayedNodes.length; // Count only the main body rows for span calculation

  // 1) PRECOMPUTE ROWSPAN GROUPS FOR EACH COLUMN
  const rowspanGroups = {};

  // We only calculate row spans for the main body rows. Pinned rows should not span.
  if (rowSpanColId) {
      const column = columns.find(c => c.getColId() === rowSpanColId);
      if (column) {
          const groups = [];
          let r = 0;

          while (r < rowCount) {
              const node = displayedNodes[r]; // Iterate over the main body nodes
              const span = column.getRowSpan ? column.getRowSpan(node) : 1;

              if (span > 1) {
                  groups.push({
                      start: node.rowIndex, // Use the AG Grid rowIndex for mapping
                      end: node.rowIndex + span - 1
                  });
              }
              r += span;
          }
          rowspanGroups[rowSpanColId] = groups;
      }
  }

  // 2) PROCESS ROWS
  // Process main body rows
  const bodyRows = processRowNodes(displayedNodes, columns, rowspanGroups, rowSpanColId);
  
  // Process pinned bottom rows (they will not have row spans applied)
  const pinnedRows = processRowNodes(pinnedBottomNodes, columns, {}, null); 
  
  // 3) COMBINE
  return { 
      allRows: [...bodyRows, ...pinnedRows],
      rowspanGroups: rowspanGroups, // Return groups for hLineWidth function
      rowSpanColId: rowSpanColId
  };
};

/**
 * Main export function
 */
const exportToPdf = (gridApi, fileName) => {
  const columns = gridApi.columnModel.getAllDisplayedColumns();
  const headerRow = getHeaderToExport(gridApi);
  
  const { allRows, rowspanGroups, rowSpanColId } = getRowsToExport(gridApi); // Destructure the new return value
  
  const docDefinition = {
    // ... (rest of docDefinition remains the same)

    content: [
      {
        table: {
          headerRows: 1,
          widths: columns.map(() => `${100 / columns.length}%`),
          body: [headerRow, ...allRows], // Use the combined array

          heights: (rowIndex) => {
            if (rowIndex === 0) return 40; // header
            
            // Adjusted logic to find the node, handling both main and pinned rows
            const bodyIndex = rowIndex - 1;
            
            // Check main body rows first
            const displayedNodes = [];
            gridApi.forEachNodeAfterFilterAndSort((node) => {
                displayedNodes.push(node);
            });
            
            const pinnedBottomNodes = gridApi.getPinnedBottomRowNodes(); 
            
            let node;
            if (bodyIndex < displayedNodes.length) {
                node = displayedNodes[bodyIndex];
            } else if (bodyIndex < displayedNodes.length + pinnedBottomNodes.length) {
                node = pinnedBottomNodes[bodyIndex - displayedNodes.length];
            }
            
            const rowData = node?.data || {};
            return rowData.justification === "Total" ? 80 : 40;
          },
          dontBreakRows: true 
        },

        /** FINAL FIX: CUSTOM LAYOUT FOR BORDER HANDLING */
        layout: {
          // ... (fillColor remains the same)
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
                // The line index `i` corresponds to row index `i-1`.
                // A line should be drawn if the row above it (i-1) is the end of a span.
                // Or, if the line is the top of the row (i) and that row is the start of a span.
                
                // Check if the row *above* this line is the end of a span (i-1 is the row index)
                const isEndOfSpan = groups.some(g => g.end + 1 === i);

                // Check if the current row *i* is the start of a span
                const isStartOfSpan = groups.some(g => g.start === i);
                
                // If we are at the end of a span, draw the line.
                if (isEndOfSpan) {
                    return 1;
                }
                
                // If we are inside a span, suppress the line
                const isInsideSpan = groups.some(g => g.start < i && i < g.end + 1);
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
