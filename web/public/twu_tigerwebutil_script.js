/* OVERVIEW
        Client-side tiger utility script. Every tiger page must load this script as
        it controls all aspects of session and permission management. It also provides
        a library of standard functions for handling ws messages in both directions between
        the client and server.

        On initial load, the script checks for current session state as stored in the sessiondata
        and requests confirmation from the server that this is a valid session that can 
        continue. If there is no session state or the session is invalid, then the session
        is initiated as an ANONYMOUS session by the server (not by the client).

        Once the session state is established, the page script that was loaded with the page may
        decide on what action to take to load the appropriate divs that reflect the session. This
        decision is purely an application-level decision, not part of the utility functions.

        The sequence of the process etc is:
         - loading of the basic session structure
         - get the sessionInfo from sessionData
            - check that the personUID matches the sessionInfo in browserData, if any
            - if not, switch to the personUID from the browser and request a >> default home
                page load >> for this person from the server
         - if session info seems valid, then request resume-session from the server

         The possible responses from the server are:
         - reset-session with a new ssmUID and personUID=ANON. This establishes a new
            anonymous session and reverts to the anonymous home page, using a request
            for login/registration page to the server.
         - session-ok which confirms that the session in valid and can be resumed. Currently
            the default behaviour is to load the home page for the current user/member/group
            as determined from the server end.

    BROWSER DATA STORED IN localStorage
    
    brwUID: string // immutable browser UID
    activeSessionUID: string // most recently activated session

    browserInfo: // object stored as JSON string
        { brwUID  : <string>
            , currentSessionInfo : 
                <ssmUID>: 
                    {
                        ssmUID
                        , loginUID
                        , personUID
                        , brwUID // repeated from above?
                        , name1
                        , name2
                        , loginDTS // datestamp
                        , email
                        , rememberMe // bit 0 or 1
                        , lastusedDTS // datestamp
                    }
            }
        }

    SESSION DATA STORED IN sessionStorage
    sessionInfo: // SessionInfo object stored as JSON string
        {
            Session data as above
        }


*/

//>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
//#region - Global data all begin with twu_....
// cookies object loaded on initialisation
const twu_cookies = {};

// websettings obtained from the server using getWebSettings message during initialisation
var twu_settings = null;

// calback list of functions to call once the framework is ready to run.
const twu_onReadyList = [];

// information about current user, can be used to display info on the page
const twu_userData = {};

// dictionary of callback functions associated with messages sent to the server. When the
// server responds it will include the callbackKey that identifies the function to be called
// to process the server response.  Note that messages may also be handed to event handlers 
// depending on their msgType property.
const twu_wsMessageCallback = {};

// status flags
var twu_Initialize_WebSocket_Done = false;
var twu_RegistrationNeeded = null;


// Regular expressions used to validate entries in form fields
const twu_int_regexp = /^[0-9]+$/g                 // regular expression to check integer value
const twu_dec_regexp = /^[0-9]+(\.[0-9]+)?$/g      // regular expression to check number, int or decimal

// regular expression to validate email addresses on input forms
const twu_emailRegexp = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/ ;

// local logging function used throughout code to log to the browser console.
const twu_log = console.log;

// Dictionary of message handlers to process incoming messages. When
// a message is sent, an message handling function can be optionally
// registered here to process the reply. A UID is used as the key
// to identify the handler function, and this UID is sent with the 
// outgoing message under the key 'responseHandler'. See twu_wsSend
var twu_wsMsgHandlers = {};
var twu_wsMsgHandlerData = {};

twu_log("Message handler list has been created");

// The websocket object for sending messages to the server
var twu_websocket = null;

var twu_wsMsgInCount = 0;
var twu_wsMsgOutCount = 0;

// Flag indicating that the websocket connection is ready for use
var twu_wsIsReady = false;
// List of messages waiting to be sent when the websocket is ready
const twu_wsOutgoingQueue = [];

//#endregion
//>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

