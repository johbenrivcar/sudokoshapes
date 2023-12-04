"use strict";
const util = GLOB.util;

module.exports.getDivData = getDivData;

const dataFolder = GLOB.settings.paths.folders.data 
const gridsDB = require( dataFolder + "gridsDB.js" )


async function getDivData( ws, msg, replyMsg ){
    let {date: sDate, time: sTime} = util.dateAndTime();
    let divNonce = getNonce()
    let gridsList = gridsDB.getAllGridsList().gridsList;
    let divData = {
         divNonce
        , sDate
        , sTime
        , gridsList
    }
    return divData;
}

function getNonce(){
  return GLOB.util.nonce();
};