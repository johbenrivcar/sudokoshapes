
"use strict";
function ev_log(...params){
    //console.log("[ev]", ...params);
};

const ev_methods = {
    on: ev_registerCB
    , ev: ev_raiseEvent

};

function ev_add(obj){
    Object.assign(obj, ev_methods);
    return obj;
};

/**
 * Method attached to an object to register
 * callbacks for events raised on that object
 * 
 * @param {*} evtype 
 * @param {*} callback 
 * @param {*} cbData 
 * @returns 
 */
function ev_registerCB(evtype, callback, cbData){
    if(!this) throw new Error("Cannot register event callback outside of object context");
    
    // check that list of event types has been created
    if(!this.eventTypes) this.eventTypes = {};

    // get list of callbacks for this event type
    let reg = this.eventTypes[evtype];

    // create it if it does not exist
    if(!reg) reg =  this.eventTypes[evtype] = [] ;

    // add callback to beginning of list, so
    // that the latest callback to be 
    // registered will be called back first
    reg.unshift( { f: callback,
                d: cbData} );

    return this; // to allow chaining
};

/**
 * Function called to propagate an event from
 * an object. The function finds the list of
 * callbacks that have been registered for the
 * given event type, then calls them in turn,
 * passing the event data plus any callback data
 * that was registered with the callback function.
 * @param {string} evKey 
 * @param {*} evData 
 * @returns 
 */
function ev_raiseEvent(evKey, evData){
    let o = this;
    // check for registered event types
    if(!o || !o.eventTypes) return o;

    //ev_log(`..Checking ${evKey}.*`);
    ev_doCallbacks(evKey, evData, o.eventTypes[evKey] );
    if( ev_doCallbacks(evKey, evData, o.eventTypes["!"+evKey]) ){
        delete o.eventTypes["!"+evKey];
    }

    let testKey = evKey
    while(testKey.length){
        // find callbacks for this event type, if any,
        // that have a wildcard setting in the key hierarchy
        ev_doCallbacks(evKey, evData, o.eventTypes[ testKey + ".*"] );
        //ev_log(`..Processed ${testKey}.*`);
        let otKey = "!"+testKey+".*"
        if( ev_doCallbacks(evKey, evData, o.eventTypes[otKey]) ){
            //ev_log(`..Processed ${otKey}`);
            delete o.eventTypes[otKey];
        };
        // removes the last dot, if any, and everything after it
        testKey = testKey.replace( /\.?[^\.]*$/, "");
    }
    return o;
}
var ev_cb_number = 0;
function ev_doCallbacks(evKey, evData, cbs ){
    if(cbs){
        // Call every callback
        cbs.forEach( (cb)=>{
            ( async function(){ await cb.f( evKey, evData, cb.d ); return true })()
            }
        )
        //ev_log(`Running cb #${++ev_cb_number}` );
        return true;
    }
    return false;
}