//>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
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
 *  from which they are accessed by the TWU_SessionController object.
 */
    let twu_temp = {
         ssmUID: null
        , brwUID: null
        , parssmUID: null
    };

    // ********************
    // Save the uid of the previous session in this window, if any:
    twu_temp.parssmUID = sessionStorage.getItem("ssmUID");

    // ********************
    // Assign a new session UID 
    // and save it in sessionStorage
    twu_temp.ssmUID = twu_getUID();
    sessionStorage.setItem("ssmUID", twu_temp.ssmUID);

    // ********************
    // Get the browser UID from localStorage. Assign a new 
    // browser UID if there isn't one already there.
    twu_temp.brwUID = localStorage.getItem("brwUID");

    if( !twu_temp.brwUID ){
        twu_temp.brwUID = twu_getUID();
        localStorage.setItem("brwUID", twu_temp.brwUID );
    };

    // ********************
    // If there was no parent session uid, then default to the last active
    // session in this browser, if any.
    if( !twu_temp.parssmUID ){
        twu_temp.parssmUID = localStorage.getItem("activeSessionUID");
        if(!twu_temp.parssmUID ){
            twu_temp.parssmUID = "XXXXXXXX";
        }
    };

    // Now save the ssmUID as the active session
    // We may need to delay this till after the session has been established
    // with the server.
    localStorage.setItem("activeSessionUID", twu_temp.ssmUID )

//#endregion
//>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>




// Definition of the global twu variable, which holds
// references to published twu functions which can be called
// from any other scripts during operation of the application.
// Always use the form twu.function when calling externally
// instead of twu_function.
//
const twu = {
    simpleClone: twu_simpleClone
    , preprocessJSON: twu_preprocessJSON
    //, sendJSONRequest: twu_sendJSONRequest
    , setCookie: twu_setCookie
    , deleteCookie: twu_deleteCookie
    , cookies: twu_cookies
    , sessionController: null // see below
    , settings: {}
    , onReady: twu_onReady
    , getUID: twu_getUID
    , wsOn: twu_wsOn
    , wsSendMessage: twu_wsSendMessage
    , userData: twu_userData
    , log: twu_log
    , closeSession: twu_closeSession
    , setSessionInfo: twu_setSessionInfoFromServer
    , closePopup: twu_closePopup
    , mergeUpdateAfromB: twu_mergeUpdateAfromB
    , goToHomeDiv: twu_goToHomeDiv
    , loadOneDiv: twu_loadOneDiv
    , loadSomeDivs: twu_loadSomeDivs
    , goToDiv: twu_goToDiv
    , temp: twu_temp
};

//========================================================= class twu_SessionController
/**
 * Session controller object. Not yet finalised.
 * 
 */
class TWU_SessionController {
    // -- ------------------------------------ constructor
    constructor(){
        twu.log( ">TWU.sessionController.constructor")
        this.init = false;
        this.start = false;
        // initial settings for session context before loading
        // session data from the server
        this._sessionInfo = {
            ssmUID : twu_temp.ssmUID
            , brwUID : twu_temp.brwUID
            , parssmUID : twu_temp.parssmUID
            , psnUID: "ANON"
            , memUID: "ANON"
            , grpUID: "ANON"
            , grpmemUID: "ANON"
            , mgsUID: ""
            , mgsPerms: { ANON: 1 }
            , ssmStatus: "A"
        };

        twu.log( "TWU_SessionController> sessionInfo", this._sessionInfo );
    };

    /**
     * Callback that updates the session information whenever
     * an update is received from the server
     * @param {*} serverSessionInfo 
     */
    updateSessionInfoFromServer ( serverSessionInfo ){
        twu.log( ">TWU_SessionController.updateSessionFromServer");
        // get the session data object
        let si = this._sessionInfo;
        if(!si) this._sessionInfo = si = {};

        // overwrite all the values sent from the server
        Object.assign( si, serverSessionInfo );

        // testing only
        this.report();

        return;
    }

    get sessionInfo(){
        //console.log( ">TWU.get=sessionInfo");
        return this._sessionInfo;
    };

    get ssmStatus(){
        console.log( ">TWU.get=ssmStatus");
        return this._sessionInfo.ssmStatus;
    };

    get activeBrwSsmUID(){
        return this._sessionInfo.brwUID + "_" + this._sessionInfo.ssmUID;
    }

