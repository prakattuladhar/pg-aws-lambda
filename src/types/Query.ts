import type { QueryResult, QueryConfig } from "pg";
export type TransactionQuery =
  | (QueryConfig & {
      dependsOn?: number;
      updateQuery?: (
        query: QueryConfig,
        resultDependent: QueryResult
      ) => QueryConfig;
    })
  | string;
