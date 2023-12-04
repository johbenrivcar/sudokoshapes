"use strict";

const grids = require("./gridsDB" );

let allGrids = grids.allGrids();

console.log( allGrids );

let gg = grids.getGridByID("abcd");

console.log( gg );

console.log( allGrids );
let params={ gridSpec: {gridString: "826397145594218376173456289932674851615983427748125693487531962251869734369742518" } };
let ng = new grids.GRID( params )
console.log( ng.gridSpec() )
