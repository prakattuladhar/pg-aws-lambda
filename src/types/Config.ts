import type { PoolConfig } from "pg";

export type Config = PoolConfig & { region?: string };
