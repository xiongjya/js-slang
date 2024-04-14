import { Finished, Result } from '../types'

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

const get_size = (x: any) => 0

const get_time = () => Date.now()

const is_boolean = (x: any) => typeof x === 'boolean'

const is_number = (x: any) => typeof x === 'number'

const is_null = (x: any) => x === null

const is_string = (x: any) => typeof x === 'string'

const is_undefined = (x: any) => x === undefined

/* *************************
 * HEAP
 * *************************/

// HEAP is an array of bytes (JS ArrayBuffer)

const word_size = 8
const mega = 2 ** 20

const heap_make = (bytes: any) => {
  const data = new ArrayBuffer(bytes)
  const view = new DataView(data)
  return view
}

// we randomly pick a heap size of 1000000 bytes
const HEAP = heap_make(1000000)

// free is the next free index in HEAP
// we keep allocating as if there was no tomorrow
let free = 0

// heap_allocate allocates a given number of words
// on the heap and marks the first word with a 1-byte tag.
// the last two bytes of the first word indicate the number
// of children (addresses) that follow the tag word:
// [1 byte tag, 4 bytes payload (depending on node type),
//  2 bytes #children, 1 byte unused]
// Note: payload depends on the type of node
const size_offset = 5
const heap_allocate = (tag: any, size: any) => {
  const address = free
  free += size
  HEAP.setUint8(address * word_size, tag)
  HEAP.setUint16(address * word_size + size_offset, size)
  return address
}

// get and set a word in heap at given address
const heap_get = (address: any) => HEAP.getFloat64(address * word_size)

const heap_set = (address: any, x: any) => HEAP.setFloat64(address * word_size, x)

// child index starts at 0
const heap_get_child = (address: any, child_index: any) => heap_get(address + 1 + child_index)

const heap_set_child = (address: any, child_index: any, value: any) =>
  heap_set(address + 1 + child_index, value)

const heap_get_tag = (address: any) => HEAP.getUint8(address * word_size)

const heap_get_size = (address: any) => HEAP.getUint16(address * word_size + size_offset)

// the number of children is one less than the size
// except for number nodes:
//                 they have size 2 but no children
const heap_get_number_of_children = (address: any) =>
  heap_get_tag(address) === Number_tag ? 0 : get_size(address) - 1

// access byte in heap, using address and offset
const heap_set_byte_at_offset = (address: any, offset: any, value: any) =>
  HEAP.setUint8(address * word_size + offset, value)

const heap_get_byte_at_offset = (address: any, offset: any) =>
  HEAP.getUint8(address * word_size + offset)

// access byte in heap, using address and offset
const heap_set_2_bytes_at_offset = (address: any, offset: any, value: any) =>
  HEAP.setUint16(address * word_size + offset, value)

const heap_get_2_bytes_at_offset = (address: any, offset: any) =>
  HEAP.getUint16(address * word_size + offset)

// ADDED CHANGE
const heap_set_4_bytes_at_offset = (address: any, offset: any, value: any) =>
  HEAP.setUint32(address * word_size + offset, value)

// ADDED CHANGE
const heap_get_4_bytes_at_offset = (address: any, offset: any) =>
  HEAP.getUint32(address * word_size + offset)

// for debugging: return a string that shows the bits
// of a given word
const word_to_string = (word: any) => {
  const buf = new ArrayBuffer(8)
  const view = new DataView(buf)
  view.setFloat64(0, word)
  let binStr = ''
  for (let i = 0; i < 8; i++) {
    binStr += ('00000000' + view.getUint8(i).toString(2)).slice(-8) + ' '
  }
  return binStr
}

// values

// All values are allocated on the heap as nodes. The first
// word of the node is a header, and the first byte of the
// header is a tag that identifies the type of node

const False_tag = 0
const True_tag = 1
const Number_tag = 2
const Null_tag = 3
const Unassigned_tag = 4
const Undefined_tag = 5
const Blockframe_tag = 6
const Callframe_tag = 7
const Closure_tag = 8
const Frame_tag = 9
const Environment_tag = 10
const Pair_tag = 11
const Builtin_tag = 12
const String_tag = 13 // ADDED CHANGE

