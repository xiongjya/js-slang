/* ********
 * compiler
 * ********/

import { Finished, Result } from '../types'

// wc: write counter
let wc: number
// instrs: instruction array
let instrs: any[]

const peek = (arr: any[]) => {
  return arr[arr.length - 1]
}

// scanning out the declarations from (possibly nested)
// sequences of statements, ignoring blocks
const scan = (comp: any) =>
  comp.tag === 'seq'
    ? comp.stmts.reduce((acc: any, x: any) => acc.concat(scan(x)), [])
    : ['let', 'const', 'fun'].includes(comp.tag)
    ? [comp.sym]
    : []

const compile_sequence = (seq: any) => {
  if (seq.length === 0) {
    instrs[wc++] = { tag: 'LDC', val: undefined }
    return
  }
  let first = true
  for (let comp of seq) {
    first ? (first = false) : (instrs[wc++] = { tag: 'POP' })
    compile(comp)
  }
}

const compile_comp = {
  ExpressionStatement: (comp: any): void => {
    compile(comp.expression)
  },
  Literal: (comp: any): void => {
    instrs[wc++] = { tag: 'LDC', val: comp.value }
  },
  nam: (comp: any): void => {
    instrs[wc++] = { tag: 'LD', sym: comp.sym }
  },
  unop: (comp: any): void => {
    compile(comp.frst)
    instrs[wc++] = { tag: 'UNOP', sym: comp.operator }
  },
  BinaryExpression: (comp: any): void => {
    compile(comp.left)
    compile(comp.right)
    console.log(comp.operator)
    instrs[wc++] = { tag: 'BINOP', sym: comp.operator }
  },
  log: (comp: any): void => {
    compile(
      comp.sym == '&&'
        ? { tag: 'cond_expr', pred: comp.frst, cons: { tag: 'lit', val: true }, alt: comp.scnd }
        : { tag: 'cond_expr', pred: comp.frst, cons: comp.scnd, alt: { tag: 'lit', val: false } }
    )
  },
  cond: (comp: any): void => {
    compile(comp.pred)
    const jump_on_false_instruction = { tag: 'JOF', addr: 0 }
    instrs[wc++] = jump_on_false_instruction
    compile(comp.cons)
    const goto_instruction = { tag: 'GOTO', addr: 0 }
    instrs[wc++] = goto_instruction
    const alternative_address = wc
    jump_on_false_instruction.addr = alternative_address
    compile(comp.alt)
    goto_instruction.addr = wc
  },
  app: (comp: any): void => {
    compile(comp.fun)
    for (let arg of comp.args) {
      compile(arg)
    }
    instrs[wc++] = { tag: 'CALL', arity: comp.args.length }
  },
  assmt: (comp: any): void => {
    compile(comp.expr)
    instrs[wc++] = { tag: 'ASSIGN', sym: comp.sym }
  },
  lam: (comp: any): void => {
    instrs[wc++] = { tag: 'LDF', prms: comp.prms, addr: wc + 1 }
    // jump over the body of the lambda expression
    const goto_instruction = { tag: 'GOTO', addr: 0 }
    instrs[wc++] = goto_instruction
    compile(comp.body)
    instrs[wc++] = { tag: 'LDC', val: undefined }
    instrs[wc++] = { tag: 'RESET' }
    goto_instruction.addr = wc
  },
  seq: (comp: any): void => compile_sequence(comp.stmts),
  blk: (comp: any): void => {
    const locals = scan(comp.body)
    instrs[wc++] = { tag: 'ENTER_SCOPE', syms: locals }
    compile(comp.body)
    instrs[wc++] = { tag: 'EXIT_SCOPE' }
  },
  let: (comp: any): void => {
    compile(comp.expr)
    instrs[wc++] = { tag: 'ASSIGN', sym: comp.sym }
  },
  const: (comp: any): void => {
    compile(comp.expr)
    instrs[wc++] = { tag: 'ASSIGN', sym: comp.sym }
  },
  ret: (comp: any): void => {
    if (comp.expr.tag === 'cond') {
      comp.expr.cons = { tag: 'ret', expr: comp.expr.cons }
      comp.expr.alt = { tag: 'ret', expr: comp.expr.alt }
      compile(comp.expr)
    } else {
      compile(comp.expr)
      if (comp.expr.tag === 'app') {
        // tail call: turn CALL into TAILCALL
        instrs[wc - 1].tag = 'TAIL_CALL'
      } else {
        instrs[wc++] = { tag: 'RESET' }
      }
    }
  },
  fun: (comp: any): void => {
    compile({ tag: 'const', sym: comp.sym, expr: { tag: 'lam', prms: comp.prms, body: comp.body } })
  }
}

// compile component into instruction array instrs,
// starting at wc (write counter)
const compile = (comp: any) => {
  try {
    compile_comp[comp.type](comp)
  } catch {
    console.log(`can't find ${comp.type}`)
  }
  instrs[wc] = { tag: 'DONE' }
}

// compile program into instruction array instrs,
// after initializing wc and instrs
function compile_program(program: any) {
  wc = 0
  instrs = []
  compile(program)
}

/* *************************
 * values of the machine
 * *************************/

// for numbers, strings, booleans, undefined, null
// we use the value directly

/* **********************
 * operators and builtins
 * **********************/

