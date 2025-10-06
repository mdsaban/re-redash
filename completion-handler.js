/**
 * Re-Redash Completion Handler
 * Fetches and manages SQL completions from the main Ace Editor
 */

// Global completion data with persistence
let completionData = {
  tables: [],
  columns: {},
  keywords: [],
  functions: [],
  allCompletions: [],
  originalCompleters: null, // Store original completers
  isLoaded: false,
};

// Try to load cached completions from localStorage
function loadCachedCompletions() {
  try {
    const cached = localStorage.getItem("re-redash-completions");
    if (cached) {
      const parsedData = JSON.parse(cached);
      if (
        parsedData &&
        parsedData.timestamp &&
        Date.now() - parsedData.timestamp < 3600000
      ) {
        // 1 hour cache
        completionData = { ...completionData, ...parsedData.data };
        customLogger.log(
          "Re-Redash: Loaded cached completions:",
          completionData.allCompletions.length
        );
        return true;
      }
    }
  } catch (error) {
    customLogger.warn("Re-Redash: Failed to load cached completions:", error);
  }
  return false;
}

// Save completions to localStorage
function saveCompletionsToCache() {
  try {
    const cacheData = {
      timestamp: Date.now(),
      data: {
        tables: completionData.tables,
        columns: completionData.columns,
        keywords: completionData.keywords,
        functions: completionData.functions,
        allCompletions: completionData.allCompletions,
        isLoaded: true,
      },
    };
    localStorage.setItem("re-redash-completions", JSON.stringify(cacheData));
    customLogger.log("Re-Redash: Saved completions to cache");
  } catch (error) {
    customLogger.warn("Re-Redash: Failed to save completions to cache:", error);
  }
}

/**
 * Find the main Ace Editor instance using the direct approach
 */
function findMainAceEditor() {
  try {
    // Method 1: Direct approach using #ace-editor.env.editor (recommended)
    const aceElement = document.querySelector("#ace-editor");
    if (aceElement && aceElement.env && aceElement.env.editor) {
      const editor = aceElement.env.editor;
      if (editor.completers && editor.completers.length > 0) {
        customLogger.log("Re-Redash: Found editor via #ace-editor.env.editor");
        return editor;
      }
    }

    // Method 2: Try other ace editor elements with .env.editor
    const aceEditors = document.querySelectorAll(".ace_editor");
    for (const element of aceEditors) {
      if (element.env && element.env.editor) {
        const editor = element.env.editor;
        if (editor.completers && editor.completers.length > 0) {
          customLogger.log(
            "Re-Redash: Found editor via .ace_editor.env.editor"
          );
          return editor;
        }
      }
    }

    // Method 3: Fallback to window.ace.edit approach
    if (window.ace && window.ace.edit) {
      const selectors = [".ace_editor", "#ace-editor"];
      for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element && element.classList.contains("ace_editor")) {
          try {
            const editor = window.ace.edit(element);
            if (editor && editor.completers) {
              customLogger.log(
                `Re-Redash: Found editor via window.ace.edit(${selector})`
              );
              return editor;
            }
          } catch (error) {
            customLogger.warn("Re-Redash: Failed to access ace editor:", error);
          }
        }
      }
    }

    // Method 4: Check for global editor instances
    const globalEditorNames = [
      "editor",
      "aceEditor",
      "queryEditor",
      "sqlEditor",
    ];
    for (const name of globalEditorNames) {
      if (window[name] && typeof window[name].getValue === "function") {
        customLogger.log(`Re-Redash: Found editor via window.${name}`);
        return window[name];
      }
    }
  } catch (error) {
    customLogger.error("Re-Redash: Error finding main ace editor:", error);
  }

  return null;
}

/**
 * Fetch completions from the main Ace Editor
 */
