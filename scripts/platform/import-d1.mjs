import{readFile}from'node:fs/promises';import{getPool}from'../../lib/db/client.ts';import{validateExport}from'../../lib/db/import-validation.ts';import catalog from'../../lib/db/catalog.json'with{type:'json'};
const file=process.argv.find(x=>x.startsWith('--file='))?.slice(7);if(!file)throw Error('Usage: --file=/absolute/export.json [--apply]');
const report=validateExport(JSON.parse(await readFile(file,'utf8')));console.log(JSON.stringify({counts:report.counts,errors:report.errors,mode:process.argv.includes('--apply')?'APPLY':'DRY_RUN'}));
if(!report.valid){process.exitCode=1;}else if(process.argv.includes('--apply')){
 const pool=getPool(),c=await pool.connect();try{await c.query('BEGIN ISOLATION LEVEL SERIALIZABLE');await c.query('SELECT pg_advisory_xact_lock(6419820)');const reconciliation=[];
 for(const table of catalog){const rows=report.tables[table.table];let inserted=0,identical=0;
  for(const row of rows){const columns=Object.keys(row),key=table.primaryKey.map((k,i)=>`"${k}"=$${i+1}`).join(' AND ');const found=await c.query(`SELECT * FROM "${table.table}" WHERE ${key}`,table.primaryKey.map(k=>row[k]));
   if(found.rows.length){if(columns.some(k=>found.rows[0][k]!==row[k]))throw Error('CONFLICTING_EXISTING_ROW');identical++;continue;}
   await c.query(`INSERT INTO "${table.table}" (${columns.map(k=>`"${k}"`).join(',')}) VALUES (${columns.map((_,i)=>'$'+(i+1)).join(',')})`,columns.map(k=>row[k]));inserted++;
   const verified=await c.query(`SELECT * FROM "${table.table}" WHERE ${key}`,table.primaryKey.map(k=>row[k]));if(!verified.rows.length||columns.some(k=>verified.rows[0][k]!==row[k]))throw Error('POST_IMPORT_VALUE_MISMATCH');
  }reconciliation.push({table:table.table,source:rows.length,inserted,identical,total:(await c.query(`SELECT COUNT(*)::int AS n FROM "${table.table}"`)).rows[0].n});
 }await c.query('COMMIT');console.log(JSON.stringify({status:'VERIFIED',reconciliation}));
 }catch{await c.query('ROLLBACK');console.error('IMPORT_FAILED_ROLLED_BACK');process.exitCode=1;}finally{c.release();await pool.end();}
}
