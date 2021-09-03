import { Pool as DbPool } from "pg";
import { RDS } from "aws-sdk";
import type { Pool } from "pg";
import type { Config } from "./types/Config";
const { REGION, PGHOST, PGPORT, PGUSER } = process.env;
const DBPOOL_MAXAGE = process.env["DBPOOL_MAXAGE"] || 30000;
const WAIT_TIME = 50;
const log = (x: any) => {
  if (process.env["PG_DEBUG"] === "true" || process.env["PG_DEBUG"]) {
    console.log(x);
  }
};
class Pg {
  private _config: Config = {
    max: 5,
    min: 0,
    idleTimeoutMillis: 120000,
    connectionTimeoutMillis: 10000,
    port: 5432,
  };
  private _pool: Pool | undefined = undefined;
  private _poolStartTime: number = 0;
  constructor(config: Config = {}) {
    this._config.password = this.getRdsPassword();
    this._config = { ...this._config, ...config };
  }
  private async initPool() {
    try {
      if (!this._pool) {
        this._pool = new DbPool(this._config);
        this._pool.on("error", () => {
          console.log("Error on idle client.");
          process.exit(1); //force lambda to use a new container.
        });

        this._poolStartTime = new Date().getTime(); //if connection timeout comes up, move this line to !pool block
      } else if (!this.isPoolGood()) {
        log(
          "========Pool object timed out. Re-Initializing new Pool.========="
        );
        try {
          await this._pool.end();
          this._pool = undefined;
          await setTimeout(() => {},
          Math.floor(Math.random() * Math.floor(WAIT_TIME)));
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
    }
  }
  public setConfig(configObj: Config = {}) {
    try {
      this._config.password = this.getRdsPassword();
      this._config = { ...this._config, ...configObj };
      //   if not called before making connection, it will not close connection.
      this._pool = undefined;
      this.initPool();
      return true;
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
      try {
        await this.initPool();
      } catch (e) {
        //there's a better way of handling this using catch chains.
        if (e === "WAIT") {
          log("waiting for pool to be intilized");
          await setTimeout(() => {}, WAIT_TIME);
        } else {
          throw e;
        }
      }
      log("connecting");
      return this._pool
        ?.connect()
        .then((client) => {
          log("client connected to pool.");
          const response = client.query(sql, valueFiled);
          return response.then((data) => {
            client.release();
            return Promise.resolve(data);
          });
          // await pool.end();
          // pool = undefined;
        })
        .catch(async (error) => {
          await this._pool?.end();
          this._pool = undefined;
          throw error;
        });
    } catch (e) {
      log("=======error in pg-lambda client========");
      log(e);
      log("========================================");
      return Promise.reject(e);
    }
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
}

export default Pg;
