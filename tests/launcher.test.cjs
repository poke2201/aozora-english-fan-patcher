'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');

for (const name of ['Install_English_Patch.bat', 'Restore_Original.bat']) {
  test(`${name} uses its own directory and refuses missing resources/app.asar`, () => {
    const source = fs.readFileSync(path.join(root, name), 'utf8');
    assert.match(source, /set "GAME_DIR=%~dp0"/i);
    assert.match(source, /if not exist "%GAME_DIR%resources"/i);
    assert.match(source, /exit \/b 1/i);
    assert.match(source, /curl\.exe -fLsS --retry 3/i);
    assert.match(source, /releases\/latest\/download\/Aozora-Patcher-Windows\.zip/i);
    assert.match(source, /if not exist "%PKG%\\runtime\\node\.exe" goto :fail/i);
    assert.match(source, /if not exist "%PKG%\\src\\patcher\.cjs" goto :fail/i);
    assert.match(source, /if errorlevel 1 goto :fail/i);
    assert.match(source, /rmdir \/S \/Q "%PKG%"/i);
    assert.doesNotMatch(source, /npm\s+(install|ci)|npx\s+/i);
  });
}

test('install and restore launchers call their matching patcher operations', () => {
  const install = fs.readFileSync(path.join(root, 'Install_English_Patch.bat'), 'utf8');
  const restore = fs.readFileSync(path.join(root, 'Restore_Original.bat'), 'utf8');
  assert.match(install, /patcher\.cjs" install "%GAME_DIR%"/i);
  assert.match(restore, /patcher\.cjs" restore "%GAME_DIR%"/i);
});
