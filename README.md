# json-streaming-parser

## background
json_sax.js is a streaming, event-driven parser modified from jsonparse.js (https://github.com/creationix/jsonparse and https://gist.github.com/creationix/1821394). Event-driven parsers are generally high-performance, at the cost of code complexity. This library attempts to alleviate the latter issue by including higher-level convenience features such as:
  - built-in stack tracking / control
  - 'capture' capability enabling portions / components of the input JSON to be iteratively captured and processed in traditional style
  - future: add option to capture function to set a memory usage ceiling per captured object
  - future: add 'path' function to check the current JSON object path

The name 'json_sax.js' might later change, as it is somewhat of a misnomer since the term "sax" originally was mean for XML
(though nowadays it is commonly used when referring to event-driven parsers of any sort).


## objectives
The objectives of this project are:
  - like any proper sax parser, run with fixed memory regardless of input data size, BUT also...
  - minimize the amount of code required to use this library for your purposes, by providing convenience features such as:
    - built-in stack tracing
    - 'capture' interface to support traditional non-streaming code embedded within the streaming framework


## performance
This package includes performance tests (with more still in process) that show the following using a *very rudimentary* test.
The results of this test should not be considered representative of the results you will see in actual production use in terms
of the specific metrics at which this parser begins to outperform traditional ast-based parsing (e.g. JSON.parse).
However, the fact that this parser will, at some point, outperform traditional parsing will remain true at some input size;
it's just a question of what that size is.

The included tests generate rows of data, each row consisting of 15 random integers, the sum of which is calculated using this
parser and using JSON.parse with Node running the js tests. Time and memory requirements are compared on datasets consisting of 1k, 10k, 100k, and 1mm rows.
On a 2015 Macbook Air, 

method|rows|avg time per 1k rows|avg mem
 --- | --- | --- | ---
JSON.parse|1000|6.4|4.38
json_sax|1000|41.8|4.4
JSON.parse|10000|8.38|8.11
json_sax|10000|8.32|4.43
JSON.parse|100000|10.724|41.12
json_sax|100000|7.122|4.802
JSON.parse|1000000|10.624|360.52
json_sax|1000000|6.852|4.35


# installation
## prerequisites

Typescript compiler (tsc)
Node: with @types/node installed
    npm i @types/node
make
C compiler (gcc)
bzip2

You need a bash interpreter to run the test script,
but you can run the test commands without bash
by manually running the node commands listed in test_commands.txt

## building

To build the test examples, run:
   make

This will generate JSON data files in sizes of 1k, 10k, 100k and 1mm, compress with bz2 and save in the data folder.

### running the tests
To view the test commands, without running them:
   DRY=1 ./parsetest.sh

To run the tests and save to results.csv:
   ./parsetest.sh | tee results.csv

To run with a different number of trials:
   TRIALS=3 ./parsetest.sh

### generating data
Running ```make``` will generate test data, but if you'd like to to 
generate your own, you can use the data/generate executable.

For example, to generate a data file with 10mm rows and 15 columns,
then compress and save to 10mm.json.bz2:

    node generate.js 10000000 15 | bzip2 -c > 10mm.json.bz2

