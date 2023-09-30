/*
    Provides in-memory storage of session data for all active
    sessions.

    Sessions are stored in dictionaries that use various unique keys
    to access data. The dictionaries are:

    - by session UID  - a single session against each entry. The sessions are 
                        stored as js objects

    - by browser UID - entries keyed on browser UID, a list of
                        sessionUIDs or objects (TBD) per browser. 

    - by person UID - entries keyed on person UID, a list of
                        sessionUIDs or objects (TBD) per browser.

    Each active session is connected to a client (browser/app) through
    an open websocket. If the websocket closes the session will become
    suspended, until the client reconnects. In the case of an ANON anonymous
    session, the session will be removed altogether - if the client reconnects
    then a new anonymous session will be created.

    When the websocket makes its initial connection, the browserUID is stored
    in an encrypted cookie from the server, using a key that is unique to 
    the websocket. This ensures that a hacker cannot mimic the connection by 
    copying data from the comms between client and server.
    
    This module interacts with the tigerWebUtil (TWU) client-side script,
    which maintains session state at the client. See
    https://docs.google.com/document/d/1Hhokn0OJIkbNcCbZdov-5O5FdOYqzwmqPq_T65lyLZ4/edit#heading=h.z6ne0og04bp5
    for details of session management interaction.

    For sudokushapes app, sessions are stored in a json document on local disk /ws/sessioninfo.json
    SessionInfo is loaded when a client first connects to the server. The creation of a session is automatic
        Server > wsController.getSession(UID) returns the session data.
                        if there is no existing session a new session is opened.
    
*/

    "use strict";

    //require( "promise" );

    const globalUtil = GLOB.util;
    // const LGN_login = require( ROOT + "/database/templates/LGN_Login" );
    const log =globalUtil.logger.getLogger( `sessionManager` );
    
    log( "=>> Loading" );
    const getUID = globalUtil.getUID;
    
    //const DB = require(ROOT + `/database/dbService_mongo`);
    //const EventEmitter = require('events');

    //const PRMFCollection = require(ROOT + "/database/PRMFCollection");

    //const PSNCollection = require( ROOT + "/database/PSNCollection");
    //const PSNdoc = require(ROOT + "/database/PSNdoc");
    var ANON_PSN = null;


    //const PSNOperations = require( ROOT + "/database/PSNOperations");

    //const MEMCollection = require( ROOT + "/database/MEMCollection");
    //const MEMdoc = require(ROOT + "/database/MEMdoc");

    //const GRPCollection = require( ROOT + "/database/GRPCollection");
    //const GRPdoc = require(ROOT + "/database/GRPdoc");

    //const GRPMEMCollection = require( ROOT + "/database/GRPMEMCollection");
    //const GRPMEMdoc = require(ROOT + "/database/GRPMEMdoc");

    //const SSMCollection = require( ROOT + "/database/SSMCollection");
    //const SSMdoc = require(ROOT + "/database/SSMdoc");

    //const MGSCollection = require( ROOT + "/database/MGSCollection");
    //const MGSdoc = require(ROOT + "/database/MGSdoc");

    //const LGNCollection = require( ROOT + "/database/LGNCollection");
    //const LGNdoc = require(ROOT + "/database/LGNdoc");

    //const dbCodesList = require(ROOT + "/database/codesList.json");

    //const { mgsStatusCodes, sysCodes, ssmStatusCodes } = dbCodesList;

    //log( "Getting all permissions promise from PRMFCollection" );
    //const prmAllPermissions = PRMFCollection.prmAllPermissions;
    //var PRMS = null;
    //prmAllPermissions.then(prms=>{
    //    PRMS = prms;
    //    console.log("Permissions have been loaded", prms);
    //});

// #region CACHES
    // ---------------------------------------------------------------
    // CACHES - these store session data for all active sessions
    //
    // Caches for all the session data objects =============
    // Cache of logged-in persons
    const psnDocCache = {};
    // Cache of logins
    const lgnDocCache = {};

    // Caches of session masters, members and groups
    const wsDocCache_ssmUID={};
    const ssmDocCache = {};
    const memDocCache = {};
    const grpDocCache = {};
    const grpmemDocCache = {};
    
    
    // Cache of member group sessions
    const mgsDocCache = {};

    // Lists of sessions by personUID
    const ssmDocCache_personUID = {};

    // Lists of sessions by browserUID
    const ssmDocCache_browserUID = {};

