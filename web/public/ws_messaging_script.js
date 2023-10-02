
// dictionary of callback functions associated with messages sent to the server. When the
// server responds it will include the callbackKey that identifies the function to be called
// to process the server response.  Note that messages may also be handed to event handlers 
// depending on their msgType property.
const ws_messageCallback = {};

// status flags
var ws_Initialize_WebSocket_Done = false;

// local logging function used throughout code to log to the browser console.
const ws_log = console.log;

// Dictionary of message handlers to process incoming messages. When
// a message is sent, an message handling function can be optionally
// registered here to process the reply. A UID is used as the key
// to identify the handler function, and this UID is sent with the 
// outgoing message under the key 'responseHandler'. See ws_Send
var ws_msgHandlers = {};
var ws_msgHandlerData = {};
var ws_onReadyList = [];

ws_log("Message handler list has been created");

// The websocket object for sending messages to the server
var ws_websocket = null;

var ws_msgInCount = 0;
var ws_msgOutCount = 0;

// Flag indicating that the websocket connection is ready for use
var ws_IsReady = false;
// List of messages waiting to be sent when the websocket is ready
const ws_OutgoingQueue = [];
const ws_cookies = {};
var ws_userData = {};



// Regular expressions used to validate entries in form fields
const ws_int_regexp = /^[0-9]+$/g                 // regular expression to check integer value
const ws_dec_regexp = /^[0-9]+(\.[0-9]+)?$/g      // regular expression to check number, int or decimal

// regular expression to validate email addresses on input forms
const ws_emailRegexp = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/ ;

// >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
//#region --- Getting all the session UID information
/**
 *  This logic establishes the important identifiers of the
 *  session context. They are:
 *      brwUID - identifier for this browser instance
 *      ssmUID - identifier for the session in this browser window
 *      parssmUID - the identifier of an active session from
 *          which session credentials can be cloned. This is either
 *          a session that was running in the current browser window
 *          before this new session was opened, or a session running
 *          in a different window which was active just before this
 *          new window was opened. This provides the user with apparent
 *          session continuity, even when a new session is being created.
 *  These session identifiers are initially stored in a temporary object
 *  from which they are accessed by the ws_SessionController object.
 */
let ws_temp = {
    ssmUID: null
   , brwUID: null
   , parssmUID: null
};

// ********************
// Save the uid of the previous session in this window, if any:
ws_temp.parssmUID = sessionStorage.getItem("ssmUID");

// ********************
// Assign a new session UID 
// and save it in sessionStorage
ws_temp.ssmUID = ws_getUID();
sessionStorage.setItem("ssmUID", ws_temp.ssmUID);

// ********************
// Get the browser UID from localStorage. Assign a new 
// browser UID if there isn't one already there.
ws_temp.brwUID = localStorage.getItem("brwUID");

if( !ws_temp.brwUID ){
   ws_temp.brwUID = ws_getUID();
   localStorage.setItem("brwUID", ws_temp.brwUID );
};

// ********************
// If there was no parent session uid, then default to the last active
// session in this browser, if any.
if( !ws_temp.parssmUID ){
   ws_temp.parssmUID = localStorage.getItem("activeSessionUID");
   if(!ws_temp.parssmUID ){
       ws_temp.parssmUID = "XXXXXXXX";
   }
};

// Now save the ssmUID as the active session
// We may need to delay this till after the session has been established
// with the server.
localStorage.setItem("activeSessionUID", ws_temp.ssmUID )

ws_log(`Active session UID is ${ws_temp.ssmUID}`);

//#endregion
//>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>



