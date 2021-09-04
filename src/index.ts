import Pg from "./Pg";
const db = new Pg();
//When this file is imported a pool is created by default providing a global pool for the lambda
export const query = db.query.bind(db);
export const trasaction = db.transaction.bind(db);
export const setConfig = db.setConfig.bind(db);
export const getPool = db.getPool.bind(db);
export default Pg;
