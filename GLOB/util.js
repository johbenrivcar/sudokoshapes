

"use strict";

console.log("##> util");

const rexUnderscoreCheck = /(^_|_$)/;
var _log, _logError;

function log(...args){
    if(!_log) {
        _log = GLOB.util.logger.getLogger( "GLOBUtils" );
        logError = _log.error;
    }
    _log(...args);
}

function logError(...args){
    if(!_logError) {
        _logError = GLOB.util.logger.getLogger( "GLOBUtils" ).error;
    }
    _logError(...args);
}

const dummyFunction = function(){ return null };

if( GLOB.silent ) _log = dummyFunction;

class PromiseMonitor {
    constructor(prm){
        this._status = "pending";
        this._pending = true;
        this._resolved = false;
        this._rejected = false;
        this._errored = false;
        this._result = null;
        this._reason = null;

        prm
            .then( (result)=>{  
                        //log("PromiseMonitor: resolved")
                        this._status = "resolved"; 
                        this._resolved = true; 
                        this._pending = false; 
                        this._result = result;
                    } 
                , (reason)=>{ 
                        this._status = "rejected";
                        this._pending = false;
                        this._rejected = true;
                        this._errored = reason instanceof Error ; 
                        this._reason = reason;
                        // if( this._errored ){
                        //     log("PromiseMonitor: error") 
                        // } else {
                        //     log("PromiseMonitor: rejected") 
                        // }
                    } 
                );
    }

    get status(){ return this._status; };
    get pending(){ return this._pending; };
    get resolved(){ return this._resolved; };
    get rejected(){ return this._rejected; };
    get errored(){ return this._errored };
    get result(){ return this._result };
    get reason(){ return this._reason };
    
};



   // ========================================================================================== simpleClone

    /**
     * Returns a simplified clone of a given object. The clone
     * excludes any functions and empty objects {}
     * Objects are cloned to a depth by using the function recursively. 
     * By default there is a limit of 10 on the depth of recursion 
     * although this can be increased by passing a higher number as 
     * maxDepth parameter. 
     * Members of the object may be excluded by providing a regexp 
     * that matches the pattern(s) of the key(s) to be excluded, or 
     * a string that matches a the keys exactly (case-sensitive).
     * Any key that begins or ends in underscore _ is not cloned. 
     * The key is excluded from the cloned object.
     * Functions are not copied.
     * @param {*} pObject 
     * @param {*} params Object that contains parameters: 
     *              excludeKey  - see above
     *              maxDepth    - see above
     *              currentDepth - set only internally to keep 
     *                             track of recursion
     */
    function simpleClone( pObject, params = {} ){

        // If nothing is given, return null
        if( !pObject ) return null;

        let  bExclude ;
        let { excludeKey, maxDepth = 10, currentDepth = 1 } = params ;

        // if( !maxDepth ) maxDepth = 10;
        // if( !currentDepth ) currentDepth = 1;

        // If a string, return the string
        if( typeof pObject === "string" ){

            return pObject;
        }

        // If a date, return a copy of the date
        if ( pObject instanceof Date ) 
            return new Date( pObject );
    
        // If a function, return a placeholder for the function with its name for Information only
        if ( pObject instanceof Function )
            return `[FUNCTION: ${pObject.name}]`;


        // If an array, construct a copy of the array
        if( Array.isArray( pObject ) ){
            // Empty copy
            let newA = [];
            // Check each item in the array, using simpleClone recursively
            pObject.forEach( item=>{
                let xo = simpleClone( item, excludeKey, maxDepth, currentDepth + 1 );
                // Even if the returned item is null, push it ( to preserve indexing )
                newA.push( xo );
            })

            //if ( maxDepth == 1) console.log( "RETURNING CLONE" , newA )
            return newA;
        } 
    
        // If an object other than array, then clone the object
        if ( typeof pObject == "object" ){
            
            // If this object is too deep in the hierarchy, then return a placeholder only, (for information)
            if( currentDepth > maxDepth ) return `[OBJECT NESTING TOO DEEP, Max depth is ${maxDepth}]` ;

            // New empty object
            let newO = {};

            // get all the keys and process them one by one
            let keys = Object.keys( pObject );
            keys.forEach( K => {
                // does the name begin or end with an underscore, if so we do not copy it
                bExclude = rexUnderscoreCheck.test(K);
                
                // check if the key matches the exclude pattern first
                if(!bExclude) if( excludeKey ){
                    // Is the excludeKey a regex or just a string?
                    if( excludeKey instanceof RegExp ){
                        bExclude = excludeKey.test( K );

                    } else if( typeof excludeKey === "string" ){
                        bExclude = ( excludeKey == K )
                    }
                }

                // if the key is excluded then do not add it
                if( bExclude ) return;
                
                // Get the value of the Key
                let po = pObject[K];

                // If it is a function discard it
                if(  po instanceof Function  ) { return ; } 

                // If it is a date, put a copy of the date into the object
                if( po instanceof Date ) { newO[K] = new Date( po ) ; return ; }
                
                // If it is an object or an array, then clone it recursively
                if( typeof po == "object" || Array.isArray( po ) ) { 
                        // Notice how we increment the depth
                        let xo = simpleClone ( po, excludeKey, maxDepth, currentDepth+1 ) 
                        // If nothing was returned, then do not set anything on the clone
                        if( !xo ) return;
                        // Check that something was returned from the clone
                        newO[K] = xo;
                        return;
                    } 
                // Whatever it is, just set it on the new object;
                newO[K] = po;
                return;

            })
    
            // Check if we have an object with no keys, if so do not clone it
            if ( Object.keys( newO ).length == 0 && currentDepth > 1 ) return null;

            // Return the newly-constructed copy
            return newO;
        
        } 
        
        // some other elementary type that we do not need to clone, so just return its value.
        return pObject;
    
    }


    // ========================================================================================== getRandom
    function getRandom(max){
        return Math.round( Math.random()*max )
    }

    // ========================================================================================== r255
    function r255() { return getRandom(255) };


    // ========================================================================================== hhmm
    function hhmm( ddd ){ 
        
        if( !ddd ) ddd = new Date();
        var sDts = ddd.toISOString();
        return sDts.substr(11,5);
    }

    // ========================================================================================== hhmmss
    function hhmmss( ddd ){ 
        
        if( !ddd ) ddd = new Date();
        var sDts = ddd.toISOString();
        return sDts.substr(11,8);
    }

    // ========================================================================================== yyyymmdd_hhmmss
    function yyyymmdd_hhmmss( ddd ){
        if( !ddd ) ddd = new Date();
        var sDts = ddd.toISOString();
        return sDts.substr(0, 4) + sDts.substr( 5, 2) + sDts.substr(8, 2) + "_" + sDts.substr(11,2) + sDts.substr(14,2) + sDts.substr(17,2);
    };

    function dts(){
        return yyyymmdd_hhmmss()
    };
    
    function dateAndTime(ddd){
        let dt = yyyymmdd_hhmmss(ddd).split("_")
        return { date: dt[0], time: dt[1].substring(0,4) }
    };

    
