/// <reference path="json_sax.d.ts"/>

// https://gist.githubusercontent.com/creationix/1821394/raw/c8b545b4133cdc72165861e2dc514b117930e264/jsonparse.js

declare var exports;

(function(exports){
  "use strict";

  // Named constants with unique integer values
  const C = {
    START  : 0x11,
    TRUE1  : 0x21,
    TRUE2  : 0x22,
    TRUE3  : 0x23,
    FALSE1 : 0x31,
    FALSE2 : 0x32,
    FALSE3 : 0x33,
    FALSE4 : 0x34,
    NULL1  : 0x41,
    NULL3  : 0x42,
    NULL2  : 0x43,
    NUMBER1: 0x51,
    NUMBER2: 0x52,
    NUMBER3: 0x53,
    NUMBER4: 0x54,
    NUMBER5: 0x55,
    NUMBER6: 0x56,
    NUMBER7: 0x57,
    NUMBER8: 0x58,
    STRING1: 0x61,
    STRING2: 0x62,
    STRING3: 0x63,
    STRING4: 0x64,
    STRING5: 0x65,
    STRING6: 0x66
  };

  exports.SaxParser = SaxParser;
  exports.getJsonPath = getJsonPath;

  // Slow code to string converter (only used when throwing syntax errors)
  function toknam(code) {
    let keys = Object.keys(C);
    for (let i = 0, l = keys.length; i < l; i++) {
      let key = keys[i];
      if (C[key] === code) { return key; }
    }
    return code && ("0x" + code.toString(16));
  }

  function getJsonPath(str:string, at:number):string {
    let parser = new SaxParser({}, { jsonPathAtPosition: at });
    parser.parse(str);
    return parser.jsonPathAtPositionResult;
  }

  function SaxParser(origCallbacks, options?:SaxParserOptions) {
    this.decoder = new TextDecoder('utf-8');
    this.stack = [];
    this.path = [];
    this.bytes_read = 0;
    this.ready_for = 'v'; // v = value, k = map key, : = colon

    let callbacks = this.callbacks = Object.assign({}, origCallbacks); // make a copy, so the original arg isn't changed
    options = options || {};
    this.validate = 'validate' in options ? options.validate : true;

    this.jsonPathAtPosition = options.jsonPathAtPosition;
    if(this.jsonPathAtPosition) {
      if(this.jsonPathAtPosition.constructor != Number || this.jsonPathAtPosition < 0)
        throw new Error('jsonPathAtPosition options should be an integer > 0');
      if('validate' in options && !this.validate)
        throw new Error('Using jsonPathAtPosition requires validation');
      else
        this.validate = true;
    }
    this.jsonPathAtPositionResult = null;

    this.callbacks.onKey = function() {
      let k = this.string;
      this.path[this.stack.length-1] = k;

      if(origCallbacks.onKey)
        return origCallbacks.onKey.apply(this, [k]);
    }

    this.callbacks.onComma = function() {
      if(this.stack[this.stack.length-1] == '[')
        this.path[this.stack.length-1]++;
      else
        this.path[this.stack.length-1] = '?';
      if(origCallbacks.onComma)
        origCallbacks.onComma.apply(this);
    }

    let that = this;
    ['onStartObject', 'onEndObject', 'onStartArray', 'onEndArray', 'onColon'].forEach(function(cbname) {
      if(!callbacks[cbname])
        that.callbacks[cbname] = origCallbacks[cbname] ? origCallbacks[cbname] : function() {};
    });

    this.unsetCapture = function() {
      this.capture = undefined;
    };

    this.on_value = function(v) {
      this.noComma = false;
      if(this.jsonPathAtPosition && this.bytes_read >= this.jsonPathAtPosition) {
        if(this.jsonPathAtPosition >= this.last_start)
          this.jsonPathAtPositionResult = this.path.slice(0, this.stack.length);
        else
          this.jsonPathAtPositionResult = [];
        return false;
      }

      if(this.capture)
        this.capture(v);
      else if(this.callbacks.onValue)
        return this.callbacks.onValue.apply(this, [v]);
    };

    ['onString', 'onBoolean', 'onNull', 'onNumber'].forEach(function(cbname) {
      let tmp = that.callbacks[cbname];
      if(cbname == 'onNull')
        callbacks[cbname] = function() {
          if(tmp)
            tmp(null);
          return that.on_value.apply(that, [null]);
        };
      else
        callbacks[cbname] = function(v) {
          if(tmp)
            tmp(v);
          return that.on_value.apply(that, [v]);
        };
    });

    if(!this.callbacks.onError)
      this.callbacks.onError = console.log;

    this.state = C.START;

    // for string parsing
    this.string = undefined; // string data

    // For number parsing
    this.negative = undefined;
    this.magnitude = undefined;
    this.position = undefined;
    this.exponent = undefined;
    this.negativeExponent = undefined;

    this.unexpected = function(e?) {
      let s = e ? e.toString() : String.fromCharCode(that.state);
      that.callbacks.onError(new Error("Unexpected '" + s + "' at position " + that.bytes_read + " in state " + toknam(that.state)));
      that.parse_err = true;
    };

    this.stack_push = function(v) {
      that.stack.push(v);
      that.stack_last = v;
      that.noComma = true;
      if(v == '[')
        that.path[that.stack.length - 1] = 0;
      else
        that.path[that.stack.length - 1] = '?';
    };

    this.stack_pop = function() {
      let popped;
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

  let proto = SaxParser.prototype;
  proto.setCapture = function(callback) {
    this.capture_at = this.stack.length;
    this.capture_key = [];
    this.capture_stack = [];
    this.capture = function(v) {
      if(this.capture_stack.length)
        this.capture_push(v);
      else
        callback(v);
    };
  };

  proto.capture_push = function(v) {
    let x = this.capture_stack[this.capture_stack.length-1];
    if(x.constructor == Array)
      x.push(v);
    else
      x[this.capture_key[this.capture_stack.length-1]] = v;
  };

  proto.charError = function (buffer, i) {
    this.parse_err = true;
    this.callbacks.onError(new Error("Unexpected " + JSON.stringify(String.fromCharCode(buffer[i])) + " at position " + i + " in state " + toknam(this.state)));
  };

  function str_to_bytearray(str) {
    const encoder = new TextEncoder();
    return encoder.encode(str);
  }

  proto.parse = function (buffer) {
    if (typeof buffer === "string")
      buffer = str_to_bytearray(buffer);
    let n;
    for(let i = 0, l = buffer.length; i < l && !this.parse_err && !this.jsonPathAtPositionResult;
        i++, this.bytes_read++) {
      switch (this.state) {
        case C.START:
          n = buffer[i];
          switch (n) {
            case 0x7b: // `{`
              this.last_start = i+1;
              if(this.validate) {
                if(this.ready_for != 'v')
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
              this.last_start = i+1;
              if(this.validate) {
                if(this.ready_for != 'v')
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
              this.last_start = i+1;
              if(this.validate) {
                if(this.ready_for == ':') {
                  this.ready_for = 'v';
                  if(this.capture)
                    this.capture_key[this.capture_stack.length-1] = this.string;
                  else if(this.callbacks.onKey.apply(this) === false)
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
              this.last_start = i+1;
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
              if(this.callbacks.onComma.apply(this) === false)
                break;
              continue;
            case 0x74: // `t`
              if(this.validate && this.ready_for != 'v')
                this.unexpected();

              this.last_start = i;
              this.state = C.TRUE1;
              continue;
            case 0x66: // `f`
              if(this.validate && this.ready_for != 'v')
                this.unexpected();

              this.last_start = i;
              this.state = C.FALSE1;
              continue;
            case 0x6e: // `n`
              this.last_start = i;
              this.state = C.NULL1;
              continue;
            case 0x22: // `"`
              this.last_start = i;
              this.raw_string = '';
              this.state = C.STRING1;
              continue;
            case 0x2d: // `-`
              this.last_start = i;
              this.negative = true;
              this.state = C.NUMBER1;
              continue;
            case 0x30: // `0`
              this.last_start = i;
              this.magnitude = 0;
              this.state = C.NUMBER2;
              continue;
          }
          if (n > 0x30 && n < 0x40) { // 1-9
            this.last_start = i;
            this.magnitude = n - 0x30;
            this.state = C.NUMBER3;
            continue;
          }
          if (n === 0x20 || n === 0x09 || n === 0x0a || n === 0x0d) {
            this.last_start = i;
            continue; // whitespace
          }
          this.charError(buffer, i);
        case C.STRING1: // After open quote
          n = buffer[i];
          switch (n) {
            case 0x22: // `"`
              if(this.validate) {
                let unexpected = false;
                if(this.ready_for == 'v') {
                  // expected a value. OK
                } else if(this.ready_for == 'k')
                  this.ready_for = ':';
                else {
                  unexpected = true;
                  this.unexpected();
                }
                if(!unexpected) {
                  try {
                    // add the last string chunk
                    this.raw_string += this.decoder.decode(buffer.slice(this.last_start, i+1), { stream: true });
                    this.raw_string += this.decoder.decode();
                    this.string = JSON.parse(this.raw_string);
                  } catch(e) {
                    this.unexpected(e);
                  }
                  if(this.ready_for != ':') {
                    if(this.callbacks.onString(this.string) === false)
                      break;
                    this.string = undefined;
                  }
                }
              }
              this.state = C.START;
              continue;
            case 0x5c: // `\`
              this.state = C.STRING2;
              continue;
          }
          if (n >= 0x20)
            continue;
          this.charError(buffer, i);
        case C.STRING2: // After backslash
          n = buffer[i];
          switch (n) {
            case 0x22: this.state = C.STRING1; continue;
            case 0x5c: this.state = C.STRING1; continue;
            case 0x2f: this.state = C.STRING1; continue;
            case 0x62: this.state = C.STRING1; continue;
            case 0x66: this.state = C.STRING1; continue;
            case 0x6e: this.state = C.STRING1; continue;
            case 0x72: this.state = C.STRING1; continue;
            case 0x74: this.state = C.STRING1; continue;
            case 0x75: this.state = C.STRING3; continue;
          }
          this.charError(buffer, i);
        case C.STRING3: case C.STRING4: case C.STRING5: case C.STRING6: // unicode hex codes
          n = buffer[i];
          // 0-9 A-F a-f

          if ((n >= 0x30 && n < 0x40) || (n > 0x40 && n <= 0x46) || (n > 0x60 && n <= 0x66)) {
            if (this.state++ === C.STRING6)
              this.state = C.STRING1;
            continue;
          }
          this.charError(buffer, i);
        case C.NUMBER1: // after minus
          n = buffer[i];
          if (n === 0x30) { // `0`
            this.magnitude = 0;
            this.state = C.NUMBER2;
            continue;
          }
          if (n > 0x30 && n < 0x40) { // `1`-`9`
            this.magnitude = n - 0x30;
            this.state = C.NUMBER3;
            continue;
          }
          this.charError(buffer, i);
        case C.NUMBER2: // * After initial zero
          switch (buffer[i]) {
            case 0x2e: // .
              this.position = 0.1; this.state = C.NUMBER4; continue;
            case 0x65: case 0x45: // e/E
              this.exponent = 0; this.state = C.NUMBER6; continue;
          }
          this.finish(i);
          i--; // rewind to re-check this char
          continue;
        case C.NUMBER3: // * After digit (before period)
          n = buffer[i];
          switch (n) {
            case 0x2e: // .
              this.position = 0.1; this.state = C.NUMBER4; continue;
            case 0x65: case 0x45: // e/E
              this.exponent = 0; this.state = C.NUMBER6; continue;
          }
          if (n >= 0x30 && n < 0x40) { // 0-9
            this.magnitude = this.magnitude * 10 + (n - 0x30);
            continue;
          }
          this.finish(i);
          i--; // rewind to re-check
          continue;
        case C.NUMBER4: // After period
          n = buffer[i];
          if (n >= 0x30 && n < 0x40) { // 0-9
            this.magnitude += this.position * (n - 0x30);
            this.position /= 10;
            this.state = C.NUMBER5;
            continue;
          }
          this.charError(buffer, i);
        case C.NUMBER5: // * After digit (after period)
          n = buffer[i];
          if (n >= 0x30 && n < 0x40) { // 0-9
            this.magnitude += this.position * (n - 0x30);
            this.position /= 10;
            continue;
          }
          if (n === 0x65 || n === 0x45) { // E/e
            this.exponent = 0;
            this.state = C.NUMBER6;
            continue;
          }
          this.finish(i);
          i--; // rewind
          continue;
        case C.NUMBER6: // After E
          n = buffer[i];
          if (n === 0x2b || n === 0x2d) { // +/-
            if (n === 0x2d) { this.negativeExponent = true; }
            this.state = C.NUMBER7;
            continue;
          }
          if (n >= 0x30 && n < 0x40) {
            this.exponent = this.exponent * 10 + (n - 0x30);
            this.state = C.NUMBER8;
            continue;
          }
          this.charError(buffer, i);
        case C.NUMBER7: // After +/-
          n = buffer[i];
          if (n >= 0x30 && n < 0x40) { // 0-9
            this.exponent = this.exponent * 10 + (n - 0x30);
            this.state = C.NUMBER8;
            continue;
          }
          this.charError(buffer, i);
        case C.NUMBER8: // * After digit (after +/-)
          n = buffer[i];
          if (n >= 0x30 && n < 0x40) { // 0-9
            this.exponent = this.exponent * 10 + (n - 0x30);
            continue;
          }
          this.finish(i);
          i--;
          continue;
        case C.TRUE1: // r
          if (buffer[i] === 0x72) {
            this.state = C.TRUE2;
            continue;
          }
          this.charError(buffer, i);
        case C.TRUE2: // u
          if (buffer[i] === 0x75) {
            this.state = C.TRUE3;
            continue;
          }
          this.charError(buffer, i);
        case C.TRUE3: // e
          if (buffer[i] === 0x65) {
            this.state = C.START;
            if(this.validate && this.ready_for != 'v')
              this.unexpected();
            else if(this.callbacks.onBoolean(true) === false)
              break;
            continue;
          }
          this.charError(buffer, i);
        case C.FALSE1: // a
          if (buffer[i] === 0x61) {
            this.state = C.FALSE2;
            continue;
          }
          this.charError(buffer, i);
        case C.FALSE2: // l
          if (buffer[i] === 0x6c) {
            this.state = C.FALSE3;
            continue;
          }
          this.charError(buffer, i);
        case C.FALSE3: // s
          if (buffer[i] === 0x73) {
            this.state = C.FALSE4;
            continue;
          }
          this.charError(buffer, i);
        case C.FALSE4: // e
          if (buffer[i] === 0x65) {
            if(this.validate && this.ready_for != 'v')
              this.unexpected();
            else {
              this.state = C.START;
              if(this.callbacks.onBoolean(false) === false)
                break;
            }
            continue;
          }
          this.charError(buffer, i);
        case C.NULL1: // u
          if (buffer[i] === 0x75) {
            this.state = C.NULL2;
            continue;
          }
          this.charError(buffer, i);
        case C.NULL2: // l
          if (buffer[i] === 0x6c) {
            this.state = C.NULL3;
            continue;
          }
          this.charError(buffer, i);
        case C.NULL3: // l
          if (buffer[i] === 0x6c) {
            if(this.validate && this.ready_for != 'v')
              this.unexpected();
            else {
              this.state = C.START;
              if(this.callbacks.onNull() === false)
                break;
              continue;
            }
          }
          this.charError(buffer, i);
      }
    }
    // if we are still in the middle of a string, then decode that portion of the string
    switch(this.state) {
      case C.STRING1:
      case C.STRING2:
      case C.STRING3:
      case C.STRING4:
      case C.STRING5:
      case C.STRING6:
        this.raw_string += this.decoder.decode(buffer.slice(this.last_start, buffer.length), { stream: true });
        this.last_start = 0;
    }
  };

  proto.finish = function(_i:number) {
    switch (this.state) {
      case C.NUMBER2: // * After initial zero
        if(this.callbacks.onNumber(0) === false)
          break;
        this.state = C.START;
        this.magnitude = undefined;
        this.negative = undefined;
        break;
      case C.NUMBER3: // * After digit (before period)
        this.state = C.START;
        if (this.negative) {
          this.magnitude = -this.magnitude;
          this.negative = undefined;
        }
        if(this.callbacks.onNumber(this.magnitude) === false)
          break;
        this.magnitude = undefined;
        break;
      case C.NUMBER5: // * After digit (after period)
        this.state = C.START;
        if (this.negative) {
          this.magnitude = -this.magnitude;
          this.negative = undefined;
        }
        if(this.callbacks.onNumber(this.negative ? -this.magnitude : this.magnitude) === false)
          break;
        this.magnitude = undefined;
        this.position = undefined;
        break;
      case C.NUMBER8: // * After digit (after +/-)
        if (this.negativeExponent) {
          this.exponent = -this.exponent;
          this.negativeExponent = undefined;
        }
        this.magnitude *= Math.pow(10, this.exponent);
        this.exponent = undefined;
        if (this.negative) {
          this.magnitude = -this.magnitude;
          this.negative = undefined;
        }
        this.state = C.START;
        if(this.callbacks.onNumber(this.magnitude) === false)
          break;
        this.magnitude = undefined;
        break;
    }

    if(this.state !== C.START)
      this.callbacks.onError(new Error("Unexpected end of input stream"));
    else if(this.validate && this.ready_for != 'v')
      this.unexpected();
  };

})(typeof exports === 'undefined'? this['json_sax']={}: exports);
