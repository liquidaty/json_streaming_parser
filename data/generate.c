// build: gcc generate.c -o generate

#include <stdio.h>
#include <stdlib.h>

int getRandomInt(int lower, int upper) {
  return (rand() % (upper - lower + 1)) + lower;
}

int main(int argc, char *argv[]) {
  int rows, cols=25, low=0, high=100;
  if(argc >= 2) {
    rows = atoi(argv[1]);
    if(argc > 2) {
      cols = atoi(argv[2]);
      if(argc > 3) {
        high = atoi(argv[3]);
        if(argc > 4) {
          low = atoi(argv[4]);
        }
      }
    }
  }

  if(argc < 2 || rows <= 0 || cols <= 0 || low >= high) {
    fprintf(stderr, "Usage: generate rows cols=25 high=100, low=0\n");
    return 1;
  }

  printf("[");
  for(int i = 0; i < rows; i++) {
    if(i)
      printf(",\n[");
    else
      printf("[");

    for(int j = 0; j < cols; j++) {
      if(j)
        printf(",");
      printf("%d", getRandomInt(low, high));
    }
    
    printf("]");
  }
  printf("]");

  return 0;
}
