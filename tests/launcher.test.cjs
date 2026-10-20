'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
for (const [name, command] of [['Install_English_Patch.bat', 'install'], ['Restore_Original.bat', 'restore']]) {
  test(`${name} bootstraps pinned Node and invokes ${command} safely`, () => {
    const bat = fs.readFileSync(path.join(root, name), 'utf8');
    assert.match(bat, /set "GAME_DIR=%~dp0"/i);
    assert.match(bat, /if not exist "%GAME_DIR%resources\\app\.asar"/i);
    assert.match(bat, /nodejs\.org\/dist\/v24\.13\.1\/win-x64\/node\.exe/i);
    assert.match(bat, /NODE_SHA256=e3be0545990c90995d7bf3a7af5d64af1f2e0fc1bbd9b79c27f7abc1e9676e50/i);
    assert.match(bat, /Get-FileHash.*SHA256/i);
    assert.match(bat, /raw\.githubusercontent\.com\/poke2201\/aozora-english-fan-patcher\/main\/downloads\/Aozora-Patcher-Payload\.zip/i);
    assert.match(bat, /curl\.exe -fLsS --retry 3/i);
    assert.match(bat, /if errorlevel 1 goto :fail/i);
    assert.match(bat, new RegExp(`patcher\\.cjs" ${command} "%GAME_DIR%"`, 'i'));
    assert.match(bat, /rmdir \/S \/Q "%PKG%"/i);
    assert.doesNotMatch(bat, /npm\s+(install|ci)|npx\s+/i);
    assert.doesNotMatch(bat, /releases\/latest\/download\/Aozora-Patcher-Windows\.zip/i);
  });
}
