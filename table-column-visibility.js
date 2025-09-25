/**
 * Re-Redash Table Column Visibility Module - Simple Version
 * Adds a single eye icon that changes color and shows tooltip with column name when hidden
 */

// Configuration constants
const COLUMN_VISIBILITY_CONFIG = {
  targetColumnClass: "ant-table-column-has-sorters",
  eyeIconClass: "column-visibility-toggle",
  hiddenColumnClass: "column-hidden",
  storageKey: "re-redash-hidden-columns",
  debounceDelay: 100,
  eyeVisibleIcon: "zmdi-eye-off",
  eyeHiddenIcon: "zmdi-eye",
  visibleColor: "#1890ff",
  hiddenColor: "#1890ff",
};

// Global state for column visibility
let columnVisibilityState = {
  hiddenColumns: new Set(),
  debounceTimer: null,
  isInitialized: false,
  observer: null,
  dataSourceObserver: null,
  currentDataSource: null,
  reinitTimer: null,
};

/**
 * Save hidden columns state to localStorage - DISABLED
 * Columns will not be persisted and will show all columns on every query run
 */
function saveHiddenColumnsState() {
  // Disabled - no longer saving to localStorage
  console.log(
    "Re-Redash: Column state persistence disabled - columns will reset on reload"
  );
}

/**
 * Load hidden columns state from localStorage - DISABLED
 * Always start with all columns visible
 */
function loadHiddenColumnsState() {
  // Disabled - always start with empty hidden columns set
  columnVisibilityState.hiddenColumns = new Set();
  console.log("Re-Redash: Starting with all columns visible - no persistence");
}

/**
 * Generate a unique identifier for a column based on its content and position
 * @param {HTMLElement} columnHeader - The column header element
 * @param {number} columnIndex - The column index
 * @returns {string} Unique column identifier
 */
function generateColumnId(columnHeader, columnIndex) {
  const textContent = columnHeader.textContent.trim();
  const ariaLabel = columnHeader.getAttribute("aria-label");
  const dataTestId = columnHeader.getAttribute("data-testid");

  const identifiers = [
    textContent,
    ariaLabel,
    dataTestId,
    `col-${columnIndex}`,
  ].filter(Boolean);

  return identifiers.join("-").replace(/\s+/g, "-").toLowerCase();
}

/**
 * Create eye icon with tooltip
 * @param {string} columnId - Unique column identifier
 * @param {boolean} isVisible - Whether the column is currently visible
 * @param {string} columnName - Name of the column for tooltip
 * @returns {HTMLElement} The eye icon element
 */
function createEyeIcon(columnId, isVisible, columnName = "") {
  const eyeIcon = document.createElement("span");
  eyeIcon.className = COLUMN_VISIBILITY_CONFIG.eyeIconClass;
  eyeIcon.setAttribute("data-column-id", columnId);
  eyeIcon.setAttribute("data-column-name", columnName);

  eyeIcon.style.cssText = `
    cursor: pointer;
    margin-right: 8px;
    font-size: 14px;
    display: inline-block;
    user-select: none;
    transition: all 0.2s ease;
    vertical-align: middle;
    position: relative;
    color: ${
      isVisible
        ? COLUMN_VISIBILITY_CONFIG.visibleColor
        : COLUMN_VISIBILITY_CONFIG.hiddenColor
    };
  `;

  // Create the icon element using Material Design Icons
  const icon = document.createElement("i");
  icon.className = `zmdi ${
    isVisible
      ? COLUMN_VISIBILITY_CONFIG.eyeVisibleIcon
      : COLUMN_VISIBILITY_CONFIG.eyeHiddenIcon
  }`;
  eyeIcon.appendChild(icon);

  // Create tooltip
  const tooltip = document.createElement("div");
  tooltip.className = "column-tooltip";
  tooltip.textContent = isVisible
    ? "Hide column"
    : `Show column: ${columnName}`;
  tooltip.style.cssText = `
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.9);
    color: white;
    padding: 6px 10px;
    border-radius: 4px;
    font-size: 12px;
    white-space: nowrap;
    opacity: 0;
    visibility: hidden;
    transition: all 0.2s ease;
    pointer-events: none;
    z-index: 10000;
    margin-bottom: 5px;
  `;

  // Add arrow to tooltip
  const arrow = document.createElement("div");
  arrow.style.cssText = `
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    border: 5px solid transparent;
    border-top-color: rgba(0, 0, 0, 0.9);
  `;
  tooltip.appendChild(arrow);
  eyeIcon.appendChild(tooltip);

  // Add hover effects
  eyeIcon.addEventListener("mouseenter", () => {
    eyeIcon.style.transform = "scale(1.2)";
    eyeIcon.style.filter = "brightness(1.2)";
    tooltip.style.opacity = "1";
    tooltip.style.visibility = "visible";
    tooltip.style.transform = "translateX(-50%) translateY(-2px)";
  });

  eyeIcon.addEventListener("mouseleave", () => {
    eyeIcon.style.transform = "scale(1)";
    eyeIcon.style.filter = "none";
    tooltip.style.opacity = "0";
    tooltip.style.visibility = "hidden";
    tooltip.style.transform = "translateX(-50%) translateY(0)";
  });

  return eyeIcon;
}

