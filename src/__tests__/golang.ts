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

test('Declarations - constant, variable, function', async () => {
  var program: string = `
    const x = 3;
    x;
  `
  var result: Result = await test_program(program)
  expect(result.status).toBe('finished')
  expect((result as any).value).toBe(3)
  program = `
    y := 'hello';
    y;
  `
  result = await test_program(program)
  expect(result.status).toBe('finished')
  expect((result as any).value).toBe('hello')
  program = `
    var y = 'world';
    y;
  `
  result = await test_program(program)
  expect(result.status).toBe('finished')
  expect((result as any).value).toBe('world')
  program = `
    func f() {
      return 1;
    }
  `
  result = await test_program(program)
  expect(result.status).toBe('finished')
  expect((result as any).value).toBe('<closure>')
})

test('Assignments - legal variable and illegal constant assignments', async () => {
  var program: string = `
    x := 3;
    x = 2;
    x;
  `
  var result: Result = await test_program(program)
  expect(result.status).toBe('finished')
  expect((result as any).value).toBe(2)
  program = `
    const y = 'blue';
    y = 'berry';
  `
  result = await test_program(program)
  expect(result.status).toBe('error')
})

test('Function calls & blocks', async () => {
  var program: string = `
    const x = 3;
    func foo(x) {
      x = 2 + 3;
      return x;
    }
    foo(x);
  `
  var result: Result = await test_program(program)
  expect(result.status).toBe('finished')
  expect((result as any).value).toBe(5)
})

test('For loops with break and continue', async () => {
  var program: string = `
    var x = 1;
    const y = 10;
    for var i = 0; i < 10; i = i + 1 {
      const y = 5;
      x = x * 2;

      if (x < 16) {
        continue;
      } else if (i > 8) {
        break;
      }

      x = x + y;
    }
    x;
  `
  var result: Result = await test_program(program)
  expect(result.status).toBe('finished')
  expect((result as any).value).toBe(1654)
})

test('Conditional expressions', async () => {
  var program: string = `
    var x = true ? 2 : 1;
    x;
  `
  var result: Result = await test_program(program)
  expect(result.status).toBe('finished')
  expect((result as any).value).toBe(2)
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
