
const GLOB = require("./exportTestA");

let data = { testB, report };

module.exports = data;

function testB( value ) {
    GLOB.setByTestB = value;
}

function report(){
    console.log(data );
}