// Definition of the global ws object, which holds
// references to published ws_ functions which can be called
// from any other scripts during operation of the application.
// Always use the form ws.function when calling externally
// instead of ws_function.
//
const ws = {
    simpleClone: ws_simpleClone
    , preprocessJSON: ws_preprocessJSON
    //, sendJSONRequest: ws_sendJSONRequest
    , setCookie: ws_setCookie
    , deleteCookie: ws_deleteCookie
    , cookies: ws_cookies
    , sessionController: null // see below
    , settings: {}
    , onReady: ws_onReady
    , getUID: ws_getUID
    , wsOn: ws_On
    , sendMessage: ws_sendMessage
    , userData: ws_userData
    , log: ws_log
    , closeSession: ws_closeSession
    , setSessionInfo: ws_setSessionInfoFromServer
    , closePopup: ws_closePopup
    , mergeUpdateAfromB: ws_mergeUpdateAfromB
    , goToHomeDiv: ws_goToHomeDiv
    , loadOneDiv: ws_loadOneDiv
    , loadSomeDivs: ws_loadSomeDivs
    , goToDiv: ws_goToDiv
    , temp: ws_temp
};



// ============================================================================================
/*
    This section implements the websocket connection to the server and provides functions for
    sending to and receiving messages from the server
*/
// ============================================================================================

var ws_hostName = window.location.hostname;

var ws_port = document.location.port;

// -----------------------------------------------------
// Establish all the session UID data

// Construct the URL for opening a new websocket connection to the server
var ws_URL = `ws://${ws_hostName}:${ws_port}/WS/${ws_temp.brwUID}/${ws_temp.ssmUID}/${ws_temp.parssmUID}`;
//------------------------------------------------------


ws.log(
`BASIC INFORMATION -------------------------
    host: ${ws_hostName}
    url port number: ${ws_port}
    websocket address: ${ws_URL}
    document.location.href: ${document.location.href}
    brwUID: ${ws_temp.brwUID}
    ssmUID: ${ws_temp.ssmUID}
    parssmUID: ${ws_temp.parssmUID}
------------------------------------------`
);


// Register the init function with jquery to be
// run when the html page has completed
// loading.
$( ws_init );

// ========================================================================================== ws_init
/**
 * Initialization function for webUtil. This function is called when the page has loaded
 */
function ws_init(){

    ws_parseAllCookies();
    
    ws_Initialize_WebSocket();

    //ws_getSettings();
    
};



// ========================================================================================== checkSessionData
function ws_startHeartBeat(){
    

    // ws_log(`>>startHeartBeat: brwUID [${ws,sessionController.sessionData.brwUID}]`);

    // Check the session with the server by sending
    // a getSession message to the server, and registering
    // the handler checkSessionResponse to handle the 
    // reply message.
    let req = {
        msgType: "heartbeat"
    }
    ws.sendMessage( req, ws_heartbeatReply )
    return;
    
}
/**
 * Displays a message in the status bar. Formatting
 * can be applied using a class or classes.
 * @param {*} msg 
 */
function ws_updateStatus( msg ){
    let newStatus = msg.status? msg.status : msg ;
    let classes = msg.classes? msg.classes : null ;

    let sm = $('#statusmsg, .statusmsg');
    sm.removeClass().addClass(".statusmsg");
    sm.html( newStatus );
    if( classes )sm.addClass( classes );
}

function ws_updateSessionInfo( msg ){
    ws_log( "Setting session info from message", msg );
    ws_setSessionInfoFromServer( msg.sessionInfo );
};

/** ws_resetSession
 * reset-session is sent from the server to clear all session data
 * Action: Clear current session data, allocate new ssmUID, take
 * browser and user data from the localStorage object.
 * @param {*} msg 
 */
function ws_resetSession( msg ){
    ws_log( ">>resetSession" );
    ws.sessionController._newSession();
    ws_reloadApp();
}

/**
 * Sets cookie values as sent from the server in a ws message.
 * The message format is
 *      msg {
 *          cookies {
 *              <key> {
 *                      value: <value>
 *                      , days : <days-to-expiry>
 *                  };
 * 
 * @param {*} msg 
 */
function ws_SetCookies ( msg ) {
    ws_log(">>wsSetCookies");
    let cks = msg.cookies;
    let keys = Object.keys( cks );
    keys.forEach( 
        key=>{

            let cInfo = cks[key];
            let v = cInfo.value? cInfo.value :
                    cInfo.v? cInfo.v :
                    "" ;
            let d = cInfo.days? cInfo.days :
                    cInfo.d? cInfo.d :
                    30 ;
            ws_setCookie(key,v,d);
            ws_log(`[${key}]=[${v}] exp=${d}`);
        }
    )
};
/**
 * msg.cookies contains an array of cookie keys to be deleted
 * @param {*} msg 
 */