    closeWebsocket(){
        twu.log(`>>closeWebSocket on session ${this.sessionInfo.ssmUID}`);
        let wsCookieKey = "umdftr" + this._sessionInfo.ssmUID;
        twu_deleteCookie( wsCookieKey );

    }

    report(){
        twu_log("TWU_SessionController ---------------------------")
        twu_log( '-- Session INFO: ', this.sessionInfo );
    }
};
// >>>>>>>>>>>>>>>>>>>>>>> END OF TWU_SessionController class


twu.log( "Creating session controller object...")
const twu_sessionController = new TWU_SessionController( twu );
twu.sessionController = twu_sessionController;
twu_sessionController.report();

// ============================================================================================
/*
    This section implements the websocket connection to the server and provides functions for
    sending to and receiving messages from the server
*/
// ============================================================================================

var twu_hostName = window.location.hostname;

var twu_port = document.location.port;

// -----------------------------------------------------
// Establish all the session UID data

// Construct the URL for opening a new websocket connection to the server
var twu_wsURL = `ws://${twu_hostName}:${twu_port}/WS/${twu_temp.brwUID}/${twu_temp.ssmUID}/${twu_temp.parssmUID}`;
//------------------------------------------------------


twu.log(
`BASIC INFORMATION -------------------------
    host: ${twu_hostName}
    url port number: ${twu_port}
    websocket address: ${twu_wsURL}
    document.location.href: ${document.location.href}
    brwUID: ${twu_temp.brwUID}
    ssmUID: ${twu_temp.ssmUID}
    parssmUID: ${twu_temp.parssmUID}
------------------------------------------`
);


// Register the init function with jquery to be
// run when the html page has completed
// loading.
$( twu_init );

// ========================================================================================== twu_init
/**
 * Initialization function for webUtil. This function is called when the page has loaded
 */
function twu_init(){

    twu_parseAllCookies();
    
    twu_Initialize_WebSocket();

    //twu_getSettings();
    
};



// ========================================================================================== checkSessionData
function twu_startHeartBeat(){
    

    // twu_log(`>>startHeartBeat: brwUID [${twu.sessionController.sessionData.brwUID}]`);

    // Check the session with the server by sending
    // a getSession message to the server, and registering
    // the handler checkSessionResponse to handle the 
    // reply message.
    let req = {
        msgType: "heartbeat"
    }
    twu.wsSendMessage( req, twu_heartbeatReply )
    return;
    
}
/**
 * Displays a message in the status bar. Formatting
 * can be applied using a class or classes.
 * @param {*} msg 
 */
function twu_updateStatus( msg ){
    let newStatus = msg.status? msg.status : msg ;
    let classes = msg.classes? msg.classes : null ;

    let sm = $('#statusmsg, .statusmsg');
    sm.removeClass().addClass(".statusmsg");
    sm.html( newStatus );
    if( classes )sm.addClass( classes );
}

function twu_updateSessionInfo( msg ){
    twu_log( "Setting session info from message", msg );
    twu_setSessionInfoFromServer( msg.sessionInfo );
};

/** twu_resetSession
 * reset-session is sent from the server to clear all session data
 * Action: Clear current session data, allocate new ssmUID, take
 * browser and user data from the localStorage object.
 * @param {*} msg 
 */
function twu_resetSession( msg ){
    twu_log( ">>resetSession" );
    twu.sessionController._newSession();
    twu_reloadApp();
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
function twu_wsSetCookies ( msg ) {
    twu_log(">>wsSetCookies");
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
            twu_setCookie(key,v,d);
            twu_log(`[${key}]=[${v}] exp=${d}`);
        }
    )
};
/**
 * msg.cookies contains an array of cookie keys to be deleted
 * @param {*} msg 
 */
function twu_wsDeleteCookies( msg ){
    twu_log(">>wsDeleteCookies");
    let cks = msg.cookies;
    cks.forEach( key =>{
        twu_deleteCookie( key );
    })
}
/** =============================================================
 * Updates the session information from the server
 * TODO - update permission settings when the session data
 *        is updated.
 * @param {*} sessionInfo 
 */
function twu_setSessionInfoFromServer( sessionInfo ){
    console.log( ">> twu_setSessionInfoFromServer", sessionInfo );
    twu.sessionController.updateSessionInfoFromServer(  sessionInfo ) ;
    //twu_setCookie( "ws_sessionuid", sessionInfo.ssmUID );
};

