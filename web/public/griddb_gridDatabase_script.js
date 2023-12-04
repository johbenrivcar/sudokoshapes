/**
 * Provides all mechanisims for loading and saving grids into the browser. For use by the app browser page to load
 * data structures representing all the grids that have been saved and analysed. Works in cooperation with the
 * server-side script gridsDB.js.
 * 
 * The operation of this module relies on the websocket messaging module ws_messaging. The messages implemented
 * to support the functionality are:
 * 
 * 
 *  message type                    function
 *  get-grid-by-id                  retrieves a single grid json from the grid database on the server
 *  save-grid                       writes a grid entry back to the grid database
 *  get-grid-id-list                requests a complete list of all the grids saved in the database
 * 
 *  There are public functions which generate message requests and deliver the responses from the server in
 *  the message reply. These functions are named as above, but using camel case and omitting hyphens.
 * 
 */