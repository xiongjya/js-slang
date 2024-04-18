import { parse } from '../parser/parser'
import createContext from '../createContext'
import { Chapter, Result, Variant } from '../types'
import { goRunner } from '../runner/goRunner'

function test_program(program: string) {
  const variant = Variant.CONCURRENT
  const context = createContext(Chapter.GO_1, variant, undefined, undefined)

  const parsed = parse(program, context)
  return goRunner(parsed, context)
}

test('Simple test', async () => {
  const program: string = `
    x := 3;
    x;
    `
  const result: Result = await test_program(program)
  expect(result.status).toBe('finished')
  expect((result as any).value).toBe(3)
})

test('Waitgroup', async () => {
  const no_wg_program: string = `
    x := 10;
    func f() {
        for var i = 0; i < 5; i = i + 1 {}
        x = 2;
    }
    go f();
    x;
    `
  let result = await test_program(no_wg_program)
  expect(result.status).toBe('finished')
  expect((result as any).value).toBe(10)
  const wg_program: string = `
    x := 10;
    var wg WaitGroup;
    wg.Add(1);
    func f() {
        for var i = 0; i < 5; i = i + 1 {}
        x = 2;
        wg.Done();
    }
    go f();
    wg.Wait();
    x;
    `
  result = await test_program(wg_program)
  expect(result.status).toBe('finished')
  expect((result as any).value).toBe(2)
})

test('Channel', async () => {
  const program: string = `
    var x chan int = make(chan int);
    var y int;

    func f(c chan int) {
        c <- 10;
    }

    for var i = 0; i < 5; i = i + 1 {
        go f(x);
        y = <- x;
    }
    y;
    `
  let result = await test_program(program)
  expect(result.status).toBe('finished')
  expect((result as any).value).toBe(10)
})
