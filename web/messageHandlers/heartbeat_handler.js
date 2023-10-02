/*
    handles the request to start a heartbeat from a browser. Once started
    the heartbeat is repeated every 10 seconds, until the connection is 
    broken.
    
*/

const log = GLOB.util.logger.getLogger( "heartbeat_handler" );
const globUtil = GLOB.util;


module.exports.handleMessage = handleMessage;

async function handleMessage( ws, msg, replyMsg ){

    log(">> handleMessage");
    let tickNumber = 0;
    let cnxNumber = ws.serverInfo.connectionNumber;
    replyMsg.msgType = "heartbeat";
    
    function heartBeat(){
        log("HB", cnxNumber, tickNumber);
        if( ws.sessionHasClosed ){
            log(`Session #${cnxNumber} has closed - heartbeat stopping`);
            return;
        }

        tickNumber++;
        replyMsg.hhmmss = globUtil.hhmmss();
        replyMsg.tickNumber = tickNumber;

        if( !replyMsg.send() ){
            log(`Heartbeat stopped on #${cnxNumber}`)
            return;
        }
        // successfully sent, so schedule the next heartbeat
        setTimeout( heartBeat, 10000 );
        return;
        

    }

    heartBeat();


}