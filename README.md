# Aozora Refrain English fan patcher

Unofficial community English localization because the original localization is half-baked and I got bored. **Not affiliated with the game developer (THANK GOD).** For legal reasons, this requires a legally obtained copy of the game. This project does not distribute the game or modified game archives.

## INSTRUCTIONS

1. Download `Install_English_Patch.bat` from the repository.
2. Place it in the **game installation folder**, next to the `resources` directory. The folder must contain `resources\app.asar`.
3. Double-click the BAT. It checks for `resources\app.asar`, downloads the latest release package, backs up the original archive, and patches it locally.
4. To undo, place `Restore_Original.bat` in the **same game folder** and double-click it.

Do not put the BAT inside `resources`; it belongs in its parent game folder. No folder prompt or command-line argument is needed.

**Compatibility:** The translation manifest currently targets a specific build I have locally, and I'll get to making it more flexible. Close the game before installing/restoring.

## Maintainers

If you want to maintain this, you're crazy. For now, I'll solo maintain this until I go crazy.
