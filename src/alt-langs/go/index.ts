import go_parse from "./parser/go";

export function parseGoToEstreeAst(code: string,
    variant: number = 1,
    doValidate: boolean = false): any {
        const estreeAst = go_parse(code);

        return estreeAst;
    }
