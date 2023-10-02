"use strict";

module.exports.loadPage = loadPage;

const log = GLOB.util.logger.getLogger( "test1_loader");
log(">> LOADING");
// const mLoad = require( ROOT + "/util/mLoad" );

// const dynLoad = mLoad.dynLoad;
// const settings = require( ROOT + "/util/settings");

// // Resolve the path to the pug template in the current root folder
// const templatePath = require.resolve( `./test1_template.pug` ) ;


async function loadPage( loaderContext ){
    //let {req, res, pugTemplatePath, data } = loaderContext;
    
    var data = loaderContext.data;

    var { dts= new Date() } =  loaderContext.data;
    let [date, time]  = dts.toISOString().split(".")[0].split("T");

    log(dts.toISOString(), date, time);
    data.date=date;
    data.time=time;
    
    log.object( "data for test1 page", data );

    return loaderContext;

    // log(`Load page, template: ${templatePath}`);

    // let template = dynLoad( templatePath );

    // res.send( template( data ) ).status(200).end();

    // // return null to ensure that the loader function does
    // // not send the page again.
    // return null;
}