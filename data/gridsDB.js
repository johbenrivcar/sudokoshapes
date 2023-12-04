"use strict";
console.log("##>> gridsDB.js")
/**
 *              grids.js
 * 
 *  Implements object storage for grids devised and submitted by users
 * 
 *  Provides implementation of a grid object that includes methods for creating, manipulating and saving grids
 * 
 *  
 * 
 */

// Load application global functions and data
require("../GLOB/INIT");

const fs=require("fs");

// function for generating UIDs
let getUID = GLOB.util.getUID;
const logger = GLOB.util.logger;
const rootify = GLOB.rootify;
//log(getUID());


// Verbose logger
const vLog = logger.getLogger( "gridsDB" );


const log = function(...args){ vLog(...args) };
log.object = vLog.object;
log.error = vLog.error;

const squareKeys = ["AA", "AB", "AC", "BA", "BB", "BC", "CA", "CB", "CC"];

const idSelector = [0,10,20,30,39,48,56,64,72,8,16,24,32,41,50,60,70,80];

const pairRCs=[{a:1,b:2},{a:2,b:3},{a:1,b:3},{a:4,b:5},{a:5,b:6},{a:4,b:6},{a:7,b:8},{a:8,b:9},{a:7,b:9}];
const tripRCs=[{a:1,b:2,c:3},{a:4,b:5,c:6},{a:7,b:8,c:9}];

// js modules required
const util = require("util");
const { isAscii } = require("buffer");
const { simpleClone } = GLOB.util;

var lastSerial = 0;

/** This is the json file containing all the grids for the sudoku solutions loaded so far.
 *  
 * The template is a GridInfo object:
 *      id: string, 
 *      name: string, 
 *      notes: string, 
 *      gridString: string, 
 *      info:   
 *          date: datestring yyyymmdd-hhmmss 
 *          user: string   
 *      category: string
 *      signature: string
 * 
*/ 
const dbReadPath = GLOB.settings.gridsDB.readPath;
const dbWritePath = GLOB.settings.gridsDB.writePath;

vLog(`Read db from: ${dbReadPath}`);
vLog(`Write db to: ${dbWritePath}`);

const gridsDB = require("./DB/gridsDB.json");

// =============================================================================
// CLASS DEFINITIONS
// =============================================================================



/* CLASS CELL */    class CELL{
                            
                            hue="U";
                            get key(){ return cellKey(this.r,this.c) };
                            get rg(){ return rcg(this.r) };
                            get cg(){ return rcg(this.c)};
                            get squareKey(){ return this.rg+this.cg; };
                            

                            constructor(pr,pc,pLab){
                                this.r = pr;
                                this.c = pc;
                                this.label = pLab;

                            }
                        }

                        
