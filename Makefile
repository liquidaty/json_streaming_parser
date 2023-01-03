
all: streamparse_2.js data/generate data/1k.json.bz2 data/10k.json.bz2 data/100k.json.bz2 data/1mm.json.bz2 test_commands.txt  json_sax.js

TSC_FLAGS=--lib es2017,dom --noUnusedLocals --noUnusedParameters --noEmitOnError

json_sax.js: json_sax.ts
	tsc ${TSC_FLAGS} $< --outFile $@

data/generate: data/generate.c
	gcc -o data/generate data/generate.c

data/1k.json.bz2: data/generate
	data/generate 1000 | bzip2 > $@

data/10k.json.bz2: data/generate
	data/generate 10000 | bzip2 > $@

data/100k.json.bz2: data/generate
	data/generate 100000 | bzip2 > $@

data/1mm.json.bz2: data/generate
	data/generate 1000000 | bzip2 > $@

streamparse_2.js: streamparse_2.ts
	tsc streamparse_2.ts

test_commands.txt: parsetest.sh
	DRY=1 ./parsetest.sh > $@
