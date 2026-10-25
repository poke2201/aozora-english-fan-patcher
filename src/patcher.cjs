'use strict';
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const crypto=require('node:crypto');
const cp=require('node:child_process');
const asar=require('@electron/asar');
const args=process.argv.slice(2);
const mode=args[0];
const gameInput=args[1];
const assert=(v,s)=>{if(!v)throw Error(s)};
const sha=(p)=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const fileExists=p=>fs.existsSync(p)&&fs.statSync(p).isFile();
function resourcesFrom(input){
 assert(input,'Pass the game folder or resources folder');
 const full=path.resolve(input.replace(/^"|"$/g,''));
 for(const candidate of [full,path.join(full,'resources')])if(fileExists(path.join(candidate,'app.asar')))return candidate;
 throw Error('Could not find resources\\app.asar in selected folder');
}
function runningGame(resources){
 if(process.platform!=='win32') return false;
 const root=path.resolve(resources,'..').toLowerCase()+path.sep;
 const escaped=root.replace(/'/g,"''");
 const script=`$r='${escaped}'; $found=@(Get-CimInstance Win32_Process -ErrorAction Stop | Where-Object {$_.ExecutablePath -and $_.ExecutablePath.ToLowerInvariant().StartsWith($r)}); if($found.Count){$found|Select-Object -ExpandProperty Name;exit 2}`;
 const p=cp.spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{encoding:'utf8'});
 if(p.error||p.status===null||![0,2].includes(p.status))throw Error('Cannot verify the game is closed. Close it and retry');
 if(p.status===2)throw Error('Game is running. Close it first: '+p.stdout.trim());
}
function manifest(){const p=path.join(__dirname,'..','manifests','aozora_patch_manifest.json');return JSON.parse(fs.readFileSync(p,'utf8'))}
async function install(resources){
 const target=path.join(resources,'app.asar'), backup=path.join(resources,'app.asar.before_aozora_ui_patch');
 const tmpPrefix=fs.mkdtempSync(path.join(os.tmpdir(),'aozora-patch-'));
 const extracted=path.join(tmpPrefix,'extracted_app'), staging=path.join(tmpPrefix,'staging');
 const candidate=path.join(resources,`app.asar.aozora-candidate-${process.pid}`);
 const state=path.join(resources,'aozora_patch_state.json');
 try{
  runningGame(resources);
  assert(!fs.existsSync(path.join(resources,'app.asar.unpacked')),'This build has app.asar.unpacked; installer refuses to modify it until unpacked asset support is verified');
  assert(!fs.existsSync(candidate),'Candidate file already exists');
  const m=manifest();assert(m.schema===1&&m.sourceSha256,'Invalid manifest');
  if(fileExists(state)){
   const last=JSON.parse(fs.readFileSync(state,'utf8'));
   if(last.patchedSha256===sha(target)){console.log('Patch is already installed. Use Restore_Original.bat before reinstalling.');return;}
   throw Error('Existing patch state does not match app.asar; manual game update or modification detected. Refusing to overwrite');
  }
  assert(!fileExists(backup),'An existing backup was found without patch state. Restore or archive it manually before proceeding');
  console.log('Extracting original game archive...');
  asar.extractAll(target,extracted);
  for(const relative of Object.keys(m.sourceSha256)){
   const f=path.join(extracted,...relative.split('/'));
   assert(fileExists(f),'Missing game bundle: '+relative);
  }
  console.log('Applying translation manifest...');
  const build=cp.spawnSync(process.execPath,[path.join(__dirname,'build_aozora_patch_v2.cjs'),path.join(__dirname,'..','manifests','aozora_patch_manifest.json'),'staging'],{cwd:extracted,stdio:'inherit'});
  assert(!build.error&&build.status===0,'Translation builder failed (original game unchanged)');
  console.log('Packing candidate...');
  await asar.createPackage(staging,candidate);
  assert(fileExists(candidate)&&asar.listPackage(candidate).some(v=>v.replaceAll('\\','/').replace(/^\//,'')==='package.json'),'Candidate archive verification failed');
  // Back up only AFTER the candidate has passed all validation.
  fs.copyFileSync(target,backup,fs.constants.COPYFILE_EXCL);
  assert(sha(backup)===sha(target),'Backup verification failed');
  const info={schema:1,originalSha256:sha(target),patchedSha256:sha(candidate),manifestSha256:sha(path.join(__dirname,'..','manifests','aozora_patch_manifest.json')),installedAt:new Date().toISOString()};
  runningGame(resources);
  // Windows rename will not replace an existing file: move active aside, then move candidate in;
  // rollback if the second rename fails.
  const displaced=path.join(resources,`app.asar.aozora-displaced-${process.pid}`);
  fs.renameSync(target,displaced);
  try{fs.renameSync(candidate,target)}catch(err){fs.renameSync(displaced,target);throw err}
  try{fs.writeFileSync(state,JSON.stringify(info,null,2),'utf8')}catch(err){
   // Restore the active archive if bookkeeping fails.
   fs.renameSync(target,candidate);fs.renameSync(displaced,target);throw err;
  }
  fs.rmSync(displaced,{force:true});
  console.log('Installed successfully. Backup:',backup);
 }finally{fs.rmSync(candidate,{force:true});fs.rmSync(tmpPrefix,{recursive:true,force:true})}
}
function restore(resources){
 const target=path.join(resources,'app.asar'),backup=path.join(resources,'app.asar.before_aozora_ui_patch');
 const state=path.join(resources,'aozora_patch_state.json');
 runningGame(resources);
 assert(fileExists(backup),'No patch backup found');
 if(fileExists(state)){
  const s=JSON.parse(fs.readFileSync(state,'utf8'));
  assert(sha(backup)===s.originalSha256,'Backup checksum does not match patch state');
  assert(sha(target)===s.patchedSha256,'Current game differs from installed patch; refusing to overwrite potentially updated files');
 } else throw Error('Patch state missing; automatic restore refused to avoid overwriting unknown game version');
 const candidate=path.join(resources,`app.asar.restore-${process.pid}`);
 const displaced=path.join(resources,`app.asar.pre-restore-${process.pid}`);
 try{
  fs.copyFileSync(backup,candidate,fs.constants.COPYFILE_EXCL);
  assert(sha(candidate)===sha(backup),'Restore candidate checksum mismatch');
  fs.renameSync(target,displaced);
  try{fs.renameSync(candidate,target)}catch(e){fs.renameSync(displaced,target);throw e}
  fs.rmSync(state,{force:true});fs.rmSync(displaced,{force:true});
  console.log('Original game restored. Backup retained.');
 }finally{fs.rmSync(candidate,{force:true})}
}
(async()=>{
 try{
  assert(['install','restore'].includes(mode),'Usage: patcher.cjs install|restore GAME_FOLDER');
  const resources=resourcesFrom(gameInput);
  console.log('Game resources:',resources);
  if(mode==='install')await install(resources);else restore(resources);
 }catch(e){console.error('ERROR:',e.message);process.exitCode=1}
})();