/* CLASS GRID */    class GRID{
                            id = null
                            grid = {};
                            analysis = {};



                            info = {
                                date: (new Date()).toISOString().substring(0,10)
                                , serial: ++lastSerial
                            };


                            /**
                             * The parameter is a string of 81 chars representing 9 rows of 9 chars
                             * @param {string} gs 
                             */
                            loadFromGridString(gs){
                                if(gs.length != 81) throw new Error("gridsDB: Invalid gridstring");
                                let newgrid = {};
                                for(let ix=0; ix<9; ix++){
                                    let line = gs.substring(ix*9, ix*9 + 9);
                                    let line2 = line.substring(0,3)+' '+line.substring(3,6)+" "+line.substring(6,9);
                                    newgrid[`${ix+1}`]=line2;
                                };

                                newgrid.id = generateIdFromGridString(gs);

                                log("New grid created", newgrid );
                                
                                let result = this.loadFromGrid(newgrid);

                                if(!result) throw new Error( "gridsDB: could not create grid from gridstring");

                                // result contains the created grid. NOT YET ADDED TO THE DB;
                                log.object("Grid created", result);
                                return result;

                            };
                            /**
                             * 
                             */
                            loadFromGridSpec( pGridSpec ){
                                log(">>loadFromGridSpec");
                                Object.assign( this, pGridSpec );

                                if(!this.id) this.id = generateIdFromGridString( this.gridString );

                                if(!this.name) this.name=this.id;
                                if(!this.info.user) this.info.user='jbrc';
                                
                                this.loadFromGridString( this.gridString );
                            }

                            /**
                             * 
                             * @returns 
                             */
                            gridSpec(){
                            return {
                                    id: this.id, 
                                    name: this.name, 
                                    gridString: this.gridString, 
                                    info:  {
                                            date: this.info.date, 
                                            user: this.info.user, 
                                            notes: this.info.notes }, 
                                    category: this.category,
                                    signature: this.signature
                                }

                            };

                            /**
                             * function expects single paraneter definition of a grid as an object with nine
                             * members keyed with row numbers 1 to 9.
                             * Each member of the object is a string of nine different characters, representing
                             * the labels of the grid cells in columns 1 to 9.
                             *  
                             * @param {*} pGrid 
                             * @returns 
                             */
                            loadFromGrid(pGrid){
                                log.object("loading from grid", pGrid)

                                if(!pGrid) throw new Error("Must supply grid to be loaded");
                                    
                                // the parameter grid is cloned to avoid contamination if either grid is changed later.
                                pGrid = this.grid = simpleClone(pGrid);
                                
                                // clear the various cell collections, these will be rebuilt by the load process.
                                let cells = this.analysis.cells = {};
                                let cpl = this.analysis.cellsPerLabel = {  }
                                let cpr = this.analysis.cellsPerRow = { 1: [], 2: [], 3:[], 4:[], 5:[], 6:[], 7:[], 8:[], 9:[] }
                                let cpc = this.analysis.cellsPerCol = { 1: [], 2: [], 3:[], 4:[], 5:[], 6:[], 7:[], 8:[], 9:[] }
                                let cps = this.analysis.cellsPerSquare = {AA: [], AB: [], AC:[], BA:[], BB:[], BC:[], CA:[], CB:[], CC:[] }
                                
                                // label counts are used to check that the grid is valid, i.e. numbers 1-9 in each row column and 3x3 square
                                let clc = this.analysis.colLabelCounts = { 1: { }, 2: { }, 3:{ }, 4:{ }, 5:{ }, 6:{ }, 7:{ }, 8:{ }, 9:{ } };
                                let rlc = this.analysis.rowLabelCounts =  { 1: { }, 2: { }, 3:{ }, 4:{ }, 5:{ }, 6:{ }, 7:{ }, 8:{ }, 9:{ } };
                                let slc = this.analysis.squareLabelCounts = {AA: { }, AB: { }, AC:{ }, BA:{ }, BB:{ }, BC:{ }, CA:{ }, CB:{ }, CC:{ } };
                                

                                // process the row definitions of the grid
                                for( let iRow = 1; iRow<10; iRow++) {

                                    // The row definition of the row is a string
                                    let sRowDef = pGrid[iRow];
                                    log( "sRowDef", sRowDef );

                                    // Process each character in the string to be the label of each cell in the row
                                    let iCol = 0;
                                    for( var sLab of sRowDef){

                                        //  skip and ignore blanks in the line
                                        if(sLab==" ") continue;

                                        // increment the column number
                                        iCol+=1

                                        // create a new instance of a cell with row, column and label settings
                                        let cell = new CELL(iRow, iCol, sLab); 

                                        // get the key from the cell
                                        let gridKey = cell.key;

                                        // get row and column groups from the cell
                                        let rg= cell.rg;
                                        let cg= cell.cg;

                                        // the square key from the cell
                                        let squareKey = cell.squareKey;

                                        // add the new cell to the list of all cells, referenced by key
                                        cells[gridKey]=cell;

                                        // Create the list of cells for this label if not already there (s/b always nine cells per label)
                                        if(!cpl[sLab]) {
                                            cpl[sLab]=[];
                                            log(`created counts for ${sLab}`);
                                        }

                                        // Add the cell to the collections for this label, row, column and square
                                        log(`Adding cell ${gridKey} to cpl for ${sLab}`);
                                        cpl[sLab].push(cell);
                                        cpr[iRow].push(cell);
                                        cpc[iCol].push(cell);
                                        cps[squareKey].push(cell);

                                        // add to the row, column and square counts for this label
                                        bumpCounter( clc[iCol], sLab);
                                        bumpCounter( rlc[iRow], sLab);
                                        bumpCounter( slc[squareKey], sLab);

                                    }   
                                } ;

                                // Sort the cells per row and per column, so that they are in ascending order or column
                                // and ascending order of row respectively.
                                for( let xx = 1; xx<10; xx++){
                                    this.analysis.cellsPerRow[xx]=this.analysis.cellsPerRow[xx].sort( (a,b)=>{ return a.c - b.c } )
                                    this.analysis.cellsPerCol[xx]=this.analysis.cellsPerCol[xx].sort( (a,b)=>{ return a.r - b.r } )
                                };

                                if(!this.validate()) return null;
                                
                                let newGS = "";
                                for( let ix=1; ix<10; ix++ ){
                                    let line = this.grid[ix].split(" ").join("");
                                    newGS += line;
                                }
                                this.gridString = newGS;

                                this.findAllTriplets();
                                this.analysis.allPairs = [ "TBA" ];
                                
                                return this;
                                
                            };


                            /**
                             * validates the grid.
                             *  checks that each row and column contain a single occurrence of each label,
                             *  and that each 3x3 segment contains all nine labels once only.
                             * @returns 
                             */
                            validate(){

                                this.analysis.iValid = false;


                                // Check that exactly 9 different labels have been used
                                let isValid = Object.keys(this.analysis.cellsPerLabel).length == 9

                                function checkLabelCounts(lc, sTitle ){
                                    let lkeys = Object.keys(lc);
                                    let valid = (lkeys.length==9);

                                    if(valid) lkeys.forEach(lab=>{
                                        //log(`Checking count for label ${lab} = ${lc[lab]}`)
                                        if( ! (lc[lab] == 1) ) valid = false;
                                        //log(`Valid?: ${valid}`)
                                    });

                                    //if(sTitle) log(sTitle + " is valid? " + valid);
                                    return valid;
                                }

                                for(let x=1; x<10; x++){
                                    let rlc = this.analysis.rowLabelCounts[x];
                                    let clc = this.analysis.colLabelCounts[x];
                                    let rowValid = checkLabelCounts(rlc, `Row ${x}`);
                                    let colValid = checkLabelCounts(clc, `Col ${x}`);

                                    isValid = isValid && rowValid && colValid

                                };

                                squareKeys.forEach(key=>{
                                    let slc = this.analysis.squareLabelCounts[key];
                                    // log("checking square ", key, slc );
                                    let squarevalid = checkLabelCounts(slc, `Square ${key}`);
                                    if(!squarevalid) isValid = false;
                                });

                                if(isValid){
                                    

                                    this.findAllFrames();

                                    // Now summarise the frame keys

                                }


                                log(`----------- validation complete isValid=${isValid}`)
                                //this.analysis.rowLabelCounts = rowLabelCounts;
                                //this.analysis.colLabelCOunts = colLabelCounts;

                                this.analysis.isValid = isValid;
                                return isValid;

                            }

                            rows(x){ return this.analysis.cellsPerRow[x]; };
                            cols(x){ return this.analysis.cellsPerCol[x]; };
                            squares(x){return this.analysis.cellsPerSquare[x]};

                            rotateR(){
                                log("rotating R......")
                                let newCellsPerRow = {};
                                let newCellsPerCol = {};
                                let newCellsPerSquare = {};
                                let newCells = {};
                                // Note cells per label is unaffected by rotation.

                                // row by row
                                for(let oldR=1; oldR<10; oldR++){

                                    // The new column number is  (10-old row) . So row 1 => col 9, r2 > c8 etc.
                                    let newC = 10-oldR;
                                    newCellsPerCol[newC] = this.analysis.cellsPerRow[oldR];
                                };
                                // col by col
                                for( let oldC=1; oldC<10; oldC++){
                                    // The new row number is the old column number. So column 1 => row 1 etc.
                                    let newR = oldC;
                                    newCellsPerRow[newR] = this.analysis.cellsPerCol[oldC]
                                };
                                // square by square
                                ["A", "B", "C"].forEach(oldRG=>{
                                    let newCG = ( oldRG=="A"?"C": oldRG=="B"? "B" : "A");
                                    
                                    ["A", "B", "C"].forEach(oldCG=>{
                                        let newRG = oldCG;
                                        newCellsPerSquare[newRG + newCG] = this.analysis.cellsPerSquare[oldRG + oldCG];
                                        
                                    })
                                });

                                // change the row and column number on every cell
                                for(let oldR=1; oldR<10; oldR++){
                                    for( let oldC=1; oldC<10; oldC++){
                                        let newC = 10-oldR;
                                        let newR = oldC;
                                        let oldKey = cellKey( oldR, oldC);


                                        let cell =  this.analysis.cells[oldKey];
                                        cell.r=newR;
                                        cell.c=newC;
                                        newCells[cell.key] = cell;

                                    }
                                }

                                this.analysis.cells = newCells;
                                this.analysis.cellsPerCol = newCellsPerCol;
                                this.analysis.cellsPerRow = newCellsPerRow;
                                this.analysis.cellsPerSquare = newCellsPerSquare;

                                // Reconstruct grid
                                for(let r = 1; r<10; r++){
                                    
                                    let sRowDef = "";
                                    let rowCells = this.analysis.cellsPerRow[r].sort((a,b)=>{ return a.c-b.c; });
                                    this.rows[r] = {};
                                    rowCells.forEach(cell=>{

                                        sRowDef += cell.label;
                                    })

                                    this.grid[r]=sRowDef;

                                }

                                log.object("Reconstructed grid after rotation", this.grid );

                                this.validate();

                                this.findAllTriplets();

                            };
                            findAllPairs(){

                            }



                            findAllTriplets(){
                                
                                // Create the list of triplets
                                this.analysis.allTriplets = [];
                                this.analysis.hTriplets = [];
                                this.analysis.vTriplets = [];
                                log.object("cellsPerRow", this.analysis.cellsPerRow)

                                
                                for(let xx = 1; xx < 10; xx++ ){
                                    let cpr = this.analysis.cellsPerRow[xx];
                                    let cpc = this.analysis.cellsPerCol[xx];
                                    log.object(`cellsPerRpw[${xx}]`, cpr);

                                    tripRCs.forEach(rc=>{
                                        let a = cpr[rc.a-1].label;
                                        let b = cpr[rc.b-1].label;
                                        let c = cpr[rc.c-1].label;
                                        let abc = [a,b,c].sort();
                                        let newTriplet = { key: abc.join(''), hv: "h" , a, b, c };
                                        this.analysis.allTriplets.push(newTriplet);
                                        this.analysis.hTriplets.push(newTriplet);

                                        a = cpc[rc.a-1].label;
                                        b = cpc[rc.b-1].label;
                                        c = cpc[rc.c-1].label;
                                        abc = [a,b,c].sort();
                                        newTriplet = { key: abc.join(''), hv: "v" , a, b, c };
                                        this.analysis.allTriplets.push(newTriplet)
                                        this.analysis.vTriplets.push(newTriplet);

                                    })

                                }

                                let htbk = this.analysis.hTripletsByKey = {};
                                let vtbk = this.analysis.vTripletsByKey = {};
                                let tbk = this.analysis.tripletsByKey = {};
                                let hTCount=0;
                                let vTCount=0;
                                this.analysis.hTriplets.forEach(trip=>{
                                    if( ! tbk[trip.key] ){ tbk[trip.key] = 1;  }else{ tbk[trip.key]++ };
                                    if( ! htbk[trip.key] ){ htbk[trip.key] = 1; hTCount++; }else{ htbk[trip.key]++ };
                                });
                                this.analysis.vTriplets.forEach(trip=>{
                                    if( ! tbk[trip.key] ){ tbk[trip.key] = 1;  }else{ tbk[trip.key]++ };
                                    if( ! vtbk[trip.key] ){ vtbk[trip.key] = 1; vTCount++  }else{ vtbk[trip.key]++ };
                                });

                                this.analysis.tripletsCount = {v:vTCount, h:hTCount}; 

                                this.analysis.frequencyOfTriplets = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];
                                
                                let tKeys = Object.keys(this.analysis.tripletsByKey);
                                tKeys.forEach(k=>{
                                    let count = this.analysis.tripletsByKey[k];
                                    this.analysis.frequencyOfTriplets[count]++
                                })
                                this.analysis.tripletSignature =  this.tripletSignature = this.analysis.frequencyOfTriplets.join(".");
                            }


                            findAllFrames(){
                                let allFrames=[];
                                this.analysis.linkKeyList={};
                                let labs = Object.keys( this.analysis.cellsPerLabel );
                                //log("labs", labs);
                                labs.forEach(lab=>{
                                    let ff = this.findFramesForLabel(lab);
                                    allFrames = allFrames.concat(ff);
                                });
                                this.analysis.allFrames = allFrames;
                                return allFrames;
                            };



                            /** =========================================================================== findFramesForLabel
                            * Scans the grid to derive details of all frames. A frame is
                            * defined by any four cells in the grid in positions
                            * rAcB, rCcD, rAcD, rCcB where the cells in rAcB and rCcD
                            * contain the same label, marked # in this diagram.
                            *            B         D
                            *      .....:_:.......:_:.....
                            *     A.....|#|.......|X|.....
                            *           : :       : :
                            *           : :       : :
                            *      .....:_:.......:_:.....
                            *     C.....|Y|.......|#|.....
                            *           : :       : :
                            * 
                            * The cells are CB and AD are denoted "link" cells.
                            * Frames are classified as follows
                            * - If the link cells AD and CB have the same label (i.e. X=Y), this is a "TWIN" frame
                            * - If the rows A & C or cols B & D are in the same 3-group, this is a "LOCAL" frame
                            * - The labels XY identify the "group" to which the frame belongs.
                            */
                            findFramesForLabel(lab){
                                let lkl = this.analysis.linkKeyList;
                                let cellsForLab = this.analysis.cellsPerLabel[lab]
                                //log.object( `cellsForLab [${lab}]`, cellsForLab )
                                let frames=[];

                                // Process each cell for the current label. 
                                cellsForLab.forEach(cell1=>{
                                    // ignore row 9
                                    if(cell1.r == 9) return;
                                    // get row and column of the main cell
                                    let ra = cell1.r;
                                    let tca = cell1.c;
                                    
                                    // Process every cell that has a higher row number
                                    cellsForLab.forEach(cell2=>{
                                        if(cell2.r <= cell1.r) return;
                                        // get row and column of the frame end cell
                                        let rb = cell2.r;
                                        let tcb = cell2.c;

                                        // create keys for the two linking cells and
                                        // get the cells from cells collection
                                        let linkAkey = `r${ra}c${tcb}`;
                                        let linkBkey = `r${rb}c${tca}`;
                                        let linkCellA = this.analysis.cells[linkAkey];
                                        let linkCellB = this.analysis.cells[linkBkey];

                                        // create the frame
                                        let frame={

                                            label: lab,
                                            fromCell: cell1,
                                            toCell: cell2,
                                            linkA: linkCellA,
                                            linkB: linkCellB,
                                            fromToKey: cell1.key + cell2.key

                                        };

                                        // Construct link key label, linklabel1, linklabel2
                                        // Check which label is larger, use this first in the frame link key.
                                        let agtb = linkCellA.label > linkCellB.label;
                                        // The link key is the label of the owning cell, followed by the labels of the two link cells ordered with larger first
                                        let flk = frame.linkKeyParts = [cell1.label, agtb? linkCellA.label : linkCellB.label, agtb? linkCellB.label: linkCellA.label ] ;

                                        // This is a twin link if the two linking cells have matching labels
                                        frame.twin = linkCellA.label == linkCellB.label? "T":"N";
                                        // This is a home link if either the rows of the from-to cells are in the 
                                        // same row group.
                                        frame.home = cell1.rg == cell2.rg || cell1.cg == cell2.cg? "H": "D"
                                        // The groupKey is 
                                        let gk = frame.groupKey = ("" + flk[1]) + flk[2];
                                        let lk = frame.linkKey = ("" + flk[0]) +  gk;

                                        // save the frame
                                        frames.push(frame);

                                        // Increment the link key count
                                        if( lkl[lk] ) {lkl[lk]++} else { lkl[lk]=1};
                                    });
                                });

                                return frames;
                            };


                            calcFrameSummary(){
                                let summary = {
                                    1:   [0,0,0,0,0,0,0,0,0]
                                    , 2: [0,0,0,0,0,0,0,0,0]
                                    , 3: [0,0,0,0,0,0,0,0,0]
                                    , 4: [0,0,0,0,0,0,0,0,0]
                                    , 5: [0,0,0,0,0,0,0,0,0]
                                    , 6: [0,0,0,0,0,0,0,0,0]
                                    , 7: [0,0,0,0,0,0,0,0,0]
                                    , 8: [0,0,0,0,0,0,0,0,0]
                                    , 9: [0,0,0,0,0,0,0,0,0]
                                    
                                }
                                

                            }



                            report(){
                                log( `=====================\nGrid ${this.id}`);
                                log( util.inspect(this.grid) );
                                log( util.inspect(this.analysis) );
                            }

                            reportGrid(){
                                log( `=====================\nGrid ${this.id}`);

                                for (let x=1; x<10 ; x++){
                                    log(this.grid[x-1]);
                                    
                                }
                                log("-------------------------");
                            }

                            /**
                            * Constructor for a GRID object
                            * @param {parameters} param0 
                            */
                            constructor ( params = {} ){
                                log("GRID>constructor", params)

                                let { id , cloneFrom, name, gridSpec } = params;

                                if( gridSpec ){
                                    log("loading from gridSpec");
                                    this.loadFromGridSpec( gridSpec );
                                    return this;
                                }

                                this.analysis.cells = {};

                                this.analysis.cellsPerLabel = {};
                                delete this.grid;

                                let newGrid;

                                this.id= id? id: getUID();

                                if(cloneFrom) {
                                    newGrid = simpleClone( cloneFrom.grid )
                                } else if( name ){
                                    let gg = simpleClone( getGridByName(name) ) ;
                                    if(gg){
                                        newGrid = gg.grid;
                                    } else {
                                        newGrid = simpleClone( getGridByID("base") ) ;
                                    }
                                };

                                if(newGrid) this.loadFromGrid( newGrid );

                            }
                        }

