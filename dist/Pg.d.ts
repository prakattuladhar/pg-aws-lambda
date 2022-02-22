import { Pool as DbPool } from "pg";
import type { QueryResult } from "pg";
import type { Config } from "./types/Config";
import type { TransactionQuery } from "./types/Query";
declare class Pg {
    private _config;
    private _pool;
    private _poolStartTime;
    private _isPoolInitializing;
    constructor(config?: Config);
    private initPool;
    getPool(): DbPool;
    setConfig(configObj?: Config): void;
    private isPoolGood;
    query(sql: any, valueFiled: any): Promise<import("pg").QueryArrayResult<any[]>>;
    transaction(querries?: TransactionQuery[]): Promise<QueryResult<any>[]>;
    private validatePool;
    private waitForPool;
    private getRdsPassword;
    private checkDependent;
}
export default Pg;
