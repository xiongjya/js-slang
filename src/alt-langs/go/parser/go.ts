import { parse } from './go_parser';

export default function go_parse(sourceCode: string) {
  const parsed_program = parse(sourceCode);
  return parsed_program;
}
