/* 
==============================================
Loads the settings.json file in root folder and returns it
==============================================
*/

"use strict";

console.log(`SKS SERVER STARTING ${ new Date().toISOString() }\n\n`.black.bgCyan + `\n##> INIT #############################################################################################################`);

const appRoot = require(  "./appRoot" );
const {rootify, ROOT} = appRoot;
console.log("INIT: ROOT: " + ROOT);
var settings_json = {};
var localSettings_json = {};

if(!global.GLOB){
    
    settings_json = require( ROOT + "/settings.json");
    try{
        localSettings_json = require( ROOT + "/settingsLocal.json");

        console.log("INIT: Applying Local Settings", localSettings_json)
        applyLocalSettings()
        
        console.log("INIT: >>>>>>>>>>>>>>>>>>>>>>>>>>>> SETTINGS <<<<<<<<<<<<<<<<<<<<")
        rootifyAllSettings()
        console.log("INIT: >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>><<<<<<<<<<<<<<<<<<<<<<<<<<")
        console.log("INIT: SETTINGS DONE")
    } catch(e){
        // Do not apply any local settings
        console.log("INIT: There are no local settings to be applied");
    };

    // Settings object is also saved to the global variable GLOB , which means that
    // it can be referenced anywhere (in caps) without needing to load.

    let glob = module.exports = global.GLOB = settings_json;

    glob.ROOT = ROOT;

    // Set utility functions library module
    glob.util = require( "./util");

    // Add runtime instance values to util properties and methods
    let gTU = glob.util;

        gTU.appRoot = appRoot;
        console.log ("INIT: Initializing logger");

        gTU.logger = require( "./logger" );

        console.log ("INIT: nitializing mLoad")
        gTU.mLoad = require( "./mLoad" );
        
        //gT.DBService = require( ROOT + "/database/dbService_mongo" ) ;

    // Add the events subsystem to the glob
    glob.EVENTS = require( "./events")({});


    console.log("INIT: global.GLOB", glob);

    let log = gTU.logger.getLogger("INIT");
    log("UTIL GLOBALS LOADED");

    log.object("global.GLOB", GLOB);

}





//======================================================================= utility functions
function rootifyAllSettings( a = settings_json , indent = "|->", iLevel = 0 ){

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

function applyLocalSettings( a = localSettings_json, b = settings_json , indent = "|" ){
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