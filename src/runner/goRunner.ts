import Heap, { address } from '../heap'
import { Scheduler, ThreadId } from '../scheduler'
import { Context, Finished, Result } from '../types'
import WaitGroup from '../waitgroup'

type Thread = [
  any[], // OS
  number, // PC
  number, // ENV
  any[] // RTS
]

const heap = new Heap(get_all_roots)
let scheduler = new Scheduler()
const threads: Map<ThreadId, Thread> = new Map()
const waitgroups: Map<address, WaitGroup> = new Map()
let curr_thread: ThreadId = -1

// blocked threads due to channel
// waiting to read
const channel_read_block_threads: Map<any, ThreadId[]> = new Map()
// waiting to write
const channel_write_block_threads: Map<any, ThreadId[]> = new Map()

function get_all_roots(): number[] {
  const all_roots = []
  for (const [tid, state] of threads.entries()) {
    if (tid === curr_thread) continue
    all_roots.push(...state[0], state[2], ...state[3])
  }
  all_roots.push(...OS, E, ...RTS)
  return all_roots
}

function unblock_read_thread(address: any) {
  const blocked_threads: ThreadId[] | undefined = channel_read_block_threads.get(address)

  if (blocked_threads !== undefined) {
    const next_thread: ThreadId | undefined = blocked_threads.shift()
    if (next_thread !== undefined) {
      scheduler.unblockThread(next_thread)
    }
  }
}

function unblock_write_thread(address: any) {
  const blocked_threads: ThreadId[] | undefined = channel_write_block_threads.get(address)

  if (blocked_threads !== undefined) {
    const next_thread: ThreadId | undefined = blocked_threads.shift()
    if (next_thread !== undefined) {
      scheduler.unblockThread(next_thread)
    }
  }
}

/*
function print_map(comment: string, ls: any) {
  console.log(comment)
  ls.forEach((v: any, k: any, map: any) => {
    console.log(`Key: ${k}, Value: ${v}`)
  })
}
*/

function block_read_thread(channel: any, id: ThreadId) {
  let blocked_threads: ThreadId[] | undefined = channel_read_block_threads.get(channel)

  if (!blocked_threads) {
    blocked_threads = []
  }
  blocked_threads.push(id)
  channel_read_block_threads.set(channel, blocked_threads)
}

function block_write_thread(channel: any, id: ThreadId) {
  let blocked_threads: ThreadId[] | undefined = channel_write_block_threads.get(channel)

  if (!blocked_threads) {
    blocked_threads = []
  }
  blocked_threads.push(id)
  channel_write_block_threads.set(channel, blocked_threads)
}

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

const error = (...x: any) => {
  throw new Error(x)
}

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
  try {
    while (value_index(env[--frame_index], x) === -1) {}
  } catch (e) {
    error(`name ${x} is not declared`)
    return
  }
  return [frame_index, value_index(env[frame_index], x)]
}

const value_index = (frame: any, x: any) => {
  for (let i = 0; i < frame.length; i++) {
    if (frame[i].name === x) return i
  }
  return -1
}

const is_name_constant = (env: any, x: any) => {
  let frame_index = env.length
  try {
    while (is_name_constant_helper(env[--frame_index], x) === -1) {}
  } catch (e) {
    error(`name ${x} is not declared`)
    return
  }
  return is_name_constant_helper(env[frame_index], x)
}

const is_name_constant_helper = (frame: any, x: any) => {
  for (let i = 0; i < frame.length; i++) {
    if (frame[i].name === x) {
      return frame[i].is_const
    }
  }

  return -1
}

// in this machine, the builtins take their
// arguments directly from the operand stack,
// to save the creation of an intermediate
// argument array
const builtin_object = {
  Println: () => {
    const address = OS.pop()
    console.log(heap.address_to_JS_value(address))
    return address
  },
  error: () => error(heap.address_to_JS_value(OS.pop())),
  is_number: () => (heap.is_Number(OS.pop()) ? heap.True : heap.False),
  is_boolean: () => (heap.is_Boolean(OS.pop()) ? heap.True : heap.False),
  is_undefined: () => (heap.is_Undefined(OS.pop()) ? heap.True : heap.False),
  is_string: () => (heap.is_String(OS.pop()) ? heap.True : heap.False), // ADDED CHANGE
  is_function: () => heap.is_Closure(OS.pop()),
  math_sqrt: () => heap.JS_value_to_address(Math.sqrt(heap.address_to_JS_value(OS.pop())))
}

