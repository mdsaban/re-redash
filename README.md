# Re-Redash Chrome Extension

A powerful Chrome extension that enhances your Redash experience with advanced features like notebook-style query editing, intelligent SQL completions, and table column visibility controls.

## 🚀 Installation

### Method 1: Git Clone (Recommended)

```bash
git clone <repository-url>
cd re-redash
```

### Method 2: Download ZIP

1. Download the extension as a ZIP file from the repository
2. Extract the ZIP file to a folder on your computer

### Loading the Extension in Chrome

1. Open Chrome browser
2. Navigate to `chrome://extensions/`
3. Enable **Developer mode** (toggle in the top-right corner)
4. Click **"Load unpacked"** button
5. Select the folder containing the extension files
6. The Re-Redash extension should now appear in your extensions list

### Usage

1. Navigate to your Redash instance at `https://redash-platform.blinkit.in/*`
2. Reload the page to activate the extension
3. The extension will automatically inject its features into the Redash interface

## 🔒 Privacy & Security

**This extension does not read, store, or transmit any of your data.** All functionality operates locally in your browser:

## ✨ Features

### 1. 📝 Notebook Mode

Transform your SQL queries into Jupyter-style notebook cells. Each query ending with `;` becomes a separate executable cell. Click the "Notebook Mode" button to toggle between text and notebook modes.

### 2. 💾 Query Auto-Save

Automatically saves your queries as you type and restores them when you return to the editor.

### 3. 🔍 Enhanced SQL Auto-Completion

Intelligent SQL completions with database schema awareness - table names, columns, keywords, and functions.

### 4. 👁️ Table Column Visibility Control

Click the eye icon (👁️) next to column headers to hide/show columns. Hidden columns appear collapsed with visual feedback.

## ⌨️ Keyboard Shortcuts

### Notebook Mode

- **Ctrl + ↑**: Navigate to previous cell
- **Ctrl + ↓**: Navigate to next cell
- **Cmd/Ctrl + Enter**: Execute current cell
- **Shift + Enter**: Execute current cell (fallback mode)
- **Cmd/Ctrl + /**: Toggle SQL comments

## 🐛 Troubleshooting

### Extension Not Working

1. Ensure you're on the correct Redash domain (`https://redash-platform.blinkit.in/*`)
2. Reload the page after installing the extension
3. Check browser console for error messages
4. Verify developer mode is enabled in Chrome extensions
