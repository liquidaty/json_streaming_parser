// https://gist.githubusercontent.com/creationix/1821394/raw/c8b545b4133cdc72165861e2dc514b117930e264/jsonparse.js

(function(exports){
  "use strict";
  // Named constants with unique integer values
  var C = {};
  // Tokenizer States
  var START   = C.START   = 0x11;
  var TRUE1   = C.TRUE1   = 0x21;
  var TRUE2   = C.TRUE2   = 0x22;
  var TRUE3   = C.TRUE3   = 0x23;
  var FALSE1  = C.FALSE1  = 0x31;
  var FALSE2  = C.FALSE2  = 0x32;
  var FALSE3  = C.FALSE3  = 0x33;
  var FALSE4  = C.FALSE4  = 0x34;
  var NULL1   = C.NULL1   = 0x41;
  var NULL2   = C.NULL3   = 0x42;
  var NULL3   = C.NULL2   = 0x43;
  var NUMBER1 = C.NUMBER1 = 0x51;
  var NUMBER2 = C.NUMBER2 = 0x52;
  var NUMBER3 = C.NUMBER3 = 0x53;
  var NUMBER4 = C.NUMBER4 = 0x54;
  var NUMBER5 = C.NUMBER5 = 0x55;
  var NUMBER6 = C.NUMBER6 = 0x56;
  var NUMBER7 = C.NUMBER7 = 0x57;
  var NUMBER8 = C.NUMBER8 = 0x58;
  var STRING1 = C.STRING1 = 0x61;
  var STRING2 = C.STRING2 = 0x62;
  var STRING3 = C.STRING3 = 0x63;
  var STRING4 = C.STRING4 = 0x64;
  var STRING5 = C.STRING5 = 0x65;
  var STRING6 = C.STRING6 = 0x66;

  exports.SaxParser = SaxParser;

  // Slow code to string converter (only used when throwing syntax errors)
  function toknam(code) {
    var keys = Object.keys(C);
    for (var i = 0, l = keys.length; i < l; i++) {
      var key = keys[i];
      if (C[key] === code) { return key; }
    }
    return code && ("0x" + code.toString(16));
  }

  function no_op() {}

  function SaxParser(callbacks, options) {
    this.stack = [];
    this.bytes_read = 0;
    this.ready_for = 'v'; // v = value, k = map key, : = colon

    this.callbacks = callbacks;
    options = options || {};
    this.validate = 'validate' in options ? options.validate : true;

    if(this.validate)
      callbacks.onKey = callbacks.onKey || no_op;

    ['onStartObject', 'onEndObject', 'onStartArray',
     'onEndArray', 'onColon', 'onComma'].forEach(function(cbname) {
       if(!callbacks[cbname])
         callbacks[cbname] = no_op;
     });

    var that = this;

    this.unsetCapture = function() {
      this.capture = undefined;
    };

    this.on_value = function(v) {
      that.noComma = false;
      if(that.capture)
        that.capture(v);
      else if(callbacks.onValue)
        return callbacks.onValue(v);
    };

    ['onString', 'onBoolean', 'onNull', 'onNumber'].forEach(function(cbname) {
      var tmp = callbacks[cbname];
      if(cbname == 'onNull')
        callbacks[cbname] = function() {
          if(tmp)
            tmp(null);
          that.on_value(null);
        };
      else
        callbacks[cbname] = function(v) {
          if(tmp)
            tmp(v);
          that.on_value(v);
        };
    });

    if(!callbacks.onError)
      callbacks.onError = console.log;

    this.state = START;

    // for string parsing
    this.string = undefined; // string data
    this.unicode = undefined; // unicode escapes

    // For number parsing
    this.negative = undefined;
    this.magnatude = undefined;
    this.position = undefined;
    this.exponent = undefined;
    this.negativeExponent = undefined;

    this.unexpected = function() {
      var s = String.fromCharCode(this.state);
      that.callbacks.onError(new Error("Unexpected '" + s + "' at position " + this.bytes_read + " in state " + toknam(this.state)));
      that.parse_err = true;
    };
    
    this.stack_push = function(v) {
      that.stack.push(v);
      that.stack_last = v;
      that.noComma = true;
    };
    
    this.stack_pop = function() {
      var popped;
      if(that.stack.length) {
        that.noComma = false;
        popped = that.stack.pop();
        if((that.stack_last = that.stack[that.stack.length - 1]) == '{')
          that.ready_for = 'k';
      } else
        that.stack_last = undefined;
      return popped;
    };
  }

  var proto = SaxParser.prototype;
  proto.setCapture = function(callback) {
    this.capture_at = this.stack.length;
    this.capture_key = [];
    this.capture_stack = [];
    this.capture = function(v) {
      if(this.capture_stack.length)
        this.capture_push(v);
      else
        callback(v); // this.capture_callback(v);
    };
  };

  proto.capture_push = function(v) {
    var x = this.capture_stack[this.capture_stack.length-1];
    if(x.constructor == Array)
      x.push(v);
    else
      x[this.capture_key[this.capture_stack.length-1]] = v;
  };

  proto.charError = function (buffer, i) {
    this.callbacks.onError(new Error("Unexpected " + JSON.stringify(String.fromCharCode(buffer[i])) + " at position " + i + " in state " + toknam(this.state)));
  };
  
  /*
    TO DO!!!
    proto.capture = function(callback) {
      /// will capture the next value, and all nested values within it, then call callback()
    }
  */
  function str_to_bytearray(str) {
    var utf8 = unescape(encodeURIComponent(str));
    var arr = [];
    for(var i = 0; i < utf8.length; i++)
      arr.push(utf8.charCodeAt(i));
    return arr;
  }
  
  var Buffer = str_to_bytearray; // this.Buffer || str_to_bytearray;

  proto.parse = function (buffer) {
    if (typeof buffer === "string")
      buffer = new Buffer(buffer);
    var n;
    for(var i = 0, l = buffer.length; i < l && !this.parse_err; i++, this.bytes_read++) {
      switch (this.state) {
      case START:
        n = buffer[i];
        switch (n) {
        case 0x7b: // `{`
          if(this.validate) {
            if(!this.ready_for == 'v')
              this.unexpected();
            else {
              this.stack_push('{');
              this.ready_for = 'k';
            }
          }
          if(this.capture)
            this.capture_stack[this.capture_stack.length] = {};
          else if(this.callbacks.onStartObject() === false)
            break;
          continue;
        case 0x7d: // `}`
          if(this.validate && this.stack_pop() != '{')
            this.unexpected();
          if(this.capture) {
            if(this.capture_stack.length == 0)
              this.unsetCapture();
            else
              this.capture(this.capture_stack.pop());
          }

          if(!this.capture && this.callbacks.onEndObject() === false)
            break;
          continue;
        case 0x5b: // `[`
          if(this.validate) {
            if(!this.ready_for == 'v')
              this.unexpected();
            else
              this.stack_push('[');
          }
          if(this.capture)
            this.capture_stack[this.capture_stack.length] = [];
          else if(this.callbacks.onStartArray() === false)
            break;
          continue;
        case 0x5d: // `]`
          if(this.validate && this.stack_pop() != '[')
            this.unexpected();
          if(this.capture) {
            if(this.capture_stack.length == 0 )
              this.unsetCapture();
            else
              this.capture(this.capture_stack.pop());
          }

          if(!this.capture && this.callbacks.onEndArray() === false)
            break;
          continue;
        case 0x3a: // `:`
          if(this.validate) {
            if(this.ready_for == ':') {
              this.ready_for = 'v';
              if(this.capture)
                this.capture_key[this.capture_stack.length-1] = this.string;
              else if(this.callbacks.onKey(this.string) === false)
                break;
              this.string = undefined;
              this.noComma = true;
            } else 
              this.unexpected();
          }
          if(this.callbacks.onColon() === false)
            break;
          continue;
        case 0x2c: // `,`
          if(this.validate) {
            if(this.noComma)
              this.unexpected();
            else if(this.stack_last == '{')
              this.ready_for = 'k';
            else if(this.stack_last == '[')
              this.ready_for = 'v';
            else
              this.unexpected();

            this.noComma = true;
          }
          if(this.callbacks.onComma() === false)
            break;
          continue;
        case 0x74: // `t`
          if(this.validate && this.ready_for != 'v')
            this.unexpected();

          this.state = TRUE1;
          continue;
        case 0x66: // `f`
          if(this.validate && this.ready_for != 'v')
            this.unexpected();

          this.state = FALSE1;
          continue;
        case 0x6e: // `n`
          this.state = NULL1;
          continue;
        case 0x22: // `"`
          this.string = "";
          this.state = STRING1;
          continue;
        case 0x2d: // `-`
          this.negative = true;
          this.state = NUMBER1;
          continue;
        case 0x30: // `0`
          this.magnatude = 0;
          this.state = NUMBER2;
          continue;
        }
        if (n > 0x30 && n < 0x40) { // 1-9
          this.magnatude = n - 0x30;
          this.state = NUMBER3;
          continue;
        }
        if (n === 0x20 || n === 0x09 || n === 0x0a || n === 0x0d) {
          continue; // whitespace
        }
        this.charError(buffer, i);
      case STRING1: // After open quote
        n = buffer[i];
        switch (n) {
        case 0x22: // `"`
          if(this.validate) {
            if(this.ready_for == 'v')
              ;
            else if(this.ready_for == 'k')
              this.ready_for = ':';
            else 
              this.unexpected();

            this.string = decodeURIComponent(escape(this.string)); // for multibyte e.g. ä½ å¥½
            if(this.ready_for != ':') {
              if(this.callbacks.onString(this.string) === false)
                break;
              this.string = undefined;
            }
          }
          this.state = START;
          continue;
        case 0x5c: // `\`
          this.state = STRING2;
          continue;
        }
        if (n >= 0x20) {
          this.string += String.fromCharCode(n);
          continue;
        }
        this.charError(buffer, i);
      case STRING2: // After backslash
        n = buffer[i];
        switch (n) {
        case 0x22: this.string += "\""; this.state = STRING1; continue;
        case 0x5c: this.string += "\\"; this.state = STRING1; continue;
        case 0x2f: this.string += "\/"; this.state = STRING1; continue;
        case 0x62: this.string += "\b"; this.state = STRING1; continue;
        case 0x66: this.string += "\f"; this.state = STRING1; continue;
        case 0x6e: this.string += "\n"; this.state = STRING1; continue;
        case 0x72: this.string += "\r"; this.state = STRING1; continue;
        case 0x74: this.string += "\t"; this.state = STRING1; continue;
        case 0x75: this.unicode = ""; this.state = STRING3; continue;
        }
        this.charError(buffer, i);
      case STRING3: case STRING4: case STRING5: case STRING6: // unicode hex codes
        n = buffer[i];
        // 0-9 A-F a-f
        if ((n >= 0x30 && n < 0x40) || (n > 0x40 && n <= 0x46) || (n > 0x60 && n <= 0x66)) {
          this.unicode += String.fromCharCode(n);
          if (this.state++ === STRING6) {
            this.string += String.fromCharCode(parseInt(this.unicode, 16));
            this.unicode = undefined;
            this.state = STRING1;
          }
          continue;
        }
        this.charError(buffer, i);
      case NUMBER1: // after minus
        n = buffer[i];
        if (n === 0x30) { // `0`
          this.magnatude = 0;
          this.state = NUMBER2;
          continue;
        }
        if (n > 0x30 && n < 0x40) { // `1`-`9`
          this.magnatude = n - 0x30;
          this.state = NUMBER3;
          continue;
        }
        this.charError(buffer, i);
      case NUMBER2: // * After initial zero
        switch (buffer[i]) {
        case 0x2e: // .
          this.position = 0.1; this.state = NUMBER4; continue;
        case 0x65: case 0x45: // e/E
          this.exponent = 0; this.state = NUMBER6; continue;
        }
        this.finish(i);
        i--; // rewind to re-check this char
        continue;
      case NUMBER3: // * After digit (before period)
        n = buffer[i];
        switch (n) {
        case 0x2e: // .
          this.position = 0.1; this.state = NUMBER4; continue;
        case 0x65: case 0x45: // e/E
          this.exponent = 0; this.state = NUMBER6; continue;
        }
        if (n >= 0x30 && n < 0x40) { // 0-9
          this.magnatude = this.magnatude * 10 + (n - 0x30);
          continue;
        }
        this.finish(i);
        i--; // rewind to re-check
        continue;
      case NUMBER4: // After period
        n = buffer[i];
        if (n >= 0x30 && n < 0x40) { // 0-9
          this.magnatude += this.position * (n - 0x30);
          this.position /= 10;
          this.state = NUMBER5;
          continue;
        }
        this.charError(buffer, i);
      case NUMBER5: // * After digit (after period)
        n = buffer[i];
        if (n >= 0x30 && n < 0x40) { // 0-9
          this.magnatude += this.position * (n - 0x30);
          this.position /= 10;
          continue;
        }
        if (n === 0x65 || n === 0x45) { // E/e
          this.exponent = 0;
          this.state = NUMBER6;
          continue;
        }
        this.finish(i);
        i--; // rewind
        continue;
      case NUMBER6: // After E
        n = buffer[i];
        if (n === 0x2b || n === 0x2d) { // +/-
          if (n === 0x2d) { this.negativeExponent = true; }
          this.state = NUMBER7;
          continue;
        }
        if (n >= 0x30 && n < 0x40) {
          this.exponent = this.exponent * 10 + (n - 0x30);
          this.state = NUMBER8;
          continue;
        }
        this.charError(buffer, i);
      case NUMBER7: // After +/-
        n = buffer[i];
        if (n >= 0x30 && n < 0x40) { // 0-9
          this.exponent = this.exponent * 10 + (n - 0x30);
          this.state = NUMBER8;
          continue;
        }
        this.charError(buffer, i);
      case NUMBER8: // * After digit (after +/-)
        n = buffer[i];
        if (n >= 0x30 && n < 0x40) { // 0-9
          this.exponent = this.exponent * 10 + (n - 0x30);
          continue;
        }
        this.finish(i);
        i--;
        continue;
      case TRUE1: // r
        if (buffer[i] === 0x72) {
          this.state = TRUE2;
          continue;
        }
        this.charError(buffer, i);
      case TRUE2: // u
        if (buffer[i] === 0x75) {
          this.state = TRUE3;
          continue;
        }
        this.charError(buffer, i);
      case TRUE3: // e
        if (buffer[i] === 0x65) {
          this.state = START;
          if(this.validate && this.ready_for != 'v')
            this.unexpected();
          else if(this.callbacks.onBoolean(true) === false)
            break;
          continue;
        }
        this.charError(buffer, i);
      case FALSE1: // a
        if (buffer[i] === 0x61) {
          this.state = FALSE2;
          continue;
        }
        this.charError(buffer, i);
      case FALSE2: // l
        if (buffer[i] === 0x6c) {
          this.state = FALSE3;
          continue;
        }
        this.charError(buffer, i);
      case FALSE3: // s
        if (buffer[i] === 0x73) {
          this.state = FALSE4;
          continue;
        }
        this.charError(buffer, i);
      case FALSE4: // e
        if (buffer[i] === 0x65) {
          if(this.validate && this.ready_for != 'v')
            this.unexpected();
          else {
            this.state = START;
            if(this.callbacks.onBoolean(false) === false)
              break;
          }
          continue;
        }
        this.charError(buffer, i);
      case NULL1: // u
        if (buffer[i] === 0x75) {
          this.state = NULL2;
          continue;
        }
        this.charError(buffer, i);
      case NULL2: // l
        if (buffer[i] === 0x6c) {
          this.state = NULL3;
          continue;
        }
        this.charError(buffer, i);
      case NULL3: // l
        if (buffer[i] === 0x6c) {
          if(this.validate && this.ready_for != 'v')
            this.unexpected();
          else {
            this.state = START;
            if(this.callbacks.onNull() === false)
              break;
            continue;
          }
        }
        this.charError(buffer, i);
      }
    }
  };

  proto.finish = function() {
    switch (this.state) {
    case NUMBER2: // * After initial zero
      if(this.callbacks.onNumber(0) === false)
        break;
      this.state = START;
      this.magnatude = undefined;
      this.negative = undefined;
      break;
    case NUMBER3: // * After digit (before period)
      this.state = START;
      if (this.negative) {
        this.magnatude = -this.magnatude;
        this.negative = undefined;
      }
      if(this.callbacks.onNumber(this.magnatude) === false)
        break;
      this.magnatude = undefined;
      break;
    case NUMBER5: // * After digit (after period)
      this.state = START;
      if (this.negative) {
        this.magnatude = -this.magnatude;
        this.negative = undefined;
      }
      if(this.callbacks.onNumber(this.negative ? -this.magnatude : this.magnatude) === false)
        break;
      this.magnatude = undefined;
      this.position = undefined;
      break;
    case NUMBER8: // * After digit (after +/-)
      if (this.negativeExponent) {
        this.exponent = -this.exponent;
        this.negativeExponent = undefined;
      }
      this.magnatude *= Math.pow(10, this.exponent);
      this.exponent = undefined;
      if (this.negative) {
        this.magnatude = -this.magnatude;
        this.negative = undefined;
      }
      this.state = START;
      if(this.callbacks.onNumber(this.magnatude) === false)
        break;
      this.magnatude = undefined;
      break;
    }

    if (this.state !== START)
      this.callbacks.onError(new Error("Unexpected end of input stream"));
    else if(this.validate && this.ready_for != 'v')
      this.unexpected();
  };

})(typeof exports === 'undefined'? this['json_sax']={}: exports);
