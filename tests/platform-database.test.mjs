import test from 'node:test';import assert from 'node:assert/strict';import fs from'node:fs';
import {PGlite}from'@electric-sql/pglite';
import{postgresQuery,PortableDatabase}from'../lib/db/compatibility.ts';
const catalog=JSON.parse(fs.readFileSync(new URL('../lib/db/catalog.json',import.meta.url)));
const sql=fs.readFileSync(new URL('../lib/db/migrations/0001_product.sql',import.meta.url),'utf8');
test('parameters preserve quoted question marks and quoted aliases',()=>{
 assert.equal(postgresQuery("SELECT '?' AS marker, owner_email AS ownerEmail FROM analyses WHERE id = ?",1),`SELECT '?' AS "marker", owner_email AS "ownerEmail" FROM analyses WHERE id = $1`);
 assert.throws(()=>postgresQuery('SELECT ?',0),/COUNT/);
});
test('unregistered replacement and runtime destructive DDL fail closed',async()=>{
 assert.throws(()=>postgresQuery('INSERT OR REPLACE INTO payments(id) VALUES(?)',1),/REGISTERED/);
 const db=new PortableDatabase({query:async()=>{throw Error('MUST_NOT_EXECUTE');}},catalog);
 await assert.rejects(db.prepare('DROP TABLE analyses').run(),/FORBIDDEN/);
});
test('PostgreSQL schema preserves all legacy column names',()=>{
 const legacy=JSON.parse(fs.readFileSync(new URL('../docs/platform-migration/table-inventory.json',import.meta.url)));
 for(const t of legacy)assert.deepEqual(catalog.find(c=>c.table===t.table).columns,t.columns);
});
test('PostgreSQL execution: explicit migration, aliases, ignore, batch rollback, schema assertion',async()=>{
 const pg=new PGlite();
 const executor={query:async(s,v)=>{const r=await pg.query(s,v);return{rows:r.rows,rowCount:r.affectedRows};}};
 const pool={...executor,connect:async()=>({...executor,release(){}})};
 const db=new PortableDatabase(pool,catalog);
 try{
  await assert.rejects(db.prepare('CREATE TABLE IF NOT EXISTS module_settings (id TEXT)').run(),/MIGRATION_REQUIRED/);
  await pg.exec(sql);await pg.exec(sql);
  await db.prepare('CREATE TABLE IF NOT EXISTS module_settings (id TEXT)').run();
  await db.prepare('INSERT OR IGNORE INTO module_settings(module_key,label) VALUES (?,?)').bind('one','original').run();
  await db.prepare('INSERT OR IGNORE INTO module_settings(module_key,label) VALUES (?,?)').bind('one','changed').run();
  assert.deepEqual(await db.prepare('SELECT module_key AS moduleKey, label FROM module_settings WHERE module_key=?').bind('one').first(),{moduleKey:'one',label:'original'});
  await assert.rejects(db.batch([db.prepare('UPDATE module_settings SET label=? WHERE module_key=?').bind('bad','one'),db.prepare('INSERT INTO nonexistent VALUES (?)').bind(1)]));
  assert.equal((await db.prepare('SELECT label FROM module_settings').first()).label,'original');
  assert.equal(await db.prepare('SELECT label FROM module_settings WHERE module_key=?').bind("' OR 1=1 --").first(),null);
  await assert.rejects(db.prepare('ALTER TABLE module_settings ADD COLUMN unknown TEXT').run(),/MIGRATION_REQUIRED/);
 }finally{await pg.close();}
});