/**
 * Reloads the whole application by navigating
 * to the app framwork page
 */
function twu_reloadApp(){
    $(`#page_div`).html("<div><b>Disconnected. Attempting reconnection . . please wait</b></div>");
    console.log("Reloading the page");
    location.reload();
};

/**
 * Used to remove session data and close the session, when the user logs out
 * The browser is redirected to the app page to reload the app and prompt for
 * a new login.
 */
function twu_closeSession (){
    twu_sessionController.closeWebsocket();

   sessionStorage.clear();                      // remove all the session data
   twu_reloadApp() ;      // reload the app itself

}

function twu_heartbeatReply ( data ){
    console.log( `Heartbeat ${data.tickNumber}` );
    //console.log( data );
    $(`.hbnumber`).html( " #" + data.tickNumber + " @" + data.hhmmss.substr(0,5)+"GMT " );
};

/**
 * Handler for the reply to the getsession message
 * @param {*} msg 
 */
function twu_checkSessionResponse( msg ){
    console.log("Session response from server:", msg );
    if( msg.msgType == "session_ok" ){
        login_log("Session OK");
    };
    // TODO we need to do something if the session is
    // not OK?
}

/** twu_loadPage
 * Handles the loadPage message from the server
 * @param {*} msg 
 */
function twu_loadPage( msg ){
    $( '#page_div' ).html( msg.pageHTML );
}

/** twu_updateDivs
 * Handles the divs message from the server
 * @param {*} msg 
 */
function twu_updateDivs( msg ){
    let divs = msg.divs;

    if( !divs ){
        twu_log( "Divs message does not contain any target");
        return;
    }
    let divTargets = Object.keys( divs );
    divTargets.forEach( divName=>{
        $(`#${divName}`).html( divs[divName] );
    })
}

/** twu_updateSingleDiv
 * Handles the div message from the server
 * @param {*} msg 
 */
