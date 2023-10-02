"use strict";

/*
        Manages dynamic reloading of modules that may change while the server
        is running.
        
        When a module load is first requested using the [dynLoad] function, a 
        reference to that module is saved in a [module dictionary]. Subsequent
        calls check the dictionary first, and return the same reference if it
        was previously loaded. 

        When initially loaded, a watcher task is created that monitors the loaded
        source code for changes. If a change is detected, then the reference
        to the loaded version is deleted from the dictionary, so that next time
        a request is made to [dynLoad] for the same module, it is reloaded from
        the modified file.

        The dynamic loader also handles automatic compilation of pug templates,
        which, by our own convention, end in the string "_template.j.pug" or 
        "_template.pug".

        Pug templates are parsed into javascript functions using pug.compile(),
        so that the loaded template is returned as a function, not a module.

        The template function returns an html string, derived from combining the
        template and data passed to the template function. 
        
        This approach avoids repeated recompiles
        of pug templates, while allowing for changes to be made to the template
        while the app is running, so that the template is automatically recompiled
        on the next request to load.

*/

// Logging function - for testing only
module.exports.log = function( ...args ){ 
                console.log( ...args )
        };

module.exports.verbose = false;


// Internal log function uses the exported function. This allows
// the user of this module to replace the mLoad.log function with their
// own.
function log (...args){
        if( module.exports.verbose ) module.exports.log( '[mLoad]| ', ...args );
};

// Report to the log that this module is being loaded
log( ">>## mLoad.js");

// export the loader functions
//module.exports.statLoad = staticLoad;
        module.exports.dynamic = 
        module.exports.dynLoad = dynamic;

// export the list of dynamic modules currently loaded (for debugging/reporting)
module.exports.moduleList = [];

// USE OF GLOBAL
/** The node module loader does not guarantee that a specific module
 * is loaded only once into the applicaion, so it is possible that this
 * module could be loaded more than once. To avoid the possibility of
 * having two separate copies of mLoad running two separate caches of
 * modules loaded dynamically, the cache of modules is stored in the
 * global object and shared between the two (or more) copies of mLoad.
 */

// Create global MLOAD if not already created
if(!global._MLOAD) global._MLOAD = {};

// Create the empty global dynamic cache if not already created
if( !global._MLOAD.dynamicCache ){ global._MLOAD.dynamicCache = {} };

// Get a local reference to the global dynamic cache
const dynamicCache = global._MLOAD.dynamicCache;

// Get the latest list of modules that have been loaded dynamically
//var moduleList = Object.keys( dynamicCache );

// File system library
const fs = require( "fs" );
// Pug library for compiling pug templates
const pug = require( "pug" );

// Error function if there are compilation errors when trying to
// compile a pug file.
var compileError = null;

// ------------------------------------------------------------------- dynamicLoad
/**
 * Dynamic load monitors the loaded source module after it has been loaded, and deletes
 * the loaded module from the dynamic cache if the source code changes. This means that
 * the module will be reloaded if it is requested again using this dynamic load function.
 * @param {*} modName 
 */
function dynamic( modName ){

        log( `dynamic load requested for ${modName}` );

        let xModule = null;
        let fullModName = modName; 

        // Set pug flag if this is a request to load a  
        // pug template, indicated by [.pug] suffix
        let bPugTemplateRequest = ( fullModName.slice(-4).toLowerCase() === '.pug' );
        

        let resolvedModuleName = null
        try{
                // get the resolved path to the module using [require].resolve function
                resolvedModuleName = require.resolve( fullModName );
                if( module.exports.verbose )  log( `..path is ${resolvedModuleName}` );

                // look for the module with the resolved name in the dynamicCache
                xModule = dynamicCache[ resolvedModuleName ];

        } catch(e) {
                // If a pug template was requested, then return the pug error function
                // If not a pug template, throw an error
                if( module.exports.verbose )  log( `Could not find file ${fullModName}`)
                if( !bPugTemplateRequest ) throw e;

                // If we could not find the pug template, then use an error function
                // instead that returns an error message formatted as html
                xModule = pugErrorFunction( fullModName, e );

        };


        // if the requested module was already loaded into the cache,
        // then return the module with no further action required.
        if ( xModule ){
                if( module.exports.verbose )  log( `Module ${modName} found in the dynamic cache`)
             return xModule ;
        }

        // If the request is for a pug template, then use PUG to compile it 
        // into a javascript function before returning it. 
        if( bPugTemplateRequest ){
                
                if( module.exports.verbose )  log(`Compling pug function ${resolvedModuleName}`);
                try{
                        // Attempt to compile the module into javascript.
                        xModule = pug.compileFile( resolvedModuleName );
                        if( module.exports.verbose )  log(`Pug template compiled into [${ typeof xModule }]`);

                } catch(e) {
                        
                        if( module.exports.verbose )  log(`Error attempting pug compile:`, e );
                        xModule = pugErrorFunction( resolvedModuleName, e );
                }


        } else {
                // Not a Pug template, so load it as a Node module
                if( module.exports.verbose )  log(`Loading node module ${resolvedModuleName}`);
                xModule = require( resolvedModuleName );
                if( module.exports.verbose )  log( `..Module ${resolvedModuleName} has been loaded` );
        }


        // save it in our own cache under the fully expanded name
        dynamicCache[ resolvedModuleName ] = xModule;
        module.exports.moduleList = Object.keys( dynamicCache );

        if( module.exports.verbose ) log( `Module has been saved to dynamic cache, name is ${resolvedModuleName}` );

        try{
          
                // set up the monitoring for the module, so that it is removed from the
                // cache if the source code is changed.
                let watcher = null;
                watcher = fs.watch(
                        resolvedModuleName
                        , { persistent: false } //<< don't continue if the program would otherwise be closed
                        , ( eventType, fileName ) => {
                                
                                // remove references from caches so that on next request it will
                                // be reloaded from the source file.
                                delete dynamicCache[ resolvedModuleName ];
                                delete require.cache[ resolvedModuleName ];

                                if( module.exports.verbose ) log( `Removed ${resolvedModuleName} from the dynamic cache`)

                                module.exports.moduleList = Object.keys( dynamicCache );

                                watcher.close();

                                }
                        );

                        
        } catch(e) {

                // Could not set up watcher, file may not exist
                if( module.exports.verbose ) log( `###### >>> Could not set up watcher for ${resolvedModuleName}!`)

                // remove references from caches so that on next request module will
                // be reloaded from the source file.
                delete dynamicCache[ resolvedModuleName ];
                //delete require.cache[ resolvedModuleName ];

                module.exports.moduleList = Object.keys( dynamicCache );

        }

        return xModule;


} 

/**
 * Returns a function that returns html describing the error that
 * occurred when trying to compile a pug template
 * @param {} moduleName 
 * @param {*} e 
 */
function pugErrorFunction( moduleName, e ){
        log( "Building pugErrorFunction" );
        let nodeutil = require("util");
        let errorData = {
                                errorMessage: e.message
                                , moduleName: moduleName
                                , fullErrorInformation: nodeutil.inspect(e) 
                                
                        };

        compileError = dynamic('./pugCompilationError.pug');
        let errorFunction = 
                function( dataObject ){ 
                        errorData.suppliedData = nodeutil.inspect( dataObject );
                        return compileError( errorData );
                };

        return errorFunction;
}

log("Trying to compile pugCompilationError.pug");
compileError = dynamic('./pugCompilationError.pug');
log("compileError: ", compileError);
log( "##<< mLoad" );

// After loading, switch off verbose mode
module.exports.verbose = false;

module.exports.htmlErrorReport = pugErrorFunction;
