import {drizzle} from "drizzle-orm/d1";
import * as schema from "./schema";
function unavailableBinding():Parameters<typeof drizzle>[0]{throw new Error("LEGACY_D1_EXAMPLE_NOT_CONFIGURED");}
export function getDb(){return drizzle(unavailableBinding(),{schema});}
