'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'manifests', 'aozora_patch_manifest.json'), 'utf8'));

const safeBundle = /^dist\/assets\/[\w.-]+\.js$/;

test('manifest identifies a supported source build with SHA-256 fingerprints', () => {
  assert.equal(manifest.schema, 1);
  assert.ok(Object.keys(manifest.sourceSha256).length >= 2);
  for (const [file, hash] of Object.entries(manifest.sourceSha256)) {
    assert.match(file, safeBundle);
    assert.match(hash, /^[a-f0-9]{64}$/);
  }
});

test('patch operations have unique IDs and reference fingerprinted bundles', () => {
  const ids = new Set();
  for (const kind of ['panels', 'dictionaryEdits', 'exactEdits']) {
    assert.ok(Array.isArray(manifest[kind]));
    for (const item of manifest[kind]) {
      assert.ok(typeof item.id === 'string' && item.id);
      assert.ok(!ids.has(item.id), `duplicate operation ID: ${item.id}`);
      ids.add(item.id);
      assert.match(item.bundle, safeBundle);
      assert.ok(manifest.sourceSha256[item.bundle], `unfingerprinted bundle: ${item.bundle}`);
      assert.ok(typeof (item.start ?? item.objectStart) === 'string');
      assert.ok(typeof (item.end ?? item.objectEnd) === 'string');
      assert.ok(Number.isInteger(item.maxLength) && item.maxLength > 0);
    }
  }
  assert.ok(ids.size > 0);
});

test('translation keys are distinct and every literal has valid occurrence bounds', () => {
  const keys = new Set();
  for (const item of manifest.additionalTranslations || []) {
    assert.ok(item.key && typeof item.ja === 'string' && typeof item.en === 'string');
    assert.ok(!keys.has(item.key), `duplicate translation key: ${item.key}`);
    keys.add(item.key);
  }
  for (const panel of manifest.panels) {
    assert.ok(Array.isArray(panel.entries) && panel.entries.length);
    for (const entry of panel.entries) {
      assert.ok(entry.key && entry.ja && entry.en);
      assert.ok(!keys.has(entry.key), `duplicate translation key: ${entry.key}`);
      keys.add(entry.key);
      assert.ok(Number.isInteger(entry.expectedOccurrences) && entry.expectedOccurrences > 0);
    }
  }
  for (const block of manifest.exactEdits) {
    assert.ok(Array.isArray(block.replacements) && block.replacements.length);
    for (const edit of block.replacements) {
      assert.ok(typeof edit.from === 'string' && edit.from.length > 0);
      assert.ok(typeof edit.to === 'string');
      assert.ok(Number.isInteger(edit.expectedOccurrences) && edit.expectedOccurrences > 0);
    }
  }
});
