/**
 * Re-Redash Notebook Module - Functional Implementation
 * Transforms textarea queries into notebook-style cells
 * Each query ending with ';' becomes a separate cell
 */

// Configuration constants
const DEFAULT_CONFIG = {
  containerSelector: ".query-editor-container, .ace_editor",
  cellClass: "notebook-cell",
  inputClass: "notebook-input",
  executeButtonClass: "notebook-execute-btn",
  querySeparator: ";",
  debounceDelay: 300,
};

// Global state
let notebookState = {
  cells: [],
  aceEditor: null,
  notebookContainer: null,
  debounceTimer: null,
  isNotebookMode: false,
  originalContainer: null,
  config: DEFAULT_CONFIG,
  cellEditors: {}, // Store individual Ace Editor instances for each cell
};

/**
 * Save notebook mode preference to localStorage
 * @param {boolean} isNotebookMode - Whether notebook mode is active
 */
function saveNotebookModePreference(isNotebookMode) {
  try {
    localStorage.setItem(
      "re-redash-notebook-mode",
      JSON.stringify(isNotebookMode)
    );
    console.log("Re-Redash: Saved notebook mode preference:", isNotebookMode);
  } catch (error) {
    console.warn("Re-Redash: Failed to save notebook mode preference:", error);
  }
}

/**
 * Load notebook mode preference from localStorage
 * @returns {boolean|null} Saved preference or null if not found
 */
function loadNotebookModePreference() {
  try {
    const saved = localStorage.getItem("re-redash-notebook-mode");
    if (saved !== null) {
      const preference = JSON.parse(saved);
      console.log("Re-Redash: Loaded notebook mode preference:", preference);
      return preference;
    }
  } catch (error) {
    console.warn("Re-Redash: Failed to load notebook mode preference:", error);
  }
  return null;
}

/**
 * Update the notebook toggle button appearance based on current mode
 * @param {boolean} isNotebookMode - Whether notebook mode is currently active
 */
function updateToggleButtonAppearance(isNotebookMode) {
  const toggleBtn = document.querySelector(".notebook-mode-toggle");
  if (!toggleBtn) return;

  if (isNotebookMode) {
    toggleBtn.innerHTML = `<i class="zmdi zmdi-file"></i> Text Mode`;
    toggleBtn.title = "Switch to Text Mode";
    toggleBtn.style.background = "#52c41a"; // Green for active notebook mode
    toggleBtn.style.borderColor = "#52c41a";
  } else {
    toggleBtn.innerHTML = `<i class="zmdi zmdi-file-text"></i> Notebook Mode`;
    toggleBtn.title =
      "Switch to Notebook Mode - Transform queries into separate cells";
    toggleBtn.style.background = "#1890ff"; // Blue for text mode
    toggleBtn.style.borderColor = "#1890ff";
  }
}

/**
 * Initialize the notebook functionality with retry mechanism
 * @param {Object} config - Configuration overrides
 */
function initNotebook(config = {}) {
  notebookState.config = { ...DEFAULT_CONFIG, ...config };

  createNotebookContainer();
  setupEventListeners();

  // Try to find editor with retry mechanism
  let retryCount = 0;
  const maxRetries = 10;
  const retryInterval = 1000; // 1 second

  function tryInitialize() {
    console.log(
      `Re-Redash: Initialization attempt ${retryCount + 1}/${maxRetries}`
    );

    if (findAceEditor()) {
      injectNotebookButton();

      // Restore saved notebook mode preference
      const savedPreference = loadNotebookModePreference();
      if (savedPreference === true) {
        console.log("Re-Redash: Restoring notebook mode from saved preference");
        // Small delay to ensure editor is fully ready
        setTimeout(() => {
          switchToNotebookMode();
          // Ensure button appearance is updated after mode switch
          setTimeout(() => {
            updateToggleButtonAppearance(true);
          }, 100);
        }, 500);
      } else {
        // Ensure button shows correct state for text mode
        setTimeout(() => {
          updateToggleButtonAppearance(false);
        }, 100);
      }

      console.log("Re-Redash: Notebook module initialized successfully");
      return;
    }

    retryCount++;
    if (retryCount < maxRetries) {
      console.log(
        `Re-Redash: Editor not found, retrying in ${retryInterval}ms...`
      );
      setTimeout(tryInitialize, retryInterval);
    } else {
      console.warn("Re-Redash: Failed to find editor after maximum retries");
      // Still inject button for manual retry
      injectNotebookButton();
    }
  }

  // Start initialization
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", tryInitialize);
  } else {
    tryInitialize();
  }
}

/**
 * Find and store reference to Ace Editor with enhanced detection
 */
function findAceEditor() {
  console.log("Re-Redash: Searching for Ace Editor...");

  // Method 1: Try to find existing ace editor instances
  if (window.ace && window.ace.edit) {
    console.log("Re-Redash: window.ace is available");

    // Try finding by common selectors
    const selectors = [
      ".ace_editor",
      "#ace-editor",
      "[id*='ace']",
      ".query-editor .ace_editor",
      ".CodeMirror", // Fallback for CodeMirror
      "textarea[class*='ace']",
      "div[class*='ace']",
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        console.log(`Re-Redash: Found element with selector: ${selector}`);
        try {
          if (element.classList.contains("ace_editor")) {
            notebookState.aceEditor = window.ace.edit(element);
            notebookState.originalContainer =
              element.closest(
                ".query-editor, .ace-editor-container, .editor-container"
              ) || element.parentElement;
            console.log("Re-Redash: Successfully created ace editor instance");
            return true;
          }
        } catch (error) {
          console.warn(
            `Re-Redash: Failed to create ace editor from element:`,
            error
          );
        }
      }
    }
  }

  // Method 2: Check for global editor instances
  if (!notebookState.aceEditor) {
    const globalEditorNames = [
      "editor",
      "aceEditor",
      "queryEditor",
      "sqlEditor",
    ];
    for (const name of globalEditorNames) {
      if (window[name] && typeof window[name].getValue === "function") {
        notebookState.aceEditor = window[name];
        notebookState.originalContainer =
          document.querySelector(".query-editor, .editor-container") ||
          document.body;
        console.log(`Re-Redash: Found editor in window.${name}`);
        return true;
      }
    }
  }

  // Method 3: Look for textarea fallback
  if (!notebookState.aceEditor) {
    const textarea =
      document.querySelector(
        "textarea[placeholder*='query' i], textarea[class*='query' i], textarea[id*='query' i]"
      ) || document.querySelector("textarea");

    if (textarea) {
      console.log("Re-Redash: Using textarea fallback");
      notebookState.aceEditor = createTextareaWrapper(textarea);
      notebookState.originalContainer = textarea.parentElement;
      return true;
    }
  }

  console.warn("Re-Redash: No suitable editor found");
  return false;
}

/**
 * Find the appropriate container for Redash's editor structure
 * @param {HTMLElement} element - The editor element
 * @returns {HTMLElement} The container element
 */
