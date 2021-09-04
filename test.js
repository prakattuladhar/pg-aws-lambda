process.env.PGHOST = "localhost";
process.env.PGUSER = "postgres";
process.env.PGDATABASE = "postgres";
process.env.PGPASSWORD = "postgres";
process.env.PGPORT = 5432;
process.env.PG_DEBUG = "true";

// const Pg = require("./dist/index");
// const Pg = require("./dist/index");
const { query } = require("./dist/index");
const Pg = require("./dist/index")
// new Pg().query("select Now()").then(result=>{})
// console.log(db)
console.log(Pg);
query("select NOW()")
  .then((test) => {
    console.log(test);
  })
  .catch((error) => {
    console.log(error);
  });
// console.log(db)
