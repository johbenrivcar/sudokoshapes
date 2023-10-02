"use strict";

let newObject = null;

{
    var id = 10;
    newObject = function Obj(p1){
        this.id = ++id;
        Object.defineProperty( this, "a", {
            get(){ return id; }
        });
    }
}
let O1 = new newObject();
let O2 = new newObject();
console.log( O1, O1.a );
console.log( O2, O2.a );
console.log( id )