function findRedashContainer(element) {
  // Look for Redash-specific containers
  const containers = [
    ".query-source",
    ".query-source-container",
    ".query-editor-container",
    ".ant-layout-content",
    ".query-page",
    ".editor-container",
  ];

  for (const containerSelector of containers) {
    const container = element.closest(containerSelector);
    if (container) {
      console.log(`Re-Redash: Found container: ${containerSelector}`);
      return container;
    }
  }

  // Fallback to parent element
  return element.parentElement;
}

/**
 * Create a wrapper for CodeMirror to mimic ace editor interface
 * @param {Object} cm - CodeMirror instance
 * @returns {Object} Ace editor-like interface
 */
function createCodeMirrorWrapper(cm) {
  return {
    getValue: function () {
      return cm.getValue();
    },
    setValue: function (value, cursorPos) {
      cm.setValue(value);
      if (cursorPos === 1) {
        cm.setCursor(cm.lineCount(), 0);
      }
    },
    on: function (event, callback) {
      if (event === "change") {
        cm.on("change", callback);
      } else if (event === "paste") {
        cm.on("paste", callback);
      } else if (event === "focus") {
        cm.on("focus", callback);
      }
    },
    // Add reference to original CodeMirror
    _codeMirror: cm,
  };
}

/**
 * Create a wrapper for textarea to mimic ace editor interface
 * @param {HTMLTextAreaElement} textarea - The textarea element
 * @returns {Object} Ace editor-like interface
 */
function createTextareaWrapper(textarea) {
  return {
    getValue: function () {
      return textarea.value;
    },
    setValue: function (value, cursorPos) {
      textarea.value = value;
      if (cursorPos === 1) {
        textarea.selectionStart = textarea.selectionEnd = value.length;
      }
    },
    on: function (event, callback) {
      if (event === "change") {
        textarea.addEventListener("input", callback);
      } else if (event === "paste") {
        textarea.addEventListener("paste", callback);
      } else if (event === "focus") {
        textarea.addEventListener("focus", callback);
      }
    },
    // Add reference to original textarea
    _textarea: textarea,
  };
}

/**
 * Create the main notebook container
 */
function createNotebookContainer() {
  notebookState.notebookContainer = document.createElement("div");
  notebookState.notebookContainer.className = "notebook-container";
  notebookState.notebookContainer.style.display = "none";
  notebookState.notebookContainer.innerHTML = `
    <div class="notebook-cells"></div>
  `;
}

/**
 * Inject notebook toggle button as fixed top-right element
 */
function injectNotebookButton() {
  // Don't inject if button already exists
  if (document.querySelector(".notebook-mode-toggle")) {
    console.log("Re-Redash: Notebook button already exists");
    return;
  }

  // Try to find the query editor controls container
  const controlsContainer = document.querySelector(".query-editor-controls");
  const saveButton = controlsContainer
    ? controlsContainer.querySelector('button[data-test="SaveButton"]')
    : null;

  // Create notebook toggle button
  const notebookToggle = document.createElement("button");
  notebookToggle.className = "notebook-mode-toggle";
  notebookToggle.innerHTML = `<i class="zmdi zmdi-file-text"></i> Notebook Mode`;
  notebookToggle.title =
    "Switch to Notebook Mode - Transform queries into separate cells";

  if (controlsContainer && saveButton) {
    // Place button in Redash controls before Save button
    notebookToggle.style.cssText = `
      margin-right: 4px;
      width: 300px;
      padding: 6px 12px;
      color: white;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      line-height: 1.4;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    notebookToggle.addEventListener("click", toggleNotebookMode);

    // Insert before Save button
    setTimeout(() => {
      controlsContainer.insertBefore(notebookToggle, saveButton);
      // Set initial appearance based on current state after button is inserted
      setTimeout(() => {
        updateToggleButtonAppearance(notebookState.isNotebookMode);
      }, 100);
    }, 1000);
    console.log("Re-Redash: Notebook button injected in query controls");
  } else {
    // Fallback to fixed positioning if controls not found
    // notebookToggle.style.cssText = `
    //   position: fixed;
    //   top: 20px;
    //   right: 20px;
    //   z-index: 10000;
    //   margin: 0;
    //   padding: 8px 16px;
    //   background: #1890ff;
    //   color: white;
    //   border: 1px solid #1890ff;
    //   border-radius: 6px;
    //   cursor: pointer;
    //   font-size: 14px;
    //   font-weight: 500;
    //   line-height: 1.4;
    //   box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    //   font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    // `;

    // Add hover effects that adapt to current mode
    notebookToggle.addEventListener("mouseenter", function () {
      const isNotebook = notebookState.isNotebookMode;
      const hoverColor = isNotebook ? "#73d13d" : "#40a9ff";
      this.style.background = hoverColor;
      this.style.borderColor = hoverColor;
      this.style.boxShadow = "0 4px 12px rgba(0,0,0,0.2)";
    });

    notebookToggle.addEventListener("mouseleave", function () {
      const isNotebook = notebookState.isNotebookMode;
      const normalColor = isNotebook ? "#52c41a" : "#1890ff";
      this.style.background = normalColor;
      this.style.borderColor = normalColor;
      this.style.boxShadow = "0 2px 8px rgba(0,0,0,0.15)";
    });

    notebookToggle.addEventListener("click", toggleNotebookMode);

    // Fallback to body if controls not found
    // document.body.appendChild(notebookToggle);

    // Set initial appearance based on current state
    setTimeout(() => {
      updateToggleButtonAppearance(notebookState.isNotebookMode);
    }, 50);

    console.log("Re-Redash: Notebook button injected in top-right (fallback)");
  }
}

/**
 * Setup event listeners for notebook functionality
 */
function setupEventListeners() {
  document.addEventListener("click", handleClick);
  document.addEventListener("input", handleInput);
  document.addEventListener("keydown", handleKeydown);

  // Listen for data source changes to refresh completions
  window.addEventListener("dataSourceChanged", handleDataSourceChange);

  // Listen for completion updates
  window.addEventListener("completionsLoaded", handleCompletionsLoaded);
}

/**
 * Handle data source change events
 * @param {CustomEvent} event - Data source change event
 */
function handleDataSourceChange(event) {
  const { newDataSource, completionData } = event.detail;
  console.log(
    "Re-Redash: Handling data source change in notebook:",
    newDataSource
  );

  // Refresh completions for all active cell editors
  refreshAllCellCompletions();
}

/**
 * Handle completion loaded events
 * @param {CustomEvent} event - Completions loaded event
 */
function handleCompletionsLoaded(event) {
  console.log("Re-Redash: Completions loaded event received in notebook");

  // Refresh completions for all active cell editors
  refreshAllCellCompletions();
}

/**
 * Refresh completions for all active cell editors
 */
