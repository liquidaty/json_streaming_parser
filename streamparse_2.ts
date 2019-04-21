let time = Date.now();
let json_sax = require('./json_sax'); //for JSON streaming parser

let stream = process.stdin;
let parse_data = { sum: 0, count: 0 };
let parser = new json_sax.SaxParser(callbacks(parse_data));

stream.on('error', function (error) {
  console.log("Caught", error);
});

stream.on('data', data => {
  parser.parse(data);
});

stream.on('end', () => {
  time = Date.now() - time;
  let mem =  Number(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
  if(process.argv[2] != '-s')
    console.log("Method,Rows,Sum,Time,Memory");
  console.log("stream2, %s, %s, %s, %s", parse_data.count, parse_data.sum, time, mem);
});


/////JSON Streaming parser test begin/////
function callbacks(data) {
  return {
    onEndArray: function() {
      if(parser.stack.length == 1)
        data.count++;
    },
    onValue: function(v) {
      data.sum += v;
    },
    onError: function(e) {
      console.log(e)
    }
  };
}

/////JSON Streaming parser test end//////
