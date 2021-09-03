import Pg from "./Pg";
const db = new Pg();

//When this file is imported a pool is created by default providing a global pool for the lambda
export const x = { query: db.query };

export default Pg;