function refreshAllCellCompletions() {
  if (!window.CompletionHandler || !window.CompletionHandler.isLoaded()) {
    console.log("Re-Redash: CompletionHandler not available or not loaded yet");
    return;
  }

  // Get all cell editors and refresh their completions
  if (notebookState.cellEditors) {
    Object.keys(notebookState.cellEditors).forEach((index) => {
      const cellEditor = notebookState.cellEditors[index];
      if (cellEditor && cellEditor.completers) {
        console.log(`Re-Redash: Refreshing completions for cell ${index}`);

        // Create new completer with updated completions
        const allCompletionsCompleter = {
          getCompletions: function (editor, session, pos, prefix, callback) {
            const allCompletions = window.CompletionHandler.getAllCompletions();

            if (!allCompletions || allCompletions.length === 0) {
              callback(null, []);
              return;
            }

            // Filter completions based on prefix
            const filteredCompletions = allCompletions.filter((completion) => {
              const value =
                completion.value || completion.name || completion.caption || "";
              return prefix
                ? value.toLowerCase().startsWith(prefix.toLowerCase())
                : true;
            });

            // Convert to Ace editor format
            const aceCompletions = filteredCompletions.map((completion) => ({
              caption:
                completion.value || completion.name || completion.caption,
              value: completion.value || completion.name || completion.caption,
              meta: completion.meta || completion.type || "sql",
              score: completion.score || 1000,
            }));

            callback(null, aceCompletions);
          },
        };

        // Replace the completers with updated ones
        cellEditor.completers = [allCompletionsCompleter];

        console.log(
          `Re-Redash: Updated completions for cell ${index} - ${
            window.CompletionHandler.getAllCompletions().length
          } completions available`
        );
      }
    });
  }

  // Also refresh the main editor if in text mode
  if (notebookState.aceEditor && notebookState.aceEditor.completers) {
    console.log("Re-Redash: Refreshing completions for main editor");

    // Restore original completers for main editor
    if (window.CompletionHandler.restoreCompletersTo) {
      window.CompletionHandler.restoreCompletersTo(notebookState.aceEditor);
    }
  }
}

/**
 * Handle click events
 * @param {Event} e - Click event
 */
function handleClick(e) {
  // Find the closest button element that has one of our target classes
  const targetButton = e.target.closest(
    ".notebook-toggle-btn, .cell-execute-btn, .cell-add-btn, .cell-copy-btn, .cell-delete-btn"
  );

  if (!targetButton) return;

  if (targetButton.classList.contains("notebook-toggle-btn")) {
    toggleNotebookMode();
  } else if (targetButton.classList.contains("cell-execute-btn")) {
    const cellIndex = parseInt(targetButton.dataset.cellIndex);
    executeCell(cellIndex);
  } else if (targetButton.classList.contains("cell-add-btn")) {
    const cellIndex = parseInt(targetButton.dataset.cellIndex);
    addNewCell(cellIndex + 1);
  } else if (targetButton.classList.contains("cell-copy-btn")) {
    const cellIndex = parseInt(targetButton.dataset.cellIndex);
    copyCell(cellIndex);
  } else if (targetButton.classList.contains("cell-delete-btn")) {
    const cellIndex = parseInt(targetButton.dataset.cellIndex);
    deleteCell(cellIndex);
  }
}

/**
 * Handle input events
 * @param {Event} e - Input event
 */
function handleInput(e) {
  // Handle fallback textarea inputs (Ace editors have their own change handlers)
  if (e.target.classList.contains("fallback-textarea")) {
    const cellIndex = parseInt(e.target.dataset.cellIndex);
    debouncedUpdateCell(cellIndex, e.target.value);
  }
}

/**
 * Handle keyboard events
 * @param {Event} e - Keyboard event
 */
function handleKeydown(e) {
  // Global navigation shortcuts (work in notebook mode regardless of focus)
  if (
    notebookState.isNotebookMode &&
    e.ctrlKey &&
    !e.shiftKey &&
    !e.altKey &&
    !e.metaKey
  ) {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      navigateToPreviousCell();
      return;
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      navigateToNextCell();
      return;
    }
  }

  // Only handle fallback textarea events (Ace editors have their own command handlers)
  if (e.target.classList.contains("fallback-textarea")) {
    // Shift + Enter to execute cell
    if (e.shiftKey && e.key === "Enter") {
      e.preventDefault();
      const cellIndex = parseInt(e.target.dataset.cellIndex);
      executeCell(cellIndex);
    }
    // Ctrl/Cmd + Enter to execute cell and add new one
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      const cellIndex = parseInt(e.target.dataset.cellIndex);
      executeCell(cellIndex);
      // addNewCell(cellIndex + 1);
    }
    // Ctrl/Cmd + / to toggle SQL comments
    if ((e.ctrlKey || e.metaKey) && e.key === "/") {
      e.preventDefault();
      toggleSQLComment(e.target);
    }
    // Ctrl + Space to show completions
    if (e.ctrlKey && e.key === " ") {
      e.preventDefault();
      showCompletions(e.target);
    }
    // Escape to hide completions
    if (e.key === "Escape") {
      hideCompletions(e.target);
    }
    // Arrow keys for completion navigation
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (handleCompletionNavigation(e.target, e.key)) {
        e.preventDefault();
      }
    }
    // Enter or Tab to accept completion
    if (
      (e.key === "Enter" || e.key === "Tab") &&
      isCompletionVisible(e.target)
    ) {
      if (acceptCompletion(e.target)) {
        e.preventDefault();
      }
    }
  }
}

/**
 * Create an Ace Editor instance for a cell with completion handler integration
 * @param {HTMLElement} cellDiv - The cell container element
 * @param {Object} cell - Cell data
 * @param {number} index - Cell index
 */
