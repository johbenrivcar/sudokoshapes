/*

    Provides the primary point at which incoming websocket messages
    are handled, to identify the type of message, carry out session
    validation, load the specific message type handler and pass the
    message to that handler for processing.

*/
const GLOB = require( "../GLOB/GLOB");

const log = GLOB.util.logger.getLogger( "wsController" );

const gGLOB = GLOB

const globalUtil = GLOB.util;

// Encryptor for cookies
const cryptr = require( "cryptr");

// get the dynamic module loader (for loading ws message handling modules)
const dynamic = globalUtil.mLoad.dynLoad;

// Load the session manager
const sessionManager = require(GLOB.ROOT + `/session/sessionManager`);

const getUID = globalUtil.getUID;

log( "Session manager module loaded")

module.exports.newWSConnection = newWSConnection;
module.exports.handleWSMessage = handleWSMessage;
module.exports.reportCaches = reportCaches;


// Cache of browsers and session data
var browsers ={};
var sessionInfos = {};
var wsConnectionNumber = 0;
var wsContexts = [];

function reportCaches(){
    log("================================== CACHE REPORT ========================")
    log("browsers", browsers);
    log("browserSessionKeys", browserSessionKeys);
    log("sessionInfos", sessionInfos);
    
    log("============================== END CACHE REPORT ========================")
}


/**
 * Establishes a new websocket connection with a client browser/app. We have to
 * validate the connection by checking that the supplied browserUID and 
 * cookie match. The cookie is encrypted based on a private key saved at the
 * server and associated uniquely with the browser. If the browser has no cookie,
 * then the server will supply a new browser UID and set the cookie to match it
 * with a new encryption key.
 * @param {Websocket} newWS 
 * @param {Request} req 
 */
async function newWSConnection( newWS, req ){
    try{

        // get a new unique connection number.
        let thisNumber = ++wsConnectionNumber;

        // set server information store on ws, this data is invariate
        newWS.serverInfo = {
            connectionNumber: thisNumber
            , serverURL:  req.headers.origin
            , encrKey : getUID().substr(3, 20)
            , wsUID: getUID()
        };
        
        log("ServerURL", newWS.serverInfo.serverURL );


        log( `>>newWSConnection #${ thisNumber } - Origin: ${ newWS.serverInfo.serverURL }`);
        log( "req.params", req.params);

        // Get the browserUID, sessionUID and parentSessionUID from the route
        let{ browserUID: brwUID
            , sessionUID: ssmUID
            , parentSessionUID: parssmUID } = req.params;
        
        let ssmXUID = brwUID + "_" + ssmUID;
        let parssmXUID = brwUID + "_" + parssmUID;

        log(".. parent session xuid: ", parssmXUID );
        

        // add our own context object to the websocket
        // this is used to carry session status information.
        // Initially, this is set to a simple anonymous session
        // but these will be changed by the sessionManager if
        // a different session context is to be inherent.


        newWS.sessionInfo = { 

            connectionNumber: newWS.serverInfo.connectionNumber
            , wsUID: newWS.serverInfo.wsUID
            , brwUID: brwUID // this never changes on a session
            , ssmUID: ssmUID // this never changes on a session
            ,  ssmXUID
            ,  parssmUID
            ,  parssmXUID
            , mgsRole: "ANON"
            , mgsPerms: [ "ANON" ]

        };
        newWS.sessionHasClosed = 0;

        log.object( "INITIAL SESSION INFO ON NEW WS", newWS.sessionInfo )

        // Function attached to the websocket that we can use
        // to send a message to the client app. The function 
        // accepts a js object and converts it to a JSON string,
        // then sends it to the client at the other end of the 
        // connection.
        newWS.sendJSON = async function( data ){
            // check that the websocket is OK to send data
            // and return false if not to indicate failure
            if (newWS.readyState != 1) { return false; };

            //console.log("[sendJSON] sessionHasClosed:", newWS.sessionHasClosed);

            if(newWS.sessionHasClosed) { return false; };

            if( typeof data !== "object" ) data = { data };

            // add the connection number to the data
            data.connectionNumber = newWS.serverInfo.connectionNumber;

            // convert the js object to a JSON string
            let json = JSON.stringify( data );

            // send the JSON string to the client through
            // the websocket.
            await newWS.send( json );

            data.hasBeenSent = true;
            // indicate success to the caller
            return true;
        };
        
        newWS.sendSessionInfo = function(msgType = "session-info"){
            //log("sending session info")
            msg = {
                msgType: msgType
                , sessionInfo: newWS.sessionInfo
            };
            //log.object( "msg", msg );
            newWS.sendJSON(msg);
            //log("session info was sent");
        };
        
        // Register a function to handle an incoming message
        // on this websocket.
        newWS.on('message', (msg) => {
                handleWSMessage( newWS, msg );
            }
        );

        newWS.on("close", ()=>{    
            //log(`#${newWS.serverInfo.connectionNumber} has closed`)
            // TODO process websocket closure (put session to sleep)

            sessionManager.closeWebsocketConnection( newWS );
            // TODO remove session information from caches

            newWS.sessionHasClosed = true;


        } );

        // // Se
        // thisws.sendSessionInfo = function sendSessionInfo () {
        //     log(`>> #${thisws.serverInfo.connectionNumber} sendSessionInfo` );
        //     thisws.sendJSON( {
        //         msgType: "session-info"
        //         , sessionInfo: thisws.sessionInfo 
        //     }   );

        // }

        // Call the session manager session setup function
        // for a new websocket. THIS IS AN ASYNC FUNCTION
        sessionManager.newWebsocketConnection( newWS, req );

        //log("New WS Connection set up started, sessionInfo: ", newWS.sessionInfo);
        //reportCaches();
        return;

    } catch(e) {
        log.error("ERROR setting up new WS connection: "); 
        log.error(e );
    }


};




