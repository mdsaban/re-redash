/**
 * Re-Redash Chrome Extension - Content Script
 * Injects a script into the page context to access window.ace
 * and communicates with it through custom events
 */

// Global state for communication with injected script
let isInjectedScriptSetup = false;

/**
 * Inject CSS styles into the page
 */
function injectStyles() {
  try {
    // Inject notebook styles
    const notebookLink = document.createElement("link");
    notebookLink.rel = "stylesheet";
    notebookLink.href = chrome.runtime.getURL("notebook.css");
    notebookLink.onload = function () {
      console.log("Re-Redash: Notebook styles loaded successfully");
    };
    notebookLink.onerror = function () {
      console.error("Re-Redash: Failed to load notebook styles");
    };

    (document.head || document.documentElement).appendChild(notebookLink);

    // Inject table column visibility styles
    const columnVisibilityLink = document.createElement("link");
    columnVisibilityLink.rel = "stylesheet";
    columnVisibilityLink.href = chrome.runtime.getURL(
      "table-column-visibility.css"
    );
    columnVisibilityLink.onload = function () {
      console.log(
        "Re-Redash: Table column visibility styles loaded successfully"
      );
    };
    columnVisibilityLink.onerror = function () {
      console.error("Re-Redash: Failed to load table column visibility styles");
    };

    (document.head || document.documentElement).appendChild(
      columnVisibilityLink
    );
  } catch (error) {
    console.error("Re-Redash: Error injecting styles:", error);
  }
}

/**
 * Inject notebook script into the page context
 */
function injectNotebookScript() {
  try {
    const script = document.createElement("script");
    script.src = chrome.runtime.getURL("notebook.js");
    script.onload = function () {
      this.remove();
      console.log("Re-Redash: Notebook script loaded successfully");

      // Now load the table column visibility script
      injectTableColumnVisibilityScript();
    };
    script.onerror = function () {
      console.error("Re-Redash: Failed to load notebook script");
    };

    (document.head || document.documentElement).appendChild(script);
  } catch (error) {
    console.error("Re-Redash: Error injecting notebook script:", error);
  }
}

/**
 * Inject table column visibility script into the page context
 */
function injectTableColumnVisibilityScript() {
  try {
    const script = document.createElement("script");
    script.src = chrome.runtime.getURL("table-column-visibility.js");
    script.onload = function () {
      this.remove();
      console.log(
        "Re-Redash: Table column visibility script loaded successfully"
      );

      // Now load the completion handler
      loadCompletionHandler();
    };
    script.onerror = function () {
      console.error("Re-Redash: Failed to load table column visibility script");
    };

    (document.head || document.documentElement).appendChild(script);
  } catch (error) {
    console.error(
      "Re-Redash: Error injecting table column visibility script:",
      error
    );
  }
}

/**
 * Load completion handler into the page context
 */
function loadCompletionHandler() {
  try {
    const completionHandlerUrl = chrome.runtime.getURL("completion-handler.js");

    // Send message to injected script to load the completion handler
    window.dispatchEvent(
      new CustomEvent("loadCompletionHandler", {
        detail: { url: completionHandlerUrl },
      })
    );

    console.log("Re-Redash: Requested completion handler loading");
  } catch (error) {
    console.error("Re-Redash: Error loading completion handler:", error);
  }
}

/**
 * Inject the script into the page context
 */
function injectScript() {
  try {
    // Inject styles first
    injectStyles();

    // Create and inject the main script
    const script = document.createElement("script");
    script.src = chrome.runtime.getURL("inject.js");
    script.onload = function () {
      // Remove the script element after loading
      this.remove();
      console.log("Re-Redash: Injected script loaded successfully");

      // Now inject the notebook script
      injectNotebookScript();
    };
    script.onerror = function () {
      console.error("Re-Redash: Failed to load injected script");
    };

    // Inject into the page
    (document.head || document.documentElement).appendChild(script);
  } catch (error) {
    console.error("Re-Redash: Error injecting script:", error);
  }
}

/**
 * Send message to injected script
 * @param {string} action - The action to perform
 * @param {any} data - Data to send with the action
 */
function sendMessageToInjectedScript(action, data = null) {
  try {
    window.dispatchEvent(
      new CustomEvent("reRedashMessage", {
        detail: { action, data },
      })
    );
  } catch (error) {
    console.error(
      "Re-Redash: Error sending message to injected script:",
      error
    );
  }
}

/**
 * Set up event listeners for communication with injected script
 */
function setupEventListeners() {
  // Listen for setup completion from injected script
  window.addEventListener("reRedashSetupComplete", function (event) {
    const { success, error } = event.detail;
    if (success) {
      console.log("Re-Redash: Injected script setup completed successfully");
      isInjectedScriptSetup = true;
    } else {
      console.error("Re-Redash: Injected script setup failed:", error);
    }
  });

  // Listen for responses from injected script
  window.addEventListener("reRedashResponse", function (event) {
    const { action, data } = event.detail;
    console.log(
      "Re-Redash: Received response from injected script:",
      action,
      data
    );
    // Handle responses if needed
  });

  console.log(
    "Re-Redash: Event listeners set up for injected script communication"
  );
}

/**
 * Initialize the content script
 */
function initializeContentScript() {
  console.log("Re-Redash: Content script initialized");

  // Set up event listeners first
  setupEventListeners();

  // Inject the script into page context
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", injectScript);
  } else {
    injectScript();
  }
}

// Expose utility functions for debugging/extension purposes
window.reRedashContentScript = {
  sendMessage: sendMessageToInjectedScript,
  isSetup: () => isInjectedScriptSetup,
  reinitialize: () => {
    if (isInjectedScriptSetup) {
      sendMessageToInjectedScript("reinitialize");
    } else {
      console.warn("Re-Redash: Injected script not set up yet");
    }
  },
};

// Initialize the content script
initializeContentScript();
