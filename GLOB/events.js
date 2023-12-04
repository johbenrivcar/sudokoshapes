"use strict";

const GLOB = require("./GLOB");

/**
 * Module provides an event system for subscribing to events using
 * a hierarchical event key structure.
 * 
 * 
 * 
 * The global EVENTS object is made available in GLOBAL.EVENTS
 * 
 */
var verbose = false;
const xlog = GLOB.util.logger.getLogger("events");
function log(...args){
    if(verbose) xlog(...args);
};

function logError(...args){
    xlog.Error(...args);
};

const fs = require("fs");

module.exports = eventHandler;

const event_types_json = require("./event_types.json");
const { yyyymmdd_hhmmss: timeStamp } = GLOB.util;

 const event_methods = {
     on: registerCallback
     , ev: raiseEvent
 
 };
 
 /** 
  * This method adds event handler methods to an object so that it provides
  * a function to register a callback for events raised by this object, and
  * also a function for raising an event.
  * @param {jhgjhg} obj 
  * @returns 
  */
 function eventHandler(obj){
     Object.assign(obj, event_methods);
     return obj;
 };
 

 /**
  * Method attached to an object to register
  * callbacks for events raised on that object when the ev method
  * is called.
  * 
  * @param {*} evType 
  * @param {*} cbFunction 
  * @param {*} cbData 
  * @returns 
  */
 function registerCallback(evType, cbFunction, cbData){
     if(!this) throw new Error("Cannot register event callback outside of object context");
     
     // check that list of event types has been created
     if(!this.eventTypes) this.eventTypes = {};
 
     // get list of callbacks for this event type
     let reg = this.eventTypes[evType];
 
     // create it if it does not exist
     if(!reg) reg =  this.eventTypes[evType] = [] ;
 
     // add callback to beginning of list, so
     // that the latest callback to be 
     // registered will be called back first
     reg.unshift( { f: cbFunction,
                 d: cbData} );

     if(evType.slice(0,1)==="!") evType = evType.slice(1);
     if(evType.slice(-2)===".*") evType = evType.slice(0,-2);
     if( !event_types_json[evType] ) addEventTypeToList(evType);

     return this; // to allow call chaining
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
 
var ev_number = 0;
 function raiseEvent(evKey, evData={} ){
     
    if(!this) throw new Error("Cannot raise event outside of object context");

    //Assign the next event serial number
    evData._eventNumber = ++ev_number;

     let o = this;

     if(!event_types_json[evKey]) addEventTypeToList(evKey);

     // check for registered event types on this object
     if(!this.eventTypes) this.eventTypes = {};

     // get list of callbacks for this event type if any
     let reg = this.eventTypes[evKey];
    
     // Check if nothing has been registered
     if(!reg) return this;

     //log(`..Checking ${evKey}.*`);
     doCallbacks(evKey, evData, this.eventTypes[evKey] );
     if( doCallbacks(evKey, evData, this.eventTypes["!" + evKey] ) ){
         delete this.eventTypes["!"+evKey];
     };
 
     let testKey = evKey
     while(testKey.length){
         // find callbacks for this event type, if any,
         // that have a wildcard setting in the key hierarchy
         doCallbacks(evKey, evData, o.eventTypes[ testKey + ".*"] );

         //log(`..Processed ${testKey}.*`);
         let otKey = "!"+testKey+".*"
         if( doCallbacks(evKey, evData, o.eventTypes[otKey]) ){
             //log(`..Processed ${otKey}`);
             delete this.eventTypes[otKey];
         };
         // removes the last dot, if any, and everything after it
         testKey = testKey.replace( /\.?[^\.]*$/, "");
     }

     return this;
 }

 function doCallbacks(evKey, evData, cbs ){

     if(cbs){
         // Call every callback
         cbs.forEach( (cb)=>{
            cb.f( evKey, evData, cb.d ); 
         } );
         return true;
     }
     return false;
 };
 
 function addEventTypeToList( evType ){
    if( !evType.slice(0,1)!=="!" && !event_types_json[evType] ) event_types_json[evType] = `Unknown - first used ${timeStamp()}`
    let evTypes = JSON.stringify( event_types_json , null, 2 );
    //if(evTypes.length < 150 ) throw new Error("tried to write short JSON");
    fs.writeFile( GLOB.ROOT + '/util/event_types.json', evTypes, ()=>{ return; });
 };

