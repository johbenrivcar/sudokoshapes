

const tA = require("./exportTestA")
const tB = require("./exportTestB")

console.log(tA);

console.log(tB);

tB.testB("A value");

console.log(tA);

tB.added = "This is added";

tB.report();
