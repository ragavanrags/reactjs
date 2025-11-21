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


heights: (rowIndex) => {
  if (rowIndex === 0) return 40;

  const bodyIndex = rowIndex - 1;
  const node = gridApi.getDisplayedRowAtIndex(bodyIndex);

  if (!node) return 40;

  const rowData = node.data || {};

  // total row
  if (rowData.justification === "Total") return 80;

  // ⭐️ ALLOW TOP ROW OF A ROWSPAN TO GROW
  // if this row is a top-row of any rowspan group
  for (const col of columns) {
    const span = col.getRowSpan?.(node);
    if (span > 1) {
      return span * 40; // the merged total height
    }
  }

  return 40; // normal
},

===========
  heights: (rowIndex) => {
  if (rowIndex === 0) return 40;

  const bodyIndex = rowIndex - 1;
  const node = gridApi.getDisplayedRowAtIndex(bodyIndex);
  if (!node) return 40;

  const rowData = node.data || {};

  // total row
  if (rowData.justification === "Total") return 80;

  // ⭐ Detect top row of any rowSpan (ESLint-safe)
  const topSpanColumn = columns.find(
    (col) => col.getRowSpan?.(node) > 1
  );

  if (topSpanColumn) {
    return topSpanColumn.getRowSpan(node) * 40;
  }

  return 40;
},
===========
  if (group) {
  const isTop = rowIndex === group.start;
  const isBottom = rowIndex === group.end;
  const isMiddle = !isTop && !isBottom;

  const span = group.end - group.start + 1;
  const middleIndex = group.start + Math.floor(span / 2);

  // --- Borders (unchanged) ---
  if (isTop) {
    cell.border = [true, true, true, false];
  } else if (isMiddle) {
    cell.border = [true, false, true, false];
  } else if (isBottom) {
    cell.border = [true, false, true, true];
  }

  // --- Middle-row visual centering patch ---
  if (rowIndex === middleIndex) {
    // Only MIDDLE row gets text (centered visually)
    cell.text = value;
    cell.margin = [0, 10, 0, 10];  // optional small padding
  } else {
    // All other rows in group are blank
    cell.text = "";
    cell.margin = [0, 0, 0, 0];
  }
}
===========
// Middle-row nudge (replace your current middle-row block)
if (rowIndex === middleIndex) {
  // value is your original text variable
  cell.text = "";               // remove direct text
  cell.margin = [0, 0, 0, 0];   // no outer margin, avoid row expansion

  // Stack with asymmetric spacers: small top spacer, larger bottom spacer -> pushes text upward
  cell.stack = [
    { text: "", margin: [0, 4, 0, 0] },     // small top spacer (tweak)
    { text: value, alignment: "center" },   // actual text
    { text: "", margin: [0, 12, 0, 0] }     // larger bottom spacer (tweak to control upward bias)
  ];

  // optional: adjust font/line height if you need fine control
  // cell.stack[1].fontSize = 10;
  // cell.stack[1].lineHeight = 1.1;
} else {
  cell.text = "";
  cell.margin = [0, 0, 0, 0];
  delete cell.stack;
}

=====
  // ---------- PIXEL-BASED PERFECT CENTERING ----------
if (rowIndex === group.start) {
  // Only compute this once (top row)
  const span = group.end - group.start + 1;
  const normalHeight = 40;
  const mergedHeight = span * normalHeight;

  // compute pixel center inside merged block
  const textHeight = 14;               // approximate font size height
  const available = mergedHeight - textHeight;
  const topSpace = available / 2;

  // use stack to place text at center visually
  cell.text = "";
  cell.margin = [0, 0, 0, 0];
  cell.stack = [
    { text: "", margin: [0, topSpace - 20, 0, 0] },  // small correction
    { text: value, alignment: "center" },
  ];
}

// middle & bottom rows of group
else if (rowIndex > group.start && rowIndex <= group.end) {
  cell.text = "";
  cell.stack = [];
  cell.margin = [0, 0, 0, 0];
}
===========
// Middle-row (visual centering with slight upward shift)
if (rowIndex === middleIndex) {
  cell.text = "";       // remove direct text
  cell.margin = [0, 0, 0, 0];

  // Fine tuning for perfect visual alignment
  const topPad = 6;      // increase to push text DOWN
  const bottomPad = 2;   // increase to push text UP

  cell.stack = [
    { text: "", margin: [0, topPad, 0, 0] },    // top space
    { text: value, alignment: "center" },       // actual text
    { text: "", margin: [0, bottomPad, 0, 0] }  // bottom space
  ];
} else {
  cell.text = "";
  delete cell.stack;
  cell.margin = [0, 0, 0, 0];
}