function createCellAceEditor(cellDiv, cell, index) {
  const editorWrapper = cellDiv.querySelector(".cell-editor-wrapper");
  if (!editorWrapper || !window.ace) {
    console.warn(
      "Re-Redash: Cannot create cell editor - missing wrapper or Ace"
    );
    createFallbackTextarea(editorWrapper, cell, index);
    return;
  }

  try {
    // Create a unique ID for this editor
    const editorId = `cell-editor-${index}-${Date.now()}`;
    editorWrapper.id = editorId;

    // Create Ace Editor instance
    const cellEditor = window.ace.edit(editorId);

    // Copy settings from the main editor
    if (notebookState.aceEditor) {
      // Get theme and mode from main editor
      const mainSession = notebookState.aceEditor.getSession();
      const cellSession = cellEditor.getSession();

      // Apply same theme and mode
      cellEditor.setTheme(notebookState.aceEditor.getTheme());
      cellSession.setMode(mainSession.getMode());

      // Copy other settings
      cellEditor.setOptions({
        enableBasicAutocompletion: true,
        enableSnippets: true,
        enableLiveAutocompletion: true,
        fontSize: "13px",
        showLineNumbers: false,
        showGutter: false,
        highlightActiveLine: false,
        showPrintMargin: false,
        wrap: true,
        maxLines: Infinity,
        minLines: 1,
      });
      cellEditor.renderer.setScrollMargin(0, 10, 0, 0);
    }

    // Set initial content
    cellEditor.setValue(cell.content, 1);

    // Store reference to the editor
    if (!notebookState.cellEditors) {
      notebookState.cellEditors = {};
    }
    notebookState.cellEditors[index] = cellEditor;

    // Use editor.completers.push with getAllCompletions() approach
    if (window.CompletionHandler && window.CompletionHandler.isLoaded()) {
      const allCompletionsCompleter = {
        getCompletions: function (editor, session, pos, prefix, callback) {
          // Get all completions from the completion handler
          const allCompletions = window.CompletionHandler.getAllCompletions();

          if (!allCompletions || allCompletions.length === 0) {
            callback(null, []);
            return;
          }

          // Filter completions based on prefix
          const filteredCompletions = allCompletions.filter((completion) => {
            const value =
              completion.value || completion.name || completion.caption || "";
            return prefix
              ? value.toLowerCase().startsWith(prefix.toLowerCase())
              : true;
          });

          // Convert to Ace editor format
          const aceCompletions = filteredCompletions.map((completion) => ({
            caption: completion.value || completion.name || completion.caption,
            value: completion.value || completion.name || completion.caption,
            meta: completion.meta || completion.type || "sql",
            score: completion.score || 1000,
          }));

          callback(null, aceCompletions);
        },
      };

      console.log(allCompletionsCompleter, cellEditor.completers);

      // Initialize completers array if it doesn't exist
      if (!cellEditor.completers) {
        cellEditor.completers = [];
      }

      // Push the getAllCompletions completer
      cellEditor.completers = [allCompletionsCompleter];
      console.log(cellEditor.completers);

      console.log(
        "Re-Redash: Added getAllCompletions completer for cell",
        index
      );
      console.log(
        "Re-Redash: Cell editor now has",
        cellEditor.completers.length,
        "completers"
      );
      console.log(
        "Re-Redash: Available completions:",
        window.CompletionHandler.getAllCompletions().length
      );
    } else {
      console.log("Re-Redash: CompletionHandler not available for cell", index);
    }

    // Set up event listeners
    cellEditor.on("change", (delta) => {
      const content = cellEditor.getValue();
      debouncedUpdateCell(index, content);
    });

    // Add focus event listener for visual feedback
    cellEditor.on("focus", () => {
      updateCellFocusState(index);
    });

    // Add keyboard shortcuts
    cellEditor.commands.addCommand({
      name: "executeCell",
      bindKey: { win: "Ctrl-Enter", mac: "Cmd-Enter" },
      exec: function () {
        executeCell(index);
      },
    });

    // cellEditor.commands.addCommand({
    //   name: "executeCellAndAddNew",
    //   bindKey: { win: "Ctrl-Enter", mac: "Cmd-Enter" },
    //   exec: function () {
    //     executeCell(index);
    //     addNewCell(index + 1);
    //   },
    // });

    cellEditor.commands.addCommand({
      name: "toggleComment",
      bindKey: { win: "Ctrl-/", mac: "Cmd-/" },
      exec: function () {
        cellEditor.toggleCommentLines();
      },
    });

    // Add cell navigation commands
    cellEditor.commands.addCommand({
      name: "navigateToPreviousCell",
      bindKey: { win: "Cmd-Up", mac: "Cmd-Up" },
      exec: function () {
        navigateToPreviousCell();
      },
    });

    cellEditor.commands.addCommand({
      name: "navigateToNextCell",
      bindKey: { win: "Cmd-Down", mac: "Cmd-Down" },
      exec: function () {
        navigateToNextCell();
      },
    });

    // Add duplicate cell command
    cellEditor.commands.addCommand({
      name: "duplicateCell",
      bindKey: { win: "Ctrl-Shift-D", mac: "Cmd-Shift-D" },
      exec: function () {
        copyCell(index);
      },
    });

    // Add delete cell command
    cellEditor.commands.addCommand({
      name: "deleteCell",
      bindKey: { win: "Ctrl-Shift-Backspace", mac: "Cmd-Shift-Backspace" },
      exec: function () {
        deleteCell(index);
      },
    });

    // Add new cell command
    cellEditor.commands.addCommand({
      name: "addNewCell",
      bindKey: { win: "Ctrl-Shift-A", mac: "Cmd-Shift-A" },
      exec: function () {
        addNewCell(index + 1);
      },
    });

    console.log(
      `Re-Redash: Created Ace editor for cell ${index} with completion handler integration`
    );
  } catch (error) {
    console.warn(
      `Re-Redash: Failed to create Ace editor for cell ${index}:`,
      error
    );
    createFallbackTextarea(editorWrapper, cell, index);
  }
}

/**
 * Create fallback textarea if Ace Editor fails
 * @param {HTMLElement} wrapper - The wrapper element
 * @param {Object} cell - Cell data
 * @param {number} index - Cell index
 */
function createFallbackTextarea(wrapper, cell, index) {
  wrapper.innerHTML = `
    <textarea
      class="cell-input fallback-textarea"
      data-cell-index="${index}"
      placeholder="Enter your SQL query here... (Cmd+/ to toggle comments)"
      rows="1"
    >${cell.content}</textarea>
  `;

  // Add focus event listener to the textarea
  const textarea = wrapper.querySelector(".fallback-textarea");
  if (textarea) {
    textarea.addEventListener("focus", () => {
      updateCellFocusState(index);
    });
  }
}

/**
 * Show completions for the given textarea (fallback only)
 * @param {HTMLTextAreaElement} textarea - The textarea element
 */
function showCompletions(textarea) {
  if (!window.CompletionHandler || !window.CompletionHandler.isLoaded()) {
    console.warn("Re-Redash: Completion handler not loaded");
    return;
  }

  const cellIndex = parseInt(textarea.dataset.cellIndex);
  const dropdown = document.querySelector(
    `.completion-dropdown[data-cell-index="${cellIndex}"]`
  );
  if (!dropdown) return;

  // Get current word being typed
  const cursorPos = textarea.selectionStart;
  const textBeforeCursor = textarea.value.slice(0, cursorPos);
  const words = textBeforeCursor.split(/\s+/);
  const currentWord = words[words.length - 1] || "";

  // Get completions
  const completions =
    window.CompletionHandler.getCompletionsForPrefix(currentWord);

  if (completions.length === 0) {
    hideCompletions(textarea);
    return;
  }

  // Populate dropdown
  dropdown.innerHTML = "";
  completions.slice(0, 10).forEach((completion, index) => {
    const item = document.createElement("div");
    item.className = "completion-item";
    if (index === 0) item.classList.add("selected");

    const value = completion.value || completion.name || completion.caption;
    const meta = completion.meta || completion.type || "";

    item.innerHTML = `
      <span class="completion-value">${value}</span>
      ${meta ? `<span class="completion-meta">${meta}</span>` : ""}
    `;

    item.addEventListener("click", () => {
      insertCompletion(textarea, value, currentWord);
      hideCompletions(textarea);
    });

    dropdown.appendChild(item);
  });

  // Position and show dropdown
  positionDropdown(textarea, dropdown);
  dropdown.style.display = "block";
}

/**
 * Hide completions dropdown
 * @param {HTMLTextAreaElement} textarea - The textarea element
 */
function hideCompletions(textarea) {
  const cellIndex = parseInt(textarea.dataset.cellIndex);
  const dropdown = document.querySelector(
    `.completion-dropdown[data-cell-index="${cellIndex}"]`
  );
  if (dropdown) {
    dropdown.style.display = "none";
  }
}

/**
 * Check if completions are visible
 * @param {HTMLTextAreaElement} textarea - The textarea element
 */
