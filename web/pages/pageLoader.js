/*
        This module provides the logic to load a complete page requested from
        a browser, by loading a module that is named for the page name and
        calling the renderPage function of that module. The renderPage function
        will normally load a pug Template function, get some data from the databae, then
        render the html by calling the template function with the data. 

*/

module.exports.load = loadPage;

// refs to global utility modules and functions
const log = GLOB.util.logger.getLogger( "pageLoader" );
const rootify = GLOB.rootify;
const mLoad = GLOB.util.mLoad;

const pugLoader = GLOB.util.pugLoader;

// path to pages folder
const pagesFolder =  GLOB.settings.paths.folders.pages  // /web/pages
//const divsFolder =  GLOB.settings.paths.folders.divs    // /web/divs
//const pugFolder =  GLOB.settings.paths.folders.pug      // /web/pages

// dynamic loader used to load page modules, so that they will
// be reloaded if the module source code is changed.
const dynamic = mLoad.dynamic;
const fsp = require('fs/promises');
const fspStat = fsp.stat;

/**
 * 
 * @param {*} req 
 * @param {*} res 
 */
async function loadPage( req, res ){

    let pageName = req.params.pageName;

    let pageFolderPath = pagesFolder + pageName;
    let htmlFolderPath =     `/` + pageName;
    let loaderPath;
    let pugTemplatePath;

    log(`Checking ${pageFolderPath}`);

    try{
        log(".. getting status using async call")
        stats = await fspStat( pageFolderPath )
        //log.object("..stats", stats);
        if( !stats.isDirectory() ) throw new Error("Not a folder");

        log("...page folder exists")
        loaderPath = pageFolderPath + "/" + pageName + "_loader.js";

        // default template path
        pugTemplatePath = pageFolderPath +  "/" + pageName + "_template.pug"

    } catch(e) {
        // Failed to find  folder, try finding the 
        // loader in the pug pages folder
        
        log("... page loader in pug pages folder - message", e.message );
        loaderPath = pageFolderPath + "_loader.js";

        // default template path
        pugTemplatePath = pageFolderPath + "_template.pug"

    }

    log( `Page path: ${pageFolderPath}`);
    let loader = null;

    // call the loader function, passing request, response and template path
    let loaderContext = { req, res, pugTemplatePath, data: { pageName, dts: new Date(), pageRoot: htmlFolderPath, pugTemplatePath } }
    //log.object("loaderContext", loaderContext );
    try{
        
        // try to get the data loade module.
        log( `Trying to load ${loaderPath}`);

        let loaderpath = require.resolve( loaderPath );
        if( !loaderpath ) throw new Error("No loader was found");

        // load the module using dynamic load
        loader = dynamic( loaderpath );
        
        loaderContext = await loader.loadPage( loaderContext );


        if( !loaderContext ){ return null; }
        
        renderAndSend( loaderContext )
        return null;

    } catch (e) {

        // If there is no data loader, then run render and send with default data object
        log( ">Loader was not loaded successfully", e.message )

        renderAndSend( loaderContext );
        return null;
        
    }



}

/**
 * Given a websocket context and a div name, will retrieve the pug
 * definition for the div, render the div using the supplied data
 * and send the resulting html to the client through the websocket
 * @param {*} wsContext 
 */
async function renderAndWS( wsContext ){

/*
    STEPS
    1. Establish the name of the pug file
    2. Check that the pug exists, if not try to load the equivalent .html file
    3. If found use the pug function and the supplied data to generate html
    4. Using the supplied reference to the websocket connection, send a [div] message 
       to the client as a response to the incoming message
*/
    
}

function renderAndSend( loaderContext ){
    let {req, res, pugTemplatePath, data} = loaderContext;
    let pageName = req.params.pageName;
    log(`>>renderAndSend ${pageName}` );

    try{

        //let modulePath = `${settings.folders.pages}${pageName}_template.pug`;

        let resolvedPath = require.resolve( pugTemplatePath );
        if( !resolvedPath ) throw new Error("Requested page template was not found");

        log( `Loading module ${pugTemplatePath}` );

        // Loading the pug template using dynamic also compiles the template 
        // into a function automatically.
        //let pugTemplateFunction = dynamic( pugTemplatePath );
        
        let pugTemplateFunction = pugLoader.load(pugTemplatePath);
        let html = pugTemplateFunction( data )
        res.send( html ).status(200).end();

    } catch(e) {
        
        // Could not run the pug template, so send an error message instaed
        log("Error on loading/compiling Pug template:\n", e );
        res.send( `<h1>Page not found</h1>The requested page <b>${pageName}</b> was not found.`).status(200).end();

    };
}