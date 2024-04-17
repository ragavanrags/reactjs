import { AgGridReact } from 'ag-grid-react'; // AG Grid Component
import "ag-grid-community/styles/ag-grid.css"; // Mandatory CSS required by the grid
import "ag-grid-community/styles/ag-theme-quartz.css";
import { useState } from 'react';

const GridExample = () => {
    // Row Data: The data to be displayed.
    const defaultColDef = {
        width: 170,
        resizable: true,
      };
    const [rowData, setRowData] = useState([
      { make: "Tesla", model: "Model Y", price: 64950, electric: true},
      { make: "Ford", model: "F-Series", price: 33850, electric: false,  },
      { make: "Ford",  model: "F-Series1", price: 33850, electric: false,},
      { make: "Toyota", model: "Corolla", price: 29600, electric: false, },
      { make: "Toyota",  model: "Corolla1", price: 29600, electric: false,  },
      { make: "Tesla", model: "Model YY", price: 650, electric: true, },
      { make: "Tesla", model: "Model Y", price: 64951, electric: true, },
    ]);
    
    // Column Definitions: Defines the columns to be displayed.
    const [colDefs, setColDefs] = useState([
      { 
        field: "make",
        rowSpan: (params) => {
            return rowData.filter((e) => e.order1 === params.data.order1).length;
        },
        cellClassRules: {
            "show-cell": "value !== undefined",
        },
          cellDataType: false,
    },
      { field: "model", 
      rowSpan: (params) => {
        return rowData.filter((e) => e.order2 === params.data.order2).length;
    },
    cellClassRules: {
        "show-cell1": "value !== undefined",
    },
     },
      { field: "price" },
      { field: "electric" }
    ]);

    const getUpdatedRowData = (columnsWithSpan) => {
        const uniq = {};
        const orderCount = columnsWithSpan.reduce((acc, key, index) => {
            acc[index] = 1;
            return acc;
          }, {})
        const updatedData = [...rowData];
        updatedData.forEach((obj) => {
            columnsWithSpan.forEach((elmt, index) => {
                if (!uniq[obj[elmt]]?.isExists) {
                    uniq[obj[elmt]] ={isExists: true, order: orderCount[index]};
                    obj[`order${index + 1}`] = uniq[obj[elmt]]?.order;
                    orderCount[index]++;
                } else {
                    obj[`order${index + 1}`] = uniq[obj[elmt]]?.order;
                    delete obj[elmt];
                }
            })
        });
        updatedData.sort((obj1, obj2) => {
            let consolidateSortObj = '';
            columnsWithSpan.forEach((value, index) => {
                if (index === 0) {
                    consolidateSortObj = `${obj1[`order${index + 1}`] - obj2[`order${index + 1}`]}`;
                } else {
                    consolidateSortObj += ` || ${obj1[`order${index + 1}`] - obj2[`order${index + 1}`]}`;
                }
            })
            // obj1.order1 - obj2.order1 || obj1.order2 - obj2.order2
            return new Function('return (' + consolidateSortObj + ')')()
        });
        setRowData([...updatedData]);
    }

    const onGridReady = () => {
        getUpdatedRowData(['make','model']);
    }
    return (
        // wrapping container with theme & size
        <div
         className="ag-theme-quartz" // applying the grid theme
         style={{ height: "800px", width: "100%" }} // the grid will fill the size of the parent container
        >
          <AgGridReact
              rowData={rowData}
              columnDefs={colDefs}
              suppressRowTransform={true}
              defaultColDef={defaultColDef}
              onGridReady={onGridReady}
          />
        </div>
       )
}

export default GridExample;
