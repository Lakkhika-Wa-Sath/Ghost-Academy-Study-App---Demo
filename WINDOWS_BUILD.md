# How to Install Ghost Plan as a Windows Executable (`.exe`)

Ghost Plan is built with **Rust + Tauri v2** and stores your 9-month study logs, deadlines, and custom themes in a local SQLite database (`%APPDATA%\io.github.ghostacademy.ghostplan\ghost_plan.db`).

Because this AI Studio workspace runs inside a Linux web sandbox, `.exe` binaries cannot be compiled directly here. You can turn this project into a native Windows `.exe` installer in two ways:

---

## Option 1: Zero Local Setup (GitHub Actions Cloud Build)

If you don't want to install Rust or Visual Studio Build Tools on your PC:

1. Download/export this project folder (or push it to a free GitHub repository).
2. Open your repository on GitHub and click the **Actions** tab.
3. Select **Build Windows Executable** and click **Run workflow**.
4. Once finished (~4–6 minutes), download **Ghost-Plan-Windows-Installer** from the workflow Artifacts:
   - `Ghost Plan_1.0.0_x64-setup.exe` (standard Windows installer)
   - `Ghost Plan_1.0.0_x64_en-US.msi`
   - `ghost-plan.exe` (standalone executable)
5. Double-click `Ghost Plan_1.0.0_x64-setup.exe` to install Ghost Plan to your Start Menu and Desktop.

---

## Option 2: Compile Directly on Your Windows 10 / 11 PC

### One-Time Prerequisites
1. **Node.js** (v18+): https://nodejs.org/
2. **Rust (`rustup-init.exe`)**: https://rustup.rs/
3. **Microsoft C++ Build Tools**: https://visualstudio.microsoft.com/visual-cpp-build-tools/ (select **Desktop development with C++** during install)
4. **WebView2 Runtime**: Pre-installed on Windows 11 and modern Windows 10.

### Build & Install Commands
Open PowerShell or Command Prompt inside the exported project folder:

```powershell
npm install
npm run tauri build
```

When complete, run the generated Windows installer at:
- `src-tauri\target\release\bundle\nsis\Ghost Plan_1.0.0_x64-setup.exe`

To test locally in development mode without waiting for an installer:
```powershell
npm run tauri dev
```

---

## Connecting Pear Desktop (YouTube Music FOSS)

1. Open **Pear Desktop** on Windows.
2. Go to **Plugins** -> enable **API Server**.
3. Under **API Server** settings, set **Authorization strategy** to **No authorization** (or keep token auth enabled and click **Authorize** inside Ghost Plan).
4. In Ghost Plan -> **Timer & Stopwatch**, click **Enable Link** in the **Pear Desktop** panel to view the playing track, control playback, and auto-pause music when a focus block ends.