const builtins = {}
const builtin_array: any[] = []
{
  let i = 0
  for (const key in builtin_object) {
    builtins[key] = { tag: 'BUILTIN', id: i, arity: arity(builtin_object[key]) }
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

const compile_time_environment_extend = (vs: any, e: any) => {
  //  make shallow copy of e
  return push([...e], vs)
}

// compile-time frames only need symbols (keys), no values
const builtins_symbols = Object.keys(builtins).map((x: any) => ({ name: x, is_const: 1 }))
const global_constant_symbols = Object.keys(constants).map((x: any) => ({ name: x, is_const: 1 }))
const global_compile_environment = [builtins_symbols, global_constant_symbols]

/* ********
 * compiler
 * ********/

// scanning out the declarations from (possibly nested)
// sequences of statements, ignoring blocks
function scan(comp: any) {
  if (comp.type === 'seq') {
    return comp.stmts.reduce((acc: any, x: any) => acc.concat(scan(x)), [])
  } else if (
    ['ConstDeclaration', 'VariableDeclaration', 'WaitGroupDeclaration'].includes(comp.type)
  ) {
    const is_const = comp.type === 'VariableDeclaration' ? 0 : 1
    return comp.ids.map((x: any) => ({ name: x.name, is_const }))
  } else if (comp.type === 'FunctionDeclaration') {
    return [{ name: comp.id.name, is_const: 1 }]
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
    const update_addr = wc
    compile(comp.update, ce)
    instrs[wc++] = { tag: 'POP' }
    instrs[wc++] = { tag: 'GOTO', addr: loop_start }
    instrs[wc++] = { tag: 'WHILE', cont_addr: update_addr }
    jump_on_false_instruction.addr = wc
    instrs[wc++] = { tag: 'LDC', val: undefined }
  },
  BreakStatement: (comp: any, ce: any) => {
    instrs[wc++] = { tag: 'BREAK' }
  },
  ContinueStatement: (comp: any, ce: any) => {
    instrs[wc++] = { tag: 'CONTINUE' }
  },
  CallExpression: (comp: any, ce: any) => {
    if (comp.callee.type !== 'MemberExpression') {
      compile(
        {
          type: 'Identifier',
          name: comp.callee.name
        },
        ce
      )
    }

    for (let arg of comp.arguments) {
      compile(arg, ce)
    }

    if (comp.callee.type === 'MemberExpression') {
      return compile(comp.callee, ce)
    }
    instrs[wc++] = { tag: 'CALL', arity: comp.arguments.length }
  },
  MemberExpression: (comp: any, ce: any) => {
    if (['Add', 'Wait', 'Done'].includes(comp.property.name)) {
      instrs[wc++] = {
        tag: `WG_${comp.property.name.toUpperCase()}`,
        pos: compile_time_environment_position(ce, comp.object.name)
      }
    }
  },
  GoRoutine: (comp: any, ce: any) => {
    comp.type = 'CallExpression'
    compile(comp, ce)

    // Swap the CALL instruction with GO_START s.t. instr order is
    // eval of arguments -> GO_START -> CALL -> GO_END
    const call_ix = instrs[wc - 1]
    instrs[wc - 1] = { tag: 'GO_START', arity: comp.arguments.length }
    instrs[wc++] = call_ix
    instrs[wc++] = { tag: 'GO_END' }
  },
  AssignmentExpression:
    // store precomputed position info in ASSIGN instruction
    (comp: any, ce: any) => {
      compile(comp.right, ce)

      const is_const = is_name_constant(ce, comp.left.name) === 1
      if (is_const) {
        error('unable to reassign value to constant/waitgroup')
        return
      }

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
    const parameters = comp.prms.map((x: any) => ({ name: x, is_const: 0 }))
    compile(comp.body, compile_time_environment_extend(parameters, ce))
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
  WaitGroupDeclaration: (comp: any, ce: any) => {
    for (let { name } of comp.ids) {
      instrs[wc++] = {
        tag: 'NEW_WG',
        pos: compile_time_environment_position(ce, name)
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
        inits: [{ type: 'lam', prms: comp.params.map((x: any) => x.ids[0].name), body: comp.body }]
      },
      ce
    )
  },
  ChannelExpression: (comp: any, ce: any) => {
    const channel_size = comp.len
    compile(channel_size, ce)

    const buffered_type = comp.chantype
    const is_unbuffered = buffered_type === 'unbuffered' ? 1 : 0

    instrs[wc++] = {
      tag: 'NEW_CHAN',
      is_unbuffered
    }
  },
  ChannelSendStatement: (comp: any, ce: any) => {
    // compile the item being sent
    compile(comp.right, ce)

    instrs[wc++] = {
      tag: 'CHAN_WRITE',
      pos: compile_time_environment_position(ce, comp.left.name)
    }
  },
  ChannelReceiveExpression: (comp: any, ce: any) => {
    instrs[wc++] = {
      tag: 'CHAN_READ',
      pos: compile_time_environment_position(ce, comp.right.name)
    }
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
    throw e
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
function allocate_builtin_frame() {
  const builtin_values = Object.values(builtins)
  const frame_address = heap.heap_allocate_Frame(builtin_values.length)
  for (let i = 0; i < builtin_values.length; i++) {
    const builtin: any = builtin_values[i]
    heap.heap_set_child(frame_address, i, heap.heap_allocate_Builtin(builtin.id))
  }
  return frame_address
}

function allocate_constant_frame() {
  const constant_values = Object.values(constants)
  const frame_address = heap.heap_allocate_Frame(constant_values.length)
  for (let i = 0; i < constant_values.length; i++) {
    const constant_value = constant_values[i]
    if (typeof constant_value === 'undefined') {
      heap.heap_set_child(frame_address, i, heap.Undefined)
    } else {
      heap.heap_set_child(frame_address, i, heap.heap_allocate_Number(constant_value))
    }
  }
  return frame_address
}

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
let BLOCKING: boolean // current thread is blocking

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
    // call requires OS to have [fun, arg1, arg2 ... argn] in bottom -> top order
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
    const tid = new_thread()
    const [other_OS] = threads.get(tid)!
    other_OS.push(...OS.slice(-instr.arity - 1))
    OS = OS.slice(0, -instr.arity - 1)

    // Copy [fn, arg1, ..., argn ] from curr thread OS to the goroutine's OS
    PC += 2 // Skip the CALL and GO_END instrs
    push(OS, undefined) // result of executing a go f() statement
  },
  GO_END: (instr: any) => {
    delete_thread()
  },
  NEW_CHAN: (instr: any) => {
    const len_addr = OS.pop()
    const allocated_len = heap.address_to_JS_value(len_addr)

    if (allocated_len > 6) {
      error('sorry, the maximum size of a channel allowed currently is 6')
      return
    }

    const frame_address = heap.heap_allocate_Channel(allocated_len, instr.is_unbuffered)
    push(OS, frame_address)
  },
  CHAN_WRITE: (instr: any) => {
    const channel = heap.heap_get_Environment_value(E, instr.pos)
    const item = peek(OS, 0)

    // check if channel is full
    const is_full = heap.heap_is_Channel_full(channel)

    // block thread if full
    if (is_full) {
      PC--
      block_write_thread(channel, curr_thread)
      BLOCKING = true
      return
    }

    // else write item in channel
    heap.heap_Channel_write(channel, item)

    // unblock any random thread waiting to read from channel
    unblock_read_thread(channel)

    // if is unbuffered channel, block thread
    const is_unbuffered_channel = heap.is_Unbuffered_Channel(channel)
    if (is_unbuffered_channel) {
      block_write_thread(channel, curr_thread)
      BLOCKING = true
      return
    }
  },
  CHAN_READ: (instr: any) => {
    const channel = heap.heap_get_Environment_value(E, instr.pos)

    // check if channel is empty
    const is_empty = heap.heap_is_Channel_empty(channel)

    // block thread if empty
    if (is_empty) {
      PC--
      block_read_thread(channel, curr_thread)
      BLOCKING = true
      return
    }

    // else read item from channel
    const item = heap.heap_Channel_read(channel)

    // push to OS
    push(OS, item)

    // unblock any random thread waiting to write to channel
    unblock_write_thread(channel)
  },
  NEW_WG: (instr: any) => {
    const addr = heap.heap_allocate_Number(0)
    waitgroups.set(addr, new WaitGroup(addr))
    heap.heap_set_Environment_value(E, instr.pos, addr)
  },
  WG_ADD: (instr: any) => {
    let delta = OS.pop()
    delta = heap.address_to_JS_value(delta)
    const addr = heap.heap_get_Environment_value(E, instr.pos)
    const wg = waitgroups.get(addr)
    if (wg) {
      for (let thread of wg.Add(delta, heap)) {
        scheduler.unblockThread(thread)
      }
    }
  },
  WG_WAIT: (instr: any) => {
    const addr = heap.heap_get_Environment_value(E, instr.pos)
    BLOCKING = !waitgroups.get(addr)?.Try_Wait(curr_thread, heap)
  },
  WG_DONE: (instr: any) => {
    const addr = heap.heap_get_Environment_value(E, instr.pos)
    const wg = waitgroups.get(addr)
    if (wg) {
      for (let thread of wg.Add(-1, heap)) {
        scheduler.unblockThread(thread)
      }
    }
  },
  BREAK: (instr: any) => {
    // continue popping till while instruction
    while (PC < instrs.length && instrs[PC].tag !== 'WHILE') {
      const next_instr = instrs[PC]
      if (next_instr.tag === 'RESET') {
        error('Break statement outside of while loop')
      }

      if (next_instr.tag === 'EXIT_SCOPE' || next_instr.tag === 'ENTER_SCOPE') {
        microcode[next_instr.tag](next_instr)
      }
      PC++
    }
    if (PC >= instrs.length) {
      error('Break statement outside of while loop')
    }
  },
  CONTINUE: (instr: any) => {
    while (PC < instrs.length && instrs[PC].tag !== 'WHILE') {
      const next_instr = instrs[PC]
      if (next_instr.tag === 'EXIT_SCOPE' || next_instr.tag === 'ENTER_SCOPE') {
        microcode[next_instr.tag](next_instr)
      }

      PC++
    }
    if (PC >= instrs.length) {
      error('Continue statement outside of while loop')
    }
    PC = instrs[PC].cont_addr
  },
  WHILE: (instr: any) => {}
}

function new_thread(): ThreadId {
  const newId = scheduler.newThread()
  threads.set(newId, [[], PC, E, []])
  return newId
}

function delete_thread() {
  // Clear state from threads map
  threads.delete(curr_thread)

  // Delete thread from scheduler
  scheduler.deleteCurrentThread(curr_thread)
  curr_thread = -1
}

function next_thread() {
  detect_deadlock()
  ;[curr_thread, TO] = scheduler.selectNextThread()!
  // Load thread state
  ;[OS, PC, E, RTS] = threads.get(curr_thread)!
  BLOCKING = false
}

function pause_thread() {
  // Save state to threads map
  threads.set(curr_thread, [OS, PC, E, RTS])

  // Pause thread in scheduler
  scheduler.pauseThread(curr_thread)
}

function block_thread() {
  // Save state to threads map
  threads.set(curr_thread, [OS, PC, E, RTS])

  // Block thread in scheduler
  scheduler.blockThread(curr_thread)
}

function detect_deadlock() {
  if (!scheduler.hasIdleThreads() && scheduler.hasBlockedThreads()) {
    error('fatal error: all goroutines are asleep - deadlock!')
  }
}

// Initialize the scheduler (do this before running code)
function init_scheduler() {
  scheduler = new Scheduler()
  threads.clear()
}

function run() {
  init_scheduler()
  OS = []
  PC = 0
  const builtins_frame = allocate_builtin_frame()
  const constants_frame = allocate_constant_frame()
  E = heap.heap_allocate_Environment(0)
  E = heap.heap_Environment_extend(builtins_frame, E)
  E = heap.heap_Environment_extend(constants_frame, E)
  heap.set_heap_bottom() // bottom of heap is the addr that separates the builtin/constants from the other objects

  new_thread()
  next_thread()
  heap.reset_string_pool() // ADDED CHANGE
  // print_code()
  while (!(instrs[PC].tag === 'DONE')) {
    if (curr_thread === -1) {
      // current goroutine finished execution
      if (!scheduler.hasIdleThreads()) break
      next_thread()
    }
    if (BLOCKING) {
      block_thread()
      next_thread()
    } else if (TO <= 0 && scheduler.hasIdleThreads()) {
      pause_thread()
      next_thread()
    }

    // console.log(curr_thread)
    // console.log(instrs[PC])
    const instr = instrs[PC++]
    microcode[instr.tag](instr)
    TO--
  }

  return heap.address_to_JS_value(peek(OS, 0))
}

export async function goRunner(program: any, context: Context): Promise<Result> {
  if (program === null) {
    error('there is a parsing error with the program input')
  }

  compile_program(wrap_in_block(program))
  const result: any = run()
  console.log('result: ', result)

  return Promise.resolve({ value: result, status: 'finished', context: context } as Finished)
}
