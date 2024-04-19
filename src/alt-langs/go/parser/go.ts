import { parse, PeggySyntaxError } from './go_parser';

export default function go_parse(sourceCode: string) {
  // return parse(sourceCode);

  let parsed_program: object = {};
    try {
        parsed_program = parse(sourceCode);
    } catch (error) {
        if (error instanceof PeggySyntaxError) {
            throw new Error(`Syntax error (${error.location.start.line}:${error.location.start.column}): ${error.message}`);
        } else {
            throw new Error(`Unknown parsing error: ${error.message}`);
        }
    }

    return parsed_program;
}