// =============================================================================
// END OF CLASS DEFINITIONS
// =============================================================================

module.exports.GRID = GRID;


log("Loading grids into indexes")

// grids is an array
const grids = gridsDB.grids;
const gridIDIndex = {};
const gridGSIndex = {};
const gridNAMEIndex= {};

// Load the grids from the Database
grids.forEach( gridSpec=>{
    let ng = new GRID( { gridSpec } );
    console.log("adding: ", ng.id)
    insertGridIntoIndex( ng );
})

log("Finished loading grids into indexes")

function newID(){
    let id;
    do {
        id = getUID().substring(6,12);
    } while ( gridIDExists(id) );
    return id;
}


function saveGridsDB(){
    log("saveGridsDB");

    // create a new array to hold all grids
    let newGrids = getAllGridSpecs();
    // Report the array of grids
    //log.object("newGrids", newGrids);

    // replace the grids object in gridsDB
    gridsDB.grids = newGrids;

    let dts = GLOB.util.dts();
    gridsDB.info = { dts };

    // get path to the file that is to receive the serialised json
    let newGridsPath = GLOB.ROOT + `/data/DB/GridsDB.json`;
    log.object("newGridsPath", newGridsPath)

    // save the whole file (asynchronous)
    fs.writeFile( newGridsPath, JSON.stringify( gridsDB, null,  4) , (err)=>{
        if(err) throw err;
        log("GridsDB has been saved");

        // Add create a backup here

    }  );

}

