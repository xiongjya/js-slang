import { Program } from 'estree'

import { Chapter, Context, Variant } from '../../types'
import { FatalSyntaxError } from '../errors'
import { AcornOptions, Parser } from '../types'
import { positionToSourceLocation } from '../utils'

export class GoParser implements Parser<AcornOptions> {
  private chapter: Chapter
  private variant: Variant

  constructor(chapter: Chapter, variant: Variant) {
    this.chapter = chapter
    this.variant = variant
  }

  parse(
    programStr: string,
    context: Context,
    options?: Partial<AcornOptions>,
    throwOnError?: boolean
  ): Program | null {
    try {
      // parse the Go code
      /*
            const chapterNum = 1;
            return parseGoToEstreeAst(programStr, chapterNum, false);
            */
      return null
    } catch (error) {
      if (error instanceof SyntaxError) {
        error = new FatalSyntaxError(positionToSourceLocation((error as any).loc), error.toString())
      }

      if (throwOnError) throw error
      context.errors.push(error)
    }
    return null
  }

  validate(_ast: Program, _context: Context, _throwOnError: boolean): boolean {
    return true
  }

  toString(): string {
    return `GoParser{chapter: ${this.chapter}, variant: ${this.variant}}`
  }
}
