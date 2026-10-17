# Windows packaging (maintainer only)

On your maintainer Windows PC, install Node.js to prepare the release. This requirement does **not** apply to players.

1. `npm install`
2. `npm test`
3. Download the current Windows x64 Node.js distribution from https://nodejs.org/en/download and place its `node.exe` at `runtime/node.exe`.
4. Create a folder `release/` containing `src/`, `manifests/`, `node_modules/`, and `runtime/node.exe` (all at its root). Include only these paths.
5. ZIP **the contents of** `release/` into `Aozora-Patcher-Windows.zip`.
6. Verify this ZIP on a clean Windows system with a clean compatible game before uploading it as a GitHub Releases asset.
7. In every future GitHub release, use the same asset filename. The bootstrap BAT always follows `/releases/latest/download/Aozora-Patcher-Windows.zip`.

Do not upload `.asar`, extracted game files, or backups. A batch downloaded from the Internet may show SmartScreen warnings; do not encourage users to disable security protections. For a more robust production release, implement signed release verification and publish release hashes.
