const get_size = (x: any) => 0

/* *************************
 * HEAP
 * *************************/

// HEAP is an array of bytes (JS ArrayBuffer)

const word_size = 8
// const mega = 2 ** 20
const size_offset = 5

export default class Heap {
  reset_string_pool() {
    this.stringPool = {}
  }
  private HEAP: DataView = Heap.heap_make(1000000)
  private free: number = 0

  // Record<string, tuple(number, string)> where the key is the hash of the string
  // and the value is a tuple of the address of the string and the string itself
  private stringPool: object = {} // ADDED CHANGE

  // All values are allocated on the heap as nodes. The first
  // word of the node is a header, and the first byte of the
  // header is a tag that identifies the type of node
  static False_tag: number = 0
  static True_tag = 1
  static Number_tag = 2
  static Null_tag = 3
  static Unassigned_tag = 4
  static Undefined_tag = 5
  static Blockframe_tag = 6
  static Callframe_tag = 7
  static Closure_tag = 8
  static Frame_tag = 9
  static Environment_tag = 10
  static Pair_tag = 11
  static Builtin_tag = 12
  static String_tag = 13 // ADDED CHANGE

  static heap_make(bytes: any): DataView {
    const data = new ArrayBuffer(bytes)
    const view = new DataView(data)
    return view
  }
  // heap_allocate allocates a given number of words
  // on the heap and marks the first word with a 1-byte tag.
  // the last two bytes of the first word indicate the number
  // of children (addresses) that follow the tag word:
  // [1 byte tag, 4 bytes payload (depending on node type),
  //  2 bytes #children, 1 byte unused]
  // Note: payload depends on the type of node
  heap_allocate(tag: any, size: any): number {
    const address = this.free
    this.free += size
    this.HEAP.setUint8(address * word_size, tag)
    this.HEAP.setUint16(address * word_size + size_offset, size)
    return address
  }

  // get and set a word in heap at given address
  heap_get(address: any) {
    return this.HEAP.getFloat64(address * word_size)
  }

  heap_set(address: any, x: any) {
    return this.HEAP.setFloat64(address * word_size, x)
  }

  // child index starts at 0
  heap_get_child(address: any, child_index: any) {
    return this.heap_get(address + 1 + child_index)
  }

  heap_set_child(address: any, child_index: any, value: any) {
    return this.heap_set(address + 1 + child_index, value)
  }

  heap_get_tag(address: any) {
    return this.HEAP.getUint8(address * word_size)
  }

  heap_get_size(address: any): number {
    return this.HEAP.getUint16(address * word_size + size_offset)
  }

  // the number of children is one less than the size
  // except for number nodes:
  //                 they have size 2 but no children
  heap_get_number_of_children(address: any): number {
    return this.heap_get_tag(address) === Heap.Number_tag ? 0 : get_size(address) - 1
  }

  // access byte in heap, using address and offset
  heap_set_byte_at_offset(address: any, offset: any, value: any) {
    return this.HEAP.setUint8(address * word_size + offset, value)
  }

  heap_get_byte_at_offset(address: any, offset: any) {
    return this.HEAP.getUint8(address * word_size + offset)
  }

  // access byte in heap, using address and offset
  heap_set_2_bytes_at_offset(address: any, offset: any, value: any) {
    return this.HEAP.setUint16(address * word_size + offset, value)
  }

  heap_get_2_bytes_at_offset(address: any, offset: any) {
    return this.HEAP.getUint16(address * word_size + offset)
  }
  // ADDED CHANGE
  heap_set_4_bytes_at_offset(address: any, offset: any, value: any) {
    return this.HEAP.setUint32(address * word_size + offset, value)
  }

  // ADDED CHANGE
  heap_get_4_bytes_at_offset(address: any, offset: any) {
    return this.HEAP.getUint32(address * word_size + offset)
  }

  // for debugging: return a string that shows the bits
  // of a given word
  static word_to_string(word: any): string {
    const buf = new ArrayBuffer(8)
    const view = new DataView(buf)
    view.setFloat64(0, word)
    let binStr = ''
    for (let i = 0; i < 8; i++) {
      binStr += ('00000000' + view.getUint8(i).toString(2)).slice(-8) + ' '
    }
    return binStr
  }

  // all values (including literals) are allocated on the heap.

  // We allocate canonical values for
  // true, false, undefined, null, and unassigned
  // and make sure no such values are created at runtime

  // boolean values carry their value (0 for false, 1 for true)
  // in the byte following the tag
  False = this.heap_allocate(Heap.False_tag, 1)
  is_False(address: any) {
    return this.heap_get_tag(address) === Heap.False_tag
  }

  True = this.heap_allocate(Heap.True_tag, 1)
  is_True(address: any) {
    return this.heap_get_tag(address) === Heap.True_tag
  }

