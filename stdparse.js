var time = Date.now();

/////JSON.parse test begin/////
const fs = require("fs");
const data = fs.readFileSync("/dev/stdin", "utf-8"); // stdin

var obj = JSON.parse(data);
var sum = sumAllRows(obj);
time = Date.now() - time;
var mem =  Number(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);

if(process.argv[2] != '-s')
  console.log("Method,Rows,Sum,Time,Memory");

console.log("std,%s,%s,%s,%s", obj.length, sum, time, mem);
/////JSON.parse test end/////

//sums all rows in object
function sumAllRows(obj) {
    var sum = 0
    //sum all rows
    for(var row in obj) {
        for(var column in obj[row]) {
          sum += obj[row][column];
        }
    }
    return sum;
}

