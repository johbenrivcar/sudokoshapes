"use strict";

/*

    The main module for running the GLOB web application in a Node environment
    To run use: 
        >node SKSSserver

*/

// colors  is a library used to provide coloured text
// on the console log.
require("colors")

// ==================================================================== GLOB
// Loads global settings, held in the global variable GLOB
// These are in settings.json in the
// root folder.
require( "./GLOB/INIT" );


// ==================================================================== EVENTS
// Get global event manager object for pub/sub events across
// the applications.
const EVENTS = GLOB.EVENTS;


// ==================================================================== rootify
// Get rootify function which helps us find paths relative
// to the application root folder, even when we don't know
// which folder the current module is in.
const rootify = GLOB.util.appRoot.rootify;

// ==================================================================== log
// Get a logging function for this module
const log = GLOB.util.logger.getLogger( "SKSServer" );

//require("./database/globalsLoader" );

// ==================================================================== Log subscription manager
// Get the log subscription manager, which is used to send log messages
// to any browsers that have requested log messages from the server
// Tell the log subscription manager to write log messages to a log file. The file is
// ./logs/SKSSserverlog.log by default
require( "./GLOB/logSubscriptionManager" ).logToFile();

//
// ==================================================================== Notification of server ready
EVENTS.on("server.ready", ()=>{ log("SKS Server is ready");} )

//const DBService = GLOB.DBService;


// ==================================================================== Websocket controller
// Load websocket controller module. This is responsible
// for handling all websocket communications to browsers.
const wsController = require( GLOB.ROOT + "/WS/wsController");



// ==================================================================== Run-time variables
const argv = process.argv

const runtime = {
        path: argv[1]
        , args : argv.slice(2)};

log( `SKS server running from [${runtime.path}`)

runtime.args.forEach( (arg, ix)=>{
    let sp = arg.search(/[:=]/);
    if( sp > -1){
        let pkey = arg.substring( 0, sp );
        let pval = arg.substring( sp );
        runtime[pkey]=pval;
    }
} );

log.object( 'Run time parameters', runtime );



// NOTES TO LOG
log( `Application GLOB.ROOT folder is ${GLOB.ROOT}` );
log( `SETTINGS:` , GLOB );


// =========================================================================================================
// ========================================= BASIC MODULES SECTION =========================================
// =========================================================================================================

// mLoad is the module loader, our own alternative to require() function.
// It provides a function dynload which operates like require() but
// monitors all loaded module source files and, if they change, will
// reload the module on the next request. See more in the source.
const mLoad = GLOB.util.mLoad;

// Dynamic loader function, alternative to require()
// Usage: const moduleName = dynamic('moduleName')
const dynamic = mLoad.dynLoad;

// Load file system library
const fs = require( "fs" );


// =========================================================================================================
// ========================================= EXPRESS SETUP SECTION =========================================
// =========================================================================================================

// Load the express module
const express = require( "express" );

// Load the standard express helper modules for request body and cookies
const bodyParser = require( "body-parser" );
const cookieParser = require( 'cookie-parser' );
const sessionManager = require("./session/sessionManager");

const messageHandlersFolder = rootify( GLOB.paths.folders["messageHandlers"] ) ;
log( `messageHandlersFolder: ${messageHandlersFolder}`);

// get the port number to listen for http messages
var mainPort = runtime.port? runtime.port 
                : GLOB.server.port? GLOB.server.port
                : 3000;


// Create the path for loading static images, scripts and html files
const expressApp = express();


expressApp.use( cookieParser() );
expressApp.use( express.json({limit: '50mb', extended: true}));
expressApp.use( express.urlencoded({limit: "50mb", extended: true, parameterLimit:50000}));

// Test if a ws request goes this way
expressApp.use( function( req, res, next){
    log( `Incoming request for ${req.path}` );
    next();
});

// add in the WebSocket handler implementaton
log("Opening websocket handler");
const expressWs = require( `express-ws` )(expressApp);

// Get the page loader module
// The page loader responds to requests of the form http://SKSSserver/pages/<pageName>
const pageLoaderPath = `${GLOB.paths.folders.pages}pageLoader` ;

log("pageLoaderPath: ", pageLoaderPath);
function loadPage( req, res ){
    let pl = dynamic( pageLoaderPath );
    pl.load( req, res );
}

//app.get( "/favicon.ico", GET_favicon_ico);

expressApp.get( "/pages/:pageName", loadPage )
expressApp.get( "/pages/:pageName/:p1", loadPage )

expressApp.get( "/pages/:pageName/:p1/:p2", loadPage )

expressApp.get( "/", (req, res)=>{
    log("Root request received", req.originalUrl)
    res.send("hello world")
    log("Response sent")
});

expressApp.use( express.static( "./web" ) );
expressApp.use( express.static( "./web/public" ) );
expressApp.use( express.static( "./web/public/images" ) );
expressApp.use( express.static( "./web/pages" ) );
expressApp.use( express.static( "./web/divs" ) );
expressApp.use( express.static( "./web/test" ) );

expressApp.use( express.urlencoded({ extended: false }) );


log(">>Setting up routing for /WS path on websocket");
// The call to ws() defines the function to be called when a NEW websocket request is made,
// i.e. when the client issues a request using the "WS://url/path.." request over the tcp
// protocol. This is separate from the actual use of the websocket receive
// messages, which is handled by the 'message' event handler registered with the websocket object.
expressApp.ws('/WS/:browserUID/:sessionUID/:parentSessionUID?', function(ws, req) {
    log("-- ROUTER for new WS request has been invoked")
    wsController.newWSConnection(ws, req);

  });

log("ws routing for /WS is now set up");
//app.post( "/jsonreq", POST_jsonreq );

//app.get( "/pages/login", GET_login )

// load the session data for the current active session on the
// browser that sent the request.
//expressApp.use( checkSession );

            /** ============================================= checkSessionData
             * 
             */
            function checkSession( req, res, next ){

                let csd = dynamic( ROOT + "/sessionManager/checkSession" ).checkSession;
                
                csd( req, res, next);

            }

// Put in authentication here

expressApp.get( "/"
            , function( req, res ){ 
                    res.redirect( "/pages/appFrameWork" ) 
                } 
        );


//expressApp.get( "/settings", GET_settings);

expressApp.get( "/hw", function (req, res){
    //log( " .. responding Hello World ");
    res.end( "hello world" );
});

async function run(){
    
        await sessionManager.start();
        log(">run -- session manager started up")

        expressApp.listen( mainPort );
        log( ">run -- Express server now listening on port " + mainPort );
        log( "RUNNING ##################################################");
        
        // Post the server ready event
        EVENTS.ev("server.ready");

}

run();

log("##>> LOADED GLOB SERVER MODULE ================================")