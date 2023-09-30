"use strict";

/**
 * Simple utility module that encrypts or decrypts a string using a
 * given encryption key.
 */

const DEFKEY = '98lcvzxxvjzoierqw9038skjodx9r8sa';
const log = GLOB.util.logger.getLogger("stringEncryptor");


const crypto = require("crypto");

function hash(strToBeHashed){
    try{
        log(`Hashing string ${strToBeHashed}`);
        return crypto.createHmac( 'sha256', strToBeHashed ).digest('hex');

    } catch(e) {
        log.error( "Failed to calculate hash on pw string");
        return strToBeHashed;
    }
    //return strToBeHashed;
};

function encrypt( strDecr, key = DEFKEY ){
    // This function is dummy and currently returns the unencrypted string    
    return strDecr;
};

function decrypt( strEncr, key = DEFKEY ){
    // This function is dummy and currently returns the encrypted string
    return strEncr;
};


module.exports={ encrypt, decrypt, hash };
