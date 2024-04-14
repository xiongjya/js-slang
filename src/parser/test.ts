import createContext from '../createContext'
import { goRunner } from '../runner/goRunner'
import { Chapter, Variant } from '../types'
import { parse } from './parser'

const program = `
  const x = 20;
  func main() {
    const x = 5;
    if (x < 10) {
      return 1;
    } else {
      return 2;
    }
  }

  main();
`
function main() {
  const variant = Variant.CONCURRENT
  const context = createContext(Chapter.GO_1, variant, undefined, undefined)

  const parsed = parse(program, context)
  goRunner(parsed)
}

main()
