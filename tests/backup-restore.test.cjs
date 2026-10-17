'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { restore, install, sha } = require('../src/patcher.cjs');

function fakeInstall(t) {
  const game = fs.mkdtempSync(path.join(os.tmpdir(), 'aozora-restore-'));
  t.after(() => fs.rmSync(game, { recursive: true, force: true }));
  const resources = path.join(game, 'resources');
  fs.mkdirSync(resources);
  const original = path.join(resources, 'app.asar.before_aozora_ui_patch');
  const active = path.join(resources, 'app.asar');
  const state = path.join(resources, 'aozora_patch_state.json');
  fs.writeFileSync(original, 'original');
  fs.writeFileSync(active, 'translated');
  fs.writeFileSync(state, JSON.stringify({schema: 1, originalSha256: sha(original), patchedSha256: sha(active)}));
  return {resources, original, active, state};
}

test('restoration returns original bytes, preserves backup, and clears state', t => {
  const f = fakeInstall(t);
  restore(f.resources);
  assert.equal(fs.readFileSync(f.active, 'utf8'), 'original');
  assert.equal(fs.readFileSync(f.original, 'utf8'), 'original');
  assert.equal(fs.existsSync(f.state), false);
});

test('restoration refuses altered backup without changing active installation', t => {
  const f = fakeInstall(t);
  fs.writeFileSync(f.original, 'tampered');
  assert.throws(() => restore(f.resources), /Backup checksum/);
  assert.equal(fs.readFileSync(f.active, 'utf8'), 'translated');
  assert.equal(fs.existsSync(f.state), true);
});

test('restoration refuses overwritten/updated active archive', t => {
  const f = fakeInstall(t);
  fs.writeFileSync(f.active, 'updated');
  assert.throws(() => restore(f.resources), /Current game differs/);
  assert.equal(fs.readFileSync(f.active, 'utf8'), 'updated');
});

test('reinstallation of already patched archive is a no-op', async t => {
  const f = fakeInstall(t);
  await install(f.resources, {});
  assert.equal(fs.readFileSync(f.active, 'utf8'), 'translated');
  assert.equal(fs.readFileSync(f.original, 'utf8'), 'original');
});