function twu_updateSingleDiv( msg ){
    twu_log( ">updateSingleDiv");

    let divName = msg.divName;
    let divTarget = msg.divTarget;
    if(!divTarget) divTarget = divName;
    if(!divTarget) divTarget = "sysInfo";

    let html = msg.html;
    let classes = msg.classes;


    if( !divTarget ) return;
    twu_log(`looking for div ${divTarget}`);
    let theDiv = $( `#${divTarget}` );
    twu_log(`.. found ${theDiv.length} divs with id ${divTarget}`);
    if( theDiv.length == 0) {
        twu_log(".. the div is not found");
         if( ["head_div", "body_div", "foot_div"].includes(divTarget) ){
            twu_log(`restoring head/body/foot divs`);
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

function twu_goToHomeDiv(){

    twu_goToDiv('apphome_div', `page-div`);
    
};
/**
 * spec = {name, target, data, cbFunction, cbData}
 * @param {*} spec 
 */
function twu_loadOneDiv( spec ){
    twu_goToDiv( spec.name, spec.target, spec.data = null, spec.cbFunction, spec.cbData );
};

function twu_loadSomeDivs( specs ){
    specs.forEach( (spec)=>{
        twu_loadOneDiv( spec );
    });
}
/** twu_goToDiv 
 * Requests a particular div name from the server
 *  to be loaded with the given data, if any
 * @param {*} divName The name of the div to be loaded
 * @param {string} divTarget The id of the div into which the html will be loaded
 * @param {*} divData Data to be used in constructing the html, if any
 */
function twu_goToDiv( divName, divTarget, divData = null, cbFunction = null, cbData = null ){
    let msg = {msgType: 'load-div', divName, divTarget, divData };
    // Session data is always added to a ws message
    twu_wsSendMessage( msg, cbFunction, cbData ) ;
};

// ========================================================================================== twu_getUID
function twu_getUID(){
    var dt = new Date().getTime();
    var uuid = 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = (dt + Math.random()*16)%16 | 0;
        dt = Math.floor(dt/16);
        return (c=='x' ? r :(r&0x3|0x8)).toString(16);
    });
    return uuid;
};

// ========================================================================================== 
/** twu_getSettings
 * Called on load to get hold of the settings json file from the server. The comolete
 * json is requested by submitting a getSettings request, and the response is handled
 * by a function that processes all the callbacks that have been registered using the 
 * twu onReady() function.
 */
function twu_getSettings(){
    
    // send the message
    twu_wsSendMessage(
        {
            msgType: "get-settings"
        },
        twu_loadSettings_Callback
    ) 
    twu_log( "Settings request has been sent");
};

/** twu_loadSettings_Callback
 * Function called when the first settings message
 * has been returned from the server, indicating
 * that the server has picked up this session and
 * opened the websocket sucessfully. If there is
 * a queue of messages waiting for the server to
 * be ready, they are sent now.
 * @param {object} msgIn 
 */
function twu_loadSettings_Callback ( msgIn ) {

    twu_log( ">>twu_loadSettings_Callback", msgIn );
    twu_clearCallback( msgIn.callbackKey );

    twu_settings = msgIn.settings;

    twu_log( "Settings loaded via WS:", twu_settings);

};

function twu_showPopup ( msgPopup ){
    div_popup = $(`#popup`);
    div_popup.html( msgPopup.popupHTML ).removeClass( "hidden" );
};

function twu_closePopup( target ){
    $('#popup').html( "" ).addClass( "hidden" );
};


// ========================================================================================== 
/** twu_onReady
 * Function to register a callback function that will be called when the settings
 * data has been loaded and all other twu setups have been completed.
 * @param {*} callBack 
 */
function twu_onReady( callBack ){
    
    //twu_log( `Type of callBack is ${typeof callBack}`);
    if( typeof callBack != "function" ){
        twu_log( `Attempt to register non-function as callback`, callBack );
        return;
    }

    // check if settings have been loaded, if so call the callback immediately
    if( twu_settings ) { 
        setImmediate( callBack( twu ) ); 
        return; 
    };

    //twu_log( "..OnReady callback being queued until ready");
    // not ready yet, so put the callback in the list to be called when ready
    twu_onReadyList.push( callBack )

};

//==============================================================================================
/*
This section contains all the functions used to manage the websocket messaging.
The published functions are only wsOn, to register incoming message handlers,
and wsSendMessage to send a message to the server
*/
//==============================================================================================
//============================================================================================== twu_wsOn
function twu_wsOn( msgType, cbFunction, cbData=null ){
    twu_wsMsgHandlers[ `${msgType}`.toLowerCase() ] = cbFunction;
    if(cbData) twu_wsMsgHandlerData[ `${msgType}`.toLowerCase() ] = cbData;
    
};

//============================================================================================== twu_wsError
function twu_wsError( msg ){
    twu_log( "ERROR MESSAGE RECEIVED FROM SERVER", msg);
    if(msg.html){
        $("#sysInfo-error-msg").html(msg.html);
    }
};

//============================================================================================== twu_Initialize_WebSocket
function twu_Initialize_WebSocket(){
    twu_log(">>twu_Initialize_WebSocket");

    if(twu_Initialize_WebSocket_Done){
        twu_log( "....Repeated call to Initialize Websocket - already called");
        return false;
    }

    twu_Initialize_WebSocket_Done = true;

    // ----------------------------------------------------------------
    // Register message handlers for various 
    // standard message types
    twu_log( "Registering handlers for standard message types");

    // Register handler for the loadpage message from the server
    twu.wsOn( "loadpage",       twu_loadPage );

    // unsolicited update to session information which happens
    // in the course of processing.
    twu.wsOn( "update-session", twu_updateSessionInfo );
    twu.wsOn( "session-info",   twu_updateSessionInfo );
    twu.wsOn( "session-open", twu_wsSessionOpen );


    // popup message will show a popup notification to the user
    twu.wsOn( "popup",          twu_showPopup );

    // unsolicited set cookies message handler
    twu.wsOn( "setcookies",     twu_wsSetCookies );
    twu.wsOn( "set-cookies",     twu_wsSetCookies );
    twu.wsOn( "delete-cookies", twu_wsDeleteCookies );
    twu.wsOn( "deletecookies", twu_wsDeleteCookies );

    // reload app message to re-initialize the whole client app
    twu.wsOn( "reloadapp",      twu_reloadApp );

    // divs message is used to update multiple divs in a single
    // message, used by different parts of the application
    twu.wsOn( "divs",           twu_updateDivs );

    // div message updates a single div
    twu.wsOn( "div",            twu_updateSingleDiv );

    // status message updates the status notification
    twu.wsOn( "status",         twu_updateStatus );

    // register the error message handler
    twu.wsOn( "error",          twu_wsError );

    // user login handler
    twu.wsOn( "person-login",   twu_personLogin );

    // ----------------------------------------------------------------


    // establish the ws connection
    twu_log( `Opening WS at ${twu_wsURL}`);

    twu_websocket = new WebSocket( twu_wsURL ); //+ browserSession );

    // register the handler for the on open event of the websocket
    twu_websocket.onopen = function (ev){

        twu_log( "onOpen event received", ev);
        twu_startHeartBeat();
        
        // processing all onReady functions
        // process all the functions waiting for the settings to be loaded
        twu_onReadyList.forEach( cbFunction => {
            cbFunction( twu );
        });
        
    };

    // Register the handler for messages received through the websocket
    twu_websocket.onmessage = function( ev ){
        // increment the incoming message count
        twu_wsMsgInCount++;

        // Extract the message JSON and parse into the msg object
        let msg = twu.preprocessJSON( JSON.parse( ev.data ) ) ;

        msg.msgInNumber = twu_wsMsgInCount;

        // report the message if it is not a heartbeat
        if( msg.msgType!=`heartbeat`) twu_log(`msg received #${twu_wsMsgInCount}`, msg)
        
        // Establish the message type
        let msgType = msg.msgType? msg.msgType.toLowerCase() : "";
        
        // Check if there is a handler for this message type
        if( twu_wsMsgHandlers[ msgType ] ){
            let data = twu_wsMsgHandlerData[ msgType ];
            twu_wsMsgHandlers[ msgType ]( msg, data );
        } 
        
        // Check if there is a callback key on this message
        // Callback keys are registered when a message is sent to the server
        // so that the response to the message can be processed by a specific
        // client-end function associated with the key.
        if( msg.callbackKey ){
            if( msg.msgType!=`heartbeat`) twu_log( `Checking callback for ${msg.callbackKey}`)
            
            let callbackObject = twu_wsMessageCallback[msg.callbackKey];

            // Check that a function was registered, and if so call the function
            if( callbackObject.processReplyMessage )
                if( typeof callbackObject.processReplyMessage != "function"){
                    twu_log( `*** ERROR Invalid callback object:`, callbackObject)
                } else {
                    //twu_log(`calling back key ${msg.callbackKey} ${msg.msgType}`)
                    // execute the callback function with the message as data
                    if( callbackObject.processReplyMessage( msg, callbackObject ) ) {
                        // true return from callback means that the key can be removed
                        // otherwise the key is left in place to handle further messages
                        // from the server.
                        delete twu_wsMessageCallback[msg.callbackKey];
                    }
                }
        };

    } ;

    // Register the onclose event for the websocket
    twu_websocket.onclose = function ( ev, number, reason ){
        
        twu_log( "Websocket closing event received", ev);

        twu_sessionController.closeWebsocket();

        twu_reloadApp();
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
function twu_personLogin( msg ){
    let si = msg.sessionInfo;
    twu.log(`>>twu_personLogin - ${si.psnName} has logged in.`);
    twu.log("si", si);
    let grpmemHome=  si.grpmemHome? si.grpmemHome
                   : si.mgsRole==="PAD"? "padgrp/personal"
                   : "login" ;
    
    twu.log(`Opening default function at ${grpmemHome} `)
    twu.goToDiv(grpmemHome, "page_div" );
    
}


/**
 * Callback when the server sessionManager sends back a sessionopen message
 * via the websocket, including all the session data for the current session.
 * @param {*} msg 
 */
function twu_wsSessionOpen( msg ){

    twu_log(">>wsSessionOpen");
    twu_sessionController.updateSessionInfoFromServer( msg.sessionInfo );
    twu_sessionController.report();

    // Set the websocket ready flag so that any new calls to send
    // messages via the websocket are executed immediately instead
    // of being queued.
    twu_wsIsReady = true;

    // Execute all the onReady callbacks

    
    $(window).on('focus', function() 
    {
        // set the active ssmUID on the document cookie before unloading the page
        console.log( ">>window.onBeforeUnload" );
        twu_setCookie("activesession", twu_sessionController.activeBrwSsmUID, 0.5 );
        //twu_sessionController.closeWebsocket();

    });

    // Now that the session has started, we need to send all the outgoing
    // messages that have been waiting.
    twu_log(`Checking outgoing queue: ${twu_wsOutgoingQueue.length} messages waiting to go`)

    if( twu_wsOutgoingQueue.length > 0 ) {
        
        // send all the messages that were queued up waiting for the connection
        twu_wsOutgoingQueue.forEach( (item, index)=>{
                //let jsonItem = JSON.stringify(  item );
                twu_log( `sending JSON #${index}:`, item )
                
                twu_wsSendMessage( item );

            }
        );

        // clear the outgoing queue (not strictly necessary as the queue is not used again)
        twu_wsOutgoingQueue.splice( 0, twu_wsOutgoingQueue.length)
    };

};

//============================================================================================== twu_clearCallbackKey
/**
 * Used to remove a callback key from the callback array. This should be called by callback functions
 * to remove themselves from the callback list when they have received the final reply message from the
 * server. This keeps the callback list tidy.
 * @param {*} key 
 */
function twu_clearCallback( key ){
    if ( twu_wsMessageCallback[key] ){
        delete twu_wsMessageCallback[key];
        twu_log( `Callback [${key}] has been deleted`);
    }
}

//===================================== twu_wsSendMessage
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
function twu_wsSendMessage( xmsg, xcallback = null, xCBObject = null ){
    let msg = xmsg;
    let callback = xcallback;
    let cbObject = xCBObject;

    // increment the message count
    msg.msgOutNumber = ++twu_wsMsgOutCount;

    // We always send a copy of the current session info to the server
    // on the message under the key sessionInfo
    if( twu.sessionController ){
        msg.sessionInfo = twu.sessionController.sessionInfo;
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
            let newCBKey = twu_getUID();

            // Save the callback into the dictionary of callbacks

            // Attach the function to the callback object and 
            // call the attached callback as a method of the object

            twu_wsMessageCallback[newCBKey] = cbObject;
            // Put the callback key on the outgoing message so
            // that it can be returned from the server
            msg.callbackKey = newCBKey;

        };
    };

    // Check if the websocket has already been opened and can take
    // this message now.
    if( twu_wsIsReady ){
        twu_log( "Sending message using WS", msg );
        let sMsg =  JSON.stringify(  msg )
        twu_log( "... Serialised message", sMsg );
        twu_websocket.send( sMsg );
        return true;
    };

    // The WS is not open yet, so add the message to the queue
    // waiting for a connection
    twu_log( "Queueing message for WS", msg );
    twu_wsOutgoingQueue.push( msg );
    return true;

};

// ========================================================================================== 
/**
 * function to retrieve all cookies for the current domain and make their
 * values accessible through the twu.coookies object.
 */
function twu_parseAllCookies(){

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
            twu_cookies[NV[0].trim()]= NV[1];
        } else if( NV[0].length > 0) {
            twu_cookies[NV[0].trim()] = true;
        };
    });

    twu_log( `Cookies have been parsed:`, twu_cookies );
}


