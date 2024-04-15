import createContext from '../createContext'
import { goRunner } from '../runner/goRunner'
import { Chapter, Variant } from '../types'
import { parse } from './parser'

const program = `
var x = 1;
for var i = 0; i < 5; i = i + 1 {
  x = x * 2;
}
x;
`
function main() {
  const variant = Variant.CONCURRENT
  const context = createContext(Chapter.GO_1, variant, undefined, undefined)

  const parsed = parse(program, context)
  goRunner(parsed)
}

main()
