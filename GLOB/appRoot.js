"use strict";
/*
    1.  Locates the root folder from any location within the app by
        finding the first parent folder containing [package.json].

    2.  Saves the path to the root in the global variable global.ROOT

    3.  Publishes the function rootify() to add the root path to a given
        string if the string starts with ^, ^/ or ROOT/. This is used
        when loading settings where the setting is a path name relative
        to the root of the application - see /util/settings.js

*/

// ---------------------------------------------------------------
// THIS MODULE CANNOT USE LOGGER BECAUSE IT IS INVOKED FIRST
// ---------------------------------------------------------------


module.exports.rootify = rootify;

// If the root folder path has not yet been set, 
// then establish where it is now. This is done by finding
// the first parent folder, starting from the current folder,
// that contains a file named "package.json". The thinking
// is that "package.json" is the file used by npm when loading
// libraries, and npm always expects this to be in the
// root folder. Of course this logic breaks if there happens
// to be another parent folder reached before the real root folder,
// that contains a file named package.json, but this is unlikely.

// This regular expression looks for the
// pattern at the start of the path
// that indicate the root folder:
// ^/path, ^path, or ROOT/path
// It is used to substitute the actual
// root path for the keyword
    let rootPattern = /^\^\/|^\^|^ROOT\//;

    let ROOT_FOLDER = null;

    // split the path to this module into bits
    let bits = __dirname.split( "\\" );
    
    //console.log( bits );
    let rootOK = null;

    do {
        
        // recreate the folder path from the bits
        var testPath = bits.join("/");
        

        try{
            
            // check if the file exists in this folder
            rootOK = require.resolve ( `${testPath}/package.json` );

            //console.log( `Root found at ${testPath}`)

        } catch(e) {
            //console.log( `Not found at ${testPath}` );
            // remove the last item in the bits array
            bits = bits.slice( 0, bits.length-1 )
        }


    } while ( bits.length > 1 && ! rootOK );

    // check if the root folder was found
    if ( !rootOK ) {
        ROOT_FOLDER = null;
        throw new Error( `Could not find root starting from path: [${__dirname}]` );
    }

    // Now we know the root folder path
    ROOT_FOLDER = testPath;

    // Set the global constant ROOT
    global.ROOT = global.APP_ROOT = ROOT_FOLDER;
    
    



// Export the root folder path
module.exports.ROOT = module.exports.ROOT_FOLDER = ROOT_FOLDER;


/** rootify
 * Adds the root path to a given path if the first character is "^". This allows
 * reference to a file relative to the root folder, not relative to the current
 * folder, which is the default in node.js.
 * @param {*} path 
 */
function rootify( path ){
    //throw new Error("ROOTIFY IS NOT TO BE USED - use ROOT + path instead ");
    if( !ROOT_FOLDER ) throw new Error( "Root path was not found" );

    // if the path contains backslashes, 
    // replace all of them with forward slash
    let normPath = path.replace( /\\/g, "/" ).replace(rootPattern , ROOT + "/" );

    // Return the path as required
    return normPath;

};