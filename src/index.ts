import Pg from "./Pg";
const db = new Pg();

//When this file is imported a pool is created by default providing a global pool for the lambda
// export const query = db.query;
// const obj= {
//   query: db.query
// }
// module.exports = db;
export default { query: db.query };
