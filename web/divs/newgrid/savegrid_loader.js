"use strict";

if(!global.SGL) {global.SGL = 1} else {global.SGL++;};

const globUtil = GLOB.util;
// const getUID = globUtil.getUID;
const {dynamic} = globUtil.mLoad ;
const pugLoader = globUtil.pugLoader;

const FOLDERS = GLOB.settings.paths.folders;
const dataFolder = FOLDERS.data;
const divsFolder = FOLDERS.divs;
const localFolder = divsFolder + "newgrid/";
const log = globUtil.logger.getLogger( `savegrid_loader (Reload #${global.SGL}) `);

const validategrid_parseInput = dynamic(localFolder + "validategrid_loader.js").parseInput;

const gridsDB = require(dataFolder + "gridsDB");
const GRID = gridsDB.GRID;

log.object("gridsDB", gridsDB);

module.exports.getDivData = getDivData;

// The msg contains the following data
//  gridString: A string holding 9 lines of 9 digits representing a completed grid
//  gridName: A text string subitted by the user as the name to be used to refer to this grid in the index
async function getDivData( ws, msg, replyMsg ){
  let dts = (new Date() ).toISOString();
  let [sDate, sTime] = dts.split(".")[0].split("T");
    
  msg.errorList= [ ];

  log.object(`msg`, msg)

  validategrid_parseInput(  msg );


  let divData = {
      date: sDate
      , time: sTime
      , txtInput: msg.divData.txtInput
      , parsedInput: msg.parsedInput
      , errorList: msg.errorList
      , errorCount: msg.errorCount
  };

replyMsg.errorCount = msg.errorCount;
replyMsg.parsedInput = msg.parsedInput;


  if(msg.errorCount > 0) {
    log.error(new Error(`${replyMsg.errorCount} Errors found in validating input`));
    log.object("Error divData", divData)
    return divData;
  }

  log("Grid spec is valid so far")

  divData = {
        date: sDate
        , time: sTime
        , txtInput: msg.divData.txtInput
        , parsedInput: msg.parsedInput
        , errorList: msg.errorList
        , errorCount: msg.errorCount
    };

  //if(msg.errorCount > 0){
    msg.divName="validategrid";
    msg.divTarget="grid-errors";

    replyMsg.errorCount = msg.errorCount;
    replyMsg.parsedInput = msg.parsedInput;
  
    replyMsg.msgType = "save-grid"


  // remove spaces and line feeds from the grid input to create the grid string
  let gridString = msg.parsedInput.replace(/\n|\r|\W/g, "");
  if(gridString.length != 81){
    log("Error - grid string length is not 81")
    return divData;
  };
  
  log("Grid string length = 81 so OK for now...")

  if( gridsDB.gridStringExists(gridString)){
    log("Error - grid string already exists in grids database");
    divData.errorList[divData.errorCount]={ description: "This grid already exists in the grids database" };
    replyMsg.errorCount = ++divData.errorCount;
    return divData;

  };

  log("Not already in database...")

  let gridSpec = {
    gridString
  };

  let newGrid = new GRID( { gridSpec });
  log.object("newGrid", newGrid );

  if(!newGrid.analysis.isValid){
    log("Error - grid is not valid on construction");
    divData.errorList[divData.errorCount]={ description: "The grid was not valid on construction"};
    replyMsg.errorCount = ++divData.errorCount;
    return divData
  }

  gridsDB.addGrid(newGrid);


  //if(msg.errorCount > 0){
    msg.divName="validategrid";
    msg.divTarget="grid-errors";

    replyMsg.errorCount = msg.errorCount;
    replyMsg.parsedInput = msg.parsedInput;
  
    replyMsg.msgType = "save-grid"
   //}
    log("After validation, the reply msg is:", replyMsg);



    return divData;
    
}