// ========================================================================================== 
/**
 * Function to set a name-value pair on the domain cookie 
 * @param {*} name 
 * @param {*} value 
 * @param {*} daysValid 
 */
function twu_setCookie( name, value, daysValid = 365 ){
    let d = new Date();
    d.setTime( d.getTime() + (daysValid*86400000) ); // 24*60*60*1000 milliseconds in a day
    let exp = d.toUTCString();
    let cStr = (`${name}=${value};expires=${exp};path=/`).trim();
    twu_log( `Setting cookie: [${cStr}]`);
    document.cookie = cStr;

    twu_parseAllCookies();
}


function twu_deleteCookie( name ){
    twu_setCookie( name, "", -1 );
    twu_log( `Deleted cookie: [${name}]`);
    
}


// ========================================================================================== twu_simpleClone
function twu_simpleClone( pObject, excludeKey, depth = 1 ){
    if( depth > 5 ) return "[TOO DEEP]";
    if( !pObject ) return "[UNDEFINED]";
    var newO = {};
    var keys = Object.keys( pObject );
    if( typeof excludeKey === "string" ) excludeKey = [ excludeKey ];

    keys.forEach( K => {
        if( excludeKey.indexOf(K) == -1 )
        if( K != "__proto__")
            if(  pObject[K] instanceof Function  ) { newO[K] = "[function]" } 
            else if( typeof pObject[K] == "object" ) { newO[K] = twu_simpleClone ( pObject[K], excludeKey, depth+1 ) } 
            else newO[K] = pObject[K];
    })
    return newO;

}