function fetchCompletions() {
  customLogger.log("Re-Redash: Attempting to fetch completions...");

  // Find the main Ace Editor
  const aceEditor = findMainAceEditor();
  if (!aceEditor) {
    customLogger.warn("Re-Redash: No Ace Editor found");
    return false;
  }

  if (!aceEditor.completers || aceEditor.completers.length === 0) {
    customLogger.warn("Re-Redash: No completers found in main editor");
    return false;
  }

  customLogger.log(
    `Re-Redash: Found ${aceEditor.completers.length} completers`
  );

  // Store original completers for persistence
  completionData.originalCompleters = aceEditor.completers.slice(); // Create a copy
  customLogger.log(
    "Re-Redash: Stored original completers:",
    completionData.originalCompleters.length,
    "completers"
  );
  customLogger.log(
    "Re-Redash: Original completers details:",
    completionData.originalCompleters.map(
      (c) => c.constructor.name || "Unknown"
    )
  );

  // Fetch completions using the exact approach provided by user
  let session = aceEditor.getSession();
  let pos = aceEditor.getCursorPosition();
  let prefix = aceEditor.session
    .getLine(pos.row)
    .slice(0, pos.column)
    .split(/\s+/)
    .pop();

  let allCompletions = [];

  let promises = aceEditor.completers.map(
    (c) =>
      new Promise((resolve) => {
        c.getCompletions(aceEditor, session, pos, prefix, (err, results) => {
          resolve(results || []);
        });
      })
  );

  Promise.all(promises)
    .then((resultsArrays) => {
      let allCompletions = resultsArrays.flat();
      customLogger.log(
        `Re-Redash: Fetched ${allCompletions.length} total completions`
      );

      if (allCompletions.length > 0) {
        processCompletions(allCompletions);
        completionData.isLoaded = true;

        // Save to cache for persistence
        saveCompletionsToCache();

        // Log sample completions
        customLogger.log("Re-Redash: handler completions:", allCompletions);

        // Trigger event for notebook cells to update
        window.dispatchEvent(
          new CustomEvent("completionsLoaded", {
            detail: completionData,
          })
        );
      }
    })
    .catch((error) => {
      customLogger.error("Re-Redash: Error fetching completions:", error);
    });

  return true;
}

/**
 * Process and categorize completions
 */
function processCompletions(allCompletions) {
  const tables = new Set();
  const columns = {};
  const keywords = new Set();
  const functions = new Set();

  allCompletions.forEach((completion) => {
    const value = completion.value || completion.name || completion.caption;
    const meta = completion.meta || "";
    const type = completion.type || "";

    if (!value) return;

    // Categorize based on meta and type
    if (meta.includes("table") || type.includes("table")) {
      tables.add(value);
    } else if (meta.includes("column") || type.includes("column")) {
      // Try to extract table name if available
      const tableName = completion.table || "unknown";
      if (!columns[tableName]) {
        columns[tableName] = new Set();
      }
      columns[tableName].add(value);
    } else if (meta.includes("keyword") || type.includes("keyword")) {
      keywords.add(value);
    } else if (meta.includes("function") || type.includes("function")) {
      functions.add(value);
    }
  });

  // Convert sets to arrays
  completionData.tables = Array.from(tables);
  completionData.columns = Object.fromEntries(
    Object.entries(columns).map(([table, cols]) => [table, Array.from(cols)])
  );
  completionData.keywords = Array.from(keywords);
  completionData.functions = Array.from(functions);
  completionData.allCompletions = allCompletions;

  customLogger.log("Re-Redash: Processed completions:", {
    tables: completionData.tables.length,
    columns: Object.keys(completionData.columns).length,
    keywords: completionData.keywords.length,
    functions: completionData.functions.length,
    total: allCompletions.length,
  });
}

/**
 * Get completions for a given prefix
 */
function getCompletionsForPrefix(prefix) {
  if (!completionData.isLoaded) {
    return [];
  }

  const lowerPrefix = prefix.toLowerCase();
  return completionData.allCompletions.filter((completion) => {
    const value = (
      completion.value ||
      completion.name ||
      completion.caption ||
      ""
    ).toLowerCase();
    return value.startsWith(lowerPrefix);
  });
}

