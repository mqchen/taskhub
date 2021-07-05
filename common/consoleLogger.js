const chalk = require('chalk');

const consoleLogger = {};

consoleLogger.debug = console.debug;
consoleLogger.info = console.info;
consoleLogger.warn = console.warn;

// consoleLogger.assert = console.assert;
// consoleLogger.clear = console.clear;
// consoleLogger.count = console.count;
// consoleLogger.countReset = console.countReset;
// consoleLogger.group = console.group;
// consoleLogger.groupCollapsed = console.groupCollapsed;
// consoleLogger.groupEnd = console.groupEnd;
consoleLogger.dir = console.dir;
consoleLogger.dirxml = console.dirxml;
consoleLogger.table = console.table;
consoleLogger.time = console.time;
consoleLogger.timeEnd = console.timeEnd;
consoleLogger.timeLog = console.timeLog;
consoleLogger.trace = console.trace;

consoleLogger.log = console.log;
consoleLogger.debug = console.debug;
consoleLogger.info = (...args) => console.info(chalk.blue('ℹ'), ...args);
consoleLogger.warn = (...args) => console.warn(chalk.yellow('⚠️'), ...args);
consoleLogger.error = (...args) => console.error(chalk.red('🛑'), ...args);

module.exports = consoleLogger;
