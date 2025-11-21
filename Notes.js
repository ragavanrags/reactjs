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
  const getRowsToExport = (gridApi) => {
  const columns = gridApi.columnModel.getAllDisplayedColumns();
  const rowsToExport = [];

  const rowCount = gridApi.getDisplayedRowCount();
  const skipMap = new Map(); // key: rowIndex, value: Set of colIds to skip

  for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {
    const node = gridApi.getDisplayedRowAtIndex(rowIndex);
    const row = [];

    columns.forEach((column) => {
      const colId = column.getColId();
      const colDef = column.getColDef();
      const value = colDef.exportValueGetter
        ? colDef.exportValueGetter({
          data: node.data, node, colDef, column
        }) : gridApi.getValue(column, node) ?? "";
      const cellStyle = colDef.cellStyle || {};

      const supportsRowSpan = typeof column.getRowSpan === "function";
      const rowSpan = supportsRowSpan ? column.getRowSpan(node) : 1;

      // Skip if this cell is part of a previous rowSpan
      if (skipMap.has(rowIndex) && skipMap.get(rowIndex).has(colId)) {
        row.push(""); // placeholder for spanned cell
        return;
      }

      if (rowSpan > 1) {
        // Mark future rows to skip this column
        for (let i = 1; i < rowSpan; i++) {
          const skipRow = rowIndex + i;
          if (!skipMap.has(skipRow)) skipMap.set(skipRow, new Set());
          skipMap.get(skipRow).add(colId);
        }

        row.push({
          text: value,
          ...(rowSpan > 1 ? { rowSpan, alignment: "center" } : {}),
          ...cellStyle,
          margin: [0, 50, 0, 0],
          noWrap: false
        });
      } else {
        // Regular cell
        row.push({
          text: value,
          ...cellStyle,
          margin: [2, 2, 2, 2],
          noWrap: false
        });
      }
    });

    rowsToExport.push(row);
  }

  return rowsToExport;
};