function isCompletionVisible(textarea) {
  const cellIndex = parseInt(textarea.dataset.cellIndex);
  const dropdown = document.querySelector(
    `.completion-dropdown[data-cell-index="${cellIndex}"]`
  );
  return dropdown && dropdown.style.display !== "none";
}

/**
 * Handle completion navigation with arrow keys
 * @param {HTMLTextAreaElement} textarea - The textarea element
 * @param {string} key - The pressed key
 */
function handleCompletionNavigation(textarea, key) {
  if (!isCompletionVisible(textarea)) return false;

  const cellIndex = parseInt(textarea.dataset.cellIndex);
  const dropdown = document.querySelector(
    `.completion-dropdown[data-cell-index="${cellIndex}"]`
  );
  const items = dropdown.querySelectorAll(".completion-item");
  const selected = dropdown.querySelector(".completion-item.selected");

  if (!selected || items.length === 0) return false;

  let newIndex = Array.from(items).indexOf(selected);

  if (key === "ArrowDown") {
    newIndex = (newIndex + 1) % items.length;
  } else if (key === "ArrowUp") {
    newIndex = (newIndex - 1 + items.length) % items.length;
  }

  // Update selection
  selected.classList.remove("selected");
  items[newIndex].classList.add("selected");

  return true;
}

/**
 * Accept the selected completion
 * @param {HTMLTextAreaElement} textarea - The textarea element
 */
function acceptCompletion(textarea) {
  if (!isCompletionVisible(textarea)) return false;

  const cellIndex = parseInt(textarea.dataset.cellIndex);
  const dropdown = document.querySelector(
    `.completion-dropdown[data-cell-index="${cellIndex}"]`
  );
  const selected = dropdown.querySelector(".completion-item.selected");

  if (!selected) return false;

  const value = selected.querySelector(".completion-value").textContent;

  // Get current word being replaced
  const cursorPos = textarea.selectionStart;
  const textBeforeCursor = textarea.value.slice(0, cursorPos);
  const words = textBeforeCursor.split(/\s+/);
  const currentWord = words[words.length - 1] || "";

  insertCompletion(textarea, value, currentWord);
  hideCompletions(textarea);

  return true;
}

/**
 * Insert completion into textarea
 * @param {HTMLTextAreaElement} textarea - The textarea element
 * @param {string} completion - The completion to insert
 * @param {string} currentWord - The current word being replaced
 */
function insertCompletion(textarea, completion, currentWord) {
  const cursorPos = textarea.selectionStart;
  const value = textarea.value;

  // Replace current word with completion
  const startPos = cursorPos - currentWord.length;
  const newValue =
    value.slice(0, startPos) + completion + value.slice(cursorPos);

  textarea.value = newValue;
  textarea.selectionStart = textarea.selectionEnd =
    startPos + completion.length;

  // Trigger change event for sync
  const cellIndex = parseInt(textarea.dataset.cellIndex);
  debouncedUpdateCell(cellIndex, newValue);

  textarea.focus();
}

/**
 * Position the completion dropdown
 * @param {HTMLTextAreaElement} textarea - The textarea element
 * @param {HTMLElement} dropdown - The dropdown element
 */
function positionDropdown(textarea, dropdown) {
  const rect = textarea.getBoundingClientRect();
  dropdown.style.top = `${rect.bottom}px`;
  dropdown.style.left = `${rect.left}px`;
  dropdown.style.width = `${Math.max(200, rect.width)}px`;
}

/**
 * Toggle SQL comment (--) for selected lines or current line
 * @param {HTMLTextAreaElement} textarea - The textarea element
 */
function toggleSQLComment(textarea) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const content = textarea.value;

  // Get the full text and split into lines
  const lines = content.split("\n");

  // Find which lines are selected
  let startLine = 0;
  let endLine = 0;
  let charCount = 0;

  // Find start line
  for (let i = 0; i < lines.length; i++) {
    const lineLength = lines[i].length + 1; // +1 for newline
    if (charCount + lineLength > start) {
      startLine = i;
      break;
    }
    charCount += lineLength;
  }

  // Find end line
  charCount = 0;
  for (let i = 0; i < lines.length; i++) {
    const lineLength = lines[i].length + 1; // +1 for newline
    if (charCount + lineLength >= end) {
      endLine = i;
      break;
    }
    charCount += lineLength;
  }

  // If no selection, just use current line
  if (start === end) {
    endLine = startLine;
  }

  // Check if all selected lines are commented
  let allCommented = true;
  for (let i = startLine; i <= endLine; i++) {
    const line = lines[i].trim();
    if (line.length > 0 && !line.startsWith("--")) {
      allCommented = false;
      break;
    }
  }

  // Toggle comments
  for (let i = startLine; i <= endLine; i++) {
    const line = lines[i];
    if (line.trim().length === 0) continue; // Skip empty lines

    if (allCommented) {
      // Remove comment: remove first occurrence of '--' (and optional space after)
      lines[i] = line.replace(/^(\s*)--\s?/, "$1");
    } else {
      // Add comment: add '--' at the beginning of non-whitespace content
      const match = line.match(/^(\s*)(.*)/);
      if (match) {
        lines[i] = match[1] + "-- " + match[2];
      }
    }
  }

  // Update textarea content
  const newContent = lines.join("\n");
  textarea.value = newContent;

  // Update the cell content and sync
  const cellIndex = parseInt(textarea.dataset.cellIndex);
  debouncedUpdateCell(cellIndex, newContent);

  // Restore cursor position (approximately)
  const lengthDiff = newContent.length - content.length;
  textarea.selectionStart = Math.max(0, start);
  textarea.selectionEnd = Math.max(0, end + lengthDiff);

  // Focus back to textarea
  textarea.focus();
}

/**
 * Parse queries from text content
 * @param {string} content - The text content to parse
 * @returns {Array} Array of query objects
 */
function parseQueries(content) {
  if (!content || !content.trim()) return [];

  // Split by semicolon and filter out empty queries
  const queries = content
    .split(notebookState.config.querySeparator)
    .map((query) => query.trim())
    .filter((query) => query.length > 0)
    .map((query, index) => ({
      id: `cell_${Date.now()}_${index}`,
      content: query,
    }));

  return queries;
}

/**
 * Toggle between notebook mode and text mode
 */
function toggleNotebookMode() {
  if (!notebookState.isNotebookMode) {
    switchToNotebookMode();
  } else {
    switchToTextMode();
  }
}

/**
 * Switch to notebook mode
 */
