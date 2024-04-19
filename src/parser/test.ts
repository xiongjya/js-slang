import createContext from '../createContext'
import { goRunner } from '../runner/goRunner'
import { Chapter, Variant } from '../types'
import { parse } from './parser'

/*
const program = `
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
`

const program = `
var x = 1;
const y = 10;
for var i = 0; i < 5; i = i + 1 {
  const y = 5;
  x = x * 2;
  x = x + y;
}
x;
`

const no_wg_program = `
x := 10;
func f() {
  x = 2;
}
go f();
x;
`

const program = `
x := 10;
var wg WaitGroup;
wg.Add(1);
func f() {
  x = 2;
  wg.Done();

}
go f();
wg.Wait();
x;

const a = 10;
b := 20;
var x = make(chan);

func f(x, val) {
  x <- val;
  Println("am i blocked");
  Println(b);
  Println(a);
}

for var i = 0; i < 5; i = i + 1 {
  go f(x, i);
  y := <- x;
  Println(y);
}
`
*/

const program = `
var x = 1;
const y = 10;
for var i = 0; i < 10; i = i + 1 {
  const y = 5;
  x = x * 2;

  if (x < 16) {
    continue;
  }

  x = x + y;
}
x;
continue;
`

function main() {
  const variant = Variant.CONCURRENT
  const context = createContext(Chapter.GO_1, variant, undefined, undefined)

  const parsed = parse(program, context)
  goRunner(parsed, context)
}

main()