function insertGridIntoIndex(grid){

    let id = `ID.${grid.id}`;
    gridIDIndex[id] = grid;

    let gs = `GS.${grid.gridString}`
    gridGSIndex[gs] = grid;

    let n = `N.${grid.name}`;
    gridNAMEIndex[n] = grid;

    log(`Added grid ${id} to index`);
    return grid;
};

function addGrid(grid){
    if( grid.constructor.name != "GRID" ) throw new Error("Added object must be class GRID");
    if( ! grid.analysis.isValid ) throw new Error("Grid to add had not been validated");

    insertGridIntoIndex(grid);

    // Save the grids definitions to the database
    saveGridsDB();

    log("GridsDB saved to ")

}

function getAllGridsList(){
    let ids = Object.keys( gridIDIndex ).sort();

    let gridsList = [];
    ids.forEach(id=>{
        let gg = gridIDIndex[id]
        gridsList.push( gg );
    })
    return {gridsList};
}

module.exports.getAllGridsList = getAllGridsList
module.exports.getGridByID = getGridByID;
module.exports.getGridByGridString = getGridByGridString
module.exports.allGrids = getAllGrids;
module.exports.gridStringExists = gridStringExists;
module.exports.addGrid = addGrid;

function cellKey(r,c){ return `r${r}c${c}`};
function rcg(x){ return (x<4?"A":x<7?"B":"C")};
function rcGroupKey( r,c ){
    return rcg(r) + rcg(c) ;
}