function switchToNotebookMode() {
  console.log("Re-Redash: Attempting to switch to notebook mode...");
  console.log("Re-Redash: CompletionHandler state before switch:", {
    available: !!window.CompletionHandler,
    loaded: window.CompletionHandler
      ? window.CompletionHandler.isLoaded()
      : false,
    originalCompleters: window.CompletionHandler
      ? !!window.CompletionHandler.getOriginalCompleters()
      : false,
  });

  // Try to re-find editor if not available
  if (!notebookState.aceEditor) {
    console.log("Re-Redash: Editor not found, attempting to re-detect...");
    if (!findAceEditor()) {
      alert(
        "Cannot find the query editor. Please make sure you are on a query editing page and try refreshing."
      );
      return;
    }
  }

  console.log(
    "Re-Redash: Main editor completers before switch:",
    notebookState.aceEditor.completers
      ? notebookState.aceEditor.completers.length
      : "undefined"
  );
  console.log(
    "Re-Redash: Main editor completers details:",
    notebookState.aceEditor.completers
      ? notebookState.aceEditor.completers.map(
          (c) => c.constructor.name || "Unknown"
        )
      : "undefined"
  );

  if (!notebookState.originalContainer) {
    // Try to find a suitable container
    const editor =
      notebookState.aceEditor._textarea ||
      document.querySelector(".ace_editor") ||
      document.querySelector("textarea");

    if (editor) {
      notebookState.originalContainer =
        editor.closest(
          ".query-editor, .editor-container, .ace-editor-container"
        ) || editor.parentElement;
      console.log("Re-Redash: Found container for editor");
    } else {
      alert(
        "Cannot find the editor container. Please refresh the page and try again."
      );
      return;
    }
  }

  try {
    // Get current content from ace editor
    const content = notebookState.aceEditor.getValue();
    console.log(
      "Re-Redash: Retrieved content from editor:",
      content.length,
      "characters"
    );

    // Parse queries into cells
    notebookState.cells = parseQueries(content);
    console.log("Re-Redash: Parsed", notebookState.cells.length, "queries");

    // Hide original editor
    notebookState.originalContainer.style.display = "none";

    // Show notebook container
    notebookState.notebookContainer.style.display = "block";

    // Insert notebook container after original container
    if (!notebookState.notebookContainer.parentNode) {
      notebookState.originalContainer.parentNode.insertBefore(
        notebookState.notebookContainer,
        notebookState.originalContainer.nextSibling
      );
    }

    // Render cells
    renderCells();

    notebookState.isNotebookMode = true;

    // Save preference to localStorage
    saveNotebookModePreference(true);

    // Update toggle button appearance
    updateToggleButtonAppearance(true);

    console.log("Re-Redash: Successfully switched to notebook mode");
    console.log(
      "Re-Redash: Notebook mode activated. Created",
      notebookState.cells.length,
      "cells"
    );
    console.log(
      "Re-Redash: Cell editors created:",
      Object.keys(notebookState.cellEditors).length
    );
  } catch (error) {
    console.error("Re-Redash: Error switching to notebook mode:", error);
    alert(
      "An error occurred while switching to notebook mode. Check the console for details."
    );
  }
}

/**
 * Switch to text mode
 */
function switchToTextMode() {
  // Sync any pending changes to Ace editor before switching
  syncCellsToAceEditor();

  // Clean up all cell editors
  if (notebookState.cellEditors) {
    Object.keys(notebookState.cellEditors).forEach((index) => {
      try {
        notebookState.cellEditors[index].destroy();
      } catch (error) {
        console.warn(
          `Re-Redash: Failed to destroy cell editor ${index}:`,
          error
        );
      }
    });
    notebookState.cellEditors = {};
  }

  // Show original editor
  notebookState.originalContainer.style.display = "block";

  // Hide notebook container
  notebookState.notebookContainer.style.display = "none";

  notebookState.isNotebookMode = false;

  // Save preference to localStorage
  saveNotebookModePreference(false);

  // Update toggle button appearance
  updateToggleButtonAppearance(false);

  console.log("Re-Redash: Switched to text mode");
}

/**
 * Render all cells in the notebook
 */
function renderCells() {
  const cellsContainer =
    notebookState.notebookContainer.querySelector(".notebook-cells");
  cellsContainer.innerHTML = "";

  notebookState.cells.forEach((cell, index) => {
    const cellElement = createCellElement(cell, index);
    cellsContainer.appendChild(cellElement);
  });

  // Add empty cell if no cells exist
  if (notebookState.cells.length === 0) {
    addNewCell();
  }
}

/**
 * Create a cell element
 * @param {Object} cell - Cell data
 * @param {number} index - Cell index
 * @returns {HTMLElement} Cell element
 */
function createCellElement(cell, index) {
  const cellDiv = document.createElement("div");
  cellDiv.className = `${notebookState.config.cellClass}`;
  cellDiv.innerHTML = `
    <div class="cell-input-container">
      <div style="padding-top: 4px; min-width: 20px">${index + 1}</div>
      <div class="cell-editor-wrapper" data-cell-index="${index}"></div>
      <div class="cell-actions">
        <button class="cell-execute-btn" data-cell-index="${index}" title="Execute Cell (Shift+Enter)">
          <span class="zmdi zmdi-play"></span> 
        </button>
        <button class="cell-add-btn" data-cell-index="${index}" title="Add New Cell">
          <i class="zmdi zmdi-plus"></i>
        </button>
        <button class="cell-copy-btn" data-cell-index="${index}" title="Copy Cell">
          <i class="zmdi zmdi-copy"></i>
        </button>
        <button class="cell-delete-btn" data-cell-index="${index}" title="Delete Cell">
          <i class="zmdi zmdi-delete"></i>
        </button>
      </div>
    </div>
  `;

  // Create Ace Editor instance for this cell after DOM insertion
  setTimeout(() => {
    createCellAceEditor(cellDiv, cell, index);
  }, 0);

  return cellDiv;
}

/**
 * Create fallback textarea if Ace Editor fails
 * @param {HTMLElement} wrapper - The wrapper element
 * @param {Object} cell - Cell data
 * @param {number} index - Cell index
 */
function createFallbackTextarea(wrapper, cell, index) {
  wrapper.innerHTML = `
    <textarea
      class="cell-input fallback-textarea"
      data-cell-index="${index}"
      placeholder="Enter your SQL query here... (Cmd+/ to toggle comments)"
      rows="1"
    >${cell.content}</textarea>
  `;
}

/**
 * Add a new cell
 * @param {number} position - Position to insert the cell (optional)
 */
function addNewCell(position = null) {
  const newCell = {
    id: `cell_${Date.now()}`,
    content: "",
  };

  if (
    position !== null &&
    position >= 0 &&
    position < notebookState.cells.length
  ) {
    notebookState.cells.splice(position, 0, newCell);
  } else {
    notebookState.cells.push(newCell);
  }

  renderCells();

  // Sync to Ace editor after adding cell
  syncCellsToAceEditor();

  // Focus on the new cell
  setTimeout(() => {
    const cellInputs = document.querySelectorAll(".cell-input");
    const targetIndex = position !== null ? position : cellInputs.length - 1;
    if (cellInputs[targetIndex]) {
      cellInputs[targetIndex].focus();
    }
  }, 100);
}

/**
 * Copy a cell and create a duplicate
 * @param {number} index - Index of the cell to copy
 */