/**
 * Called to process an incoming message from a websocket connection.
 * The 
 * @param {*} ws - The websocket through which the message was received
 * @param {*} rawmsg - The message as received directly from the websocket (JSON)
 */
async function handleWSMessage( ws, rawmsg ){
    log( `>>#${ws.serverInfo.connectionNumber} handleWSMessage` );

    // The message is a JSON string representing a JS object
    // Note: Technically it can be any string at all. We are 
    //       using JSON only as a convention.

    // Call parsewsmessage to convert the JSON String into a JS
    // object. This function correctly parses dates, and we may
    // add other private application data type parsing as required.
    let wsmsg = globalUtil.parseWSMessage(rawmsg);

    log("!Incoming ws msg, msgType:", wsmsg.msgType);
    
    // TO DO HERE
    //      *   check the incoming message sessioninfo to see that
    //          there is a valid session.
    //      *   if not, then we need to establish the best session
    //          possible, based on content.
    

    // Now route the message to the message handler corresponding
    // to the message type in msgType

    let msgType = wsmsg.msgType.toLowerCase();
    let handlerPath = `${GLOB.settings.paths.folders.messageHandlers}${msgType}_handler.js`;
    log(`Handler: ${handlerPath}`);

    let replyMsg ={
        callbackKey: ( wsmsg.callbackKey? wsmsg.callbackKey : "" )
        ,   msgType: ( wsmsg.replyTo? wsmsg.replyTo : undefined  )

    };

    // client data, if any, is returned in the reply message
    if(wsmsg.clientData) replyMsg.clientData = wsmsg.clientData;

    // set up a callback function on the replyMsg to send itself
    // (this can be called in the handler)
    replyMsg.send = async function(){ return await ws.sendJSON( replyMsg ); };


    // now try running the handler
    try{
        
        // dynamic load of the handler module. This means that
        // if any source code changes are made to the handler
        // since the last load, then the handler will be re-loaded
        let handler = dynamic( handlerPath );

        // make sure we have a function to handle the message
        // exported by this module - handleMessage(websocket, incomingMessage, replyMessage)
        if( ! ( typeof handler.handleMessage === "function" ) )
            throw new Error( 
                `Message handler for [${msgType}] does not implement handleMessage function` 
            )
        ; // end if

        // now call the handler passing the socket, the incoming
        // message and the reply message. Note this can be async
        await handler.handleMessage( ws, wsmsg, replyMsg );

    } catch(e){

        // There is some sort of error thrown when trying to
        // handle the incoming message
        log.error( `#${ws.serverInfo.connectionNumber} ------------- ERROR HANDLING WS MESSAGE\n`, e.message);
        log.object("error", e)
        // Send an error message to the client (for information only)
        replyMsg.msgType = "error";
        replyMsg.originalMsgType = msgType;
        replyMsg.eMessage = e.message ;
        replyMsg.info = e;
        replyMsg.html = "<pre>" & e.message & "</pre>"
        replyMsg.send();

    }
};



log( "## wsController module loaded" );
