"use strict";

module.exports.getDivData = getDivData;

function getDivData( ws, msg, replyMsg ){
  let dts = (new Date() ).toISOString();
  let [sDate, sTime] = dts.split(".")[0].split("T");

  return {
      date: sDate
      , time: sTime
  }
}