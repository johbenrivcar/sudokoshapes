"use strict";
var [m,n,a,s,o,p,b,c,x,d]=[
    99
    ,`.
`
    ,` bottle`
    ,`s`
    ,` of beer`
    ,` on the wall`
    ,"Take one down and pass it around, "
    ,"Go to the store and buy some more, "
    ,""
    ,(n,l)=>{return x=`${n==0?(l?"n":"N")+"o more":n<0?m:n} bottle${n==1?"":"s"} of beer`}
];
for(var k=m;k>=0;k--){d(k);console.log(x+p+", "+d(k,1)+n+(k==0?c:b)+d(k-1,1)+p+n)};


// k=()
// a=()=>{console.log(
//     `${p} bottle${q} of beer on the wall, ${r} bottle${s} of beer.
//     ${t}, ${u} bottle${v}`
// )}