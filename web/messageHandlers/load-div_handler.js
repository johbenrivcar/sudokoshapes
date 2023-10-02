
"use strict";
/*
    Handles the request to load a div whose handler is
    named in the message.

    The request contains these parameters:
    - page - this is the page context for the div, and is optional. If given it indicates 
             that the div files (data loader and pug template) are to be found in the 
             same folder as the page, i.e. in /web/pug/pages/

    The div handler loads the required data and
    constructs the html to be shown in the
    div.
    
    The incoming message also indicates which div
    the html is to be shown in.

*/
const globUtil = GLOB.util;
const getUID = globUtil.getUID;
const log = globUtil.logger.getLogger( "load-div_handler" );
const { dynamic, htmlErrorReport } = globUtil.mLoad;

const FOLDERS = GLOB.paths.folders;
const divsFolder = FOLDERS.pug + "divs/"

//const loaderPath = `${settings.folders.pugDivs}login_template.pug`;
//log( "LoaderPath:", loaderPath);


module.exports.handleMessage = handleMessage;

/**
 * Called by the dispatcher to handle a websocket message type [get-login-form].
 * Async function that has no return value, so the responsibility for sending
 * the response to the websocket rests within this function.
 * 
 * @param {} ws 
 * @param {*} msg 
 * @param {*} replyMsg 
 */
async function handleMessage( ws, msg, replyMsg ){
    log(`>> handleMessage`, msg);

    // divname is the name of the div loader to be used
    // targetDiv is the div in the page into which the
    // loaded html will be sent.
    let{ divName, targetDiv, divTarget } = msg
    msg.divNonce = replyMsg.divNonce = getUID().substr(5,5);

    // The div target is the id of the page element where the
    //  html div element will be inserted when it is sent back
    // to the client. The default is <div id="body_div">
    if(!divTarget) divTarget = targetDiv? targetDiv: "body_div";

    // Change the status bar message
    ws.sendJSON( 
        {
        msgType: "status"
        ,status: `Loading div ${divName} into ${divTarget}`
        ,classes: "  box "
        } 
    );

    // Construct the name of the file that contains the code to 
    // load data for this div, /pug/divs/divname/divname_loader.js
    let divLoaderPrefix = `${divsFolder}${divName}/${divName}`
    let divDataLoaderPath = `${divLoaderPrefix}_loader.js`

    // The dynamic function will perform the pug compilation
    // the first time the file is loaded, or if the file
    // has been modified since the last time it was loaded.
    let divDataLoader = null;
    try{
        log("Try loading", divDataLoaderPath);
        divDataLoader = dynamic(divDataLoaderPath);
        log(".. module loaded") 

    } catch(err){
        //log(".. error on loading requested module", err);
        let errReporter = htmlErrorReport( divName, err );
        let html = errReporter(err) ;
        ws.sendJSON( {msgType: "error"
                        , err
                        , html
                    })
        return null; 
     }

    log(`Loaded data loader ${divDataLoaderPath}`);

    
    let divData = await divDataLoader.getDivData( ws, msg, replyMsg );

    if(!divData) divData = {};


     divData.divNonce = getUID().substr(4,6);
     divData.divName = divName;
     divData.divTarget = divTarget;

    log.object("LOADED DIV DATA", divData );

    // First check if the loader also sent the reply message.
    if( replyMsg.hasBeenSent ) return null;

    // Now get the html message template from the pug div folder
    let pugDivTemplatePath =  divLoaderPrefix + `_template.pug` 
    let pugDivTemplate = dynamic(pugDivTemplatePath);
    let divHtml = pugDivTemplate( divData );

    log(`Finished loading the div html from ${divDataLoaderPath}`);

    log.object("returned html", divHtml);

    Object.assign(replyMsg, {
        msgType: "div",
        divName,
        divTarget,
        html: divHtml
    }) ;

    replyMsg.send();

    

};