// Record<string, tuple(number, string)> where the key is the hash of the string
// and the value is a tuple of the address of the string and the string itself
let stringPool = {} // ADDED CHANGE

// all values (including literals) are allocated on the heap.

// We allocate canonical values for
// true, false, undefined, null, and unassigned
// and make sure no such values are created at runtime

// boolean values carry their value (0 for false, 1 for true)
// in the byte following the tag
const False = heap_allocate(False_tag, 1)
const is_False = (address: any) => heap_get_tag(address) === False_tag
const True = heap_allocate(True_tag, 1)
const is_True = (address: any) => heap_get_tag(address) === True_tag

const is_Boolean = (address: any) => is_True(address) || is_False(address)

const Null = heap_allocate(Null_tag, 1)
const is_Null = (address: any) => heap_get_tag(address) === Null_tag

const Unassigned = heap_allocate(Unassigned_tag, 1)
const is_Unassigned = (address: any) => heap_get_tag(address) === Unassigned_tag

const Undefined = heap_allocate(Undefined_tag, 1)
const is_Undefined = (address: any) => heap_get_tag(address) === Undefined_tag

// ADDED CHANGE
// strings:
// [1 byte tag, 4 byte hash to stringPool,
// 2 bytes #children, 1 byte unused]
// Note: #children is 0

// Hash any string to a 32-bit unsigned integer
const hashString = (str: any) => {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) + hash + char
    hash = hash & hash
  }
  return hash >>> 0
}

// const result = hashString("hello");
// console.log(result, "hash of hello:");
// const result2 = hashString("hello world");
// console.log(result2, "hash of hello world:");

const String = heap_allocate(String_tag, 1)
const is_String = (address: any) => heap_get_tag(address) === String_tag

const heap_allocate_String = (str: any) => {
  const hash = hashString(str)
  const address_or_undefined = stringPool[hash]

  if (address_or_undefined !== undefined) {
    return address_or_undefined[0]
  }

  const address = heap_allocate(String_tag, 1)
  heap_set_4_bytes_at_offset(address, 1, hash)

  // Store the string in the string pool
  stringPool[hash] = [address, str]

  return address
}

const heap_get_string_hash = (address: any) => heap_get_4_bytes_at_offset(address, 1)

const heap_get_string = (address: any) => stringPool[heap_get_string_hash(address)][1]

// builtins: builtin id is encoded in second byte
// [1 byte tag, 1 byte id, 3 bytes unused,
//  2 bytes #children, 1 byte unused]
// Note: #children is 0

const is_Builtin = (address: any) => heap_get_tag(address) === Builtin_tag

const heap_allocate_Builtin = (id: any) => {
  const address = heap_allocate(Builtin_tag, 1)
  heap_set_byte_at_offset(address, 1, id)
  return address
}

const heap_get_Builtin_id = (address: any) => heap_get_byte_at_offset(address, 1)

// closure
// [1 byte tag, 1 byte arity, 2 bytes pc, 1 byte unused,
//  2 bytes #children, 1 byte unused]
// followed by the address of env
// note: currently bytes at offset 4 and 7 are not used;
//   they could be used to increase pc and #children range

const heap_allocate_Closure = (arity: any, pc: any, env: any) => {
  const address = heap_allocate(Closure_tag, 2)
  heap_set_byte_at_offset(address, 1, arity)
  heap_set_2_bytes_at_offset(address, 2, pc)
  heap_set(address + 1, env)
  return address
}

const heap_get_Closure_arity = (address: any) => heap_get_byte_at_offset(address, 1)

const heap_get_Closure_pc = (address: any) => heap_get_2_bytes_at_offset(address, 2)

const heap_get_Closure_environment = (address: any) => heap_get_child(address, 0)

const is_Closure = (address: any) => heap_get_tag(address) === Closure_tag

// block frame
// [1 byte tag, 4 bytes unused,
//  2 bytes #children, 1 byte unused]

