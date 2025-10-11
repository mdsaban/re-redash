/**
 * Re-Redash Quick Search Module
 * Provides Cmd+K (Mac) or Ctrl+K (Windows/Linux) quick search for tables
 * with autocomplete and direct query execution
 */

// Global state for quick search
let quickSearchState = {
  modal: null,
  input: null,
  suggestionsContainer: null,
  isOpen: false,
  tables: [],
  filteredTables: [],
  selectedIndex: -1,
};

/**
 * Initialize quick search functionality
 */
function initQuickSearch() {
  customLogger.log("Re-Redash: Initializing quick search...");

  // Create modal elements
  createQuickSearchModal();

  // Setup keyboard shortcut listener
  setupKeyboardShortcut();

  // Listen for completions loaded event
  window.addEventListener("completionsLoaded", handleCompletionsLoaded);

  // Load tables from localStorage cache
  loadTablesFromCache();

  customLogger.log("Re-Redash: Quick search initialized");
}

/**
 * Create the quick search modal and its elements
 */
function createQuickSearchModal() {
  // Create modal overlay
  const modal = document.createElement("div");
  modal.className = "quick-search-modal";
  modal.style.display = "none";

  // Create modal content
  const modalContent = document.createElement("div");
  modalContent.className = "quick-search-content";

  // Create search input
  const searchInput = document.createElement("input");
  searchInput.type = "text";
  searchInput.className = "quick-search-input";
  searchInput.placeholder = "Search tables... (Type to filter)";
  searchInput.autocomplete = "off";
  searchInput.spellcheck = false;

  // Create suggestions container
  const suggestionsContainer = document.createElement("div");
  suggestionsContainer.className = "quick-search-suggestions";

  // Create info text
  const infoText = document.createElement("div");
  infoText.className = "quick-search-info";
  infoText.innerHTML = `
    <div class="quick-search-shortcuts">
      <span><kbd>↑</kbd><kbd>↓</kbd> Navigate</span>
      <span><kbd>Enter</kbd> Select</span>
      <span><kbd>Esc</kbd> Close</span>
    </div>
  `;

  // Assemble modal
  modalContent.appendChild(searchInput);
  modalContent.appendChild(suggestionsContainer);
  modalContent.appendChild(infoText);
  modal.appendChild(modalContent);

  // Add to document
  document.body.appendChild(modal);

  // Store references
  quickSearchState.modal = modal;
  quickSearchState.input = searchInput;
  quickSearchState.suggestionsContainer = suggestionsContainer;

  // Setup event listeners
  setupModalEventListeners();

  customLogger.log("Re-Redash: Quick search modal created");
}

/**
 * Setup event listeners for modal interactions
 */
function setupModalEventListeners() {
  const { modal, input, suggestionsContainer } = quickSearchState;

  // Input event - filter tables as user types
  input.addEventListener("input", handleSearchInput);

  // Keyboard navigation
  input.addEventListener("keydown", handleKeyboardNavigation);

  // Click on suggestion
  suggestionsContainer.addEventListener("click", handleSuggestionClick);

  // Click outside modal to close
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      closeQuickSearch();
    }
  });

  // Prevent modal content clicks from closing modal
  modal
    .querySelector(".quick-search-content")
    .addEventListener("click", (e) => {
      e.stopPropagation();
    });
}

/**
 * Setup keyboard shortcut (Cmd+K on Mac, Ctrl+K on Windows/Linux)
 */
function setupKeyboardShortcut() {
  document.addEventListener("keydown", (e) => {
    // Check for Cmd+K (Mac) or Ctrl+K (Windows/Linux)
    const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
    const modifierKey = isMac ? e.metaKey : e.ctrlKey;

    if (modifierKey && e.key === "k") {
      e.preventDefault();
      e.stopPropagation();

      if (quickSearchState.isOpen) {
        closeQuickSearch();
      } else {
        openQuickSearch();
      }
    }

    // Close on Escape key
    if (e.key === "Escape" && quickSearchState.isOpen) {
      closeQuickSearch();
    }
  });

  customLogger.log("Re-Redash: Keyboard shortcut setup complete");
}

/**
 * Load tables from cached completions in localStorage
 */
