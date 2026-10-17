'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifests','aozora_patch_manifest.json'),'utf8'));
assert.equal(manifest.schema,1);
assert.ok(manifest.panels.length&&manifest.exactEdits.length&&manifest.dictionaryEdits.length);
for(const name of ['src/patcher.cjs','src/build_aozora_patch_v2.cjs']){
 const source=fs.readFileSync(path.join(root,name),'utf8');
 new (require('node:vm').Script)(source,{filename:name});
}
console.log('Smoke checks passed. Real game installation still requires Windows end-to-end testing.');
