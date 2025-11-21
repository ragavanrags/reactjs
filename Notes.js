const breakRow = new Array(columns.length).fill("");
breakRow[0] = { text: "", pageBreak: "before", colSpan: columns.length };
rowsToExport.push(breakRow);
