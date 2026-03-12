declare module "sql.js" {
    interface SqlJsStatic {
        Database: new (data?: ArrayLike<number> | Buffer | null) => Database;
    }

    interface Database {
        run(sql: string, params?: any[]): void;
        exec(sql: string, params?: any[]): QueryExecResult[];
        export(): Uint8Array;
        close(): void;
    }

    interface QueryExecResult {
        columns: string[];
        values: any[][];
    }

    function initSqlJs(config?: any): Promise<SqlJsStatic>;
    export default initSqlJs;
    export { Database, SqlJsStatic, QueryExecResult };
}
