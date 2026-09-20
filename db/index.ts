import {drizzle} from "drizzle-orm/node-postgres";
import {getPool} from "../lib/db/client";
import * as schema from "../lib/db/schema";
export function getDb(){return drizzle(getPool(),{schema});}