const heap_allocate_Blockframe = (env: any) => {
  const address = heap_allocate(Blockframe_tag, 2)
  heap_set(address + 1, env)
  return address
}

const heap_get_Blockframe_environment = (address: any) => heap_get_child(address, 0)

const is_Blockframe = (address: any) => heap_get_tag(address) === Blockframe_tag

// call frame
// [1 byte tag, 1 byte unused, 2 bytes pc,
//  1 byte unused, 2 bytes #children, 1 byte unused]
// followed by the address of env

const heap_allocate_Callframe = (env: any, pc: any) => {
  const address = heap_allocate(Callframe_tag, 2)
  heap_set_2_bytes_at_offset(address, 2, pc)
  heap_set(address + 1, env)
  return address
}

const heap_get_Callframe_environment = (address: any) => heap_get_child(address, 0)

const heap_get_Callframe_pc = (address: any) => heap_get_2_bytes_at_offset(address, 2)

const is_Callframe = (address: any) => heap_get_tag(address) === Callframe_tag

// environment frame
// [1 byte tag, 4 bytes unused,
//  2 bytes #children, 1 byte unused]
// followed by the addresses of its values

const heap_allocate_Frame = (number_of_values: any) =>
  heap_allocate(Frame_tag, number_of_values + 1)

const heap_Frame_display = (address: any) => {
  console.log('', 'Frame:')
  const size = heap_get_number_of_children(address)
  console.log(size, 'frame size:')
  for (let i = 0; i < size; i++) {
    console.log(i, 'value address:')
    const value = heap_get_child(address, i)
    console.log(value, 'value:')
    console.log(word_to_string(value), 'value word:')
  }
}

// environment
// [1 byte tag, 4 bytes unused,
//  2 bytes #children, 1 byte unused]
// followed by the addresses of its frames

const heap_allocate_Environment = (number_of_frames: any) =>
  heap_allocate(Environment_tag, number_of_frames + 1)

const heap_empty_Environment = heap_allocate_Environment(0)

// access environment given by address
// using a "position", i.e. a pair of
// frame index and value index
const heap_get_Environment_value = (env_address: any, position: any) => {
  const [frame_index, value_index] = position
  const frame_address = heap_get_child(env_address, frame_index)
  return heap_get_child(frame_address, value_index)
}

const heap_set_Environment_value = (env_address: any, position: any, value: any) => {
  //console.log(env_address, "env_address:")
  const [frame_index, value_index] = position
  const frame_address = heap_get_child(env_address, frame_index)
  heap_set_child(frame_address, value_index, value)
}

// extend a given environment by a new frame:
// create a new environment that is bigger by 1
// frame slot than the given environment.
// copy the frame Addresses of the given
// environment to the new environment.
// enter the address of the new frame to end
// of the new environment
const heap_Environment_extend = (frame_address: any, env_address: any) => {
  const old_size = heap_get_size(env_address)
  const new_env_address = heap_allocate_Environment(old_size)
  let i
  for (i = 0; i < old_size - 1; i++) {
    heap_set_child(new_env_address, i, heap_get_child(env_address, i))
  }
  heap_set_child(new_env_address, i, frame_address)
  return new_env_address
}

// for debuggging: display environment
const heap_Environment_display = (env_address: any) => {
  const size = heap_get_number_of_children(env_address)
  console.log('', 'Environment:')
  console.log(size, 'environment size:')
  for (let i = 0; i < size; i++) {
    console.log(i, 'frame index:')
    const frame = heap_get_child(env_address, i)
    heap_Frame_display(frame)
  }
}

// number
// [1 byte tag, 4 bytes unused,
//  2 bytes #children, 1 byte unused]
// followed by the number, one word
// note: #children is 0

const heap_allocate_Number = (n: any) => {
  const number_address = heap_allocate(Number_tag, 2)
  heap_set(number_address + 1, n)
  return number_address
}

const is_Number = (address: any) => heap_get_tag(address) === Number_tag

//
// conversions between addresses and JS_value
//

