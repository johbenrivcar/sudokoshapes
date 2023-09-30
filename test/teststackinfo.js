
console.log("Starting");
runTest();
console.log("Ended");


function runTest(){
    level1();
}

function level1(){
    level2();

}

function level2(){
    level3();

}
function level3(){
    getStackInfo(1);

}


// ========================================================================================== 
function getStackInfo(index) {
    let stack = (new Error()).stack.split('\n');
    //console.log(`Index ${index} of the stack:`, stack[index]);
    let fileName = stack[index].slice(  stack[index].lastIndexOf('\\')+1, 
                                    stack[index].lastIndexOf('.js')+3);
    let lineNumber = stack[index].slice(  stack[index].lastIndexOf('.js:')+4, 
                                    stack[index].lastIndexOf(':'));


    stack.forEach( (row)=>{
        console.log( row )
    });

    return {fileName, lineNumber};


}
