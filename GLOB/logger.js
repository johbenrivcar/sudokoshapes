"use strict";

/*
    Provides a means of logging messages to the console,
    a log file, and the ^/web/pages/logreport page from any module.
    This module is the basic logging api that writes to the console
    and the log file. 

*/

var loggerDebug = false;

console.log("##> logger");

const contextLoggers = {};

if(!global._LOGGER) {
    global._LOGGER = {};
    global._LOGGER.activeContextList = [];
    global._LOGGER.inactiveContextList = [];
};

const activeContextList = global._LOGGER.activeContextList;
const inactiveContextList = global._LOGGER.inactiveContextList;
var logstack = [];
var logstackLevel = 0;
var currentIndent = "|";

var useColor = false;

try{
    require( "colors" );
    console.log( "USING COLORS".bgWhite.red );
    useColor = true;
} catch(e) {
    console.log( "NOT USING COLORS" );
    useColor = false;
};

var noColor = function(tag){ return tag };

var htmlColors = {
};

var logColors = {

// Define functions for setting colour attributes on diffent types of logged data
    LOG : useColor ? function( tag ) { return tag.bold.magenta.bgBlack } : noColor 
    ,WARN : useColor ? function( tag ) { return tag.bold.yellow.bgBlack } : noColor
    ,ERROR :  useColor ?  function ( tag ){ return tag.bold.brightRed.bgBlack } : noColor
    ,OBJ :  useColor ?  function( tag ){ return tag.magenta } : noColor
    ,red :  useColor ? function( tag ){ return tag.red } : noColor
    ,yellow :  useColor ? function( tag ){ return tag.yellow} : noColor
    ,green : useColor ? function( tag ){ return tag.green} : noColor
    ,magenta : useColor ? function( tag ){ return tag.magenta} : noColor
    ,strikethrough : useColor ? function( tag ){ return tag.strikethrough} : noColor
    ,green : useColor ? function( tag ){ return tag.green} : noColor
    ,CONTEXT: useColor? function( tag ){return tag.green.bold} : noColor

};
// Get ref to global variable holding the last log tag lastLogTag;
let gLogging = global.GLOB.logging;
if(!gLogging) gLogging={};
if(!gLogging.lastLogTag) gLogging.lastLogTag = "";

module.exports.getLogger = getLogger;
module.exports.onLog = onLog;
module.exports.startContext = startContext;
module.exports.stopContext = stopContext;
module.exports.getContextLists = getContextLists;

// const { start } = require("repl"); ******** Not sure why this was ever here

// get node.js util module, we use the [inspect] method
const util = require("util");
const { moveMessagePortToContext } = require("worker_threads");

// list of callback functions for those who have registered to receive
// logging messages.
const callbax = [];

/**
 * Registers a function that will be called
 * whenever a message is sent to the log.
 * Used for hooking in logging add-ons,
 * such as reporting logging to a web page
 * or log file in real time.
 * @param {function} callback The function to be called
 */
function onLog( callback ){
    if( typeof callback === 'function' ) callbax.push( callback );
};


// ========================================================================================== consolelog
function consolelog( ...args ){
    console.log( ...args );
};


// ========================================================================================== callbackLog
/**
 * 
 * Makes a call to every function that was registered through onLog()
 * @param  {...any} args 
 */
function callbackLog( ...args ){

    if(loggerDebug) console.log("Running callback functions in logger");

    callbax.forEach( (callback)=>{ callback(...args) } );

    if(loggerDebug) console.log("Finished callback functions...........")
};


// ========================================================================================== bothLog
/**
 * Wrapper that calls both console log and does all the callbacks
 * @param  {...any} args 
 */
function bothLog( ...args ){
    consolelog( ...args );
    callbax.forEach( (callback)=>{ callback(...args) } );
};


// ========================================================================================== getLogger
/**
 * Called to create a logging function that can be used in a
 * specific code context, so that logging in that context is
 * more easily identifiable when viewing the log.
 * @param {*} contextName 
 */