/**
 * Toggle column visibility
 * @param {string} columnId - Unique column identifier
 * @param {HTMLElement} table - The table element
 */
function toggleColumnVisibility(columnId, table) {
  const isCurrentlyHidden = columnVisibilityState.hiddenColumns.has(columnId);

  if (isCurrentlyHidden) {
    // Show column
    columnVisibilityState.hiddenColumns.delete(columnId);
    showColumn(columnId, table);
  } else {
    // Hide column
    columnVisibilityState.hiddenColumns.add(columnId);
    hideColumn(columnId, table);
  }

  // Update the eye icon
  updateEyeIcon(columnId, isCurrentlyHidden);

  // No longer saving state - columns will reset on reload/new query
  console.log(
    `Re-Redash: Toggled column ${columnId} - ${
      isCurrentlyHidden ? "shown" : "hidden"
    } (temporary - will reset on reload)`
  );
}

/**
 * Hide a column in the table (style it as hidden, reduce width, remove sorter)
 * @param {string} columnId - Unique column identifier
 * @param {HTMLElement} table - The table element
 */
function hideColumn(columnId, table) {
  const headerRow = table.querySelector("thead tr");
  if (!headerRow) return;

  const headers = Array.from(headerRow.querySelectorAll("th"));
  const columnIndex = headers.findIndex(
    (header) =>
      header.querySelector(`[data-column-id="${columnId}"]`) ||
      header.getAttribute("data-column-id") === columnId
  );

  if (columnIndex !== -1) {
    const headerCell = headers[columnIndex];

    // Style the header cell as hidden
    headerCell.classList.add(COLUMN_VISIBILITY_CONFIG.hiddenColumnClass);
    headerCell.style.width = "50px";
    headerCell.style.minWidth = "50px";
    headerCell.style.maxWidth = "50px";
    headerCell.style.backgroundColor = "rgba(255, 77, 79, 0.1)";
    headerCell.style.color = "#ff4d4f";

    // Hide the sorter elements
    const sorters = headerCell.querySelectorAll(
      ".ant-table-column-sorter, .ant-table-column-sorter-full"
    );
    sorters.forEach((sorter) => {
      sorter.style.display = "none";
      sorter.setAttribute("data-hidden-by-visibility", "true");
    });

    // Style all body cells in this column
    const rows = table.querySelectorAll("tbody tr");
    rows.forEach((row) => {
      const cell = row.children[columnIndex];
      if (cell) {
        cell.classList.add(COLUMN_VISIBILITY_CONFIG.hiddenColumnClass);
        cell.style.width = "50px";
        cell.style.minWidth = "50px";
        cell.style.maxWidth = "50px";
        cell.style.backgroundColor = "rgba(255, 77, 79, 0.1)";
        cell.style.color = "#ff4d4f";
        cell.style.overflow = "hidden";
        cell.style.textOverflow = "ellipsis";
        cell.style.whiteSpace = "nowrap";
        cell.setAttribute("data-column-id", columnId);
      }
    });
  }
}

/**
 * Show a column in the table
 * @param {string} columnId - Unique column identifier
 * @param {HTMLElement} table - The table element
 */
