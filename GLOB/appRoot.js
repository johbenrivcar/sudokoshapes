"use strict";
console.log('##>> appRoot.js')
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
//
//      THIS MODULE CANNOT USE LOGGER BECAUSE IT IS 
//      INVOKED BFORE LOGGER FUNCTIONS ARE DEFINED
//
// ---------------------------------------------------------------


// If the root folder path has not yet been set, 
// then establish where it is. This is done by finding
// the first parent folder, starting from the current folder,
// that contains a file named "package.json". The thinking
// is that "package.json" is the file used by npm when loading
// libraries, and npm always expects this to be in the
// root folder. Of course this logic breaks if there happens
// to be another parent folder reached before the real root folder,
// that contains a file named package.json, so care is required
// to follow conventions.

    // --------------------------------------------------
    // This regular expression looks for the
    // pattern at the start of a path string
    // that indicates the root folder is needed:
    // ^/path, ^path, or ROOT/path
    // rootify() is used to substitute the actual
    // root path for the keyword
    let rootPattern = /^\^\/|^\^|^ROOT\//;

    let rootFolder = null;

    // split the path to this module into folders array
    let bits = __dirname.split( "\\" );
    
    let rootOK = null;

    var testPath;

    do {
        
        // recreate the folder path from the bits
        testPath = bits.join("/");
        

        try{
            
            // check if the file exists in this folder
            rootOK = require.resolve ( `${testPath}/package.json` );

        } catch(e) {
            
            // remove the last item in the bits array
            bits = bits.slice( 0, bits.length-1 )
        }


    } while ( bits.length > 1 && ! rootOK );


    // check if the root folder was found
    if ( !rootOK ) {
        rootFolder = null;
        throw new Error( `Could not find root folder starting from path: [${__dirname}]` );
    }

    // Now we know the root folder path
    rootFolder = testPath;


/** rootify
 * Adds the root path to a given path if the 
 * path starts with "^" or "ROOT/". This create
 * a path to a file relative to the root 
 * folder, not relative to the current
 * folder, which is the default in node.js.
 * @param {*} path 
 */
function rootify( path ){
    
    if( !rootFolder ) throw new Error( "Root path was not found" );

    // if the path contains backslashes, 
    // replace all of them with forward slash
    let normPath = path.replace( /\\/g, "/" ).replace(rootPattern , rootFolder + "/" );

    // Return the path as required
    return normPath;

};




module.exports.rootify = rootify;
module.exports.ROOT = rootFolder;


console.log('##<< appRoot.js')