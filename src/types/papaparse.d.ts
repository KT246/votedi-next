declare module 'papaparse' {
    export interface ParseError {
        type?: string;
        code?: string;
        message?: string;
    }

    export interface ParseResult<T> {
        data: T[];
        errors: ParseError[];
        meta: Record<string, unknown>;
    }

    export interface ParseConfig<T> {
        header?: boolean;
        skipEmptyLines?: boolean;
        complete?: (results: ParseResult<T>) => void;
        error?: (error: unknown) => void;
    }

    export function parse<T = unknown>(input: unknown, config: ParseConfig<T>): void;

    const Papa: {
        parse: typeof parse;
    };

    export default Papa;
}
