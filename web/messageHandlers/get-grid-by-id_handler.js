
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

const pugLoader = globUtil.pugLoader;

const log = globUtil.logger.getLogger( "get-grid-by-id_handler" );
const { dynamic, htmlErrorReport } = globUtil.mLoad;

const gridsDB = require("ROOT/data/gridsDB");


const FOLDERS = GLOB.settings.paths.folders;

module.exports.handleMessage = handleMessage;


/**
 * Called by the dispatcher to handle a websocket message type [get-grid-by-id].
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
    let{ gridID } = msg
    msg.divNonce = replyMsg.divNonce = getUID().substr(5,5);

    // Change the status bar message
    ws.sendJSON( 
        {
        msgType: "status"
        ,status: `Getting grid by id ${gridID}`
        ,classes: "  box "
        } 
    );


    // get the requested json for the grid

    let grid = gridDB.getGridByID( gridID );

    replyMsg.grid = grid;


    replyMsg.send();

    

};