  is_Boolean(address: any) {
    return this.is_True(address) || this.is_False(address)
  }

  Null = this.heap_allocate(Heap.Null_tag, 1)
  is_Null(address: any) {
    return this.heap_get_tag(address) === Heap.Null_tag
  }

  Unassigned = this.heap_allocate(Heap.Unassigned_tag, 1)
  is_Unassigned(address: any) {
    return this.heap_get_tag(address) === Heap.Unassigned_tag
  }

  Undefined = this.heap_allocate(Heap.Undefined_tag, 1)
  is_Undefined(address: any) {
    return this.heap_get_tag(address) === Heap.Undefined_tag
  }

  // ADDED CHANGE
  // strings:
  // [1 byte tag, 4 byte hash to stringPool,
  // 2 bytes #children, 1 byte unused]
  // Note: #children is 0

  // Hash any string to a 32-bit unsigned integer
  static hashString(str: any): number {
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

  String = this.heap_allocate(Heap.String_tag, 1)
  is_String(address: any): boolean {
    return this.heap_get_tag(address) === Heap.String_tag
  }

  heap_allocate_String(str: any) {
    const hash = Heap.hashString(str)
    const address_or_undefined = this.stringPool[hash]

    if (address_or_undefined !== undefined) {
      return address_or_undefined[0]
    }

    const address = this.heap_allocate(Heap.String_tag, 1)
    this.heap_set_4_bytes_at_offset(address, 1, hash)

    // Store the string in the string pool
    this.stringPool[hash] = [address, str]

    return address
  }

  heap_get_string_hash(address: any) {
    return this.heap_get_4_bytes_at_offset(address, 1)
  }

  heap_get_string(address: any) {
    return this.stringPool[this.heap_get_string_hash(address)][1]
  }

  // builtins: builtin id is encoded in second byte
  // [1 byte tag, 1 byte id, 3 bytes unused,
  //  2 bytes #children, 1 byte unused]
  // Note: #children is 0
  is_Builtin(address: any) {
    return this.heap_get_tag(address) === Heap.Builtin_tag
  }

  heap_allocate_Builtin(id: any) {
    const address = this.heap_allocate(Heap.Builtin_tag, 1)
    this.heap_set_byte_at_offset(address, 1, id)
    return address
  }

  heap_get_Builtin_id(address: any) {
    return this.heap_get_byte_at_offset(address, 1)
  }

  // closure
  // [1 byte tag, 1 byte arity, 2 bytes pc, 1 byte unused,
  //  2 bytes #children, 1 byte unused]
  // followed by the address of env
  // note: currently bytes at offset 4 and 7 are not used;
  //   they could be used to increase pc and #children range

  heap_allocate_Closure(arity: any, pc: any, env: any) {
    const address = this.heap_allocate(Heap.Closure_tag, 2)
    this.heap_set_byte_at_offset(address, 1, arity)
    this.heap_set_2_bytes_at_offset(address, 2, pc)
    this.heap_set(address + 1, env)
    return address
  }

  heap_get_Closure_arity(address: any) {
    return this.heap_get_byte_at_offset(address, 1)
  }

  heap_get_Closure_pc(address: any) {
    return this.heap_get_2_bytes_at_offset(address, 2)
  }

  heap_get_Closure_environment(address: any) {
    return this.heap_get_child(address, 0)
  }

  is_Closure(address: any) {
    return this.heap_get_tag(address) === Heap.Closure_tag
  }

  // block frame
  // [1 byte tag, 4 bytes unused,
  //  2 bytes #children, 1 byte unused]

  heap_allocate_Blockframe(env: any) {
    const address = this.heap_allocate(Heap.Blockframe_tag, 2)
    this.heap_set(address + 1, env)
    return address
  }

  heap_get_Blockframe_environment(address: any) {
    return this.heap_get_child(address, 0)
  }

  is_Blockframe(address: any) {
    return this.heap_get_tag(address) === Heap.Blockframe_tag
  }

  // call frame
  // [1 byte tag, 1 byte unused, 2 bytes pc,
  //  1 byte unused, 2 bytes #children, 1 byte unused]
  // followed by the address of env

  heap_allocate_Callframe(env: any, pc: any) {
    const address = this.heap_allocate(Heap.Callframe_tag, 2)
    this.heap_set_2_bytes_at_offset(address, 2, pc)
    this.heap_set(address + 1, env)
    return address
  }

  heap_get_Callframe_environment(address: any) {
    return this.heap_get_child(address, 0)
  }

  heap_get_Callframe_pc(address: any) {
    return this.heap_get_2_bytes_at_offset(address, 2)
  }

  is_Callframe(address: any) {
    return this.heap_get_tag(address) === Heap.Callframe_tag
  }

  // environment frame
  // [1 byte tag, 4 bytes unused,
  //  2 bytes #children, 1 byte unused]
  // followed by the addresses of its values

  heap_allocate_Frame(number_of_values: any) {
    return this.heap_allocate(Heap.Frame_tag, number_of_values + 1)
  }

  heap_Frame_display(address: any) {
    console.log('', 'Frame:')
    const size = this.heap_get_number_of_children(address)
    console.log(size, 'frame size:')
    for (let i = 0; i < size; i++) {
      console.log(i, 'value address:')
      const value = this.heap_get_child(address, i)
      console.log(value, 'value:')
      console.log(Heap.word_to_string(value), 'value word:')
    }
  }

  // environment
  // [1 byte tag, 4 bytes unused,
  //  2 bytes #children, 1 byte unused]
  // followed by the addresses of its frames

  heap_allocate_Environment(number_of_frames: any) {
    return this.heap_allocate(Heap.Environment_tag, number_of_frames + 1)
  }

  heap_empty_Environment() {
    return this.heap_allocate_Environment(0)
  }

  // access environment given by address
  // using a "position", i.e. a pair of
  // frame index and value index
  heap_get_Environment_value(env_address: any, position: any) {
    const [frame_index, value_index] = position
    const frame_address = this.heap_get_child(env_address, frame_index)
    return this.heap_get_child(frame_address, value_index)
  }

  heap_set_Environment_value(env_address: any, position: any, value: any) {
    //console.log(env_address, "env_address:")
    const [frame_index, value_index] = position
    const frame_address = this.heap_get_child(env_address, frame_index)
    this.heap_set_child(frame_address, value_index, value)
  }

  // extend a given environment by a new frame:
  // create a new environment that is bigger by 1
  // frame slot than the given environment.
  // copy the frame Addresses of the given
  // environment to the new environment.
  // enter the address of the new frame to end
  // of the new environment
  heap_Environment_extend(frame_address: any, env_address: any) {
    const old_size = this.heap_get_size(env_address)
    const new_env_address = this.heap_allocate_Environment(old_size)
    let i
    for (i = 0; i < old_size - 1; i++) {
      this.heap_set_child(new_env_address, i, this.heap_get_child(env_address, i))
    }
    this.heap_set_child(new_env_address, i, frame_address)
    return new_env_address
  }

  // for debuggging: display environment
  heap_Environment_display(env_address: any) {
    const size = this.heap_get_number_of_children(env_address)
    console.log('', 'Environment:')
    console.log(size, 'environment size:')
    for (let i = 0; i < size; i++) {
      console.log(i, 'frame index:')
      const frame = this.heap_get_child(env_address, i)
      this.heap_Frame_display(frame)
    }
  }

  // number
  // [1 byte tag, 4 bytes unused,
  //  2 bytes #children, 1 byte unused]
  // followed by the number, one word
  // note: #children is 0

  heap_allocate_Number(n: any) {
    const number_address = this.heap_allocate(Heap.Number_tag, 2)
    this.heap_set(number_address + 1, n)
    return number_address
  }

  is_Number(address: any): boolean {
    return this.heap_get_tag(address) === Heap.Number_tag
  }

  static is_boolean(x: any): boolean {
    return typeof x === 'boolean'
  }

  static is_number(x: any): boolean {
    return typeof x === 'number'
  }

  static is_null(x: any): boolean {
    return x === null
  }

  static is_string(x: any): boolean {
    return typeof x === 'string'
  }

  static is_undefined(x: any): boolean {
    return x === undefined
  }

  address_to_JS_value(x: any): any {
    return this.is_Boolean(x)
      ? this.is_True(x)
        ? true
        : false
      : this.is_Number(x)
      ? this.heap_get(x + 1)
      : this.is_Undefined(x)
      ? undefined
      : this.is_Unassigned(x)
      ? '<unassigned>'
      : this.is_Null(x)
      ? null
      : this.is_String(x) // ADDED CHANGE
      ? this.heap_get_string(x) // ADDED CHANGE
      : this.is_Closure(x)
      ? '<closure>'
      : this.is_Builtin(x)
      ? '<builtin>'
      : 'unknown word tag: ' + Heap.word_to_string(x)
  }

  JS_value_to_address(x: any): any {
    return Heap.is_boolean(x)
      ? x
        ? this.True
        : this.False
      : Heap.is_number(x)
      ? this.heap_allocate_Number(x)
      : Heap.is_undefined(x)
      ? this.Undefined
      : Heap.is_null(x)
      ? this.Null
      : Heap.is_string(x) // ADDED CHANGE
      ? this.heap_allocate_String(x) // ADDED CHANGE
      : 'unknown word tag: ' + Heap.word_to_string(x)
  }
}