function bumpCounter( counters, key){
    if(!counters[key]){counters[key]=1} else {counters[key]+=1}
};

/**
 * 
 * @returns Index of all grids, by ID;
 */
function getAllGrids(){
    return gridIDIndex;
}

// Returns an array of gridSpecs for all the grids in order of ID
function getAllGridSpecs(){
    
    // create a new array to hold all grids
    let gridSpecs = [];

    // get the keys of all the grids in the ID index
    let keys = Object.keys(gridIDIndex).sort();

    // add every grid to the new array
    keys.forEach(key=>{
            log(`Saving grid ${key}`);
            let grid = gridIDIndex[key];
            if(!grid) { 
                log(`...Could not find grid ${key}`)
            } else {
                gridSpecs.push(grid.gridSpec());
            }
    });

    return gridSpecs;
}

function getGridByName(name){
    
    let key=`N.${name}`;
    if(!gridNAMEIndex[key]){
        //throw new Error( `gridsDB: Grid with id ${id} not found`);
        return null;
    }
    return gridNAMEIndex[key];

};

function getGridByID(id){
    let key=`ID.${id}`;
    if(!gridIDIndex[key]){
        //throw new Error( `gridsDB: Grid with id ${id} not found`);
        return null;
    }
    return gridIDIndex[key];

};

