/**
 * Loads a fragment of html rendered from a given data object by a named
 * pug template
 */

const logger = GLOB.util.logger;
const log = logger.getLogger( "loadDiv.js" );
const dynLoad = GLOB.util.mLoad.dynLoad;
const htmlFolder = GLOB.paths.folders.html;

// Log that this module is being loaded
log( "###>>>" );


   // -----------------------------------------------------------------------
   //
   module.exports.load = loadDiv;
   //
   // -----------------------------------------------------------------------


    /**
     *  
     * @param {string} divName Div name to be loaded and run. The div name
     *                          has the suffix .pug added to it before compilation
     * @param {object} data Data to be handed to the pug template
     */
    function loadDiv( divName, data = {} ){
       
        let loadFunction = dynLoad(`${htmlFolder}/${divName}.pug`);
        let html = loadFunction( data );
        return html;

    }