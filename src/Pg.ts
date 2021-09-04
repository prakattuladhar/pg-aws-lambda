import { Pool as DbPool } from "pg";
import { RDS } from "aws-sdk";
import type { Pool, QueryResult } from "pg";
import type { Config } from "./types/Config";
import type { TransactionQuery } from "./types/Query";
const { REGION, PGHOST, PGPORT, PGUSER, PGPASSWORD } = process.env;
const DBPOOL_MAXAGE = process.env["DBPOOL_MAXAGE"] || 30000;
const WAIT_TIME = 50;
const log = (x: any) => {
  if (process.env["PG_DEBUG"] === "true" || process.env["PG_DEBUG"]) {
    console.log(x);
  }
};
class Pg {
  private _config: Config = {
    max: 10,
    min: 0,
    idleTimeoutMillis: 120000,
    connectionTimeoutMillis: 10000,
    region: "us-east-1",
  };
  private _pool: Pool = undefined as unknown as Pool;
  private _poolStartTime: number = 0;
  private _isPoolInitializing: boolean = false;
  constructor(config: Config = {}) {
    this._config = { ...this._config, ...config };
  }
  private async initPool() {
    try {
      this._isPoolInitializing = true;
      if (!this._pool) {
        //   get this right before instantiating. RDS password expires after certain time.
        console.log(PGPASSWORD);
        console.log(this._config.password);
        if (!PGPASSWORD && !this._config.password) {
          log("Using RDS password");
          this._config.password = this.getRdsPassword();
        }
        console.log("===initializing pool wilthfolowing");
        console.log(this._config);

        this._pool = new DbPool(this._config);
        this._pool.on("error", (err) => {
          console.log("Error on idle client.");
          console.log(err);
          process.exit(1); //force lambda to use a new container.
        });
        this._poolStartTime = new Date().getTime(); //if connection timeout comes up, move this line to !pool block
      } else if (!this.isPoolGood()) {
        log("Pool object timed out. Re-Initializing new Pool.");
        try {
          await this._pool.end();
          this._pool = undefined as unknown as Pool;
          await sleep(Math.floor(Math.random() * Math.floor(WAIT_TIME)));

          await this.initPool();
        } catch (e) {
          //when parallel initPool is invoked and db connection is timed out, it will try to invoke pool.end() multile time. In this case, Wait for initPool to complete
          throw "WAIT";
        }
      } else {
        log("Reusing pool.");
      }
    } catch (e) {
      log(e);
      if (e === "WAIT") {
        throw "WAIT";
      }
      throw new Error(
        JSON.stringify({ message: "Error on connecting to DB", error: e })
      );
    } finally {
      this._isPoolInitializing = false;
    }
  }
  public getPool() {
    return this._pool;
  }
  public setConfig(configObj: Config = {}) {
    try {
      this._config = { ...this._config, ...configObj };
      //   if not called before making connection, it will not close connection.
      this._pool = undefined as unknown as Pool;
      this.initPool();
    } catch (e) {
      console.log(e);
    }
  }
  private isPoolGood() {
    if (new Date().getTime() - this._poolStartTime > DBPOOL_MAXAGE) {
      return false;
    }
    return true;
  }
  public async query(sql: any, valueFiled: any) {
    try {
      await this.validatePool();
      return this._pool
        .connect()
        .then((client) => {
          log("client connected to pool.");
          const response = client.query(sql, valueFiled);
          return response
            .then((data) => {
              return Promise.resolve(data);
            })
            .catch((queryError) => {
              return Promise.reject(queryError);
            })
            .finally(() => {
              log("release client");
              client.release();
            });
        })
        .catch(async (error) => {
          await this._pool?.end();
          this._pool = undefined as unknown as Pool;
          throw error;
        });
    } catch (e) {
      log(e);
      return Promise.reject(e);
    }
  }

  public async transaction(querries: TransactionQuery[] = []) {
    this.checkDependent(querries);
    try {
      await this.validatePool();
      const client = await this._pool.connect();
      try {
        log("BEGIN TRANSACTION");
        await client.query("BEGIN");
        let results: QueryResult[] = [];
        for (let queryObj of querries) {
          try {
            let queryToExecute;
            if (typeof queryObj === "object") {
              const { dependsOn, updateQuery, ...query } = queryObj;
              queryToExecute =
                dependsOn && updateQuery
                  ? updateQuery(queryObj, results[dependsOn])
                  : query;
            } else {
              queryToExecute = queryObj;
            }
            log("Executing query");
            log(queryToExecute);
            const dbResults: QueryResult = await client.query(queryToExecute);
            results.push(dbResults);
          } catch (e) {
            throw e;
          }
        }
        log("COMMIT TRANSACTION");
        await client.query("COMMIT");
        return results;
      } catch (e) {
        log("ROLLBACK TRANSACTION");
        await client.query("ROLLBACK");
        throw e;
      } finally {
        client.release(true);
      }
    } catch (e) {
      throw e;
    }
  }
  private async validatePool() {
    try {
      await this.initPool();
    } catch (e) {
      //there's a better way of handling this using catch chains.
      if (e === "WAIT") {
        log("waiting for pool to be intilized");
        this.waitForPool();
      } else {
        throw e;
      }
    }
  }
  private async waitForPool() {
    if (!this._isPoolInitializing) {
      return;
    }
    await sleep(Math.floor(Math.random() * Math.floor(WAIT_TIME)));
    this.waitForPool();
  }

  private getRdsPassword() {
    const signer = new RDS.Signer();
    let token = signer.getAuthToken({
      region: REGION || this._config.region,
      hostname: PGHOST || this._config.host,
      port: parseInt(PGPORT as string, 10) || this._config.port,
      username: PGUSER || this._config.user,
    });
    return token;
  }
  private checkDependent(querries: any[]) {
    for (let i = 0; i < querries.length; i++) {
      if (typeof querries[i] === "object") {
        const { dependsOn, updateQuery } = querries[i];
        if (dependsOn !== undefined && dependsOn >= i) {
          throw "Cannot be self dependent or dependsOn need to be after the dependent query";
        }
        if (dependsOn !== undefined && !updateQuery) {
          console.warn("updateQuery callback was not provided with dependsOn.");
        }
      }
    }
  }
}
function sleep(time: number) {
  return new Promise((accept) => {
    setTimeout(() => {
      accept(true);
    }, time);
  });
}

export default Pg;