function gridIDExists(id){
    let key=`ID.${id}`;
    return  ( gridIDIndex[key]? true : false );
};

function gridStringExists(gs){
    let key=`GS.${gs}`;
    return  ( gridGSIndex[key]? true : false );
}

function getGridByGridString(gs){
    let key=`GS.${gs}`;
    if(!gridGSIndex[key]){
        //throw new Error( `gridsDB: Grid with gridstring ${gs} not found`);
        return null;
    };

    return gridGSIndex[key];

};


// function saveGrid(pg){
//     let g = GLOB.util.simpleClone(pg);
//     let id = pg.id;
//     if(!id) g.id = id = getUID();

//     grids[id]=g

//     // TODO **********  R Write the grids array out to a json text file.

//     return g;
// }

//const idSelector = [0,10,20,30,40,50,60,70,80]
function generateIdFromGridString(gs){
    let newID = "";
    idSelector.forEach(n=>{
        newID+=gs.charAt(n);
    });
    log("generated ID:", newID);
    return newID;
};



// const defaultGrid = {
//           "1": "534 678 912"
//         , "2": "672 195 348"
//         , "3": "198 342 567"
//         , "4": "859 761 423"
//         , "r": "426 853 791"
//         , "6": "713 924 856"
//         , "7": "961 537 284"
//         , "8": "287 419 635"
//         , "9": "345 286 179"
// };