function ws_DeleteCookies( msg ){
    ws_log(">>wsDeleteCookies");
    let cks = msg.cookies;
    cks.forEach( key =>{
        ws_deleteCookie( key );
    })
}
/** =============================================================
 * Updates the session information from the server
 * TODO - update permission settings when the session data
 *        is updated.
 * @param {*} sessionInfo 
 */
function ws_setSessionInfoFromServer( sessionInfo ){
    console.log( ">> ws_setSessionInfoFromServer", sessionInfo );
    ws.sessionController.updateSessionInfoFromServer(  sessionInfo ) ;
    //ws_setCookie( "ws_sessionuid", sessionInfo.ssmUID );
};

/**
 * Reloads the whole application by navigating
 * to the app framwork page
 */
function ws_reloadApp(){
    $(`#page_div`).html("<div><b>Disconnected. Attempting reconnection . . please wait</b></div>");
    console.log("Reloading the page");
    location.reload();
};

/**
 * Used to remove session data and close the session, when the user logs out
 * The browser is redirected to the app page to reload the app and prompt for
 * a new login.
 */
function ws_closeSession (){
    //ws_sessionController.closeWebsocket();

   sessionStorage.clear();                      // remove all the session data
   ws_reloadApp() ;      // reload the app itself

}

function ws_heartbeatReply ( data ){
    console.log( `Heartbeat ${data.tickNumber}` );
    //console.log( data );
    $(`.hbnumber`).html( " #" + data.tickNumber + " @" + data.hhmmss.substr(0,5)+"GMT " );
};

/**
 * Handler for the reply to the getsession message
 * @param {*} msg 
 */
function ws_checkSessionResponse( msg ){
    console.log("Session response from server:", msg );
    if( msg.msgType == "session_ok" ){
        login_log("Session OK");
    };
    // TODO we need to do something if the session is
    // not OK?
}

/** ws_loadPage
 * Handles the loadPage message from the server
 * @param {*} msg 
 */
function ws_loadPage( msg ){
    $( '#page_div' ).html( msg.pageHTML );
}

/** ws_updateDivs
 * Handles the divs message from the server
 * @param {*} msg 
 */
function ws_updateDivs( msg ){
    let divs = msg.divs;

    if( !divs ){
        ws_log( "Divs message does not contain any target");
        return;
    }
    let divTargets = Object.keys( divs );
    divTargets.forEach( divName=>{
        $(`#${divName}`).html( divs[divName] );
    })
}

/** ws_updateSingleDiv
 * Handles the div message from the server
 * @param {*} msg 
 */
function ws_updateSingleDiv( msg ){
    ws_log( ">updateSingleDiv");

    let divName = msg.divName;
    let divTarget = msg.divTarget;
    if(!divTarget) divTarget = divName;
    if(!divTarget) divTarget = "sysInfo";

    let html = msg.html;
    let classes = msg.classes;


    if( !divTarget ) return;
    ws_log(`looking for div ${divTarget}`);
    let theDiv = $( `#${divTarget}` );
    ws_log(`.. found ${theDiv.length} divs with id ${divTarget}`);
    if( theDiv.length == 0) {
        ws_log(".. the div is not found");
         if( ["head_div", "body_div", "foot_div"].includes(divTarget) ){
            ws_log(`restoring head/body/foot divs`);
            $(`#page_div`).html("<div id='head_div'></div><div id='body_div'></div><div id='foot_div'></div>")
            theDiv = $( `#${divTarget}` );
        }
    }

    if( !theDiv ) return;

    if( html ) {
        try{
            //console.log("HTML", html);
            theDiv.html( html );
        } catch(e) {
            console.error(e);
            return;
        }
    };

    if( classes ){
        clsList = classes.split( " " );
        clsList.forEach( 
            cls=>{
                cls = cls.trim();
                if( cls.charAt(0)==="-"){
                    theDiv.removeClass( cls.substring(1) );
                } else {
                    theDiv.addClass( cls );
                };
            }
        );
    }
};

