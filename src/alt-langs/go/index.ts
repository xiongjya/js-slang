import { Program } from "estree";

const parse = require('./parser/go');

export function parseGoToEstreeAst(code: string,
    variant: number = 1,
    doValidate: boolean = false): Program {
        const estreeAst = parse(code);
        console.log(JSON.stringify(estreeAst))
        return estreeAst;
    }