/**
 * Performs shape analysis of the grid
 * @param {*} grid 
 */
function analyzeGrid( grid ){
    if(!grid.validate()){
        log( `Cannot analyse invalid grid [${grid.id}]`);
        return null;
    };
    let gridPattern = "";


    // Extract all the frames
    let allFrames = grid.analysis.allFrames;

    // for( var r=1; r<10; r++){
    //     let rowCells = grid.rowCells(r);

    // }

    log("Grid analysis not completed")
}


/**
 *  ///////////////////////////////////////////////////// TESTING
 */
function cloneTest(){
    let simpleClone = GLOB.util.simpleClone;
    let testGrid = new GRID();
    let grid = testGrid.grid;

    let clonedGrid = simpleClone(grid);

    clonedGrid[2] = "987654321"
    log.object( "original grid", grid );
    log.object( "cloned grid", clonedGrid );

};


function rotateTest(){


    let testGRID = new GRID( {name: "base"} );
    //log("base", testGrid.grid);

    //analyzeGrid(testGRID );

    //log.object("linkKeyList 0", testGRID.linkKeyList);
    log.object("Grid before rotation", testGRID.grid);
    testGRID.rotateR();
    //analyzeGrid(testGRID );

    //log.object("linkKeyList 1R", testGRID.linkKeyList);

    log.object("Grid after rotation 1", testGRID.grid);
    testGRID.rotateR();
    //analyzeGrid(testGRID );

    log.object("Grid after rotation 2", testGRID.grid);
    //log.object("linkKeyList 2R", testGRID.linkKeyList);

    //console.log(testGRID.allFrames);

    log.object("Row 1", testGRID.rows(1) );
    log.object("Col 4", testGRID.cols(4) );

    require( "../GLOB/logSubscriptionManager" ).logToFile();
    log.object("All frames", testGRID.analysis.allFrames );
}

