"use strict";

const grids = require("./grids" );

let allGrids = grids.allGrids();

console.log( allGrids );

let gg = grids.getGrid("abcd");

console.log( gg );

console.log( allGrids );