require( "./globalsLoader" );
const se = require( "./stringEncryptor");


let ss = "123123123";

let hss = se.hash(ss);

console.log(`hash [${ss}]=>[${hss}]`);

/*
hash [123123123]=>[4f566b470af01e404144e99d1e4f5b6f95fb625f887fd01ba046072bd185fc3f]
*/