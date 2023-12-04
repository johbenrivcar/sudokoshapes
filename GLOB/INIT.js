/* 
==============================================
Loads the settings.json file in root folder and returns it
==============================================
*/

"use strict";

// Create the global GLOB object, if not already created
const GLOB = require("./GLOB");


require("colors");

console.log(`SKS SERVER STARTING ${ new Date().toISOString() }\n\n`.black.bgCyan + `\n##> INIT ###################`);

// Establish the root folder of this application
const {rootify, ROOT} = require(  "./appRoot" );

GLOB.ROOT = ROOT;
GLOB.rootify = rootify;

console.log("INIT: ROOT: " + ROOT);

var settings = {};
var localSettings = {};

if(!GLOB.initDone){
    
    settings = require( ROOT + "/settings.json");
    try{
        localSettings = require( ROOT + "/settingsLocal.json");

        console.log("INIT: Applying Local Settings", localSettings)
        applyLocalSettings()
        
    } catch(e){
        // Do not apply any local settings
        console.log("INIT: There are no local settings to be applied");
    };

    console.log("INIT: >>>>>>>>>>>>>>>>>>>>>>>>>>>> SETTINGS <<<<<<<<<<<<<<<<<<<<")
    
    rootifyAllSettings()

    console.log("INIT: >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>><<<<<<<<<<<<<<<<<<<<<<<<<<")
    console.log("INIT: SETTINGS DONE")
    // Settings object is also saved to the variable GLOB , which means that
    // it can be referenced anywhere (in caps) without needing to load.

    module.exports = settings;

    GLOB.ROOT = ROOT;

    GLOB.settings = settings;

    // Set utility functions library module
    GLOB.util = require( "./util");

    // Add runtime instance values to util properties and methods
    let gUtil = GLOB.util;

        console.log ("INIT: Initializing logger");

        gUtil.logger = require( "./logger" );

        console.log ("INIT: nitializing mLoad")
        gUtil.mLoad = require( "./mLoad" );
        
        console.log ("INIT: initializing pugLoader")
        gUtil.pugLoader = require("./pugLoader")
        
        //gT.DBService = require( ROOT + "/database/dbService_mongo" ) ;

    // Add an empty global events subsystem to the GLOB
    GLOB.EVENTS = require( "./events")({});

    GLOB.initDone = true;


    // local logger function
    let log = gUtil.logger.getLogger("INIT");

    log("UTIL GLOBALS LOADED");

    if(GLOB.verbose) log.object("GLOB", GLOB);
    
}





//======================================================================= utility functions
function rootifyAllSettings( a = settings , indent = "|->", iLevel = 0 ){

    let sKeys = Object.keys(a);
    //console.log(indent + "[rootify keys>", sKeys);

    sKeys.forEach( (settingKey)=>{
        //console.log(indent + ">" + settingKey + `(${ typeof a[settingKey] })`);
        if(typeof a[settingKey] == 'object'){
            //console.log(`${indent}${settingKey}`)
            rootifyAllSettings( a[settingKey], "| " + indent, iLevel + 1);
        } else if(typeof a[settingKey] == "string"){
            let v = a[settingKey];
            let rv = rootify(v);
            a[settingKey] = rv ; 
            //console.log( `${indent}${settingKey}="${rv}"`);
        } else {
            let v = a[settingKey];
            //console.log( `${indent}${settingKey}=${v}` );
        } ;
    })
    if (iLevel==0) console.log (a);
}

function applyLocalSettings( a = localSettings, b = settings , indent = "|" ){
    let skeys = Object.keys(a)
    skeys.forEach( (key)=>{
        if( typeof a[key] == 'object' ){
            console.log(`${indent}${key}`);
            if( !b[key] ) b[key] = {} ;
            applyLocalSettings( a[key], b[key], "| " + indent );

        } else {
            console.log(`${indent}${key}="${a[key]}"`);
            b[key] = a[key];
        }
    })
}


console.log("##< INIT");