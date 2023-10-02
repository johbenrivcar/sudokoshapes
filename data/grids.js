"use strict";
require("colors");
require("../GLOB/INIT");
let getUID = GLOB.util.getUID;
console.log(getUID());

const grids = require("./grids.json");

module.exports.getGrid = getGrid;
module.exports.allGrids = getAllGrids;

function getAllGrids(){
    return grids;
}

let GRID = function Grid(id){

    if(!id)id=newUID
    this.grid={
      "r1": "123456789"
    , "r2": "456789123"
    , "r3": "789123456"
    , "r4": "234567891"
    , "r5": "567891234"
    , "r6": "891234567"
    , "r7": "345678912"
    , "r8": "678912345"
    , "r9": "912345678"

    };
    this.info={
        date: (new Date()).toISOString().substring(0,10)
    };
    this.analysis={

    }
}

function getGrid(id){
    if(!grids[id]){grids[id]=new GRID(id); }
    return grids[id];

};

function saveGrid(g){
    g = GLOB.util.simpleClone(g);
    let id = g.id;
    if(!id) g.id = id = getUID();
    grids[id]=g
    return g;
}

function saveAllGrids(){

}