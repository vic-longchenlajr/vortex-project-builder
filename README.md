# Victaulic Vortex™ Project Configurator

The **Victaulic Vortex Project Configurator** is a next-generation desktop and web application for designing, validating, and estimating **Victaulic Vortex™ hybrid fire suppression systems**.  
It provides engineers, estimators, and project managers with a fast and reliable way to configure both **engineered** and **pre-engineered** systems, verify design rules, calculate nitrogen and water requirements, and generate a complete **Excel Bill of Materials** for review or ordering.

---

## 🧩 Features

### Universal

- Modern React + TypeScript architecture
- Organized **Project → System → Zone → Enclosure** hierarchy
- **Real-time validation** of project data and system design
- Export and import full projects as **versioned JSON snapshots**
- Generate complete **Excel BOM workbooks** (system summary, parts, warnings, and monitor points)
- **Live pricing integration** with Victaulic price lists
- **Autosave and restore** project state automatically
- Available as an **Electron desktop application** (offline capable)

### Engineered Systems

- Unified calculation engine for NFPA 770 and FM methods
- Automatic discharge, oxygen level, and water tank calculations
- Enclosure grouping by nitrogen source
- Validation for tank certification, panel sizing, and method compatibility
- Configurable emitter and cylinder overrides
- Expanded BOM logic for FM Data Centers, Turbines, and Machine Spaces

### Pre-Engineered Systems

- Simplified workflow for packaged system configurations
- Automatic zone and enclosure creation
- Dimension-based volume calculation
- Built-in nozzle, spacing, and opening guidance
- Single-view results summary for emitters, cylinders, discharge time, and O₂

---

## ⚙️ Technology Stack

- **Frontend:** React + Next.js (TypeScript)
- **Desktop Runtime:** Electron
- **Styling:** CSS
- **File I/O:** Electron File Bridge + FileSaver
- **Excel Generation:** ExcelJS
- **Data Storage:** Local autosave + JSON project snapshots

---

## 💻 Installation Instructions

### Windows Desktop Installer

1. **Unzip** the attached installation package and open the extracted folder.
2. **Double-click:**  
   `Victaulic-Vortex-Project-Configurator-Setup-v2.x.x.exe`
   > The installation may take **15–30 seconds with no progress bar** — this is normal.
3. Installation is complete when the **green installer window closes automatically.**  
   The app will launch right after installation.
4. **Pin the app to your taskbar:**

- Right-click the icon while it’s open
- Select **“Pin to Taskbar”**

### Finding the Installed Application Folder

If you need to locate where the app was installed:

1. Press **Windows Key + R** to open the **Run** command.
2. Paste in the following path and press **Enter:**  
   `%LocalAppData%\VictaulicVortexProjectConfigurator`

---

## 📦 Output Files

- **Excel Workbook (.xlsx)** – System summary, zone data, and itemized BOM
- **JSON Project File (.json)** – Versioned project snapshot for re-import or sharing

---

## 🧭 Repository Information

**Repository Name:** `victaulic-vortex-project-configurator`  
**Version:** 2.0.0  
**License:** Internal Use – Victaulic Fire Suppression Technology  
**Maintainer:** Fire Suppression Engineering – Easton, PA

---

© 2025 Victaulic Company. All Rights Reserved.