function ws_goToHomeDiv(){

    ws_goToDiv('apphome_div', `page-div`);
    
};
/**
 * spec = {name, target, data, cbFunction, cbData}
 * @param {*} spec 
 */
function ws_loadOneDiv( spec ){
    ws_goToDiv( spec.name, spec.target, spec.data = null, spec.cbFunction, spec.cbData );
};

function ws_loadSomeDivs( specs ){
    specs.forEach( (spec)=>{
        ws_loadOneDiv( spec );
    });
}
/** ws_goToDiv 
 * Requests a particular div name from the server
 *  to be loaded with the given data, if any
 * @param {*} divName The name of the div to be loaded
 * @param {string} divTarget The id of the div into which the html will be loaded
 * @param {*} divData Data to be used in constructing the html, if any
 */
function ws_goToDiv( divName, divTarget, divData = null, cbFunction = null, cbData = null ){
    let msg = {msgType: 'load-div', divName, divTarget, divData };
    // Session data is always added to a ws message
    ws_sendMessage( msg, cbFunction, cbData ) ;
};

// ========================================================================================== ws_getUID
function ws_getUID(){
    var dt = new Date().getTime();
    var uuid = 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = (dt + Math.random()*16)%16 | 0;
        dt = Math.floor(dt/16);
        return (c=='x' ? r :(r&0x3|0x8)).toString(16);
    });
    return uuid;
};

// ========================================================================================== 
/** ws_getSettings
 * Called on load to get hold of the settings json file from the server. The comolete
 * json is requested by submitting a getSettings request, and the response is handled
 * by a function that processes all the callbacks that have been registered using the 
 * twu onReady() function.
 */
function ws_getSettings(){
    
    // send the message
    ws_sendMessage(
        {
            msgType: "get-settings"
        },
        ws_loadSettings_Callback
    ) 
    ws_log( "Settings request has been sent");
};

/** ws_loadSettings_Callback
 * Function called when the first settings message
 * has been returned from the server, indicating
 * that the server has picked up this session and
 * opened the websocket sucessfully. If there is
 * a queue of messages waiting for the server to
 * be ready, they are sent now.
 * @param {object} msgIn 
 */
function ws_loadSettings_Callback ( msgIn ) {

    ws_log( ">>ws_loadSettings_Callback", msgIn );
    ws_clearCallback( msgIn.callbackKey );

    ws_settings = msgIn.settings;

    ws_log( "Settings loaded via WS:", ws_settings);

};

function ws_showPopup ( msgPopup ){
    div_popup = $(`#popup`);
    div_popup.html( msgPopup.popupHTML ).removeClass( "hidden" );
};

function ws_closePopup( target ){
    $('#popup').html( "" ).addClass( "hidden" );
};


// ========================================================================================== 
/** ws_onReady
 * Function to register a callback function that will be called when the settings
 * data has been loaded and all other twu setups have been completed.
 * @param {*} callBack 
 */
function ws_onReady( callBack ){
    
    //ws_log( `Type of callBack is ${typeof callBack}`);
    if( typeof callBack != "function" ){
        ws_log( `Attempt to register non-function as callback`, callBack );
        return;
    }

    // check if settings have been loaded, if so call the callback immediately
    if( ws_settings ) { 
        setImmediate( callBack( twu ) ); 
        return; 
    };

    //ws_log( "..OnReady callback being queued until ready");
    // not ready yet, so put the callback in the list to be called when ready
    ws_onReadyList.push( callBack )

};

//==============================================================================================
/*
This section contains all the functions used to manage the websocket messaging.
The published functions are only wsOn, to register incoming message handlers,
and sendMessage to send a message to the server
*/
//==============================================================================================
//============================================================================================== ws_On
function ws_On( msgType, cbFunction, cbData=null ){
    ws_msgHandlers[ `${msgType}`.toLowerCase() ] = cbFunction;
    if(cbData) ws_msgHandlerData[ `${msgType}`.toLowerCase() ] = cbData;
    
};

