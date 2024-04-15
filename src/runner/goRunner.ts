import Heap from '../heap'
import { Scheduler, ThreadId } from '../scheduler'
import { Finished, Result } from '../types'

type Thread = [
  any[], // OS
  number, // PC
  number, // ENV
  any[], // RTS
]

const heap = new Heap()
let scheduler = new Scheduler()
const threads: Map<ThreadId, Thread> = new Map()
let curr_thread: ThreadId = -1

// helper functions
const peek = (array: any[], address: any) => array.slice(-1 - address)[0]

const push = (array: any[], ...items: any) => {
  for (let item of items) {
    array.push(item)
  }
  return array
}

function arity<T extends Function>(x: T): number {
  return x.length
}

const error = (...x: any) => new Error(x)

const get_time = () => Date.now()

const wrap_in_block = (program: any) => ({
  type: 'BlockStatement',
  body: [program]
})

/* ************************
 * compile-time environment
 * ************************/

// a compile-time environment is an array of
// compile-time frames, and a compile-time frame
// is an array of symbols

// find the position [frame-index, value-index]
// of a given symbol x
const compile_time_environment_position = (env: any, x: any) => {
  let frame_index = env.length
  while (value_index(env[--frame_index], x) === -1) {}
  return [frame_index, value_index(env[frame_index], x)]
}

const value_index = (frame: any, x: any) => {
  for (let i = 0; i < frame.length; i++) {
    if (frame[i] === x) return i
  }
  return -1
}

// in this machine, the builtins take their
// arguments directly from the operand stack,
// to save the creation of an intermediate
// argument array
const builtin_object = {
  display: () => {
    const address = OS.pop()
    console.log(heap.address_to_JS_value(address))
    return address
  },
  get_time: () => heap.JS_value_to_address(get_time()),
  error: () => error(heap.address_to_JS_value(OS.pop())),
  is_number: () => (heap.is_Number(OS.pop()) ? heap.True : heap.False),
  is_boolean: () => (heap.is_Boolean(OS.pop()) ? heap.True : heap.False),
  is_undefined: () => (heap.is_Undefined(OS.pop()) ? heap.True : heap.False),
  is_string: () => (heap.is_String(OS.pop()) ? heap.True : heap.False), // ADDED CHANGE
  is_function: () => heap.is_Closure(OS.pop()),
  math_sqrt: () => heap.JS_value_to_address(Math.sqrt(heap.address_to_JS_value(OS.pop()))),
  head: () => heap.heap_get_child(OS.pop(), 0),
  tail: () => heap.heap_get_child(OS.pop(), 1),
  is_null: () => (heap.is_Null(OS.pop()) ? heap.True : heap.False),
  set_head: () => {
    const val = OS.pop()
    const p = OS.pop()
    heap.heap_set_child(p, 0, val)
  },
  set_tail: () => {
    const val = OS.pop()
    const p = OS.pop()
    heap.heap_set_child(p, 1, val)
  }
}

const primitive_object = {}
const builtin_array: any[] = []
{
  let i = 0
  for (const key in builtin_object) {
    primitive_object[key] = {
      tag: 'BUILTIN',
      id: i,
      arity: arity(builtin_object[key])
    }
    builtin_array[i++] = builtin_object[key]
  }
}

const constants = {
  undefined: heap.Undefined,
  math_E: Math.E,
  math_LN10: Math.LN10,
  math_LN2: Math.LN2,
  math_LOG10E: Math.LOG10E,
  math_LOG2E: Math.LOG2E,
  math_PI: Math.PI,
  math_SQRT1_2: Math.SQRT1_2,
  math_SQRT2: Math.SQRT2
}

for (const key in constants) primitive_object[key] = constants[key]

const compile_time_environment_extend = (vs: any, e: any) => {
  //  make shallow copy of e
  return push([...e], vs)
}

// compile-time frames only need synbols (keys), no values
const global_compile_frame = Object.keys(primitive_object)
const global_compile_environment = [global_compile_frame]

/* ********
 * compiler
 * ********/

// scanning out the declarations from (possibly nested)
// sequences of statements, ignoring blocks
function scan(comp: any) {
  if (comp.type === 'seq') {
    return comp.stmts.reduce((acc: any, x: any) => acc.concat(scan(x)), [])
  } else if (['ConstDeclaration', 'VariableDeclaration'].includes(comp.type)) {
    return comp.ids.map((x: any) => x.name)
  } else if (comp.type === 'FunctionDeclaration') {
    return [comp.id.name]
  }
  return []
}

