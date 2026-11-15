import {randomUUID} from 'node:crypto';
import type {QueryExecutor} from '../db/compatibility.ts';
import {validInn} from '../external/checko-inn.ts';

export async function saveDossier(db:QueryExecutor, owner:string, inn:string) {
  if (!validInn(inn)) throw Error('COMPANY_INN_INVALID');
  const result = await db.query(
    'INSERT INTO company_dossiers(id,owner_email,company_inn) VALUES ($1,$2,$3) ON CONFLICT(owner_email,company_inn) DO UPDATE SET company_inn=excluded.company_inn RETURNING id,company_inn AS inn',
    [randomUUID(),owner,inn]);
  return result.rows[0] as {id:string;inn:string};
}

export async function ownedDossier(db:QueryExecutor, owner:string, id:string) {
  return (await db.query('SELECT id,company_inn AS inn FROM company_dossiers WHERE id=$1 AND owner_email=$2',[id,owner])).rows[0] as {id:string;inn:string}|undefined;
}

export async function dossierVersions(db:QueryExecutor, owner:string, inn:string) {
  return (await db.query("SELECT id,company_name AS name,period_from AS start,period_to AS end FROM analyses WHERE owner_email=$1 AND company_inn=$2 AND archive_state='ACTIVE' ORDER BY created_at DESC,id",[owner,inn])).rows as {id:string;name:string;start:string;end:string}[];
}
