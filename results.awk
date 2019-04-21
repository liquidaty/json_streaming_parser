{
	time[$1 "," $2] += $4;
  mem[$1 "," $2] += $5;
  count[$1 "," $2] += 1;
}

END {
  print "method,rows,avg time,avg mem";
  for(x in time) {
    print x "," time[x]/count[x] "," mem[x]/count[x]; 
  }
}
