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
    var x = make(chan);
    var y = 2;

    func f(c) {
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

test('Deadlock detection: WaitGroup', async () => {
  const program: string = `
    var wg WaitGroup;
    wg.Add(1);
    wg.Wait();
    `
  let result = await test_program(program)
  expect(result.status).toBe('error')
})

test('Deadlock detection: Channel', async () => {
  const program: string = `
    var x = make(chan);
    x <- 10;
    `
  let result = await test_program(program)
  expect(result.status).toBe('error')
})
