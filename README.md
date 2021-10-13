# pg-aws-lambda

Wrapper around node-pg to handle connections for AWS lambda.
https://node-postgres.com/

## Installation:

\*Not published yet.

```bash
npm install @prakat/pg-aws-lambda
# or
yarn add @prakat/pg-aws-lambda
```

## Usage

Recommended to use env variables for connections.
Uses same environment variable and defaults as node-pg. REGION is required for RDS connections

e.g.

```sh
PGHOST = "localhost"
PGUSER = "postgres"
PGDATABASE = "postgres"
PGPASSWORD = "postgres" # leave this out for RDS
PGPORT = 5432
PG_DEBUG = "true" #to turn on the debug
REGION=us-east-1
```

Manually overridign the config. (will accept all the config paramet as node-pg)

```js
const { setConfig } = require("@prakat/pg-aws-lambda");

export.handler = ()=>{
    //call this at very beginning of you program. Outside of handler works too if static.
    setConfig({...config})
}
```

Query

```js
const { query } = require("@prakat/pg-aws-lambda");

exports.handler = async (event) => {
  await query("Select NOW()");
};

// parallel calls
await Promise.all([
   query("Select NOW()"),
   query("Select NOW()"),
   query("Select NOW()"),
]);
```

Transaction

```js
const { transaction } = require("@prakat/pg-aws-lambda");

exports.handler = async (event) => {
  await transactions(["Select NOW()", "Select NOW()"]);
};

// transaction that depends on another query.
const transactions = [
  { text: "INSERT INTO USER (name) VALUES('test') returning primary_key" },
  {
    text: "INSERT INTO ANOTHER_TABLE (column) VALUES($1') returning primary_key",
    value:["will_be_populated_later"]
    dependsOn: 0, //This is index of this array.
    //update the query and return the new query.
    updateQuery:(query,result)=>{{
        // result will hold the result from previous query.
        query.value[0]=result.rows[0].primary_key
        return query
    }}
  },
];
```


