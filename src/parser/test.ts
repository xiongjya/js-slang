import createContext from '../createContext'
import { goRunner } from '../runner/goRunner'
import { Chapter, Variant } from '../types'
import { parse } from './parser'

/*
var x = 1;
const y = 10;

func f(x int) { 
  Println(100);
}

go f(y + 3);

for var i = 0; i < 5; i = i + 1 {
  const y = 5;
  x = x * 2;
  x = x + y;
  go f(y + 3);
}
x;
`
*/

const program = `
var x chan int = make(chan int);

func f(c chan int) {
  c <- 10;
  Println("am i blocked");
}

for var i = 0; i < 5; i = i + 1 {
  go f(x);
  y := <- x;
  Println(y);
}
`
function main() {
  const variant = Variant.CONCURRENT
  const context = createContext(Chapter.GO_1, variant, undefined, undefined)

  const parsed = parse(program, context)
  goRunner(parsed)
}

main()
