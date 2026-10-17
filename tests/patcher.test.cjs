'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const crypto=require('node:crypto');
const patcher=require('../src/patcher.cjs');
const root=path.resolve(__dirname,'..');
const digest=x=>crypto.createHash('sha256').update(x).digest('hex');
function fixture(t,archive='original game'){
 const game=fs.mkdtempSync(path.join(os.tmpdir(),'aozora-test-'));
 const resources=path.join(game,'resources');fs.mkdirSync(resources);
 fs.writeFileSync(path.join(resources,'app.asar'),archive);
 t.after(()=>fs.rmSync(game,{recursive:true,force:true}));
 return {game,resources,archive:Buffer.from(archive),target:path.join(resources,'app.asar'),backup:path.join(resources,'app.asar.before_aozora_ui_patch'),state:path.join(resources,'aozora_patch_state.json')};
}
function state(f,patched='patched game',original='original game'){
 fs.writeFileSync(f.backup,original);fs.writeFileSync(f.target,patched);
 fs.writeFileSync(f.state,JSON.stringify({schema:1,originalSha256:digest(original),patchedSha256:digest(patched)}));
}
test('finds resources/app.asar when given game directory or resources directory',t=>{
 const f=fixture(t);
 assert.equal(patcher.resourcesFrom(f.game),f.resources);
 assert.equal(patcher.resourcesFrom(f.resources),f.resources);
});
test('rejects missing game folder and does not create anything',t=>{
 const f=fixture(t);fs.rmSync(f.target);
 assert.throws(()=>patcher.resourcesFrom(f.game),/Could not find/);
 assert.equal(fs.existsSync(f.backup),false);
});
test('restore requires an existing backup',t=>{
 const f=fixture(t);
 assert.throws(()=>patcher.restore(f.resources),/No patch backup/);
 assert.deepEqual(fs.readFileSync(f.target),f.archive);
});
test('restore rejects missing state and retains both archives',t=>{
 const f=fixture(t);fs.writeFileSync(f.backup,'backup');
 assert.throws(()=>patcher.restore(f.resources),/Patch state missing/);
 assert.equal(fs.readFileSync(f.target,'utf8'),'original game');
 assert.equal(fs.readFileSync(f.backup,'utf8'),'backup');
});
test('restore rejects tampered backup',t=>{
 const f=fixture(t);state(f);fs.writeFileSync(f.backup,'tampered');
 assert.throws(()=>patcher.restore(f.resources),/Backup checksum/);
 assert.equal(fs.readFileSync(f.target,'utf8'),'patched game');
});
test('restore refuses to overwrite a game updated after patching',t=>{
 const f=fixture(t);state(f);fs.writeFileSync(f.target,'updated game');
 assert.throws(()=>patcher.restore(f.resources),/Current game differs/);
 assert.equal(fs.readFileSync(f.target,'utf8'),'updated game');
});
test('restore succeeds and retains verified backup',t=>{
 const f=fixture(t);state(f);
 patcher.restore(f.resources);
 assert.equal(fs.readFileSync(f.target,'utf8'),'original game');
 assert.equal(fs.readFileSync(f.backup,'utf8'),'original game');
 assert.equal(fs.existsSync(f.state),false);
});
test('install rejects unpacked directory before touching the archive',async t=>{
 const f=fixture(t);fs.mkdirSync(path.join(f.resources,'app.asar.unpacked'));
 await assert.rejects(patcher.install(f.resources,{}),/app.asar.unpacked/);
 assert.deepEqual(fs.readFileSync(f.target),f.archive);
 assert.equal(fs.existsSync(f.backup),false);
});
test('install refuses stale backup without state',async t=>{
 const f=fixture(t);fs.writeFileSync(f.backup,'prior');
 await assert.rejects(patcher.install(f.resources,{}),/existing backup/);
 assert.deepEqual(fs.readFileSync(f.target),f.archive);
 assert.equal(fs.readFileSync(f.backup,'utf8'),'prior');
});
test('install is idempotent when patch state matches',async t=>{
 const f=fixture(t);state(f);
 await patcher.install(f.resources,{});
 assert.equal(fs.readFileSync(f.target,'utf8'),'patched game');
});
test('install refuses mismatched state after an update',async t=>{
 const f=fixture(t);state(f);fs.writeFileSync(f.target,'new game');
 await assert.rejects(patcher.install(f.resources,{}),/Existing patch state does not match/);
 assert.equal(fs.readFileSync(f.target,'utf8'),'new game');
});
test('install rejects unsupported source hash without writing a backup',async t=>{
 const f=fixture(t);
 const fakeAsar={extractAll(_target,dir){
   const folder=path.join(dir,'dist','assets');fs.mkdirSync(folder,{recursive:true});
   fs.writeFileSync(path.join(folder,'main-DVhgjb_W.js'),'incompatible version');
 }};
 await assert.rejects(patcher.install(f.resources,fakeAsar),/Unsupported game version/);
 assert.deepEqual(fs.readFileSync(f.target),f.archive);
 assert.equal(fs.existsSync(f.backup),false);
});
test('manifest schema, unique IDs, expected counts and protected relative paths',()=>{
 const m=patcher.manifest();assert.equal(m.schema,1);
 assert.ok(m.panels.length>0 && m.exactEdits.length>0 && m.dictionaryEdits.length>0);
 const ids=new Set();
 for(const group of [...m.panels,...m.exactEdits,...m.dictionaryEdits]){
  assert.ok(group.id && !ids.has(group.id),'duplicate or missing group ID: '+group.id);ids.add(group.id);
  assert.match(group.bundle,/^dist\/assets\/[\w.-]+\.js$/);
  if(group.entries) for(const item of group.entries){assert.ok(item.ja && item.en);assert.ok(Number.isInteger(item.expectedOccurrences)&&item.expectedOccurrences>0)}
  if(group.replacements) for(const item of group.replacements){assert.ok(item.from && item.to);assert.ok(Number.isInteger(item.expectedOccurrences)&&item.expectedOccurrences>0)}
 }
 for(const [file,hash] of Object.entries(m.sourceSha256)){
  assert.match(file,/^dist\/assets\/[\w.-]+\.js$/);
  assert.match(hash,/^[a-f0-9]{64}$/);
 }
});
test('both BAT launchers require resources/app.asar beside themselves',()=>{
 for(const name of ['Install_English_Patch.bat','Restore_Original.bat']){
  const s=fs.readFileSync(path.join(root,name),'utf8');
  assert.match(s,/set "GAME_DIR=%~dp0"/i);
  assert.match(s,/if not exist "%GAME_DIR%resources\\app\.asar"/i);
  assert.match(s,/releases\/latest\/download\/Aozora-Patcher-Windows\.zip/i);
 }
});
