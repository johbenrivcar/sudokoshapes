/**
 * All the values in this module's exports object are set by the INIT module
 */
let {ROOT, rootify} = require("./appRoot");

if(!global.GLOB){
    const g = {
        initDone : false
        , verbose : true
        , util: null
        , ROOT

        , _LOGGER: null
        , logging: null
        , EVENTS: null
        , settings: null
        , rootify
        , pathTo: function pathTo(path){
            let pp = g.settings.paths.folders[path];
            console.log(`pathTo(${path})=${pp}`);
            return pp;
        }
    }
    global.GLOB = g;
}


module.exports = global.GLOB;