function showColumn(columnId, table) {
  const headerRow = table.querySelector("thead tr");
  if (!headerRow) return;

  const headers = Array.from(headerRow.querySelectorAll("th"));
  const columnIndex = headers.findIndex(
    (header) =>
      header.querySelector(`[data-column-id="${columnId}"]`) ||
      header.getAttribute("data-column-id") === columnId
  );

  if (columnIndex !== -1) {
    const headerCell = headers[columnIndex];

    // Reset the header cell styling
    headerCell.classList.remove(COLUMN_VISIBILITY_CONFIG.hiddenColumnClass);
    headerCell.style.width = "";
    headerCell.style.minWidth = "";
    headerCell.style.maxWidth = "";
    headerCell.style.backgroundColor = "";
    headerCell.style.color = "";

    // Show the sorter elements
    const sorters = headerCell.querySelectorAll(
      "[data-hidden-by-visibility='true']"
    );
    sorters.forEach((sorter) => {
      sorter.style.display = "";
      sorter.removeAttribute("data-hidden-by-visibility");
    });

    // Reset all body cells in this column
    const rows = table.querySelectorAll("tbody tr");
    rows.forEach((row) => {
      const cell = row.children[columnIndex];
      if (cell && cell.getAttribute("data-column-id") === columnId) {
        cell.classList.remove(COLUMN_VISIBILITY_CONFIG.hiddenColumnClass);
        cell.style.width = "";
        cell.style.minWidth = "";
        cell.style.maxWidth = "";
        cell.style.backgroundColor = "";
        cell.style.color = "";
        cell.style.overflow = "";
        cell.style.textOverflow = "";
        cell.style.whiteSpace = "";
        cell.removeAttribute("data-column-id");
      }
    });
  }
}

/**
 * Update eye icon appearance based on visibility state
 * @param {string} columnId - Unique column identifier
 * @param {boolean} isVisible - Whether the column is visible
 */
function updateEyeIcon(columnId, isVisible) {
  const eyeIcon = document.querySelector(
    `[data-column-id="${columnId}"].${COLUMN_VISIBILITY_CONFIG.eyeIconClass}`
  );
  if (eyeIcon) {
    const columnName = eyeIcon.getAttribute("data-column-name") || "";

    // Update color
    eyeIcon.style.color = isVisible
      ? COLUMN_VISIBILITY_CONFIG.visibleColor
      : COLUMN_VISIBILITY_CONFIG.hiddenColor;

    // Update icon class
    const icon = eyeIcon.querySelector("i.zmdi");
    if (icon) {
      icon.className = `zmdi ${
        isVisible
          ? COLUMN_VISIBILITY_CONFIG.eyeVisibleIcon
          : COLUMN_VISIBILITY_CONFIG.eyeHiddenIcon
      }`;
    }

    // Update tooltip
    const tooltip = eyeIcon.querySelector(".column-tooltip");
    if (tooltip) {
      tooltip.textContent = isVisible
        ? "Hide column"
        : `Show column: ${columnName}`;
    }
  }
}

/**
 * Add eye icons to table columns with sorting capability
 * @param {HTMLElement} table - The table element to process
 */
function addEyeIconsToTable(table) {
  const sortableColumns = table.querySelectorAll(
    `.${COLUMN_VISIBILITY_CONFIG.targetColumnClass}`
  );

  if (sortableColumns.length === 0) {
    return;
  }

  console.log(
    `Re-Redash: Found ${sortableColumns.length} sortable columns to add eye icons`
  );

  sortableColumns.forEach((column, index) => {
    // Skip if eye icon already exists
    if (column.querySelector(`.${COLUMN_VISIBILITY_CONFIG.eyeIconClass}`)) {
      return;
    }

    const columnId = generateColumnId(column, index);
    const isVisible = !columnVisibilityState.hiddenColumns.has(columnId);
    const columnName = column.textContent.trim();

    // Create and add eye icon
    const eyeIcon = createEyeIcon(columnId, isVisible, columnName);

    // Add click event listener
    eyeIcon.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleColumnVisibility(columnId, table);
    });

    // Prepend eye icon to the column header (before column name)
    column.insertBefore(eyeIcon, column.firstChild);

    // Set column ID for identification
    column.setAttribute("data-column-id", columnId);

    // Apply initial visibility state
    if (!isVisible) {
      hideColumn(columnId, table);
    }
  });
}

/**
 * Process all tables on the page
 */
