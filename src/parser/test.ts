import createContext from '../createContext'
import { goRunner } from '../runner/goRunner'
import { Chapter, Variant } from '../types'
import { parse } from './parser'

const program = `
  var x int = 1;
  x = x + 1;
  x;
`
function main() {
  const variant = Variant.CONCURRENT
  const context = createContext(Chapter.GO_1, variant, undefined, undefined)

  const parsed = parse(program, context)
  goRunner(parsed)
}

main()
