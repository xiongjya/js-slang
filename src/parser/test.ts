import createContext from '../createContext'
import { Chapter, Variant } from '../types'
import { parse } from './parser'

const program = `
  2 + 3;
  go f();
`
function main() {
  const variant = Variant.CONCURRENT
  const context = createContext(Chapter.GO_1, variant, undefined, undefined)
  parse(program, context)
}

main()
