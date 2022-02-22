import Pg from "./Pg";
export declare const query: (sql: any, valueFiled: any) => Promise<import("pg").QueryArrayResult<any[]>>;
export declare const trasaction: (querries?: import("./types/Query").TransactionQuery[]) => Promise<import("pg").QueryResult<any>[]>;
export declare const setConfig: (configObj?: import("./types/Config").Config) => void;
export declare const getPool: () => import("pg").Pool;
export default Pg;
