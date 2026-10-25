'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const crypto=require('node:crypto');
const cp=require('node:child_process');
const builder=path.join(__dirname,'..','src','build_aozora_patch_v2.cjs');
const main='dist/assets/main-DVhgjb_W.js',index='dist/assets/index-TmdlfamN.js';
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
function fixture(t){
 const base=fs.mkdtempSync(path.join(os.tmpdir(),'aozora-builder-'));
 t.after(()=>fs.rmSync(base,{recursive:true,force:true}));
 const source=path.join(base,'extracted_app');fs.mkdirSync(path.join(source,'dist','assets'),{recursive:true});
 const files={[main]:'begin title:"日本語" end',[index]:'Cn={app:{};Sr={app:{};'};
 for(const [rel,content] of Object.entries(files))fs.writeFileSync(path.join(source,rel),content);
 const m={schema:1,sourceSha256:Object.fromEntries(Object.entries(files).map(([k,v])=>[k,sha(v)])),panels:[{id:'sample',bundle:main,start:'begin',end:' end',maxLength:100,entries:[{id:'label',key:'test.label',ja:'日本語',en:'English',expectedOccurrences:1}]}],dictionaryEdits:[]};
 const manifest=path.join(base,'manifest.json');
 const run=()=>cp.spawnSync(process.execPath,[builder,manifest,'stage'],{cwd:source,encoding:'utf8'});
 const save=()=>fs.writeFileSync(manifest,JSON.stringify(m));
 save();return {base,source,m,manifest,save,run,files,output:path.join(base,'stage')};
}
test('builder stages exact translation without changing original input',t=>{
 const f=fixture(t);const r=f.run();assert.equal(r.status,0,r.stderr);
 assert.deepEqual(fs.readFileSync(path.join(f.source,main),'utf8'),f.files[main]);
 assert.match(fs.readFileSync(path.join(f.output,main),'utf8'),/\$\("test.label","日本語"\)/);
 assert.match(fs.readFileSync(path.join(f.output,index),'utf8'),/"test.label":"English"/);
 assert.ok(fs.existsSync(path.join(f.output,'aozora_patch_build_report.json')));
});
test('builder permits source SHA mismatch when translation markers still match',t=>{
 const f=fixture(t);const changed='modified begin title:"日本語" end';
 fs.writeFileSync(path.join(f.source,main),changed);
 const r=f.run();assert.equal(r.status,0,r.stderr);
 assert.equal(fs.readFileSync(path.join(f.source,main),'utf8'),changed);
 assert.match(fs.readFileSync(path.join(f.output,main),'utf8'),/\$\("test.label","日本語"\)/);
});
test('builder rejects missing exact translation match without staging',t=>{
 const f=fixture(t);f.m.panels[0].entries[0].ja='別の文字列';f.save();
 const r=f.run();assert.notEqual(r.status,0);assert.match(r.stderr,/expected 1 occurrences, found 0/);
 assert.equal(fs.existsSync(f.output),false);
});
test('builder rejects repeated output directory and preserves prior staged patch',t=>{
 const f=fixture(t);assert.equal(f.run().status,0);
 const before=fs.readFileSync(path.join(f.output,main));
 const r=f.run();assert.notEqual(r.status,0);assert.match(r.stderr,/Output already exists/);
 assert.deepEqual(fs.readFileSync(path.join(f.output,main)),before);
});
test('builder rejects traversal in a manifest bundle path',t=>{
 const f=fixture(t);f.m.panels[0].bundle='../secret.js';f.save();
 const r=f.run();assert.notEqual(r.status,0);assert.match(r.stderr,/Unsafe\/invalid bundle path/);
 assert.equal(fs.existsSync(f.output),false);
});