function copyCell(index) {
  if (index < 0 || index >= notebookState.cells.length) {
    console.warn("Re-Redash: Invalid cell index for copy:", index);
    return;
  }

  // Get the current content of the cell
  let cellContent = "";

  // First try to get content from the cell editor (in case user has made changes)
  if (notebookState.cellEditors && notebookState.cellEditors[index]) {
    try {
      cellContent = notebookState.cellEditors[index].getValue();
    } catch (error) {
      console.warn("Re-Redash: Failed to get content from cell editor:", error);
      // Fallback to stored content
      cellContent = notebookState.cells[index].content || "";
    }
  } else {
    // Fallback to stored content
    cellContent = notebookState.cells[index].content || "";
  }

  // Create a new cell with the copied content
  const copiedCell = {
    id: `cell_${Date.now()}`,
    content: cellContent,
  };

  // Insert the copied cell right after the original cell
  const insertPosition = index + 1;
  notebookState.cells.splice(insertPosition, 0, copiedCell);

  // Re-render cells
  renderCells();

  // Sync to Ace editor after copying cell
  syncCellsToAceEditor();

  // Focus on the new copied cell
  setTimeout(() => {
    const cellEditors = Object.values(notebookState.cellEditors);
    if (cellEditors[insertPosition]) {
      try {
        cellEditors[insertPosition].focus();
      } catch (error) {
        console.warn("Re-Redash: Failed to focus copied cell:", error);
      }
    }
  }, 200);

  console.log(`Re-Redash: Copied cell ${index} with content: "${cellContent}"`);
}

/**
 * Navigate to the previous cell (move up)
 */
function navigateToPreviousCell() {
  if (!notebookState.isNotebookMode) return;

  const currentFocusedCell = getCurrentFocusedCellIndex();
  if (currentFocusedCell === null || currentFocusedCell <= 0) return;

  const previousIndex = currentFocusedCell - 1;
  focusCell(previousIndex);
}

/**
 * Navigate to the next cell (move down)
 */
function navigateToNextCell() {
  if (!notebookState.isNotebookMode) return;

  const currentFocusedCell = getCurrentFocusedCellIndex();
  if (
    currentFocusedCell === null ||
    currentFocusedCell >= notebookState.cells.length - 1
  )
    return;

  const nextIndex = currentFocusedCell + 1;
  focusCell(nextIndex);
}

/**
 * Get the index of the currently focused cell
 * @returns {number|null} The index of the focused cell or null if none
 */
function getCurrentFocusedCellIndex() {
  // Check Ace editors first
  for (const [index, editor] of Object.entries(notebookState.cellEditors)) {
    try {
      if (editor.isFocused && editor.isFocused()) {
        return parseInt(index);
      }
    } catch (error) {
      // Some Ace editors might not have isFocused method, check DOM focus
      const editorElement = editor.container || editor.renderer.container;
      if (editorElement && editorElement.contains(document.activeElement)) {
        return parseInt(index);
      }
    }
  }

  // Check fallback textareas
  const activeElement = document.activeElement;
  if (activeElement && activeElement.classList.contains("fallback-textarea")) {
    const cellIndex = activeElement.dataset.cellIndex;
    if (cellIndex) {
      return parseInt(cellIndex);
    }
  }

  return null;
}

/**
 * Update the visual focus state for a cell
 * @param {number} index - Index of the cell that gained focus
 */
function updateCellFocusState(index) {
  // Remove focus styling from all cells
  document.querySelectorAll(".notebook-cell").forEach((cell) => {
    cell.classList.remove("cell-focused");
  });

  // Add focus styling to the focused cell
  const targetCell = document.querySelector(
    `.notebook-cell:nth-child(${index + 1})`
  );
  if (targetCell) {
    targetCell.classList.add("cell-focused");
    console.log(`Re-Redash: Updated focus state for cell ${index}`);
  }
}

/**
 * Focus on a specific cell
 * @param {number} index - Index of the cell to focus
 */
function focusCell(index) {
  if (index < 0 || index >= notebookState.cells.length) return;

  // Try to focus Ace editor first
  if (notebookState.cellEditors && notebookState.cellEditors[index]) {
    try {
      notebookState.cellEditors[index].focus();
      console.log(`Re-Redash: Focused cell ${index} (Ace editor)`);
      return;
    } catch (error) {
      console.warn("Re-Redash: Failed to focus Ace editor:", error);
    }
  }

  // Fallback to textarea
  const textarea = document.querySelector(
    `.fallback-textarea[data-cell-index="${index}"]`
  );
  if (textarea) {
    textarea.focus();
    console.log(`Re-Redash: Focused cell ${index} (textarea)`);
    return;
  }

  console.warn(`Re-Redash: Could not focus cell ${index}`);
}

/**
 * Delete a cell
 * @param {number} index - Cell index to delete
 */
function deleteCell(index) {
  if (index >= 0 && index < notebookState.cells.length) {
    // Clean up Ace editor instance if it exists
    if (notebookState.cellEditors && notebookState.cellEditors[index]) {
      try {
        notebookState.cellEditors[index].destroy();
        delete notebookState.cellEditors[index];
      } catch (error) {
        console.warn(
          `Re-Redash: Failed to destroy cell editor ${index}:`,
          error
        );
      }
    }

    // Determine which cell to focus after deletion
    const totalCells = notebookState.cells.length;
    let focusIndex = -1;

    if (totalCells > 1) {
      // If deleting the first cell, focus on the next cell (which will become index 0)
      // Otherwise, focus on the previous cell
      focusIndex = index > 0 ? index - 1 : 0;
    }

    notebookState.cells.splice(index, 1);
    renderCells();

    // Sync to Ace editor after deleting cell
    syncCellsToAceEditor();

    // Focus on the appropriate cell after a short delay to ensure rendering is complete
    if (focusIndex >= 0 && notebookState.cells.length > 0) {
      setTimeout(() => {
        focusCell(focusIndex);
      }, 100);
    }
  }
}

/**
 * Find and execute a query by searching for specific text
 * @param {string} searchText - Text to search for in the editor
 * @param {Object} options - Search options
 */
function findAndExecuteQuery(searchText = "SELECT", options = {}) {
  console.log(`Re-Redash: Searching for text: "${searchText}"`);

  // Ensure we have an ace editor
  if (!notebookState.aceEditor) {
    console.log("Re-Redash: No ace editor found, attempting to find one...");
    if (!findAceEditor()) {
      console.warn("Re-Redash: Cannot find ace editor for selection");
      return false;
    }
  }

  try {
    // Use Ace editor's Search to find the text
    if (window.ace && window.ace.require) {
      const Search = window.ace.require("ace/search").Search;
      const search = new Search();

      // Set search options
      const searchOptions = {
        needle: searchText,
        caseSensitive: options.caseSensitive || false,
        wholeWord: options.wholeWord || false,
        regExp: options.regExp || false,
        ...options,
      };

      search.set(searchOptions);
      console.log("Re-Redash: Search options set:", searchOptions);

      // Find the text in the editor
      const range = search.find(notebookState.aceEditor.session);

      if (range) {
        // Set the selection to the found range
        notebookState.aceEditor.selection.setRange(range);
        console.log("Re-Redash: Text found and selected successfully");

        // Wait a bit for selection to register, then execute
        setTimeout(() => {
          executeSelectedQuery();
        }, 100);

        return true;
      } else {
        console.warn(`Re-Redash: Text "${searchText}" not found in editor`);
        return false;
      }
    } else {
      console.warn("Re-Redash: Ace editor Search not available");
      return false;
    }
  } catch (error) {
    console.error("Re-Redash: Error searching for text:", error);
    return false;
  }
}

