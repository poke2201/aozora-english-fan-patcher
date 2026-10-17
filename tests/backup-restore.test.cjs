'use strict';
const test=require('node:test');
const {fixture,patchedFixture,asarStub,run,failed,fs,assert}=require('./test-helpers.cjs');

test('restore returns original bytes, keeps backup, and removes patch state',t=>{
 const f=patchedFixture(t),stubDir=asarStub(t);
 const result=run(f,'restore',{stubDir});assert.equal(result.code,0,result.output);
 assert.equal(fs.readFileSync(f.target,'utf8'),'original game');
 assert.equal(fs.readFileSync(f.backup,'utf8'),'original game');
 assert.equal(fs.existsSync(f.state),false);
});

test('restore rejects an altered backup and leaves the active game untouched',t=>{
 const f=patchedFixture(t),stubDir=asarStub(t);fs.writeFileSync(f.backup,'tampered');
 failed(run(f,'restore',{stubDir}),/Backup checksum/);
 assert.equal(fs.readFileSync(f.target,'utf8'),'patched game');
 assert.equal(fs.existsSync(f.state),true);
});

test('restore rejects a changed active game without overwriting it',t=>{
 const f=patchedFixture(t),stubDir=asarStub(t);fs.writeFileSync(f.target,'updated');
 failed(run(f,'restore',{stubDir}),/Current game differs/);
 assert.equal(fs.readFileSync(f.target,'utf8'),'updated');
});

test('install is a no-op if matching patch state already exists',t=>{
 const f=patchedFixture(t),stubDir=asarStub(t);
 const result=run(f,'install',{stubDir});assert.equal(result.code,0,result.output);
 assert.match(result.output,/already installed/);
 assert.equal(fs.readFileSync(f.target,'utf8'),'patched game');
 assert.equal(fs.readFileSync(f.backup,'utf8'),'original game');
});
