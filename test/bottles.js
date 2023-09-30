"use strict";

// https://code.golf/99-bottles-of-beer#javascript

var {a=` bottle`,s=`s`,o=` of beer`,p=` on the wall`,b="Take one down and pass it around",c="Go to the store and buy some more",d="o more",k=99}={};
for(k; k>=0; k--){var l=k-1;
	var j=(k==0?"N"+d+a+s:(k>0?k+a+(k==1?``:s):99+a+s))
	var e=k==0?c:b;var f=k>0? (l)+a+(k==2?``:s)+o+p+"." : 99+a+s+o+p+".";
  console.log( (j+o+p+", "+j+o+".")+(k>-1?"\n"+e: "")+`, `+f+`\n`);
};




