// Test
console.log("home_script is loading")

var grids = [
     {
        gridInfo: {}
     },

    {
        gridInfo:{ }
    }

]

let testGridInfo = {
    "id": "base"
  , "grid": {
        "r1": "123456789"
      , "r2": "456789123"
      , "r3": "789123456"
      , "r4": "234567891"
      , "r5": "567891234"
      , "r6": "891234567"
      , "r7": "345678912"
      , "r8": "678912345"
      , "r9": "912345678"
    }
  , "info":{
      "date": "2023-10-02"
      , "category": ""
    }
  , "analysis":{
  }
};

function loadGrid(gridNumber, gridInfo){
    console.log(`>>loadGrid ${gridNumber}`)

    grids[1].gridInfo = gridInfo;

    $(`#grid${gridNumber}`).addClass("grid-loading");

    $(`#grid${gridNumber}-id`).html(gridInfo.id);

    for( let r = 1; r < 10; r++ ){
        let rowSpec = gridInfo.grid[`r${r}`]
        console.log("Row "+r, rowSpec);
        for ( let c=1; c < 10; c++){
            let cellNum = rowSpec.substring(c-1,c);
            let cellID = `#gc-${gridNumber}-${r}-${c}`;
            console.log(`Col ${c} id ${cellID} set to ${cellNum}`);
            $(cellID).html(cellNum);
        }
    }

};

function analyseGrid(gridNumber){
    let gridInfo = grids[gridNumber].gridInfo;

    let gridAnalysisKey = `#grid-analysis-${gridNumber}`;

    

};


$( function(){
    console.log("Home script loaded");
    loadGrid(1, testGridInfo);
});