// ========================================================================================== twu_preprocessJSON
function twu_mergeUpdateAfromB( A, B ){
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
// ========================================================================================== twu_preprocessJSON
/**
 * Takes an object or any item that has been constructed using JSON.parse(), and converts all data
 * items whose string values can be represented as valid JS types. The data values are changed in situ
 * if the top-level entry is an object, and the converted value/object is also returned.
 * @param {*} entry 
 */
function twu_preprocessJSON( entry ){
    
    switch( typeof entry){
        case "number": return entry;
        case "string": return twu_stringToElementaryType( entry );
        case "object":
            if( !entry ) return null;
            // forEach method indicates an iterable
            if( entry.forEach ){
                try { 
                    entry.forEach( (item, index)=>{
                            entry[index] = twu_preprocessJSON( item );
                        })
                    return entry;

                } catch (e) {
                    console.error( e )
                    return null;
                };

            }
            
            // otherwise process the members of the object individually
            for( let [key, value] of Object.entries( entry ) ){
                entry[key] = twu_preprocessJSON( value )
            };
            return entry;

        default:
            return entry;

    }

}

    // ======================================================================================================= stringToElementaryType
    function twu_checkInt(xx){
        return twu_int_regexp.test( xx )
    }
    function twu_checkFlt(xx){
        return twu_dec_regexp.test( xx );
    }

    /**
     * Recasts a string as one of the javascript basic types, by checking convertibility. If no
     * conversion is possible returns the string. Types are Integer, Number (Float), Boolean and Date
     * @param {*} xxx String to be converted to an elementary type if possible.
     */
    function twu_stringToElementaryType( xxx ){
        //log( "string", typeof xxx , xxx)
        if( xxx.length === 0 ) return "";
        
        // most likely to be a number, so try that first
        if(twu_checkInt( xxx )) return parseInt( xxx );
        if(twu_checkFlt( xxx )) return parseFloat( xxx );

        // check for magic words
        switch(xxx){
            case "null": return null;
            case "true":  return true;
            case "false": return false;
            default: return xxx;
        }

    }
// ========================================================================================== hhmmss
function twu_hhmmss( ddd ){ 
    
    if( !ddd ) ddd = new Date();
    var sDts = ddd.toISOString();
    return sDts.substr(11,8);
 }

// // ==========================================================================================
// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

function twu_validateEmailAddress( email ){
    //twu_log(`twu_validateEmailAddress: ${$(email).val()}`)
    sEmail = $(email).val().toLowerCase();
    
    if( sEmail.length == 0 || sEmail.match( twu_emailRegexp ) ) {
        email.removeClass("form-invalid-input");
        return true;
    };

    email.addClass("form-invalid-input");
    return false;

};

function twu_hideMenus( names ){
    console.log( "..Hiding menus", names);
    if( !names ){
        $( `.menu`).addClass('hidden');
        return;
    } 
    names.forEach( name=>{
        $( `#menu-${name}`).addClass('hidden');
    })
}

function twu_showMenus( names ){
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

function twu_FormatJQueryUIControls(){
    console.log("Running jQuery format setter functions")
    $( "button" ).button();
    $( "button, input, a" ).click( function( event ) {
        event.preventDefault();
    } );
    
    console.log("FINISHED running jQuery format setter functions")
}

// ==========================================================================================

twu.log( "TWU Script loaded, waiting for page load to complete");