function loadTablesFromCache() {
  try {
    customLogger.log("Re-Redash: Loading tables from localStorage cache...");

    const cached = localStorage.getItem("re-redash-completions");
    if (!cached) {
      customLogger.warn(
        "Re-Redash: No cached completions found in localStorage"
      );
      return;
    }

    const parsedData = JSON.parse(cached);
    if (!parsedData || !parsedData.data || !parsedData.data.allCompletions) {
      customLogger.warn("Re-Redash: Invalid cached completions data structure");
      return;
    }

    // Filter completions where meta === "Table"
    const tableCompletions = parsedData.data.allCompletions.filter(
      (completion) => completion.meta === "Table"
    );

    customLogger.log(
      `Re-Redash: Found ${tableCompletions.length} table completions`
    );

    // Extract table names
    quickSearchState.tables = tableCompletions.map((completion) => ({
      name: completion.value || completion.caption || completion.name,
      displayName: completion.caption || completion.value || completion.name,
    }));

    // Remove duplicates
    const uniqueTables = {};
    quickSearchState.tables = quickSearchState.tables.filter((table) => {
      if (uniqueTables[table.name]) {
        return false;
      }
      uniqueTables[table.name] = true;
      return true;
    });

    customLogger.log(
      `Re-Redash: Loaded ${quickSearchState.tables.length} unique tables for quick search`
    );
  } catch (error) {
    customLogger.error("Re-Redash: Error loading tables from cache:", error);
  }
}

/**
 * Handle completions loaded event
 */
function handleCompletionsLoaded(event) {
  customLogger.log(
    "Re-Redash: Completions loaded event received, reloading tables..."
  );
  loadTablesFromCache();
}

/**
 * Open the quick search modal
 */
function openQuickSearch() {
  customLogger.log("Re-Redash: Opening quick search modal...");

  // Reload tables from cache in case they were updated
  loadTablesFromCache();

  customLogger.log(
    `Re-Redash: Total tables available: ${quickSearchState.tables.length}`
  );

  if (quickSearchState.tables.length === 0) {
    customLogger.warn(
      "Re-Redash: No tables available for quick search. Tables may still be loading."
    );
    // Still open the modal, but show a loading message
    quickSearchState.input.placeholder =
      "Loading tables... Please wait or try again in a moment";
  } else {
    quickSearchState.input.placeholder = "Search tables... (Type to filter)";
  }

  quickSearchState.modal.style.display = "flex";
  quickSearchState.isOpen = true;
  quickSearchState.selectedIndex = -1;

  // Clear previous search
  quickSearchState.input.value = "";

  // Show all tables initially
  quickSearchState.filteredTables = [...quickSearchState.tables];
  customLogger.log(
    `Re-Redash: Filtered tables to display: ${quickSearchState.filteredTables.length}`
  );

  // Auto-select first item if tables are available
  if (quickSearchState.filteredTables.length > 0) {
    quickSearchState.selectedIndex = 0;
  }

  renderSuggestions();

  // Focus input
  setTimeout(() => {
    quickSearchState.input.focus();
  }, 100);

  customLogger.log("Re-Redash: Quick search opened");
}

/**
 * Close the quick search modal
 */
function closeQuickSearch() {
  quickSearchState.modal.style.display = "none";
  quickSearchState.isOpen = false;
  quickSearchState.filteredTables = [];
  quickSearchState.selectedIndex = -1;
  quickSearchState.input.value = "";
  quickSearchState.suggestionsContainer.innerHTML = "";

  customLogger.log("Re-Redash: Quick search closed");
}

/**
 * Handle search input changes
 */
function handleSearchInput(e) {
  const query = e.target.value.trim().toLowerCase();

  if (!query) {
    // Show all tables if search is empty
    quickSearchState.filteredTables = [...quickSearchState.tables];
  } else {
    // Filter tables based on query
    quickSearchState.filteredTables = quickSearchState.tables.filter((table) =>
      table.name.toLowerCase().includes(query)
    );
  }

  // Auto-select first item if results exist
  quickSearchState.selectedIndex =
    quickSearchState.filteredTables.length > 0 ? 0 : -1;
  renderSuggestions();
}

/**
 * Handle keyboard navigation
 */