// ========================================================================================== getUID
/**
 * Generates a 36-character UID in standard format
 */
function getUID(){
    var dt = new Date().getTime();
    var uuid = 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = (dt + Math.random()*16)%16 | 0;
        dt = Math.floor(dt/16);
        return (c=='x' ? r :(r&0x3|0x8)).toString(16);
    });
    return uuid;
}

function nonce(l=5){
    if(!l)l=5;
    return getUID().substring(0,5);
}
function parseWSMessage( wsmsg ){
    //log("parseWSMessage", wsmsg);
    let oMsg = null;
    try{
        oMsg = JSON.parse( wsmsg );
        //log("after JSON.parse", oMsg);
        preprocessJSON( oMsg );
        //log("after preprocessJSON", oMsg);
    } catch(e) {
        oMsg = {
            msgType: "not_json"
            , msg: wsmsg
            , e: e
        }
    }
    return oMsg;
}

// ========================================================================================== util_preprocessJSON
/**
 * Takes an object or any item that has been constructed using JSON.parse(), and converts all data
 * items whose string values can be represented as valid JS types. The data values are changed in situ
 * if the top-level entry is an object, and the converted value/object is also returned.
 * @param {*} entry 
 */
function preprocessJSON( entry ){
    //console.log( "preprocessing", entry);
    // Pre-process the body to convert text values that are numbers, boolean
    // or dates into corresponding types.

    switch( typeof entry ){
        case "number": return entry;
        case "string": return stringToElementaryType( entry );
        case "object":
            if( !entry ) return null;
            // forEach method indicates an array
            if( entry.constructor )
                if( entry.constructor.name === "Date" ) return entry;

            if( entry.forEach ){
                try { 
                    entry.forEach( (item, index)=>{
                            entry[index] = preprocessJSON( item );
                        })
                    return entry;
    
                } catch (e) {
                    console.error( e )
                    return null;
                };
    
            }

            // otherwise go through members of the object
            for( let [key, value] of Object.entries( entry )){
                entry[key] = preprocessJSON( value )
            }
            return entry;
        
    }

}

    // ======================================================================================================= stringToElementaryType
    function checkInt(xx){
        let int_regexp = /^-?(0|[1-9]\d*)$/g                 // regular expression to check integer value
        return int_regexp.test( xx )
    }
    function checkDecimal(xx){
        let dec_regexp = /^-?(0|[1-9]\d*)(\.\d+)?$/g         // regular expression to check for decimal (n.n) value
        return dec_regexp.test( xx );
    }
    /**
     * Recasts a string as one of the javascript basic types, by checking convertibility. If no
     * conversion is possible returns the string. Types are Integer, Number (Float), Boolean and Date
     * @param {*} xxx String to be converted to an elementary type if possible.
     */
    function stringToElementaryType( xxx ){
        //console.log( "string", typeof xxx , xxx)
        if( xxx.length === 0 ) return xxx;
        if(checkInt( xxx )) return parseInt( xxx ); 
        if(checkDecimal( xxx )) return parseFloat( xxx );
        switch(xxx){
            case "null": return null;
            case "true": return true;
            case "false": return false;
            default: return xxx;
        }

        
    };

module.exports = {
    simpleClone
    , getRandom
    , r255
    , hhmm
    , hhmmss
    , yyyymmdd_hhmmss
    , dateAndTime
    , dts
    , getUID
    , nonce
    , preprocessJSON
    , parseWSMessage
    , PromiseMonitor: PromiseMonitor

}

console.log("#<< util")