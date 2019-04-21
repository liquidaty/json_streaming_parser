var time = Date.now();
var json_sax = require('./json_sax'); //for JSON streaming parser

var state = new_parser_state();
var parser = new json_sax.SaxParser(callbacks(state));
const stream = process.stdin;

stream.on('error', function (error) {console.log("Caught", error);});
stream.on('data', data => {
  //var start = Date.now();
  parser.parse(data);
  //console.log("parse time is %s", Date.now() - start);
});

stream.on('end', () => {
  time = Date.now() - time;
  var mem =  Number(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);

  if(process.argv[2] != '-s')
    console.log("Method,Rows,Sum,Time,Memory");
  console.log("stream, %s, %s, %s, %s", state.count, state.sum, time, mem);
});

/////JSON Streaming parser test begin/////
function new_parser_state() {
  return {
    sum: 0,
    count: 0,
    bytes: 0,
    cancel: false // set to true in a callback to stop processing
  };
}

function callbacks(parser_state) {
  return {
    onKey: function(k) {
      switch(parser.stack.length) {
      case 1:
        if(k != 'data')
	  return malformed(); // stop parser
        break;
      case 2:
        switch(k) {
        case 'thead': 
	  if(!status.thead && parser.stack[1] == '{')
	    status.thead = 1;
	  else
	    return malformed();
	  break;
        case 'tpreface':
        case 'tdata':
	  if(!status[k] && parser.stack[1] == '{') {
	    if(k == 'tdata')
	      start_data();
	    status[k] = 1;
	  } else
	    return malformed();
	  break;
        }
      }
    },
    onStartArray: function() {
      if(status.thead == 1)
        status.thead = 2;
      
      else if(status.tpreface == 1)
        status.tpreface = 2;
      else if(status.tpreface == 2)
        status.tpreface = 3;
      
      else if(status.tdata == 1) {
        status.tdata = 2;
        parser_state.parser.setCapture(function(row) {
	  for(var i = 0; i < row.length; i++)
	    if(Array.isArray(row[i]))
	      row[i] = row[i].length > 1 ? row[i][1] : row[i][0];
          
	  wb_builder.process_row(row); // curr_row
	  if(++rows_processed % 50 == 0) 
	    runningUpdate('Processed ' + rows_processed + ' rows');
        });
      }  
    }, 
    onEndArray: function() {
      if(parser.stack.length == 1)
        parser_state.count++;
      if(status.thead == 2) {
        status.thead = DONE;
      }     else if(status.tpreface == 2) {
        status.tpreface = DONE;
      }     else if(status.tpreface == 3) {
        if(tpreface_rows.length < 3)
	  tpreface_rows.push(curr_row);
        curr_row = [];
        status.tpreface = 2;
      }     else if(status.tdata == 2) {
        status.tdata = DONE;
        finished();
      }
    },
    onValue: function(v) {
      parser_state.sum += v;
      if(parser.stack.length == 3) {
        if(status.thead == 2)
	  column_headers.push(v);
      }     else if(parser.stack.length == 4) {
        if(status.tdata == 3 || status.tpreface == 3)
	  curr_row.push(v);
      }
    },
    onError: function(e) {
      console.log('parser state: ', parser_state.read);
      console.log('onError:', e);
      parser_state.cancel = true;
      if(status.tdata != DONE) {
        lqform.alert(e);
        console.trace();
      }
      finished();
    }
  };
};

var status = {
  thead: 0,
  tpreface: 0,
  tdata: 0,
  export_headers: [],
  validation_headers: [],
  raw_headers: []
};

/////JSON Streaming parser test end//////