function handleKeyboardNavigation(e) {
  const { filteredTables, selectedIndex } = quickSearchState;

  switch (e.key) {
    case "ArrowDown":
      e.preventDefault();
      quickSearchState.selectedIndex = Math.min(
        selectedIndex + 1,
        filteredTables.length - 1
      );
      renderSuggestions();
      scrollToSelected();
      break;

    case "ArrowUp":
      e.preventDefault();
      quickSearchState.selectedIndex = Math.max(selectedIndex - 1, 0);
      renderSuggestions();
      scrollToSelected();
      break;

    case "Enter":
      e.preventDefault();
      if (selectedIndex >= 0 && filteredTables[selectedIndex]) {
        selectTable(filteredTables[selectedIndex].name);
      } else if (filteredTables.length === 1) {
        // If only one result, select it
        selectTable(filteredTables[0].name);
      }
      break;

    case "Escape":
      e.preventDefault();
      closeQuickSearch();
      break;
  }
}

/**
 * Handle suggestion click
 */
function handleSuggestionClick(e) {
  const suggestionItem = e.target.closest(".quick-search-suggestion-item");
  if (!suggestionItem) return;

  const tableName = suggestionItem.dataset.tableName;
  if (tableName) {
    selectTable(tableName);
  }
}

/**
 * Select a table and execute query
 */
function selectTable(tableName) {
  customLogger.log(`Re-Redash: Table selected: ${tableName}`);

  // Close modal
  closeQuickSearch();

  // Create and execute the SELECT query
  const query = `SELECT * FROM ${tableName} LIMIT 100`;
  customLogger.log(`Re-Redash: Executing query: ${query}`);

  // Use the existing executeTableQuery function from notebook.js
  if (
    window.reRedashNotebook &&
    typeof window.reRedashNotebook.executeTableQuery === "function"
  ) {
    window.reRedashNotebook.executeTableQuery(query);
  } else {
    customLogger.warn(
      "Re-Redash: executeTableQuery function not found. Cannot execute query."
    );
    // Fallback: try to insert into editor
    if (window.notebookState && window.notebookState.aceEditor) {
      window.notebookState.aceEditor.setValue(query, 1);
    }
  }
}

/**
 * Render suggestions list
 */
function renderSuggestions() {
  const { filteredTables, selectedIndex, suggestionsContainer } =
    quickSearchState;

  customLogger.log(
    `Re-Redash: Rendering ${filteredTables.length} suggestions...`
  );

  if (filteredTables.length === 0) {
    customLogger.log(
      "Re-Redash: No filtered tables, showing 'No tables found' message"
    );
    suggestionsContainer.innerHTML = `
      <div class="quick-search-no-results">
        <i class="zmdi zmdi-search"></i>
        <p>No tables found</p>
      </div>
    `;
    return;
  }

  // Limit to first 100 results for performance
  const displayTables = filteredTables.slice(0, 100);
  customLogger.log(`Re-Redash: Displaying ${displayTables.length} tables`);

  suggestionsContainer.innerHTML = displayTables
    .map(
      (table, index) => `
      <div
        class="quick-search-suggestion-item ${
          index === selectedIndex ? "selected" : ""
        }"
        data-table-name="${table.name}"
        data-index="${index}"
      >
        <i class="zmdi zmdi-storage"></i>
        <span class="table-name">${highlightMatch(
          table.name,
          quickSearchState.input.value
        )}</span>
        <span class="query-preview">SELECT * FROM ${table.name} LIMIT 100</span>
      </div>
    `
    )
    .join("");

  customLogger.log("Re-Redash: Suggestions rendered to DOM");

  // Show count if more than displayed
  if (filteredTables.length > displayTables.length) {
    const countInfo = document.createElement("div");
    countInfo.className = "quick-search-count-info";
    countInfo.textContent = `Showing ${displayTables.length} of ${filteredTables.length} tables`;
    suggestionsContainer.appendChild(countInfo);
  }
}

/**
 * Highlight matching text in table name
 */
function highlightMatch(tableName, query) {
  if (!query) return tableName;

  const regex = new RegExp(`(${query})`, "gi");
  return tableName.replace(regex, "<mark>$1</mark>");
}

/**
 * Scroll to selected suggestion
 */
function scrollToSelected() {
  const selectedItem = quickSearchState.suggestionsContainer.querySelector(
    ".quick-search-suggestion-item.selected"
  );

  if (selectedItem) {
    selectedItem.scrollIntoView({
      block: "nearest",
      behavior: "smooth",
    });
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initQuickSearch);
} else {
  // DOM already loaded, initialize immediately with small delay for other modules
  setTimeout(initQuickSearch, 1000);
}