const compile_sequence = (seq: any, ce: any) => {
  if (seq.length === 0) {
    instrs[wc++] = { tag: 'LDC', val: undefined }
    return
  }
  let first = true
  for (let comp of seq) {
    first ? (first = false) : (instrs[wc++] = { tag: 'POP' })
    compile(comp, ce)
  }
}

// wc: write counter
let wc: number
// instrs: instruction array
let instrs: any[]

const compile_comp = {
  Literal: (comp: any, ce: any) => {
    instrs[wc++] = { tag: 'LDC', val: comp.value }
  },
  Identifier:
    // store precomputed position information in LD instruction
    (comp: any, ce: any) => {
      instrs[wc++] = {
        tag: 'LD',
        sym: comp.name,
        pos: compile_time_environment_position(ce, comp.name)
      }
    },
  unop: (comp: any, ce: any) => {
    compile(comp.frst, ce)
    instrs[wc++] = { tag: 'UNOP', sym: comp.sym }
  },
  ExpressionStatement: (comp: any, ce: any): void => {
    compile(comp.expression, ce)
  },
  BinaryExpression: (comp: any, ce: any) => {
    compile(comp.left, ce)
    compile(comp.right, ce)
    instrs[wc++] = { tag: 'BINOP', sym: comp.operator }
  },
  LogicalExpression: (comp: any, ce: any) => {
    compile(
      comp.operator == '||'
        ? {
            type: 'IfStatement',
            test: comp.left,
            consequent: { type: 'Literal', value: true },
            alternate: comp.right
          }
        : {
            type: 'IfStatement',
            test: comp.left,
            consequent: comp.right,
            alternate: { type: 'Literal', value: false }
          },
      ce
    )
  },
  IfStatement: (comp: any, ce: any) => {
    compile(comp.test, ce)
    const jump_on_false_instruction: any = { tag: 'JOF' }
    instrs[wc++] = jump_on_false_instruction
    compile(comp.consequent, ce)
    const goto_instruction: any = { tag: 'GOTO' }
    instrs[wc++] = goto_instruction
    const alternative_address = wc
    jump_on_false_instruction.addr = alternative_address
    compile(comp.alternate, ce)
    goto_instruction.addr = wc
  },
  ForStatement: (comp: any, ce: any) => {
    const loop_start = wc
    compile(comp.test, ce)
    const jump_on_false_instruction: any = { tag: 'JOF' }
    instrs[wc++] = jump_on_false_instruction
    compile(comp.body, ce)
    compile(comp.update, ce)
    instrs[wc++] = { tag: 'POP' }
    instrs[wc++] = { tag: 'GOTO', addr: loop_start }
    jump_on_false_instruction.addr = wc
    instrs[wc++] = { tag: 'LDC', val: undefined }
  },
  CallExpression: (comp: any, ce: any) => {
    compile(
      {
        type: 'Identifier',
        name: comp.callee.name
      },
      ce
    )
    for (let arg of comp.arguments) {
      compile(arg, ce)
    }
    instrs[wc++] = { tag: 'CALL', arity: comp.arguments.length }
  },
  GoExpression: (comp: any, ce: any) => {
    compile(
      {
        type: 'Identifier',
        name: comp.callee.name
      },
      ce
    )
    for (let arg of comp.arguments) {
      compile(arg, ce)
    }
    const start_wc = wc
    instrs[wc++] = { tag: 'GO_START', end_pc: -1 }
    instrs[wc++] = { tag: 'CALL', arity: comp.arguments.length }
    instrs[wc++] = { tag: 'GO_END' }
    instrs[start_wc].end_pc = wc;
  },
  AssignmentExpression:
    // store precomputed position info in ASSIGN instruction
    (comp: any, ce: any) => {
      compile(comp.right, ce)
      instrs[wc++] = {
        tag: 'ASSIGN',
        pos: compile_time_environment_position(ce, comp.left.name)
      }
    },
  lam: (comp: any, ce: any) => {
    instrs[wc++] = { tag: 'LDF', arity: comp.arity, addr: wc + 1 }
    // jump over the body of the lambda expression
    const goto_instruction: any = { tag: 'GOTO' }
    instrs[wc++] = goto_instruction
    // extend compile-time environment
    compile(comp.body, compile_time_environment_extend(comp.prms, ce))
    instrs[wc++] = { tag: 'LDC', val: undefined }
    instrs[wc++] = { tag: 'RESET' }
    goto_instruction.addr = wc
  },
  seq: (comp: any, ce: any) => compile_sequence(comp.stmts, ce),
  BlockStatement: (comp: any, ce: any) => {
    const seq_comp_body = {
      type: 'seq',
      stmts: comp.body
    }
    const locals = scan(seq_comp_body)
    instrs[wc++] = { tag: 'ENTER_SCOPE', num: locals.length }
    compile(
      seq_comp_body,
      // extend compile-time environment
      compile_time_environment_extend(locals, ce)
    )
    instrs[wc++] = { tag: 'EXIT_SCOPE' }
  },
  VariableDeclaration: (comp: any, ce: any) => {
    if (!comp.inits) return

    for (let i = 0; i < comp.inits.length; i++) {
      compile(comp.inits[i], ce)
      instrs[wc++] = {
        tag: 'ASSIGN',
        pos: compile_time_environment_position(ce, comp.ids[i].name)
      }
    }
  },
  ConstDeclaration: (comp: any, ce: any) => {
    for (let i = 0; i < comp.inits.length; i++) {
      compile(comp.inits[i], ce)
      instrs[wc++] = {
        tag: 'ASSIGN',
        pos: compile_time_environment_position(ce, comp.ids[i].name)
      }
    }
  },
  ReturnStatement: (comp: any, ce: any) => {
    compile(comp.argument, ce)
    if (comp.argument.tag === 'CallExpression') {
      // tail call: turn CALL into TAILCALL
      instrs[wc - 1].tag = 'TAIL_CALL'
    } else {
      instrs[wc++] = { tag: 'RESET' }
    }
  },
  FunctionDeclaration: (comp: any, ce: any) => {
    compile(
      {
        type: 'ConstDeclaration',
        ids: [{ type: 'Identifier', name: comp.id.name }],
        inits: [{ type: 'lam', prms: comp.params, body: comp.body }]
      },
      ce
    )
  },
  EmptyStatement: (comp: any, ce: any) => {}
}

