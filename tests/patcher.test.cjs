'use strict';
const test=require('node:test');
const {fixture,patchedFixture,asarStub,run,failed,fs,path,assert,root}=require('./test-helpers.cjs');

test('CLI accepts game folder or resources folder and reports the resolved path',t=>{
 const f=fixture(t);const stubDir=asarStub(t);
 for(const gameInput of [f.game,f.resources]) {
   const result=run(f,'install',{stubDir,gameInput});
   failed(result,/cast_gender_switch start marker: expected exactly 1 match, found 0/);
   assert.ok(
  result.output.includes(`Game resources: ${f.resources}`),
  'Patcher should report the resolved resources directory'
);
 }
 assert.equal(fs.existsSync(f.backup),false);
});

test('CLI rejects missing app.asar before making changes',t=>{
 const f=fixture(t);const stubDir=asarStub(t);fs.rmSync(f.target);
 failed(run(f,'install',{stubDir}),/Could not find resources/);
 assert.equal(fs.existsSync(f.backup),false);
});

test('restore requires a backup',t=>{
 const f=fixture(t);const stubDir=asarStub(t);
 failed(run(f,'restore',{stubDir}),/No patch backup/);
 assert.equal(fs.readFileSync(f.target,'utf8'),'original game');
});

test('restore refuses backup without patch state',t=>{
 const f=fixture(t);const stubDir=asarStub(t);fs.writeFileSync(f.backup,'original game');
 failed(run(f,'restore',{stubDir}),/Patch state missing/);
 assert.equal(fs.readFileSync(f.target,'utf8'),'original game');
 assert.equal(fs.readFileSync(f.backup,'utf8'),'original game');
});

test('restore rejects a tampered backup without modifying the active archive',t=>{
 const f=patchedFixture(t);const stubDir=asarStub(t);fs.writeFileSync(f.backup,'tampered');
 failed(run(f,'restore',{stubDir}),/Backup checksum/);
 assert.equal(fs.readFileSync(f.target,'utf8'),'patched game');
 assert.equal(fs.existsSync(f.state),true);
});

test('restore rejects modified active game without overwriting it',t=>{
 const f=patchedFixture(t);const stubDir=asarStub(t);fs.writeFileSync(f.target,'updated game');
 failed(run(f,'restore',{stubDir}),/Current game differs/);
 assert.equal(fs.readFileSync(f.target,'utf8'),'updated game');
});

test('restore succeeds and retains verified backup',t=>{
 const f=patchedFixture(t);const stubDir=asarStub(t);
 const result=run(f,'restore',{stubDir});
 assert.equal(result.code,0,result.output);
 assert.equal(fs.readFileSync(f.target,'utf8'),'original game');
 assert.equal(fs.readFileSync(f.backup,'utf8'),'original game');
 assert.equal(fs.existsSync(f.state),false);
});

test('install refuses unpacked archive directory',t=>{
 const f=fixture(t);const stubDir=asarStub(t);fs.mkdirSync(path.join(f.resources,'app.asar.unpacked'));
 failed(run(f,'install',{stubDir}),/app.asar.unpacked/);
 assert.equal(fs.readFileSync(f.target,'utf8'),'original game');
 assert.equal(fs.existsSync(f.backup),false);
});

test('install rejects stale backup without state',t=>{
 const f=fixture(t);const stubDir=asarStub(t);fs.writeFileSync(f.backup,'prior backup');
 failed(run(f,'install',{stubDir}),/existing backup/);
 assert.equal(fs.readFileSync(f.target,'utf8'),'original game');
 assert.equal(fs.readFileSync(f.backup,'utf8'),'prior backup');
});

test('install reports already-patched state without modifying files',t=>{
 const f=patchedFixture(t);const stubDir=asarStub(t);
 const result=run(f,'install',{stubDir});assert.equal(result.code,0,result.output);
 assert.match(result.output,/already installed/);
 assert.equal(fs.readFileSync(f.target,'utf8'),'patched game');
});

test('install refuses mismatched prior patch state',t=>{
 const f=patchedFixture(t);const stubDir=asarStub(t);fs.writeFileSync(f.target,'new version');
 failed(run(f,'install',{stubDir}),/Existing patch state does not match/);
 assert.equal(fs.readFileSync(f.target,'utf8'),'new version');
});

test('install rejects missing translation markers without making a backup',t=>{
 const f=fixture(t);const stubDir=asarStub(t);
 failed(run(f,'install',{stubDir}),/cast_gender_switch start marker: expected exactly 1 match, found 0/);
 assert.equal(fs.readFileSync(f.target,'utf8'),'original game');
 assert.equal(fs.existsSync(f.backup),false);
});

test('BAT launchers use their own directory and check resources',()=>{
 for(const name of ['Install_English_Patch.bat','Restore_Original.bat']) {
  const content=fs.readFileSync(path.join(root,name),'utf8');
  assert.match(content,/set "GAME_DIR=%~dp0"/i);
  assert.match(content,/if not exist "%GAME_DIR%resources(?:\\app\.asar)?"/i);
assert.match(content,/raw\.githubusercontent\.com\/poke2201\/aozora-english-fan-patcher\/main\/downloads\/Aozora-Patcher-Payload\.zip/i);
}
});
