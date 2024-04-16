import createContext from '../createContext'
import { goRunner } from '../runner/goRunner'
import { Chapter, Variant } from '../types'
import { parse } from './parser'

// const program = `
// var x = 1;
// const y = 10;
// for var i = 0; i < 5; i = i + 1 {
//   const y = 5;
//   x = x * 2;
//   x = x + y;
// }
// x;
// `

// const no_wg_program = `
// x := 10;
// func f() {
//   x = 2;
// }
// go f();
// x;
// `

const program = `
x := 10;
var wg WaitGroup;
wg.Add();
func f() {
  x = 2;
  wg.Done();
}
go f();
wg.Wait();
x;
`
function main() {
  const variant = Variant.CONCURRENT
  const context = createContext(Chapter.GO_1, variant, undefined, undefined)

  const parsed = parse(program, context)
  goRunner(parsed)
}

main()