// #endregion


    function getWSforSession( ssmUID ){
        let ws = wsDocCache_ssmUID[ssmUID];
        if(ws) return ws;
        log( `Websocket for ssmUID=${ssmUID} was not found in cache`);
        return null;
    }

    /**
     * This function is a callback from PSN Operations. It is called when
     * a person has submitted a login form and the credentials have been
     * checked. The purpose of the function is to establish the default
     * session context for this person, and to open the corresponding group
     * home page. The sessionInfo document attached to the websocket used
     * for the session is updated with the relevant keys.
     * @param {PSN document} psnDoc 
     * @param {Websocket object} ws 
     */
    async function personHasLoggedIn( psnDoc, ws ){

        log.object( ">personHasLoggedIn (callback):", psnDoc.psnName );
        // Now we set up a new session
        /*
            X1. [NOT NEEDED Add the ws to the ws dictionary if not already there]
            *2. Find the default GRPMEM for this user, and the corresponding
                GRP, MEM records
            *3. Create a new LGN record with the login data
            *4. Add the psn, lgn, grp and psngrp docs to their respective dictionaries
            5. Create the SSM record that points to ws, PSN and login
            6. Create a new mgs record from mem, grp and ssm details
            7. Update the sessionInfo on the ws to reflect the login
            8. Establish the permissions that apply to the session
            9. Remove any SSM, MGS and LGN on this WS that are not for this WS and LGN
        */


        // save the person in the person cache
            psnDocCache[psnDoc.psnUID] = psnDoc;
            ws.sessionInfo.psnUID = psnDoc.psnUID;
            ws.sessionInfo.psnName = psnDoc.psnName;

    };


    function reportSessionsToLog(){
        log("====================== SESSION CACHES ==========================");
        reportCaches();
        log("================================================================")
    };

    function reportCaches( ){
        log.object( "PSN cache", psnDocCache )
        log.object( "MEM Cache", memDocCache );
        log.object( "GRPMEM Cache", grpmemDocCache );
        log.object( "GRP Cache", grpDocCache );
        log.object( "LGN Cache", lgnDocCache );
        log.object( "SSM Cache", ssmDocCache );
        log.object( "MGS Cache", mgsDocCache );
    };


    function addSessionDocsToCaches( docs ){
        log(">>addSessionDocsToCaches: ", Object.keys( docs ) );

        let { ssmDoc, psnDoc, lgnDoc, mgsDoc, grpDoc, memDoc, grpmemDoc, ws } =  docs;

        if( psnDoc )
            psnDocCache[psnDoc.psnUID] = psnDoc;
        
        if( memDoc )
            memDocCache[memDoc.memUID] = memDoc;
        
        if( grpDoc ){
            grpDocCache[grpDoc.grpUID] = grpDoc;
            // Check if this is the default group for this person
            // NOTE: by convention the default group for a Person has the same UID
            //       as the Person.
            if( grpDoc.grpUID === grpDoc.memUID ){
                grpDocCache[ "DFLT_" + grpDoc.memUID ] = grpDoc;
            }
        }

        // Session master document
        if( ssmDoc ){
            // sessionUID keyed cache
            ssmDocCache[ssmDoc.ssmUID] = ssmDoc;
            

            // browserUID keyed cache
            let sbb = ssmDocCache_browserUID[ssmDoc.brwUID];
            if( !sbb ) { ssmDocCache_browserUID[ssmDoc.brwUID ] = sbb = {}; };
            sbb[ssmDoc.ssmUID]= ssmDoc;

            // personUID keyed cache
            let sbp = ssmDocCache_personUID[ssmDoc.psnUID];
            if( !sbp ) { ssmDocCache_personUID[ssmDoc.psnUID] = sbp = {}; };
            sbp[ssmDoc.ssmUID] = ssmDoc;

            if(ws){
                let ssmUID = ssmDoc.ssmUID;
                let removeWS = function(){
                    delete wsDocCache_ssmUID[ssmUID];
                    log(`ws instance ${ssmUID} removed from ws cache`);
                }
               
                ws.addListener("close", removeWS );
                wsDocCache_ssmUID[ssmUID] = ws;
                log(`ws instance ${ssmUID} added to ws cache`);

            }

        };

        if( lgnDoc ) 
            lgnDocCache[lgnDoc.lgnUID]= lgnDoc;
        
        if ( mgsDoc )
            mgsDocCache[mgsDoc.mgsUID] = mgsDoc;
        
        if ( grpmemDoc ){
            grpmemDocCache[grpmemDoc.grpmemUID] = grpmemDoc;
            let dfltKey =  "DFLT" + grpmemDoc.grpUID + grpmemDoc.grpOwnerUID ;
            if( !grpmemDocCache[dfltKey] || grpmemDoc.grpmemIsDefault ){
                grpmemDocCache[dfltKey] = grpmemDoc;
            };
        };

    }


    async function destroyAnonSession( sessionUID ){
        log(`>Destroy ANON session ${sessionUID}`);
        unlinkSession( sessionUID );

    } 

    /**
     * Removes an active session from all the relevant lists
     * @param {*} ssmUID 
     */
    function unlinkSession( ssmUID ){
        log(`>Unlink active session ${ssmUID}`);
        let ssmDoc = ssmDocCache[ssmUID];
        if( !ssmDoc ) return false;

        log( "....Found session data, now deleting")
        let buid = ssmDocCache_browserUID[ ssmDoc.brwUID ];
        let puid = ssmDocCache_personUID[ ssmDoc.psnUID ];

        if( buid ) delete buid[ ssmUID ];
        if( puid ) delete puid[ ssmUID ];

        delete ssmDocCache[ ssmUID ];


    };


    async function newAnonSession( ws ){
        log(`>> New Anon Session 1: ws #${ws.serverInfo.connectionNumber}`);
        let psnDoc = ANON_PSN;
        let result = personHasLoggedIn( psnDoc, ws );

        ws.sendSessionInfo("session-open");
        log( "New sessionInfo sent to browser:", ws.sessionInfo );


        // let sessionInfo = ws.sessionInfo;

        // let ssmUID = sessionInfo.ssmUID;
        // let brwUID = sessionInfo.brwUID;

        // // Anonymous person
        // let anonpsnUID = sessionInfo.psnUID = sysCodes.anonpsnUID;
        // let anonpsnDoc= psnDocCache[anonpsnUID];
        // if(!anonpsnDoc){
        //      anonpsnDoc = await PSNCollection.getPSNByUID(anonpsnUID);
        //     if(!anonpsnDoc) throw new Error("Anon person doc not found");   
        //     psnDocCache[anonpsnUID]=anonpsnDoc;         
        // };
        
        // // Anonymous member
        // let anonmemUID = sessionInfo.memUID = sysCodes.anonmemUID;
        // let anonmemDoc = memDocCache[anonmemUID];
        // if(!anonmemDoc){
        //      anonmemDoc = await MEMCollection.getMEMByUID(anonmemUID);
        //     if(!anonmemDoc) throw new Error("Anon member doc not found");   
        //     memDocCache[anonmemUID]=anonmemDoc;         
        // };

        // // Anonymous group
        // let anongrpUID = sessionInfo.grpUID = sysCodes.anongrpUID;
        // let anongrpDoc = memDocCache[anongrpUID];
        // if(!anongrpDoc){
        //      anongrpDoc = await GRPCollection.getGRPByUID(anongrpUID);
        //     if(!anongrpDoc) throw new Error("Anon GRP doc not found");   
        //     memDocCache[anongrpUID]=anongrpDoc;         
        // };

        // // Member group
        // let anongrpmemUID = sessionInfo.grpmemUID = sysCodes.anongrpmemUID;
        // let anongrpmemDoc = grpmemDocCache[anongrpmemUID];
        // if(!anongrpmemDoc){
        //     anongrpmemDoc = await GRPMEMCollection.getGRPMEMByUID(anongrpmemUID);
        //     if(!anongrpmemDoc) throw new Error("Anon GRPMEM doc not found");   
        //     grpmemDocCache[anongrpmemUID]=anongrpmemDoc;         
        // };

        // // new login doc
        // let anonlgnDoc = LGNCollection.newLGN(
        //     anonpsnDoc,
        //     ws
        // );

        // let anonlgnUID = sessionInfo.lgnUID = anonlgnDoc.lgnUID;
        // lgnDocCache[anonlgnUID] = anonlgnDoc;
        // await anonlgnDoc.save();

        // // mew anonymous session object
        // let anonssmDoc = SSMCollection.newSSM( ws );
        // let anonssmUID = sessionInfo.ssmUID = anonssmDoc.ssmUID;
        // ssmDocCache[anonssmUID] = anonssmDoc;

        // // new MemberGroupSession
        // let newmgsDoc = MGSCollection.newMGS( { grpmemDoc: anongrpmemDoc, ssmDoc: anonssmDoc } );
        // let anonmgsUID = anonssmDoc.mgsUIDactive = sessionInfo.mgsUID = newmgsDoc.mgsUID;
        // mgsDocCache[anonmgsUID] = newmgsDoc;

        // anongrpmemDoc.grpmemLastMGS = newmgsDoc.mgsUID;
        // anongrpmemDoc.save();
        // anonssmDoc.save();

        // let grpmemRole = anongrpmemDoc.grpmemRole;
        
        // log("..waiting for permissions to load");
        // let allPerms = await prmAllPermissions;


        // log(`>> New Anon Session 2: ws #${ws.serverInfo.connectionNumber}`);

        // let anonPerms = allPerms[grpmemRole];

        // log( "ANON Perms:", anonPerms);

        // newmgsDoc.mgsPerms = anonPerms;
        // newmgsDoc.save();

        // ws.sendSessionInfo("session-open");
        // log( "New sessionInfo sent to browser:", ws.sessionInfo );

    };
    /**
     * 
     * @param {*} ws 
     * @param {*} req 
     */
    function cleanUpOldCookies( ws, req ){
        // NO LOGGING IN THE FUNCTION
        let cookies = req.cookies;
        let keys = Object.keys(cookies);
        let keylist = []
        keys.forEach(key=>{
            if( key.substring(0,6)==="umdftr"){
                let ssmUID = key.substring(6);
                //log(`Looking for umdftr ssmDoc: ${ssmUID}`);
                let ssmDoc = ssmDocCache[ssmUID];
                if(!ssmDoc || ssmDoc.ssmStatus=="C" ){
                    keylist.push(key);
                }
            }
        })
        if(keylist.length > 0 ){
            let msg = {
                msgType: "delete-cookies"
                , cookies: keylist
            };
            //log("Sending list of cookies to delete:", msg)
            ws.sendJSON( msg );
        } else {
            //log("No cookies to delete");
        }
        keylist.forEach(key=>{
            let ssmUID = key.substring(6);
            let ssmDoc = ssmDocCache[ssmUID];
            if(ssmDoc){
                ssmDoc.ssmStatus = "C";
                ssmDoc.save()
                //delete ssmDocCache[ssmUID];
                let mgsDoc = mgsDocCache[ssmDoc.mgsUID];
                if( mgsDoc ){
                    mgsDoc.mgsStatus = "C";
                    mgsDoc.save();
                    //delete mgsDocCache[ssmDoc.mgsUID];
                }
            }
        });

        // now clean up any logins that are not in use:
        let lgnKeys = Object.keys(lgnDocCache);
        //log(`There are ${lgnKeys.length} logins in the cache`);
        let allLgns={};
        lgnKeys.forEach( lgnKey=>{
            allLgns[lgnKey] = "X";
        });
        //log.object( "allLgns", allLgns )
        let ssmKeys = Object.keys(ssmDocCache);
        ssmKeys.forEach( ssmKey=>{
            let ssmDoc = ssmDocCache[ssmKey];
            //log(`... checking ssmDoc [${ssmKey}] with login [${ssmDoc.lgnUID}] ...`);
            //delete allLgns[ssmDoc.lgnUID];
        });

        let clearCount = 0;
        lgnKeys = Object.keys(allLgns);

        lgnKeys.forEach( lgnKey=>{
            //delete lgnDocCache[lgnKey];
            ++clearCount;
 
        });

        //log(`... cleared ${clearCount} logins from cache`);

    }
    /**
     * Called on creation of a new websocket connection from a client. The connection 
     * Incoming data 
     *  - the browserUID
     *  - the new sessionUID 
     *  - parent sessionUID (if any)
     * These are available in ws.sessionInfo
     * The parent sessionUID is last session that was active
     * in the same browser tab, or the session that was last
     * active in any tab in the browser.
     * This function checks that the parent session is inheritable,
     * and if so assigns the same credentials to the
     * new session. If there is no parent session or the
     * parent session is invalid, it sets up a new anonymous 
     * session.
     * @param {websocket} ws 
     * @param {request} req 
     */
    async function newWebsocketConnection(ws, req ){
        log(`>>newWebsocketConnection`);

        cleanUpOldCookies(ws, req);

        let wsSessionInfo = ws.sessionInfo;
        log.object("wsSessionInfo", wsSessionInfo);
        // First get all the relevant UIDs
        let brwUID = wsSessionInfo.brwUID;
        let parssmUID = wsSessionInfo.parssmUID;
        let new_ssmUID = wsSessionInfo.ssmUID;
        // Save ref to ws in the cache
        wsDocCache_ssmUID[new_ssmUID] = ws;


        // XUID keys (browser and session UIDs combined)
        let parssmXUID = wsSessionInfo.parssmXUID;
        let newssmXUID = wsSessionInfo.ssmXUID;
        

        // *********************************************************
        // Get the encryption key for the new session
        let newSessionEncrKey = ws.serverInfo.encrKey;

        log("newSessionEncrKey", newSessionEncrKey);
        ws.sessionEncrKey = newSessionEncrKey;
        
        // TODO Encrypt the XUID for a the session cookie **********
        // let encrNewSessionXUID = encrypt( newSessionXUID, newSessionKey );
        let encrNewSessionXUID = newssmXUID;

        // *********************************************************
        //#region Encrypted session token
            // Create a new session cookie containing
            // the encrypted session key, keyed on the 
            // session UID.
            let cookieKey = "umdftr" + new_ssmUID;

            // Set up the cookie info to be sent to
            // the client process.
            let cookieInfo = {};
            cookieInfo[cookieKey]={
                value: encrNewSessionXUID
                , days: 30
            };

            // Create a cookie-setting message to send to the client
            let setCookieMsg = { msgType: "setcookies"
                        , cookies: cookieInfo
                    };

            // send the JSON string to the client through the
            // websocket, which sets the cookie at the client end
            ws.sendJSON( setCookieMsg );

        //#endregion

        // ***********************************************************
        // Now see if we can inherit session from a "parent" active
        // session in the same browser. The parent session was identified
        // from the activeSession cookie in the wsController when
        // the new websocket connection was requested. Inheriting the
        // session credentials means the user does not have to log in
        // again when opening a new browser tab in a browser where
        // they are already logged in.

        // Check that the parent session is actually registered, if not reject
        log("Getting parent session data from cache");
        let parentSessionDocs = getSessionDocs(parssmUID);

        // The returned object contains these entries from the database
        // for the parent session:            
        //     ssmDoc
        //     psnDoc
        //     grpDoc
        //     memDoc
        //     mgsDoc
        //
        // Try to get the session master SSM document
        let parentSSMDoc = parentSessionDocs? parentSessionDocs.ssmDoc : null ;
        if( !parentSSMDoc){
            log(`No old session found under key: [${parssmUID}]`);
            return newAnonSession(ws);
        };

        // We have found a valid session and session master.
        // Now get the member-group-session (MGS) record for
        // the old session state
        let parentMGSDoc = parentSessionDocs.mgsDoc;
        if( !parentMGSDoc){
            log(`No old MGS doc found for this session`);
            return newAnonSession(ws); //, brwUID, newssmUID);
        }
        let parentGRPMEMDoc = parentSessionDocs.grpmemDoc;
        if( !parentGRPMEMDoc){
            log(`No old GRPMEM doc found for this session`);
            return newAnonSession(ws); //, brwUID, newssmUID);
        }

        // We have found the old session member-group-session
        // document which contains essential session login data:
        let parmgsUID = parentMGSDoc.mgsUID;
        let parpsnUID = parentSSMDoc.psnUID;
        let parmemUID = parentMGSDoc.memUID;
        let pargrpUID = parentMGSDoc.grpUID;
        let parlgnUID = parentSessionDocs.lgnDoc.lgnUID;
        let parmgsRole = parentMGSDoc.mgsRole;
        let parmgsPerms = parentMGSDoc.mgsPerms;
        let pargrpmemUID = parentGRPMEMDoc.grpmemUID;
        let pargrpmemHome = parentGRPMEMDoc.grpmemHome;


        // Check the parent has a valid encrypted
        // token cookie on the same browser

        // Get the encrypted umdftr session data from the request cookie
        // which contains an encrypted copy of the session XUID
        log("Getting parent umdftr cookie");
        let parentCookieKey = "umdftr" + parssmUID;

        let parssmXUID_encr = req.cookies[ parentCookieKey ];
        if( !parssmXUID_encr ){
            log("No cookie for encrParentSessionXUID");
            return newAnonSession(ws);
        };

        // The cookie is there, so we need to decrypt it
        let parssmEncrKey = parentSSMDoc.ssmEncrKey ;

        if( !parssmEncrKey || parssmEncrKey.length < 2 ) {
            log( "There is no parentSessionEncrKey" );
            return newAnonSession( ws );
        }
        
        // ******************************************************
        // TODO implement encryption/Decryption
        // decrOldSessionXUID = decrypt( encrOldSessionXUID, oldSessionKey );
        let parssmXUID_decr = parssmXUID_encr;
        // ******************************************************

        // Check that the session token
        // has decrypted correctly
        log("Checking decrypted session data against cookie data");
        if( parssmXUID_decr != parssmXUID ){
            log("Invalid parent session data ")
            return newAnonSession( ws );
        };

        // The inherited session is valid, so now
        // we can safely set up the new session with inherited 
        // details from the parent session
        
        // New session data (which will be sent to the client)
    
            wsSessionInfo.psnUID= parpsnUID;
            wsSessionInfo.memUID= parmemUID;
            wsSessionInfo.grpUID= pargrpUID;
            wsSessionInfo.grpmemUID = pargrpmemUID;
            wsSessionInfo.lgnUID = parlgnUID;
            wsSessionInfo.grpmemHome = pargrpmemHome;

            
        // !!!!!!!!!!!!! WHERE IS THE NEW SESSION DOC?
        // Create a new session master
        let new_ssmDoc = await SSMCollection.newSSM( ws );

         new_ssmDoc.ssmEncrKey = newSessionEncrKey;
        

            
        let new_mgsDoc = 
            await MGSCollection.newMGS( 
                {
                    grpmemDoc: parentSessionDocs.grpmemDoc
                    , ssmDoc: new_ssmDoc
                });
        
        wsSessionInfo.mgsUID = new_ssmDoc.mgsUID = new_mgsDoc.mgsUID;
        wsSessionInfo.mgsRole = new_ssmDoc.mgsRole = new_mgsDoc.mgsRole;

        log.object("New ssmDoc", new_ssmDoc);
        log.object("New mgsDoc", new_mgsDoc);

      
        // Save the session master and mgs records
        // in the cache.
        // NOTE: We do not have to set up all the
        //       other session records (i.e. 
        //       member, groupMember, login and group)
        //       because these will already have been
        //       set up when the parent session was
        //       set up.
        let docs = {
            ssmDoc: new_ssmDoc
            , mgsDoc: new_mgsDoc
        };

        addSessionDocsToCaches( docs );

        ws.sessionDocs = {
                ssmDoc: new_ssmDoc,
                psnDoc: parentSessionDocs.psnDoc,
                lgnDoc: parentSessionDocs.lgnDoc,
                memDoc: parentSessionDocs.memDoc,
                grpDoc: parentSessionDocs.grpDoc,
                grpMem: parentSessionDocs.grpmemDoc,
                mgsDoc: new_mgsDoc
        };

        // Establish the permissions set for this session
        prmAllPermissions.then( perms=>{
            let sessionPermissions = perms[ new_mgsDoc.mgsRole ];
            if( !sessionPermissions ) sessionPermissions = perms["ANON"];
            new_mgsDoc.mgsPerms = wsSessionInfo.mgsPerms = sessionPermissions;

        log("New session with inherited credentials", wsSessionInfo)

            //addSessionDocsToCaches( { mgsDoc: new_mgsDoc } );

            let msg = {
                msgType: "session-open"
                , sessionInfo: wsSessionInfo
            }

            ws.sendJSON( msg );

            msg = {msgType: "person-login", sessionInfo: ws.sessionInfo };
            log.object("Sent person-login message", msg );
            ws.sendJSON( msg )

        })

        return wsSessionInfo;
    }


    function closeWebsocketConnection( ws ){
        log(">closeWebsocketConnection", ws.serverInfo.connectionNumber);
        let { mgsUID, ssmUID, lgnUID } = ws.sessionInfo;
        let datestamp = new Date();
        // 1. Change the session status on MGS to closed
        let mgsDoc = mgsDocCache[mgsUID]
        if( mgsDoc ){
            mgsDoc.mgsStatus = mgsStatusCodes._closed;
            mgsDoc.mgsEnd = datestamp;
            mgsDoc.save();
        };
        // 2. Change the session status on SSM to closed
        let ssmDoc = ssmDocCache[ssmUID]
        if ( ssmDoc ){
            ssmDoc.ssmStatus = ssmStatusCodes._closed;
            ssmDoc.ssmEnd = datestamp;
            ssmDoc.save();
        };
        // 3. Clear the session data from the caches after 20 seconds
        // setTimeout(()=>{
        //     delete wsDocCache_ssmUID[ssmUID];
        //     delete ssmDocCache[ssmUID];
        //     delete mgsDocCache[mgsUID];
        //     let lgnDoc = lgnDocCache[lgnUID];

        //     // If the login is anonymous, then it is deleted as we
        //     // do not keep a record of anon logins
        //     if( lgnDoc.psnUID == sysCodes.anonpsnUID ){
        //         delete lgnDocCache[lgnUID];
        //     } else {
        //         // Not anonymous, so make sure it is saved
        //         // We don't remove from the cache, because it
        //         // may be used as credentials for a new session
        //         lgnDoc.save();
        //     };

        //     log( `Session caches have been cleared for:\nssmUID[${ssmUID}]\nmgsUID[${mgsUID}]`)
        // }, 20000 );

    }

    // /**
    //  * 
    //  * @param {websocket} ws 
    //  * @param {person} psn 
    //  */
    // async function newLoginSession( ws, psn ){
    //     if( ws.sessionInfo.ssmUID ) unlinkSession( ws.sessionInfo.ssmUID )
    //     let ssmUID = globalUtil.getUID();
    //     ws.sessionInfo.ssmUID = ssmUID;
    //     ws.sendJSON({
    //         msgtype: 'ssmUID'
    //         , ssmUID: ssmUID
    //     });
    //     let browserUID = ws.sessionInfo.brwUID;
    //     let lgn = newLGN();

    // }
    /**
     * Creates a new user session when a user has registered. Assumes that
     * the required default GRP, MEM and GRPMEM records have been created
     * for the person's private group. These all have the same uid as the
     * person
     * @param {*} psnUID 
     * @param {*} browserUID 
     * @param {*} ssmUID 
     */
    async function openPrivateGroupSession (ws, psnUID, brwUID, ssmUID ){
        // Is there an active session under this UID?
        let activeSession = ssmDocCache( ssmUID );
        if( activeSession ){
            // Is this already the private group session for this person?
            if ( activeSession.GRP.grpUID == psnUID ) {
                return activeSession;
            }
            unlinkSession( ssmUID );

        };
        let groupUID = psnUID;
        let memberUID = psnUID;


        // TO DO MORE HERE

    }

    function getSessionData(){
        let data ={
            ssms: ssmDocCache
            ,psns : psnDocCache
            ,grps: grpDocCache
            ,mems: memDocCache
            ,grpmems: grpmemDocCache
            ,mgss : mgsDocCache
            ,lgns: lgnDocCache
        }
        return data;
    }


    // Returns all the current session docs associated with a specific
    // session UID from the doc cache
    function getSessionDocs(ssmUID){
        log(">>getSessionDocs", ssmUID);
        let ssmKeys = Object.keys(ssmDocCache);
        log.object("SSMs in cache", ssmKeys );
        let ssm = ssmDocCache[ssmUID];

        if( !ssm ) {
            log(`.. ssmDoc for ${ssmUID} was not found in ssmDocCache `)
            return {};
        };
        log(`.. ssmDoc found, building list of session docs`, ssm);
        let psnUID = ssm.psnUID;
        let grpUID = ssm.grpUID;
        let memUID = ssm.memUID;
        let mgsUID = ssm.mgsUID;
        let lgnUID = ssm.lgnUID;
        let brwUID = ssm.brwUID;
        let grpmemUID = ssm.grpmemUID;
        let psn = psnDocCache[psnUID];
        let grp = grpDocCache[grpUID];
        let mem = memDocCache[memUID];
        let mgs = mgsDocCache[mgsUID];
        let lgn = lgnDocCache[lgnUID];
        let grpmem = grpmemDocCache[grpmemUID];
        
        
        let ret = {
            ssmDoc: ssm
            , psnDoc: psn
            , grpDoc: grp
            , memDoc: mem
            , mgsDoc: mgs
            , lgnDoc: lgn
            , grpmemDoc: grpmem
        };
        log.object("Parent session docs (ret)", ret);
        return ret;
    }
    /**
     * Opens a session for the user in a specified group with specified or default member
      * @param {*} ws 
      * @param {*} personUID 
      * @param {*} browserUID 
      * @param {*} sessionUID 
      * @param {*} groupUID 
      * @param {*} memberUID 
      */
    async function openGroupSession( ws, personUID, browserUID, sessionUID, groupUID, memberUID ){


        // first, the find the group member, which holds the role
        let grpmemSelector = memberUID? {memberUID: memberUID, groupUID: groupUID }
                             : { isDefault: 1, groupUID: groupUID, personUID: personUID };


        let grpmem = await collections.GRPMEM.find( grpmemSelector ).toArray()[0];
        

        if( !grpmem ){
            throw new Error( `***** The personUID ${personUID} has no membership of group ${groupUID}`)
        };
        
        if( !memberUID ) memberUID = grpmem.memberUID;

        // kick off all the database async operations to get the documents required
        let p_psn = collections.PSN.find( { personUID: personUID } );
        let p_mem = collections.MEM.find( { memberUID: personUID } );
        let p_grp = collections.GRP.find( { groupUID: personUID } );

        // get the permission list for this group member
        let p_perms = PRMFCollection.getPermission( grpmem.role )
        
        log("permissions load started")

        // get the id of the group member
        let grpmemUID = grpmem.grpmemUID;

        // Get the member group session document if there is one
        let grpmem_selector = {grpmemUID: grpmemUID, sessionUID: sessionUID  };
        log( "finding MGS with selector",  grpmem_selector)
        let p_mgs =  MGSCollection.find( grpmem_selector );
        log( "find started");
        let mgs = await p_mgs;

        if (mgs)mgs = await mgs.toArray[0];

        log( "mgs found", mgs);

        let perms = await p_perms;
        log( "permissions found", perms);
        if( mgs ){
            // check the role and update mgs if changed
            if( mgs.role != grpmem.role ){
                mgs.role = grpmem.role;
                mgs.perms = perms;
                mgs.save();
            }
        }

        // If we have not found one, we need to create it and save it
        if( mgs ){
            let mgs = {
                mgsUID: globalUtil.getUID()
                , personUID: personUID
                 , memberUID: memberUID
                 , groupUID: groupUID
                 , sessionUID: sessionUID
                 , isDefaultMember: grpmem.isDefaultMember
                 , crd: new Date()
                 , role: grpmem.role
                 , perms: perms
            }
            let mgs_coll = await collections.MGS
            mgs_coll.insertOne( mgs );


        }

        let mem= await p_mem;
        let psn = await p_psn;
        let grp = await p_grp;
        let lgn = null;
        let ssm = null;

        let sd = {
            browserUID: browserUID
            , sessionUID: sessionUID
            , personUID: personUID
            , PSN: psn
            , MEM: mem
            , LGN: lgn
            , SSM: ssm
            , MGS: mgs
            , GRP: grp
            , ws: ws
        };

        addSessionDocsToCaches( sd );

        return sd;

    }

    // function saveNewSessionToDB( session ){
    //     DB.saveSessionData( session );
    // }


    // function flatListToPerm(fl){
    //     let perm = {};
    //     fl.forEach( (key)=>{
    //         perm[key]=1;
    //     });
    //     return perm;
    // }

    function report(){
        log(" SESSION REPORT ------------------------------------" );
        log.object( "By session", ssmDocCache );
        log.object( "By Person", ssmDocCache_personUID );
        log.object( "By Browser", ssmDocCache_browserUID );
        log(" END OF SESSION REPORT ------------------------------" );
    }

