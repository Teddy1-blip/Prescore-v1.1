import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {ownerPreviewFullAccess} from '../lib/platform/owner-preview-access.ts';

const owner='owner@prescore.test';
const digest=createHash('sha256').update(owner).digest('hex');
const valid={
 PRESCORE_RUNTIME_MODE:'release-candidate',
 PRESCORE_OWNER_FULL_PREVIEW:'1',
 PRESCORE_OWNER_PREVIEW_EMAIL_SHA256:digest,
 PRESCORE_BASE_URL:'https://prescore.ru',
};
test('Owner Full preview matches only the configured account in an isolated RC',()=>{
 assert.equal(ownerPreviewFullAccess(owner,valid),true);
 assert.equal(ownerPreviewFullAccess('OWNER@PRESCORE.TEST',valid),true);
 assert.equal(ownerPreviewFullAccess('other@prescore.test',valid),false);
});
test('Preview is disabled by default and in production regardless of the digest',()=>{
 assert.equal(ownerPreviewFullAccess(owner,{...valid,PRESCORE_OWNER_FULL_PREVIEW:undefined}),false);
 assert.equal(ownerPreviewFullAccess(owner,{...valid,PRESCORE_RUNTIME_MODE:'production'}),false);
 assert.equal(ownerPreviewFullAccess(owner,{...valid,PRESCORE_OWNER_PREVIEW_EMAIL_SHA256:'not-a-hash'}),false);
 assert.equal(ownerPreviewFullAccess(owner,{...valid,PRESCORE_BASE_URL:'https://other.example'}),false);
 assert.equal(ownerPreviewFullAccess(owner,{...valid,PRESCORE_BASE_URL:'http://localhost:3000'}),false);
 assert.equal(ownerPreviewFullAccess(owner,{...valid,PRESCORE_BASE_URL:'https://prescore.ru/checkout'}),false);
});