/**
 * Get schema suggestions (tables and columns)
 */
function getSchemaSuggestions() {
  return {
    tables: completionData.tables,
    columns: completionData.columns,
    isLoaded: completionData.isLoaded,
  };
}

/**
 * Initialize completion fetching on page load
 */
function initCompletionHandler() {
  customLogger.log("Re-Redash: Initializing completion handler...");

  // First try to load cached completions
  if (loadCachedCompletions()) {
    // Trigger event for notebook cells even with cached data
    window.dispatchEvent(
      new CustomEvent("completionsLoaded", {
        detail: completionData,
      })
    );
  }

  // Wait for page to be fully loaded
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", fetchCompletions);
  } else {
    // Try multiple times to ensure editor is ready
    let attempts = 0;
    const maxAttempts = 10;

    function tryFetch() {
      attempts++;
      customLogger.log(
        `###Re-Redash: Fetch attempt ${attempts}/${maxAttempts}`
      );

      if (fetchCompletions()) {
        customLogger.log("###Re-Redash: Completions fetched successfully");
        return;
      }

      if (attempts < maxAttempts) {
        setTimeout(tryFetch, 1000); // Wait 1 second between attempts
      } else {
        customLogger.warn(
          "Re-Redash: Failed to fetch completions after maximum attempts"
        );
        // Even if fetching fails, make cached completions available
        if (completionData.isLoaded) {
          window.dispatchEvent(
            new CustomEvent("completionsLoaded", {
              detail: completionData,
            })
          );
        }
      }
    }

    setTimeout(() => {
      tryFetch();
    }, 2000); // Wait 1 second before trying to fetch completions
  }
}

/**
 * Data source monitoring state
 */
let dataSourceMonitoring = {
  currentDataSource: null,
  observer: null,
  isEnabled: false,
  refreshTimeout: null,
};

/**
 * Get current data source value
 */
function getCurrentDataSource() {
  try {
    const dataSourceElement = document.querySelector(
      ".editor__left__data-source .ant-select-selection-item"
    );
    return dataSourceElement ? dataSourceElement.innerText.trim() : null;
  } catch (error) {
    customLogger.warn("Re-Redash: Error getting current data source:", error);
    return null;
  }
}

/**
 * Handle data source change
 */
function handleDataSourceChange(newDataSource) {
  customLogger.log("Re-Redash: Data source changed:", {
    from: dataSourceMonitoring.currentDataSource,
    to: newDataSource,
  });

  // Clear any existing timeout
  if (dataSourceMonitoring.refreshTimeout) {
    clearTimeout(dataSourceMonitoring.refreshTimeout);
  }

  // Update current data source
  dataSourceMonitoring.currentDataSource = newDataSource;

  // Clear cached completions since schema will be different
  try {
    localStorage.removeItem("re-redash-completions");
    customLogger.log(
      "Re-Redash: Cleared cached completions due to data source change"
    );
  } catch (error) {
    customLogger.warn("Re-Redash: Failed to clear cached completions:", error);
  }

  // Reset completion data
  completionData = {
    tables: [],
    columns: {},
    keywords: [],
    functions: [],
    allCompletions: [],
    originalCompleters: completionData.originalCompleters, // Keep original completers
    isLoaded: false,
  };

  // Refresh completions after a 1-second delay to allow database switch to complete
  dataSourceMonitoring.refreshTimeout = setTimeout(() => {
    customLogger.log(
      "Re-Redash: Refreshing completions after data source change..."
    );

    // Re-fetch completions for the new database
    fetchCompletions();

    // Trigger event to notify all editors about the completion refresh
    window.dispatchEvent(
      new CustomEvent("dataSourceChanged", {
        detail: {
          newDataSource: newDataSource,
          completionData: completionData,
        },
      })
    );
  }, 1000); // 1 second delay as requested
}