//============================================================================================== ws_Error
function ws_Error( msg ){
    ws_log( "ERROR MESSAGE RECEIVED FROM SERVER", msg);
    if(msg.html){
        $("#sysInfo-error-msg").html(msg.html);
    }
};

//============================================================================================== ws_Initialize_WebSocket
function ws_Initialize_WebSocket(){
    ws_log(">>ws_Initialize_WebSocket");

    if(ws_Initialize_WebSocket_Done){
        ws_log( "....Repeated call to Initialize Websocket - already called");
        return false;
    }

    ws_Initialize_WebSocket_Done = true;

    // ----------------------------------------------------------------
    // Register message handlers for various 
    // standard message types
    ws_log( "Registering handlers for standard message types");

    // Register handler for the loadpage message from the server
    ws.wsOn( "loadpage",       ws_loadPage );

    // unsolicited update to session information which happens
    // in the course of processing.
    ws.wsOn( "update-session", ws_updateSessionInfo );
    ws.wsOn( "session-info",   ws_updateSessionInfo );
    ws.wsOn( "session-open", ws_SessionOpen );


    // popup message will show a popup notification to the user
    ws.wsOn( "popup",          ws_showPopup );

    // unsolicited set cookies message handler
    ws.wsOn( "setcookies",     ws_SetCookies );
    ws.wsOn( "set-cookies",     ws_SetCookies );
    ws.wsOn( "delete-cookies", ws_DeleteCookies );
    ws.wsOn( "deletecookies", ws_DeleteCookies );

    // reload app message to re-initialize the whole client app
    ws.wsOn( "reloadapp",      ws_reloadApp );

    // divs message is used to update multiple divs in a single
    // message, used by different parts of the application
    ws.wsOn( "divs",           ws_updateDivs );

    // div message updates a single div
    ws.wsOn( "div",            ws_updateSingleDiv );

    // status message updates the status notification
    ws.wsOn( "status",         ws_updateStatus );

    // register the error message handler
    ws.wsOn( "error",          ws_Error );

    // user login handler
    ws.wsOn( "person-login",   ws_personLogin );

    // ----------------------------------------------------------------


    // establish the ws connection
    ws_log( `Opening WS at ${ws_URL}`);

    ws_websocket = new WebSocket( ws_URL ); //+ browserSession );

    // register the handler for the on open event of the websocket
    ws_websocket.onopen = function (ev){

        ws_log( "onOpen event received", ev);
        ws_startHeartBeat();
        
        // processing all onReady functions
        // process all the functions waiting for the settings to be loaded
        ws_onReadyList.forEach( cbFunction => {
            cbFunction( twu );
        });
        
    };

    // Register the handler for messages received through the websocket
    ws_websocket.onmessage = function( ev ){
        // increment the incoming message count
        ws_msgInCount++;

        // Extract the message JSON and parse into the msg object
        let msg = ws.preprocessJSON( JSON.parse( ev.data ) ) ;

        msg.msgInNumber = ws_msgInCount;

        // report the message if it is not a heartbeat
        if( msg.msgType!=`heartbeat`) ws_log(`msg received #${ws_msgInCount}`, msg)
        
        // Establish the message type
        let msgType = msg.msgType? msg.msgType.toLowerCase() : "";
        
        // Check if there is a handler for this message type
        if( ws_msgHandlers[ msgType ] ){
            let data = ws_msgHandlerData[ msgType ];
            ws_msgHandlers[ msgType ]( msg, data );
        } 
        
        // Check if there is a callback key on this message
        // Callback keys are registered when a message is sent to the server
        // so that the response to the message can be processed by a specific
        // client-end function associated with the key.
        if( msg.callbackKey ){
            if( msg.msgType!=`heartbeat`) ws_log( `Checking callback for ${msg.callbackKey}`)
            
            let callbackObject = ws_messageCallback[msg.callbackKey];

            // Check that a function was registered, and if so call the function
            if( callbackObject.processReplyMessage )
                if( typeof callbackObject.processReplyMessage != "function"){
                    ws_log( `*** ERROR Invalid callback object:`, callbackObject)
                } else {
                    //ws_log(`calling back key ${msg.callbackKey} ${msg.msgType}`)
                    // execute the callback function with the message as data
                    if( callbackObject.processReplyMessage( msg, callbackObject ) ) {
                        // true return from callback means that the key can be removed
                        // otherwise the key is left in place to handle further messages
                        // from the server.
                        delete ws_messageCallback[msg.callbackKey];
                    }
                }
        };

    } ;

    // Register the onclose event for the websocket
    ws_websocket.onclose = function ( ev, number, reason ){
        
        ws_log( "Websocket closing event received", ev);

        //ws_sessionController.closeWebsocket();

        ws_reloadApp();
        //log( `Websocket closing [${ev.code}: ${ev.reason}]`);

    };

};

