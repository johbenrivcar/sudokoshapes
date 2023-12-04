
"use strict";

let moduleName1 = "moduleDouble"
const m1 = require("./moduleDouble");
console.log(`m1 is #${m1.instance}`);

let modulePath2 = "d:/githubrepositories/sudokushapes/test/"
let moduleName2 = "moduleDouble.js"
const m2 = require(modulePath2 + moduleName2);

console.log(`m2 is #${m2.instance}`);


let modulePath3 = "D:/GitHubRepositories/sudokushapes/test/"
let moduleName3 = "moduleDouble.js"
const m3 = require(modulePath3 + moduleName3);

console.log(`m3 is #${m3.instance}`);

let modulePath4 = "D:/GitHubRepositories/sudokushapes/test/"
let moduleName4 = "moduledouble.js"
const m4 = require(modulePath4 + moduleName4);

console.log(`m4 is #${m4.instance}`);