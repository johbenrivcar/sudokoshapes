// Test
console.log("home_script is loading")

// list of all available grids as stored on the server
if(!document.allGridDivs) document.allGridDivs = {};


if(!document.home_script){
  let hs = document.home_script = {};
  hs.grids = [
      {  
          gridInfo: {
              "id": "base1"
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
          }
      },

      {
        
          gridInfo:{
              "id": "base2"
            , "grid": {
              "r1": "234567891"
            , "r2": "567891234"
            , "r3": "891234567"
            , "r4": "345678912"
            , "r5": "678912345"
            , "r6": "912345678"
            , "r7": "123456789"
            , "r8": "456789123"
            , "r9": "789123456"
              }
            , "info":{
                "date": "2023-10-02"
                , "category": ""
              }
            , "analysis":{
            }
          }
      }

  ]

  hs.testGridInfo = {
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
  hs.loadGridList = function loadGridList(){
    // spec {pec.name, spec.folder, spec.target, spec.data, spec.cbFunction, spec.cbData }
    ws_loadOneDiv(
      { name: "gridlist",
        target: "gridlist"}
    );

  }
  hs.loadGrid = function loadGrid(gridDivId, gridInfo){
      console.log(`>>loadGrid ${gridDivId}`)

      let newGridInfo = {}
      
      document.allGridDivs[gridDivId].gridInfo = gridInfo;

      $(`#${gridDivId}`).addClass("grid-loading");

      $(`#${gridDivId}-name`).html(gridInfo.id);

      for( let r = 1; r < 10; r++ ){
          let rowSpec = gridInfo.grid[`r${r}`]
          console.log("Row "+r, rowSpec);
          for ( let c=1; c < 10; c++){
              let cellNum = rowSpec.substring(c-1,c);
              let cellID = `#${gridDivId}r${r}c${c}`;
              console.log(`Col ${c} id ${cellID} set to ${cellNum}`);
              $(cellID).html(cellNum);
          }
      }

  };

  hs.analyseGrid = function analyseGrid(gridNumber){

      let gridInfo = document.allGridDivs[`grid${gridNumber}`].gridInfo;

      let gridAnalysisKey = `#grid-analysis-${gridNumber}`;

      console.log(`Analysing grid ${gridAnalysisKey}`);

  };

  hs.defineNewGrid = function defineNewGrid(){
    //alert("define new grid");

    // get the newgrid form from the server and load it into the right-hand segment
    ws_loadOneDiv({
                  name: 'newgrid'
                  , target: 'page-main'
              });

    //loadGrid("gridAAA", grids[0].gridInfo);
  }

  hs.showGrid_AAA = function showGrid_AAA(){
    hs.loadGrid("gridAAA", hs.grids[1].gridInfo);
    //alert("loaded gridAAA");
  };
}


$( function (){
    let hs=document.home_script;

    console.log("Home script loaded");

    hs.showGrid_AAA();
    hs.loadGrid("gridBBB", hs.grids[0].gridInfo);

    hs.loadGridList();



});