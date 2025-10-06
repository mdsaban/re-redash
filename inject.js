/**
 * Re-Redash Chrome Extension - Injected Script
 * This script runs in the page context to access window.ace
 * and communicates with the content script through custom events
 */

(function () {
  "use strict";

  // Configuration constants
  const CONFIG = {
    STORAGE_KEY: "re-redash-query",
    DEBOUNCE_DELAY: 500, // ms
    ACE_EDITOR_ID: "ace-editor",
    RETRY_DELAY: 1000, // ms
    MAX_RETRIES: 10,
  };

  // Global state
  let debounceTimer = null;
  let aceEditor = null;
  let isListenerAttached = false;

  /**
   * Save query to localStorage
   * @param {string} query - The query string to save
   */
  function saveQuery(query) {
    try {
      if (query && query.trim()) {
        localStorage.setItem(CONFIG.STORAGE_KEY, query.trim());
        customLogger.log("Re-Redash: Query saved to localStorage");
      } else {
        // Remove from localStorage if query is empty
        localStorage.removeItem(CONFIG.STORAGE_KEY);
        customLogger.log("Re-Redash: Empty query - removed from localStorage");
      }
    } catch (error) {
      customLogger.error(
        "Re-Redash: Error saving query to localStorage:",
        error
      );
    }
  }

  /**
   * Debounced save function to avoid excessive localStorage writes
   * @param {string} value - The query value to save
   */
  function debouncedSave(value) {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      saveQuery(value);
    }, CONFIG.DEBOUNCE_DELAY);
  }

  /**
   * Get the currently saved query
   * @returns {string|null} The saved query or null if none exists
   */
  function getSavedQuery() {
    try {
      return localStorage.getItem(CONFIG.STORAGE_KEY);
    } catch (error) {
      customLogger.error("Re-Redash: Error getting saved query:", error);
      return null;
    }
  }

  /**
   * Clear the saved query
   */
  function clearSavedQuery() {
    try {
      localStorage.removeItem(CONFIG.STORAGE_KEY);
      customLogger.log("Re-Redash: Saved query cleared");
    } catch (error) {
      customLogger.error("Re-Redash: Error clearing saved query:", error);
    }
  }

  /**
   * Restore saved query to the Ace Editor
   * @param {boolean} forceRestore - Force restore even if editor has content
   */
  function restoreSavedQuery(forceRestore = false) {
    try {
      if (!aceEditor) {
        customLogger.warn("Re-Redash: Ace editor not available for restore");
        return;
      }

      const savedQuery = getSavedQuery();
      if (savedQuery) {
        const currentValue = aceEditor.getValue();

        // Only restore if editor is empty or force restore is requested
        if (forceRestore || !currentValue.trim()) {
          aceEditor.setValue(savedQuery, 1); // 1 moves cursor to end
          customLogger.log("Re-Redash: Restored saved query to Ace editor");
        }
      }
    } catch (error) {
      customLogger.error("Re-Redash: Error restoring saved query:", error);
    }
  }

  /**
   * Attach event listeners to the Ace Editor
   */
  function attachAceEditorListeners() {
    if (!aceEditor || isListenerAttached) {
      return;
    }

    try {
      // Listen for changes in the editor content
      aceEditor.on("change", () => {
        const currentValue = aceEditor.getValue();
        debouncedSave(currentValue);
      });

      // Listen for paste events
      aceEditor.on("paste", () => {
        // Use setTimeout to get the value after paste is processed
        setTimeout(() => {
          const currentValue = aceEditor.getValue();
          saveQuery(currentValue);
        }, 10);
      });

      // Listen for focus events to restore saved query if editor is empty
      aceEditor.on("focus", () => {
        const currentValue = aceEditor.getValue();
        if (!currentValue.trim()) {
          restoreSavedQuery();
        }
      });

      isListenerAttached = true;
      customLogger.log("Re-Redash: Event listeners attached to Ace editor");
    } catch (error) {
      customLogger.error(
        "Re-Redash: Error attaching event listeners to Ace editor:",
        error
      );
    }
  }

  /**
   * Find and initialize the Ace Editor instance
   */
  function findAceEditor() {
    try {
      // Check if ace is available in the page context
      if (!window.ace) {
        customLogger.log("Re-Redash: window.ace not available yet");
        return false;
      }

      // Try to get editor by ID first
      customLogger.log(
        "Re-Redash: Finding Ace editor...",
        !!document.getElementById(CONFIG.ACE_EDITOR_ID)
      );

      if (document.getElementById(CONFIG.ACE_EDITOR_ID)) {
        aceEditor = window.ace.edit(CONFIG.ACE_EDITOR_ID);
        customLogger.log("Re-Redash: Found Ace editor by ID");
        return true;
      }

      // Try to find editor through global ace object
      if (window.ace && window.ace.edit) {
        const editorElement = document.querySelector(".ace_editor");
        if (editorElement) {
          aceEditor = window.ace.edit(editorElement);
          customLogger.log("Re-Redash: Found Ace editor by element");
          return true;
        }
      }

      // Try to find editor in global scope
      if (window.editor && typeof window.editor.getValue === "function") {
        aceEditor = window.editor;
        customLogger.log("Re-Redash: Found Ace editor in window.editor");
        return true;
      }

      return false;
    } catch (error) {
      customLogger.error("Re-Redash: Error finding Ace editor:", error);
      return false;
    }
  }

  /**
   * Setup the query saver with retry mechanism
   * @param {number} retryCount - Current retry attempt
   */
  function setupQuerySaver(retryCount = 0) {
    try {
      if (findAceEditor()) {
        // Successfully found the editor
        attachAceEditorListeners();
        restoreSavedQuery();
        customLogger.log("Re-Redash: Query saver setup complete");

        // Dispatch custom event to notify content script that setup is complete
        window.dispatchEvent(
          new CustomEvent("reRedashSetupComplete", {
            detail: { success: true },
          })
        );
      } else if (retryCount < CONFIG.MAX_RETRIES) {
        // Retry after delay
        customLogger.log(
          `Re-Redash: Ace editor not found, retrying... (${retryCount + 1}/${
            CONFIG.MAX_RETRIES
          })`
        );
        setTimeout(() => {
          setupQuerySaver(retryCount + 1);
        }, CONFIG.RETRY_DELAY);
      } else {
        customLogger.warn(
          "Re-Redash: Max retries reached, could not find Ace editor"
        );

        // Dispatch custom event to notify content script that setup failed
        window.dispatchEvent(
          new CustomEvent("reRedashSetupComplete", {
            detail: { success: false, error: "Max retries reached" },
          })
        );
      }
    } catch (error) {
      customLogger.error("Re-Redash: Error setting up query saver:", error);

      // Dispatch custom event to notify content script of error
      window.dispatchEvent(
        new CustomEvent("reRedashSetupComplete", {
          detail: { success: false, error: error.message },
        })
      );
    }
  }

  /**
   * Initialize the query saver functionality
   */
  function initializeQuerySaver() {
    customLogger.log("Re-Redash: Injected script initialized");

    // Wait for DOM to be ready and setup
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => setupQuerySaver());
    } else {
      setupQuerySaver();
    }
  }

  // Listen for messages from content script
  window.addEventListener("reRedashMessage", function (event) {
    const { action, data } = event.detail;

    switch (action) {
      case "getSavedQuery":
        const savedQuery = getSavedQuery();
        window.dispatchEvent(
          new CustomEvent("reRedashResponse", {
            detail: { action: "getSavedQuery", data: savedQuery },
          })
        );
        break;

      case "saveQuery":
        saveQuery(data);
        break;

      case "clearSavedQuery":
        clearSavedQuery();
        break;

      case "restoreSavedQuery":
        restoreSavedQuery(data?.forceRestore || false);
        break;

      case "reinitialize":
        setupQuerySaver();
        break;

      default:
        customLogger.warn("Re-Redash: Unknown action:", action);
    }
  });

  // Expose utility functions to global scope for debugging/extension purposes
  window.reRedashQuerySaver = {
    saveQuery,
    getSavedQuery,
    clearSavedQuery,
    restoreSavedQuery,
    getAceEditor: () => aceEditor,
    reinitialize: () => setupQuerySaver(),
  };

  // Initialize the functionality when the script loads
  initializeQuerySaver();

  // Listen for completion handler load request from content script
  window.addEventListener("loadCompletionHandler", function (event) {
    const script = document.createElement("script");
    script.src = event.detail.url;
    script.onload = function () {
      customLogger.log("Re-Redash: Completion handler loaded");
      window.dispatchEvent(new CustomEvent("completionHandlerLoaded"));
    };
    script.onerror = function (error) {
      customLogger.error(
        "Re-Redash: Failed to load completion handler:",
        error
      );
    };
    (document.head || document.documentElement).appendChild(script);
  });
})();
