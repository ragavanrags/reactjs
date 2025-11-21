const breakRow = new Array(columns.length).fill("");
breakRow[0] = { text: "", pageBreak: "before", colSpan: columns.length };
rowsToExport.push(breakRow);
================================================
const getDocument = (gridApi) => {
  // existing code ...

  return {
    // ...
    content: [
      {
        table: {
          headerRows: 1,
          widths: columns.map(() => `${100 / columns.length}%`),
          body: [headerRow, ...rows],
          // set dontBreakRows to false to allow smart breaking
          dontBreakRows: false,
        },
        pageBreakBefore: (currentNode, followingNodesOnPage, nodesOnNextPage) => {
          const rowIndex = currentNode.tableBodyNode.rowIndex;
          const rowSpan = getRowSpanOfRow(rowIndex); // implement this to query rowSpan info

          if (rowSpan > 1) {
            const rowsLeft = followingNodesOnPage.length + nodesOnNextPage.length;
            if (rowsLeft < rowSpan) return true;
          }
          return false;
        },
        layout: {
          fillColor: (rowIndex) => (rowIndex === 0 ? "#401664" : rowIndex % 2 === 0 ? "#fcfcfc" : "#fff"),
          hLineWidth: () => 1,
          vLineWidth: () => 1,
          hLineColor: () => "#dde2eb",
          vLineColor: () => "#dde2eb",
          paddingTop: () => 4,
          paddingBottom: () => 4,
        }
      }
    ],
    // ...
  };
};
==============================
// VERTICAL CENTERING (NEW)
 // ⭐ vertical center only for real rowSpan top rows
const span = column.getRowSpan?.(node);
if (span > 1) {
  const normalRowHeight = 40;
  const mergedHeight = (group.end - group.start + 1) * normalRowHeight;
  const extra = (mergedHeight - normalRowHeight) / 2;

  cell.margin = [0, extra, 0, extra];
}