const address_to_JS_value: any = (x: any) =>
  is_Boolean(x)
    ? is_True(x)
      ? true
      : false
    : is_Number(x)
    ? heap_get(x + 1)
    : is_Undefined(x)
    ? undefined
    : is_Unassigned(x)
    ? '<unassigned>'
    : is_Null(x)
    ? null
    : is_String(x) // ADDED CHANGE
    ? heap_get_string(x) // ADDED CHANGE
    : is_Closure(x)
    ? '<closure>'
    : is_Builtin(x)
    ? '<builtin>'
    : 'unknown word tag: ' + word_to_string(x)

const JS_value_to_address: any = (x: any) =>
  is_boolean(x)
    ? x
      ? True
      : False
    : is_number(x)
    ? heap_allocate_Number(x)
    : is_undefined(x)
    ? Undefined
    : is_null(x)
    ? Null
    : is_string(x) // ADDED CHANGE
    ? heap_allocate_String(x) // ADDED CHANGE
    : 'unknown word tag: ' + word_to_string(x)

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
    console.log(address_to_JS_value(address))
    return address
  },
  get_time: () => JS_value_to_address(get_time()),
  error: () => error(address_to_JS_value(OS.pop())),
  is_number: () => (is_Number(OS.pop()) ? True : False),
  is_boolean: () => (is_Boolean(OS.pop()) ? True : False),
  is_undefined: () => (is_Undefined(OS.pop()) ? True : False),
  is_string: () => (is_String(OS.pop()) ? True : False), // ADDED CHANGE
  is_function: () => is_Closure(OS.pop()),
  math_sqrt: () => JS_value_to_address(Math.sqrt(address_to_JS_value(OS.pop()))),
  head: () => heap_get_child(OS.pop(), 0),
  tail: () => heap_get_child(OS.pop(), 1),
  is_null: () => (is_Null(OS.pop()) ? True : False),
  set_head: () => {
    const val = OS.pop()
    const p = OS.pop()
    heap_set_child(p, 0, val)
  },
  set_tail: () => {
    const val = OS.pop()
    const p = OS.pop()
    heap_set_child(p, 1, val)
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
  undefined: Undefined,
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
const scan = (comp: any) =>
  comp.tag === 'seq'
    ? comp.stmts.reduce((acc: any, x: any) => acc.concat(scan(x)), [])
    : ['let', 'const', 'fun'].includes(comp.tag)
    ? [comp.sym]
    : []

const compile_sequence = (seq: any, ce: any) => {
  if (seq.length === 0) return (instrs[wc++] = { tag: 'LDC', val: undefined })
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
  ExpressionStatement: (comp: any, ce: any): void => {
    compile(comp.expression, ce)
  },
  Literal: (comp: any, ce: any) => {
    instrs[wc++] = { tag: 'LDC', val: comp.value }
  },
  nam:
    // store precomputed position information in LD instruction
    (comp: any, ce: any) => {
      instrs[wc++] = {
        tag: 'LD',
        sym: comp.sym,
        pos: compile_time_environment_position(ce, comp.sym)
      }
    },
  unop: (comp: any, ce: any) => {
    compile(comp.frst, ce)
    instrs[wc++] = { tag: 'UNOP', sym: comp.operator }
  },
  BinaryExpression: (comp: any, ce: any) => {
    compile(comp.left, ce)
    compile(comp.right, ce)
    instrs[wc++] = { tag: 'BINOP', sym: comp.operator }
  },
  log: (comp: any, ce: any) => {
    compile(
      comp.sym == '&&'
        ? {
            tag: 'cond_expr',
            pred: comp.frst,
            cons: { tag: 'lit', val: true },
            alt: comp.scnd
          }
        : {
            tag: 'cond_expr',
            pred: comp.frst,
            cons: comp.scnd,
            alt: { tag: 'lit', val: false }
          },
      ce
    )
  },
  cond: (comp: any, ce: any) => {
    compile(comp.pred, ce)
    const jump_on_false_instruction: any = { tag: 'JOF' }
    instrs[wc++] = jump_on_false_instruction
    compile(comp.cons, ce)
    const goto_instruction: any = { tag: 'GOTO' }
    instrs[wc++] = goto_instruction
    const alternative_address = wc
    jump_on_false_instruction.addr = alternative_address
    compile(comp.alt, ce)
    goto_instruction.addr = wc
  },
  while: (comp: any, ce: any) => {
    const loop_start = wc
    compile(comp.pred, ce)
    const jump_on_false_instruction: any = { tag: 'JOF' }
    instrs[wc++] = jump_on_false_instruction
    compile(comp.body, ce)
    instrs[wc++] = { tag: 'POP' }
    instrs[wc++] = { tag: 'GOTO', addr: loop_start }
    jump_on_false_instruction.addr = wc
    instrs[wc++] = { tag: 'LDC', val: undefined }
  },
  app: (comp: any, ce: any) => {
    compile(comp.fun, ce)
    for (let arg of comp.args) {
      compile(arg, ce)
    }
    instrs[wc++] = { tag: 'CALL', arity: comp.args.length }
  },
  assmt:
    // store precomputed position info in ASSIGN instruction
    (comp: any, ce: any) => {
      compile(comp.expr, ce)
      instrs[wc++] = {
        tag: 'ASSIGN',
        pos: compile_time_environment_position(ce, comp.sym)
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
  blk: (comp: any, ce: any) => {
    const locals = scan(comp.body)
    instrs[wc++] = { tag: 'ENTER_SCOPE', num: locals.length }
    compile(
      comp.body,
      // extend compile-time environment
      compile_time_environment_extend(locals, ce)
    )
    instrs[wc++] = { tag: 'EXIT_SCOPE' }
  },
  let: (comp: any, ce: any) => {
    compile(comp.expr, ce)
    instrs[wc++] = {
      tag: 'ASSIGN',
      pos: compile_time_environment_position(ce, comp.sym)
    }
  },
  const: (comp: any, ce: any) => {
    compile(comp.expr, ce)
    instrs[wc++] = {
      tag: 'ASSIGN',
      pos: compile_time_environment_position(ce, comp.sym)
    }
  },
  ret: (comp: any, ce: any) => {
    compile(comp.expr, ce)
    if (comp.expr.tag === 'app') {
      // tail call: turn CALL into TAILCALL
      instrs[wc - 1].tag = 'TAIL_CALL'
    } else {
      instrs[wc++] = { tag: 'RESET' }
    }
  },
  fun: (comp: any, ce: any) => {
    compile(
      {
        tag: 'const',
        sym: comp.sym,
        expr: { tag: 'lam', prms: comp.prms, body: comp.body }
      },
      ce
    )
  }
}

// compile component into instruction array instrs,
// starting at wc (write counter)
const compile = (comp: any, ce: any) => {
  try {
    compile_comp[comp.type](comp, ce)
  } catch {
    console.log(`can't find ${comp.type}`)
  }
  instrs[wc] = { tag: 'DONE' }
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
  JS_value_to_address(binop_microcode[op](address_to_JS_value(v1), address_to_JS_value(v2)))

const unop_microcode = {
  '-unary': (x: number) => -x,
  '!': (x: any) => !x
}

const apply_unop = (op: any, v: any) =>
  JS_value_to_address(unop_microcode[op](address_to_JS_value(v)))

const apply_builtin = (builtin_id: any) => {
  const result = builtin_array[builtin_id]()
  OS.pop() // pop fun
  push(OS, result)
}

// creating global runtime environment
const primitive_values = Object.values(primitive_object)
const frame_address = heap_allocate_Frame(primitive_values.length)
for (let i = 0; i < primitive_values.length; i++) {
  const primitive_value: any = primitive_values[i]
  if (typeof primitive_value === 'object' && primitive_value.hasOwnProperty('id')) {
    heap_set_child(frame_address, i, heap_allocate_Builtin(primitive_value.id))
  } else if (typeof primitive_value === 'undefined') {
    heap_set_child(frame_address, i, Undefined)
  } else {
    heap_set_child(frame_address, i, heap_allocate_Number(primitive_value))
  }
}

const global_environment = heap_Environment_extend(frame_address, heap_empty_Environment)

/* *******
 * machine
 * *******/

// machine registers
let OS: any[] // JS array (stack) of words (Addresses,
//        word-encoded literals, numbers)
let PC: number // JS number
let E: any // heap Address
let RTS: any // JS array (stack) of Addresses
HEAP // (declared above already)

const microcode = {
  LDC: (instr: any) => push(OS, JS_value_to_address(instr.val)),
  UNOP: (instr: any) => push(OS, apply_unop(instr.sym, OS.pop())),
  BINOP: (instr: any) => push(OS, apply_binop(instr.sym, OS.pop(), OS.pop())),
  POP: (instr: any) => OS.pop(),
  JOF: (instr: any) => (PC = is_True(OS.pop()) ? PC : instr.addr),
  GOTO: (instr: any) => (PC = instr.addr),
  ENTER_SCOPE: (instr: any) => {
    push(RTS, heap_allocate_Blockframe(E))
    const frame_address = heap_allocate_Frame(instr.num)
    E = heap_Environment_extend(frame_address, E)
    for (let i = 0; i < instr.num; i++) {
      heap_set_child(frame_address, i, Unassigned)
    }
  },
  EXIT_SCOPE: (instr: any) => (E = heap_get_Blockframe_environment(RTS.pop())),
  LD: (instr: any) => {
    const val = heap_get_Environment_value(E, instr.pos)
    if (is_Unassigned(val)) error('access of unassigned variable')
    push(OS, val)
  },
  ASSIGN: (instr: any) => heap_set_Environment_value(E, instr.pos, peek(OS, 0)),
  LDF: (instr: any) => {
    const closure_address = heap_allocate_Closure(instr.arity, instr.addr, E)
    push(OS, closure_address)
  },
  CALL: (instr: any) => {
    const arity = instr.arity
    const fun = peek(OS, arity)
    if (is_Builtin(fun)) {
      return apply_builtin(heap_get_Builtin_id(fun))
    }
    const frame_address = heap_allocate_Frame(arity)
    for (let i = arity - 1; i >= 0; i--) {
      heap_set_child(frame_address, i, OS.pop())
    }
    OS.pop() // pop fun
    push(RTS, heap_allocate_Callframe(E, PC))
    E = heap_Environment_extend(frame_address, heap_get_Closure_environment(fun))
    PC = heap_get_Closure_pc(fun)
  },
  TAIL_CALL: (instr: any) => {
    const arity = instr.arity
    const fun = peek(OS, arity)
    if (is_Builtin(fun)) {
      return apply_builtin(heap_get_Builtin_id(fun))
    }
    const frame_address = heap_allocate_Frame(arity)
    for (let i = arity - 1; i >= 0; i--) {
      heap_set_child(frame_address, i, OS.pop())
    }
    OS.pop() // pop fun
    // don't push on RTS here
    E = heap_Environment_extend(frame_address, heap_get_Closure_environment(fun))
    PC = heap_get_Closure_pc(fun)
  },
  RESET: (instr: any) => {
    PC--
    // keep popping...
    const top_frame = RTS.pop()
    if (is_Callframe(top_frame)) {
      // ...until top frame is a call frame
      PC = heap_get_Callframe_pc(top_frame)
      E = heap_get_Callframe_environment(top_frame)
    }
  }
}

function run() {
  OS = []
  PC = 0
  E = global_environment
  RTS = []
  stringPool = {} // ADDED CHANGE
  // print_code()
  while (!(instrs[PC].tag === 'DONE')) {
    const instr = instrs[PC++]
    microcode[instr.tag](instr)
  }

  return address_to_JS_value(peek(OS, 0))
}

export async function goRunner(program: any): Promise<Result> {
  compile_program(program)
  const result: any = run()
  console.log(result)

  return Promise.resolve({ value: result } as Finished)
}