/**
 * Handles the person-login message from the server, which is sent
 * when a person has sucessfully logged in through this websocket
 * The primary action is to load the default home page, identified
 * in the session data under the key grpmemHome, which is loaded into
 * the 
 * @param {*} msg 
 */
function ws_personLogin( msg ){
    let si = msg.sessionInfo;
    ws.log(`>>ws_personLogin - ${si.psnName} has logged in.`);
    ws.log("si", si);
    let grpmemHome=  si.grpmemHome? si.grpmemHome
                   : si.mgsRole==="PAD"? "padgrp/personal"
                   : "login" ;
    
    ws.log(`Opening default function at ${grpmemHome} `)
    ws.goToDiv(grpmemHome, "page_div" );
    
}


/**
 * Callback when the server sessionManager sends back a sessionopen message
 * via the websocket, including all the session data for the current session.
 * @param {*} msg 
 */
function ws_SessionOpen( msg ){

    ws_log(">>wsSessionOpen");
    //ws_sessionController.updateSessionInfoFromServer( msg.sessionInfo );
    //ws_sessionController.report();

    // Set the websocket ready flag so that any new calls to send
    // messages via the websocket are executed immediately instead
    // of being queued.
    ws_IsReady = true;

    // Execute all the onReady callbacks

    
    $(window).on('focus', function() 
    {
        // set the active ssmUID on the document cookie before unloading the page
        console.log( ">>window.onBeforeUnload" );

        //ws_setCookie("activesession", ws_sessionController.activeBrwSsmUID, 0.5 );
        
        //ws_sessionController.closeWebsocket();

    });

    // Now that the session has started, we need to send all the outgoing
    // messages that have been waiting.
    ws_log(`Checking outgoing queue: ${ws_OutgoingQueue.length} messages waiting to go`)

    if( ws_OutgoingQueue.length > 0 ) {
        
        // send all the messages that were queued up waiting for the connection
        ws_OutgoingQueue.forEach( (item, index)=>{
                //let jsonItem = JSON.stringify(  item );
                ws_log( `sending JSON #${index}:`, item )
                
                ws_sendMessage( item );

            }
        );

        // clear the outgoing queue (not strictly necessary as the queue is not used again)
        ws_OutgoingQueue.splice( 0, ws_OutgoingQueue.length)
    };

};

//============================================================================================== ws_clearCallbackKey
/**
 * Used to remove a callback key from the callback array. This should be called by callback functions
 * to remove themselves from the callback list when they have received the final reply message from the
 * server. This keeps the callback list tidy.
 * @param {*} key 
 */
function ws_clearCallback( key ){
    if ( ws_messageCallback[key] ){
        delete ws_messageCallback[key];
        ws_log( `Callback [${key}] has been deleted`);
    }
}

//===================================== ws_sendMessage
/**
 *  Utility function to send a message to the server through
 * the websocket connection. 
 * 
 * @param {object} xmsg The message to be sent.
 * @param {function or object} xcallback Optional. A callback function to be
 *              called to process the reply message or
 *              an object with a member function 
 *              named "processReplyMessage".
 * @param {object} xCBObject Optional, DEPRECATED. An object to
 *              which the callback function should be attached
 *              to process the reply message. Pass an object
 *              with processReplyMessage function instead.
 */
