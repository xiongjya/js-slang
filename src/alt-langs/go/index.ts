import { Program } from "estree";
import parse from "./parser/go";

export function parseGoToEstreeAst(code: string,
    variant: number = 1,
    doValidate: boolean = false): Program {
        const estreeAst = parse(code);
        return estreeAst;
    }