const binop_microcode = {
  '+': (x: number, y: number) => x + y,
  // todo: add error handling to JS for the following, too
  '*': (x: number, y: number) => x * y,
  '-': (x: number, y: number) => x - y,
  '/': (x: number, y: number) => x / y,
  '%': (x: number, y: number) => x % y,
  '<': (x: number, y: number) => x < y,
  '<=': (x: number, y: number) => x <= y,
  '>=': (x: number, y: number) => x >= y,
  '>': (x: number, y: number) => x > y,
  '===': (x: any, y: any) => x === y,
  '!==': (x: any, y: any) => x !== y
}

// v2 is popped before v1
const apply_binop = (op: string, v2: any, v1: any) => binop_microcode[op](v1, v2)

const unop_microcode = {
  '-unary': (x: number) => -x,
  '!': (x: boolean) => !x
}

const apply_unop = (op: string, v: any) => unop_microcode[op](v)

const builtin_mapping = {
  // display       : display,
}

const apply_builtin = (builtin_symbol: string, args: any[]) =>
  builtin_mapping[builtin_symbol](...args)

/* ************
 * environments
 * ************/

// Frames are objects that map symbols (strings) to values.

const global_frame = new Map<string, any>()

// fill global frame with built-in objects
for (const key in builtin_mapping)
  global_frame[key] = { tag: 'BUILTIN', sym: key, arity: builtin_mapping[key].arity }
// fill global frame with built-in constants
global_frame['undefined'] = undefined

// An environment is null or a pair whose head is a frame
// and whose tail is an environment.
const empty_environment = null
const global_environment = [global_frame, empty_environment]

const extend = (xs: any, vs: any, e: any) => {
  const new_frame = {}
  for (let i = 0; i < xs.length; i++) new_frame[xs[i]] = vs[i]
  return [new_frame, e]
}

// At the start of executing a block, local
// variables refer to unassigned values.
const unassigned = { tag: 'unassigned' }

/* *******
 * machine
 * *******/

let OS: any[]
let PC: number
let E: any
let RTS: any

const microcode = {
  LDC: (instr: any) => {
    PC++
    OS.push(instr.val)
  },
  UNOP: (instr: any) => {
    PC++
    OS.push(apply_unop(instr.sym, OS.pop()))
  },
  BINOP: (instr: any) => {
    PC++
    OS.push(apply_binop(instr.sym, OS.pop(), OS.pop()))
  },
  POP: (instr: any) => {
    PC++
    OS.pop()
  },
  JOF: (instr: any) => {
    PC = OS.pop() ? PC + 1 : instr.addr
  },
  GOTO: (instr: any) => {
    PC = instr.addr
  },
  ENTER_SCOPE: (instr: any) => {
    PC++
    RTS.push({ tag: 'BLOCK_FRAME', env: E })
    const locals = instr.syms
    const unassigneds = locals.map((x: any) => unassigned)
    E = extend(locals, unassigneds, E)
  },
  EXIT_SCOPE: (instr: any) => {
    PC++
    E = RTS.pop().env
  },
  LD: (instr: any) => {
    PC++
    OS.push(lookup(instr.sym, E))
  },
  ASSIGN: (instr: any) => {
    PC++
    assign_value(instr.sym, peek(OS), E)
  },
  LDF: (instr: any) => {
    PC++
    push(OS, { tag: 'CLOSURE', prms: instr.prms, addr: instr.addr, env: E })
  },
  CALL: (instr: any) => {
    const arity = instr.arity
    let args = []
    for (let i = arity - 1; i >= 0; i--) args[i] = OS.pop()
    const sf = OS.pop()
    if (sf.tag === 'BUILTIN') {
      PC++
      push(OS, apply_builtin(sf.sym, args))
      return
    }
    RTS.push({ tag: 'CALL_FRAME', addr: PC + 1, env: E })
    E = extend(sf.prms, args, sf.env)
    PC = sf.addr
  },
  TAIL_CALL: (instr: any) => {
    const arity = instr.arity
    let args = []
    for (let i = arity - 1; i >= 0; i--) args[i] = OS.pop()
    const sf = OS.pop()
    if (sf.tag === 'BUILTIN') {
      PC++
      push(OS, apply_builtin(sf.sym, args))
      return
    }
    // dont push on RTS here
    E = extend(sf.prms, args, sf.env)
    PC = sf.addr
  },
  RESET: (instr: any) => {
    // keep popping...
    const top_frame = RTS.pop()
    if (top_frame.tag === 'CALL_FRAME') {
      // ...until top frame is a call frame
      PC = top_frame.addr
      E = top_frame.env
    }
  }
}

function run() {
  OS = []
  PC = 0
  E = global_environment
  RTS = []
  //print_code(instrs)
  while (!(instrs[PC].tag === 'DONE')) {
    //display("next instruction: ")
    //print_code([instrs[PC]])
    //display(PC, "PC: ")
    //print_OS("\noperands:            ");
    //print_RTS("\nRTS:            ");
    const instr = instrs[PC]
    microcode[instr.tag](instr)
  }
  return peek(OS)
}

export async function goRunner(program: any): Promise<Result> {
  compile_program(program)
  const result: any = run()
  console.log(result)
  return Promise.resolve({ value: result } as Finished)
}

function lookup(sym: any, E: any): any {
  throw new Error('Function not implemented.')
}
function assign_value(sym: any, arg1: any, E: any) {
  throw new Error('Function not implemented.')
}

function push(OS: any[], arg1: { tag: string; prms: any; addr: any; env: any }) {
  throw new Error('Function not implemented.')
}
