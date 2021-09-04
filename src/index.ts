import Pg from "./Pg";
const db = new Pg();
//When this file is imported a pool is created by default providing a global pool for the lambda
export const query = db.query.bind(db);
export const setConfig = db.setConfig.bind(db);
export default Pg;


// module.exports = Pg;
// exports = module.exports;
// exports.query = db.query.bind(db);
