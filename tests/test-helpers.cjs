'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const patcherScript = path.join(root, 'src', 'patcher.cjs');
const digest = data => crypto.createHash('sha256').update(data).digest('hex');

function fixture(t, contents = 'original game') {
  const game = fs.mkdtempSync(path.join(os.tmpdir(), 'aozora-cli-test-'));
  t.after(() => fs.rmSync(game, {recursive:true, force:true}));
  const resources = path.join(game, 'resources');
  fs.mkdirSync(resources);
  const target = path.join(resources, 'app.asar');
  const backup = path.join(resources, 'app.asar.before_aozora_ui_patch');
  const state = path.join(resources, 'aozora_patch_state.json');
  fs.writeFileSync(target, contents);
  return {game, resources, target, backup, state};
}
function patchedFixture(t) {
  const f=fixture(t);
  fs.writeFileSync(f.backup, 'original game');
  fs.writeFileSync(f.target, 'patched game');
  fs.writeFileSync(f.state, JSON.stringify({schema:1,originalSha256:digest('original game'),patchedSha256:digest('patched game')}));
  return f;
}
// A tiny stand-in for the Electron ASAR library. We are testing the patcher's CLI
// safety decisions here, not the third-party ASAR implementation.
function asarStub(t) {
  const base=fs.mkdtempSync(path.join(os.tmpdir(),'aozora-mock-modules-'));
  t.after(()=>fs.rmSync(base,{recursive:true,force:true}));
  const dir=path.join(base,'@electron','asar');
  fs.mkdirSync(dir,{recursive:true});
  fs.writeFileSync(path.join(dir,'index.js'), `
  const fs=require('node:fs'); const path=require('node:path');
  exports.extractAll=(_archive,out)=>{
    const assets=path.join(out,'dist','assets'); fs.mkdirSync(assets,{recursive:true});
    fs.writeFileSync(path.join(assets,'main-DVhgjb_W.js'),'incompatible version');
    fs.writeFileSync(path.join(assets,'index-TmdlfamN.js'),'incompatible version');
  };
  exports.createPackage=async()=>{throw Error('Mock archive must never be packaged')};
  exports.listPackage=()=>[];
  `);
  // Explicit preload takes precedence over node_modules resolution, including CI.
  fs.writeFileSync(path.join(base, 'preload.cjs'), `
    const Module = require('node:module');
    const originalLoad = Module._load;
    Module._load = function(request, parent, isMain) {
      if (request === '@electron/asar') {
        return originalLoad.call(this, require('node:path').join(${JSON.stringify(dir)}, 'index.js'), parent, isMain);
      }
      return originalLoad.call(this, request, parent, isMain);
    };
  `);
  return base;
}
function run(f, operation, options={}) {
  const base=options.stubDir;
  const result=spawnSync(process.execPath,[...(base?['--require',path.join(base,'preload.cjs')]:[]),patcherScript,operation,options.gameInput||f.game],{
    encoding:'utf8', timeout:15000,
    env:{...process.env,...(base?{NODE_PATH:[base,process.env.NODE_PATH].filter(Boolean).join(path.delimiter)}:{})}
  });
  assert.ifError(result.error);
  return {code:result.status, output:result.stdout+result.stderr};
}
function failed(result,pattern) {assert.notEqual(result.code,0,result.output);assert.match(result.output,pattern)}
module.exports={fixture,patchedFixture,asarStub,run,failed,digest,fs,path,assert,root};
