

//
var ng = {
         lines : null,
         errors: null
    };

ng.validateGrid = 
    function newgrid_validateGrid(txtInput){
        // txtInput is a reference to a textarea control

        // convert entere text into array of lines of text
        ng.lines = txtInput.value.split('\n');
        console.log(`newgrid${ng.divNonce}`, ng.lines);


        ng.errors = "";
        // prepare the parameters for a call to the server
        // to carry out validation of the grid
        let divSpec={
            data: { txtInput: ng.lines }
            , folder: "newgrid"
            , name: "validategrid"
            , target: "grid-errors"
            , cbFunction: ng.processValidateGridReply
            , cbData: { from: "validate" }
        };

        // submit the data to the validateGrid function
        ws_loadOneDiv(divSpec);
        
    };

ng.processValidateGridReply = 
    function newgrid_processValidateGridReply( msg, cbData  ){
        console.log("msg", msg, cbData ) ;
        $(`.newgrid_textarea`)[0].value=msg.parsedInput;
        if(msg.errorCount==0){
            $("#btnSave").removeClass("hidden");
        } else {
            $("#btnSave").addClass("hidden");
        }
    };

ng.processSaveGridReply = 
    function newgrid_processSaveGridReply( msg, cbData  ){
        console.log(">>newgrid_processSaveGridReply")
        console.log("msg", msg, cbData ) ;
        $(`.newgrid_textarea`)[0].value=msg.parsedInput;
        $("#btnSave").addClass("hidden");
        if(msg.errorCount==0){
            console.log("No errors, updating html in grid-errors")
            $(`#grid-errors`).html(`<div class="successmessage">Grid saved</div>`);
        } else {
            $(`#grid-errors`).html(msg.html);
        }
    };

ng.saveGrid = 
    function newGrid_saveGrid( txtInput, txtInitials ){

        console.log(`Saving grid`, txtInput.value, txtInitials.value );
        
        // txtInput is a reference to a textarea control
        lines=txtInput.value.split('\n');
        console.log("newgrid#{divNonce}", lines);
        errors = "";

        let spec={
            data: { txtInput: lines , txtInitials: txtInitials.value }
            , folder: "newgrid"
            , name: "savegrid"
            , target: "grid-errors"
            // the function that will process the reply
            , cbFunction: ng.processSaveGridReply
            , cbData: { from: "save" }
        };

        // submit the entered grid definition to the server
        // to save the grid to the database
        ws_loadOneDiv(spec);
        
        // Hide the save button
        $("#btnSave").addClass("hidden");

    };


ng.standardiseLines = 
    function newgrid_standardiseLines(){
        for( ix=0; ix<9; ix++ ){
            var line=lines[ix]
            let ticks = [0,0,0,0,0,0,0,0,0]
        };
    };

console.log("newgrid_script.js was loaded")