function getLogger( contextName = "" ){
    if(loggerDebug) console.log("LOGGER >> getLogger, contextName:", contextName);
    // check if there has already been a logger with this context created previously
    let isActive = activeContextList.includes(contextName);
    let isInactive = inactiveContextList.includes(contextName);
    if(!isActive && !isInactive) {
        if(loggerDebug) console.log(`Adding context [${contextName}] to the logging context list`)
        activeContextList.push( contextName );
        isActive = true;
    };

    let thisContext = contextLoggers[contextName];
    // if not there, create a new instance;
    if(!thisContext) contextLoggers[contextName] = thisContext = { isActive , loggers:{} };

    let subContext = contextName
    let n = 0;
    while( thisContext.loggers[ subContext ] ){
        subContext = contextName + "_" + (++n) ;
    }
    
    // wrap the context name in brackets for easier reading on the log, and limit to 79 chars
    let logContextName =`                                                                     [${subContext}]`;
    let contextTag = logContextName.substring( logContextName.length - 79);

    // now define the logger function to be returned to the caller
    /**
     *  This is an individual context function, returned to the caller. It
     * is specific to the module for which it has been requested. 
     * The module details (souce code file name and log variant) define the
     * logging context and are added on the log whenever the context changes. 
     * The variant tag (parameter to getLogger above) allows the coder to use
     * multiple log functions within the same code module if helps. 
     * The _logger function detects changes of context so that it can
     * intersperse lines into the log that show which module is currently
     * outputting to the log, whenever that context changes. It also adds
     * a timestamp on change of context, and source code line numbers on every
     * output line, to make it easy to find the specific location in the code
     * that generates each line of log output.
     * */ 
    
    // This is the function to be returned to the caller. We need
    // a layer between the caller and _logger to ensure the call
    // stack is the right depth to retrieve the module data in
    // the _logger function.
    let modLogger = function(...args){
        if(thisContext.isActive)
            xxLog(contextTag, "LOG", ...args);
    };

    // add the logger function to the modlogger list.
    thisContext.loggers[subContext] = modLogger;

    // the isActive property of the modLogger can be 
    // checked in the caller context to see if logging is
    // turned on for that context.
    Object.defineProperty( modLogger, "isActive", {
        get: function(){
            return thisContext.isActive;
        }
    });

    modLogger.stopLog = function(){
        stopContext(contextName);
    };

    modLogger.startLog = function(){
        startContext(contextName);
    };

    // Define a separate function that tops and tails the logged message(s) with
    // horizontal lines to provide emphasis (as if in a box)
    modLogger.box = function( ...args){
        if(thisContext.isActive){
            xxLog(contextTag, "LOG", "");
            bothLog( "----------------------------------------------------------------");
            bothLog( "|" ); 
            args.forEach( argt => {
                bothLog( "|   ", argt );
            })

            bothLog( "|");
            bothLog( "----------------------------------------------------------------");
        };
    }

    modLogger.keyCount= function(objName, obj ){
        if(thisContext.isActive)
            xxLog(contextTag, "LOG", `${objName} contains ${Object.keys(obj).length} entries` )
    }

    modLogger.error = function( ...args ){
        if(thisContext.isActive)
            xxLog(contextTag, "ERROR", ...args );
    };

    modLogger.warn = function(...args) {
        if(thisContext.isActive)
            xxLog(contextTag, "WARN", ...args );
    }


    modLogger.object = function( objName, obj, options ){
        if(thisContext.isActive){
            
            xxLog(contextTag,  "LOG", "" )
            let hdg = `++++++++++++++++ ${objName} ++++++++++++++++++++++++++++++++++++++++++++++++++++`.substr(0,78);
            consolelog( logColors.OBJ( hdg ) );
            callbackLog( hdg );

            consolelog( obj );
            callbackLog( util.inspect(obj, false, 4, false ) );

            hdg = "------------------------------------------------------------------------------"
            consolelog( logColors.OBJ( hdg ) );
            callbackLog( hdg );

        }
    }

    modLogger.in = function( ...args ){
        let out= function(){return;};

        if(thisContext.isActive){
            let info = {};
            logstack.push(info);
            logstackLevel = logstack.length;
            info.level = logstackLevel;
            info.prevLevel = logstackLevel - 1;
            info.prefix = "| ".repeat(logstackLevel)
            info.contextTakg = 
            currentIndent = info.prefix + ">>"
            xxLog(contextTag, "LOG", ...args);
            currentIndent = info.prefix + "|";
            out = function(){
                currentIndent = info.prefix + "<<"
                while( logstack.length > info.level ) logstack.pop();
                xxLog(contextTag, "LOG", ...args);
                logstackLevel = info.level - 1
                currentIndent = "| ".repeat( logstackLevel ) + "|"
            }
        }

        return out;
    }
            

    modLogger.startLog();
    return modLogger;
}


// ========================================================================================== 
/** 
 * 
 *                  CONTEXT LOGGING IS NOT FULLY TESTED - USE WITH CARE
 * 
 * **/