//--------------------------------------------------------- login
/**
 * Public function to login a person based on email and password
 * 
 * @param {*} context The context object contains:
 *      email
 *      password
 *      sessionInfo
 */
 async function loginPerson( context ){
    // Step 1 - check that the session is valid

    // Step 2 - check that the person exists via email and password
    // Find the person

    // Establish the default GroupMember for the person
    // and from this the Group and Member
    // and the relevant permission set for the GroupMember


    // Step 3 - save the new session information in
    //      LGN_Login
    //      MGS_MemberGroupSession
    //

    // Step 4 - Update the session information and return that
    //          to the client

    // Step 5 - Load the default page for this MemberGroup and
    //          send to the client
    
}

/**
 * This function is called from the tiger server run() function to
 * initialize everything required to manage sessions.
 */
    async function start(){
        // get references to all the collections
        
        
        return true;
    };

    //---------------------------------------- EXPORTS
    
    module.exports = {
        //isReady: isReady
        //, 
        start: start
        , newAnonSession: newAnonSession
        , destroyAnonSession: destroyAnonSession
        , openPrivateGroupSession: openPrivateGroupSession
        , openGroupSession: openGroupSession
        , newWebsocketConnection: newWebsocketConnection
        , closeWebsocketConnection: closeWebsocketConnection
        //, getSession: getSession
        //, getUserSessions: getUserSessions
        //, getBrowserSessions: getBrowserSessions
        , report: report
        , reportCaches: reportCaches
        , reportSessionsToLog: reportSessionsToLog
        , getWSforSession: getWSforSession
        , loginPerson: loginPerson
        , getSessionData: getSessionData
    };