/**
 * Start monitoring data source changes
 */
function startDataSourceMonitoring() {
  if (dataSourceMonitoring.isEnabled) {
    customLogger.log("Re-Redash: Data source monitoring already enabled");
    return;
  }

  try {
    // Get initial data source
    dataSourceMonitoring.currentDataSource = getCurrentDataSource();
    customLogger.log(
      "Re-Redash: Initial data source:",
      dataSourceMonitoring.currentDataSource
    );

    // Create observer to watch for changes in the data source selector
    dataSourceMonitoring.observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (
          mutation.type === "childList" ||
          mutation.type === "characterData"
        ) {
          const currentDataSource = getCurrentDataSource();

          // Check if data source actually changed
          if (
            currentDataSource &&
            currentDataSource !== dataSourceMonitoring.currentDataSource
          ) {
            handleDataSourceChange(currentDataSource);
          }
        }
      });
    });

    // Start observing changes to the data source selector area
    const targetElement = document.querySelector(".editor__left__data-source");
    if (targetElement) {
      dataSourceMonitoring.observer.observe(targetElement, {
        childList: true,
        subtree: true,
        characterData: true,
      });

      dataSourceMonitoring.isEnabled = true;
      customLogger.log(
        "Re-Redash: Data source monitoring started successfully"
      );
    } else {
      customLogger.warn(
        "Re-Redash: Data source selector not found, retrying in 2 seconds..."
      );
      setTimeout(startDataSourceMonitoring, 2000);
    }
  } catch (error) {
    customLogger.error(
      "Re-Redash: Error starting data source monitoring:",
      error
    );
  }
}

/**
 * Stop monitoring data source changes
 */
function stopDataSourceMonitoring() {
  if (dataSourceMonitoring.observer) {
    dataSourceMonitoring.observer.disconnect();
    dataSourceMonitoring.observer = null;
  }

  if (dataSourceMonitoring.refreshTimeout) {
    clearTimeout(dataSourceMonitoring.refreshTimeout);
    dataSourceMonitoring.refreshTimeout = null;
  }

  dataSourceMonitoring.isEnabled = false;
  customLogger.log("Re-Redash: Data source monitoring stopped");
}

// Auto-initialize when script loads
initCompletionHandler();

// Start data source monitoring after initialization
setTimeout(() => {
  startDataSourceMonitoring();
}, 2000); // Wait 2 seconds for page to fully load

// Export functions for use by notebook
window.CompletionHandler = {
  getCompletionsForPrefix,
  getSchemaSuggestions,
  isLoaded: () => completionData.isLoaded,
  refresh: fetchCompletions,
  getAllCompletions: () => completionData.allCompletions,
  getOriginalCompleters: () => completionData.originalCompleters,
  // Data source monitoring controls
  startDataSourceMonitoring,
  stopDataSourceMonitoring,
  getCurrentDataSource,
  isDataSourceMonitoringEnabled: () => dataSourceMonitoring.isEnabled,
  // Method to restore completers to any ace editor
  restoreCompletersTo: (editor) => {
    customLogger.log("Re-Redash: Attempting to restore completers...");
    customLogger.log(
      "Re-Redash: Original completers available:",
      !!completionData.originalCompleters
    );
    customLogger.log("Re-Redash: Editor provided:", !!editor);

    if (completionData.originalCompleters && editor) {
      customLogger.log(
        "Re-Redash: Restoring",
        completionData.originalCompleters.length,
        "completers"
      );
      editor.completers = completionData.originalCompleters.slice(); // Create a copy
      customLogger.log(
        "Re-Redash: Editor now has",
        editor.completers.length,
        "completers"
      );
      customLogger.log(
        "Re-Redash: Restored completers:",
        editor.completers.map((c) => c.constructor.name || "Unknown")
      );
      return true;
    }
    customLogger.log(
      "Re-Redash: Failed to restore completers - missing data or editor"
    );
    return false;
  },
};
