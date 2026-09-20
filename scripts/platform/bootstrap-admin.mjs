import {getPool}from'../../lib/db/client.ts';import{randomUUID}from'node:crypto';
const email=process.env.PRESCORE_BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();if(!email)throw Error('BOOTSTRAP_EMAIL_REQUIRED');
const pool=getPool(),c=await pool.connect();try{await c.query('BEGIN');await c.query('SELECT pg_advisory_xact_lock(6419819)');
 if((await c.query("SELECT id FROM platform_bootstrap WHERE id='ADMIN'")).rows.length)throw Error('BOOTSTRAP_ALREADY_APPLIED');
 const user=(await c.query('SELECT id FROM "user" WHERE lower(email)=$1 AND "emailVerified"=true',[email])).rows[0];if(!user)throw Error('VERIFIED_ACCOUNT_REQUIRED');
 await c.query("INSERT INTO platform_roles(user_id,role) VALUES($1,'ADMIN')",[user.id]);await c.query("INSERT INTO platform_bootstrap(id) VALUES('ADMIN')");await c.query("INSERT INTO platform_security_events(id,user_id,event) VALUES($1,$2,'ADMIN_BOOTSTRAP')",[randomUUID(),user.id]);await c.query('COMMIT');console.log('ADMIN_BOOTSTRAP_COMPLETE');
}catch(e){await c.query('ROLLBACK');console.error(e.message);process.exitCode=1;}finally{c.release();await pool.end();}