function processAllTables() {
  const tables = document.querySelectorAll("table");
  let processedCount = 0;

  tables.forEach((table) => {
    const sortableColumns = table.querySelectorAll(
      `.${COLUMN_VISIBILITY_CONFIG.targetColumnClass}`
    );
    if (sortableColumns.length > 0) {
      addEyeIconsToTable(table);
      processedCount++;
    }
  });

  if (processedCount > 0) {
    console.log(
      `Re-Redash: Processed ${processedCount} tables with column visibility toggles`
    );
  }
}

/**
 * Handle DOM mutations to catch dynamically added tables
 * @param {MutationRecord[]} mutations - Array of mutation records
 */
function handleMutations(mutations) {
  let shouldProcess = false;

  mutations.forEach((mutation) => {
    if (mutation.type === "childList") {
      // Check if any added nodes contain tables or sortable columns
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const element = node;
          if (
            element.tagName === "TABLE" ||
            (element.querySelector && element.querySelector("table"))
          ) {
            shouldProcess = true;
          } else if (
            element.classList &&
            element.classList.contains(
              COLUMN_VISIBILITY_CONFIG.targetColumnClass
            )
          ) {
            shouldProcess = true;
          }
        }
      });
    }
  });

  if (shouldProcess) {
    // Debounce the processing to avoid excessive calls
    clearTimeout(columnVisibilityState.debounceTimer);
    columnVisibilityState.debounceTimer = setTimeout(() => {
      processAllTables();
    }, COLUMN_VISIBILITY_CONFIG.debounceDelay);
  }
}

/**
 * Initialize the table column visibility functionality
 */
function initializeColumnVisibility() {
  if (columnVisibilityState.isInitialized) {
    console.log("Re-Redash: Column visibility already initialized");
    return;
  }

  console.log("Re-Redash: Initializing table column visibility...");

  // Always start with all columns visible (no persistence)
  loadHiddenColumnsState();

  // Process existing tables
  processAllTables();

  // Set up mutation observer for dynamic content
  columnVisibilityState.observer = new MutationObserver(handleMutations);
  columnVisibilityState.observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  columnVisibilityState.isInitialized = true;
  console.log("Re-Redash: Table column visibility initialized successfully");
}

/**
 * Destroy the column visibility functionality
 */
function destroyColumnVisibility() {
  if (!columnVisibilityState.isInitialized) {
    return;
  }

  // Disconnect observer
  if (columnVisibilityState.observer) {
    columnVisibilityState.observer.disconnect();
    columnVisibilityState.observer = null;
  }

  // Remove all eye icons
  const eyeIcons = document.querySelectorAll(
    `.${COLUMN_VISIBILITY_CONFIG.eyeIconClass}`
  );
  eyeIcons.forEach((icon) => icon.remove());

  // Show all hidden columns
  columnVisibilityState.hiddenColumns.forEach((columnId) => {
    const tables = document.querySelectorAll("table");
    tables.forEach((table) => showColumn(columnId, table));
  });

  // Reset state
  columnVisibilityState.hiddenColumns.clear();
  columnVisibilityState.isInitialized = false;

  console.log("Re-Redash: Table column visibility destroyed");
}

// Auto-initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeColumnVisibility);
} else {
  // DOM is already ready
  setTimeout(initializeColumnVisibility, 100);
}

// Expose public API
window.ReRedashColumnVisibility = {
  initialize: initializeColumnVisibility,
  destroy: destroyColumnVisibility,
  refresh: processAllTables,
  getHiddenColumns: () => Array.from(columnVisibilityState.hiddenColumns),
  showAllColumns: () => {
    columnVisibilityState.hiddenColumns.forEach((columnId) => {
      const tables = document.querySelectorAll("table");
      tables.forEach((table) => showColumn(columnId, table));
      updateEyeIcon(columnId, true);
    });
    columnVisibilityState.hiddenColumns.clear();
    saveHiddenColumnsState();
  },
  hideColumn: (columnId) => {
    columnVisibilityState.hiddenColumns.add(columnId);
    const tables = document.querySelectorAll("table");
    tables.forEach((table) => hideColumn(columnId, table));
    updateEyeIcon(columnId, false);
    saveHiddenColumnsState();
  },
};

console.log("Re-Redash: Table column visibility module loaded");