// compile component into instruction array instrs,
// starting at wc (write counter)
const compile = (comp: any, ce: any) => {
  try {
    compile_comp[comp.type](comp, ce)
  } catch (e) {
    console.log(e)
  }
}

// compile program into instruction array instrs,
// after initializing wc and instrs
const compile_program = (program: any) => {
  wc = 0
  instrs = []
  compile(program, global_compile_environment)
  instrs[wc] = { tag: 'DONE' }
}

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
const apply_binop = (op: any, v2: any, v1: any) =>
  heap.JS_value_to_address(
    binop_microcode[op](heap.address_to_JS_value(v1), heap.address_to_JS_value(v2))
  )

const unop_microcode = {
  '-': (x: number) => -x,
  '!': (x: any) => !x
}

const apply_unop = (op: any, v: any) =>
  heap.JS_value_to_address(unop_microcode[op](heap.address_to_JS_value(v)))

const apply_builtin = (builtin_id: any) => {
  const result = builtin_array[builtin_id]()
  OS.pop() // pop fun
  push(OS, result)
}

// creating global runtime environment
const primitive_values = Object.values(primitive_object)
const frame_address = heap.heap_allocate_Frame(primitive_values.length)
for (let i = 0; i < primitive_values.length; i++) {
  const primitive_value: any = primitive_values[i]
  if (typeof primitive_value === 'object' && primitive_value.hasOwnProperty('id')) {
    heap.heap_set_child(frame_address, i, heap.heap_allocate_Builtin(primitive_value.id))
  } else if (typeof primitive_value === 'undefined') {
    heap.heap_set_child(frame_address, i, heap.Undefined)
  } else {
    heap.heap_set_child(frame_address, i, heap.heap_allocate_Number(primitive_value))
  }
}

const global_environment: number = heap.heap_Environment_extend(frame_address, heap.heap_empty_Environment)

/* *******
 * machine
 * *******/

// machine registers
let OS: any[] // JS array (stack) of words (Addresses,
//        word-encoded literals, numbers)
let PC: number // JS number
let E: number // heap Address
let RTS: any // JS array (stack) of Addresses
let TO: number // timeout counter