/** -------------------------------------------------------------------------------------------------
 *
 */
function frameChainTest(){
    let testGRID = new GRID( {name: "base"} );
    
    require( "../GLOB/logSubscriptionManager" ).logToFile();
    let allFrames = testGRID.allFrames;
    
    //log.object("All frames", allFrames );

    let allChains = {};
    let chainsByLabel = {};
    let chainNum = 0;
    let chainsPerLabel = {};
    log(`There are ${allFrames.length} frames in total`)
            

    //-------------------------------------------------------------------
    for(let rowA=1; rowA<9; rowA++){
        for(let rowB = rowA+1; rowB<10; rowB++){
            let rUpper = testGRID.cellsPerRow[rowA];
            //log.object(`Row ${rowA}`, rUpper);
            let rLower = testGRID.cellsPerRow[rowB];
            //log.object(`Row ${rowB}`, rLower);
            let frameIndex = {};

            // Find the frames whose fromCell is on RowA and toCell is on RowB
            // There will be 9 frames, one for each different label
            allFrames.forEach( frame=>{
                if(frame.fromCell.r==rowA) if(frame.toCell.r==rowB) {
                    let fromLabel = frame.fromCell.label;
                    frameIndex[fromLabel]=frame
                }
            })
            log.object(`frameIndex ${rowA}>${rowB}`, frameIndex);
            let chainsFor2Rows = {};
            let labels = Object.keys(frameIndex);
            labels.forEach(label=>{ chainsPerLabel[label]=[]; });
            labels.forEach(label=>{

                let chainStart = frameIndex[label];

                if(!chainStart.inChain){
                    
                    chainNum+=1;
                    //log.object(`Starting chain ${chainNum} with label ${label}`, chainStart)
                    chainStart.inChain = chainNum
                    let newChain = allChains[chainNum] = chainsFor2Rows[chainNum] = [];
                    newChain.push(chainStart);

                    let chainNext = frameIndex[chainStart.linkA.label];
                    while(chainNext.label != chainStart.label){
                        chainNext.inChain = chainNum;
                        //log.object(`Adding frame ${chainNext.label}`, chainNext)
                        chainsFor2Rows[chainNum].push(chainNext);
                        chainNext = frameIndex[chainNext.linkA.label];

                    }
                }
                
            });

            //log.object(`Chains R${rowA}R${rowB}`, chains);
            let keys = Object.keys(chainsFor2Rows);
            let chainCount = keys.length;
            let report = `${rowA}>${rowB}: ${chainCount} chains:`
            keys.forEach(key=>{
                let chain = chainsFor2Rows[key]
                report += ` ${chain[1].label}(${chain.length})`
            })
            log( report );
        };
    };





    log.object(`allTriplets count=${testGRID.allTriplets.length}`, testGRID.allTriplets)
    log.object(`htripletsByKey, count=${testGRID.tripletsCount.h}`, testGRID.hTripletsByKey )
    log.object(`vtripletsByKey, count=${testGRID.tripletsCount.v}`, testGRID.vTripletsByKey )
    log.object(`tripletsByKey`, testGRID.tripletsByKey );
    log.object(`frequencyOfTriplets`, testGRID.frequencyOfTriplets);
    log(`Triplet signature A`, testGRID.tripletSignature);
}

rotateTest();

// require( rootify("ROOT/GLOB/logSubscriptionManager") ).logToFile();

// //saveGridsDB();
// //frameChainTest();
// let id = newID();

// let newGrid = new GRID();

// newGrid.loadFromGridString("123456789456789123789123456234567891567891234891234567345678912678912345912345678");


// let result = addGridToIndex(newGrid);

//saveGridsDB();
//let g = getGridByName("base");
//grids.forEach(g=>{
    ////log( g.id, generateIdFromGridString(g.gridString) , g.gridString);
//})

//addGrid( new GRID() );

console.log("##<< GridsDB.js")