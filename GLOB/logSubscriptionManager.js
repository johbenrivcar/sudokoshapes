/**
 * 
 *      This singleton module manages recording and reporting of log messages.
 *      It allows for websocket subscription to log messages from a browser.
 *      The module also writes log messages to disk. The log file location
 *      is given in the SKSSSettings.json file which is accessed through
 *      the settings.js module
 * 
 * *  Due to performance problems with sending individual log
 *      messages to subscribers, we are changing the logger to
 *      collect messages in batches and send them at 1s intevals
 * 
 */

    console.log("##>> logSubcriptionManager");

    const nullValue = Math.random() * 10000 + 1


    const rootify = GLOB.util.appRoot.rootify;
    const logger = GLOB.util.logger;
    const SKSUtil = GLOB.util;
    const paths = GLOB.paths;
    const EVENTS = GLOB.EVENTS;
    //const cLog = function(...params){ console.log("[LSM]", ...params)}

    EVENTS.on( "logger.context", contextChange )
    
    // array of websockets that are subscribing to the log messages
    var logSubscribers = [];
    var subscriberCount = 0;

    // array of log messages that have already been written. This is
    // kept so that when a browser connects to the log, part of the recent
    // log history can be sent to the browser immediately. The array is
    // trimmed back to 400 rows when it reaches 500.
    var backLog = [ "START OF BACKLOG" ];
    var chunks = [];
    var chunkTimerIsRunning = false;
    var stopChunkTimer = false;

    // Export functions to be used in logging
    //module.exports.log = log;
    module.exports.subscribe = subscribe;
    module.exports.logToFile = logToFile;
    module.exports.backLog = backLog;
    

    // Reference to the log file if any 
    var logFile = null;

    // const util = require( "../crossword/util");
    const util = require( "util" );

    //const log = util.getModuleLogger( "logManager" );

    // Register our log writer function with the console [logger] module. Once
    // registered, this function will be called whenever a message
    // is logged to the console.
    logger.onLog( incomingLog );

    /** EXPORTED
     *      Called to turn on/off logging to disk
     */
    function logToFile( params = {turnOn: nullValue, turnOff: nullValue} ){
        
        let turnOn, turnOff;
        ({turnOn, turnOff} = params);

        // Check for default values
        if(turnOn === turnOff === nullValue ) {turnOn=true; turnOff=false};


        if( turnOn && !logFile ){

            let logFilePath = rootify( paths.logFilePath ) ;
            console.log ( `logging to ${logFilePath}` );
            
            let fs = require('fs'); 
            let filename = logFilePath.replace( /\#dts\#/g, SKSUtil.dts() );

            console.log( `Creating output file for log: ${filename}`);

            logFile = fs.createWriteStream( filename , 'utf-8' );

        } else if ( turnOff && logFile ) {

            logFile.close();
            logFile = null;

        };

    }

    async function contextChange( evType, evData ){
        // let msg = {
        //     msgType: "contextChange"
        //     , msgData: evData

        // }

        // sendToSubscribers(msg)

    }

    /** EXPORTED
     * Reports the given list of arguments to the log file (if turned on) and
     * to all the subscribers who have registered.
     * @param  {...any} args 
     */    
    function incomingLog( ...argList ){
        
        let line = "";

        // Separately add each argument to the line. Objects are converted to string
        // using [inspect] function.
        argList.forEach( (arg, ix)=>{
            if( typeof arg === "string" ){
                line += arg + " " ;
            } else {
                line += util.inspect( arg ) + " ";
            }
        });

        // check if writing to disk
        // TODO move logging to disk into the logging module, and
        // have it driven by subscription to the log events.
        if( logFile ){
            logFile.write( '\n' + line )
        }

        // escape the gt and lt for html display
        line = line.replace( /</g, "&lt;" ).replace( />/g, "&gt;" );

        // reduce the size of the backlog array if more than 500 lines have been stored
        if (backLog.length > 500 ){
            // take the earliest 100 items off the list
            backLog.splice(0, 100)
        }

        // add the new line to the right-hand (latest) end of the backLog
        backLog.push( line );

        // add the new line to the current update chunk to be send on update loop
        chunks.push( line );


    }


    async function sendChunk(){
        //cLog("LOGGING - sendChunk, on timer. Chunks to send: ", chunks.length );

        if( chunks.length > 0 ){
            
            // serialise the chunk into a single block to be sent to all subscribers
            let logtext = chunks.join("<br>");

            // clear out the chunks
            chunks = [];

            //console.log( `[LogManager] THERE ARE ${logSubscribers.length} subscribers to the logManager`)
            let msg = {
                msgType: "logone"
                , logMsg: logtext
            };
            await sendToSubscribers(msg);

        };

        //cLog("stopChunkTimer:", stopChunkTimer, "subscriberCount:", subscriberCount)
        stopChunkTimer = stopChunkTimer || !subscriberCount;

        if(stopChunkTimer){
            chunkTimerIsRunning = false;
            stopChunkTimer = false;
            return false;
        };

        if(chunkTimerIsRunning ){
            setTimeout(sendChunk, 1000 );
            return true;
        };
    }


    async function sendToSubscribers(msg){
        ////cLog(">>sendToSubscribers..")
        // send the message to all the subscribers
        let subCount = 0;
        for( ix=0; ix<logSubscribers.length; ix++ ){
            let sbs = logSubscribers[ix];
       
        //logSubscribers.forEach( async (sbs, ix)=>{

            // make sure that the subscriber has the sendJSON function defined
            if( sbs && sbs!=="NULL" ) if( sbs.sendJSON ){
                // attempt to send the message using sendJSON 
                // with "logone" message type
                let res = await sbs.sendJSON( 
                        msg
                        , false // suppresses logging to avoid infinite loop
                    ) ;
                if( res ){
                    //cLog("Successfully sent to sbs #", ix )
                    subCount++;
                } else {
                    // if the send did not work (maybe the browser window was closed)
                    // then clear the subscriber from the list;
                    //cLog("Clearing sbs #", ix )
                    logSubscribers[ix] = "NULL" ;
                }
            } else {
                logSubscribers[ix] = "NULL" ;
            };
        } ;

        //cLog("Ended subscriber loop, subCount=", subCount);
        subscriberCount = subCount;
        if(subCount > 0) return true;
        
        //cLog("Resetting logSubscribers")
        if(logSubscribers.length > 0) logSubscribers = [];

        //cLog("Stopping chunk timer");
        stopChunkTimer = true;
        return false;

    };
    /** EXPORTED
     * Adds the given websocket to the subscribers list for logs
     * and sends the complete backlog to the subscriber
     * @param {*} ws 
     */
    function subscribe( ws ){
        // Check that the subscriber has the sendJSON method
        if( !ws.sendJSON ) return false;

        console.log(`[logManager] Adding websocket #${ws.connectionNumber} to the subscribers list;`);

        // Add the subscriber to the subscribers list
        // Find an empty element to the subscribers list, if any
        let emptyIX = logSubscribers.indexOf( "NULL" );
        if (emptyIX == -1){
            // no empty elements, so add the new subscriber to the end of the list
            logSubscribers.push( ws );
        } else {
            // use the empty element to hold the new subscriber.
            logSubscribers[emptyIX] = ws;
        }
        subscriberCount++;

        // Now prepare the complete backlog message to send to the new subscriber
        let backLogHtml = "";

        // Add all the backlog lines to the backlog message
        backLog.forEach( ddd =>{
            backLogHtml += ddd + "<br/>" 
        });

        // Construct the backlog message
        console.log(`[logManager] Sending backlog to #${ws.connectionNumber};`)
        let backlogMsg = {
            msgType: 'backlog'
            , backlog: backLogHtml
        };

        // Send the backlog message as JSON
        ws.sendJSON( 
            backlogMsg
            , false // suppresses logging to avoid infinite loop 
        );

        if( !chunkTimerIsRunning ) startChunkTimer();

    }

    function startChunkTimer(){
        if( chunkTimerIsRunning ) return false;
        

        setTimeout( sendChunk, 1000 );
        chunkTimerIsRunning = true;
        stopChunkTimer = false;

    }


    console.log("##<< logSubcriptionManager")