function ws_sendMessage( xmsg, xcallback = null, xCBObject = null ){
    let msg = xmsg;
    let callback = xcallback;
    let cbObject = xCBObject;

    // increment the message count
    msg.msgOutNumber = ++ws_msgOutCount;

    // We always send a copy of the current session info to the server
    // on the message under the key sessionInfo
    if( ws.sessionController ){
        msg.sessionInfo = ws.sessionController.sessionInfo;
    };

    // If a callback function has been provided, create a callback key and
    // save the reference to the function. The callback key is sent with the
    // message and will be returned in the reply message from the server,
    // so that the reply can be routed to the correct callback function.

    if( callback ){

        if( typeof callback == "function"){
            if( cbObject ){
                // ************************
                // 
                cbObject.processReplyMessage = callback;
            } else {
                cbObject = { processReplyMessage: callback };
            }
        } else {
            // Check if the callback object implements
            // the processReplyMessage function
            if( callback.processReplyMessage ) {
                cbObject = callback;
            } else {
                cbObject = null;
            };
        };

        if( cbObject ){
          
            // Save callback for reply message
            // Get a unique reference ID for the callback
            let newCBKey = ws_getUID();

            // Save the callback into the dictionary of callbacks

            // Attach the function to the callback object and 
            // call the attached callback as a method of the object

            ws_messageCallback[newCBKey] = cbObject;
            // Put the callback key on the outgoing message so
            // that it can be returned from the server
            msg.callbackKey = newCBKey;

        };
    };

    // Check if the websocket has already been opened and can take
    // this message now.
    if( ws_IsReady ){
        ws_log( "Sending message using WS", msg );
        let sMsg =  JSON.stringify(  msg )
        ws_log( "... Serialised message", sMsg );
        ws_websocket.send( sMsg );
        return true;
    };

    // The WS is not open yet, so add the message to the queue
    // waiting for a connection
    ws_log( "Queueing message for WS", msg );
    ws_OutgoingQueue.push( msg );
    return true;

};

// ========================================================================================== 
/**
 * function to retrieve all cookies for the current domain and make their
 * values accessible through the ws.coookies object.
 */
function ws_parseAllCookies(){

    // Get the cookie string of the current document, and split
    // on ; because that separates each name=value pair
    let sCk = decodeURIComponent(document.cookie).split(";");

    // Scan all NV pairs to separate name from value and parse
    // any numeric values into numbers.
    sCk.forEach( (item)=>{
        // Split on = sign so [0] contains name and [1] contains value
        let NV = item.split("=");
        if( NV.length == 2 ){
            if( !isNaN( NV[1] ) ) NV[1] = new Number( NV[1] );
            ws_cookies[NV[0].trim()]= NV[1];
        } else if( NV[0].length > 0) {
            ws_cookies[NV[0].trim()] = true;
        };
    });

    ws_log( `Cookies have been parsed:`, ws_cookies );
}


// ========================================================================================== 
/**
 * Function to set a name-value pair on the domain cookie 
 * @param {*} name 
 * @param {*} value 
 * @param {*} daysValid 
 */
function ws_setCookie( name, value, daysValid = 365 ){
    let d = new Date();
    d.setTime( d.getTime() + (daysValid*86400000) ); // 24*60*60*1000 milliseconds in a day
    let exp = d.toUTCString();
    let cStr = (`${name}=${value};expires=${exp};path=/`).trim();
    ws_log( `Setting cookie: [${cStr}]`);
    document.cookie = cStr;

    ws_parseAllCookies();
}


function ws_deleteCookie( name ){
    ws_setCookie( name, "", -1 );
    ws_log( `Deleted cookie: [${name}]`);
    
}


// ========================================================================================== ws_simpleClone
function ws_simpleClone( pObject, excludeKey, depth = 1 ){
    if( depth > 5 ) return "[TOO DEEP]";
    if( !pObject ) return "[UNDEFINED]";
    var newO = {};
    var keys = Object.keys( pObject );
    if( typeof excludeKey === "string" ) excludeKey = [ excludeKey ];

    keys.forEach( K => {
        if( excludeKey.indexOf(K) == -1 )
        if( K != "__proto__")
            if(  pObject[K] instanceof Function  ) { newO[K] = "[function]" } 
            else if( typeof pObject[K] == "object" ) { newO[K] = ws_simpleClone ( pObject[K], excludeKey, depth+1 ) } 
            else newO[K] = pObject[K];
    })
    return newO;

}

