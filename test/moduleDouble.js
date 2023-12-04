"use strict";

    // Check if thisModule has already been loaded
    if(!global.MYMODULES) global.MYMODULES = {};
    if(global.MYMODULES.thisModule){

         // issue a warning and use the original module
         console.log("*****\n*   WARNING: [thisModule.js] is being required from somewhere using module path or module name with the wrong case - INVESTIGATE!!!\n*****");
         module.exports = global.MYMODULES.thisModule;
    
    } else {

        if(!global.instanceCount){ global.instanceCount=0};

        const myInstance = ++global.instanceCount

        module.exports.instance = myInstance;

        console.log(`Instance created #${myInstance}`);


        global.MYMODULES.thisModule = module.exports;
    };