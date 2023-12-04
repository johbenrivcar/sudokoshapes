/**
 * Implements user record management based on email address
 * 
 */

console.log("##>>usersDB")

// Load application global functions and data
require("../GLOB/INIT");

const log = GLOB.util.logger.getLogger( "usersDB" );

const usersDB = require("./DB/usersDB.json");



console.log("##<<usersDB")