// ========================================================================================== ws_preprocessJSON
function ws_mergeUpdateAfromB( A, B ){
    let C = {};


    let keys = Object.keys( A );
    keys.forEach( key=>{
            C[key]=A[key];
        }
    )

    keys = Object.keys( B );
    keys.forEach( key=>{
            C[key]=B[key];
        }
    )
    return C;
}
// ========================================================================================== ws_preprocessJSON
/**
 * Takes an object or any item that has been constructed using JSON.parse(), and converts all data
 * items whose string values can be represented as valid JS types. The data values are changed in situ
 * if the top-level entry is an object, and the converted value/object is also returned.
 * @param {*} entry 
 */
function ws_preprocessJSON( entry ){
    
    switch( typeof entry){
        case "number": return entry;
        case "string": return ws_stringToElementaryType( entry );
        case "object":
            if( !entry ) return null;
            // forEach method indicates an iterable
            if( entry.forEach ){
                try { 
                    entry.forEach( (item, index)=>{
                            entry[index] = ws_preprocessJSON( item );
                        })
                    return entry;

                } catch (e) {
                    console.error( e )
                    return null;
                };

            }
            
            // otherwise process the members of the object individually
            for( let [key, value] of Object.entries( entry ) ){
                entry[key] = ws_preprocessJSON( value )
            };
            return entry;

        default:
            return entry;

    }

}

    // ======================================================================================================= stringToElementaryType
    function ws_checkInt(xx){
        return ws_int_regexp.test( xx )
    }
    function ws_checkFlt(xx){
        return ws_dec_regexp.test( xx );
    }

    /**
     * Recasts a string as one of the javascript basic types, by checking convertibility. If no
     * conversion is possible returns the string. Types are Integer, Number (Float), Boolean and Date
     * @param {*} xxx String to be converted to an elementary type if possible.
     */
    function ws_stringToElementaryType( xxx ){
        //log( "string", typeof xxx , xxx)
        if( xxx.length === 0 ) return "";
        
        // most likely to be a number, so try that first
        if(ws_checkInt( xxx )) return parseInt( xxx );
        if(ws_checkFlt( xxx )) return parseFloat( xxx );

        // check for magic words
        switch(xxx){
            case "null": return null;
            case "true":  return true;
            case "false": return false;
            default: return xxx;
        }

    }
// ========================================================================================== hhmmss
function ws_hhmmss( ddd ){ 
    
    if( !ddd ) ddd = new Date();
    var sDts = ddd.toISOString();
    return sDts.substr(11,8);
 }

// // ==========================================================================================
// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

function ws_validateEmailAddress( email ){
    //ws_log(`ws_validateEmailAddress: ${$(email).val()}`)
    sEmail = $(email).val().toLowerCase();
    
    if( sEmail.length == 0 || sEmail.match( ws_emailRegexp ) ) {
        email.removeClass("form-invalid-input");
        return true;
    };

    email.addClass("form-invalid-input");
    return false;

};

function ws_hideMenus( names ){
    console.log( "..Hiding menus", names);
    if( !names ){
        $( `.menu`).addClass('hidden');
        return;
    } 
    names.forEach( name=>{
        $( `#menu-${name}`).addClass('hidden');
    })
}

function ws_showMenus( names ){
    console.log( "..Showing menus", names);
    if( !names ){
        $( `.menu`).removeClass('hidden');
        return;
    } 
    names.forEach( name=>{
        $( `#menu-${name}`).removeClass('hidden');
    })
}

// ==========================================================================================

function ws_FormatJQueryUIControls(){
    console.log("Running jQuery format setter functions")
    $( "button" ).button();
    $( "button, input, a" ).click( function( event ) {
        event.preventDefault();
    } );
    
    console.log("FINISHED running jQuery format setter functions")
}

// ==========================================================================================

ws.log( "TWU Script loaded, waiting for page load to complete");