/**
 * Execute the currently selected query by clicking the execute button
 */
function executeSelectedQuery() {
  console.log("Re-Redash: Attempting to execute selected query...");

  // Try to find the execute button with data-test="ExecuteButton"
  const executeButton = document.querySelector('[data-test="ExecuteButton"]');

  if (executeButton) {
    console.log("Re-Redash: Found execute button, simulating click...");

    // Simulate a click event
    const clickEvent = new MouseEvent("click", {
      view: window,
      bubbles: true,
      cancelable: true,
    });

    executeButton.dispatchEvent(clickEvent);
    console.log("Re-Redash: Execute button clicked successfully");
    return true;
  } else {
    console.warn(
      "Re-Redash: Execute button with data-test='ExecuteButton' not found"
    );

    // Fallback: try other common execute button selectors
    const fallbackSelectors = [
      'button[title*="execute" i]',
      'button[aria-label*="execute" i]',
      ".execute-button",
      ".run-button",
      'button:contains("Execute")',
      'button:contains("Run")',
    ];

    for (const selector of fallbackSelectors) {
      const button = document.querySelector(selector);
      if (button) {
        console.log(`Re-Redash: Found fallback execute button: ${selector}`);
        button.click();
        return true;
      }
    }

    console.warn("Re-Redash: No execute button found with any selector");
    return false;
  }
}

/**
 * Execute a specific cell
 * @param {number} index - Cell index to execute
 */
function executeCell(index) {
  if (index < 0 || index >= notebookState.cells.length) return;

  const cell = notebookState.cells[index];

  if (!cell.content.trim()) {
    alert("Cell is empty. Please enter a query.");
    return;
  }

  // Sync all cells to Ace editor before execution to ensure content is up to date
  syncCellsToAceEditor();

  // Re-render the specific cell
  renderCells();

  // Use the search and execute functionality to find and execute the cell content
  console.log(
    `Re-Redash: Executing cell ${index} with content: "${cell.content}"`
  );

  // First, try to find the cell content in the main editor and execute it
  const searchResult = findAndExecuteQuery(cell.content.trim(), {
    caseSensitive: false,
    wholeWord: false,
    regExp: false,
  });

  // If search didn't find the content, fallback to the original method
  if (!searchResult) {
    console.log(
      "Re-Redash: Cell content not found in main editor, using fallback execution"
    );
    executeQuery(cell.content);
  }
}

/**
 * Run all cells in sequence
 */
function runAllCells() {
  const nonEmptyCells = notebookState.cells
    .map((cell, index) => ({ cell, index }))
    .filter(({ cell }) => cell.content.trim());

  if (nonEmptyCells.length === 0) {
    alert("No queries to execute.");
    return;
  }

  // Execute cells sequentially
  nonEmptyCells.reduce((promise, { index }) => {
    return promise.then(() => {
      return new Promise((resolve) => {
        executeCell(index);
        // Wait a bit before executing next cell
        setTimeout(resolve, 1000);
      });
    });
  }, Promise.resolve());
}

/**
 * Debounced cell content update
 * @param {number} index - Cell index
 * @param {string} content - New content
 */
function debouncedUpdateCell(index, content) {
  clearTimeout(notebookState.debounceTimer);
  notebookState.debounceTimer = setTimeout(() => {
    updateCellContent(index, content);
  }, notebookState.config.debounceDelay);
}

/**
 * Update cell content and sync to Ace editor
 * @param {number} index - Cell index
 * @param {string} content - New content
 */
function updateCellContent(index, content) {
  if (index >= 0 && index < notebookState.cells.length) {
    notebookState.cells[index].content = content;

    // Real-time sync back to Ace editor
    syncCellsToAceEditor();
  }
}

/**
 * Sync all cell content back to the Ace editor
 */
function syncCellsToAceEditor() {
  if (!notebookState.aceEditor || !notebookState.isNotebookMode) {
    return;
  }

  try {
    // Collect content from cell editors or cell objects
    const cellContents = notebookState.cells.map((cell, index) => {
      // Try to get content from Ace editor instance first
      if (notebookState.cellEditors && notebookState.cellEditors[index]) {
        try {
          return notebookState.cellEditors[index].getValue().trim();
        } catch (error) {
          console.warn(
            `Re-Redash: Failed to get content from cell editor ${index}:`,
            error
          );
        }
      }

      // Fallback to cell object content
      return cell.content ? cell.content.trim() : "";
    });

    // Reconstruct the full content by joining all cells with semicolons
    const fullContent = cellContents
      .filter((content) => content.length > 0) // Skip empty cells
      .join(";\n\n"); // Join with semicolon and double newline for readability

    // Get current content to avoid unnecessary updates
    const currentContent = notebookState.aceEditor.getValue();

    // Only update if content has actually changed
    if (currentContent !== fullContent) {
      // Update the Ace editor with the reconstructed content
      // Use setValue with cursor position 1 to move cursor to end
      notebookState.aceEditor.setValue(fullContent, 1);

      console.log(
        "Re-Redash: Synced",
        notebookState.cells.length,
        "cells to Ace editor"
      );
    }
  } catch (error) {
    console.warn("Re-Redash: Failed to sync cells to Ace editor:", error);
  }
}

/**
 * Execute query (placeholder - would integrate with Redash)
 * @param {string} query - SQL query to execute
 * @returns {Promise} Promise that resolves with query result
 */
function executeQuery(query) {
  alert("Query not found!");
}

/**
 * Get current notebook state (for debugging)
 * @returns {Object} Current state
 */
function getNotebookState() {
  return notebookState;
}

/**
 * Debug function to help troubleshoot editor detection issues
 */
function debugEditorDetection() {
  console.log("=== Re-Redash Editor Detection Debug ===");
  console.log("window.ace:", !!window.ace);
  console.log("window.editor:", !!window.editor);

  const elements = {
    ".ace_editor": document.querySelector(".ace_editor"),
    "#ace-editor": document.querySelector("#ace-editor"),
    textarea: document.querySelector("textarea"),
    ".query-editor": document.querySelector(".query-editor"),
    ".editor-container": document.querySelector(".editor-container"),
  };

  Object.entries(elements).forEach(([selector, element]) => {
    console.log(`${selector}:`, !!element, element);
  });

  console.log("Current notebookState:", notebookState);

  // Try to re-detect editor
  console.log("Attempting editor re-detection...");
  const found = findAceEditor();
  console.log("Re-detection result:", found);
  console.log("=====================================");

  return {
    windowAce: !!window.ace,
    windowEditor: !!window.editor,
    elements,
    notebookState,
    reDetectionResult: found,
  };
}

// Export functions for global access
window.reRedashNotebook = {
  init: initNotebook,
  toggleMode: toggleNotebookMode,
  addCell: addNewCell,
  runAll: runAllCells,
  getState: getNotebookState,
  debug: debugEditorDetection,
  findEditor: findAceEditor,
  findAndExecuteQuery: findAndExecuteQuery,
  executeSelectedQuery: executeSelectedQuery,
  findQuery: findAndExecuteQuery, // Alias for convenience
};

// Auto-initialize when script loads
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => initNotebook());
} else {
  initNotebook();
}