const microcode = {
  LDC: (instr: any) => push(OS, heap.JS_value_to_address(instr.val)),
  UNOP: (instr: any) => push(OS, apply_unop(instr.sym, OS.pop())),
  BINOP: (instr: any) => push(OS, apply_binop(instr.sym, OS.pop(), OS.pop())),
  POP: (instr: any) => OS.pop(),
  JOF: (instr: any) => (PC = heap.is_True(OS.pop()) ? PC : instr.addr),
  GOTO: (instr: any) => (PC = instr.addr),
  ENTER_SCOPE: (instr: any) => {
    push(RTS, heap.heap_allocate_Blockframe(E))
    const frame_address = heap.heap_allocate_Frame(instr.num)
    E = heap.heap_Environment_extend(frame_address, E)
    for (let i = 0; i < instr.num; i++) {
      heap.heap_set_child(frame_address, i, heap.Unassigned)
    }
  },
  EXIT_SCOPE: (instr: any) => (E = heap.heap_get_Blockframe_environment(RTS.pop())),
  LD: (instr: any) => {
    const val = heap.heap_get_Environment_value(E, instr.pos)
    if (heap.is_Unassigned(val)) error('access of unassigned variable')
    push(OS, val)
  },
  ASSIGN: (instr: any) => heap.heap_set_Environment_value(E, instr.pos, peek(OS, 0)),
  LDF: (instr: any) => {
    const closure_address = heap.heap_allocate_Closure(instr.arity, instr.addr, E)
    push(OS, closure_address)
  },
  CALL: (instr: any) => {
    const arity = instr.arity
    const fun = peek(OS, arity)
    if (heap.is_Builtin(fun)) {
      return apply_builtin(heap.heap_get_Builtin_id(fun))
    }
    const frame_address = heap.heap_allocate_Frame(arity)
    for (let i = arity - 1; i >= 0; i--) {
      heap.heap_set_child(frame_address, i, OS.pop())
    }
    OS.pop() // pop fun
    push(RTS, heap.heap_allocate_Callframe(E, PC))
    E = heap.heap_Environment_extend(frame_address, heap.heap_get_Closure_environment(fun))
    PC = heap.heap_get_Closure_pc(fun)
  },
  TAIL_CALL: (instr: any) => {
    const arity = instr.arity
    const fun = peek(OS, arity)
    if (heap.is_Builtin(fun)) {
      return apply_builtin(heap.heap_get_Builtin_id(fun))
    }
    const frame_address = heap.heap_allocate_Frame(arity)
    for (let i = arity - 1; i >= 0; i--) {
      heap.heap_set_child(frame_address, i, OS.pop())
    }
    OS.pop() // pop fun
    // don't push on RTS here
    E = heap.heap_Environment_extend(frame_address, heap.heap_get_Closure_environment(fun))
    PC = heap.heap_get_Closure_pc(fun)
  },
  RESET: (instr: any) => {
    PC--
    // keep popping...
    const top_frame = RTS.pop()
    if (heap.is_Callframe(top_frame)) {
      // ...until top frame is a call frame
      PC = heap.heap_get_Callframe_pc(top_frame)
      E = heap.heap_get_Callframe_environment(top_frame)
    }
  },
  GO_START: (instr: any) => {
    PC++;
    new_thread();
    PC = instr.end_pc
  },
  GO_END: (instr: any) => {
    delete_thread()
  }
}

function new_thread() {
  const newId = scheduler.newThread()
  threads.set(newId, [[], PC, global_environment, []])
}

function delete_thread() {
  // Clear state from threads map
  threads.delete(curr_thread)

  // Delete thread from scheduler
  scheduler.deleteCurrentThread(curr_thread)
  curr_thread = -1
}

function next_thread() {
  ;[curr_thread, TO] = scheduler.selectNextThread()!

  // Load thread state
  ;[OS, PC, E, RTS] = threads.get(curr_thread)!
}

function pause_thread() {
  // Save state to threads map
  threads.set(curr_thread, [OS, PC, E, RTS])

  // Pause thread in scheduler
  scheduler.pauseThread(curr_thread)
}

// function block_thread() {
//   // Save state to threads map
//   threads.set(curr_thread, [OS, PC, E, RTS])

//   // Block thread in scheduler
//   scheduler.blockThread(curr_thread)
// }

// Initialize the scheduler (do this before running code)
function init_scheduler() {
  scheduler = new Scheduler()
  threads.clear()
}

function run() {
  init_scheduler()
  PC = 0;
  new_thread()
  next_thread()
  heap.reset_string_pool() // ADDED CHANGE
  // print_code()
  while (!(instrs[PC].tag === 'DONE')) {
    if (curr_thread === -1) {
      // current goroutine finished execution
      if (!scheduler.hasIdleThreads()) break;
      next_thread();
    }
    if (TO <= 0 && scheduler.hasIdleThreads()) {
      pause_thread()
      next_thread()
    }
    const instr = instrs[PC++]
    microcode[instr.tag](instr)
    TO--;
  }

  return heap.address_to_JS_value(peek(OS, 0))
}

export async function goRunner(program: any): Promise<Result> {
  compile_program(wrap_in_block(program))
  const result: any = run()
  console.log('result: ', result)

  return Promise.resolve({ value: result } as Finished)
}
