/**
 * Re-Redash Custom Logger
 * Centralized logging utility with flag-based control
 */

(function () {
  "use strict";

  // Logger configuration
  const LoggerConfig = {
    // Set this to false to disable all logs in production
    ENABLE_LOGS: false,
    PREFIX: "Re-Redash:",
  };

  /**
   * Custom logger wrapper that respects the ENABLE_LOGS flag
   */
  const customLogger = {
    /**
     * Log informational messages
     * @param {...any} args - Arguments to log
     */
    log: function (...args) {
      if (LoggerConfig.ENABLE_LOGS) {
        console.log(LoggerConfig.PREFIX, ...args);
      }
    },

    /**
     * Log warning messages
     * @param {...any} args - Arguments to log
     */
    warn: function (...args) {
      if (LoggerConfig.ENABLE_LOGS) {
        console.warn(LoggerConfig.PREFIX, ...args);
      }
    },

    /**
     * Log error messages
     * @param {...any} args - Arguments to log
     */
    error: function (...args) {
      if (LoggerConfig.ENABLE_LOGS) {
        console.error(LoggerConfig.PREFIX, ...args);
      }
    },

    /**
     * Log info messages (alias for log)
     * @param {...any} args - Arguments to log
     */
    info: function (...args) {
      if (LoggerConfig.ENABLE_LOGS) {
        console.info(LoggerConfig.PREFIX, ...args);
      }
    },

    /**
     * Log debug messages
     * @param {...any} args - Arguments to log
     */
    debug: function (...args) {
      if (LoggerConfig.ENABLE_LOGS) {
        console.debug(LoggerConfig.PREFIX, ...args);
      }
    },

    /**
     * Enable logging
     */
    enable: function () {
      LoggerConfig.ENABLE_LOGS = true;
      console.log(LoggerConfig.PREFIX, "Logging enabled");
    },

    /**
     * Disable logging
     */
    disable: function () {
      console.log(LoggerConfig.PREFIX, "Logging disabled");
      LoggerConfig.ENABLE_LOGS = false;
    },

    /**
     * Check if logging is enabled
     * @returns {boolean} True if logging is enabled
     */
    isEnabled: function () {
      return LoggerConfig.ENABLE_LOGS;
    },
  };

  // Export for different module systems
  if (typeof module !== "undefined" && module.exports) {
    module.exports = customLogger;
  } else if (typeof window !== "undefined") {
    window.customLogger = customLogger;
  }
})();