// ========================================================================================== 
function startContext( contextName ){
    let thisContext = contextLoggers[contextName];
    if(!thisContext) thisContext = { isActive: false, loggers:{} } ;
    if(thisContext.isActive ) return;
    thisContext.isActive = true;

    moveContext ( contextName, inactiveContextList, activeContextList )
    //GLOB.events.ev(`logger.context`, { action: "start",  contextName } );

}

// ========================================================================================== 
function stopContext( contextName ){
    let thisContext = contextLoggers[contextName];
    if(!thisContext) thisContext = { isActive: false, loggers:{} } ;
    if(!thisContext.isActive) return;
    thisContext.isActive = false;

    moveContext (contextName, activeContextList, inactiveContextList )

    //GLOB.events.ev(`logger.context`, {action: "stop",   contextName } );

}
// ========================================================================================== 
function moveContext(contextName, fromList, toList ){
    if(fromList.includes(contextName) ){
        fromList = fromList.filter( v=> v!== contextName );
    }
    if(!toList.includes(contextName) ) {
        toList.push(contextName);
        toList.sort()
    }
}

// ========================================================================================== 
function getContextLists(){
    return { activeContextList, inactiveContextList };
}
// ------------------------------------------------------------------------------------------
function xxLog_In( contextTag, logType, ...args){

}
function xxLog_Out( contextTag, logType, ...args){
    
}
// ========================================================================================== 
function xxLog( contextTag, logType, ...args ){


    // Get file and line number of caller function
    let {fileName, lineNumber} = getStackInfo(4);

    // First parameter of args is the type of log, which controls
    // color on console.log messages. The type of log is added by 
    if(logType==="LOG") logType="";
    let sLogType = "";
    let bCloseLine = 0;
    if(logType.length>0){
        
        sLogType = `[--${logType}--]` ;
        bCloseLine = 1;

    };

    
    // Define the tag for the current timestamp and module
    let xhhmmss = hhmmss();
    let newTag = `|${xhhmmss} ${fileName} ${sLogType}`; 
    newTag +=  contextTag.substring( newTag.length );
    let fnColor = function( tag ){return tag;}
    // Check if the tag has changed since it was last set
    if( newTag !== gLogging.lastLogTag  ){
        // update the tag
        gLogging.lastLogTag = newTag;
        fnColor = logColors[logType]? logColors[logType] : logColors.CONTEXT;

        // output two log bothLog lines to mark the change of tag
        // bothLog("");

        consolelog(fnColor( "_".repeat(newTag.length) + "\n" + newTag ) );
        callbackLog( newTag );
        

    };

    bothLog(lineNumber + currentIndent, ...args );

    if( bCloseLine )  {
        consolelog(fnColor( "********************************" ));
        callbackLog( "********************************" );
    };
};


// ========================================================================================== 
function getStackInfo(index) {
    let stack = new Error().stack.split('\n');
    //console.log(`Index ${index} of the stack:`, stack[index]);
    let fileName = stack[index].slice(  stack[index].lastIndexOf('\\')+1, 
                                    stack[index].lastIndexOf('.js')+3);
    let lineNumber = stack[index].slice(  stack[index].lastIndexOf('.js:')+4, 
                                    stack[index].lastIndexOf(':'));
    return {fileName, lineNumber};
}


// ========================================================================================== 
/**
 * 
 * @returns current time as a string in the form "hh:mm:ss"
 */
function hhmmss(){
    return ( new Date() ).toISOString().substring(11,19);
}

console.log("##< logger");
// == standard functions to be attached to logger ===




if(loggerDebug){
    
    console.log("Testing logger...")
    let testobj = { A: "A", B: "B", C:"C" };
    let logger0 = getLogger("Test");
    let logger1 = getLogger("A");
    let logger2 = getLogger("B");
    let logger3 = getLogger("C");

    function A(){
        let out = logger1.in("Function Am context A");
        logger1("In function A, current loglevel is " + logstackLevel);
        B();
        out();
        return;
    }
    function B(){
        let out = logger1.in("Function B, Context A");
        logger1("In function B, current loglevel is " + logstackLevel);
        logger1("Calling C from B")
        C();
        logger1("Returned from C now in B");
        logger1.error("TEST Reporting error in function B");
        out();
        return;
    }
    function C(){
        let ex = logger3.in("Function C in context C");
        logger3("In function C, current loglevel is " + logstackLevel);
        logger3.warn("TEST reporting warning in function C");
        logger3.object("testObject", testobj);
        ex();
        return;
    }
    
    //logger2.stopLog();
    let endmark = logger0.in("TEST *******")
    A();
    endmark();

    logger0.error("Testing another error", testobj );

    console.log("Finished testing logger");

}