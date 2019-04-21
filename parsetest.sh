#/bin/sh

if [ "$1" == "--help" ]; then
    echo 2>&1 "usage: [DRY=0] [TRIALS=5] $0"
    echo 2>&1 "  If DRY is 1, only commands are output"
    exit 1
fi

if [ "$TRIALS" == "" ]; then
    TRIALS=5
fi

if [ "$DRY" == "1" ] ; then
    echo 'echo "Method,Rows,Sum,Time,Memory" | tee results.csv'
else
    echo "Method,Rows,Sum,Time,Memory" | tee results.csv
fi

for datafile in data/1k.json.bz2 data/10k.json.bz2 data/100k.json.bz2 data/1mm.json.bz2 ; do
    for method in stdparse streamparse streamparse_2 ; do
        for ((i=0;i<"$TRIALS";i++)) ; do
            if [ "$DRY" == "1" ] ; then
                echo "bzip2 -d -c "$datafile" | node $method.js -s | tee -a results.csv"
            else
                bzip2 -d -c "$datafile" | node $method.js -s | tee -a results.csv
            fi
        done
    done
done

if [ "$DRY" == "1" ] ; then
    echo 'echo "Printing final averages" | tee averages.csv'
else
    echo "Printing final averages" | tee averages.csv
fi

if [ "$DRY" == "1" ] ; then
    echo "cat results.csv | awk -F, -f results.awk | tee -a averages.csv"
else
    cat results.csv | awk -F, -f results.awk | tee -a averages.csv
fi

