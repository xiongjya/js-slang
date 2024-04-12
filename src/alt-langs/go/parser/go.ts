import * as peggy from "peggy";
import { LocationRange, Stage } from "peggy";
import { readFileSync } from "fs";

/**
 * Callback that the gnerated peggy parser uses to show warnings to user
 * @param parserStage
 * @param message
 * @param location
 */
function warningCallback(
  parserStage: Stage,
  message: string,
  location: LocationRange | undefined,
): void {
  console.log(message);
  //TODO: add location info nicely in future
}

const parserFilePath = "src/alt-langs/go/parser/go.pegjs"; //this path is relative to where ur terminal is
const grammar: string = readFileSync(parserFilePath, "utf8");

const parser = peggy.generate(
  grammar, 
  {
  cache: true,
  warning: warningCallback,
});

export default function parse(
  sourceCode: string
) {
  return parser.parse(sourceCode);
}
