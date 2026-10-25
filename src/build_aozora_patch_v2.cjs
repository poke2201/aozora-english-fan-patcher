'use strict';
// Rebuild a staged Electron app from CLEAN extracted_app + an explicit JSON manifest.
// No changes to app.asar or the source extraction. Uses built-in Node.js modules only.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = process.cwd();
const manifestPath = path.resolve(process.argv[2] || 'aozora_patch_manifest.json');
const outputName = process.argv[3] || 'aozora_ui_staging';
const source = root;
const resources = path.dirname(root);
const output = path.resolve(resources, outputName);
const isInside = (a,b) => b === a || b.startsWith(a + path.sep);
const assert = (ok,msg) => { if(!ok) throw Error(msg); };
const hash = v => crypto.createHash('sha256').update(v).digest('hex');
const count = (s,t) => s.split(t).length - 1;
const q = s => JSON.stringify(s);
function mustString(x,desc) {assert(typeof x === 'string' && x.length > 0,`${desc} must be nonempty string`);return x;}
function validRel(rel){mustString(rel,'bundle path');const normalized=rel.replace(/\\/g,'/');assert(!path.isAbsolute(rel) && !normalized.split('/').includes('..') && normalized.endsWith('.js'),'Unsafe/invalid bundle path: '+rel);return normalized;}
function requiredOne(hay,needle,desc) { const n=count(hay,needle);assert(n===1,`${desc}: expected exactly 1 match, found ${n}`);return hay.indexOf(needle); }
// Find a string property's VALUE in a bounded object, allowing quoted or unquoted simple names.
function changeDictionaryValue(segment,change){
  mustString(change.key,'dictionary key');mustString(change.from,'dictionary old value');
  assert(typeof change.to==='string','dictionary new value must be a string');
  // Only JSON-quoted or identifier keys. If a complex key is used, require quoted form.
  const keys=[q(change.key)+':'];
  if (/^[A-Za-z_$][\w$]*$/.test(change.key)) keys.push(change.key+':');
  const needles=keys.map(k=>k+q(change.from));
  const matches=needles.reduce((n,t)=>n+count(segment,t),0);
  assert(matches===1,`Dictionary key ${change.key}: expected one exact old value, found ${matches}`);
  const needle=needles.find(n=>segment.includes(n));
  return segment.replace(needle,needle.slice(0,-q(change.from).length)+q(change.to));
}
function copyAllowed(srcPath) {
  const name=path.basename(srcPath);
  if(name==='node_modules'||name==='localization_output'||name==='.git') return false;
  if(name.endsWith('.asar')||name.endsWith('.asar.unpacked')) return false;
  if(name==='aozora_patch_manifest.json'||name==='build_aozora_patch.cjs'||name.startsWith('prepare_aozora_')||name.startsWith('prepare_cast_')) return false;
  return true;
}
try {
  assert(path.basename(root)==='extracted_app', 'Open PowerShell inside the clean extracted_app folder before running this script.');
  assert(fs.existsSync(manifestPath),'Manifest not found: '+manifestPath);
  const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
  assert(manifest.schema===1,'Unsupported manifest schema (expected 1)');
  assert(Array.isArray(manifest.panels),'manifest.panels must be an array');
  assert(Array.isArray(manifest.dictionaryEdits),'manifest.dictionaryEdits must be an array');
  assert(!isInside(source,output) && !isInside(output,source),'Staging cannot be inside extracted_app or vice versa.');
  assert(!fs.existsSync(output),`Output already exists: ${output}. Rename/delete the prior staging directory before rebuilding.`);
  const mainRel='dist/assets/main-DVhgjb_W.js', indexRel='dist/assets/index-TmdlfamN.js';
  const files=new Map();
  function content(rel){rel=validRel(rel);if(!files.has(rel)){const full=path.join(source,rel);assert(isInside(source,full),'Bundle escaped extracted_app');assert(fs.existsSync(full),'Missing source bundle '+rel);const old=fs.readFileSync(full,'utf8');files.set(rel,{old,now:old});}return files.get(rel);}
  const audit=[];
  const pendingByLanguage = {ja:new Map(),en:new Map()};
  for (const panel of manifest.panels){
    mustString(panel.id,'panel.id');const rel=validRel(panel.bundle);const f=content(rel);
    mustString(panel.start,'panel.start');mustString(panel.end,'panel.end');
    const start=requiredOne(f.now,panel.start,`${panel.id} start marker`);
    const end=f.now.indexOf(panel.end,start+panel.start.length);
    assert(end>start && end-start<= (panel.maxLength||50000),`${panel.id}: end marker missing or region too large`);
    let block=f.now.slice(start,end);
    assert(Array.isArray(panel.entries) && panel.entries.length,`${panel.id}: no entries`);
    for(const e of panel.entries){
      mustString(e.id,`${panel.id} entry id`);mustString(e.ja,`${e.id} Japanese`);mustString(e.en,`${e.id} English`);
      const key=mustString(e.key || `settings.castPatch.${e.id}`,'entry key');
      const literal=q(e.ja), n=count(block,literal);
      assert(n===(e.expectedOccurrences??1),`${panel.id}/${e.id}: expected ${e.expectedOccurrences??1} occurrences, found ${n}`);
      assert(!pendingByLanguage.en.has(key),`Duplicate translation key: ${key}`);
      const expression=`$(${q(key)},${literal})`;
      block=block.split(literal).join(expression);
      pendingByLanguage.ja.set(key,e.ja);pendingByLanguage.en.set(key,e.en);
      audit.push({type:'localized_literal',panel:panel.id,key,occurrences:n});
    }
    f.now=f.now.slice(0,start)+block+f.now.slice(end);
  }
  // Additional scoped edits for dynamic UI labels (e.g. chart axis labels).
  // Each edit must match exactly the expected number of times inside a bounded region.
  for (const group of (manifest.exactEdits || [])) {
    mustString(group.id,'exactEdits.id');
    const rel=validRel(group.bundle), f=content(rel);
    mustString(group.start,group.id+' start');mustString(group.end,group.id+' end');
    const start=requiredOne(f.now,group.start,group.id+' start marker');
    const end=f.now.indexOf(group.end,start+group.start.length);
    assert(end>start && end-start <= (group.maxLength || 50000),group.id+': end marker not found or scope too large');
    let segment=f.now.slice(start,end);
    assert(Array.isArray(group.replacements) && group.replacements.length,group.id+': no replacements');
    for(const e of group.replacements) {
      mustString(e.from,group.id+' old code');mustString(e.to,group.id+' new code');
      const n=count(segment,e.from);
      assert(n===(e.expectedOccurrences ?? 1),group.id+': expected '+(e.expectedOccurrences??1)+' matches, found '+n+' for '+e.from.slice(0,55));
      segment=segment.split(e.from).join(e.to);
      audit.push({type:'scoped_code_edit',panel:group.id,occurrences:n});
    }
    f.now=f.now.slice(0,start)+segment+f.now.slice(end);
  }
  for(const e of (manifest.additionalTranslations || [])) {
    mustString(e.key,'additional translation key');mustString(e.ja,e.key+' Japanese');mustString(e.en,e.key+' English');
    assert(!pendingByLanguage.en.has(e.key),'Duplicate translation key: '+e.key);
    pendingByLanguage.ja.set(e.key,e.ja);
    pendingByLanguage.en.set(e.key,e.en);
  }
  const index=content(indexRel);
  // Dictionary injection uses exact stable registry anchors. New keys are added to each language registry,
  // where the existing translation lookup can find the quoted dotted keys.
  for (const [lang,registry] of [['ja','Cn={app:'],['en','Sr={app:']]){
    if(!pendingByLanguage[lang].size) continue;
    requiredOne(index.now,registry,lang+' registry');
    const payload=[...pendingByLanguage[lang]].map(([key,value])=>`${q(key)}:${q(value)}`).join(',');
    index.now=index.now.replace(registry,registry.slice(0,-4)+payload+',app:');
  }
  // Optional exact existing dictionary changes. Require bounded object markers and original expected string.
  for(const edit of manifest.dictionaryEdits){
    mustString(edit.id,'dictionary edit id');
    const rel=validRel(edit.bundle||indexRel), f=content(rel);
    mustString(edit.objectStart,'dictionary objectStart');mustString(edit.objectEnd,'dictionary objectEnd');
    const start=requiredOne(f.now,edit.objectStart,`${edit.id} object start`);
    const end=f.now.indexOf(edit.objectEnd,start+edit.objectStart.length);
    assert(end>start && end-start < (edit.maxLength||50000),`${edit.id} invalid dictionary boundary`);
    const before=f.now.slice(start,end);
    const after=changeDictionaryValue(before,edit);
    f.now=f.now.slice(0,start)+after+f.now.slice(end);
    audit.push({type:'dictionary_edit',id:edit.id,key:edit.key,occurrences:1});
  }
  assert(audit.length>0,'No modifications listed');
  // Copy first only after ALL validation passes. Remove the staging directory if an I/O error occurs.
  fs.cpSync(source,output,{recursive:true,filter:copyAllowed});
  for(const [rel,f] of files){
    if(f.now===f.old) continue;
    fs.writeFileSync(path.join(output,rel),f.now,'utf8');
    assert(hash(fs.readFileSync(path.join(source,rel)))===hash(f.old),`Original source unexpectedly changed: ${rel}`);
  }
  const report={manifest:path.basename(manifestPath),source:source,staging:output,changes:audit,files:[...files].map(([rel,f])=>({bundle:rel,originalSha256:hash(f.old),patchedSha256:hash(f.now),modified:f.now!==f.old}))};
  fs.writeFileSync(path.join(output,'aozora_patch_build_report.json'),JSON.stringify(report,null,2));
  console.log(`Success: ${audit.length} approved entries, ${audit.reduce((sum,r)=>sum+r.occurrences,0)} replacements`);
  for(const r of report.files) console.log(`${r.modified?'CHANGED':'UNCHANGED'} ${r.bundle}`);
  console.log('Staging:',output);
  console.log('Original extracted game and installed app.asar were NOT modified.');
  console.log(`NEXT (from resources): npx.cmd --yes @electron/asar pack ${path.basename(output)} app_ui_test.asar`);
}catch(err){console.error('Patch builder stopped:',err.message);process.exitCode=1;}
