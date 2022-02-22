'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var pg = require('pg');
var awsSdk = require('aws-sdk');

const {
  REGION,
  PGHOST,
  PGPORT,
  PGUSER,
  PGPASSWORD
} = process.env;
const DBPOOL_MAXAGE = process.env["DBPOOL_MAXAGE"] || 30000;
const WAIT_TIME = 50;

const log = x => {
  if (process.env["PG_DEBUG"] === "true" || process.env["PG_DEBUG"]) {
    console.log(x);
  }
};

class Pg {
  constructor(config = {}) {
    this._config = {
      max: 10,
      min: 0,
      idleTimeoutMillis: 120000,
      connectionTimeoutMillis: 10000,
      region: "us-east-1"
    };
    this._pool = undefined;
    this._poolStartTime = 0;
    this._isPoolInitializing = false;
    this._config = { ...this._config,
      ...config
    };
  }

  async initPool() {
    try {
      this._isPoolInitializing = true;

      if (!this._pool) {
        //   get this right before instantiating. RDS password expires after certain time.
        if (!PGPASSWORD && !this._config.password) {
          log("Using RDS password");
          this._config.password = this.getRdsPassword();
        }

        log("Initializing pool wilth folowing");
        log(this._config);
        this._pool = new pg.Pool(this._config);

        this._pool.on("error", err => {
          console.error("Error on idle client.");
          console.error(err);
          process.exit(1); //force lambda to use a new container.
        });

        this._poolStartTime = new Date().getTime(); //if connection timeout comes up, move this line to !pool block
      } else if (!this.isPoolGood()) {
        log("Pool object timed out. Re-Initializing new Pool.");

        try {
          await this._pool.end();
          this._pool = undefined;
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

      throw new Error(JSON.stringify({
        message: "Error on connecting to DB",
        error: e
      }));
    } finally {
      this._isPoolInitializing = false;
    }
  }

  getPool() {
    return this._pool;
  }

  setConfig(configObj = {}) {
    try {
      this._config = { ...this._config,
        ...configObj
      }; //   if not called before making connection, it will not close connection.

      this._pool = undefined;
      this.initPool();
    } catch (e) {
      console.log(e);
    }
  }

  isPoolGood() {
    if (new Date().getTime() - this._poolStartTime > DBPOOL_MAXAGE) {
      return false;
    }

    return true;
  }

  async query(sql, valueFiled) {
    try {
      await this.validatePool();
      return this._pool.connect().then(client => {
        log("Client connected to pool.");
        const response = client.query(sql, valueFiled);
        return response.then(data => {
          return Promise.resolve(data);
        }).catch(queryError => {
          return Promise.reject(queryError);
        }).finally(() => {
          log("Release client");
          client.release(true);
        });
      }).catch(async error => {
        var _this$_pool;

        await ((_this$_pool = this._pool) === null || _this$_pool === void 0 ? void 0 : _this$_pool.end());
        this._pool = undefined;
        throw error;
      });
    } catch (e) {
      log(e);
      return Promise.reject(e);
    }
  }

  async transaction(querries = []) {
    this.checkDependent(querries);

    try {
      await this.validatePool();
      const client = await this._pool.connect();

      try {
        log("BEGIN TRANSACTION");
        await client.query("BEGIN");
        let results = [];

        for (let queryObj of querries) {
          try {
            let queryToExecute;

            if (typeof queryObj === "object") {
              const {
                dependsOn,
                updateQuery,
                ...query
              } = queryObj;
              queryToExecute = dependsOn && updateQuery ? updateQuery(queryObj, results[dependsOn]) : query;
            } else {
              queryToExecute = queryObj;
            }

            log("Executing query");
            log(queryToExecute);
            const dbResults = await client.query(queryToExecute);
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

  async validatePool() {
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

  async waitForPool() {
    if (!this._isPoolInitializing) {
      return;
    }

    await sleep(Math.floor(Math.random() * Math.floor(WAIT_TIME)));
    this.waitForPool();
  }

  getRdsPassword() {
    const signer = new awsSdk.RDS.Signer();
    let token = signer.getAuthToken({
      region: REGION || this._config.region,
      hostname: PGHOST || this._config.host,
      port: parseInt(PGPORT, 10) || this._config.port,
      username: PGUSER || this._config.user
    });
    return token;
  }

  checkDependent(querries) {
    for (let i = 0; i < querries.length; i++) {
      if (typeof querries[i] === "object") {
        const {
          dependsOn,
          updateQuery
        } = querries[i];

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

function sleep(time) {
  return new Promise(accept => {
    setTimeout(() => {
      accept(true);
    }, time);
  });
}

const db = new Pg(); //When this file is imported a pool is created by default providing a global pool for the lambda

const query = db.query.bind(db);
const trasaction = db.transaction.bind(db);
const setConfig = db.setConfig.bind(db);
const getPool = db.getPool.bind(db);

exports['default'] = Pg;
exports.getPool = getPool;
exports.query = query;
exports.setConfig = setConfig;
exports.trasaction = trasaction;
//# sourceMappingURL=index.js.map
