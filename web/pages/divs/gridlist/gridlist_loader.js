
module.exports.getDivData = getDivData;


function getDivData( ws, msg, replyMsg ){
    let dts = (new Date() ).toISOString();
    let [sDate, sTime] = dts.split(".")[0].split("T");

    return {
        grid1:{
              grid: {
                  r1: "123456789"
                , r2: "456789123"
                , r3: "789123456"
                , r4: "234567891"
                , r5: "567891234"
                , r6: "891234567"
                , r7: "345678912"
                , r8: "678912345"
                , r9: "912345678"
              }
            , info:{
                date: "2023-10-02"
                , category: ""
              }
            , analysis:{
                
            }


        }
    }
}