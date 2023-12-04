"use strict";


const globUtil = GLOB.util;
// const getUID = globUtil.getUID;

// const pugLoader = globUtil.pugLoader;

const log = globUtil.logger.getLogger( "validategrid_loader" );

module.exports.getDivData = getDivData;
module.exports.parseInput = parseInput;

// The msg contains the following data
//  gridString: A string holding 9 lines of 9 digits representing a completed grid
//  gridName: A text string subitted by the user as the name to be used to refer to this grid in the index
async function getDivData( ws, msg, replyMsg ){
  let dts = (new Date() ).toISOString();
  let [sDate, sTime] = dts.split(".")[0].split("T");
    
  msg.errorList= [ ]

  parseInput( msg )


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

  return divData;

}

/**
 * 
 * @param {string} msg The raw input by the user into a textarea control on the form.
 */
function parseInput( msg ){
    log(">parseInput msg:", msg)
    let outRows = [];
    let outCols = [];
    let inLines = msg.divData.txtInput;
    let errors = msg.errorList;
    let lineIx = -1;

    inLines.forEach( (line)=>{
        let txtLine = "" + line
        //log(`Processing line #${txtLine}# which has length ${txtLine.length}`);
        if( txtLine.length > 0 ){
            lineIx++; 
            log(`L${lineIx}`, txtLine);
            let chars = txtLine.split('');
            let rGrp3 = []
            let rGrpCount = 0;
            let chCount = 0;
            let colIx = -1;

            chars.forEach( char=>{
                if(char!=" "){
                    chCount++;
                    colIx++;

                    if(! outCols[colIx] ) outCols[colIx] = [];
                    let col = outCols[colIx];

                    let colGrpIx=lineIx>5?2: lineIx>2? 1 : 0;

                    if(! col[colGrpIx] ) col[colGrpIx] = "";
                    col[colGrpIx] += char;

                    if(chCount==1){
                        rGrp3[rGrpCount]=char;
                    } else
                    if(chCount>3){
                        chCount=1;
                        rGrpCount++;
                        rGrp3[rGrpCount]=char;
                    } else {
                        rGrp3[rGrpCount]+=char;
                    }
                }
            })
            outRows[lineIx]=rGrp3;
            
        }
    })


    let isValidSoFar = true;
    let errorCount = 0;

    if( outRows.length != 9) { isValidSoFar = false; errorCount++; errors.push( {description: `Must have 9 lines exactly`}) };
    log("ROWS", outRows);
    log("COLS", outCols);

    outRows.forEach((line, ix)=>{
        if(line.length !=3 ){ 
            isValidSoFar = false; 
            errorCount++; 
            errors.push( {description: `[${ix+1}] Must be 3 groups of 3 chars`})}
        else {
            line.forEach( (grp, grpIx)=>{
                if(grp.length!=3){
                    isValidSoFar = false; 
                    errorCount++; 
                    errors.push( {description: `[${ix+1}] Length of each group must be 3 chars`})
                };
            });
        };

    });

    if(isValidSoFar){
        outRows.forEach((line,ix)=>{
            let str = line.join('').split('').sort().join('');
            if(str!="123456789"){
                isValidSoFar=false; errorCount++; 
                errors.push( {description: `Line ${ix+1} Must contain all of the digits 1-9`})
            }
        })
        outCols.forEach((col,ix)=>{
            let str = col.join('').split('').sort().join('');
            if(str!="123456789"){
                isValidSoFar=false; errorCount++; 
                errors.push( {description: `Col ${ix+1} Must contain all of the digits 1-9`})
            }
        })
    }


    if(isValidSoFar) errors.push({description: `No errors!`});

    msg.rows = outRows;
    msg.errorCount = errorCount;

    let parsedInput = [];
    outRows.forEach(row=>{
        parsedInput.push( row.join(" "));
    });
    parsedInput = parsedInput.join(`\n`);
    msg.parsedInput = parsedInput;
    msg.cols = outCols;

}