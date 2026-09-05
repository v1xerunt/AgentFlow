#!/usr/bin/env node
import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var __commonJS = (cb, mod) => function __require2() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// ../../node_modules/commander/lib/error.js
var require_error = __commonJS({
  "../../node_modules/commander/lib/error.js"(exports) {
    "use strict";
    var CommanderError2 = class extends Error {
      /**
       * Constructs the CommanderError class
       * @param {number} exitCode suggested exit code which could be used with process.exit
       * @param {string} code an id string representing the error
       * @param {string} message human-readable description of the error
       */
      constructor(exitCode, code, message) {
        super(message);
        Error.captureStackTrace(this, this.constructor);
        this.name = this.constructor.name;
        this.code = code;
        this.exitCode = exitCode;
        this.nestedError = void 0;
      }
    };
    var InvalidArgumentError2 = class extends CommanderError2 {
      /**
       * Constructs the InvalidArgumentError class
       * @param {string} [message] explanation of why argument is invalid
       */
      constructor(message) {
        super(1, "commander.invalidArgument", message);
        Error.captureStackTrace(this, this.constructor);
        this.name = this.constructor.name;
      }
    };
    exports.CommanderError = CommanderError2;
    exports.InvalidArgumentError = InvalidArgumentError2;
  }
});

// ../../node_modules/commander/lib/argument.js
var require_argument = __commonJS({
  "../../node_modules/commander/lib/argument.js"(exports) {
    "use strict";
    var { InvalidArgumentError: InvalidArgumentError2 } = require_error();
    var Argument2 = class {
      /**
       * Initialize a new command argument with the given name and description.
       * The default is that the argument is required, and you can explicitly
       * indicate this with <> around the name. Put [] around the name for an optional argument.
       *
       * @param {string} name
       * @param {string} [description]
       */
      constructor(name, description) {
        this.description = description || "";
        this.variadic = false;
        this.parseArg = void 0;
        this.defaultValue = void 0;
        this.defaultValueDescription = void 0;
        this.argChoices = void 0;
        switch (name[0]) {
          case "<":
            this.required = true;
            this._name = name.slice(1, -1);
            break;
          case "[":
            this.required = false;
            this._name = name.slice(1, -1);
            break;
          default:
            this.required = true;
            this._name = name;
            break;
        }
        if (this._name.endsWith("...")) {
          this.variadic = true;
          this._name = this._name.slice(0, -3);
        }
      }
      /**
       * Return argument name.
       *
       * @return {string}
       */
      name() {
        return this._name;
      }
      /**
       * @package
       */
      _collectValue(value, previous) {
        if (previous === this.defaultValue || !Array.isArray(previous)) {
          return [value];
        }
        previous.push(value);
        return previous;
      }
      /**
       * Set the default value, and optionally supply the description to be displayed in the help.
       *
       * @param {*} value
       * @param {string} [description]
       * @return {Argument}
       */
      default(value, description) {
        this.defaultValue = value;
        this.defaultValueDescription = description;
        return this;
      }
      /**
       * Set the custom handler for processing CLI command arguments into argument values.
       *
       * @param {Function} [fn]
       * @return {Argument}
       */
      argParser(fn) {
        this.parseArg = fn;
        return this;
      }
      /**
       * Only allow argument value to be one of choices.
       *
       * @param {string[]} values
       * @return {Argument}
       */
      choices(values) {
        this.argChoices = values.slice();
        this.parseArg = (arg, previous) => {
          if (!this.argChoices.includes(arg)) {
            throw new InvalidArgumentError2(
              `Allowed choices are ${this.argChoices.join(", ")}.`
            );
          }
          if (this.variadic) {
            return this._collectValue(arg, previous);
          }
          return arg;
        };
        return this;
      }
      /**
       * Make argument required.
       *
       * @returns {Argument}
       */
      argRequired() {
        this.required = true;
        return this;
      }
      /**
       * Make argument optional.
       *
       * @returns {Argument}
       */
      argOptional() {
        this.required = false;
        return this;
      }
    };
    function humanReadableArgName(arg) {
      const nameOutput = arg.name() + (arg.variadic === true ? "..." : "");
      return arg.required ? "<" + nameOutput + ">" : "[" + nameOutput + "]";
    }
    exports.Argument = Argument2;
    exports.humanReadableArgName = humanReadableArgName;
  }
});

// ../../node_modules/commander/lib/help.js
var require_help = __commonJS({
  "../../node_modules/commander/lib/help.js"(exports) {
    "use strict";
    var { humanReadableArgName } = require_argument();
    var Help2 = class {
      constructor() {
        this.helpWidth = void 0;
        this.minWidthToWrap = 40;
        this.sortSubcommands = false;
        this.sortOptions = false;
        this.showGlobalOptions = false;
      }
      /**
       * prepareContext is called by Commander after applying overrides from `Command.configureHelp()`
       * and just before calling `formatHelp()`.
       *
       * Commander just uses the helpWidth and the rest is provided for optional use by more complex subclasses.
       *
       * @param {{ error?: boolean, helpWidth?: number, outputHasColors?: boolean }} contextOptions
       */
      prepareContext(contextOptions) {
        this.helpWidth = this.helpWidth ?? contextOptions.helpWidth ?? 80;
      }
      /**
       * Get an array of the visible subcommands. Includes a placeholder for the implicit help command, if there is one.
       *
       * @param {Command} cmd
       * @returns {Command[]}
       */
      visibleCommands(cmd) {
        const visibleCommands = cmd.commands.filter((cmd2) => !cmd2._hidden);
        const helpCommand = cmd._getHelpCommand();
        if (helpCommand && !helpCommand._hidden) {
          visibleCommands.push(helpCommand);
        }
        if (this.sortSubcommands) {
          visibleCommands.sort((a, b) => {
            return a.name().localeCompare(b.name());
          });
        }
        return visibleCommands;
      }
      /**
       * Compare options for sort.
       *
       * @param {Option} a
       * @param {Option} b
       * @returns {number}
       */
      compareOptions(a, b) {
        const getSortKey = (option) => {
          return option.short ? option.short.replace(/^-/, "") : option.long.replace(/^--/, "");
        };
        return getSortKey(a).localeCompare(getSortKey(b));
      }
      /**
       * Get an array of the visible options. Includes a placeholder for the implicit help option, if there is one.
       *
       * @param {Command} cmd
       * @returns {Option[]}
       */
      visibleOptions(cmd) {
        const visibleOptions = cmd.options.filter((option) => !option.hidden);
        const helpOption = cmd._getHelpOption();
        if (helpOption && !helpOption.hidden) {
          const removeShort = helpOption.short && cmd._findOption(helpOption.short);
          const removeLong = helpOption.long && cmd._findOption(helpOption.long);
          if (!removeShort && !removeLong) {
            visibleOptions.push(helpOption);
          } else if (helpOption.long && !removeLong) {
            visibleOptions.push(
              cmd.createOption(helpOption.long, helpOption.description)
            );
          } else if (helpOption.short && !removeShort) {
            visibleOptions.push(
              cmd.createOption(helpOption.short, helpOption.description)
            );
          }
        }
        if (this.sortOptions) {
          visibleOptions.sort(this.compareOptions);
        }
        return visibleOptions;
      }
      /**
       * Get an array of the visible global options. (Not including help.)
       *
       * @param {Command} cmd
       * @returns {Option[]}
       */
      visibleGlobalOptions(cmd) {
        if (!this.showGlobalOptions) return [];
        const globalOptions = [];
        for (let ancestorCmd = cmd.parent; ancestorCmd; ancestorCmd = ancestorCmd.parent) {
          const visibleOptions = ancestorCmd.options.filter(
            (option) => !option.hidden
          );
          globalOptions.push(...visibleOptions);
        }
        if (this.sortOptions) {
          globalOptions.sort(this.compareOptions);
        }
        return globalOptions;
      }
      /**
       * Get an array of the arguments if any have a description.
       *
       * @param {Command} cmd
       * @returns {Argument[]}
       */
      visibleArguments(cmd) {
        if (cmd._argsDescription) {
          cmd.registeredArguments.forEach((argument) => {
            argument.description = argument.description || cmd._argsDescription[argument.name()] || "";
          });
        }
        if (cmd.registeredArguments.find((argument) => argument.description)) {
          return cmd.registeredArguments;
        }
        return [];
      }
      /**
       * Get the command term to show in the list of subcommands.
       *
       * @param {Command} cmd
       * @returns {string}
       */
      subcommandTerm(cmd) {
        const args = cmd.registeredArguments.map((arg) => humanReadableArgName(arg)).join(" ");
        return cmd._name + (cmd._aliases[0] ? "|" + cmd._aliases[0] : "") + (cmd.options.length ? " [options]" : "") + // simplistic check for non-help option
        (args ? " " + args : "");
      }
      /**
       * Get the option term to show in the list of options.
       *
       * @param {Option} option
       * @returns {string}
       */
      optionTerm(option) {
        return option.flags;
      }
      /**
       * Get the argument term to show in the list of arguments.
       *
       * @param {Argument} argument
       * @returns {string}
       */
      argumentTerm(argument) {
        return argument.name();
      }
      /**
       * Get the longest command term length.
       *
       * @param {Command} cmd
       * @param {Help} helper
       * @returns {number}
       */
      longestSubcommandTermLength(cmd, helper) {
        return helper.visibleCommands(cmd).reduce((max, command) => {
          return Math.max(
            max,
            this.displayWidth(
              helper.styleSubcommandTerm(helper.subcommandTerm(command))
            )
          );
        }, 0);
      }
      /**
       * Get the longest option term length.
       *
       * @param {Command} cmd
       * @param {Help} helper
       * @returns {number}
       */
      longestOptionTermLength(cmd, helper) {
        return helper.visibleOptions(cmd).reduce((max, option) => {
          return Math.max(
            max,
            this.displayWidth(helper.styleOptionTerm(helper.optionTerm(option)))
          );
        }, 0);
      }
      /**
       * Get the longest global option term length.
       *
       * @param {Command} cmd
       * @param {Help} helper
       * @returns {number}
       */
      longestGlobalOptionTermLength(cmd, helper) {
        return helper.visibleGlobalOptions(cmd).reduce((max, option) => {
          return Math.max(
            max,
            this.displayWidth(helper.styleOptionTerm(helper.optionTerm(option)))
          );
        }, 0);
      }
      /**
       * Get the longest argument term length.
       *
       * @param {Command} cmd
       * @param {Help} helper
       * @returns {number}
       */
      longestArgumentTermLength(cmd, helper) {
        return helper.visibleArguments(cmd).reduce((max, argument) => {
          return Math.max(
            max,
            this.displayWidth(
              helper.styleArgumentTerm(helper.argumentTerm(argument))
            )
          );
        }, 0);
      }
      /**
       * Get the command usage to be displayed at the top of the built-in help.
       *
       * @param {Command} cmd
       * @returns {string}
       */
      commandUsage(cmd) {
        let cmdName = cmd._name;
        if (cmd._aliases[0]) {
          cmdName = cmdName + "|" + cmd._aliases[0];
        }
        let ancestorCmdNames = "";
        for (let ancestorCmd = cmd.parent; ancestorCmd; ancestorCmd = ancestorCmd.parent) {
          ancestorCmdNames = ancestorCmd.name() + " " + ancestorCmdNames;
        }
        return ancestorCmdNames + cmdName + " " + cmd.usage();
      }
      /**
       * Get the description for the command.
       *
       * @param {Command} cmd
       * @returns {string}
       */
      commandDescription(cmd) {
        return cmd.description();
      }
      /**
       * Get the subcommand summary to show in the list of subcommands.
       * (Fallback to description for backwards compatibility.)
       *
       * @param {Command} cmd
       * @returns {string}
       */
      subcommandDescription(cmd) {
        return cmd.summary() || cmd.description();
      }
      /**
       * Get the option description to show in the list of options.
       *
       * @param {Option} option
       * @return {string}
       */
      optionDescription(option) {
        const extraInfo = [];
        if (option.argChoices) {
          extraInfo.push(
            // use stringify to match the display of the default value
            `choices: ${option.argChoices.map((choice) => JSON.stringify(choice)).join(", ")}`
          );
        }
        if (option.defaultValue !== void 0) {
          const showDefault = option.required || option.optional || option.isBoolean() && typeof option.defaultValue === "boolean";
          if (showDefault) {
            extraInfo.push(
              `default: ${option.defaultValueDescription || JSON.stringify(option.defaultValue)}`
            );
          }
        }
        if (option.presetArg !== void 0 && option.optional) {
          extraInfo.push(`preset: ${JSON.stringify(option.presetArg)}`);
        }
        if (option.envVar !== void 0) {
          extraInfo.push(`env: ${option.envVar}`);
        }
        if (extraInfo.length > 0) {
          const extraDescription = `(${extraInfo.join(", ")})`;
          if (option.description) {
            return `${option.description} ${extraDescription}`;
          }
          return extraDescription;
        }
        return option.description;
      }
      /**
       * Get the argument description to show in the list of arguments.
       *
       * @param {Argument} argument
       * @return {string}
       */
      argumentDescription(argument) {
        const extraInfo = [];
        if (argument.argChoices) {
          extraInfo.push(
            // use stringify to match the display of the default value
            `choices: ${argument.argChoices.map((choice) => JSON.stringify(choice)).join(", ")}`
          );
        }
        if (argument.defaultValue !== void 0) {
          extraInfo.push(
            `default: ${argument.defaultValueDescription || JSON.stringify(argument.defaultValue)}`
          );
        }
        if (extraInfo.length > 0) {
          const extraDescription = `(${extraInfo.join(", ")})`;
          if (argument.description) {
            return `${argument.description} ${extraDescription}`;
          }
          return extraDescription;
        }
        return argument.description;
      }
      /**
       * Format a list of items, given a heading and an array of formatted items.
       *
       * @param {string} heading
       * @param {string[]} items
       * @param {Help} helper
       * @returns string[]
       */
      formatItemList(heading, items, helper) {
        if (items.length === 0) return [];
        return [helper.styleTitle(heading), ...items, ""];
      }
      /**
       * Group items by their help group heading.
       *
       * @param {Command[] | Option[]} unsortedItems
       * @param {Command[] | Option[]} visibleItems
       * @param {Function} getGroup
       * @returns {Map<string, Command[] | Option[]>}
       */
      groupItems(unsortedItems, visibleItems, getGroup) {
        const result = /* @__PURE__ */ new Map();
        unsortedItems.forEach((item) => {
          const group = getGroup(item);
          if (!result.has(group)) result.set(group, []);
        });
        visibleItems.forEach((item) => {
          const group = getGroup(item);
          if (!result.has(group)) {
            result.set(group, []);
          }
          result.get(group).push(item);
        });
        return result;
      }
      /**
       * Generate the built-in help text.
       *
       * @param {Command} cmd
       * @param {Help} helper
       * @returns {string}
       */
      formatHelp(cmd, helper) {
        const termWidth = helper.padWidth(cmd, helper);
        const helpWidth = helper.helpWidth ?? 80;
        function callFormatItem(term, description) {
          return helper.formatItem(term, termWidth, description, helper);
        }
        let output = [
          `${helper.styleTitle("Usage:")} ${helper.styleUsage(helper.commandUsage(cmd))}`,
          ""
        ];
        const commandDescription = helper.commandDescription(cmd);
        if (commandDescription.length > 0) {
          output = output.concat([
            helper.boxWrap(
              helper.styleCommandDescription(commandDescription),
              helpWidth
            ),
            ""
          ]);
        }
        const argumentList = helper.visibleArguments(cmd).map((argument) => {
          return callFormatItem(
            helper.styleArgumentTerm(helper.argumentTerm(argument)),
            helper.styleArgumentDescription(helper.argumentDescription(argument))
          );
        });
        output = output.concat(
          this.formatItemList("Arguments:", argumentList, helper)
        );
        const optionGroups = this.groupItems(
          cmd.options,
          helper.visibleOptions(cmd),
          (option) => option.helpGroupHeading ?? "Options:"
        );
        optionGroups.forEach((options, group) => {
          const optionList = options.map((option) => {
            return callFormatItem(
              helper.styleOptionTerm(helper.optionTerm(option)),
              helper.styleOptionDescription(helper.optionDescription(option))
            );
          });
          output = output.concat(this.formatItemList(group, optionList, helper));
        });
        if (helper.showGlobalOptions) {
          const globalOptionList = helper.visibleGlobalOptions(cmd).map((option) => {
            return callFormatItem(
              helper.styleOptionTerm(helper.optionTerm(option)),
              helper.styleOptionDescription(helper.optionDescription(option))
            );
          });
          output = output.concat(
            this.formatItemList("Global Options:", globalOptionList, helper)
          );
        }
        const commandGroups = this.groupItems(
          cmd.commands,
          helper.visibleCommands(cmd),
          (sub) => sub.helpGroup() || "Commands:"
        );
        commandGroups.forEach((commands, group) => {
          const commandList = commands.map((sub) => {
            return callFormatItem(
              helper.styleSubcommandTerm(helper.subcommandTerm(sub)),
              helper.styleSubcommandDescription(helper.subcommandDescription(sub))
            );
          });
          output = output.concat(this.formatItemList(group, commandList, helper));
        });
        return output.join("\n");
      }
      /**
       * Return display width of string, ignoring ANSI escape sequences. Used in padding and wrapping calculations.
       *
       * @param {string} str
       * @returns {number}
       */
      displayWidth(str) {
        return stripColor(str).length;
      }
      /**
       * Style the title for displaying in the help. Called with 'Usage:', 'Options:', etc.
       *
       * @param {string} str
       * @returns {string}
       */
      styleTitle(str) {
        return str;
      }
      styleUsage(str) {
        return str.split(" ").map((word) => {
          if (word === "[options]") return this.styleOptionText(word);
          if (word === "[command]") return this.styleSubcommandText(word);
          if (word[0] === "[" || word[0] === "<")
            return this.styleArgumentText(word);
          return this.styleCommandText(word);
        }).join(" ");
      }
      styleCommandDescription(str) {
        return this.styleDescriptionText(str);
      }
      styleOptionDescription(str) {
        return this.styleDescriptionText(str);
      }
      styleSubcommandDescription(str) {
        return this.styleDescriptionText(str);
      }
      styleArgumentDescription(str) {
        return this.styleDescriptionText(str);
      }
      styleDescriptionText(str) {
        return str;
      }
      styleOptionTerm(str) {
        return this.styleOptionText(str);
      }
      styleSubcommandTerm(str) {
        return str.split(" ").map((word) => {
          if (word === "[options]") return this.styleOptionText(word);
          if (word[0] === "[" || word[0] === "<")
            return this.styleArgumentText(word);
          return this.styleSubcommandText(word);
        }).join(" ");
      }
      styleArgumentTerm(str) {
        return this.styleArgumentText(str);
      }
      styleOptionText(str) {
        return str;
      }
      styleArgumentText(str) {
        return str;
      }
      styleSubcommandText(str) {
        return str;
      }
      styleCommandText(str) {
        return str;
      }
      /**
       * Calculate the pad width from the maximum term length.
       *
       * @param {Command} cmd
       * @param {Help} helper
       * @returns {number}
       */
      padWidth(cmd, helper) {
        return Math.max(
          helper.longestOptionTermLength(cmd, helper),
          helper.longestGlobalOptionTermLength(cmd, helper),
          helper.longestSubcommandTermLength(cmd, helper),
          helper.longestArgumentTermLength(cmd, helper)
        );
      }
      /**
       * Detect manually wrapped and indented strings by checking for line break followed by whitespace.
       *
       * @param {string} str
       * @returns {boolean}
       */
      preformatted(str) {
        return /\n[^\S\r\n]/.test(str);
      }
      /**
       * Format the "item", which consists of a term and description. Pad the term and wrap the description, indenting the following lines.
       *
       * So "TTT", 5, "DDD DDDD DD DDD" might be formatted for this.helpWidth=17 like so:
       *   TTT  DDD DDDD
       *        DD DDD
       *
       * @param {string} term
       * @param {number} termWidth
       * @param {string} description
       * @param {Help} helper
       * @returns {string}
       */
      formatItem(term, termWidth, description, helper) {
        const itemIndent = 2;
        const itemIndentStr = " ".repeat(itemIndent);
        if (!description) return itemIndentStr + term;
        const paddedTerm = term.padEnd(
          termWidth + term.length - helper.displayWidth(term)
        );
        const spacerWidth = 2;
        const helpWidth = this.helpWidth ?? 80;
        const remainingWidth = helpWidth - termWidth - spacerWidth - itemIndent;
        let formattedDescription;
        if (remainingWidth < this.minWidthToWrap || helper.preformatted(description)) {
          formattedDescription = description;
        } else {
          const wrappedDescription = helper.boxWrap(description, remainingWidth);
          formattedDescription = wrappedDescription.replace(
            /\n/g,
            "\n" + " ".repeat(termWidth + spacerWidth)
          );
        }
        return itemIndentStr + paddedTerm + " ".repeat(spacerWidth) + formattedDescription.replace(/\n/g, `
${itemIndentStr}`);
      }
      /**
       * Wrap a string at whitespace, preserving existing line breaks.
       * Wrapping is skipped if the width is less than `minWidthToWrap`.
       *
       * @param {string} str
       * @param {number} width
       * @returns {string}
       */
      boxWrap(str, width) {
        if (width < this.minWidthToWrap) return str;
        const rawLines = str.split(/\r\n|\n/);
        const chunkPattern = /[\s]*[^\s]+/g;
        const wrappedLines = [];
        rawLines.forEach((line) => {
          const chunks = line.match(chunkPattern);
          if (chunks === null) {
            wrappedLines.push("");
            return;
          }
          let sumChunks = [chunks.shift()];
          let sumWidth = this.displayWidth(sumChunks[0]);
          chunks.forEach((chunk) => {
            const visibleWidth = this.displayWidth(chunk);
            if (sumWidth + visibleWidth <= width) {
              sumChunks.push(chunk);
              sumWidth += visibleWidth;
              return;
            }
            wrappedLines.push(sumChunks.join(""));
            const nextChunk = chunk.trimStart();
            sumChunks = [nextChunk];
            sumWidth = this.displayWidth(nextChunk);
          });
          wrappedLines.push(sumChunks.join(""));
        });
        return wrappedLines.join("\n");
      }
    };
    function stripColor(str) {
      const sgrPattern = /\x1b\[\d*(;\d*)*m/g;
      return str.replace(sgrPattern, "");
    }
    exports.Help = Help2;
    exports.stripColor = stripColor;
  }
});

// ../../node_modules/commander/lib/option.js
var require_option = __commonJS({
  "../../node_modules/commander/lib/option.js"(exports) {
    "use strict";
    var { InvalidArgumentError: InvalidArgumentError2 } = require_error();
    var Option2 = class {
      /**
       * Initialize a new `Option` with the given `flags` and `description`.
       *
       * @param {string} flags
       * @param {string} [description]
       */
      constructor(flags, description) {
        this.flags = flags;
        this.description = description || "";
        this.required = flags.includes("<");
        this.optional = flags.includes("[");
        this.variadic = /\w\.\.\.[>\]]$/.test(flags);
        this.mandatory = false;
        const optionFlags = splitOptionFlags(flags);
        this.short = optionFlags.shortFlag;
        this.long = optionFlags.longFlag;
        this.negate = false;
        if (this.long) {
          this.negate = this.long.startsWith("--no-");
        }
        this.defaultValue = void 0;
        this.defaultValueDescription = void 0;
        this.presetArg = void 0;
        this.envVar = void 0;
        this.parseArg = void 0;
        this.hidden = false;
        this.argChoices = void 0;
        this.conflictsWith = [];
        this.implied = void 0;
        this.helpGroupHeading = void 0;
      }
      /**
       * Set the default value, and optionally supply the description to be displayed in the help.
       *
       * @param {*} value
       * @param {string} [description]
       * @return {Option}
       */
      default(value, description) {
        this.defaultValue = value;
        this.defaultValueDescription = description;
        return this;
      }
      /**
       * Preset to use when option used without option-argument, especially optional but also boolean and negated.
       * The custom processing (parseArg) is called.
       *
       * @example
       * new Option('--color').default('GREYSCALE').preset('RGB');
       * new Option('--donate [amount]').preset('20').argParser(parseFloat);
       *
       * @param {*} arg
       * @return {Option}
       */
      preset(arg) {
        this.presetArg = arg;
        return this;
      }
      /**
       * Add option name(s) that conflict with this option.
       * An error will be displayed if conflicting options are found during parsing.
       *
       * @example
       * new Option('--rgb').conflicts('cmyk');
       * new Option('--js').conflicts(['ts', 'jsx']);
       *
       * @param {(string | string[])} names
       * @return {Option}
       */
      conflicts(names) {
        this.conflictsWith = this.conflictsWith.concat(names);
        return this;
      }
      /**
       * Specify implied option values for when this option is set and the implied options are not.
       *
       * The custom processing (parseArg) is not called on the implied values.
       *
       * @example
       * program
       *   .addOption(new Option('--log', 'write logging information to file'))
       *   .addOption(new Option('--trace', 'log extra details').implies({ log: 'trace.txt' }));
       *
       * @param {object} impliedOptionValues
       * @return {Option}
       */
      implies(impliedOptionValues) {
        let newImplied = impliedOptionValues;
        if (typeof impliedOptionValues === "string") {
          newImplied = { [impliedOptionValues]: true };
        }
        this.implied = Object.assign(this.implied || {}, newImplied);
        return this;
      }
      /**
       * Set environment variable to check for option value.
       *
       * An environment variable is only used if when processed the current option value is
       * undefined, or the source of the current value is 'default' or 'config' or 'env'.
       *
       * @param {string} name
       * @return {Option}
       */
      env(name) {
        this.envVar = name;
        return this;
      }
      /**
       * Set the custom handler for processing CLI option arguments into option values.
       *
       * @param {Function} [fn]
       * @return {Option}
       */
      argParser(fn) {
        this.parseArg = fn;
        return this;
      }
      /**
       * Whether the option is mandatory and must have a value after parsing.
       *
       * @param {boolean} [mandatory=true]
       * @return {Option}
       */
      makeOptionMandatory(mandatory = true) {
        this.mandatory = !!mandatory;
        return this;
      }
      /**
       * Hide option in help.
       *
       * @param {boolean} [hide=true]
       * @return {Option}
       */
      hideHelp(hide = true) {
        this.hidden = !!hide;
        return this;
      }
      /**
       * @package
       */
      _collectValue(value, previous) {
        if (previous === this.defaultValue || !Array.isArray(previous)) {
          return [value];
        }
        previous.push(value);
        return previous;
      }
      /**
       * Only allow option value to be one of choices.
       *
       * @param {string[]} values
       * @return {Option}
       */
      choices(values) {
        this.argChoices = values.slice();
        this.parseArg = (arg, previous) => {
          if (!this.argChoices.includes(arg)) {
            throw new InvalidArgumentError2(
              `Allowed choices are ${this.argChoices.join(", ")}.`
            );
          }
          if (this.variadic) {
            return this._collectValue(arg, previous);
          }
          return arg;
        };
        return this;
      }
      /**
       * Return option name.
       *
       * @return {string}
       */
      name() {
        if (this.long) {
          return this.long.replace(/^--/, "");
        }
        return this.short.replace(/^-/, "");
      }
      /**
       * Return option name, in a camelcase format that can be used
       * as an object attribute key.
       *
       * @return {string}
       */
      attributeName() {
        if (this.negate) {
          return camelcase(this.name().replace(/^no-/, ""));
        }
        return camelcase(this.name());
      }
      /**
       * Set the help group heading.
       *
       * @param {string} heading
       * @return {Option}
       */
      helpGroup(heading) {
        this.helpGroupHeading = heading;
        return this;
      }
      /**
       * Check if `arg` matches the short or long flag.
       *
       * @param {string} arg
       * @return {boolean}
       * @package
       */
      is(arg) {
        return this.short === arg || this.long === arg;
      }
      /**
       * Return whether a boolean option.
       *
       * Options are one of boolean, negated, required argument, or optional argument.
       *
       * @return {boolean}
       * @package
       */
      isBoolean() {
        return !this.required && !this.optional && !this.negate;
      }
    };
    var DualOptions = class {
      /**
       * @param {Option[]} options
       */
      constructor(options) {
        this.positiveOptions = /* @__PURE__ */ new Map();
        this.negativeOptions = /* @__PURE__ */ new Map();
        this.dualOptions = /* @__PURE__ */ new Set();
        options.forEach((option) => {
          if (option.negate) {
            this.negativeOptions.set(option.attributeName(), option);
          } else {
            this.positiveOptions.set(option.attributeName(), option);
          }
        });
        this.negativeOptions.forEach((value, key) => {
          if (this.positiveOptions.has(key)) {
            this.dualOptions.add(key);
          }
        });
      }
      /**
       * Did the value come from the option, and not from possible matching dual option?
       *
       * @param {*} value
       * @param {Option} option
       * @returns {boolean}
       */
      valueFromOption(value, option) {
        const optionKey = option.attributeName();
        if (!this.dualOptions.has(optionKey)) return true;
        const preset = this.negativeOptions.get(optionKey).presetArg;
        const negativeValue = preset !== void 0 ? preset : false;
        return option.negate === (negativeValue === value);
      }
    };
    function camelcase(str) {
      return str.split("-").reduce((str2, word) => {
        return str2 + word[0].toUpperCase() + word.slice(1);
      });
    }
    function splitOptionFlags(flags) {
      let shortFlag;
      let longFlag;
      const shortFlagExp = /^-[^-]$/;
      const longFlagExp = /^--[^-]/;
      const flagParts = flags.split(/[ |,]+/).concat("guard");
      if (shortFlagExp.test(flagParts[0])) shortFlag = flagParts.shift();
      if (longFlagExp.test(flagParts[0])) longFlag = flagParts.shift();
      if (!shortFlag && shortFlagExp.test(flagParts[0]))
        shortFlag = flagParts.shift();
      if (!shortFlag && longFlagExp.test(flagParts[0])) {
        shortFlag = longFlag;
        longFlag = flagParts.shift();
      }
      if (flagParts[0].startsWith("-")) {
        const unsupportedFlag = flagParts[0];
        const baseError = `option creation failed due to '${unsupportedFlag}' in option flags '${flags}'`;
        if (/^-[^-][^-]/.test(unsupportedFlag))
          throw new Error(
            `${baseError}
- a short flag is a single dash and a single character
  - either use a single dash and a single character (for a short flag)
  - or use a double dash for a long option (and can have two, like '--ws, --workspace')`
          );
        if (shortFlagExp.test(unsupportedFlag))
          throw new Error(`${baseError}
- too many short flags`);
        if (longFlagExp.test(unsupportedFlag))
          throw new Error(`${baseError}
- too many long flags`);
        throw new Error(`${baseError}
- unrecognised flag format`);
      }
      if (shortFlag === void 0 && longFlag === void 0)
        throw new Error(
          `option creation failed due to no flags found in '${flags}'.`
        );
      return { shortFlag, longFlag };
    }
    exports.Option = Option2;
    exports.DualOptions = DualOptions;
  }
});

// ../../node_modules/commander/lib/suggestSimilar.js
var require_suggestSimilar = __commonJS({
  "../../node_modules/commander/lib/suggestSimilar.js"(exports) {
    "use strict";
    var maxDistance = 3;
    function editDistance(a, b) {
      if (Math.abs(a.length - b.length) > maxDistance)
        return Math.max(a.length, b.length);
      const d = [];
      for (let i = 0; i <= a.length; i++) {
        d[i] = [i];
      }
      for (let j = 0; j <= b.length; j++) {
        d[0][j] = j;
      }
      for (let j = 1; j <= b.length; j++) {
        for (let i = 1; i <= a.length; i++) {
          let cost = 1;
          if (a[i - 1] === b[j - 1]) {
            cost = 0;
          } else {
            cost = 1;
          }
          d[i][j] = Math.min(
            d[i - 1][j] + 1,
            // deletion
            d[i][j - 1] + 1,
            // insertion
            d[i - 1][j - 1] + cost
            // substitution
          );
          if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
            d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
          }
        }
      }
      return d[a.length][b.length];
    }
    function suggestSimilar(word, candidates) {
      if (!candidates || candidates.length === 0) return "";
      candidates = Array.from(new Set(candidates));
      const searchingOptions = word.startsWith("--");
      if (searchingOptions) {
        word = word.slice(2);
        candidates = candidates.map((candidate) => candidate.slice(2));
      }
      let similar = [];
      let bestDistance = maxDistance;
      const minSimilarity = 0.4;
      candidates.forEach((candidate) => {
        if (candidate.length <= 1) return;
        const distance = editDistance(word, candidate);
        const length = Math.max(word.length, candidate.length);
        const similarity = (length - distance) / length;
        if (similarity > minSimilarity) {
          if (distance < bestDistance) {
            bestDistance = distance;
            similar = [candidate];
          } else if (distance === bestDistance) {
            similar.push(candidate);
          }
        }
      });
      similar.sort((a, b) => a.localeCompare(b));
      if (searchingOptions) {
        similar = similar.map((candidate) => `--${candidate}`);
      }
      if (similar.length > 1) {
        return `
(Did you mean one of ${similar.join(", ")}?)`;
      }
      if (similar.length === 1) {
        return `
(Did you mean ${similar[0]}?)`;
      }
      return "";
    }
    exports.suggestSimilar = suggestSimilar;
  }
});

// ../../node_modules/commander/lib/command.js
var require_command = __commonJS({
  "../../node_modules/commander/lib/command.js"(exports) {
    "use strict";
    var EventEmitter = __require("events").EventEmitter;
    var childProcess = __require("child_process");
    var path = __require("path");
    var fs = __require("fs");
    var process2 = __require("process");
    var { Argument: Argument2, humanReadableArgName } = require_argument();
    var { CommanderError: CommanderError2 } = require_error();
    var { Help: Help2, stripColor } = require_help();
    var { Option: Option2, DualOptions } = require_option();
    var { suggestSimilar } = require_suggestSimilar();
    var Command2 = class _Command extends EventEmitter {
      /**
       * Initialize a new `Command`.
       *
       * @param {string} [name]
       */
      constructor(name) {
        super();
        this.commands = [];
        this.options = [];
        this.parent = null;
        this._allowUnknownOption = false;
        this._allowExcessArguments = false;
        this.registeredArguments = [];
        this._args = this.registeredArguments;
        this.args = [];
        this.rawArgs = [];
        this.processedArgs = [];
        this._scriptPath = null;
        this._name = name || "";
        this._optionValues = {};
        this._optionValueSources = {};
        this._storeOptionsAsProperties = false;
        this._actionHandler = null;
        this._executableHandler = false;
        this._executableFile = null;
        this._executableDir = null;
        this._defaultCommandName = null;
        this._exitCallback = null;
        this._aliases = [];
        this._combineFlagAndOptionalValue = true;
        this._description = "";
        this._summary = "";
        this._argsDescription = void 0;
        this._enablePositionalOptions = false;
        this._passThroughOptions = false;
        this._lifeCycleHooks = {};
        this._showHelpAfterError = false;
        this._showSuggestionAfterError = true;
        this._savedState = null;
        this._outputConfiguration = {
          writeOut: (str) => process2.stdout.write(str),
          writeErr: (str) => process2.stderr.write(str),
          outputError: (str, write) => write(str),
          getOutHelpWidth: () => process2.stdout.isTTY ? process2.stdout.columns : void 0,
          getErrHelpWidth: () => process2.stderr.isTTY ? process2.stderr.columns : void 0,
          getOutHasColors: () => useColor() ?? (process2.stdout.isTTY && process2.stdout.hasColors?.()),
          getErrHasColors: () => useColor() ?? (process2.stderr.isTTY && process2.stderr.hasColors?.()),
          stripColor: (str) => stripColor(str)
        };
        this._hidden = false;
        this._helpOption = void 0;
        this._addImplicitHelpCommand = void 0;
        this._helpCommand = void 0;
        this._helpConfiguration = {};
        this._helpGroupHeading = void 0;
        this._defaultCommandGroup = void 0;
        this._defaultOptionGroup = void 0;
      }
      /**
       * Copy settings that are useful to have in common across root command and subcommands.
       *
       * (Used internally when adding a command using `.command()` so subcommands inherit parent settings.)
       *
       * @param {Command} sourceCommand
       * @return {Command} `this` command for chaining
       */
      copyInheritedSettings(sourceCommand) {
        this._outputConfiguration = sourceCommand._outputConfiguration;
        this._helpOption = sourceCommand._helpOption;
        this._helpCommand = sourceCommand._helpCommand;
        this._helpConfiguration = sourceCommand._helpConfiguration;
        this._exitCallback = sourceCommand._exitCallback;
        this._storeOptionsAsProperties = sourceCommand._storeOptionsAsProperties;
        this._combineFlagAndOptionalValue = sourceCommand._combineFlagAndOptionalValue;
        this._allowExcessArguments = sourceCommand._allowExcessArguments;
        this._enablePositionalOptions = sourceCommand._enablePositionalOptions;
        this._showHelpAfterError = sourceCommand._showHelpAfterError;
        this._showSuggestionAfterError = sourceCommand._showSuggestionAfterError;
        return this;
      }
      /**
       * @returns {Command[]}
       * @private
       */
      _getCommandAndAncestors() {
        const result = [];
        for (let command = this; command; command = command.parent) {
          result.push(command);
        }
        return result;
      }
      /**
       * Define a command.
       *
       * There are two styles of command: pay attention to where to put the description.
       *
       * @example
       * // Command implemented using action handler (description is supplied separately to `.command`)
       * program
       *   .command('clone <source> [destination]')
       *   .description('clone a repository into a newly created directory')
       *   .action((source, destination) => {
       *     console.log('clone command called');
       *   });
       *
       * // Command implemented using separate executable file (description is second parameter to `.command`)
       * program
       *   .command('start <service>', 'start named service')
       *   .command('stop [service]', 'stop named service, or all if no name supplied');
       *
       * @param {string} nameAndArgs - command name and arguments, args are `<required>` or `[optional]` and last may also be `variadic...`
       * @param {(object | string)} [actionOptsOrExecDesc] - configuration options (for action), or description (for executable)
       * @param {object} [execOpts] - configuration options (for executable)
       * @return {Command} returns new command for action handler, or `this` for executable command
       */
      command(nameAndArgs, actionOptsOrExecDesc, execOpts) {
        let desc = actionOptsOrExecDesc;
        let opts = execOpts;
        if (typeof desc === "object" && desc !== null) {
          opts = desc;
          desc = null;
        }
        opts = opts || {};
        const [, name, args] = nameAndArgs.match(/([^ ]+) *(.*)/);
        const cmd = this.createCommand(name);
        if (desc) {
          cmd.description(desc);
          cmd._executableHandler = true;
        }
        if (opts.isDefault) this._defaultCommandName = cmd._name;
        cmd._hidden = !!(opts.noHelp || opts.hidden);
        cmd._executableFile = opts.executableFile || null;
        if (args) cmd.arguments(args);
        this._registerCommand(cmd);
        cmd.parent = this;
        cmd.copyInheritedSettings(this);
        if (desc) return this;
        return cmd;
      }
      /**
       * Factory routine to create a new unattached command.
       *
       * See .command() for creating an attached subcommand, which uses this routine to
       * create the command. You can override createCommand to customise subcommands.
       *
       * @param {string} [name]
       * @return {Command} new command
       */
      createCommand(name) {
        return new _Command(name);
      }
      /**
       * You can customise the help with a subclass of Help by overriding createHelp,
       * or by overriding Help properties using configureHelp().
       *
       * @return {Help}
       */
      createHelp() {
        return Object.assign(new Help2(), this.configureHelp());
      }
      /**
       * You can customise the help by overriding Help properties using configureHelp(),
       * or with a subclass of Help by overriding createHelp().
       *
       * @param {object} [configuration] - configuration options
       * @return {(Command | object)} `this` command for chaining, or stored configuration
       */
      configureHelp(configuration) {
        if (configuration === void 0) return this._helpConfiguration;
        this._helpConfiguration = configuration;
        return this;
      }
      /**
       * The default output goes to stdout and stderr. You can customise this for special
       * applications. You can also customise the display of errors by overriding outputError.
       *
       * The configuration properties are all functions:
       *
       *     // change how output being written, defaults to stdout and stderr
       *     writeOut(str)
       *     writeErr(str)
       *     // change how output being written for errors, defaults to writeErr
       *     outputError(str, write) // used for displaying errors and not used for displaying help
       *     // specify width for wrapping help
       *     getOutHelpWidth()
       *     getErrHelpWidth()
       *     // color support, currently only used with Help
       *     getOutHasColors()
       *     getErrHasColors()
       *     stripColor() // used to remove ANSI escape codes if output does not have colors
       *
       * @param {object} [configuration] - configuration options
       * @return {(Command | object)} `this` command for chaining, or stored configuration
       */
      configureOutput(configuration) {
        if (configuration === void 0) return this._outputConfiguration;
        this._outputConfiguration = {
          ...this._outputConfiguration,
          ...configuration
        };
        return this;
      }
      /**
       * Display the help or a custom message after an error occurs.
       *
       * @param {(boolean|string)} [displayHelp]
       * @return {Command} `this` command for chaining
       */
      showHelpAfterError(displayHelp = true) {
        if (typeof displayHelp !== "string") displayHelp = !!displayHelp;
        this._showHelpAfterError = displayHelp;
        return this;
      }
      /**
       * Display suggestion of similar commands for unknown commands, or options for unknown options.
       *
       * @param {boolean} [displaySuggestion]
       * @return {Command} `this` command for chaining
       */
      showSuggestionAfterError(displaySuggestion = true) {
        this._showSuggestionAfterError = !!displaySuggestion;
        return this;
      }
      /**
       * Add a prepared subcommand.
       *
       * See .command() for creating an attached subcommand which inherits settings from its parent.
       *
       * @param {Command} cmd - new subcommand
       * @param {object} [opts] - configuration options
       * @return {Command} `this` command for chaining
       */
      addCommand(cmd, opts) {
        if (!cmd._name) {
          throw new Error(`Command passed to .addCommand() must have a name
- specify the name in Command constructor or using .name()`);
        }
        opts = opts || {};
        if (opts.isDefault) this._defaultCommandName = cmd._name;
        if (opts.noHelp || opts.hidden) cmd._hidden = true;
        this._registerCommand(cmd);
        cmd.parent = this;
        cmd._checkForBrokenPassThrough();
        return this;
      }
      /**
       * Factory routine to create a new unattached argument.
       *
       * See .argument() for creating an attached argument, which uses this routine to
       * create the argument. You can override createArgument to return a custom argument.
       *
       * @param {string} name
       * @param {string} [description]
       * @return {Argument} new argument
       */
      createArgument(name, description) {
        return new Argument2(name, description);
      }
      /**
       * Define argument syntax for command.
       *
       * The default is that the argument is required, and you can explicitly
       * indicate this with <> around the name. Put [] around the name for an optional argument.
       *
       * @example
       * program.argument('<input-file>');
       * program.argument('[output-file]');
       *
       * @param {string} name
       * @param {string} [description]
       * @param {(Function|*)} [parseArg] - custom argument processing function or default value
       * @param {*} [defaultValue]
       * @return {Command} `this` command for chaining
       */
      argument(name, description, parseArg, defaultValue) {
        const argument = this.createArgument(name, description);
        if (typeof parseArg === "function") {
          argument.default(defaultValue).argParser(parseArg);
        } else {
          argument.default(parseArg);
        }
        this.addArgument(argument);
        return this;
      }
      /**
       * Define argument syntax for command, adding multiple at once (without descriptions).
       *
       * See also .argument().
       *
       * @example
       * program.arguments('<cmd> [env]');
       *
       * @param {string} names
       * @return {Command} `this` command for chaining
       */
      arguments(names) {
        names.trim().split(/ +/).forEach((detail) => {
          this.argument(detail);
        });
        return this;
      }
      /**
       * Define argument syntax for command, adding a prepared argument.
       *
       * @param {Argument} argument
       * @return {Command} `this` command for chaining
       */
      addArgument(argument) {
        const previousArgument = this.registeredArguments.slice(-1)[0];
        if (previousArgument?.variadic) {
          throw new Error(
            `only the last argument can be variadic '${previousArgument.name()}'`
          );
        }
        if (argument.required && argument.defaultValue !== void 0 && argument.parseArg === void 0) {
          throw new Error(
            `a default value for a required argument is never used: '${argument.name()}'`
          );
        }
        this.registeredArguments.push(argument);
        return this;
      }
      /**
       * Customise or override default help command. By default a help command is automatically added if your command has subcommands.
       *
       * @example
       *    program.helpCommand('help [cmd]');
       *    program.helpCommand('help [cmd]', 'show help');
       *    program.helpCommand(false); // suppress default help command
       *    program.helpCommand(true); // add help command even if no subcommands
       *
       * @param {string|boolean} enableOrNameAndArgs - enable with custom name and/or arguments, or boolean to override whether added
       * @param {string} [description] - custom description
       * @return {Command} `this` command for chaining
       */
      helpCommand(enableOrNameAndArgs, description) {
        if (typeof enableOrNameAndArgs === "boolean") {
          this._addImplicitHelpCommand = enableOrNameAndArgs;
          if (enableOrNameAndArgs && this._defaultCommandGroup) {
            this._initCommandGroup(this._getHelpCommand());
          }
          return this;
        }
        const nameAndArgs = enableOrNameAndArgs ?? "help [command]";
        const [, helpName, helpArgs] = nameAndArgs.match(/([^ ]+) *(.*)/);
        const helpDescription = description ?? "display help for command";
        const helpCommand = this.createCommand(helpName);
        helpCommand.helpOption(false);
        if (helpArgs) helpCommand.arguments(helpArgs);
        if (helpDescription) helpCommand.description(helpDescription);
        this._addImplicitHelpCommand = true;
        this._helpCommand = helpCommand;
        if (enableOrNameAndArgs || description) this._initCommandGroup(helpCommand);
        return this;
      }
      /**
       * Add prepared custom help command.
       *
       * @param {(Command|string|boolean)} helpCommand - custom help command, or deprecated enableOrNameAndArgs as for `.helpCommand()`
       * @param {string} [deprecatedDescription] - deprecated custom description used with custom name only
       * @return {Command} `this` command for chaining
       */
      addHelpCommand(helpCommand, deprecatedDescription) {
        if (typeof helpCommand !== "object") {
          this.helpCommand(helpCommand, deprecatedDescription);
          return this;
        }
        this._addImplicitHelpCommand = true;
        this._helpCommand = helpCommand;
        this._initCommandGroup(helpCommand);
        return this;
      }
      /**
       * Lazy create help command.
       *
       * @return {(Command|null)}
       * @package
       */
      _getHelpCommand() {
        const hasImplicitHelpCommand = this._addImplicitHelpCommand ?? (this.commands.length && !this._actionHandler && !this._findCommand("help"));
        if (hasImplicitHelpCommand) {
          if (this._helpCommand === void 0) {
            this.helpCommand(void 0, void 0);
          }
          return this._helpCommand;
        }
        return null;
      }
      /**
       * Add hook for life cycle event.
       *
       * @param {string} event
       * @param {Function} listener
       * @return {Command} `this` command for chaining
       */
      hook(event, listener) {
        const allowedValues = ["preSubcommand", "preAction", "postAction"];
        if (!allowedValues.includes(event)) {
          throw new Error(`Unexpected value for event passed to hook : '${event}'.
Expecting one of '${allowedValues.join("', '")}'`);
        }
        if (this._lifeCycleHooks[event]) {
          this._lifeCycleHooks[event].push(listener);
        } else {
          this._lifeCycleHooks[event] = [listener];
        }
        return this;
      }
      /**
       * Register callback to use as replacement for calling process.exit.
       *
       * @param {Function} [fn] optional callback which will be passed a CommanderError, defaults to throwing
       * @return {Command} `this` command for chaining
       */
      exitOverride(fn) {
        if (fn) {
          this._exitCallback = fn;
        } else {
          this._exitCallback = (err) => {
            if (err.code !== "commander.executeSubCommandAsync") {
              throw err;
            } else {
            }
          };
        }
        return this;
      }
      /**
       * Call process.exit, and _exitCallback if defined.
       *
       * @param {number} exitCode exit code for using with process.exit
       * @param {string} code an id string representing the error
       * @param {string} message human-readable description of the error
       * @return never
       * @private
       */
      _exit(exitCode, code, message) {
        if (this._exitCallback) {
          this._exitCallback(new CommanderError2(exitCode, code, message));
        }
        process2.exit(exitCode);
      }
      /**
       * Register callback `fn` for the command.
       *
       * @example
       * program
       *   .command('serve')
       *   .description('start service')
       *   .action(function() {
       *      // do work here
       *   });
       *
       * @param {Function} fn
       * @return {Command} `this` command for chaining
       */
      action(fn) {
        const listener = (args) => {
          const expectedArgsCount = this.registeredArguments.length;
          const actionArgs = args.slice(0, expectedArgsCount);
          if (this._storeOptionsAsProperties) {
            actionArgs[expectedArgsCount] = this;
          } else {
            actionArgs[expectedArgsCount] = this.opts();
          }
          actionArgs.push(this);
          return fn.apply(this, actionArgs);
        };
        this._actionHandler = listener;
        return this;
      }
      /**
       * Factory routine to create a new unattached option.
       *
       * See .option() for creating an attached option, which uses this routine to
       * create the option. You can override createOption to return a custom option.
       *
       * @param {string} flags
       * @param {string} [description]
       * @return {Option} new option
       */
      createOption(flags, description) {
        return new Option2(flags, description);
      }
      /**
       * Wrap parseArgs to catch 'commander.invalidArgument'.
       *
       * @param {(Option | Argument)} target
       * @param {string} value
       * @param {*} previous
       * @param {string} invalidArgumentMessage
       * @private
       */
      _callParseArg(target, value, previous, invalidArgumentMessage) {
        try {
          return target.parseArg(value, previous);
        } catch (err) {
          if (err.code === "commander.invalidArgument") {
            const message = `${invalidArgumentMessage} ${err.message}`;
            this.error(message, { exitCode: err.exitCode, code: err.code });
          }
          throw err;
        }
      }
      /**
       * Check for option flag conflicts.
       * Register option if no conflicts found, or throw on conflict.
       *
       * @param {Option} option
       * @private
       */
      _registerOption(option) {
        const matchingOption = option.short && this._findOption(option.short) || option.long && this._findOption(option.long);
        if (matchingOption) {
          const matchingFlag = option.long && this._findOption(option.long) ? option.long : option.short;
          throw new Error(`Cannot add option '${option.flags}'${this._name && ` to command '${this._name}'`} due to conflicting flag '${matchingFlag}'
-  already used by option '${matchingOption.flags}'`);
        }
        this._initOptionGroup(option);
        this.options.push(option);
      }
      /**
       * Check for command name and alias conflicts with existing commands.
       * Register command if no conflicts found, or throw on conflict.
       *
       * @param {Command} command
       * @private
       */
      _registerCommand(command) {
        const knownBy = (cmd) => {
          return [cmd.name()].concat(cmd.aliases());
        };
        const alreadyUsed = knownBy(command).find(
          (name) => this._findCommand(name)
        );
        if (alreadyUsed) {
          const existingCmd = knownBy(this._findCommand(alreadyUsed)).join("|");
          const newCmd = knownBy(command).join("|");
          throw new Error(
            `cannot add command '${newCmd}' as already have command '${existingCmd}'`
          );
        }
        this._initCommandGroup(command);
        this.commands.push(command);
      }
      /**
       * Add an option.
       *
       * @param {Option} option
       * @return {Command} `this` command for chaining
       */
      addOption(option) {
        this._registerOption(option);
        const oname = option.name();
        const name = option.attributeName();
        if (option.negate) {
          const positiveLongFlag = option.long.replace(/^--no-/, "--");
          if (!this._findOption(positiveLongFlag)) {
            this.setOptionValueWithSource(
              name,
              option.defaultValue === void 0 ? true : option.defaultValue,
              "default"
            );
          }
        } else if (option.defaultValue !== void 0) {
          this.setOptionValueWithSource(name, option.defaultValue, "default");
        }
        const handleOptionValue = (val, invalidValueMessage, valueSource) => {
          if (val == null && option.presetArg !== void 0) {
            val = option.presetArg;
          }
          const oldValue = this.getOptionValue(name);
          if (val !== null && option.parseArg) {
            val = this._callParseArg(option, val, oldValue, invalidValueMessage);
          } else if (val !== null && option.variadic) {
            val = option._collectValue(val, oldValue);
          }
          if (val == null) {
            if (option.negate) {
              val = false;
            } else if (option.isBoolean() || option.optional) {
              val = true;
            } else {
              val = "";
            }
          }
          this.setOptionValueWithSource(name, val, valueSource);
        };
        this.on("option:" + oname, (val) => {
          const invalidValueMessage = `error: option '${option.flags}' argument '${val}' is invalid.`;
          handleOptionValue(val, invalidValueMessage, "cli");
        });
        if (option.envVar) {
          this.on("optionEnv:" + oname, (val) => {
            const invalidValueMessage = `error: option '${option.flags}' value '${val}' from env '${option.envVar}' is invalid.`;
            handleOptionValue(val, invalidValueMessage, "env");
          });
        }
        return this;
      }
      /**
       * Internal implementation shared by .option() and .requiredOption()
       *
       * @return {Command} `this` command for chaining
       * @private
       */
      _optionEx(config, flags, description, fn, defaultValue) {
        if (typeof flags === "object" && flags instanceof Option2) {
          throw new Error(
            "To add an Option object use addOption() instead of option() or requiredOption()"
          );
        }
        const option = this.createOption(flags, description);
        option.makeOptionMandatory(!!config.mandatory);
        if (typeof fn === "function") {
          option.default(defaultValue).argParser(fn);
        } else if (fn instanceof RegExp) {
          const regex = fn;
          fn = (val, def) => {
            const m = regex.exec(val);
            return m ? m[0] : def;
          };
          option.default(defaultValue).argParser(fn);
        } else {
          option.default(fn);
        }
        return this.addOption(option);
      }
      /**
       * Define option with `flags`, `description`, and optional argument parsing function or `defaultValue` or both.
       *
       * The `flags` string contains the short and/or long flags, separated by comma, a pipe or space. A required
       * option-argument is indicated by `<>` and an optional option-argument by `[]`.
       *
       * See the README for more details, and see also addOption() and requiredOption().
       *
       * @example
       * program
       *     .option('-p, --pepper', 'add pepper')
       *     .option('--pt, --pizza-type <TYPE>', 'type of pizza') // required option-argument
       *     .option('-c, --cheese [CHEESE]', 'add extra cheese', 'mozzarella') // optional option-argument with default
       *     .option('-t, --tip <VALUE>', 'add tip to purchase cost', parseFloat) // custom parse function
       *
       * @param {string} flags
       * @param {string} [description]
       * @param {(Function|*)} [parseArg] - custom option processing function or default value
       * @param {*} [defaultValue]
       * @return {Command} `this` command for chaining
       */
      option(flags, description, parseArg, defaultValue) {
        return this._optionEx({}, flags, description, parseArg, defaultValue);
      }
      /**
       * Add a required option which must have a value after parsing. This usually means
       * the option must be specified on the command line. (Otherwise the same as .option().)
       *
       * The `flags` string contains the short and/or long flags, separated by comma, a pipe or space.
       *
       * @param {string} flags
       * @param {string} [description]
       * @param {(Function|*)} [parseArg] - custom option processing function or default value
       * @param {*} [defaultValue]
       * @return {Command} `this` command for chaining
       */
      requiredOption(flags, description, parseArg, defaultValue) {
        return this._optionEx(
          { mandatory: true },
          flags,
          description,
          parseArg,
          defaultValue
        );
      }
      /**
       * Alter parsing of short flags with optional values.
       *
       * @example
       * // for `.option('-f,--flag [value]'):
       * program.combineFlagAndOptionalValue(true);  // `-f80` is treated like `--flag=80`, this is the default behaviour
       * program.combineFlagAndOptionalValue(false) // `-fb` is treated like `-f -b`
       *
       * @param {boolean} [combine] - if `true` or omitted, an optional value can be specified directly after the flag.
       * @return {Command} `this` command for chaining
       */
      combineFlagAndOptionalValue(combine = true) {
        this._combineFlagAndOptionalValue = !!combine;
        return this;
      }
      /**
       * Allow unknown options on the command line.
       *
       * @param {boolean} [allowUnknown] - if `true` or omitted, no error will be thrown for unknown options.
       * @return {Command} `this` command for chaining
       */
      allowUnknownOption(allowUnknown = true) {
        this._allowUnknownOption = !!allowUnknown;
        return this;
      }
      /**
       * Allow excess command-arguments on the command line. Pass false to make excess arguments an error.
       *
       * @param {boolean} [allowExcess] - if `true` or omitted, no error will be thrown for excess arguments.
       * @return {Command} `this` command for chaining
       */
      allowExcessArguments(allowExcess = true) {
        this._allowExcessArguments = !!allowExcess;
        return this;
      }
      /**
       * Enable positional options. Positional means global options are specified before subcommands which lets
       * subcommands reuse the same option names, and also enables subcommands to turn on passThroughOptions.
       * The default behaviour is non-positional and global options may appear anywhere on the command line.
       *
       * @param {boolean} [positional]
       * @return {Command} `this` command for chaining
       */
      enablePositionalOptions(positional = true) {
        this._enablePositionalOptions = !!positional;
        return this;
      }
      /**
       * Pass through options that come after command-arguments rather than treat them as command-options,
       * so actual command-options come before command-arguments. Turning this on for a subcommand requires
       * positional options to have been enabled on the program (parent commands).
       * The default behaviour is non-positional and options may appear before or after command-arguments.
       *
       * @param {boolean} [passThrough] for unknown options.
       * @return {Command} `this` command for chaining
       */
      passThroughOptions(passThrough = true) {
        this._passThroughOptions = !!passThrough;
        this._checkForBrokenPassThrough();
        return this;
      }
      /**
       * @private
       */
      _checkForBrokenPassThrough() {
        if (this.parent && this._passThroughOptions && !this.parent._enablePositionalOptions) {
          throw new Error(
            `passThroughOptions cannot be used for '${this._name}' without turning on enablePositionalOptions for parent command(s)`
          );
        }
      }
      /**
       * Whether to store option values as properties on command object,
       * or store separately (specify false). In both cases the option values can be accessed using .opts().
       *
       * @param {boolean} [storeAsProperties=true]
       * @return {Command} `this` command for chaining
       */
      storeOptionsAsProperties(storeAsProperties = true) {
        if (this.options.length) {
          throw new Error("call .storeOptionsAsProperties() before adding options");
        }
        if (Object.keys(this._optionValues).length) {
          throw new Error(
            "call .storeOptionsAsProperties() before setting option values"
          );
        }
        this._storeOptionsAsProperties = !!storeAsProperties;
        return this;
      }
      /**
       * Retrieve option value.
       *
       * @param {string} key
       * @return {object} value
       */
      getOptionValue(key) {
        if (this._storeOptionsAsProperties) {
          return this[key];
        }
        return this._optionValues[key];
      }
      /**
       * Store option value.
       *
       * @param {string} key
       * @param {object} value
       * @return {Command} `this` command for chaining
       */
      setOptionValue(key, value) {
        return this.setOptionValueWithSource(key, value, void 0);
      }
      /**
       * Store option value and where the value came from.
       *
       * @param {string} key
       * @param {object} value
       * @param {string} source - expected values are default/config/env/cli/implied
       * @return {Command} `this` command for chaining
       */
      setOptionValueWithSource(key, value, source) {
        if (this._storeOptionsAsProperties) {
          this[key] = value;
        } else {
          this._optionValues[key] = value;
        }
        this._optionValueSources[key] = source;
        return this;
      }
      /**
       * Get source of option value.
       * Expected values are default | config | env | cli | implied
       *
       * @param {string} key
       * @return {string}
       */
      getOptionValueSource(key) {
        return this._optionValueSources[key];
      }
      /**
       * Get source of option value. See also .optsWithGlobals().
       * Expected values are default | config | env | cli | implied
       *
       * @param {string} key
       * @return {string}
       */
      getOptionValueSourceWithGlobals(key) {
        let source;
        this._getCommandAndAncestors().forEach((cmd) => {
          if (cmd.getOptionValueSource(key) !== void 0) {
            source = cmd.getOptionValueSource(key);
          }
        });
        return source;
      }
      /**
       * Get user arguments from implied or explicit arguments.
       * Side-effects: set _scriptPath if args included script. Used for default program name, and subcommand searches.
       *
       * @private
       */
      _prepareUserArgs(argv, parseOptions) {
        if (argv !== void 0 && !Array.isArray(argv)) {
          throw new Error("first parameter to parse must be array or undefined");
        }
        parseOptions = parseOptions || {};
        if (argv === void 0 && parseOptions.from === void 0) {
          if (process2.versions?.electron) {
            parseOptions.from = "electron";
          }
          const execArgv = process2.execArgv ?? [];
          if (execArgv.includes("-e") || execArgv.includes("--eval") || execArgv.includes("-p") || execArgv.includes("--print")) {
            parseOptions.from = "eval";
          }
        }
        if (argv === void 0) {
          argv = process2.argv;
        }
        this.rawArgs = argv.slice();
        let userArgs;
        switch (parseOptions.from) {
          case void 0:
          case "node":
            this._scriptPath = argv[1];
            userArgs = argv.slice(2);
            break;
          case "electron":
            if (process2.defaultApp) {
              this._scriptPath = argv[1];
              userArgs = argv.slice(2);
            } else {
              userArgs = argv.slice(1);
            }
            break;
          case "user":
            userArgs = argv.slice(0);
            break;
          case "eval":
            userArgs = argv.slice(1);
            break;
          default:
            throw new Error(
              `unexpected parse option { from: '${parseOptions.from}' }`
            );
        }
        if (!this._name && this._scriptPath)
          this.nameFromFilename(this._scriptPath);
        this._name = this._name || "program";
        return userArgs;
      }
      /**
       * Parse `argv`, setting options and invoking commands when defined.
       *
       * Use parseAsync instead of parse if any of your action handlers are async.
       *
       * Call with no parameters to parse `process.argv`. Detects Electron and special node options like `node --eval`. Easy mode!
       *
       * Or call with an array of strings to parse, and optionally where the user arguments start by specifying where the arguments are `from`:
       * - `'node'`: default, `argv[0]` is the application and `argv[1]` is the script being run, with user arguments after that
       * - `'electron'`: `argv[0]` is the application and `argv[1]` varies depending on whether the electron application is packaged
       * - `'user'`: just user arguments
       *
       * @example
       * program.parse(); // parse process.argv and auto-detect electron and special node flags
       * program.parse(process.argv); // assume argv[0] is app and argv[1] is script
       * program.parse(my-args, { from: 'user' }); // just user supplied arguments, nothing special about argv[0]
       *
       * @param {string[]} [argv] - optional, defaults to process.argv
       * @param {object} [parseOptions] - optionally specify style of options with from: node/user/electron
       * @param {string} [parseOptions.from] - where the args are from: 'node', 'user', 'electron'
       * @return {Command} `this` command for chaining
       */
      parse(argv, parseOptions) {
        this._prepareForParse();
        const userArgs = this._prepareUserArgs(argv, parseOptions);
        this._parseCommand([], userArgs);
        return this;
      }
      /**
       * Parse `argv`, setting options and invoking commands when defined.
       *
       * Call with no parameters to parse `process.argv`. Detects Electron and special node options like `node --eval`. Easy mode!
       *
       * Or call with an array of strings to parse, and optionally where the user arguments start by specifying where the arguments are `from`:
       * - `'node'`: default, `argv[0]` is the application and `argv[1]` is the script being run, with user arguments after that
       * - `'electron'`: `argv[0]` is the application and `argv[1]` varies depending on whether the electron application is packaged
       * - `'user'`: just user arguments
       *
       * @example
       * await program.parseAsync(); // parse process.argv and auto-detect electron and special node flags
       * await program.parseAsync(process.argv); // assume argv[0] is app and argv[1] is script
       * await program.parseAsync(my-args, { from: 'user' }); // just user supplied arguments, nothing special about argv[0]
       *
       * @param {string[]} [argv]
       * @param {object} [parseOptions]
       * @param {string} parseOptions.from - where the args are from: 'node', 'user', 'electron'
       * @return {Promise}
       */
      async parseAsync(argv, parseOptions) {
        this._prepareForParse();
        const userArgs = this._prepareUserArgs(argv, parseOptions);
        await this._parseCommand([], userArgs);
        return this;
      }
      _prepareForParse() {
        if (this._savedState === null) {
          this.saveStateBeforeParse();
        } else {
          this.restoreStateBeforeParse();
        }
      }
      /**
       * Called the first time parse is called to save state and allow a restore before subsequent calls to parse.
       * Not usually called directly, but available for subclasses to save their custom state.
       *
       * This is called in a lazy way. Only commands used in parsing chain will have state saved.
       */
      saveStateBeforeParse() {
        this._savedState = {
          // name is stable if supplied by author, but may be unspecified for root command and deduced during parsing
          _name: this._name,
          // option values before parse have default values (including false for negated options)
          // shallow clones
          _optionValues: { ...this._optionValues },
          _optionValueSources: { ...this._optionValueSources }
        };
      }
      /**
       * Restore state before parse for calls after the first.
       * Not usually called directly, but available for subclasses to save their custom state.
       *
       * This is called in a lazy way. Only commands used in parsing chain will have state restored.
       */
      restoreStateBeforeParse() {
        if (this._storeOptionsAsProperties)
          throw new Error(`Can not call parse again when storeOptionsAsProperties is true.
- either make a new Command for each call to parse, or stop storing options as properties`);
        this._name = this._savedState._name;
        this._scriptPath = null;
        this.rawArgs = [];
        this._optionValues = { ...this._savedState._optionValues };
        this._optionValueSources = { ...this._savedState._optionValueSources };
        this.args = [];
        this.processedArgs = [];
      }
      /**
       * Throw if expected executable is missing. Add lots of help for author.
       *
       * @param {string} executableFile
       * @param {string} executableDir
       * @param {string} subcommandName
       */
      _checkForMissingExecutable(executableFile, executableDir, subcommandName) {
        if (fs.existsSync(executableFile)) return;
        const executableDirMessage = executableDir ? `searched for local subcommand relative to directory '${executableDir}'` : "no directory for search for local subcommand, use .executableDir() to supply a custom directory";
        const executableMissing = `'${executableFile}' does not exist
 - if '${subcommandName}' is not meant to be an executable command, remove description parameter from '.command()' and use '.description()' instead
 - if the default executable name is not suitable, use the executableFile option to supply a custom name or path
 - ${executableDirMessage}`;
        throw new Error(executableMissing);
      }
      /**
       * Execute a sub-command executable.
       *
       * @private
       */
      _executeSubCommand(subcommand, args) {
        args = args.slice();
        let launchWithNode = false;
        const sourceExt = [".js", ".ts", ".tsx", ".mjs", ".cjs"];
        function findFile(baseDir, baseName) {
          const localBin = path.resolve(baseDir, baseName);
          if (fs.existsSync(localBin)) return localBin;
          if (sourceExt.includes(path.extname(baseName))) return void 0;
          const foundExt = sourceExt.find(
            (ext) => fs.existsSync(`${localBin}${ext}`)
          );
          if (foundExt) return `${localBin}${foundExt}`;
          return void 0;
        }
        this._checkForMissingMandatoryOptions();
        this._checkForConflictingOptions();
        let executableFile = subcommand._executableFile || `${this._name}-${subcommand._name}`;
        let executableDir = this._executableDir || "";
        if (this._scriptPath) {
          let resolvedScriptPath;
          try {
            resolvedScriptPath = fs.realpathSync(this._scriptPath);
          } catch {
            resolvedScriptPath = this._scriptPath;
          }
          executableDir = path.resolve(
            path.dirname(resolvedScriptPath),
            executableDir
          );
        }
        if (executableDir) {
          let localFile = findFile(executableDir, executableFile);
          if (!localFile && !subcommand._executableFile && this._scriptPath) {
            const legacyName = path.basename(
              this._scriptPath,
              path.extname(this._scriptPath)
            );
            if (legacyName !== this._name) {
              localFile = findFile(
                executableDir,
                `${legacyName}-${subcommand._name}`
              );
            }
          }
          executableFile = localFile || executableFile;
        }
        launchWithNode = sourceExt.includes(path.extname(executableFile));
        let proc;
        if (process2.platform !== "win32") {
          if (launchWithNode) {
            args.unshift(executableFile);
            args = incrementNodeInspectorPort(process2.execArgv).concat(args);
            proc = childProcess.spawn(process2.argv[0], args, { stdio: "inherit" });
          } else {
            proc = childProcess.spawn(executableFile, args, { stdio: "inherit" });
          }
        } else {
          this._checkForMissingExecutable(
            executableFile,
            executableDir,
            subcommand._name
          );
          args.unshift(executableFile);
          args = incrementNodeInspectorPort(process2.execArgv).concat(args);
          proc = childProcess.spawn(process2.execPath, args, { stdio: "inherit" });
        }
        if (!proc.killed) {
          const signals = ["SIGUSR1", "SIGUSR2", "SIGTERM", "SIGINT", "SIGHUP"];
          signals.forEach((signal) => {
            process2.on(signal, () => {
              if (proc.killed === false && proc.exitCode === null) {
                proc.kill(signal);
              }
            });
          });
        }
        const exitCallback = this._exitCallback;
        proc.on("close", (code) => {
          code = code ?? 1;
          if (!exitCallback) {
            process2.exit(code);
          } else {
            exitCallback(
              new CommanderError2(
                code,
                "commander.executeSubCommandAsync",
                "(close)"
              )
            );
          }
        });
        proc.on("error", (err) => {
          if (err.code === "ENOENT") {
            this._checkForMissingExecutable(
              executableFile,
              executableDir,
              subcommand._name
            );
          } else if (err.code === "EACCES") {
            throw new Error(`'${executableFile}' not executable`);
          }
          if (!exitCallback) {
            process2.exit(1);
          } else {
            const wrappedError = new CommanderError2(
              1,
              "commander.executeSubCommandAsync",
              "(error)"
            );
            wrappedError.nestedError = err;
            exitCallback(wrappedError);
          }
        });
        this.runningCommand = proc;
      }
      /**
       * @private
       */
      _dispatchSubcommand(commandName, operands, unknown) {
        const subCommand = this._findCommand(commandName);
        if (!subCommand) this.help({ error: true });
        subCommand._prepareForParse();
        let promiseChain;
        promiseChain = this._chainOrCallSubCommandHook(
          promiseChain,
          subCommand,
          "preSubcommand"
        );
        promiseChain = this._chainOrCall(promiseChain, () => {
          if (subCommand._executableHandler) {
            this._executeSubCommand(subCommand, operands.concat(unknown));
          } else {
            return subCommand._parseCommand(operands, unknown);
          }
        });
        return promiseChain;
      }
      /**
       * Invoke help directly if possible, or dispatch if necessary.
       * e.g. help foo
       *
       * @private
       */
      _dispatchHelpCommand(subcommandName) {
        if (!subcommandName) {
          this.help();
        }
        const subCommand = this._findCommand(subcommandName);
        if (subCommand && !subCommand._executableHandler) {
          subCommand.help();
        }
        return this._dispatchSubcommand(
          subcommandName,
          [],
          [this._getHelpOption()?.long ?? this._getHelpOption()?.short ?? "--help"]
        );
      }
      /**
       * Check this.args against expected this.registeredArguments.
       *
       * @private
       */
      _checkNumberOfArguments() {
        this.registeredArguments.forEach((arg, i) => {
          if (arg.required && this.args[i] == null) {
            this.missingArgument(arg.name());
          }
        });
        if (this.registeredArguments.length > 0 && this.registeredArguments[this.registeredArguments.length - 1].variadic) {
          return;
        }
        if (this.args.length > this.registeredArguments.length) {
          this._excessArguments(this.args);
        }
      }
      /**
       * Process this.args using this.registeredArguments and save as this.processedArgs!
       *
       * @private
       */
      _processArguments() {
        const myParseArg = (argument, value, previous) => {
          let parsedValue = value;
          if (value !== null && argument.parseArg) {
            const invalidValueMessage = `error: command-argument value '${value}' is invalid for argument '${argument.name()}'.`;
            parsedValue = this._callParseArg(
              argument,
              value,
              previous,
              invalidValueMessage
            );
          }
          return parsedValue;
        };
        this._checkNumberOfArguments();
        const processedArgs = [];
        this.registeredArguments.forEach((declaredArg, index) => {
          let value = declaredArg.defaultValue;
          if (declaredArg.variadic) {
            if (index < this.args.length) {
              value = this.args.slice(index);
              if (declaredArg.parseArg) {
                value = value.reduce((processed, v) => {
                  return myParseArg(declaredArg, v, processed);
                }, declaredArg.defaultValue);
              }
            } else if (value === void 0) {
              value = [];
            }
          } else if (index < this.args.length) {
            value = this.args[index];
            if (declaredArg.parseArg) {
              value = myParseArg(declaredArg, value, declaredArg.defaultValue);
            }
          }
          processedArgs[index] = value;
        });
        this.processedArgs = processedArgs;
      }
      /**
       * Once we have a promise we chain, but call synchronously until then.
       *
       * @param {(Promise|undefined)} promise
       * @param {Function} fn
       * @return {(Promise|undefined)}
       * @private
       */
      _chainOrCall(promise, fn) {
        if (promise?.then && typeof promise.then === "function") {
          return promise.then(() => fn());
        }
        return fn();
      }
      /**
       *
       * @param {(Promise|undefined)} promise
       * @param {string} event
       * @return {(Promise|undefined)}
       * @private
       */
      _chainOrCallHooks(promise, event) {
        let result = promise;
        const hooks = [];
        this._getCommandAndAncestors().reverse().filter((cmd) => cmd._lifeCycleHooks[event] !== void 0).forEach((hookedCommand) => {
          hookedCommand._lifeCycleHooks[event].forEach((callback) => {
            hooks.push({ hookedCommand, callback });
          });
        });
        if (event === "postAction") {
          hooks.reverse();
        }
        hooks.forEach((hookDetail) => {
          result = this._chainOrCall(result, () => {
            return hookDetail.callback(hookDetail.hookedCommand, this);
          });
        });
        return result;
      }
      /**
       *
       * @param {(Promise|undefined)} promise
       * @param {Command} subCommand
       * @param {string} event
       * @return {(Promise|undefined)}
       * @private
       */
      _chainOrCallSubCommandHook(promise, subCommand, event) {
        let result = promise;
        if (this._lifeCycleHooks[event] !== void 0) {
          this._lifeCycleHooks[event].forEach((hook) => {
            result = this._chainOrCall(result, () => {
              return hook(this, subCommand);
            });
          });
        }
        return result;
      }
      /**
       * Process arguments in context of this command.
       * Returns action result, in case it is a promise.
       *
       * @private
       */
      _parseCommand(operands, unknown) {
        const parsed = this.parseOptions(unknown);
        this._parseOptionsEnv();
        this._parseOptionsImplied();
        operands = operands.concat(parsed.operands);
        unknown = parsed.unknown;
        this.args = operands.concat(unknown);
        if (operands && this._findCommand(operands[0])) {
          return this._dispatchSubcommand(operands[0], operands.slice(1), unknown);
        }
        if (this._getHelpCommand() && operands[0] === this._getHelpCommand().name()) {
          return this._dispatchHelpCommand(operands[1]);
        }
        if (this._defaultCommandName) {
          this._outputHelpIfRequested(unknown);
          return this._dispatchSubcommand(
            this._defaultCommandName,
            operands,
            unknown
          );
        }
        if (this.commands.length && this.args.length === 0 && !this._actionHandler && !this._defaultCommandName) {
          this.help({ error: true });
        }
        this._outputHelpIfRequested(parsed.unknown);
        this._checkForMissingMandatoryOptions();
        this._checkForConflictingOptions();
        const checkForUnknownOptions = () => {
          if (parsed.unknown.length > 0) {
            this.unknownOption(parsed.unknown[0]);
          }
        };
        const commandEvent = `command:${this.name()}`;
        if (this._actionHandler) {
          checkForUnknownOptions();
          this._processArguments();
          let promiseChain;
          promiseChain = this._chainOrCallHooks(promiseChain, "preAction");
          promiseChain = this._chainOrCall(
            promiseChain,
            () => this._actionHandler(this.processedArgs)
          );
          if (this.parent) {
            promiseChain = this._chainOrCall(promiseChain, () => {
              this.parent.emit(commandEvent, operands, unknown);
            });
          }
          promiseChain = this._chainOrCallHooks(promiseChain, "postAction");
          return promiseChain;
        }
        if (this.parent?.listenerCount(commandEvent)) {
          checkForUnknownOptions();
          this._processArguments();
          this.parent.emit(commandEvent, operands, unknown);
        } else if (operands.length) {
          if (this._findCommand("*")) {
            return this._dispatchSubcommand("*", operands, unknown);
          }
          if (this.listenerCount("command:*")) {
            this.emit("command:*", operands, unknown);
          } else if (this.commands.length) {
            this.unknownCommand();
          } else {
            checkForUnknownOptions();
            this._processArguments();
          }
        } else if (this.commands.length) {
          checkForUnknownOptions();
          this.help({ error: true });
        } else {
          checkForUnknownOptions();
          this._processArguments();
        }
      }
      /**
       * Find matching command.
       *
       * @private
       * @return {Command | undefined}
       */
      _findCommand(name) {
        if (!name) return void 0;
        return this.commands.find(
          (cmd) => cmd._name === name || cmd._aliases.includes(name)
        );
      }
      /**
       * Return an option matching `arg` if any.
       *
       * @param {string} arg
       * @return {Option}
       * @package
       */
      _findOption(arg) {
        return this.options.find((option) => option.is(arg));
      }
      /**
       * Display an error message if a mandatory option does not have a value.
       * Called after checking for help flags in leaf subcommand.
       *
       * @private
       */
      _checkForMissingMandatoryOptions() {
        this._getCommandAndAncestors().forEach((cmd) => {
          cmd.options.forEach((anOption) => {
            if (anOption.mandatory && cmd.getOptionValue(anOption.attributeName()) === void 0) {
              cmd.missingMandatoryOptionValue(anOption);
            }
          });
        });
      }
      /**
       * Display an error message if conflicting options are used together in this.
       *
       * @private
       */
      _checkForConflictingLocalOptions() {
        const definedNonDefaultOptions = this.options.filter((option) => {
          const optionKey = option.attributeName();
          if (this.getOptionValue(optionKey) === void 0) {
            return false;
          }
          return this.getOptionValueSource(optionKey) !== "default";
        });
        const optionsWithConflicting = definedNonDefaultOptions.filter(
          (option) => option.conflictsWith.length > 0
        );
        optionsWithConflicting.forEach((option) => {
          const conflictingAndDefined = definedNonDefaultOptions.find(
            (defined) => option.conflictsWith.includes(defined.attributeName())
          );
          if (conflictingAndDefined) {
            this._conflictingOption(option, conflictingAndDefined);
          }
        });
      }
      /**
       * Display an error message if conflicting options are used together.
       * Called after checking for help flags in leaf subcommand.
       *
       * @private
       */
      _checkForConflictingOptions() {
        this._getCommandAndAncestors().forEach((cmd) => {
          cmd._checkForConflictingLocalOptions();
        });
      }
      /**
       * Parse options from `argv` removing known options,
       * and return argv split into operands and unknown arguments.
       *
       * Side effects: modifies command by storing options. Does not reset state if called again.
       *
       * Examples:
       *
       *     argv => operands, unknown
       *     --known kkk op => [op], []
       *     op --known kkk => [op], []
       *     sub --unknown uuu op => [sub], [--unknown uuu op]
       *     sub -- --unknown uuu op => [sub --unknown uuu op], []
       *
       * @param {string[]} args
       * @return {{operands: string[], unknown: string[]}}
       */
      parseOptions(args) {
        const operands = [];
        const unknown = [];
        let dest = operands;
        function maybeOption(arg) {
          return arg.length > 1 && arg[0] === "-";
        }
        const negativeNumberArg = (arg) => {
          if (!/^-(\d+|\d*\.\d+)(e[+-]?\d+)?$/.test(arg)) return false;
          return !this._getCommandAndAncestors().some(
            (cmd) => cmd.options.map((opt) => opt.short).some((short) => /^-\d$/.test(short))
          );
        };
        let activeVariadicOption = null;
        let activeGroup = null;
        let i = 0;
        while (i < args.length || activeGroup) {
          const arg = activeGroup ?? args[i++];
          activeGroup = null;
          if (arg === "--") {
            if (dest === unknown) dest.push(arg);
            dest.push(...args.slice(i));
            break;
          }
          if (activeVariadicOption && (!maybeOption(arg) || negativeNumberArg(arg))) {
            this.emit(`option:${activeVariadicOption.name()}`, arg);
            continue;
          }
          activeVariadicOption = null;
          if (maybeOption(arg)) {
            const option = this._findOption(arg);
            if (option) {
              if (option.required) {
                const value = args[i++];
                if (value === void 0) this.optionMissingArgument(option);
                this.emit(`option:${option.name()}`, value);
              } else if (option.optional) {
                let value = null;
                if (i < args.length && (!maybeOption(args[i]) || negativeNumberArg(args[i]))) {
                  value = args[i++];
                }
                this.emit(`option:${option.name()}`, value);
              } else {
                this.emit(`option:${option.name()}`);
              }
              activeVariadicOption = option.variadic ? option : null;
              continue;
            }
          }
          if (arg.length > 2 && arg[0] === "-" && arg[1] !== "-") {
            const option = this._findOption(`-${arg[1]}`);
            if (option) {
              if (option.required || option.optional && this._combineFlagAndOptionalValue) {
                this.emit(`option:${option.name()}`, arg.slice(2));
              } else {
                this.emit(`option:${option.name()}`);
                activeGroup = `-${arg.slice(2)}`;
              }
              continue;
            }
          }
          if (/^--[^=]+=/.test(arg)) {
            const index = arg.indexOf("=");
            const option = this._findOption(arg.slice(0, index));
            if (option && (option.required || option.optional)) {
              this.emit(`option:${option.name()}`, arg.slice(index + 1));
              continue;
            }
          }
          if (dest === operands && maybeOption(arg) && !(this.commands.length === 0 && negativeNumberArg(arg))) {
            dest = unknown;
          }
          if ((this._enablePositionalOptions || this._passThroughOptions) && operands.length === 0 && unknown.length === 0) {
            if (this._findCommand(arg)) {
              operands.push(arg);
              unknown.push(...args.slice(i));
              break;
            } else if (this._getHelpCommand() && arg === this._getHelpCommand().name()) {
              operands.push(arg, ...args.slice(i));
              break;
            } else if (this._defaultCommandName) {
              unknown.push(arg, ...args.slice(i));
              break;
            }
          }
          if (this._passThroughOptions) {
            dest.push(arg, ...args.slice(i));
            break;
          }
          dest.push(arg);
        }
        return { operands, unknown };
      }
      /**
       * Return an object containing local option values as key-value pairs.
       *
       * @return {object}
       */
      opts() {
        if (this._storeOptionsAsProperties) {
          const result = {};
          const len = this.options.length;
          for (let i = 0; i < len; i++) {
            const key = this.options[i].attributeName();
            result[key] = key === this._versionOptionName ? this._version : this[key];
          }
          return result;
        }
        return this._optionValues;
      }
      /**
       * Return an object containing merged local and global option values as key-value pairs.
       *
       * @return {object}
       */
      optsWithGlobals() {
        return this._getCommandAndAncestors().reduce(
          (combinedOptions, cmd) => Object.assign(combinedOptions, cmd.opts()),
          {}
        );
      }
      /**
       * Display error message and exit (or call exitOverride).
       *
       * @param {string} message
       * @param {object} [errorOptions]
       * @param {string} [errorOptions.code] - an id string representing the error
       * @param {number} [errorOptions.exitCode] - used with process.exit
       */
      error(message, errorOptions) {
        this._outputConfiguration.outputError(
          `${message}
`,
          this._outputConfiguration.writeErr
        );
        if (typeof this._showHelpAfterError === "string") {
          this._outputConfiguration.writeErr(`${this._showHelpAfterError}
`);
        } else if (this._showHelpAfterError) {
          this._outputConfiguration.writeErr("\n");
          this.outputHelp({ error: true });
        }
        const config = errorOptions || {};
        const exitCode = config.exitCode || 1;
        const code = config.code || "commander.error";
        this._exit(exitCode, code, message);
      }
      /**
       * Apply any option related environment variables, if option does
       * not have a value from cli or client code.
       *
       * @private
       */
      _parseOptionsEnv() {
        this.options.forEach((option) => {
          if (option.envVar && option.envVar in process2.env) {
            const optionKey = option.attributeName();
            if (this.getOptionValue(optionKey) === void 0 || ["default", "config", "env"].includes(
              this.getOptionValueSource(optionKey)
            )) {
              if (option.required || option.optional) {
                this.emit(`optionEnv:${option.name()}`, process2.env[option.envVar]);
              } else {
                this.emit(`optionEnv:${option.name()}`);
              }
            }
          }
        });
      }
      /**
       * Apply any implied option values, if option is undefined or default value.
       *
       * @private
       */
      _parseOptionsImplied() {
        const dualHelper = new DualOptions(this.options);
        const hasCustomOptionValue = (optionKey) => {
          return this.getOptionValue(optionKey) !== void 0 && !["default", "implied"].includes(this.getOptionValueSource(optionKey));
        };
        this.options.filter(
          (option) => option.implied !== void 0 && hasCustomOptionValue(option.attributeName()) && dualHelper.valueFromOption(
            this.getOptionValue(option.attributeName()),
            option
          )
        ).forEach((option) => {
          Object.keys(option.implied).filter((impliedKey) => !hasCustomOptionValue(impliedKey)).forEach((impliedKey) => {
            this.setOptionValueWithSource(
              impliedKey,
              option.implied[impliedKey],
              "implied"
            );
          });
        });
      }
      /**
       * Argument `name` is missing.
       *
       * @param {string} name
       * @private
       */
      missingArgument(name) {
        const message = `error: missing required argument '${name}'`;
        this.error(message, { code: "commander.missingArgument" });
      }
      /**
       * `Option` is missing an argument.
       *
       * @param {Option} option
       * @private
       */
      optionMissingArgument(option) {
        const message = `error: option '${option.flags}' argument missing`;
        this.error(message, { code: "commander.optionMissingArgument" });
      }
      /**
       * `Option` does not have a value, and is a mandatory option.
       *
       * @param {Option} option
       * @private
       */
      missingMandatoryOptionValue(option) {
        const message = `error: required option '${option.flags}' not specified`;
        this.error(message, { code: "commander.missingMandatoryOptionValue" });
      }
      /**
       * `Option` conflicts with another option.
       *
       * @param {Option} option
       * @param {Option} conflictingOption
       * @private
       */
      _conflictingOption(option, conflictingOption) {
        const findBestOptionFromValue = (option2) => {
          const optionKey = option2.attributeName();
          const optionValue = this.getOptionValue(optionKey);
          const negativeOption = this.options.find(
            (target) => target.negate && optionKey === target.attributeName()
          );
          const positiveOption = this.options.find(
            (target) => !target.negate && optionKey === target.attributeName()
          );
          if (negativeOption && (negativeOption.presetArg === void 0 && optionValue === false || negativeOption.presetArg !== void 0 && optionValue === negativeOption.presetArg)) {
            return negativeOption;
          }
          return positiveOption || option2;
        };
        const getErrorMessage = (option2) => {
          const bestOption = findBestOptionFromValue(option2);
          const optionKey = bestOption.attributeName();
          const source = this.getOptionValueSource(optionKey);
          if (source === "env") {
            return `environment variable '${bestOption.envVar}'`;
          }
          return `option '${bestOption.flags}'`;
        };
        const message = `error: ${getErrorMessage(option)} cannot be used with ${getErrorMessage(conflictingOption)}`;
        this.error(message, { code: "commander.conflictingOption" });
      }
      /**
       * Unknown option `flag`.
       *
       * @param {string} flag
       * @private
       */
      unknownOption(flag) {
        if (this._allowUnknownOption) return;
        let suggestion = "";
        if (flag.startsWith("--") && this._showSuggestionAfterError) {
          let candidateFlags = [];
          let command = this;
          do {
            const moreFlags = command.createHelp().visibleOptions(command).filter((option) => option.long).map((option) => option.long);
            candidateFlags = candidateFlags.concat(moreFlags);
            command = command.parent;
          } while (command && !command._enablePositionalOptions);
          suggestion = suggestSimilar(flag, candidateFlags);
        }
        const message = `error: unknown option '${flag}'${suggestion}`;
        this.error(message, { code: "commander.unknownOption" });
      }
      /**
       * Excess arguments, more than expected.
       *
       * @param {string[]} receivedArgs
       * @private
       */
      _excessArguments(receivedArgs) {
        if (this._allowExcessArguments) return;
        const expected = this.registeredArguments.length;
        const s = expected === 1 ? "" : "s";
        const forSubcommand = this.parent ? ` for '${this.name()}'` : "";
        const message = `error: too many arguments${forSubcommand}. Expected ${expected} argument${s} but got ${receivedArgs.length}.`;
        this.error(message, { code: "commander.excessArguments" });
      }
      /**
       * Unknown command.
       *
       * @private
       */
      unknownCommand() {
        const unknownName = this.args[0];
        let suggestion = "";
        if (this._showSuggestionAfterError) {
          const candidateNames = [];
          this.createHelp().visibleCommands(this).forEach((command) => {
            candidateNames.push(command.name());
            if (command.alias()) candidateNames.push(command.alias());
          });
          suggestion = suggestSimilar(unknownName, candidateNames);
        }
        const message = `error: unknown command '${unknownName}'${suggestion}`;
        this.error(message, { code: "commander.unknownCommand" });
      }
      /**
       * Get or set the program version.
       *
       * This method auto-registers the "-V, --version" option which will print the version number.
       *
       * You can optionally supply the flags and description to override the defaults.
       *
       * @param {string} [str]
       * @param {string} [flags]
       * @param {string} [description]
       * @return {(this | string | undefined)} `this` command for chaining, or version string if no arguments
       */
      version(str, flags, description) {
        if (str === void 0) return this._version;
        this._version = str;
        flags = flags || "-V, --version";
        description = description || "output the version number";
        const versionOption = this.createOption(flags, description);
        this._versionOptionName = versionOption.attributeName();
        this._registerOption(versionOption);
        this.on("option:" + versionOption.name(), () => {
          this._outputConfiguration.writeOut(`${str}
`);
          this._exit(0, "commander.version", str);
        });
        return this;
      }
      /**
       * Set the description.
       *
       * @param {string} [str]
       * @param {object} [argsDescription]
       * @return {(string|Command)}
       */
      description(str, argsDescription) {
        if (str === void 0 && argsDescription === void 0)
          return this._description;
        this._description = str;
        if (argsDescription) {
          this._argsDescription = argsDescription;
        }
        return this;
      }
      /**
       * Set the summary. Used when listed as subcommand of parent.
       *
       * @param {string} [str]
       * @return {(string|Command)}
       */
      summary(str) {
        if (str === void 0) return this._summary;
        this._summary = str;
        return this;
      }
      /**
       * Set an alias for the command.
       *
       * You may call more than once to add multiple aliases. Only the first alias is shown in the auto-generated help.
       *
       * @param {string} [alias]
       * @return {(string|Command)}
       */
      alias(alias) {
        if (alias === void 0) return this._aliases[0];
        let command = this;
        if (this.commands.length !== 0 && this.commands[this.commands.length - 1]._executableHandler) {
          command = this.commands[this.commands.length - 1];
        }
        if (alias === command._name)
          throw new Error("Command alias can't be the same as its name");
        const matchingCommand = this.parent?._findCommand(alias);
        if (matchingCommand) {
          const existingCmd = [matchingCommand.name()].concat(matchingCommand.aliases()).join("|");
          throw new Error(
            `cannot add alias '${alias}' to command '${this.name()}' as already have command '${existingCmd}'`
          );
        }
        command._aliases.push(alias);
        return this;
      }
      /**
       * Set aliases for the command.
       *
       * Only the first alias is shown in the auto-generated help.
       *
       * @param {string[]} [aliases]
       * @return {(string[]|Command)}
       */
      aliases(aliases) {
        if (aliases === void 0) return this._aliases;
        aliases.forEach((alias) => this.alias(alias));
        return this;
      }
      /**
       * Set / get the command usage `str`.
       *
       * @param {string} [str]
       * @return {(string|Command)}
       */
      usage(str) {
        if (str === void 0) {
          if (this._usage) return this._usage;
          const args = this.registeredArguments.map((arg) => {
            return humanReadableArgName(arg);
          });
          return [].concat(
            this.options.length || this._helpOption !== null ? "[options]" : [],
            this.commands.length ? "[command]" : [],
            this.registeredArguments.length ? args : []
          ).join(" ");
        }
        this._usage = str;
        return this;
      }
      /**
       * Get or set the name of the command.
       *
       * @param {string} [str]
       * @return {(string|Command)}
       */
      name(str) {
        if (str === void 0) return this._name;
        this._name = str;
        return this;
      }
      /**
       * Set/get the help group heading for this subcommand in parent command's help.
       *
       * @param {string} [heading]
       * @return {Command | string}
       */
      helpGroup(heading) {
        if (heading === void 0) return this._helpGroupHeading ?? "";
        this._helpGroupHeading = heading;
        return this;
      }
      /**
       * Set/get the default help group heading for subcommands added to this command.
       * (This does not override a group set directly on the subcommand using .helpGroup().)
       *
       * @example
       * program.commandsGroup('Development Commands:);
       * program.command('watch')...
       * program.command('lint')...
       * ...
       *
       * @param {string} [heading]
       * @returns {Command | string}
       */
      commandsGroup(heading) {
        if (heading === void 0) return this._defaultCommandGroup ?? "";
        this._defaultCommandGroup = heading;
        return this;
      }
      /**
       * Set/get the default help group heading for options added to this command.
       * (This does not override a group set directly on the option using .helpGroup().)
       *
       * @example
       * program
       *   .optionsGroup('Development Options:')
       *   .option('-d, --debug', 'output extra debugging')
       *   .option('-p, --profile', 'output profiling information')
       *
       * @param {string} [heading]
       * @returns {Command | string}
       */
      optionsGroup(heading) {
        if (heading === void 0) return this._defaultOptionGroup ?? "";
        this._defaultOptionGroup = heading;
        return this;
      }
      /**
       * @param {Option} option
       * @private
       */
      _initOptionGroup(option) {
        if (this._defaultOptionGroup && !option.helpGroupHeading)
          option.helpGroup(this._defaultOptionGroup);
      }
      /**
       * @param {Command} cmd
       * @private
       */
      _initCommandGroup(cmd) {
        if (this._defaultCommandGroup && !cmd.helpGroup())
          cmd.helpGroup(this._defaultCommandGroup);
      }
      /**
       * Set the name of the command from script filename, such as process.argv[1],
       * or require.main.filename, or __filename.
       *
       * (Used internally and public although not documented in README.)
       *
       * @example
       * program.nameFromFilename(require.main.filename);
       *
       * @param {string} filename
       * @return {Command}
       */
      nameFromFilename(filename) {
        this._name = path.basename(filename, path.extname(filename));
        return this;
      }
      /**
       * Get or set the directory for searching for executable subcommands of this command.
       *
       * @example
       * program.executableDir(__dirname);
       * // or
       * program.executableDir('subcommands');
       *
       * @param {string} [path]
       * @return {(string|null|Command)}
       */
      executableDir(path2) {
        if (path2 === void 0) return this._executableDir;
        this._executableDir = path2;
        return this;
      }
      /**
       * Return program help documentation.
       *
       * @param {{ error: boolean }} [contextOptions] - pass {error:true} to wrap for stderr instead of stdout
       * @return {string}
       */
      helpInformation(contextOptions) {
        const helper = this.createHelp();
        const context = this._getOutputContext(contextOptions);
        helper.prepareContext({
          error: context.error,
          helpWidth: context.helpWidth,
          outputHasColors: context.hasColors
        });
        const text = helper.formatHelp(this, helper);
        if (context.hasColors) return text;
        return this._outputConfiguration.stripColor(text);
      }
      /**
       * @typedef HelpContext
       * @type {object}
       * @property {boolean} error
       * @property {number} helpWidth
       * @property {boolean} hasColors
       * @property {function} write - includes stripColor if needed
       *
       * @returns {HelpContext}
       * @private
       */
      _getOutputContext(contextOptions) {
        contextOptions = contextOptions || {};
        const error = !!contextOptions.error;
        let baseWrite;
        let hasColors;
        let helpWidth;
        if (error) {
          baseWrite = (str) => this._outputConfiguration.writeErr(str);
          hasColors = this._outputConfiguration.getErrHasColors();
          helpWidth = this._outputConfiguration.getErrHelpWidth();
        } else {
          baseWrite = (str) => this._outputConfiguration.writeOut(str);
          hasColors = this._outputConfiguration.getOutHasColors();
          helpWidth = this._outputConfiguration.getOutHelpWidth();
        }
        const write = (str) => {
          if (!hasColors) str = this._outputConfiguration.stripColor(str);
          return baseWrite(str);
        };
        return { error, write, hasColors, helpWidth };
      }
      /**
       * Output help information for this command.
       *
       * Outputs built-in help, and custom text added using `.addHelpText()`.
       *
       * @param {{ error: boolean } | Function} [contextOptions] - pass {error:true} to write to stderr instead of stdout
       */
      outputHelp(contextOptions) {
        let deprecatedCallback;
        if (typeof contextOptions === "function") {
          deprecatedCallback = contextOptions;
          contextOptions = void 0;
        }
        const outputContext = this._getOutputContext(contextOptions);
        const eventContext = {
          error: outputContext.error,
          write: outputContext.write,
          command: this
        };
        this._getCommandAndAncestors().reverse().forEach((command) => command.emit("beforeAllHelp", eventContext));
        this.emit("beforeHelp", eventContext);
        let helpInformation = this.helpInformation({ error: outputContext.error });
        if (deprecatedCallback) {
          helpInformation = deprecatedCallback(helpInformation);
          if (typeof helpInformation !== "string" && !Buffer.isBuffer(helpInformation)) {
            throw new Error("outputHelp callback must return a string or a Buffer");
          }
        }
        outputContext.write(helpInformation);
        if (this._getHelpOption()?.long) {
          this.emit(this._getHelpOption().long);
        }
        this.emit("afterHelp", eventContext);
        this._getCommandAndAncestors().forEach(
          (command) => command.emit("afterAllHelp", eventContext)
        );
      }
      /**
       * You can pass in flags and a description to customise the built-in help option.
       * Pass in false to disable the built-in help option.
       *
       * @example
       * program.helpOption('-?, --help' 'show help'); // customise
       * program.helpOption(false); // disable
       *
       * @param {(string | boolean)} flags
       * @param {string} [description]
       * @return {Command} `this` command for chaining
       */
      helpOption(flags, description) {
        if (typeof flags === "boolean") {
          if (flags) {
            if (this._helpOption === null) this._helpOption = void 0;
            if (this._defaultOptionGroup) {
              this._initOptionGroup(this._getHelpOption());
            }
          } else {
            this._helpOption = null;
          }
          return this;
        }
        this._helpOption = this.createOption(
          flags ?? "-h, --help",
          description ?? "display help for command"
        );
        if (flags || description) this._initOptionGroup(this._helpOption);
        return this;
      }
      /**
       * Lazy create help option.
       * Returns null if has been disabled with .helpOption(false).
       *
       * @returns {(Option | null)} the help option
       * @package
       */
      _getHelpOption() {
        if (this._helpOption === void 0) {
          this.helpOption(void 0, void 0);
        }
        return this._helpOption;
      }
      /**
       * Supply your own option to use for the built-in help option.
       * This is an alternative to using helpOption() to customise the flags and description etc.
       *
       * @param {Option} option
       * @return {Command} `this` command for chaining
       */
      addHelpOption(option) {
        this._helpOption = option;
        this._initOptionGroup(option);
        return this;
      }
      /**
       * Output help information and exit.
       *
       * Outputs built-in help, and custom text added using `.addHelpText()`.
       *
       * @param {{ error: boolean }} [contextOptions] - pass {error:true} to write to stderr instead of stdout
       */
      help(contextOptions) {
        this.outputHelp(contextOptions);
        let exitCode = Number(process2.exitCode ?? 0);
        if (exitCode === 0 && contextOptions && typeof contextOptions !== "function" && contextOptions.error) {
          exitCode = 1;
        }
        this._exit(exitCode, "commander.help", "(outputHelp)");
      }
      /**
       * // Do a little typing to coordinate emit and listener for the help text events.
       * @typedef HelpTextEventContext
       * @type {object}
       * @property {boolean} error
       * @property {Command} command
       * @property {function} write
       */
      /**
       * Add additional text to be displayed with the built-in help.
       *
       * Position is 'before' or 'after' to affect just this command,
       * and 'beforeAll' or 'afterAll' to affect this command and all its subcommands.
       *
       * @param {string} position - before or after built-in help
       * @param {(string | Function)} text - string to add, or a function returning a string
       * @return {Command} `this` command for chaining
       */
      addHelpText(position, text) {
        const allowedValues = ["beforeAll", "before", "after", "afterAll"];
        if (!allowedValues.includes(position)) {
          throw new Error(`Unexpected value for position to addHelpText.
Expecting one of '${allowedValues.join("', '")}'`);
        }
        const helpEvent = `${position}Help`;
        this.on(helpEvent, (context) => {
          let helpStr;
          if (typeof text === "function") {
            helpStr = text({ error: context.error, command: context.command });
          } else {
            helpStr = text;
          }
          if (helpStr) {
            context.write(`${helpStr}
`);
          }
        });
        return this;
      }
      /**
       * Output help information if help flags specified
       *
       * @param {Array} args - array of options to search for help flags
       * @private
       */
      _outputHelpIfRequested(args) {
        const helpOption = this._getHelpOption();
        const helpRequested = helpOption && args.find((arg) => helpOption.is(arg));
        if (helpRequested) {
          this.outputHelp();
          this._exit(0, "commander.helpDisplayed", "(outputHelp)");
        }
      }
    };
    function incrementNodeInspectorPort(args) {
      return args.map((arg) => {
        if (!arg.startsWith("--inspect")) {
          return arg;
        }
        let debugOption;
        let debugHost = "127.0.0.1";
        let debugPort = "9229";
        let match;
        if ((match = arg.match(/^(--inspect(-brk)?)$/)) !== null) {
          debugOption = match[1];
        } else if ((match = arg.match(/^(--inspect(-brk|-port)?)=([^:]+)$/)) !== null) {
          debugOption = match[1];
          if (/^\d+$/.test(match[3])) {
            debugPort = match[3];
          } else {
            debugHost = match[3];
          }
        } else if ((match = arg.match(/^(--inspect(-brk|-port)?)=([^:]+):(\d+)$/)) !== null) {
          debugOption = match[1];
          debugHost = match[3];
          debugPort = match[4];
        }
        if (debugOption && debugPort !== "0") {
          return `${debugOption}=${debugHost}:${parseInt(debugPort) + 1}`;
        }
        return arg;
      });
    }
    function useColor() {
      if (process2.env.NO_COLOR || process2.env.FORCE_COLOR === "0" || process2.env.FORCE_COLOR === "false")
        return false;
      if (process2.env.FORCE_COLOR || process2.env.CLICOLOR_FORCE !== void 0)
        return true;
      return void 0;
    }
    exports.Command = Command2;
    exports.useColor = useColor;
  }
});

// ../../node_modules/commander/index.js
var require_commander = __commonJS({
  "../../node_modules/commander/index.js"(exports) {
    "use strict";
    var { Argument: Argument2 } = require_argument();
    var { Command: Command2 } = require_command();
    var { CommanderError: CommanderError2, InvalidArgumentError: InvalidArgumentError2 } = require_error();
    var { Help: Help2 } = require_help();
    var { Option: Option2 } = require_option();
    exports.program = new Command2();
    exports.createCommand = (name) => new Command2(name);
    exports.createOption = (flags, description) => new Option2(flags, description);
    exports.createArgument = (name, description) => new Argument2(name, description);
    exports.Command = Command2;
    exports.Option = Option2;
    exports.Argument = Argument2;
    exports.Help = Help2;
    exports.CommanderError = CommanderError2;
    exports.InvalidArgumentError = InvalidArgumentError2;
    exports.InvalidOptionArgumentError = InvalidArgumentError2;
  }
});

// ../../node_modules/yaml/dist/nodes/identity.js
var require_identity = __commonJS({
  "../../node_modules/yaml/dist/nodes/identity.js"(exports) {
    "use strict";
    var ALIAS = /* @__PURE__ */ Symbol.for("yaml.alias");
    var DOC = /* @__PURE__ */ Symbol.for("yaml.document");
    var MAP = /* @__PURE__ */ Symbol.for("yaml.map");
    var PAIR = /* @__PURE__ */ Symbol.for("yaml.pair");
    var SCALAR = /* @__PURE__ */ Symbol.for("yaml.scalar");
    var SEQ = /* @__PURE__ */ Symbol.for("yaml.seq");
    var NODE_TYPE = /* @__PURE__ */ Symbol.for("yaml.node.type");
    var isAlias = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === ALIAS;
    var isDocument = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === DOC;
    var isMap = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === MAP;
    var isPair = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === PAIR;
    var isScalar = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === SCALAR;
    var isSeq = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === SEQ;
    function isCollection(node) {
      if (node && typeof node === "object")
        switch (node[NODE_TYPE]) {
          case MAP:
          case SEQ:
            return true;
        }
      return false;
    }
    function isNode(node) {
      if (node && typeof node === "object")
        switch (node[NODE_TYPE]) {
          case ALIAS:
          case MAP:
          case SCALAR:
          case SEQ:
            return true;
        }
      return false;
    }
    var hasAnchor = (node) => (isScalar(node) || isCollection(node)) && !!node.anchor;
    exports.ALIAS = ALIAS;
    exports.DOC = DOC;
    exports.MAP = MAP;
    exports.NODE_TYPE = NODE_TYPE;
    exports.PAIR = PAIR;
    exports.SCALAR = SCALAR;
    exports.SEQ = SEQ;
    exports.hasAnchor = hasAnchor;
    exports.isAlias = isAlias;
    exports.isCollection = isCollection;
    exports.isDocument = isDocument;
    exports.isMap = isMap;
    exports.isNode = isNode;
    exports.isPair = isPair;
    exports.isScalar = isScalar;
    exports.isSeq = isSeq;
  }
});

// ../../node_modules/yaml/dist/visit.js
var require_visit = __commonJS({
  "../../node_modules/yaml/dist/visit.js"(exports) {
    "use strict";
    var identity = require_identity();
    var BREAK = /* @__PURE__ */ Symbol("break visit");
    var SKIP = /* @__PURE__ */ Symbol("skip children");
    var REMOVE = /* @__PURE__ */ Symbol("remove node");
    function visit(node, visitor) {
      const visitor_ = initVisitor(visitor);
      if (identity.isDocument(node)) {
        const cd = visit_(null, node.contents, visitor_, Object.freeze([node]));
        if (cd === REMOVE)
          node.contents = null;
      } else
        visit_(null, node, visitor_, Object.freeze([]));
    }
    visit.BREAK = BREAK;
    visit.SKIP = SKIP;
    visit.REMOVE = REMOVE;
    function visit_(key, node, visitor, path) {
      const ctrl = callVisitor(key, node, visitor, path);
      if (identity.isNode(ctrl) || identity.isPair(ctrl)) {
        replaceNode(key, path, ctrl);
        return visit_(key, ctrl, visitor, path);
      }
      if (typeof ctrl !== "symbol") {
        if (identity.isCollection(node)) {
          path = Object.freeze(path.concat(node));
          for (let i = 0; i < node.items.length; ++i) {
            const ci = visit_(i, node.items[i], visitor, path);
            if (typeof ci === "number")
              i = ci - 1;
            else if (ci === BREAK)
              return BREAK;
            else if (ci === REMOVE) {
              node.items.splice(i, 1);
              i -= 1;
            }
          }
        } else if (identity.isPair(node)) {
          path = Object.freeze(path.concat(node));
          const ck = visit_("key", node.key, visitor, path);
          if (ck === BREAK)
            return BREAK;
          else if (ck === REMOVE)
            node.key = null;
          const cv = visit_("value", node.value, visitor, path);
          if (cv === BREAK)
            return BREAK;
          else if (cv === REMOVE)
            node.value = null;
        }
      }
      return ctrl;
    }
    async function visitAsync(node, visitor) {
      const visitor_ = initVisitor(visitor);
      if (identity.isDocument(node)) {
        const cd = await visitAsync_(null, node.contents, visitor_, Object.freeze([node]));
        if (cd === REMOVE)
          node.contents = null;
      } else
        await visitAsync_(null, node, visitor_, Object.freeze([]));
    }
    visitAsync.BREAK = BREAK;
    visitAsync.SKIP = SKIP;
    visitAsync.REMOVE = REMOVE;
    async function visitAsync_(key, node, visitor, path) {
      const ctrl = await callVisitor(key, node, visitor, path);
      if (identity.isNode(ctrl) || identity.isPair(ctrl)) {
        replaceNode(key, path, ctrl);
        return visitAsync_(key, ctrl, visitor, path);
      }
      if (typeof ctrl !== "symbol") {
        if (identity.isCollection(node)) {
          path = Object.freeze(path.concat(node));
          for (let i = 0; i < node.items.length; ++i) {
            const ci = await visitAsync_(i, node.items[i], visitor, path);
            if (typeof ci === "number")
              i = ci - 1;
            else if (ci === BREAK)
              return BREAK;
            else if (ci === REMOVE) {
              node.items.splice(i, 1);
              i -= 1;
            }
          }
        } else if (identity.isPair(node)) {
          path = Object.freeze(path.concat(node));
          const ck = await visitAsync_("key", node.key, visitor, path);
          if (ck === BREAK)
            return BREAK;
          else if (ck === REMOVE)
            node.key = null;
          const cv = await visitAsync_("value", node.value, visitor, path);
          if (cv === BREAK)
            return BREAK;
          else if (cv === REMOVE)
            node.value = null;
        }
      }
      return ctrl;
    }
    function initVisitor(visitor) {
      if (typeof visitor === "object" && (visitor.Collection || visitor.Node || visitor.Value)) {
        return Object.assign({
          Alias: visitor.Node,
          Map: visitor.Node,
          Scalar: visitor.Node,
          Seq: visitor.Node
        }, visitor.Value && {
          Map: visitor.Value,
          Scalar: visitor.Value,
          Seq: visitor.Value
        }, visitor.Collection && {
          Map: visitor.Collection,
          Seq: visitor.Collection
        }, visitor);
      }
      return visitor;
    }
    function callVisitor(key, node, visitor, path) {
      if (typeof visitor === "function")
        return visitor(key, node, path);
      if (identity.isMap(node))
        return visitor.Map?.(key, node, path);
      if (identity.isSeq(node))
        return visitor.Seq?.(key, node, path);
      if (identity.isPair(node))
        return visitor.Pair?.(key, node, path);
      if (identity.isScalar(node))
        return visitor.Scalar?.(key, node, path);
      if (identity.isAlias(node))
        return visitor.Alias?.(key, node, path);
      return void 0;
    }
    function replaceNode(key, path, node) {
      const parent = path[path.length - 1];
      if (identity.isCollection(parent)) {
        parent.items[key] = node;
      } else if (identity.isPair(parent)) {
        if (key === "key")
          parent.key = node;
        else
          parent.value = node;
      } else if (identity.isDocument(parent)) {
        parent.contents = node;
      } else {
        const pt = identity.isAlias(parent) ? "alias" : "scalar";
        throw new Error(`Cannot replace node with ${pt} parent`);
      }
    }
    exports.visit = visit;
    exports.visitAsync = visitAsync;
  }
});

// ../../node_modules/yaml/dist/doc/directives.js
var require_directives = __commonJS({
  "../../node_modules/yaml/dist/doc/directives.js"(exports) {
    "use strict";
    var identity = require_identity();
    var visit = require_visit();
    var escapeChars = {
      "!": "%21",
      ",": "%2C",
      "[": "%5B",
      "]": "%5D",
      "{": "%7B",
      "}": "%7D"
    };
    var escapeTagName = (tn) => tn.replace(/[!,[\]{}]/g, (ch) => escapeChars[ch]);
    var Directives = class _Directives {
      constructor(yaml, tags) {
        this.docStart = null;
        this.docEnd = false;
        this.yaml = Object.assign({}, _Directives.defaultYaml, yaml);
        this.tags = Object.assign({}, _Directives.defaultTags, tags);
      }
      clone() {
        const copy = new _Directives(this.yaml, this.tags);
        copy.docStart = this.docStart;
        return copy;
      }
      /**
       * During parsing, get a Directives instance for the current document and
       * update the stream state according to the current version's spec.
       */
      atDocument() {
        const res = new _Directives(this.yaml, this.tags);
        switch (this.yaml.version) {
          case "1.1":
            this.atNextDocument = true;
            break;
          case "1.2":
            this.atNextDocument = false;
            this.yaml = {
              explicit: _Directives.defaultYaml.explicit,
              version: "1.2"
            };
            this.tags = Object.assign({}, _Directives.defaultTags);
            break;
        }
        return res;
      }
      /**
       * @param onError - May be called even if the action was successful
       * @returns `true` on success
       */
      add(line, onError) {
        if (this.atNextDocument) {
          this.yaml = { explicit: _Directives.defaultYaml.explicit, version: "1.1" };
          this.tags = Object.assign({}, _Directives.defaultTags);
          this.atNextDocument = false;
        }
        const parts = line.trim().split(/[ \t]+/);
        const name = parts.shift();
        switch (name) {
          case "%TAG": {
            if (parts.length !== 2) {
              onError(0, "%TAG directive should contain exactly two parts");
              if (parts.length < 2)
                return false;
            }
            const [handle, prefix] = parts;
            this.tags[handle] = prefix;
            return true;
          }
          case "%YAML": {
            this.yaml.explicit = true;
            if (parts.length !== 1) {
              onError(0, "%YAML directive should contain exactly one part");
              return false;
            }
            const [version] = parts;
            if (version === "1.1" || version === "1.2") {
              this.yaml.version = version;
              return true;
            } else {
              const isValid2 = /^\d+\.\d+$/.test(version);
              onError(6, `Unsupported YAML version ${version}`, isValid2);
              return false;
            }
          }
          default:
            onError(0, `Unknown directive ${name}`, true);
            return false;
        }
      }
      /**
       * Resolves a tag, matching handles to those defined in %TAG directives.
       *
       * @returns Resolved tag, which may also be the non-specific tag `'!'` or a
       *   `'!local'` tag, or `null` if unresolvable.
       */
      tagName(source, onError) {
        if (source === "!")
          return "!";
        if (source[0] !== "!") {
          onError(`Not a valid tag: ${source}`);
          return null;
        }
        if (source[1] === "<") {
          const verbatim = source.slice(2, -1);
          if (verbatim === "!" || verbatim === "!!") {
            onError(`Verbatim tags aren't resolved, so ${source} is invalid.`);
            return null;
          }
          if (source[source.length - 1] !== ">")
            onError("Verbatim tags must end with a >");
          return verbatim;
        }
        const [, handle, suffix] = source.match(/^(.*!)([^!]*)$/s);
        if (!suffix)
          onError(`The ${source} tag has no suffix`);
        const prefix = this.tags[handle];
        if (prefix) {
          try {
            return prefix + decodeURIComponent(suffix);
          } catch (error) {
            onError(String(error));
            return null;
          }
        }
        if (handle === "!")
          return source;
        onError(`Could not resolve tag: ${source}`);
        return null;
      }
      /**
       * Given a fully resolved tag, returns its printable string form,
       * taking into account current tag prefixes and defaults.
       */
      tagString(tag) {
        for (const [handle, prefix] of Object.entries(this.tags)) {
          if (tag.startsWith(prefix))
            return handle + escapeTagName(tag.substring(prefix.length));
        }
        return tag[0] === "!" ? tag : `!<${tag}>`;
      }
      toString(doc) {
        const lines = this.yaml.explicit ? [`%YAML ${this.yaml.version || "1.2"}`] : [];
        const tagEntries = Object.entries(this.tags);
        let tagNames;
        if (doc && tagEntries.length > 0 && identity.isNode(doc.contents)) {
          const tags = {};
          visit.visit(doc.contents, (_key, node) => {
            if (identity.isNode(node) && node.tag)
              tags[node.tag] = true;
          });
          tagNames = Object.keys(tags);
        } else
          tagNames = [];
        for (const [handle, prefix] of tagEntries) {
          if (handle === "!!" && prefix === "tag:yaml.org,2002:")
            continue;
          if (!doc || tagNames.some((tn) => tn.startsWith(prefix)))
            lines.push(`%TAG ${handle} ${prefix}`);
        }
        return lines.join("\n");
      }
    };
    Directives.defaultYaml = { explicit: false, version: "1.2" };
    Directives.defaultTags = { "!!": "tag:yaml.org,2002:" };
    exports.Directives = Directives;
  }
});

// ../../node_modules/yaml/dist/doc/anchors.js
var require_anchors = __commonJS({
  "../../node_modules/yaml/dist/doc/anchors.js"(exports) {
    "use strict";
    var identity = require_identity();
    var visit = require_visit();
    function anchorIsValid(anchor) {
      if (/[\x00-\x19\s,[\]{}]/.test(anchor)) {
        const sa = JSON.stringify(anchor);
        const msg = `Anchor must not contain whitespace or control characters: ${sa}`;
        throw new Error(msg);
      }
      return true;
    }
    function anchorNames(root) {
      const anchors = /* @__PURE__ */ new Set();
      visit.visit(root, {
        Value(_key, node) {
          if (node.anchor)
            anchors.add(node.anchor);
        }
      });
      return anchors;
    }
    function findNewAnchor(prefix, exclude) {
      for (let i = 1; true; ++i) {
        const name = `${prefix}${i}`;
        if (!exclude.has(name))
          return name;
      }
    }
    function createNodeAnchors(doc, prefix) {
      const aliasObjects = [];
      const sourceObjects = /* @__PURE__ */ new Map();
      let prevAnchors = null;
      return {
        onAnchor: (source) => {
          aliasObjects.push(source);
          prevAnchors ?? (prevAnchors = anchorNames(doc));
          const anchor = findNewAnchor(prefix, prevAnchors);
          prevAnchors.add(anchor);
          return anchor;
        },
        /**
         * With circular references, the source node is only resolved after all
         * of its child nodes are. This is why anchors are set only after all of
         * the nodes have been created.
         */
        setAnchors: () => {
          for (const source of aliasObjects) {
            const ref = sourceObjects.get(source);
            if (typeof ref === "object" && ref.anchor && (identity.isScalar(ref.node) || identity.isCollection(ref.node))) {
              ref.node.anchor = ref.anchor;
            } else {
              const error = new Error("Failed to resolve repeated object (this should not happen)");
              error.source = source;
              throw error;
            }
          }
        },
        sourceObjects
      };
    }
    exports.anchorIsValid = anchorIsValid;
    exports.anchorNames = anchorNames;
    exports.createNodeAnchors = createNodeAnchors;
    exports.findNewAnchor = findNewAnchor;
  }
});

// ../../node_modules/yaml/dist/doc/applyReviver.js
var require_applyReviver = __commonJS({
  "../../node_modules/yaml/dist/doc/applyReviver.js"(exports) {
    "use strict";
    function applyReviver(reviver, obj, key, val) {
      if (val && typeof val === "object") {
        if (Array.isArray(val)) {
          for (let i = 0, len = val.length; i < len; ++i) {
            const v0 = val[i];
            const v1 = applyReviver(reviver, val, String(i), v0);
            if (v1 === void 0)
              delete val[i];
            else if (v1 !== v0)
              val[i] = v1;
          }
        } else if (val instanceof Map) {
          for (const k of Array.from(val.keys())) {
            const v0 = val.get(k);
            const v1 = applyReviver(reviver, val, k, v0);
            if (v1 === void 0)
              val.delete(k);
            else if (v1 !== v0)
              val.set(k, v1);
          }
        } else if (val instanceof Set) {
          for (const v0 of Array.from(val)) {
            const v1 = applyReviver(reviver, val, v0, v0);
            if (v1 === void 0)
              val.delete(v0);
            else if (v1 !== v0) {
              val.delete(v0);
              val.add(v1);
            }
          }
        } else {
          for (const [k, v0] of Object.entries(val)) {
            const v1 = applyReviver(reviver, val, k, v0);
            if (v1 === void 0)
              delete val[k];
            else if (v1 !== v0)
              val[k] = v1;
          }
        }
      }
      return reviver.call(obj, key, val);
    }
    exports.applyReviver = applyReviver;
  }
});

// ../../node_modules/yaml/dist/nodes/toJS.js
var require_toJS = __commonJS({
  "../../node_modules/yaml/dist/nodes/toJS.js"(exports) {
    "use strict";
    var identity = require_identity();
    function toJS(value, arg, ctx) {
      if (Array.isArray(value))
        return value.map((v, i) => toJS(v, String(i), ctx));
      if (value && typeof value.toJSON === "function") {
        if (!ctx || !identity.hasAnchor(value))
          return value.toJSON(arg, ctx);
        const data = { aliasCount: 0, count: 1, res: void 0 };
        ctx.anchors.set(value, data);
        ctx.onCreate = (res2) => {
          data.res = res2;
          delete ctx.onCreate;
        };
        const res = value.toJSON(arg, ctx);
        if (ctx.onCreate)
          ctx.onCreate(res);
        return res;
      }
      if (typeof value === "bigint" && !ctx?.keep)
        return Number(value);
      return value;
    }
    exports.toJS = toJS;
  }
});

// ../../node_modules/yaml/dist/nodes/Node.js
var require_Node = __commonJS({
  "../../node_modules/yaml/dist/nodes/Node.js"(exports) {
    "use strict";
    var applyReviver = require_applyReviver();
    var identity = require_identity();
    var toJS = require_toJS();
    var NodeBase = class {
      constructor(type) {
        Object.defineProperty(this, identity.NODE_TYPE, { value: type });
      }
      /** Create a copy of this node.  */
      clone() {
        const copy = Object.create(Object.getPrototypeOf(this), Object.getOwnPropertyDescriptors(this));
        if (this.range)
          copy.range = this.range.slice();
        return copy;
      }
      /** A plain JavaScript representation of this node. */
      toJS(doc, { mapAsMap, maxAliasCount, onAnchor, reviver } = {}) {
        if (!identity.isDocument(doc))
          throw new TypeError("A document argument is required");
        const ctx = {
          anchors: /* @__PURE__ */ new Map(),
          doc,
          keep: true,
          mapAsMap: mapAsMap === true,
          mapKeyWarned: false,
          maxAliasCount: typeof maxAliasCount === "number" ? maxAliasCount : 100
        };
        const res = toJS.toJS(this, "", ctx);
        if (typeof onAnchor === "function")
          for (const { count, res: res2 } of ctx.anchors.values())
            onAnchor(res2, count);
        return typeof reviver === "function" ? applyReviver.applyReviver(reviver, { "": res }, "", res) : res;
      }
    };
    exports.NodeBase = NodeBase;
  }
});

// ../../node_modules/yaml/dist/nodes/Alias.js
var require_Alias = __commonJS({
  "../../node_modules/yaml/dist/nodes/Alias.js"(exports) {
    "use strict";
    var anchors = require_anchors();
    var visit = require_visit();
    var identity = require_identity();
    var Node = require_Node();
    var toJS = require_toJS();
    var Alias = class extends Node.NodeBase {
      constructor(source) {
        super(identity.ALIAS);
        this.source = source;
        Object.defineProperty(this, "tag", {
          set() {
            throw new Error("Alias nodes cannot have tags");
          }
        });
      }
      /**
       * Resolve the value of this alias within `doc`, finding the last
       * instance of the `source` anchor before this node.
       */
      resolve(doc, ctx) {
        if (ctx?.maxAliasCount === 0)
          throw new ReferenceError("Alias resolution is disabled");
        let nodes;
        if (ctx?.aliasResolveCache) {
          nodes = ctx.aliasResolveCache;
        } else {
          nodes = [];
          visit.visit(doc, {
            Node: (_key, node) => {
              if (identity.isAlias(node) || identity.hasAnchor(node))
                nodes.push(node);
            }
          });
          if (ctx)
            ctx.aliasResolveCache = nodes;
        }
        let found = void 0;
        for (const node of nodes) {
          if (node === this)
            break;
          if (node.anchor === this.source)
            found = node;
        }
        return found;
      }
      toJSON(_arg, ctx) {
        if (!ctx)
          return { source: this.source };
        const { anchors: anchors2, doc, maxAliasCount } = ctx;
        const source = this.resolve(doc, ctx);
        if (!source) {
          const msg = `Unresolved alias (the anchor must be set before the alias): ${this.source}`;
          throw new ReferenceError(msg);
        }
        let data = anchors2.get(source);
        if (!data) {
          toJS.toJS(source, null, ctx);
          data = anchors2.get(source);
        }
        if (data?.res === void 0) {
          const msg = "This should not happen: Alias anchor was not resolved?";
          throw new ReferenceError(msg);
        }
        if (maxAliasCount >= 0) {
          data.count += 1;
          if (data.aliasCount === 0)
            data.aliasCount = getAliasCount(doc, source, anchors2);
          if (data.count * data.aliasCount > maxAliasCount) {
            const msg = "Excessive alias count indicates a resource exhaustion attack";
            throw new ReferenceError(msg);
          }
        }
        return data.res;
      }
      toString(ctx, _onComment, _onChompKeep) {
        const src = `*${this.source}`;
        if (ctx) {
          anchors.anchorIsValid(this.source);
          if (ctx.options.verifyAliasOrder && !ctx.anchors.has(this.source)) {
            const msg = `Unresolved alias (the anchor must be set before the alias): ${this.source}`;
            throw new Error(msg);
          }
          if (ctx.implicitKey)
            return `${src} `;
        }
        return src;
      }
    };
    function getAliasCount(doc, node, anchors2) {
      if (identity.isAlias(node)) {
        const source = node.resolve(doc);
        const anchor = anchors2 && source && anchors2.get(source);
        return anchor ? anchor.count * anchor.aliasCount : 0;
      } else if (identity.isCollection(node)) {
        let count = 0;
        for (const item of node.items) {
          const c = getAliasCount(doc, item, anchors2);
          if (c > count)
            count = c;
        }
        return count;
      } else if (identity.isPair(node)) {
        const kc = getAliasCount(doc, node.key, anchors2);
        const vc = getAliasCount(doc, node.value, anchors2);
        return Math.max(kc, vc);
      }
      return 1;
    }
    exports.Alias = Alias;
  }
});

// ../../node_modules/yaml/dist/nodes/Scalar.js
var require_Scalar = __commonJS({
  "../../node_modules/yaml/dist/nodes/Scalar.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Node = require_Node();
    var toJS = require_toJS();
    var isScalarValue = (value) => !value || typeof value !== "function" && typeof value !== "object";
    var Scalar = class extends Node.NodeBase {
      constructor(value) {
        super(identity.SCALAR);
        this.value = value;
      }
      toJSON(arg, ctx) {
        return ctx?.keep ? this.value : toJS.toJS(this.value, arg, ctx);
      }
      toString() {
        return String(this.value);
      }
    };
    Scalar.BLOCK_FOLDED = "BLOCK_FOLDED";
    Scalar.BLOCK_LITERAL = "BLOCK_LITERAL";
    Scalar.PLAIN = "PLAIN";
    Scalar.QUOTE_DOUBLE = "QUOTE_DOUBLE";
    Scalar.QUOTE_SINGLE = "QUOTE_SINGLE";
    exports.Scalar = Scalar;
    exports.isScalarValue = isScalarValue;
  }
});

// ../../node_modules/yaml/dist/doc/createNode.js
var require_createNode = __commonJS({
  "../../node_modules/yaml/dist/doc/createNode.js"(exports) {
    "use strict";
    var Alias = require_Alias();
    var identity = require_identity();
    var Scalar = require_Scalar();
    var defaultTagPrefix = "tag:yaml.org,2002:";
    function findTagObject(value, tagName, tags) {
      if (tagName) {
        const match = tags.filter((t2) => t2.tag === tagName);
        const tagObj = match.find((t2) => !t2.format) ?? match[0];
        if (!tagObj)
          throw new Error(`Tag ${tagName} not found`);
        return tagObj;
      }
      return tags.find((t2) => t2.identify?.(value) && !t2.format);
    }
    function createNode(value, tagName, ctx) {
      if (identity.isDocument(value))
        value = value.contents;
      if (identity.isNode(value))
        return value;
      if (identity.isPair(value)) {
        const map = ctx.schema[identity.MAP].createNode?.(ctx.schema, null, ctx);
        map.items.push(value);
        return map;
      }
      if (value instanceof String || value instanceof Number || value instanceof Boolean || typeof BigInt !== "undefined" && value instanceof BigInt) {
        value = value.valueOf();
      }
      const { aliasDuplicateObjects, onAnchor, onTagObj, schema, sourceObjects } = ctx;
      let ref = void 0;
      if (aliasDuplicateObjects && value && typeof value === "object") {
        ref = sourceObjects.get(value);
        if (ref) {
          ref.anchor ?? (ref.anchor = onAnchor(value));
          return new Alias.Alias(ref.anchor);
        } else {
          ref = { anchor: null, node: null };
          sourceObjects.set(value, ref);
        }
      }
      if (tagName?.startsWith("!!"))
        tagName = defaultTagPrefix + tagName.slice(2);
      let tagObj = findTagObject(value, tagName, schema.tags);
      if (!tagObj) {
        if (value && typeof value.toJSON === "function") {
          value = value.toJSON();
        }
        if (!value || typeof value !== "object") {
          const node2 = new Scalar.Scalar(value);
          if (ref)
            ref.node = node2;
          return node2;
        }
        tagObj = value instanceof Map ? schema[identity.MAP] : Symbol.iterator in Object(value) ? schema[identity.SEQ] : schema[identity.MAP];
      }
      if (onTagObj) {
        onTagObj(tagObj);
        delete ctx.onTagObj;
      }
      const node = tagObj?.createNode ? tagObj.createNode(ctx.schema, value, ctx) : typeof tagObj?.nodeClass?.from === "function" ? tagObj.nodeClass.from(ctx.schema, value, ctx) : new Scalar.Scalar(value);
      if (tagName)
        node.tag = tagName;
      else if (!tagObj.default)
        node.tag = tagObj.tag;
      if (ref)
        ref.node = node;
      return node;
    }
    exports.createNode = createNode;
  }
});

// ../../node_modules/yaml/dist/nodes/Collection.js
var require_Collection = __commonJS({
  "../../node_modules/yaml/dist/nodes/Collection.js"(exports) {
    "use strict";
    var createNode = require_createNode();
    var identity = require_identity();
    var Node = require_Node();
    function collectionFromPath(schema, path, value) {
      let v = value;
      for (let i = path.length - 1; i >= 0; --i) {
        const k = path[i];
        if (typeof k === "number" && Number.isInteger(k) && k >= 0) {
          const a = [];
          a[k] = v;
          v = a;
        } else {
          v = /* @__PURE__ */ new Map([[k, v]]);
        }
      }
      return createNode.createNode(v, void 0, {
        aliasDuplicateObjects: false,
        keepUndefined: false,
        onAnchor: () => {
          throw new Error("This should not happen, please report a bug.");
        },
        schema,
        sourceObjects: /* @__PURE__ */ new Map()
      });
    }
    var isEmptyPath = (path) => path == null || typeof path === "object" && !!path[Symbol.iterator]().next().done;
    var Collection = class extends Node.NodeBase {
      constructor(type, schema) {
        super(type);
        Object.defineProperty(this, "schema", {
          value: schema,
          configurable: true,
          enumerable: false,
          writable: true
        });
      }
      /**
       * Create a copy of this collection.
       *
       * @param schema - If defined, overwrites the original's schema
       */
      clone(schema) {
        const copy = Object.create(Object.getPrototypeOf(this), Object.getOwnPropertyDescriptors(this));
        if (schema)
          copy.schema = schema;
        copy.items = copy.items.map((it) => identity.isNode(it) || identity.isPair(it) ? it.clone(schema) : it);
        if (this.range)
          copy.range = this.range.slice();
        return copy;
      }
      /**
       * Adds a value to the collection. For `!!map` and `!!omap` the value must
       * be a Pair instance or a `{ key, value }` object, which may not have a key
       * that already exists in the map.
       */
      addIn(path, value) {
        if (isEmptyPath(path))
          this.add(value);
        else {
          const [key, ...rest] = path;
          const node = this.get(key, true);
          if (identity.isCollection(node))
            node.addIn(rest, value);
          else if (node === void 0 && this.schema)
            this.set(key, collectionFromPath(this.schema, rest, value));
          else
            throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
        }
      }
      /**
       * Removes a value from the collection.
       * @returns `true` if the item was found and removed.
       */
      deleteIn(path) {
        const [key, ...rest] = path;
        if (rest.length === 0)
          return this.delete(key);
        const node = this.get(key, true);
        if (identity.isCollection(node))
          return node.deleteIn(rest);
        else
          throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
      }
      /**
       * Returns item at `key`, or `undefined` if not found. By default unwraps
       * scalar values from their surrounding node; to disable set `keepScalar` to
       * `true` (collections are always returned intact).
       */
      getIn(path, keepScalar) {
        const [key, ...rest] = path;
        const node = this.get(key, true);
        if (rest.length === 0)
          return !keepScalar && identity.isScalar(node) ? node.value : node;
        else
          return identity.isCollection(node) ? node.getIn(rest, keepScalar) : void 0;
      }
      hasAllNullValues(allowScalar) {
        return this.items.every((node) => {
          if (!identity.isPair(node))
            return false;
          const n = node.value;
          return n == null || allowScalar && identity.isScalar(n) && n.value == null && !n.commentBefore && !n.comment && !n.tag;
        });
      }
      /**
       * Checks if the collection includes a value with the key `key`.
       */
      hasIn(path) {
        const [key, ...rest] = path;
        if (rest.length === 0)
          return this.has(key);
        const node = this.get(key, true);
        return identity.isCollection(node) ? node.hasIn(rest) : false;
      }
      /**
       * Sets a value in this collection. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       */
      setIn(path, value) {
        const [key, ...rest] = path;
        if (rest.length === 0) {
          this.set(key, value);
        } else {
          const node = this.get(key, true);
          if (identity.isCollection(node))
            node.setIn(rest, value);
          else if (node === void 0 && this.schema)
            this.set(key, collectionFromPath(this.schema, rest, value));
          else
            throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
        }
      }
    };
    exports.Collection = Collection;
    exports.collectionFromPath = collectionFromPath;
    exports.isEmptyPath = isEmptyPath;
  }
});

// ../../node_modules/yaml/dist/stringify/stringifyComment.js
var require_stringifyComment = __commonJS({
  "../../node_modules/yaml/dist/stringify/stringifyComment.js"(exports) {
    "use strict";
    var stringifyComment = (str) => str.replace(/^(?!$)(?: $)?/gm, "#");
    function indentComment(comment, indent) {
      if (/^\n+$/.test(comment))
        return comment.substring(1);
      return indent ? comment.replace(/^(?! *$)/gm, indent) : comment;
    }
    var lineComment = (str, indent, comment) => str.endsWith("\n") ? indentComment(comment, indent) : comment.includes("\n") ? "\n" + indentComment(comment, indent) : (str.endsWith(" ") ? "" : " ") + comment;
    exports.indentComment = indentComment;
    exports.lineComment = lineComment;
    exports.stringifyComment = stringifyComment;
  }
});

// ../../node_modules/yaml/dist/stringify/foldFlowLines.js
var require_foldFlowLines = __commonJS({
  "../../node_modules/yaml/dist/stringify/foldFlowLines.js"(exports) {
    "use strict";
    var FOLD_FLOW = "flow";
    var FOLD_BLOCK = "block";
    var FOLD_QUOTED = "quoted";
    function foldFlowLines(text, indent, mode = "flow", { indentAtStart, lineWidth = 80, minContentWidth = 20, onFold, onOverflow } = {}) {
      if (!lineWidth || lineWidth < 0)
        return text;
      if (lineWidth < minContentWidth)
        minContentWidth = 0;
      const endStep = Math.max(1 + minContentWidth, 1 + lineWidth - indent.length);
      if (text.length <= endStep)
        return text;
      const folds = [];
      const escapedFolds = {};
      let end = lineWidth - indent.length;
      if (typeof indentAtStart === "number") {
        if (indentAtStart > lineWidth - Math.max(2, minContentWidth))
          folds.push(0);
        else
          end = lineWidth - indentAtStart;
      }
      let split = void 0;
      let prev = void 0;
      let overflow = false;
      let i = -1;
      let escStart = -1;
      let escEnd = -1;
      if (mode === FOLD_BLOCK) {
        i = consumeMoreIndentedLines(text, i, indent.length);
        if (i !== -1)
          end = i + endStep;
      }
      for (let ch; ch = text[i += 1]; ) {
        if (mode === FOLD_QUOTED && ch === "\\") {
          escStart = i;
          switch (text[i + 1]) {
            case "x":
              i += 3;
              break;
            case "u":
              i += 5;
              break;
            case "U":
              i += 9;
              break;
            default:
              i += 1;
          }
          escEnd = i;
        }
        if (ch === "\n") {
          if (mode === FOLD_BLOCK)
            i = consumeMoreIndentedLines(text, i, indent.length);
          end = i + indent.length + endStep;
          split = void 0;
        } else {
          if (ch === " " && prev && prev !== " " && prev !== "\n" && prev !== "	") {
            const next = text[i + 1];
            if (next && next !== " " && next !== "\n" && next !== "	")
              split = i;
          }
          if (i >= end) {
            if (split) {
              folds.push(split);
              end = split + endStep;
              split = void 0;
            } else if (mode === FOLD_QUOTED) {
              while (prev === " " || prev === "	") {
                prev = ch;
                ch = text[i += 1];
                overflow = true;
              }
              const j = i > escEnd + 1 ? i - 2 : escStart - 1;
              if (escapedFolds[j])
                return text;
              folds.push(j);
              escapedFolds[j] = true;
              end = j + endStep;
              split = void 0;
            } else {
              overflow = true;
            }
          }
        }
        prev = ch;
      }
      if (overflow && onOverflow)
        onOverflow();
      if (folds.length === 0)
        return text;
      if (onFold)
        onFold();
      let res = text.slice(0, folds[0]);
      for (let i2 = 0; i2 < folds.length; ++i2) {
        const fold = folds[i2];
        const end2 = folds[i2 + 1] || text.length;
        if (fold === 0)
          res = `
${indent}${text.slice(0, end2)}`;
        else {
          if (mode === FOLD_QUOTED && escapedFolds[fold])
            res += `${text[fold]}\\`;
          res += `
${indent}${text.slice(fold + 1, end2)}`;
        }
      }
      return res;
    }
    function consumeMoreIndentedLines(text, i, indent) {
      let end = i;
      let start = i + 1;
      let ch = text[start];
      while (ch === " " || ch === "	") {
        if (i < start + indent) {
          ch = text[++i];
        } else {
          do {
            ch = text[++i];
          } while (ch && ch !== "\n");
          end = i;
          start = i + 1;
          ch = text[start];
        }
      }
      return end;
    }
    exports.FOLD_BLOCK = FOLD_BLOCK;
    exports.FOLD_FLOW = FOLD_FLOW;
    exports.FOLD_QUOTED = FOLD_QUOTED;
    exports.foldFlowLines = foldFlowLines;
  }
});

// ../../node_modules/yaml/dist/stringify/stringifyString.js
var require_stringifyString = __commonJS({
  "../../node_modules/yaml/dist/stringify/stringifyString.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var foldFlowLines = require_foldFlowLines();
    var getFoldOptions = (ctx, isBlock) => ({
      indentAtStart: isBlock ? ctx.indent.length : ctx.indentAtStart,
      lineWidth: ctx.options.lineWidth,
      minContentWidth: ctx.options.minContentWidth
    });
    var containsDocumentMarker = (str) => /^(%|---|\.\.\.)/m.test(str);
    function lineLengthOverLimit(str, lineWidth, indentLength) {
      if (!lineWidth || lineWidth < 0)
        return false;
      const limit = lineWidth - indentLength;
      const strLen = str.length;
      if (strLen <= limit)
        return false;
      for (let i = 0, start = 0; i < strLen; ++i) {
        if (str[i] === "\n") {
          if (i - start > limit)
            return true;
          start = i + 1;
          if (strLen - start <= limit)
            return false;
        }
      }
      return true;
    }
    function doubleQuotedString(value, ctx) {
      const json = JSON.stringify(value);
      if (ctx.options.doubleQuotedAsJSON)
        return json;
      const { implicitKey } = ctx;
      const minMultiLineLength = ctx.options.doubleQuotedMinMultiLineLength;
      const indent = ctx.indent || (containsDocumentMarker(value) ? "  " : "");
      let str = "";
      let start = 0;
      for (let i = 0, ch = json[i]; ch; ch = json[++i]) {
        if (ch === " " && json[i + 1] === "\\" && json[i + 2] === "n") {
          str += json.slice(start, i) + "\\ ";
          i += 1;
          start = i;
          ch = "\\";
        }
        if (ch === "\\")
          switch (json[i + 1]) {
            case "u":
              {
                str += json.slice(start, i);
                const code = json.substr(i + 2, 4);
                switch (code) {
                  case "0000":
                    str += "\\0";
                    break;
                  case "0007":
                    str += "\\a";
                    break;
                  case "000b":
                    str += "\\v";
                    break;
                  case "001b":
                    str += "\\e";
                    break;
                  case "0085":
                    str += "\\N";
                    break;
                  case "00a0":
                    str += "\\_";
                    break;
                  case "2028":
                    str += "\\L";
                    break;
                  case "2029":
                    str += "\\P";
                    break;
                  default:
                    if (code.substr(0, 2) === "00")
                      str += "\\x" + code.substr(2);
                    else
                      str += json.substr(i, 6);
                }
                i += 5;
                start = i + 1;
              }
              break;
            case "n":
              if (implicitKey || json[i + 2] === '"' || json.length < minMultiLineLength) {
                i += 1;
              } else {
                str += json.slice(start, i) + "\n\n";
                while (json[i + 2] === "\\" && json[i + 3] === "n" && json[i + 4] !== '"') {
                  str += "\n";
                  i += 2;
                }
                str += indent;
                if (json[i + 2] === " ")
                  str += "\\";
                i += 1;
                start = i + 1;
              }
              break;
            default:
              i += 1;
          }
      }
      str = start ? str + json.slice(start) : json;
      return implicitKey ? str : foldFlowLines.foldFlowLines(str, indent, foldFlowLines.FOLD_QUOTED, getFoldOptions(ctx, false));
    }
    function singleQuotedString(value, ctx) {
      if (ctx.options.singleQuote === false || ctx.implicitKey && value.includes("\n") || /[ \t]\n|\n[ \t]/.test(value))
        return doubleQuotedString(value, ctx);
      const indent = ctx.indent || (containsDocumentMarker(value) ? "  " : "");
      const res = "'" + value.replace(/'/g, "''").replace(/\n+/g, `$&
${indent}`) + "'";
      return ctx.implicitKey ? res : foldFlowLines.foldFlowLines(res, indent, foldFlowLines.FOLD_FLOW, getFoldOptions(ctx, false));
    }
    function quotedString(value, ctx) {
      const { singleQuote } = ctx.options;
      let qs;
      if (singleQuote === false)
        qs = doubleQuotedString;
      else {
        const hasDouble = value.includes('"');
        const hasSingle = value.includes("'");
        if (hasDouble && !hasSingle)
          qs = singleQuotedString;
        else if (hasSingle && !hasDouble)
          qs = doubleQuotedString;
        else
          qs = singleQuote ? singleQuotedString : doubleQuotedString;
      }
      return qs(value, ctx);
    }
    var blockEndNewlines;
    try {
      blockEndNewlines = new RegExp("(^|(?<!\n))\n+(?!\n|$)", "g");
    } catch {
      blockEndNewlines = /\n+(?!\n|$)/g;
    }
    function blockString({ comment, type, value }, ctx, onComment, onChompKeep) {
      const { blockQuote, commentString, lineWidth } = ctx.options;
      if (!blockQuote || /\n[\t ]+$/.test(value)) {
        return quotedString(value, ctx);
      }
      const indent = ctx.indent || (ctx.forceBlockIndent || containsDocumentMarker(value) ? "  " : "");
      const literal = blockQuote === "literal" ? true : blockQuote === "folded" || type === Scalar.Scalar.BLOCK_FOLDED ? false : type === Scalar.Scalar.BLOCK_LITERAL ? true : !lineLengthOverLimit(value, lineWidth, indent.length);
      if (!value)
        return literal ? "|\n" : ">\n";
      let chomp;
      let endStart;
      for (endStart = value.length; endStart > 0; --endStart) {
        const ch = value[endStart - 1];
        if (ch !== "\n" && ch !== "	" && ch !== " ")
          break;
      }
      let end = value.substring(endStart);
      const endNlPos = end.indexOf("\n");
      if (endNlPos === -1) {
        chomp = "-";
      } else if (value === end || endNlPos !== end.length - 1) {
        chomp = "+";
        if (onChompKeep)
          onChompKeep();
      } else {
        chomp = "";
      }
      if (end) {
        value = value.slice(0, -end.length);
        if (end[end.length - 1] === "\n")
          end = end.slice(0, -1);
        end = end.replace(blockEndNewlines, `$&${indent}`);
      }
      let startWithSpace = false;
      let startEnd;
      let startNlPos = -1;
      for (startEnd = 0; startEnd < value.length; ++startEnd) {
        const ch = value[startEnd];
        if (ch === " ")
          startWithSpace = true;
        else if (ch === "\n")
          startNlPos = startEnd;
        else
          break;
      }
      let start = value.substring(0, startNlPos < startEnd ? startNlPos + 1 : startEnd);
      if (start) {
        value = value.substring(start.length);
        start = start.replace(/\n+/g, `$&${indent}`);
      }
      const indentSize = indent ? "2" : "1";
      let header = (startWithSpace ? indentSize : "") + chomp;
      if (comment) {
        header += " " + commentString(comment.replace(/ ?[\r\n]+/g, " "));
        if (onComment)
          onComment();
      }
      if (!literal) {
        const foldedValue = value.replace(/\n+/g, "\n$&").replace(/(?:^|\n)([\t ].*)(?:([\n\t ]*)\n(?![\n\t ]))?/g, "$1$2").replace(/\n+/g, `$&${indent}`);
        let literalFallback = false;
        const foldOptions = getFoldOptions(ctx, true);
        if (blockQuote !== "folded" && type !== Scalar.Scalar.BLOCK_FOLDED) {
          foldOptions.onOverflow = () => {
            literalFallback = true;
          };
        }
        const body = foldFlowLines.foldFlowLines(`${start}${foldedValue}${end}`, indent, foldFlowLines.FOLD_BLOCK, foldOptions);
        if (!literalFallback)
          return `>${header}
${indent}${body}`;
      }
      value = value.replace(/\n+/g, `$&${indent}`);
      return `|${header}
${indent}${start}${value}${end}`;
    }
    function plainString(item, ctx, onComment, onChompKeep) {
      const { type, value } = item;
      const { actualString, implicitKey, indent, indentStep, inFlow } = ctx;
      if (implicitKey && value.includes("\n") || inFlow && /[[\]{},]/.test(value)) {
        return quotedString(value, ctx);
      }
      if (/^[\n\t ,[\]{}#&*!|>'"%@`]|^[?-]$|^[?-][ \t]|[\n:][ \t]|[ \t]\n|[\n\t ]#|[\n\t :]$/.test(value)) {
        return implicitKey || inFlow || !value.includes("\n") ? quotedString(value, ctx) : blockString(item, ctx, onComment, onChompKeep);
      }
      if (!implicitKey && !inFlow && type !== Scalar.Scalar.PLAIN && value.includes("\n")) {
        return blockString(item, ctx, onComment, onChompKeep);
      }
      if (containsDocumentMarker(value)) {
        if (indent === "") {
          ctx.forceBlockIndent = true;
          return blockString(item, ctx, onComment, onChompKeep);
        } else if (implicitKey && indent === indentStep) {
          return quotedString(value, ctx);
        }
      }
      const str = value.replace(/\n+/g, `$&
${indent}`);
      if (actualString) {
        const test = (tag) => tag.default && tag.tag !== "tag:yaml.org,2002:str" && tag.test?.test(str);
        const { compat, tags } = ctx.doc.schema;
        if (tags.some(test) || compat?.some(test))
          return quotedString(value, ctx);
      }
      return implicitKey ? str : foldFlowLines.foldFlowLines(str, indent, foldFlowLines.FOLD_FLOW, getFoldOptions(ctx, false));
    }
    function stringifyString(item, ctx, onComment, onChompKeep) {
      const { implicitKey, inFlow } = ctx;
      const ss = typeof item.value === "string" ? item : Object.assign({}, item, { value: String(item.value) });
      let { type } = item;
      if (type !== Scalar.Scalar.QUOTE_DOUBLE) {
        if (/[\x00-\x08\x0b-\x1f\x7f-\x9f\u{D800}-\u{DFFF}]/u.test(ss.value))
          type = Scalar.Scalar.QUOTE_DOUBLE;
      }
      const _stringify = (_type) => {
        switch (_type) {
          case Scalar.Scalar.BLOCK_FOLDED:
          case Scalar.Scalar.BLOCK_LITERAL:
            return implicitKey || inFlow ? quotedString(ss.value, ctx) : blockString(ss, ctx, onComment, onChompKeep);
          case Scalar.Scalar.QUOTE_DOUBLE:
            return doubleQuotedString(ss.value, ctx);
          case Scalar.Scalar.QUOTE_SINGLE:
            return singleQuotedString(ss.value, ctx);
          case Scalar.Scalar.PLAIN:
            return plainString(ss, ctx, onComment, onChompKeep);
          default:
            return null;
        }
      };
      let res = _stringify(type);
      if (res === null) {
        const { defaultKeyType, defaultStringType } = ctx.options;
        const t2 = implicitKey && defaultKeyType || defaultStringType;
        res = _stringify(t2);
        if (res === null)
          throw new Error(`Unsupported default string type ${t2}`);
      }
      return res;
    }
    exports.stringifyString = stringifyString;
  }
});

// ../../node_modules/yaml/dist/stringify/stringify.js
var require_stringify = __commonJS({
  "../../node_modules/yaml/dist/stringify/stringify.js"(exports) {
    "use strict";
    var anchors = require_anchors();
    var identity = require_identity();
    var stringifyComment = require_stringifyComment();
    var stringifyString = require_stringifyString();
    function createStringifyContext(doc, options) {
      const opt = Object.assign({
        blockQuote: true,
        commentString: stringifyComment.stringifyComment,
        defaultKeyType: null,
        defaultStringType: "PLAIN",
        directives: null,
        doubleQuotedAsJSON: false,
        doubleQuotedMinMultiLineLength: 40,
        falseStr: "false",
        flowCollectionPadding: true,
        indentSeq: true,
        lineWidth: 80,
        minContentWidth: 20,
        nullStr: "null",
        simpleKeys: false,
        singleQuote: null,
        trailingComma: false,
        trueStr: "true",
        verifyAliasOrder: true
      }, doc.schema.toStringOptions, options);
      let inFlow;
      switch (opt.collectionStyle) {
        case "block":
          inFlow = false;
          break;
        case "flow":
          inFlow = true;
          break;
        default:
          inFlow = null;
      }
      return {
        anchors: /* @__PURE__ */ new Set(),
        doc,
        flowCollectionPadding: opt.flowCollectionPadding ? " " : "",
        indent: "",
        indentStep: typeof opt.indent === "number" ? " ".repeat(opt.indent) : "  ",
        inFlow,
        options: opt
      };
    }
    function getTagObject(tags, item) {
      if (item.tag) {
        const match = tags.filter((t2) => t2.tag === item.tag);
        if (match.length > 0)
          return match.find((t2) => t2.format === item.format) ?? match[0];
      }
      let tagObj = void 0;
      let obj;
      if (identity.isScalar(item)) {
        obj = item.value;
        let match = tags.filter((t2) => t2.identify?.(obj));
        if (match.length > 1) {
          const testMatch = match.filter((t2) => t2.test);
          if (testMatch.length > 0)
            match = testMatch;
        }
        tagObj = match.find((t2) => t2.format === item.format) ?? match.find((t2) => !t2.format);
      } else {
        obj = item;
        tagObj = tags.find((t2) => t2.nodeClass && obj instanceof t2.nodeClass);
      }
      if (!tagObj) {
        const name = obj?.constructor?.name ?? (obj === null ? "null" : typeof obj);
        throw new Error(`Tag not resolved for ${name} value`);
      }
      return tagObj;
    }
    function stringifyProps(node, tagObj, { anchors: anchors$1, doc }) {
      if (!doc.directives)
        return "";
      const props = [];
      const anchor = (identity.isScalar(node) || identity.isCollection(node)) && node.anchor;
      if (anchor && anchors.anchorIsValid(anchor)) {
        anchors$1.add(anchor);
        props.push(`&${anchor}`);
      }
      const tag = node.tag ?? (tagObj.default ? null : tagObj.tag);
      if (tag)
        props.push(doc.directives.tagString(tag));
      return props.join(" ");
    }
    function stringify(item, ctx, onComment, onChompKeep) {
      if (identity.isPair(item))
        return item.toString(ctx, onComment, onChompKeep);
      if (identity.isAlias(item)) {
        if (ctx.doc.directives)
          return item.toString(ctx);
        if (ctx.resolvedAliases?.has(item)) {
          throw new TypeError(`Cannot stringify circular structure without alias nodes`);
        } else {
          if (ctx.resolvedAliases)
            ctx.resolvedAliases.add(item);
          else
            ctx.resolvedAliases = /* @__PURE__ */ new Set([item]);
          item = item.resolve(ctx.doc);
        }
      }
      let tagObj = void 0;
      const node = identity.isNode(item) ? item : ctx.doc.createNode(item, { onTagObj: (o) => tagObj = o });
      tagObj ?? (tagObj = getTagObject(ctx.doc.schema.tags, node));
      const props = stringifyProps(node, tagObj, ctx);
      if (props.length > 0)
        ctx.indentAtStart = (ctx.indentAtStart ?? 0) + props.length + 1;
      const str = typeof tagObj.stringify === "function" ? tagObj.stringify(node, ctx, onComment, onChompKeep) : identity.isScalar(node) ? stringifyString.stringifyString(node, ctx, onComment, onChompKeep) : node.toString(ctx, onComment, onChompKeep);
      if (!props)
        return str;
      return identity.isScalar(node) || str[0] === "{" || str[0] === "[" ? `${props} ${str}` : `${props}
${ctx.indent}${str}`;
    }
    exports.createStringifyContext = createStringifyContext;
    exports.stringify = stringify;
  }
});

// ../../node_modules/yaml/dist/stringify/stringifyPair.js
var require_stringifyPair = __commonJS({
  "../../node_modules/yaml/dist/stringify/stringifyPair.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Scalar = require_Scalar();
    var stringify = require_stringify();
    var stringifyComment = require_stringifyComment();
    function stringifyPair({ key, value }, ctx, onComment, onChompKeep) {
      const { allNullValues, doc, indent, indentStep, options: { commentString, indentSeq, simpleKeys } } = ctx;
      let keyComment = identity.isNode(key) && key.comment || null;
      if (simpleKeys) {
        if (keyComment) {
          throw new Error("With simple keys, key nodes cannot have comments");
        }
        if (identity.isCollection(key) || !identity.isNode(key) && typeof key === "object") {
          const msg = "With simple keys, collection cannot be used as a key value";
          throw new Error(msg);
        }
      }
      let explicitKey = !simpleKeys && (!key || keyComment && value == null && !ctx.inFlow || identity.isCollection(key) || (identity.isScalar(key) ? key.type === Scalar.Scalar.BLOCK_FOLDED || key.type === Scalar.Scalar.BLOCK_LITERAL : typeof key === "object"));
      ctx = Object.assign({}, ctx, {
        allNullValues: false,
        implicitKey: !explicitKey && (simpleKeys || !allNullValues),
        indent: indent + indentStep
      });
      let keyCommentDone = false;
      let chompKeep = false;
      let str = stringify.stringify(key, ctx, () => keyCommentDone = true, () => chompKeep = true);
      if (!explicitKey && !ctx.inFlow && str.length > 1024) {
        if (simpleKeys)
          throw new Error("With simple keys, single line scalar must not span more than 1024 characters");
        explicitKey = true;
      }
      if (ctx.inFlow) {
        if (allNullValues || value == null) {
          if (keyCommentDone && onComment)
            onComment();
          return str === "" ? "?" : explicitKey ? `? ${str}` : str;
        }
      } else if (allNullValues && !simpleKeys || value == null && explicitKey) {
        str = `? ${str}`;
        if (keyComment && !keyCommentDone) {
          str += stringifyComment.lineComment(str, ctx.indent, commentString(keyComment));
        } else if (chompKeep && onChompKeep)
          onChompKeep();
        return str;
      }
      if (keyCommentDone)
        keyComment = null;
      if (explicitKey) {
        if (keyComment)
          str += stringifyComment.lineComment(str, ctx.indent, commentString(keyComment));
        str = `? ${str}
${indent}:`;
      } else {
        str = `${str}:`;
        if (keyComment)
          str += stringifyComment.lineComment(str, ctx.indent, commentString(keyComment));
      }
      let vsb, vcb, valueComment;
      if (identity.isNode(value)) {
        vsb = !!value.spaceBefore;
        vcb = value.commentBefore;
        valueComment = value.comment;
      } else {
        vsb = false;
        vcb = null;
        valueComment = null;
        if (value && typeof value === "object")
          value = doc.createNode(value);
      }
      ctx.implicitKey = false;
      if (!explicitKey && !keyComment && identity.isScalar(value))
        ctx.indentAtStart = str.length + 1;
      chompKeep = false;
      if (!indentSeq && indentStep.length >= 2 && !ctx.inFlow && !explicitKey && identity.isSeq(value) && !value.flow && !value.tag && !value.anchor) {
        ctx.indent = ctx.indent.substring(2);
      }
      let valueCommentDone = false;
      const valueStr = stringify.stringify(value, ctx, () => valueCommentDone = true, () => chompKeep = true);
      let ws = " ";
      if (keyComment || vsb || vcb) {
        ws = vsb ? "\n" : "";
        if (vcb) {
          const cs = commentString(vcb);
          ws += `
${stringifyComment.indentComment(cs, ctx.indent)}`;
        }
        if (valueStr === "" && !ctx.inFlow) {
          if (ws === "\n" && valueComment)
            ws = "\n\n";
        } else {
          ws += `
${ctx.indent}`;
        }
      } else if (!explicitKey && identity.isCollection(value)) {
        const vs0 = valueStr[0];
        const nl0 = valueStr.indexOf("\n");
        const hasNewline = nl0 !== -1;
        const flow = ctx.inFlow ?? value.flow ?? value.items.length === 0;
        if (hasNewline || !flow) {
          let hasPropsLine = false;
          if (hasNewline && (vs0 === "&" || vs0 === "!")) {
            let sp0 = valueStr.indexOf(" ");
            if (vs0 === "&" && sp0 !== -1 && sp0 < nl0 && valueStr[sp0 + 1] === "!") {
              sp0 = valueStr.indexOf(" ", sp0 + 1);
            }
            if (sp0 === -1 || nl0 < sp0)
              hasPropsLine = true;
          }
          if (!hasPropsLine)
            ws = `
${ctx.indent}`;
        }
      } else if (valueStr === "" || valueStr[0] === "\n") {
        ws = "";
      }
      str += ws + valueStr;
      if (ctx.inFlow) {
        if (valueCommentDone && onComment)
          onComment();
      } else if (valueComment && !valueCommentDone) {
        str += stringifyComment.lineComment(str, ctx.indent, commentString(valueComment));
      } else if (chompKeep && onChompKeep) {
        onChompKeep();
      }
      return str;
    }
    exports.stringifyPair = stringifyPair;
  }
});

// ../../node_modules/yaml/dist/log.js
var require_log = __commonJS({
  "../../node_modules/yaml/dist/log.js"(exports) {
    "use strict";
    var node_process = __require("process");
    function debug(logLevel, ...messages) {
      if (logLevel === "debug")
        console.log(...messages);
    }
    function warn(logLevel, warning) {
      if (logLevel === "debug" || logLevel === "warn") {
        if (typeof node_process.emitWarning === "function")
          node_process.emitWarning(warning);
        else
          console.warn(warning);
      }
    }
    exports.debug = debug;
    exports.warn = warn;
  }
});

// ../../node_modules/yaml/dist/schema/yaml-1.1/merge.js
var require_merge = __commonJS({
  "../../node_modules/yaml/dist/schema/yaml-1.1/merge.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Scalar = require_Scalar();
    var MERGE_KEY = "<<";
    var merge = {
      identify: (value) => value === MERGE_KEY || typeof value === "symbol" && value.description === MERGE_KEY,
      default: "key",
      tag: "tag:yaml.org,2002:merge",
      test: /^<<$/,
      resolve: () => Object.assign(new Scalar.Scalar(Symbol(MERGE_KEY)), {
        addToJSMap: addMergeToJSMap
      }),
      stringify: () => MERGE_KEY
    };
    var isMergeKey = (ctx, key) => (merge.identify(key) || identity.isScalar(key) && (!key.type || key.type === Scalar.Scalar.PLAIN) && merge.identify(key.value)) && ctx?.doc.schema.tags.some((tag) => tag.tag === merge.tag && tag.default);
    function addMergeToJSMap(ctx, map, value) {
      const source = resolveAliasValue(ctx, value);
      if (identity.isSeq(source))
        for (const it of source.items)
          mergeValue(ctx, map, it);
      else if (Array.isArray(source))
        for (const it of source)
          mergeValue(ctx, map, it);
      else
        mergeValue(ctx, map, source);
    }
    function mergeValue(ctx, map, value) {
      const source = resolveAliasValue(ctx, value);
      if (!identity.isMap(source))
        throw new Error("Merge sources must be maps or map aliases");
      const srcMap = source.toJSON(null, ctx, Map);
      for (const [key, value2] of srcMap) {
        if (map instanceof Map) {
          if (!map.has(key))
            map.set(key, value2);
        } else if (map instanceof Set) {
          map.add(key);
        } else if (!Object.prototype.hasOwnProperty.call(map, key)) {
          Object.defineProperty(map, key, {
            value: value2,
            writable: true,
            enumerable: true,
            configurable: true
          });
        }
      }
      return map;
    }
    function resolveAliasValue(ctx, value) {
      return ctx && identity.isAlias(value) ? value.resolve(ctx.doc, ctx) : value;
    }
    exports.addMergeToJSMap = addMergeToJSMap;
    exports.isMergeKey = isMergeKey;
    exports.merge = merge;
  }
});

// ../../node_modules/yaml/dist/nodes/addPairToJSMap.js
var require_addPairToJSMap = __commonJS({
  "../../node_modules/yaml/dist/nodes/addPairToJSMap.js"(exports) {
    "use strict";
    var log = require_log();
    var merge = require_merge();
    var stringify = require_stringify();
    var identity = require_identity();
    var toJS = require_toJS();
    function addPairToJSMap(ctx, map, { key, value }) {
      if (identity.isNode(key) && key.addToJSMap)
        key.addToJSMap(ctx, map, value);
      else if (merge.isMergeKey(ctx, key))
        merge.addMergeToJSMap(ctx, map, value);
      else {
        const jsKey = toJS.toJS(key, "", ctx);
        if (map instanceof Map) {
          map.set(jsKey, toJS.toJS(value, jsKey, ctx));
        } else if (map instanceof Set) {
          map.add(jsKey);
        } else {
          const stringKey = stringifyKey(key, jsKey, ctx);
          const jsValue = toJS.toJS(value, stringKey, ctx);
          if (stringKey in map)
            Object.defineProperty(map, stringKey, {
              value: jsValue,
              writable: true,
              enumerable: true,
              configurable: true
            });
          else
            map[stringKey] = jsValue;
        }
      }
      return map;
    }
    function stringifyKey(key, jsKey, ctx) {
      if (jsKey === null)
        return "";
      if (typeof jsKey !== "object")
        return String(jsKey);
      if (identity.isNode(key) && ctx?.doc) {
        const strCtx = stringify.createStringifyContext(ctx.doc, {});
        strCtx.anchors = /* @__PURE__ */ new Set();
        for (const node of ctx.anchors.keys())
          strCtx.anchors.add(node.anchor);
        strCtx.inFlow = true;
        strCtx.inStringifyKey = true;
        const strKey = key.toString(strCtx);
        if (!ctx.mapKeyWarned) {
          let jsonStr = JSON.stringify(strKey);
          if (jsonStr.length > 40)
            jsonStr = jsonStr.substring(0, 36) + '..."';
          log.warn(ctx.doc.options.logLevel, `Keys with collection values will be stringified due to JS Object restrictions: ${jsonStr}. Set mapAsMap: true to use object keys.`);
          ctx.mapKeyWarned = true;
        }
        return strKey;
      }
      return JSON.stringify(jsKey);
    }
    exports.addPairToJSMap = addPairToJSMap;
  }
});

// ../../node_modules/yaml/dist/nodes/Pair.js
var require_Pair = __commonJS({
  "../../node_modules/yaml/dist/nodes/Pair.js"(exports) {
    "use strict";
    var createNode = require_createNode();
    var stringifyPair = require_stringifyPair();
    var addPairToJSMap = require_addPairToJSMap();
    var identity = require_identity();
    function createPair(key, value, ctx) {
      const k = createNode.createNode(key, void 0, ctx);
      const v = createNode.createNode(value, void 0, ctx);
      return new Pair(k, v);
    }
    var Pair = class _Pair {
      constructor(key, value = null) {
        Object.defineProperty(this, identity.NODE_TYPE, { value: identity.PAIR });
        this.key = key;
        this.value = value;
      }
      clone(schema) {
        let { key, value } = this;
        if (identity.isNode(key))
          key = key.clone(schema);
        if (identity.isNode(value))
          value = value.clone(schema);
        return new _Pair(key, value);
      }
      toJSON(_, ctx) {
        const pair = ctx?.mapAsMap ? /* @__PURE__ */ new Map() : {};
        return addPairToJSMap.addPairToJSMap(ctx, pair, this);
      }
      toString(ctx, onComment, onChompKeep) {
        return ctx?.doc ? stringifyPair.stringifyPair(this, ctx, onComment, onChompKeep) : JSON.stringify(this);
      }
    };
    exports.Pair = Pair;
    exports.createPair = createPair;
  }
});

// ../../node_modules/yaml/dist/stringify/stringifyCollection.js
var require_stringifyCollection = __commonJS({
  "../../node_modules/yaml/dist/stringify/stringifyCollection.js"(exports) {
    "use strict";
    var identity = require_identity();
    var stringify = require_stringify();
    var stringifyComment = require_stringifyComment();
    function stringifyCollection(collection, ctx, options) {
      const flow = ctx.inFlow ?? collection.flow;
      const stringify2 = flow ? stringifyFlowCollection : stringifyBlockCollection;
      return stringify2(collection, ctx, options);
    }
    function stringifyBlockCollection({ comment, items }, ctx, { blockItemPrefix, flowChars, itemIndent, onChompKeep, onComment }) {
      const { indent, options: { commentString } } = ctx;
      const itemCtx = Object.assign({}, ctx, { indent: itemIndent, type: null });
      let chompKeep = false;
      const lines = [];
      for (let i = 0; i < items.length; ++i) {
        const item = items[i];
        let comment2 = null;
        if (identity.isNode(item)) {
          if (!chompKeep && item.spaceBefore)
            lines.push("");
          addCommentBefore(ctx, lines, item.commentBefore, chompKeep);
          if (item.comment)
            comment2 = item.comment;
        } else if (identity.isPair(item)) {
          const ik = identity.isNode(item.key) ? item.key : null;
          if (ik) {
            if (!chompKeep && ik.spaceBefore)
              lines.push("");
            addCommentBefore(ctx, lines, ik.commentBefore, chompKeep);
          }
        }
        chompKeep = false;
        let str2 = stringify.stringify(item, itemCtx, () => comment2 = null, () => chompKeep = true);
        if (comment2)
          str2 += stringifyComment.lineComment(str2, itemIndent, commentString(comment2));
        if (chompKeep && comment2)
          chompKeep = false;
        lines.push(blockItemPrefix + str2);
      }
      let str;
      if (lines.length === 0) {
        str = flowChars.start + flowChars.end;
      } else {
        str = lines[0];
        for (let i = 1; i < lines.length; ++i) {
          const line = lines[i];
          str += line ? `
${indent}${line}` : "\n";
        }
      }
      if (comment) {
        str += "\n" + stringifyComment.indentComment(commentString(comment), indent);
        if (onComment)
          onComment();
      } else if (chompKeep && onChompKeep)
        onChompKeep();
      return str;
    }
    function stringifyFlowCollection({ items }, ctx, { flowChars, itemIndent }) {
      const { indent, indentStep, flowCollectionPadding: fcPadding, options: { commentString } } = ctx;
      itemIndent += indentStep;
      const itemCtx = Object.assign({}, ctx, {
        indent: itemIndent,
        inFlow: true,
        type: null
      });
      let reqNewline = false;
      let linesAtValue = 0;
      const lines = [];
      for (let i = 0; i < items.length; ++i) {
        const item = items[i];
        let comment = null;
        if (identity.isNode(item)) {
          if (item.spaceBefore)
            lines.push("");
          addCommentBefore(ctx, lines, item.commentBefore, false);
          if (item.comment)
            comment = item.comment;
        } else if (identity.isPair(item)) {
          const ik = identity.isNode(item.key) ? item.key : null;
          if (ik) {
            if (ik.spaceBefore)
              lines.push("");
            addCommentBefore(ctx, lines, ik.commentBefore, false);
            if (ik.comment)
              reqNewline = true;
          }
          const iv = identity.isNode(item.value) ? item.value : null;
          if (iv) {
            if (iv.comment)
              comment = iv.comment;
            if (iv.commentBefore)
              reqNewline = true;
          } else if (item.value == null && ik?.comment) {
            comment = ik.comment;
          }
        }
        if (comment)
          reqNewline = true;
        let str = stringify.stringify(item, itemCtx, () => comment = null);
        reqNewline || (reqNewline = lines.length > linesAtValue || str.includes("\n"));
        if (i < items.length - 1) {
          str += ",";
        } else if (ctx.options.trailingComma) {
          if (ctx.options.lineWidth > 0) {
            reqNewline || (reqNewline = lines.reduce((sum, line) => sum + line.length + 2, 2) + (str.length + 2) > ctx.options.lineWidth);
          }
          if (reqNewline) {
            str += ",";
          }
        }
        if (comment)
          str += stringifyComment.lineComment(str, itemIndent, commentString(comment));
        lines.push(str);
        linesAtValue = lines.length;
      }
      const { start, end } = flowChars;
      if (lines.length === 0) {
        return start + end;
      } else {
        if (!reqNewline) {
          const len = lines.reduce((sum, line) => sum + line.length + 2, 2);
          reqNewline = ctx.options.lineWidth > 0 && len > ctx.options.lineWidth;
        }
        if (reqNewline) {
          let str = start;
          for (const line of lines)
            str += line ? `
${indentStep}${indent}${line}` : "\n";
          return `${str}
${indent}${end}`;
        } else {
          return `${start}${fcPadding}${lines.join(" ")}${fcPadding}${end}`;
        }
      }
    }
    function addCommentBefore({ indent, options: { commentString } }, lines, comment, chompKeep) {
      if (comment && chompKeep)
        comment = comment.replace(/^\n+/, "");
      if (comment) {
        const ic = stringifyComment.indentComment(commentString(comment), indent);
        lines.push(ic.trimStart());
      }
    }
    exports.stringifyCollection = stringifyCollection;
  }
});

// ../../node_modules/yaml/dist/nodes/YAMLMap.js
var require_YAMLMap = __commonJS({
  "../../node_modules/yaml/dist/nodes/YAMLMap.js"(exports) {
    "use strict";
    var stringifyCollection = require_stringifyCollection();
    var addPairToJSMap = require_addPairToJSMap();
    var Collection = require_Collection();
    var identity = require_identity();
    var Pair = require_Pair();
    var Scalar = require_Scalar();
    function findPair(items, key) {
      const k = identity.isScalar(key) ? key.value : key;
      for (const it of items) {
        if (identity.isPair(it)) {
          if (it.key === key || it.key === k)
            return it;
          if (identity.isScalar(it.key) && it.key.value === k)
            return it;
        }
      }
      return void 0;
    }
    var YAMLMap = class extends Collection.Collection {
      static get tagName() {
        return "tag:yaml.org,2002:map";
      }
      constructor(schema) {
        super(identity.MAP, schema);
        this.items = [];
      }
      /**
       * A generic collection parsing method that can be extended
       * to other node classes that inherit from YAMLMap
       */
      static from(schema, obj, ctx) {
        const { keepUndefined, replacer } = ctx;
        const map = new this(schema);
        const add = (key, value) => {
          if (typeof replacer === "function")
            value = replacer.call(obj, key, value);
          else if (Array.isArray(replacer) && !replacer.includes(key))
            return;
          if (value !== void 0 || keepUndefined)
            map.items.push(Pair.createPair(key, value, ctx));
        };
        if (obj instanceof Map) {
          for (const [key, value] of obj)
            add(key, value);
        } else if (obj && typeof obj === "object") {
          for (const key of Object.keys(obj))
            add(key, obj[key]);
        }
        if (typeof schema.sortMapEntries === "function") {
          map.items.sort(schema.sortMapEntries);
        }
        return map;
      }
      /**
       * Adds a value to the collection.
       *
       * @param overwrite - If not set `true`, using a key that is already in the
       *   collection will throw. Otherwise, overwrites the previous value.
       */
      add(pair, overwrite) {
        let _pair;
        if (identity.isPair(pair))
          _pair = pair;
        else if (!pair || typeof pair !== "object" || !("key" in pair)) {
          _pair = new Pair.Pair(pair, pair?.value);
        } else
          _pair = new Pair.Pair(pair.key, pair.value);
        const prev = findPair(this.items, _pair.key);
        const sortEntries = this.schema?.sortMapEntries;
        if (prev) {
          if (!overwrite)
            throw new Error(`Key ${_pair.key} already set`);
          if (identity.isScalar(prev.value) && Scalar.isScalarValue(_pair.value))
            prev.value.value = _pair.value;
          else
            prev.value = _pair.value;
        } else if (sortEntries) {
          const i = this.items.findIndex((item) => sortEntries(_pair, item) < 0);
          if (i === -1)
            this.items.push(_pair);
          else
            this.items.splice(i, 0, _pair);
        } else {
          this.items.push(_pair);
        }
      }
      delete(key) {
        const it = findPair(this.items, key);
        if (!it)
          return false;
        const del = this.items.splice(this.items.indexOf(it), 1);
        return del.length > 0;
      }
      get(key, keepScalar) {
        const it = findPair(this.items, key);
        const node = it?.value;
        return (!keepScalar && identity.isScalar(node) ? node.value : node) ?? void 0;
      }
      has(key) {
        return !!findPair(this.items, key);
      }
      set(key, value) {
        this.add(new Pair.Pair(key, value), true);
      }
      /**
       * @param ctx - Conversion context, originally set in Document#toJS()
       * @param {Class} Type - If set, forces the returned collection type
       * @returns Instance of Type, Map, or Object
       */
      toJSON(_, ctx, Type) {
        const map = Type ? new Type() : ctx?.mapAsMap ? /* @__PURE__ */ new Map() : {};
        if (ctx?.onCreate)
          ctx.onCreate(map);
        for (const item of this.items)
          addPairToJSMap.addPairToJSMap(ctx, map, item);
        return map;
      }
      toString(ctx, onComment, onChompKeep) {
        if (!ctx)
          return JSON.stringify(this);
        for (const item of this.items) {
          if (!identity.isPair(item))
            throw new Error(`Map items must all be pairs; found ${JSON.stringify(item)} instead`);
        }
        if (!ctx.allNullValues && this.hasAllNullValues(false))
          ctx = Object.assign({}, ctx, { allNullValues: true });
        return stringifyCollection.stringifyCollection(this, ctx, {
          blockItemPrefix: "",
          flowChars: { start: "{", end: "}" },
          itemIndent: ctx.indent || "",
          onChompKeep,
          onComment
        });
      }
    };
    exports.YAMLMap = YAMLMap;
    exports.findPair = findPair;
  }
});

// ../../node_modules/yaml/dist/schema/common/map.js
var require_map = __commonJS({
  "../../node_modules/yaml/dist/schema/common/map.js"(exports) {
    "use strict";
    var identity = require_identity();
    var YAMLMap = require_YAMLMap();
    var map = {
      collection: "map",
      default: true,
      nodeClass: YAMLMap.YAMLMap,
      tag: "tag:yaml.org,2002:map",
      resolve(map2, onError) {
        if (!identity.isMap(map2))
          onError("Expected a mapping for this tag");
        return map2;
      },
      createNode: (schema, obj, ctx) => YAMLMap.YAMLMap.from(schema, obj, ctx)
    };
    exports.map = map;
  }
});

// ../../node_modules/yaml/dist/nodes/YAMLSeq.js
var require_YAMLSeq = __commonJS({
  "../../node_modules/yaml/dist/nodes/YAMLSeq.js"(exports) {
    "use strict";
    var createNode = require_createNode();
    var stringifyCollection = require_stringifyCollection();
    var Collection = require_Collection();
    var identity = require_identity();
    var Scalar = require_Scalar();
    var toJS = require_toJS();
    var YAMLSeq = class extends Collection.Collection {
      static get tagName() {
        return "tag:yaml.org,2002:seq";
      }
      constructor(schema) {
        super(identity.SEQ, schema);
        this.items = [];
      }
      add(value) {
        this.items.push(value);
      }
      /**
       * Removes a value from the collection.
       *
       * `key` must contain a representation of an integer for this to succeed.
       * It may be wrapped in a `Scalar`.
       *
       * @returns `true` if the item was found and removed.
       */
      delete(key) {
        const idx = asItemIndex(key);
        if (typeof idx !== "number")
          return false;
        const del = this.items.splice(idx, 1);
        return del.length > 0;
      }
      get(key, keepScalar) {
        const idx = asItemIndex(key);
        if (typeof idx !== "number")
          return void 0;
        const it = this.items[idx];
        return !keepScalar && identity.isScalar(it) ? it.value : it;
      }
      /**
       * Checks if the collection includes a value with the key `key`.
       *
       * `key` must contain a representation of an integer for this to succeed.
       * It may be wrapped in a `Scalar`.
       */
      has(key) {
        const idx = asItemIndex(key);
        return typeof idx === "number" && idx < this.items.length;
      }
      /**
       * Sets a value in this collection. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       *
       * If `key` does not contain a representation of an integer, this will throw.
       * It may be wrapped in a `Scalar`.
       */
      set(key, value) {
        const idx = asItemIndex(key);
        if (typeof idx !== "number")
          throw new Error(`Expected a valid index, not ${key}.`);
        const prev = this.items[idx];
        if (identity.isScalar(prev) && Scalar.isScalarValue(value))
          prev.value = value;
        else
          this.items[idx] = value;
      }
      toJSON(_, ctx) {
        const seq = [];
        if (ctx?.onCreate)
          ctx.onCreate(seq);
        let i = 0;
        for (const item of this.items)
          seq.push(toJS.toJS(item, String(i++), ctx));
        return seq;
      }
      toString(ctx, onComment, onChompKeep) {
        if (!ctx)
          return JSON.stringify(this);
        return stringifyCollection.stringifyCollection(this, ctx, {
          blockItemPrefix: "- ",
          flowChars: { start: "[", end: "]" },
          itemIndent: (ctx.indent || "") + "  ",
          onChompKeep,
          onComment
        });
      }
      static from(schema, obj, ctx) {
        const { replacer } = ctx;
        const seq = new this(schema);
        if (obj && Symbol.iterator in Object(obj)) {
          let i = 0;
          for (let it of obj) {
            if (typeof replacer === "function") {
              const key = obj instanceof Set ? it : String(i++);
              it = replacer.call(obj, key, it);
            }
            seq.items.push(createNode.createNode(it, void 0, ctx));
          }
        }
        return seq;
      }
    };
    function asItemIndex(key) {
      let idx = identity.isScalar(key) ? key.value : key;
      if (idx && typeof idx === "string")
        idx = Number(idx);
      return typeof idx === "number" && Number.isInteger(idx) && idx >= 0 ? idx : null;
    }
    exports.YAMLSeq = YAMLSeq;
  }
});

// ../../node_modules/yaml/dist/schema/common/seq.js
var require_seq = __commonJS({
  "../../node_modules/yaml/dist/schema/common/seq.js"(exports) {
    "use strict";
    var identity = require_identity();
    var YAMLSeq = require_YAMLSeq();
    var seq = {
      collection: "seq",
      default: true,
      nodeClass: YAMLSeq.YAMLSeq,
      tag: "tag:yaml.org,2002:seq",
      resolve(seq2, onError) {
        if (!identity.isSeq(seq2))
          onError("Expected a sequence for this tag");
        return seq2;
      },
      createNode: (schema, obj, ctx) => YAMLSeq.YAMLSeq.from(schema, obj, ctx)
    };
    exports.seq = seq;
  }
});

// ../../node_modules/yaml/dist/schema/common/string.js
var require_string = __commonJS({
  "../../node_modules/yaml/dist/schema/common/string.js"(exports) {
    "use strict";
    var stringifyString = require_stringifyString();
    var string = {
      identify: (value) => typeof value === "string",
      default: true,
      tag: "tag:yaml.org,2002:str",
      resolve: (str) => str,
      stringify(item, ctx, onComment, onChompKeep) {
        ctx = Object.assign({ actualString: true }, ctx);
        return stringifyString.stringifyString(item, ctx, onComment, onChompKeep);
      }
    };
    exports.string = string;
  }
});

// ../../node_modules/yaml/dist/schema/common/null.js
var require_null = __commonJS({
  "../../node_modules/yaml/dist/schema/common/null.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var nullTag = {
      identify: (value) => value == null,
      createNode: () => new Scalar.Scalar(null),
      default: true,
      tag: "tag:yaml.org,2002:null",
      test: /^(?:~|[Nn]ull|NULL)?$/,
      resolve: () => new Scalar.Scalar(null),
      stringify: ({ source }, ctx) => typeof source === "string" && nullTag.test.test(source) ? source : ctx.options.nullStr
    };
    exports.nullTag = nullTag;
  }
});

// ../../node_modules/yaml/dist/schema/core/bool.js
var require_bool = __commonJS({
  "../../node_modules/yaml/dist/schema/core/bool.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var boolTag = {
      identify: (value) => typeof value === "boolean",
      default: true,
      tag: "tag:yaml.org,2002:bool",
      test: /^(?:[Tt]rue|TRUE|[Ff]alse|FALSE)$/,
      resolve: (str) => new Scalar.Scalar(str[0] === "t" || str[0] === "T"),
      stringify({ source, value }, ctx) {
        if (source && boolTag.test.test(source)) {
          const sv = source[0] === "t" || source[0] === "T";
          if (value === sv)
            return source;
        }
        return value ? ctx.options.trueStr : ctx.options.falseStr;
      }
    };
    exports.boolTag = boolTag;
  }
});

// ../../node_modules/yaml/dist/stringify/stringifyNumber.js
var require_stringifyNumber = __commonJS({
  "../../node_modules/yaml/dist/stringify/stringifyNumber.js"(exports) {
    "use strict";
    function stringifyNumber({ format, minFractionDigits, tag, value }) {
      if (typeof value === "bigint")
        return String(value);
      const num = typeof value === "number" ? value : Number(value);
      if (!isFinite(num))
        return isNaN(num) ? ".nan" : num < 0 ? "-.inf" : ".inf";
      let n = Object.is(value, -0) ? "-0" : JSON.stringify(value);
      if (!format && minFractionDigits && (!tag || tag === "tag:yaml.org,2002:float") && /^-?\d/.test(n) && !n.includes("e")) {
        let i = n.indexOf(".");
        if (i < 0) {
          i = n.length;
          n += ".";
        }
        let d = minFractionDigits - (n.length - i - 1);
        while (d-- > 0)
          n += "0";
      }
      return n;
    }
    exports.stringifyNumber = stringifyNumber;
  }
});

// ../../node_modules/yaml/dist/schema/core/float.js
var require_float = __commonJS({
  "../../node_modules/yaml/dist/schema/core/float.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var stringifyNumber = require_stringifyNumber();
    var floatNaN = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,
      resolve: (str) => str.slice(-3).toLowerCase() === "nan" ? NaN : str[0] === "-" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY,
      stringify: stringifyNumber.stringifyNumber
    };
    var floatExp = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      format: "EXP",
      test: /^[-+]?(?:\.[0-9]+|[0-9]+(?:\.[0-9]*)?)[eE][-+]?[0-9]+$/,
      resolve: (str) => parseFloat(str),
      stringify(node) {
        const num = Number(node.value);
        return isFinite(num) ? num.toExponential() : stringifyNumber.stringifyNumber(node);
      }
    };
    var float = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^[-+]?(?:\.[0-9]+|[0-9]+\.[0-9]*)$/,
      resolve(str) {
        const node = new Scalar.Scalar(parseFloat(str));
        const dot = str.indexOf(".");
        if (dot !== -1 && str[str.length - 1] === "0")
          node.minFractionDigits = str.length - dot - 1;
        return node;
      },
      stringify: stringifyNumber.stringifyNumber
    };
    exports.float = float;
    exports.floatExp = floatExp;
    exports.floatNaN = floatNaN;
  }
});

// ../../node_modules/yaml/dist/schema/core/int.js
var require_int = __commonJS({
  "../../node_modules/yaml/dist/schema/core/int.js"(exports) {
    "use strict";
    var stringifyNumber = require_stringifyNumber();
    var intIdentify = (value) => typeof value === "bigint" || Number.isInteger(value);
    var intResolve = (str, offset, radix, { intAsBigInt }) => intAsBigInt ? BigInt(str) : parseInt(str.substring(offset), radix);
    function intStringify(node, radix, prefix) {
      const { value } = node;
      if (intIdentify(value) && value >= 0)
        return prefix + value.toString(radix);
      return stringifyNumber.stringifyNumber(node);
    }
    var intOct = {
      identify: (value) => intIdentify(value) && value >= 0,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "OCT",
      test: /^0o[0-7]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 2, 8, opt),
      stringify: (node) => intStringify(node, 8, "0o")
    };
    var int = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      test: /^[-+]?[0-9]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 0, 10, opt),
      stringify: stringifyNumber.stringifyNumber
    };
    var intHex = {
      identify: (value) => intIdentify(value) && value >= 0,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "HEX",
      test: /^0x[0-9a-fA-F]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 2, 16, opt),
      stringify: (node) => intStringify(node, 16, "0x")
    };
    exports.int = int;
    exports.intHex = intHex;
    exports.intOct = intOct;
  }
});

// ../../node_modules/yaml/dist/schema/core/schema.js
var require_schema = __commonJS({
  "../../node_modules/yaml/dist/schema/core/schema.js"(exports) {
    "use strict";
    var map = require_map();
    var _null = require_null();
    var seq = require_seq();
    var string = require_string();
    var bool = require_bool();
    var float = require_float();
    var int = require_int();
    var schema = [
      map.map,
      seq.seq,
      string.string,
      _null.nullTag,
      bool.boolTag,
      int.intOct,
      int.int,
      int.intHex,
      float.floatNaN,
      float.floatExp,
      float.float
    ];
    exports.schema = schema;
  }
});

// ../../node_modules/yaml/dist/schema/json/schema.js
var require_schema2 = __commonJS({
  "../../node_modules/yaml/dist/schema/json/schema.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var map = require_map();
    var seq = require_seq();
    function intIdentify(value) {
      return typeof value === "bigint" || Number.isInteger(value);
    }
    var stringifyJSON = ({ value }) => JSON.stringify(value);
    var jsonScalars = [
      {
        identify: (value) => typeof value === "string",
        default: true,
        tag: "tag:yaml.org,2002:str",
        resolve: (str) => str,
        stringify: stringifyJSON
      },
      {
        identify: (value) => value == null,
        createNode: () => new Scalar.Scalar(null),
        default: true,
        tag: "tag:yaml.org,2002:null",
        test: /^null$/,
        resolve: () => null,
        stringify: stringifyJSON
      },
      {
        identify: (value) => typeof value === "boolean",
        default: true,
        tag: "tag:yaml.org,2002:bool",
        test: /^true$|^false$/,
        resolve: (str) => str === "true",
        stringify: stringifyJSON
      },
      {
        identify: intIdentify,
        default: true,
        tag: "tag:yaml.org,2002:int",
        test: /^-?(?:0|[1-9][0-9]*)$/,
        resolve: (str, _onError, { intAsBigInt }) => intAsBigInt ? BigInt(str) : parseInt(str, 10),
        stringify: ({ value }) => intIdentify(value) ? value.toString() : JSON.stringify(value)
      },
      {
        identify: (value) => typeof value === "number",
        default: true,
        tag: "tag:yaml.org,2002:float",
        test: /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]*)?(?:[eE][-+]?[0-9]+)?$/,
        resolve: (str) => parseFloat(str),
        stringify: stringifyJSON
      }
    ];
    var jsonError = {
      default: true,
      tag: "",
      test: /^/,
      resolve(str, onError) {
        onError(`Unresolved plain scalar ${JSON.stringify(str)}`);
        return str;
      }
    };
    var schema = [map.map, seq.seq].concat(jsonScalars, jsonError);
    exports.schema = schema;
  }
});

// ../../node_modules/yaml/dist/schema/yaml-1.1/binary.js
var require_binary = __commonJS({
  "../../node_modules/yaml/dist/schema/yaml-1.1/binary.js"(exports) {
    "use strict";
    var node_buffer = __require("buffer");
    var Scalar = require_Scalar();
    var stringifyString = require_stringifyString();
    var binary = {
      identify: (value) => value instanceof Uint8Array,
      // Buffer inherits from Uint8Array
      default: false,
      tag: "tag:yaml.org,2002:binary",
      /**
       * Returns a Buffer in node and an Uint8Array in browsers
       *
       * To use the resulting buffer as an image, you'll want to do something like:
       *
       *   const blob = new Blob([buffer], { type: 'image/jpeg' })
       *   document.querySelector('#photo').src = URL.createObjectURL(blob)
       */
      resolve(src, onError) {
        if (typeof node_buffer.Buffer === "function") {
          return node_buffer.Buffer.from(src, "base64");
        } else if (typeof atob === "function") {
          const str = atob(src.replace(/[\n\r]/g, ""));
          const buffer = new Uint8Array(str.length);
          for (let i = 0; i < str.length; ++i)
            buffer[i] = str.charCodeAt(i);
          return buffer;
        } else {
          onError("This environment does not support reading binary tags; either Buffer or atob is required");
          return src;
        }
      },
      stringify({ comment, type, value }, ctx, onComment, onChompKeep) {
        if (!value)
          return "";
        const buf = value;
        let str;
        if (typeof node_buffer.Buffer === "function") {
          str = buf instanceof node_buffer.Buffer ? buf.toString("base64") : node_buffer.Buffer.from(buf.buffer).toString("base64");
        } else if (typeof btoa === "function") {
          let s = "";
          for (let i = 0; i < buf.length; ++i)
            s += String.fromCharCode(buf[i]);
          str = btoa(s);
        } else {
          throw new Error("This environment does not support writing binary tags; either Buffer or btoa is required");
        }
        type ?? (type = Scalar.Scalar.BLOCK_LITERAL);
        if (type !== Scalar.Scalar.QUOTE_DOUBLE) {
          const lineWidth = Math.max(ctx.options.lineWidth - ctx.indent.length, ctx.options.minContentWidth);
          const n = Math.ceil(str.length / lineWidth);
          const lines = new Array(n);
          for (let i = 0, o = 0; i < n; ++i, o += lineWidth) {
            lines[i] = str.substr(o, lineWidth);
          }
          str = lines.join(type === Scalar.Scalar.BLOCK_LITERAL ? "\n" : " ");
        }
        return stringifyString.stringifyString({ comment, type, value: str }, ctx, onComment, onChompKeep);
      }
    };
    exports.binary = binary;
  }
});

// ../../node_modules/yaml/dist/schema/yaml-1.1/pairs.js
var require_pairs = __commonJS({
  "../../node_modules/yaml/dist/schema/yaml-1.1/pairs.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Pair = require_Pair();
    var Scalar = require_Scalar();
    var YAMLSeq = require_YAMLSeq();
    function resolvePairs(seq, onError) {
      if (identity.isSeq(seq)) {
        for (let i = 0; i < seq.items.length; ++i) {
          let item = seq.items[i];
          if (identity.isPair(item))
            continue;
          else if (identity.isMap(item)) {
            if (item.items.length > 1)
              onError("Each pair must have its own sequence indicator");
            const pair = item.items[0] || new Pair.Pair(new Scalar.Scalar(null));
            if (item.commentBefore)
              pair.key.commentBefore = pair.key.commentBefore ? `${item.commentBefore}
${pair.key.commentBefore}` : item.commentBefore;
            if (item.comment) {
              const cn = pair.value ?? pair.key;
              cn.comment = cn.comment ? `${item.comment}
${cn.comment}` : item.comment;
            }
            item = pair;
          }
          seq.items[i] = identity.isPair(item) ? item : new Pair.Pair(item);
        }
      } else
        onError("Expected a sequence for this tag");
      return seq;
    }
    function createPairs(schema, iterable, ctx) {
      const { replacer } = ctx;
      const pairs2 = new YAMLSeq.YAMLSeq(schema);
      pairs2.tag = "tag:yaml.org,2002:pairs";
      let i = 0;
      if (iterable && Symbol.iterator in Object(iterable))
        for (let it of iterable) {
          if (typeof replacer === "function")
            it = replacer.call(iterable, String(i++), it);
          let key, value;
          if (Array.isArray(it)) {
            if (it.length === 2) {
              key = it[0];
              value = it[1];
            } else
              throw new TypeError(`Expected [key, value] tuple: ${it}`);
          } else if (it && it instanceof Object) {
            const keys = Object.keys(it);
            if (keys.length === 1) {
              key = keys[0];
              value = it[key];
            } else {
              throw new TypeError(`Expected tuple with one key, not ${keys.length} keys`);
            }
          } else {
            key = it;
          }
          pairs2.items.push(Pair.createPair(key, value, ctx));
        }
      return pairs2;
    }
    var pairs = {
      collection: "seq",
      default: false,
      tag: "tag:yaml.org,2002:pairs",
      resolve: resolvePairs,
      createNode: createPairs
    };
    exports.createPairs = createPairs;
    exports.pairs = pairs;
    exports.resolvePairs = resolvePairs;
  }
});

// ../../node_modules/yaml/dist/schema/yaml-1.1/omap.js
var require_omap = __commonJS({
  "../../node_modules/yaml/dist/schema/yaml-1.1/omap.js"(exports) {
    "use strict";
    var identity = require_identity();
    var toJS = require_toJS();
    var YAMLMap = require_YAMLMap();
    var YAMLSeq = require_YAMLSeq();
    var pairs = require_pairs();
    var YAMLOMap = class _YAMLOMap extends YAMLSeq.YAMLSeq {
      constructor() {
        super();
        this.add = YAMLMap.YAMLMap.prototype.add.bind(this);
        this.delete = YAMLMap.YAMLMap.prototype.delete.bind(this);
        this.get = YAMLMap.YAMLMap.prototype.get.bind(this);
        this.has = YAMLMap.YAMLMap.prototype.has.bind(this);
        this.set = YAMLMap.YAMLMap.prototype.set.bind(this);
        this.tag = _YAMLOMap.tag;
      }
      /**
       * If `ctx` is given, the return type is actually `Map<unknown, unknown>`,
       * but TypeScript won't allow widening the signature of a child method.
       */
      toJSON(_, ctx) {
        if (!ctx)
          return super.toJSON(_);
        const map = /* @__PURE__ */ new Map();
        if (ctx?.onCreate)
          ctx.onCreate(map);
        for (const pair of this.items) {
          let key, value;
          if (identity.isPair(pair)) {
            key = toJS.toJS(pair.key, "", ctx);
            value = toJS.toJS(pair.value, key, ctx);
          } else {
            key = toJS.toJS(pair, "", ctx);
          }
          if (map.has(key))
            throw new Error("Ordered maps must not include duplicate keys");
          map.set(key, value);
        }
        return map;
      }
      static from(schema, iterable, ctx) {
        const pairs$1 = pairs.createPairs(schema, iterable, ctx);
        const omap2 = new this();
        omap2.items = pairs$1.items;
        return omap2;
      }
    };
    YAMLOMap.tag = "tag:yaml.org,2002:omap";
    var omap = {
      collection: "seq",
      identify: (value) => value instanceof Map,
      nodeClass: YAMLOMap,
      default: false,
      tag: "tag:yaml.org,2002:omap",
      resolve(seq, onError) {
        const pairs$1 = pairs.resolvePairs(seq, onError);
        const seenKeys = [];
        for (const { key } of pairs$1.items) {
          if (identity.isScalar(key)) {
            if (seenKeys.includes(key.value)) {
              onError(`Ordered maps must not include duplicate keys: ${key.value}`);
            } else {
              seenKeys.push(key.value);
            }
          }
        }
        return Object.assign(new YAMLOMap(), pairs$1);
      },
      createNode: (schema, iterable, ctx) => YAMLOMap.from(schema, iterable, ctx)
    };
    exports.YAMLOMap = YAMLOMap;
    exports.omap = omap;
  }
});

// ../../node_modules/yaml/dist/schema/yaml-1.1/bool.js
var require_bool2 = __commonJS({
  "../../node_modules/yaml/dist/schema/yaml-1.1/bool.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    function boolStringify({ value, source }, ctx) {
      const boolObj = value ? trueTag : falseTag;
      if (source && boolObj.test.test(source))
        return source;
      return value ? ctx.options.trueStr : ctx.options.falseStr;
    }
    var trueTag = {
      identify: (value) => value === true,
      default: true,
      tag: "tag:yaml.org,2002:bool",
      test: /^(?:Y|y|[Yy]es|YES|[Tt]rue|TRUE|[Oo]n|ON)$/,
      resolve: () => new Scalar.Scalar(true),
      stringify: boolStringify
    };
    var falseTag = {
      identify: (value) => value === false,
      default: true,
      tag: "tag:yaml.org,2002:bool",
      test: /^(?:N|n|[Nn]o|NO|[Ff]alse|FALSE|[Oo]ff|OFF)$/,
      resolve: () => new Scalar.Scalar(false),
      stringify: boolStringify
    };
    exports.falseTag = falseTag;
    exports.trueTag = trueTag;
  }
});

// ../../node_modules/yaml/dist/schema/yaml-1.1/float.js
var require_float2 = __commonJS({
  "../../node_modules/yaml/dist/schema/yaml-1.1/float.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var stringifyNumber = require_stringifyNumber();
    var floatNaN = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,
      resolve: (str) => str.slice(-3).toLowerCase() === "nan" ? NaN : str[0] === "-" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY,
      stringify: stringifyNumber.stringifyNumber
    };
    var floatExp = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      format: "EXP",
      test: /^[-+]?(?:[0-9][0-9_]*)?(?:\.[0-9_]*)?[eE][-+]?[0-9]+$/,
      resolve: (str) => parseFloat(str.replace(/_/g, "")),
      stringify(node) {
        const num = Number(node.value);
        return isFinite(num) ? num.toExponential() : stringifyNumber.stringifyNumber(node);
      }
    };
    var float = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^[-+]?(?:[0-9][0-9_]*)?\.[0-9_]*$/,
      resolve(str) {
        const node = new Scalar.Scalar(parseFloat(str.replace(/_/g, "")));
        const dot = str.indexOf(".");
        if (dot !== -1) {
          const f = str.substring(dot + 1).replace(/_/g, "");
          if (f[f.length - 1] === "0")
            node.minFractionDigits = f.length;
        }
        return node;
      },
      stringify: stringifyNumber.stringifyNumber
    };
    exports.float = float;
    exports.floatExp = floatExp;
    exports.floatNaN = floatNaN;
  }
});

// ../../node_modules/yaml/dist/schema/yaml-1.1/int.js
var require_int2 = __commonJS({
  "../../node_modules/yaml/dist/schema/yaml-1.1/int.js"(exports) {
    "use strict";
    var stringifyNumber = require_stringifyNumber();
    var intIdentify = (value) => typeof value === "bigint" || Number.isInteger(value);
    function intResolve(str, offset, radix, { intAsBigInt }) {
      const sign = str[0];
      if (sign === "-" || sign === "+")
        offset += 1;
      str = str.substring(offset).replace(/_/g, "");
      if (intAsBigInt) {
        switch (radix) {
          case 2:
            str = `0b${str}`;
            break;
          case 8:
            str = `0o${str}`;
            break;
          case 16:
            str = `0x${str}`;
            break;
        }
        const n2 = BigInt(str);
        return sign === "-" ? BigInt(-1) * n2 : n2;
      }
      const n = parseInt(str, radix);
      return sign === "-" ? -1 * n : n;
    }
    function intStringify(node, radix, prefix) {
      const { value } = node;
      if (intIdentify(value)) {
        const str = value.toString(radix);
        return value < 0 ? "-" + prefix + str.substr(1) : prefix + str;
      }
      return stringifyNumber.stringifyNumber(node);
    }
    var intBin = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "BIN",
      test: /^[-+]?0b[0-1_]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 2, 2, opt),
      stringify: (node) => intStringify(node, 2, "0b")
    };
    var intOct = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "OCT",
      test: /^[-+]?0[0-7_]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 1, 8, opt),
      stringify: (node) => intStringify(node, 8, "0")
    };
    var int = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      test: /^[-+]?[0-9][0-9_]*$/,
      resolve: (str, _onError, opt) => intResolve(str, 0, 10, opt),
      stringify: stringifyNumber.stringifyNumber
    };
    var intHex = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "HEX",
      test: /^[-+]?0x[0-9a-fA-F_]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 2, 16, opt),
      stringify: (node) => intStringify(node, 16, "0x")
    };
    exports.int = int;
    exports.intBin = intBin;
    exports.intHex = intHex;
    exports.intOct = intOct;
  }
});

// ../../node_modules/yaml/dist/schema/yaml-1.1/set.js
var require_set = __commonJS({
  "../../node_modules/yaml/dist/schema/yaml-1.1/set.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Pair = require_Pair();
    var YAMLMap = require_YAMLMap();
    var YAMLSet = class _YAMLSet extends YAMLMap.YAMLMap {
      constructor(schema) {
        super(schema);
        this.tag = _YAMLSet.tag;
      }
      add(key) {
        let pair;
        if (identity.isPair(key))
          pair = key;
        else if (key && typeof key === "object" && "key" in key && "value" in key && key.value === null)
          pair = new Pair.Pair(key.key, null);
        else
          pair = new Pair.Pair(key, null);
        const prev = YAMLMap.findPair(this.items, pair.key);
        if (!prev)
          this.items.push(pair);
      }
      /**
       * If `keepPair` is `true`, returns the Pair matching `key`.
       * Otherwise, returns the value of that Pair's key.
       */
      get(key, keepPair) {
        const pair = YAMLMap.findPair(this.items, key);
        return !keepPair && identity.isPair(pair) ? identity.isScalar(pair.key) ? pair.key.value : pair.key : pair;
      }
      set(key, value) {
        if (typeof value !== "boolean")
          throw new Error(`Expected boolean value for set(key, value) in a YAML set, not ${typeof value}`);
        const prev = YAMLMap.findPair(this.items, key);
        if (prev && !value) {
          this.items.splice(this.items.indexOf(prev), 1);
        } else if (!prev && value) {
          this.items.push(new Pair.Pair(key));
        }
      }
      toJSON(_, ctx) {
        return super.toJSON(_, ctx, Set);
      }
      toString(ctx, onComment, onChompKeep) {
        if (!ctx)
          return JSON.stringify(this);
        if (this.hasAllNullValues(true))
          return super.toString(Object.assign({}, ctx, { allNullValues: true }), onComment, onChompKeep);
        else
          throw new Error("Set items must all have null values");
      }
      static from(schema, iterable, ctx) {
        const { replacer } = ctx;
        const set2 = new this(schema);
        if (iterable && Symbol.iterator in Object(iterable))
          for (let value of iterable) {
            if (typeof replacer === "function")
              value = replacer.call(iterable, value, value);
            set2.items.push(Pair.createPair(value, null, ctx));
          }
        return set2;
      }
    };
    YAMLSet.tag = "tag:yaml.org,2002:set";
    var set = {
      collection: "map",
      identify: (value) => value instanceof Set,
      nodeClass: YAMLSet,
      default: false,
      tag: "tag:yaml.org,2002:set",
      createNode: (schema, iterable, ctx) => YAMLSet.from(schema, iterable, ctx),
      resolve(map, onError) {
        if (identity.isMap(map)) {
          if (map.hasAllNullValues(true))
            return Object.assign(new YAMLSet(), map);
          else
            onError("Set items must all have null values");
        } else
          onError("Expected a mapping for this tag");
        return map;
      }
    };
    exports.YAMLSet = YAMLSet;
    exports.set = set;
  }
});

// ../../node_modules/yaml/dist/schema/yaml-1.1/timestamp.js
var require_timestamp = __commonJS({
  "../../node_modules/yaml/dist/schema/yaml-1.1/timestamp.js"(exports) {
    "use strict";
    var stringifyNumber = require_stringifyNumber();
    function parseSexagesimal(str, asBigInt) {
      const sign = str[0];
      const parts = sign === "-" || sign === "+" ? str.substring(1) : str;
      const num = (n) => asBigInt ? BigInt(n) : Number(n);
      const res = parts.replace(/_/g, "").split(":").reduce((res2, p) => res2 * num(60) + num(p), num(0));
      return sign === "-" ? num(-1) * res : res;
    }
    function stringifySexagesimal(node) {
      let { value } = node;
      let num = (n) => n;
      if (typeof value === "bigint")
        num = (n) => BigInt(n);
      else if (isNaN(value) || !isFinite(value))
        return stringifyNumber.stringifyNumber(node);
      let sign = "";
      if (value < 0) {
        sign = "-";
        value *= num(-1);
      }
      const _60 = num(60);
      const parts = [value % _60];
      if (value < 60) {
        parts.unshift(0);
      } else {
        value = (value - parts[0]) / _60;
        parts.unshift(value % _60);
        if (value >= 60) {
          value = (value - parts[0]) / _60;
          parts.unshift(value);
        }
      }
      return sign + parts.map((n) => String(n).padStart(2, "0")).join(":").replace(/000000\d*$/, "");
    }
    var intTime = {
      identify: (value) => typeof value === "bigint" || Number.isInteger(value),
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "TIME",
      test: /^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+$/,
      resolve: (str, _onError, { intAsBigInt }) => parseSexagesimal(str, intAsBigInt),
      stringify: stringifySexagesimal
    };
    var floatTime = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      format: "TIME",
      test: /^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+\.[0-9_]*$/,
      resolve: (str) => parseSexagesimal(str, false),
      stringify: stringifySexagesimal
    };
    var timestamp = {
      identify: (value) => value instanceof Date,
      default: true,
      tag: "tag:yaml.org,2002:timestamp",
      // If the time zone is omitted, the timestamp is assumed to be specified in UTC. The time part
      // may be omitted altogether, resulting in a date format. In such a case, the time part is
      // assumed to be 00:00:00Z (start of day, UTC).
      test: RegExp("^([0-9]{4})-([0-9]{1,2})-([0-9]{1,2})(?:(?:t|T|[ \\t]+)([0-9]{1,2}):([0-9]{1,2}):([0-9]{1,2}(\\.[0-9]+)?)(?:[ \\t]*(Z|[-+][012]?[0-9](?::[0-9]{2})?))?)?$"),
      resolve(str) {
        const match = str.match(timestamp.test);
        if (!match)
          throw new Error("!!timestamp expects a date, starting with yyyy-mm-dd");
        const [, year, month, day, hour, minute, second] = match.map(Number);
        const millisec = match[7] ? Number((match[7] + "00").substr(1, 3)) : 0;
        let date = Date.UTC(year, month - 1, day, hour || 0, minute || 0, second || 0, millisec);
        const tz = match[8];
        if (tz && tz !== "Z") {
          let d = parseSexagesimal(tz, false);
          if (Math.abs(d) < 30)
            d *= 60;
          date -= 6e4 * d;
        }
        return new Date(date);
      },
      stringify: ({ value }) => value?.toISOString().replace(/(T00:00:00)?\.000Z$/, "") ?? ""
    };
    exports.floatTime = floatTime;
    exports.intTime = intTime;
    exports.timestamp = timestamp;
  }
});

// ../../node_modules/yaml/dist/schema/yaml-1.1/schema.js
var require_schema3 = __commonJS({
  "../../node_modules/yaml/dist/schema/yaml-1.1/schema.js"(exports) {
    "use strict";
    var map = require_map();
    var _null = require_null();
    var seq = require_seq();
    var string = require_string();
    var binary = require_binary();
    var bool = require_bool2();
    var float = require_float2();
    var int = require_int2();
    var merge = require_merge();
    var omap = require_omap();
    var pairs = require_pairs();
    var set = require_set();
    var timestamp = require_timestamp();
    var schema = [
      map.map,
      seq.seq,
      string.string,
      _null.nullTag,
      bool.trueTag,
      bool.falseTag,
      int.intBin,
      int.intOct,
      int.int,
      int.intHex,
      float.floatNaN,
      float.floatExp,
      float.float,
      binary.binary,
      merge.merge,
      omap.omap,
      pairs.pairs,
      set.set,
      timestamp.intTime,
      timestamp.floatTime,
      timestamp.timestamp
    ];
    exports.schema = schema;
  }
});

// ../../node_modules/yaml/dist/schema/tags.js
var require_tags = __commonJS({
  "../../node_modules/yaml/dist/schema/tags.js"(exports) {
    "use strict";
    var map = require_map();
    var _null = require_null();
    var seq = require_seq();
    var string = require_string();
    var bool = require_bool();
    var float = require_float();
    var int = require_int();
    var schema = require_schema();
    var schema$1 = require_schema2();
    var binary = require_binary();
    var merge = require_merge();
    var omap = require_omap();
    var pairs = require_pairs();
    var schema$2 = require_schema3();
    var set = require_set();
    var timestamp = require_timestamp();
    var schemas = /* @__PURE__ */ new Map([
      ["core", schema.schema],
      ["failsafe", [map.map, seq.seq, string.string]],
      ["json", schema$1.schema],
      ["yaml11", schema$2.schema],
      ["yaml-1.1", schema$2.schema]
    ]);
    var tagsByName = {
      binary: binary.binary,
      bool: bool.boolTag,
      float: float.float,
      floatExp: float.floatExp,
      floatNaN: float.floatNaN,
      floatTime: timestamp.floatTime,
      int: int.int,
      intHex: int.intHex,
      intOct: int.intOct,
      intTime: timestamp.intTime,
      map: map.map,
      merge: merge.merge,
      null: _null.nullTag,
      omap: omap.omap,
      pairs: pairs.pairs,
      seq: seq.seq,
      set: set.set,
      timestamp: timestamp.timestamp
    };
    var coreKnownTags = {
      "tag:yaml.org,2002:binary": binary.binary,
      "tag:yaml.org,2002:merge": merge.merge,
      "tag:yaml.org,2002:omap": omap.omap,
      "tag:yaml.org,2002:pairs": pairs.pairs,
      "tag:yaml.org,2002:set": set.set,
      "tag:yaml.org,2002:timestamp": timestamp.timestamp
    };
    function getTags(customTags, schemaName, addMergeTag) {
      const schemaTags = schemas.get(schemaName);
      if (schemaTags && !customTags) {
        return addMergeTag && !schemaTags.includes(merge.merge) ? schemaTags.concat(merge.merge) : schemaTags.slice();
      }
      let tags = schemaTags;
      if (!tags) {
        if (Array.isArray(customTags))
          tags = [];
        else {
          const keys = Array.from(schemas.keys()).filter((key) => key !== "yaml11").map((key) => JSON.stringify(key)).join(", ");
          throw new Error(`Unknown schema "${schemaName}"; use one of ${keys} or define customTags array`);
        }
      }
      if (Array.isArray(customTags)) {
        for (const tag of customTags)
          tags = tags.concat(tag);
      } else if (typeof customTags === "function") {
        tags = customTags(tags.slice());
      }
      if (addMergeTag)
        tags = tags.concat(merge.merge);
      return tags.reduce((tags2, tag) => {
        const tagObj = typeof tag === "string" ? tagsByName[tag] : tag;
        if (!tagObj) {
          const tagName = JSON.stringify(tag);
          const keys = Object.keys(tagsByName).map((key) => JSON.stringify(key)).join(", ");
          throw new Error(`Unknown custom tag ${tagName}; use one of ${keys}`);
        }
        if (!tags2.includes(tagObj))
          tags2.push(tagObj);
        return tags2;
      }, []);
    }
    exports.coreKnownTags = coreKnownTags;
    exports.getTags = getTags;
  }
});

// ../../node_modules/yaml/dist/schema/Schema.js
var require_Schema = __commonJS({
  "../../node_modules/yaml/dist/schema/Schema.js"(exports) {
    "use strict";
    var identity = require_identity();
    var map = require_map();
    var seq = require_seq();
    var string = require_string();
    var tags = require_tags();
    var sortMapEntriesByKey = (a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
    var Schema = class _Schema {
      constructor({ compat, customTags, merge, resolveKnownTags, schema, sortMapEntries, toStringDefaults }) {
        this.compat = Array.isArray(compat) ? tags.getTags(compat, "compat") : compat ? tags.getTags(null, compat) : null;
        this.name = typeof schema === "string" && schema || "core";
        this.knownTags = resolveKnownTags ? tags.coreKnownTags : {};
        this.tags = tags.getTags(customTags, this.name, merge);
        this.toStringOptions = toStringDefaults ?? null;
        Object.defineProperty(this, identity.MAP, { value: map.map });
        Object.defineProperty(this, identity.SCALAR, { value: string.string });
        Object.defineProperty(this, identity.SEQ, { value: seq.seq });
        this.sortMapEntries = typeof sortMapEntries === "function" ? sortMapEntries : sortMapEntries === true ? sortMapEntriesByKey : null;
      }
      clone() {
        const copy = Object.create(_Schema.prototype, Object.getOwnPropertyDescriptors(this));
        copy.tags = this.tags.slice();
        return copy;
      }
    };
    exports.Schema = Schema;
  }
});

// ../../node_modules/yaml/dist/stringify/stringifyDocument.js
var require_stringifyDocument = __commonJS({
  "../../node_modules/yaml/dist/stringify/stringifyDocument.js"(exports) {
    "use strict";
    var identity = require_identity();
    var stringify = require_stringify();
    var stringifyComment = require_stringifyComment();
    function stringifyDocument(doc, options) {
      const lines = [];
      let hasDirectives = options.directives === true;
      if (options.directives !== false && doc.directives) {
        const dir = doc.directives.toString(doc);
        if (dir) {
          lines.push(dir);
          hasDirectives = true;
        } else if (doc.directives.docStart)
          hasDirectives = true;
      }
      if (hasDirectives)
        lines.push("---");
      const ctx = stringify.createStringifyContext(doc, options);
      const { commentString } = ctx.options;
      if (doc.commentBefore) {
        if (lines.length !== 1)
          lines.unshift("");
        const cs = commentString(doc.commentBefore);
        lines.unshift(stringifyComment.indentComment(cs, ""));
      }
      let chompKeep = false;
      let contentComment = null;
      if (doc.contents) {
        if (identity.isNode(doc.contents)) {
          if (doc.contents.spaceBefore && hasDirectives)
            lines.push("");
          if (doc.contents.commentBefore) {
            const cs = commentString(doc.contents.commentBefore);
            lines.push(stringifyComment.indentComment(cs, ""));
          }
          ctx.forceBlockIndent = !!doc.comment;
          contentComment = doc.contents.comment;
        }
        const onChompKeep = contentComment ? void 0 : () => chompKeep = true;
        let body = stringify.stringify(doc.contents, ctx, () => contentComment = null, onChompKeep);
        if (contentComment)
          body += stringifyComment.lineComment(body, "", commentString(contentComment));
        if ((body[0] === "|" || body[0] === ">") && lines[lines.length - 1] === "---") {
          lines[lines.length - 1] = `--- ${body}`;
        } else
          lines.push(body);
      } else {
        lines.push(stringify.stringify(doc.contents, ctx));
      }
      if (doc.directives?.docEnd) {
        if (doc.comment) {
          const cs = commentString(doc.comment);
          if (cs.includes("\n")) {
            lines.push("...");
            lines.push(stringifyComment.indentComment(cs, ""));
          } else {
            lines.push(`... ${cs}`);
          }
        } else {
          lines.push("...");
        }
      } else {
        let dc = doc.comment;
        if (dc && chompKeep)
          dc = dc.replace(/^\n+/, "");
        if (dc) {
          if ((!chompKeep || contentComment) && lines[lines.length - 1] !== "")
            lines.push("");
          lines.push(stringifyComment.indentComment(commentString(dc), ""));
        }
      }
      return lines.join("\n") + "\n";
    }
    exports.stringifyDocument = stringifyDocument;
  }
});

// ../../node_modules/yaml/dist/doc/Document.js
var require_Document = __commonJS({
  "../../node_modules/yaml/dist/doc/Document.js"(exports) {
    "use strict";
    var Alias = require_Alias();
    var Collection = require_Collection();
    var identity = require_identity();
    var Pair = require_Pair();
    var toJS = require_toJS();
    var Schema = require_Schema();
    var stringifyDocument = require_stringifyDocument();
    var anchors = require_anchors();
    var applyReviver = require_applyReviver();
    var createNode = require_createNode();
    var directives = require_directives();
    var Document = class _Document {
      constructor(value, replacer, options) {
        this.commentBefore = null;
        this.comment = null;
        this.errors = [];
        this.warnings = [];
        Object.defineProperty(this, identity.NODE_TYPE, { value: identity.DOC });
        let _replacer = null;
        if (typeof replacer === "function" || Array.isArray(replacer)) {
          _replacer = replacer;
        } else if (options === void 0 && replacer) {
          options = replacer;
          replacer = void 0;
        }
        const opt = Object.assign({
          intAsBigInt: false,
          keepSourceTokens: false,
          logLevel: "warn",
          prettyErrors: true,
          strict: true,
          stringKeys: false,
          uniqueKeys: true,
          version: "1.2"
        }, options);
        this.options = opt;
        let { version } = opt;
        if (options?._directives) {
          this.directives = options._directives.atDocument();
          if (this.directives.yaml.explicit)
            version = this.directives.yaml.version;
        } else
          this.directives = new directives.Directives({ version });
        this.setSchema(version, options);
        this.contents = value === void 0 ? null : this.createNode(value, _replacer, options);
      }
      /**
       * Create a deep copy of this Document and its contents.
       *
       * Custom Node values that inherit from `Object` still refer to their original instances.
       */
      clone() {
        const copy = Object.create(_Document.prototype, {
          [identity.NODE_TYPE]: { value: identity.DOC }
        });
        copy.commentBefore = this.commentBefore;
        copy.comment = this.comment;
        copy.errors = this.errors.slice();
        copy.warnings = this.warnings.slice();
        copy.options = Object.assign({}, this.options);
        if (this.directives)
          copy.directives = this.directives.clone();
        copy.schema = this.schema.clone();
        copy.contents = identity.isNode(this.contents) ? this.contents.clone(copy.schema) : this.contents;
        if (this.range)
          copy.range = this.range.slice();
        return copy;
      }
      /** Adds a value to the document. */
      add(value) {
        if (assertCollection(this.contents))
          this.contents.add(value);
      }
      /** Adds a value to the document. */
      addIn(path, value) {
        if (assertCollection(this.contents))
          this.contents.addIn(path, value);
      }
      /**
       * Create a new `Alias` node, ensuring that the target `node` has the required anchor.
       *
       * If `node` already has an anchor, `name` is ignored.
       * Otherwise, the `node.anchor` value will be set to `name`,
       * or if an anchor with that name is already present in the document,
       * `name` will be used as a prefix for a new unique anchor.
       * If `name` is undefined, the generated anchor will use 'a' as a prefix.
       */
      createAlias(node, name) {
        if (!node.anchor) {
          const prev = anchors.anchorNames(this);
          node.anchor = // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
          !name || prev.has(name) ? anchors.findNewAnchor(name || "a", prev) : name;
        }
        return new Alias.Alias(node.anchor);
      }
      createNode(value, replacer, options) {
        let _replacer = void 0;
        if (typeof replacer === "function") {
          value = replacer.call({ "": value }, "", value);
          _replacer = replacer;
        } else if (Array.isArray(replacer)) {
          const keyToStr = (v) => typeof v === "number" || v instanceof String || v instanceof Number;
          const asStr = replacer.filter(keyToStr).map(String);
          if (asStr.length > 0)
            replacer = replacer.concat(asStr);
          _replacer = replacer;
        } else if (options === void 0 && replacer) {
          options = replacer;
          replacer = void 0;
        }
        const { aliasDuplicateObjects, anchorPrefix, flow, keepUndefined, onTagObj, tag } = options ?? {};
        const { onAnchor, setAnchors, sourceObjects } = anchors.createNodeAnchors(
          this,
          // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
          anchorPrefix || "a"
        );
        const ctx = {
          aliasDuplicateObjects: aliasDuplicateObjects ?? true,
          keepUndefined: keepUndefined ?? false,
          onAnchor,
          onTagObj,
          replacer: _replacer,
          schema: this.schema,
          sourceObjects
        };
        const node = createNode.createNode(value, tag, ctx);
        if (flow && identity.isCollection(node))
          node.flow = true;
        setAnchors();
        return node;
      }
      /**
       * Convert a key and a value into a `Pair` using the current schema,
       * recursively wrapping all values as `Scalar` or `Collection` nodes.
       */
      createPair(key, value, options = {}) {
        const k = this.createNode(key, null, options);
        const v = this.createNode(value, null, options);
        return new Pair.Pair(k, v);
      }
      /**
       * Removes a value from the document.
       * @returns `true` if the item was found and removed.
       */
      delete(key) {
        return assertCollection(this.contents) ? this.contents.delete(key) : false;
      }
      /**
       * Removes a value from the document.
       * @returns `true` if the item was found and removed.
       */
      deleteIn(path) {
        if (Collection.isEmptyPath(path)) {
          if (this.contents == null)
            return false;
          this.contents = null;
          return true;
        }
        return assertCollection(this.contents) ? this.contents.deleteIn(path) : false;
      }
      /**
       * Returns item at `key`, or `undefined` if not found. By default unwraps
       * scalar values from their surrounding node; to disable set `keepScalar` to
       * `true` (collections are always returned intact).
       */
      get(key, keepScalar) {
        return identity.isCollection(this.contents) ? this.contents.get(key, keepScalar) : void 0;
      }
      /**
       * Returns item at `path`, or `undefined` if not found. By default unwraps
       * scalar values from their surrounding node; to disable set `keepScalar` to
       * `true` (collections are always returned intact).
       */
      getIn(path, keepScalar) {
        if (Collection.isEmptyPath(path))
          return !keepScalar && identity.isScalar(this.contents) ? this.contents.value : this.contents;
        return identity.isCollection(this.contents) ? this.contents.getIn(path, keepScalar) : void 0;
      }
      /**
       * Checks if the document includes a value with the key `key`.
       */
      has(key) {
        return identity.isCollection(this.contents) ? this.contents.has(key) : false;
      }
      /**
       * Checks if the document includes a value at `path`.
       */
      hasIn(path) {
        if (Collection.isEmptyPath(path))
          return this.contents !== void 0;
        return identity.isCollection(this.contents) ? this.contents.hasIn(path) : false;
      }
      /**
       * Sets a value in this document. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       */
      set(key, value) {
        if (this.contents == null) {
          this.contents = Collection.collectionFromPath(this.schema, [key], value);
        } else if (assertCollection(this.contents)) {
          this.contents.set(key, value);
        }
      }
      /**
       * Sets a value in this document. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       */
      setIn(path, value) {
        if (Collection.isEmptyPath(path)) {
          this.contents = value;
        } else if (this.contents == null) {
          this.contents = Collection.collectionFromPath(this.schema, Array.from(path), value);
        } else if (assertCollection(this.contents)) {
          this.contents.setIn(path, value);
        }
      }
      /**
       * Change the YAML version and schema used by the document.
       * A `null` version disables support for directives, explicit tags, anchors, and aliases.
       * It also requires the `schema` option to be given as a `Schema` instance value.
       *
       * Overrides all previously set schema options.
       */
      setSchema(version, options = {}) {
        if (typeof version === "number")
          version = String(version);
        let opt;
        switch (version) {
          case "1.1":
            if (this.directives)
              this.directives.yaml.version = "1.1";
            else
              this.directives = new directives.Directives({ version: "1.1" });
            opt = { resolveKnownTags: false, schema: "yaml-1.1" };
            break;
          case "1.2":
          case "next":
            if (this.directives)
              this.directives.yaml.version = version;
            else
              this.directives = new directives.Directives({ version });
            opt = { resolveKnownTags: true, schema: "core" };
            break;
          case null:
            if (this.directives)
              delete this.directives;
            opt = null;
            break;
          default: {
            const sv = JSON.stringify(version);
            throw new Error(`Expected '1.1', '1.2' or null as first argument, but found: ${sv}`);
          }
        }
        if (options.schema instanceof Object)
          this.schema = options.schema;
        else if (opt)
          this.schema = new Schema.Schema(Object.assign(opt, options));
        else
          throw new Error(`With a null YAML version, the { schema: Schema } option is required`);
      }
      // json & jsonArg are only used from toJSON()
      toJS({ json, jsonArg, mapAsMap, maxAliasCount, onAnchor, reviver } = {}) {
        const ctx = {
          anchors: /* @__PURE__ */ new Map(),
          doc: this,
          keep: !json,
          mapAsMap: mapAsMap === true,
          mapKeyWarned: false,
          maxAliasCount: typeof maxAliasCount === "number" ? maxAliasCount : 100
        };
        const res = toJS.toJS(this.contents, jsonArg ?? "", ctx);
        if (typeof onAnchor === "function")
          for (const { count, res: res2 } of ctx.anchors.values())
            onAnchor(res2, count);
        return typeof reviver === "function" ? applyReviver.applyReviver(reviver, { "": res }, "", res) : res;
      }
      /**
       * A JSON representation of the document `contents`.
       *
       * @param jsonArg Used by `JSON.stringify` to indicate the array index or
       *   property name.
       */
      toJSON(jsonArg, onAnchor) {
        return this.toJS({ json: true, jsonArg, mapAsMap: false, onAnchor });
      }
      /** A YAML representation of the document. */
      toString(options = {}) {
        if (this.errors.length > 0)
          throw new Error("Document with errors cannot be stringified");
        if ("indent" in options && (!Number.isInteger(options.indent) || Number(options.indent) <= 0)) {
          const s = JSON.stringify(options.indent);
          throw new Error(`"indent" option must be a positive integer, not ${s}`);
        }
        return stringifyDocument.stringifyDocument(this, options);
      }
    };
    function assertCollection(contents) {
      if (identity.isCollection(contents))
        return true;
      throw new Error("Expected a YAML collection as document contents");
    }
    exports.Document = Document;
  }
});

// ../../node_modules/yaml/dist/errors.js
var require_errors = __commonJS({
  "../../node_modules/yaml/dist/errors.js"(exports) {
    "use strict";
    var YAMLError = class extends Error {
      constructor(name, pos, code, message) {
        super();
        this.name = name;
        this.code = code;
        this.message = message;
        this.pos = pos;
      }
    };
    var YAMLParseError = class extends YAMLError {
      constructor(pos, code, message) {
        super("YAMLParseError", pos, code, message);
      }
    };
    var YAMLWarning = class extends YAMLError {
      constructor(pos, code, message) {
        super("YAMLWarning", pos, code, message);
      }
    };
    var prettifyError = (src, lc) => (error) => {
      if (error.pos[0] === -1)
        return;
      error.linePos = error.pos.map((pos) => lc.linePos(pos));
      const { line, col } = error.linePos[0];
      error.message += ` at line ${line}, column ${col}`;
      let ci = col - 1;
      let lineStr = src.substring(lc.lineStarts[line - 1], lc.lineStarts[line]).replace(/[\n\r]+$/, "");
      if (ci >= 60 && lineStr.length > 80) {
        const trimStart = Math.min(ci - 39, lineStr.length - 79);
        lineStr = "\u2026" + lineStr.substring(trimStart);
        ci -= trimStart - 1;
      }
      if (lineStr.length > 80)
        lineStr = lineStr.substring(0, 79) + "\u2026";
      if (line > 1 && /^ *$/.test(lineStr.substring(0, ci))) {
        let prev = src.substring(lc.lineStarts[line - 2], lc.lineStarts[line - 1]);
        if (prev.length > 80)
          prev = prev.substring(0, 79) + "\u2026\n";
        lineStr = prev + lineStr;
      }
      if (/[^ ]/.test(lineStr)) {
        let count = 1;
        const end = error.linePos[1];
        if (end?.line === line && end.col > col) {
          count = Math.max(1, Math.min(end.col - col, 80 - ci));
        }
        const pointer = " ".repeat(ci) + "^".repeat(count);
        error.message += `:

${lineStr}
${pointer}
`;
      }
    };
    exports.YAMLError = YAMLError;
    exports.YAMLParseError = YAMLParseError;
    exports.YAMLWarning = YAMLWarning;
    exports.prettifyError = prettifyError;
  }
});

// ../../node_modules/yaml/dist/compose/resolve-props.js
var require_resolve_props = __commonJS({
  "../../node_modules/yaml/dist/compose/resolve-props.js"(exports) {
    "use strict";
    function resolveProps(tokens, { flow, indicator, next, offset, onError, parentIndent, startOnNewline }) {
      let spaceBefore = false;
      let atNewline = startOnNewline;
      let hasSpace = startOnNewline;
      let comment = "";
      let commentSep = "";
      let hasNewline = false;
      let reqSpace = false;
      let tab = null;
      let anchor = null;
      let tag = null;
      let newlineAfterProp = null;
      let comma = null;
      let found = null;
      let start = null;
      for (const token of tokens) {
        if (reqSpace) {
          if (token.type !== "space" && token.type !== "newline" && token.type !== "comma")
            onError(token.offset, "MISSING_CHAR", "Tags and anchors must be separated from the next token by white space");
          reqSpace = false;
        }
        if (tab) {
          if (atNewline && token.type !== "comment" && token.type !== "newline") {
            onError(tab, "TAB_AS_INDENT", "Tabs are not allowed as indentation");
          }
          tab = null;
        }
        switch (token.type) {
          case "space":
            if (!flow && (indicator !== "doc-start" || next?.type !== "flow-collection") && token.source.includes("	")) {
              tab = token;
            }
            hasSpace = true;
            break;
          case "comment": {
            if (!hasSpace)
              onError(token, "MISSING_CHAR", "Comments must be separated from other tokens by white space characters");
            const cb = token.source.substring(1) || " ";
            if (!comment)
              comment = cb;
            else
              comment += commentSep + cb;
            commentSep = "";
            atNewline = false;
            break;
          }
          case "newline":
            if (atNewline) {
              if (comment)
                comment += token.source;
              else if (!found || indicator !== "seq-item-ind")
                spaceBefore = true;
            } else
              commentSep += token.source;
            atNewline = true;
            hasNewline = true;
            if (anchor || tag)
              newlineAfterProp = token;
            hasSpace = true;
            break;
          case "anchor":
            if (anchor)
              onError(token, "MULTIPLE_ANCHORS", "A node can have at most one anchor");
            if (token.source.endsWith(":"))
              onError(token.offset + token.source.length - 1, "BAD_ALIAS", "Anchor ending in : is ambiguous", true);
            anchor = token;
            start ?? (start = token.offset);
            atNewline = false;
            hasSpace = false;
            reqSpace = true;
            break;
          case "tag": {
            if (tag)
              onError(token, "MULTIPLE_TAGS", "A node can have at most one tag");
            tag = token;
            start ?? (start = token.offset);
            atNewline = false;
            hasSpace = false;
            reqSpace = true;
            break;
          }
          case indicator:
            if (anchor || tag)
              onError(token, "BAD_PROP_ORDER", `Anchors and tags must be after the ${token.source} indicator`);
            if (found)
              onError(token, "UNEXPECTED_TOKEN", `Unexpected ${token.source} in ${flow ?? "collection"}`);
            found = token;
            atNewline = indicator === "seq-item-ind" || indicator === "explicit-key-ind";
            hasSpace = false;
            break;
          case "comma":
            if (flow) {
              if (comma)
                onError(token, "UNEXPECTED_TOKEN", `Unexpected , in ${flow}`);
              comma = token;
              atNewline = false;
              hasSpace = false;
              break;
            }
          // else fallthrough
          default:
            onError(token, "UNEXPECTED_TOKEN", `Unexpected ${token.type} token`);
            atNewline = false;
            hasSpace = false;
        }
      }
      const last = tokens[tokens.length - 1];
      const end = last ? last.offset + last.source.length : offset;
      if (reqSpace && next && next.type !== "space" && next.type !== "newline" && next.type !== "comma" && (next.type !== "scalar" || next.source !== "")) {
        onError(next.offset, "MISSING_CHAR", "Tags and anchors must be separated from the next token by white space");
      }
      if (tab && (atNewline && tab.indent <= parentIndent || next?.type === "block-map" || next?.type === "block-seq"))
        onError(tab, "TAB_AS_INDENT", "Tabs are not allowed as indentation");
      return {
        comma,
        found,
        spaceBefore,
        comment,
        hasNewline,
        anchor,
        tag,
        newlineAfterProp,
        end,
        start: start ?? end
      };
    }
    exports.resolveProps = resolveProps;
  }
});

// ../../node_modules/yaml/dist/compose/util-contains-newline.js
var require_util_contains_newline = __commonJS({
  "../../node_modules/yaml/dist/compose/util-contains-newline.js"(exports) {
    "use strict";
    function containsNewline(key) {
      if (!key)
        return null;
      switch (key.type) {
        case "alias":
        case "scalar":
        case "double-quoted-scalar":
        case "single-quoted-scalar":
          if (key.source.includes("\n"))
            return true;
          if (key.end) {
            for (const st of key.end)
              if (st.type === "newline")
                return true;
          }
          return false;
        case "flow-collection":
          for (const it of key.items) {
            for (const st of it.start)
              if (st.type === "newline")
                return true;
            if (it.sep) {
              for (const st of it.sep)
                if (st.type === "newline")
                  return true;
            }
            if (containsNewline(it.key) || containsNewline(it.value))
              return true;
          }
          return false;
        default:
          return true;
      }
    }
    exports.containsNewline = containsNewline;
  }
});

// ../../node_modules/yaml/dist/compose/util-flow-indent-check.js
var require_util_flow_indent_check = __commonJS({
  "../../node_modules/yaml/dist/compose/util-flow-indent-check.js"(exports) {
    "use strict";
    var utilContainsNewline = require_util_contains_newline();
    function flowIndentCheck(indent, fc, onError) {
      if (fc?.type === "flow-collection") {
        const end = fc.end[0];
        if (end.indent === indent && (end.source === "]" || end.source === "}") && utilContainsNewline.containsNewline(fc)) {
          const msg = "Flow end indicator should be more indented than parent";
          onError(end, "BAD_INDENT", msg, true);
        }
      }
    }
    exports.flowIndentCheck = flowIndentCheck;
  }
});

// ../../node_modules/yaml/dist/compose/util-map-includes.js
var require_util_map_includes = __commonJS({
  "../../node_modules/yaml/dist/compose/util-map-includes.js"(exports) {
    "use strict";
    var identity = require_identity();
    function mapIncludes(ctx, items, search) {
      const { uniqueKeys } = ctx.options;
      if (uniqueKeys === false)
        return false;
      const isEqual = typeof uniqueKeys === "function" ? uniqueKeys : (a, b) => a === b || identity.isScalar(a) && identity.isScalar(b) && a.value === b.value;
      return items.some((pair) => isEqual(pair.key, search));
    }
    exports.mapIncludes = mapIncludes;
  }
});

// ../../node_modules/yaml/dist/compose/resolve-block-map.js
var require_resolve_block_map = __commonJS({
  "../../node_modules/yaml/dist/compose/resolve-block-map.js"(exports) {
    "use strict";
    var Pair = require_Pair();
    var YAMLMap = require_YAMLMap();
    var resolveProps = require_resolve_props();
    var utilContainsNewline = require_util_contains_newline();
    var utilFlowIndentCheck = require_util_flow_indent_check();
    var utilMapIncludes = require_util_map_includes();
    var startColMsg = "All mapping items must start at the same column";
    function resolveBlockMap({ composeNode, composeEmptyNode }, ctx, bm, onError, tag) {
      const NodeClass = tag?.nodeClass ?? YAMLMap.YAMLMap;
      const map = new NodeClass(ctx.schema);
      if (ctx.atRoot)
        ctx.atRoot = false;
      let offset = bm.offset;
      let commentEnd = null;
      for (const collItem of bm.items) {
        const { start, key, sep: sep2, value } = collItem;
        const keyProps = resolveProps.resolveProps(start, {
          indicator: "explicit-key-ind",
          next: key ?? sep2?.[0],
          offset,
          onError,
          parentIndent: bm.indent,
          startOnNewline: true
        });
        const implicitKey = !keyProps.found;
        if (implicitKey) {
          if (key) {
            if (key.type === "block-seq")
              onError(offset, "BLOCK_AS_IMPLICIT_KEY", "A block sequence may not be used as an implicit map key");
            else if ("indent" in key && key.indent !== bm.indent)
              onError(offset, "BAD_INDENT", startColMsg);
          }
          if (!keyProps.anchor && !keyProps.tag && !sep2) {
            commentEnd = keyProps.end;
            if (keyProps.comment) {
              if (map.comment)
                map.comment += "\n" + keyProps.comment;
              else
                map.comment = keyProps.comment;
            }
            continue;
          }
          if (keyProps.newlineAfterProp || utilContainsNewline.containsNewline(key)) {
            onError(key ?? start[start.length - 1], "MULTILINE_IMPLICIT_KEY", "Implicit keys need to be on a single line");
          }
        } else if (keyProps.found?.indent !== bm.indent) {
          onError(offset, "BAD_INDENT", startColMsg);
        }
        ctx.atKey = true;
        const keyStart = keyProps.end;
        const keyNode = key ? composeNode(ctx, key, keyProps, onError) : composeEmptyNode(ctx, keyStart, start, null, keyProps, onError);
        if (ctx.schema.compat)
          utilFlowIndentCheck.flowIndentCheck(bm.indent, key, onError);
        ctx.atKey = false;
        if (utilMapIncludes.mapIncludes(ctx, map.items, keyNode))
          onError(keyStart, "DUPLICATE_KEY", "Map keys must be unique");
        const valueProps = resolveProps.resolveProps(sep2 ?? [], {
          indicator: "map-value-ind",
          next: value,
          offset: keyNode.range[2],
          onError,
          parentIndent: bm.indent,
          startOnNewline: !key || key.type === "block-scalar"
        });
        offset = valueProps.end;
        if (valueProps.found) {
          if (implicitKey) {
            if (value?.type === "block-map" && !valueProps.hasNewline)
              onError(offset, "BLOCK_AS_IMPLICIT_KEY", "Nested mappings are not allowed in compact mappings");
            if (ctx.options.strict && keyProps.start < valueProps.found.offset - 1024)
              onError(keyNode.range, "KEY_OVER_1024_CHARS", "The : indicator must be at most 1024 chars after the start of an implicit block mapping key");
          }
          const valueNode = value ? composeNode(ctx, value, valueProps, onError) : composeEmptyNode(ctx, offset, sep2, null, valueProps, onError);
          if (ctx.schema.compat)
            utilFlowIndentCheck.flowIndentCheck(bm.indent, value, onError);
          offset = valueNode.range[2];
          const pair = new Pair.Pair(keyNode, valueNode);
          if (ctx.options.keepSourceTokens)
            pair.srcToken = collItem;
          map.items.push(pair);
        } else {
          if (implicitKey)
            onError(keyNode.range, "MISSING_CHAR", "Implicit map keys need to be followed by map values");
          if (valueProps.comment) {
            if (keyNode.comment)
              keyNode.comment += "\n" + valueProps.comment;
            else
              keyNode.comment = valueProps.comment;
          }
          const pair = new Pair.Pair(keyNode);
          if (ctx.options.keepSourceTokens)
            pair.srcToken = collItem;
          map.items.push(pair);
        }
      }
      if (commentEnd && commentEnd < offset)
        onError(commentEnd, "IMPOSSIBLE", "Map comment with trailing content");
      map.range = [bm.offset, offset, commentEnd ?? offset];
      return map;
    }
    exports.resolveBlockMap = resolveBlockMap;
  }
});

// ../../node_modules/yaml/dist/compose/resolve-block-seq.js
var require_resolve_block_seq = __commonJS({
  "../../node_modules/yaml/dist/compose/resolve-block-seq.js"(exports) {
    "use strict";
    var YAMLSeq = require_YAMLSeq();
    var resolveProps = require_resolve_props();
    var utilFlowIndentCheck = require_util_flow_indent_check();
    function resolveBlockSeq({ composeNode, composeEmptyNode }, ctx, bs, onError, tag) {
      const NodeClass = tag?.nodeClass ?? YAMLSeq.YAMLSeq;
      const seq = new NodeClass(ctx.schema);
      if (ctx.atRoot)
        ctx.atRoot = false;
      if (ctx.atKey)
        ctx.atKey = false;
      let offset = bs.offset;
      let commentEnd = null;
      for (const { start, value } of bs.items) {
        const props = resolveProps.resolveProps(start, {
          indicator: "seq-item-ind",
          next: value,
          offset,
          onError,
          parentIndent: bs.indent,
          startOnNewline: true
        });
        if (!props.found) {
          if (props.anchor || props.tag || value) {
            if (value?.type === "block-seq")
              onError(props.end, "BAD_INDENT", "All sequence items must start at the same column");
            else
              onError(offset, "MISSING_CHAR", "Sequence item without - indicator");
          } else {
            commentEnd = props.end;
            if (props.comment)
              seq.comment = props.comment;
            continue;
          }
        }
        const node = value ? composeNode(ctx, value, props, onError) : composeEmptyNode(ctx, props.end, start, null, props, onError);
        if (ctx.schema.compat)
          utilFlowIndentCheck.flowIndentCheck(bs.indent, value, onError);
        offset = node.range[2];
        seq.items.push(node);
      }
      seq.range = [bs.offset, offset, commentEnd ?? offset];
      return seq;
    }
    exports.resolveBlockSeq = resolveBlockSeq;
  }
});

// ../../node_modules/yaml/dist/compose/resolve-end.js
var require_resolve_end = __commonJS({
  "../../node_modules/yaml/dist/compose/resolve-end.js"(exports) {
    "use strict";
    function resolveEnd(end, offset, reqSpace, onError) {
      let comment = "";
      if (end) {
        let hasSpace = false;
        let sep2 = "";
        for (const token of end) {
          const { source, type } = token;
          switch (type) {
            case "space":
              hasSpace = true;
              break;
            case "comment": {
              if (reqSpace && !hasSpace)
                onError(token, "MISSING_CHAR", "Comments must be separated from other tokens by white space characters");
              const cb = source.substring(1) || " ";
              if (!comment)
                comment = cb;
              else
                comment += sep2 + cb;
              sep2 = "";
              break;
            }
            case "newline":
              if (comment)
                sep2 += source;
              hasSpace = true;
              break;
            default:
              onError(token, "UNEXPECTED_TOKEN", `Unexpected ${type} at node end`);
          }
          offset += source.length;
        }
      }
      return { comment, offset };
    }
    exports.resolveEnd = resolveEnd;
  }
});

// ../../node_modules/yaml/dist/compose/resolve-flow-collection.js
var require_resolve_flow_collection = __commonJS({
  "../../node_modules/yaml/dist/compose/resolve-flow-collection.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Pair = require_Pair();
    var YAMLMap = require_YAMLMap();
    var YAMLSeq = require_YAMLSeq();
    var resolveEnd = require_resolve_end();
    var resolveProps = require_resolve_props();
    var utilContainsNewline = require_util_contains_newline();
    var utilMapIncludes = require_util_map_includes();
    var blockMsg = "Block collections are not allowed within flow collections";
    var isBlock = (token) => token && (token.type === "block-map" || token.type === "block-seq");
    function resolveFlowCollection({ composeNode, composeEmptyNode }, ctx, fc, onError, tag) {
      const isMap = fc.start.source === "{";
      const fcName = isMap ? "flow map" : "flow sequence";
      const NodeClass = tag?.nodeClass ?? (isMap ? YAMLMap.YAMLMap : YAMLSeq.YAMLSeq);
      const coll = new NodeClass(ctx.schema);
      coll.flow = true;
      const atRoot = ctx.atRoot;
      if (atRoot)
        ctx.atRoot = false;
      if (ctx.atKey)
        ctx.atKey = false;
      let offset = fc.offset + fc.start.source.length;
      for (let i = 0; i < fc.items.length; ++i) {
        const collItem = fc.items[i];
        const { start, key, sep: sep2, value } = collItem;
        const props = resolveProps.resolveProps(start, {
          flow: fcName,
          indicator: "explicit-key-ind",
          next: key ?? sep2?.[0],
          offset,
          onError,
          parentIndent: fc.indent,
          startOnNewline: false
        });
        if (!props.found) {
          if (!props.anchor && !props.tag && !sep2 && !value) {
            if (i === 0 && props.comma)
              onError(props.comma, "UNEXPECTED_TOKEN", `Unexpected , in ${fcName}`);
            else if (i < fc.items.length - 1)
              onError(props.start, "UNEXPECTED_TOKEN", `Unexpected empty item in ${fcName}`);
            if (props.comment) {
              if (coll.comment)
                coll.comment += "\n" + props.comment;
              else
                coll.comment = props.comment;
            }
            offset = props.end;
            continue;
          }
          if (!isMap && ctx.options.strict && utilContainsNewline.containsNewline(key))
            onError(
              key,
              // checked by containsNewline()
              "MULTILINE_IMPLICIT_KEY",
              "Implicit keys of flow sequence pairs need to be on a single line"
            );
        }
        if (i === 0) {
          if (props.comma)
            onError(props.comma, "UNEXPECTED_TOKEN", `Unexpected , in ${fcName}`);
        } else {
          if (!props.comma)
            onError(props.start, "MISSING_CHAR", `Missing , between ${fcName} items`);
          if (props.comment) {
            let prevItemComment = "";
            loop: for (const st of start) {
              switch (st.type) {
                case "comma":
                case "space":
                  break;
                case "comment":
                  prevItemComment = st.source.substring(1);
                  break loop;
                default:
                  break loop;
              }
            }
            if (prevItemComment) {
              let prev = coll.items[coll.items.length - 1];
              if (identity.isPair(prev))
                prev = prev.value ?? prev.key;
              if (prev.comment)
                prev.comment += "\n" + prevItemComment;
              else
                prev.comment = prevItemComment;
              props.comment = props.comment.substring(prevItemComment.length + 1);
            }
          }
        }
        if (!isMap && !sep2 && !props.found) {
          const valueNode = value ? composeNode(ctx, value, props, onError) : composeEmptyNode(ctx, props.end, sep2, null, props, onError);
          coll.items.push(valueNode);
          offset = valueNode.range[2];
          if (isBlock(value))
            onError(valueNode.range, "BLOCK_IN_FLOW", blockMsg);
        } else {
          ctx.atKey = true;
          const keyStart = props.end;
          const keyNode = key ? composeNode(ctx, key, props, onError) : composeEmptyNode(ctx, keyStart, start, null, props, onError);
          if (isBlock(key))
            onError(keyNode.range, "BLOCK_IN_FLOW", blockMsg);
          ctx.atKey = false;
          const valueProps = resolveProps.resolveProps(sep2 ?? [], {
            flow: fcName,
            indicator: "map-value-ind",
            next: value,
            offset: keyNode.range[2],
            onError,
            parentIndent: fc.indent,
            startOnNewline: false
          });
          if (valueProps.found) {
            if (!isMap && !props.found && ctx.options.strict) {
              if (sep2)
                for (const st of sep2) {
                  if (st === valueProps.found)
                    break;
                  if (st.type === "newline") {
                    onError(st, "MULTILINE_IMPLICIT_KEY", "Implicit keys of flow sequence pairs need to be on a single line");
                    break;
                  }
                }
              if (props.start < valueProps.found.offset - 1024)
                onError(valueProps.found, "KEY_OVER_1024_CHARS", "The : indicator must be at most 1024 chars after the start of an implicit flow sequence key");
            }
          } else if (value) {
            if ("source" in value && value.source?.[0] === ":")
              onError(value, "MISSING_CHAR", `Missing space after : in ${fcName}`);
            else
              onError(valueProps.start, "MISSING_CHAR", `Missing , or : between ${fcName} items`);
          }
          const valueNode = value ? composeNode(ctx, value, valueProps, onError) : valueProps.found ? composeEmptyNode(ctx, valueProps.end, sep2, null, valueProps, onError) : null;
          if (valueNode) {
            if (isBlock(value))
              onError(valueNode.range, "BLOCK_IN_FLOW", blockMsg);
          } else if (valueProps.comment) {
            if (keyNode.comment)
              keyNode.comment += "\n" + valueProps.comment;
            else
              keyNode.comment = valueProps.comment;
          }
          const pair = new Pair.Pair(keyNode, valueNode);
          if (ctx.options.keepSourceTokens)
            pair.srcToken = collItem;
          if (isMap) {
            const map = coll;
            if (utilMapIncludes.mapIncludes(ctx, map.items, keyNode))
              onError(keyStart, "DUPLICATE_KEY", "Map keys must be unique");
            map.items.push(pair);
          } else {
            const map = new YAMLMap.YAMLMap(ctx.schema);
            map.flow = true;
            map.items.push(pair);
            const endRange = (valueNode ?? keyNode).range;
            map.range = [keyNode.range[0], endRange[1], endRange[2]];
            coll.items.push(map);
          }
          offset = valueNode ? valueNode.range[2] : valueProps.end;
        }
      }
      const expectedEnd = isMap ? "}" : "]";
      const [ce, ...ee] = fc.end;
      let cePos = offset;
      if (ce?.source === expectedEnd)
        cePos = ce.offset + ce.source.length;
      else {
        const name = fcName[0].toUpperCase() + fcName.substring(1);
        const msg = atRoot ? `${name} must end with a ${expectedEnd}` : `${name} in block collection must be sufficiently indented and end with a ${expectedEnd}`;
        onError(offset, atRoot ? "MISSING_CHAR" : "BAD_INDENT", msg);
        if (ce && ce.source.length !== 1)
          ee.unshift(ce);
      }
      if (ee.length > 0) {
        const end = resolveEnd.resolveEnd(ee, cePos, ctx.options.strict, onError);
        if (end.comment) {
          if (coll.comment)
            coll.comment += "\n" + end.comment;
          else
            coll.comment = end.comment;
        }
        coll.range = [fc.offset, cePos, end.offset];
      } else {
        coll.range = [fc.offset, cePos, cePos];
      }
      return coll;
    }
    exports.resolveFlowCollection = resolveFlowCollection;
  }
});

// ../../node_modules/yaml/dist/compose/compose-collection.js
var require_compose_collection = __commonJS({
  "../../node_modules/yaml/dist/compose/compose-collection.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Scalar = require_Scalar();
    var YAMLMap = require_YAMLMap();
    var YAMLSeq = require_YAMLSeq();
    var resolveBlockMap = require_resolve_block_map();
    var resolveBlockSeq = require_resolve_block_seq();
    var resolveFlowCollection = require_resolve_flow_collection();
    function resolveCollection(CN, ctx, token, onError, tagName, tag) {
      const coll = token.type === "block-map" ? resolveBlockMap.resolveBlockMap(CN, ctx, token, onError, tag) : token.type === "block-seq" ? resolveBlockSeq.resolveBlockSeq(CN, ctx, token, onError, tag) : resolveFlowCollection.resolveFlowCollection(CN, ctx, token, onError, tag);
      const Coll = coll.constructor;
      if (tagName === "!" || tagName === Coll.tagName) {
        coll.tag = Coll.tagName;
        return coll;
      }
      if (tagName)
        coll.tag = tagName;
      return coll;
    }
    function composeCollection(CN, ctx, token, props, onError) {
      const tagToken = props.tag;
      const tagName = !tagToken ? null : ctx.directives.tagName(tagToken.source, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg));
      if (token.type === "block-seq") {
        const { anchor, newlineAfterProp: nl } = props;
        const lastProp = anchor && tagToken ? anchor.offset > tagToken.offset ? anchor : tagToken : anchor ?? tagToken;
        if (lastProp && (!nl || nl.offset < lastProp.offset)) {
          const message = "Missing newline after block sequence props";
          onError(lastProp, "MISSING_CHAR", message);
        }
      }
      const expType = token.type === "block-map" ? "map" : token.type === "block-seq" ? "seq" : token.start.source === "{" ? "map" : "seq";
      if (!tagToken || !tagName || tagName === "!" || tagName === YAMLMap.YAMLMap.tagName && expType === "map" || tagName === YAMLSeq.YAMLSeq.tagName && expType === "seq") {
        return resolveCollection(CN, ctx, token, onError, tagName);
      }
      let tag = ctx.schema.tags.find((t2) => t2.tag === tagName && t2.collection === expType);
      if (!tag) {
        const kt = ctx.schema.knownTags[tagName];
        if (kt?.collection === expType) {
          ctx.schema.tags.push(Object.assign({}, kt, { default: false }));
          tag = kt;
        } else {
          if (kt) {
            onError(tagToken, "BAD_COLLECTION_TYPE", `${kt.tag} used for ${expType} collection, but expects ${kt.collection ?? "scalar"}`, true);
          } else {
            onError(tagToken, "TAG_RESOLVE_FAILED", `Unresolved tag: ${tagName}`, true);
          }
          return resolveCollection(CN, ctx, token, onError, tagName);
        }
      }
      const coll = resolveCollection(CN, ctx, token, onError, tagName, tag);
      const res = tag.resolve?.(coll, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg), ctx.options) ?? coll;
      const node = identity.isNode(res) ? res : new Scalar.Scalar(res);
      node.range = coll.range;
      node.tag = tagName;
      if (tag?.format)
        node.format = tag.format;
      return node;
    }
    exports.composeCollection = composeCollection;
  }
});

// ../../node_modules/yaml/dist/compose/resolve-block-scalar.js
var require_resolve_block_scalar = __commonJS({
  "../../node_modules/yaml/dist/compose/resolve-block-scalar.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    function resolveBlockScalar(ctx, scalar, onError) {
      const start = scalar.offset;
      const header = parseBlockScalarHeader(scalar, ctx.options.strict, onError);
      if (!header)
        return { value: "", type: null, comment: "", range: [start, start, start] };
      const type = header.mode === ">" ? Scalar.Scalar.BLOCK_FOLDED : Scalar.Scalar.BLOCK_LITERAL;
      const lines = scalar.source ? splitLines(scalar.source) : [];
      let chompStart = lines.length;
      for (let i = lines.length - 1; i >= 0; --i) {
        const content = lines[i][1];
        if (content === "" || content === "\r")
          chompStart = i;
        else
          break;
      }
      if (chompStart === 0) {
        const value2 = header.chomp === "+" && lines.length > 0 ? "\n".repeat(Math.max(1, lines.length - 1)) : "";
        let end2 = start + header.length;
        if (scalar.source)
          end2 += scalar.source.length;
        return { value: value2, type, comment: header.comment, range: [start, end2, end2] };
      }
      let trimIndent = scalar.indent + header.indent;
      let offset = scalar.offset + header.length;
      let contentStart = 0;
      for (let i = 0; i < chompStart; ++i) {
        const [indent, content] = lines[i];
        if (content === "" || content === "\r") {
          if (header.indent === 0 && indent.length > trimIndent)
            trimIndent = indent.length;
        } else {
          if (indent.length < trimIndent) {
            const message = "Block scalars with more-indented leading empty lines must use an explicit indentation indicator";
            onError(offset + indent.length, "MISSING_CHAR", message);
          }
          if (header.indent === 0)
            trimIndent = indent.length;
          contentStart = i;
          if (trimIndent === 0 && !ctx.atRoot) {
            const message = "Block scalar values in collections must be indented";
            onError(offset, "BAD_INDENT", message);
          }
          break;
        }
        offset += indent.length + content.length + 1;
      }
      for (let i = lines.length - 1; i >= chompStart; --i) {
        if (lines[i][0].length > trimIndent)
          chompStart = i + 1;
      }
      let value = "";
      let sep2 = "";
      let prevMoreIndented = false;
      for (let i = 0; i < contentStart; ++i)
        value += lines[i][0].slice(trimIndent) + "\n";
      for (let i = contentStart; i < chompStart; ++i) {
        let [indent, content] = lines[i];
        offset += indent.length + content.length + 1;
        const crlf = content[content.length - 1] === "\r";
        if (crlf)
          content = content.slice(0, -1);
        if (content && indent.length < trimIndent) {
          const src = header.indent ? "explicit indentation indicator" : "first line";
          const message = `Block scalar lines must not be less indented than their ${src}`;
          onError(offset - content.length - (crlf ? 2 : 1), "BAD_INDENT", message);
          indent = "";
        }
        if (type === Scalar.Scalar.BLOCK_LITERAL) {
          value += sep2 + indent.slice(trimIndent) + content;
          sep2 = "\n";
        } else if (indent.length > trimIndent || content[0] === "	") {
          if (sep2 === " ")
            sep2 = "\n";
          else if (!prevMoreIndented && sep2 === "\n")
            sep2 = "\n\n";
          value += sep2 + indent.slice(trimIndent) + content;
          sep2 = "\n";
          prevMoreIndented = true;
        } else if (content === "") {
          if (sep2 === "\n")
            value += "\n";
          else
            sep2 = "\n";
        } else {
          value += sep2 + content;
          sep2 = " ";
          prevMoreIndented = false;
        }
      }
      switch (header.chomp) {
        case "-":
          break;
        case "+":
          for (let i = chompStart; i < lines.length; ++i)
            value += "\n" + lines[i][0].slice(trimIndent);
          if (value[value.length - 1] !== "\n")
            value += "\n";
          break;
        default:
          value += "\n";
      }
      const end = start + header.length + scalar.source.length;
      return { value, type, comment: header.comment, range: [start, end, end] };
    }
    function parseBlockScalarHeader({ offset, props }, strict, onError) {
      if (props[0].type !== "block-scalar-header") {
        onError(props[0], "IMPOSSIBLE", "Block scalar header not found");
        return null;
      }
      const { source } = props[0];
      const mode = source[0];
      let indent = 0;
      let chomp = "";
      let error = -1;
      for (let i = 1; i < source.length; ++i) {
        const ch = source[i];
        if (!chomp && (ch === "-" || ch === "+"))
          chomp = ch;
        else {
          const n = Number(ch);
          if (!indent && n)
            indent = n;
          else if (error === -1)
            error = offset + i;
        }
      }
      if (error !== -1)
        onError(error, "UNEXPECTED_TOKEN", `Block scalar header includes extra characters: ${source}`);
      let hasSpace = false;
      let comment = "";
      let length = source.length;
      for (let i = 1; i < props.length; ++i) {
        const token = props[i];
        switch (token.type) {
          case "space":
            hasSpace = true;
          // fallthrough
          case "newline":
            length += token.source.length;
            break;
          case "comment":
            if (strict && !hasSpace) {
              const message = "Comments must be separated from other tokens by white space characters";
              onError(token, "MISSING_CHAR", message);
            }
            length += token.source.length;
            comment = token.source.substring(1);
            break;
          case "error":
            onError(token, "UNEXPECTED_TOKEN", token.message);
            length += token.source.length;
            break;
          /* istanbul ignore next should not happen */
          default: {
            const message = `Unexpected token in block scalar header: ${token.type}`;
            onError(token, "UNEXPECTED_TOKEN", message);
            const ts = token.source;
            if (ts && typeof ts === "string")
              length += ts.length;
          }
        }
      }
      return { mode, indent, chomp, comment, length };
    }
    function splitLines(source) {
      const split = source.split(/\n( *)/);
      const first = split[0];
      const m = first.match(/^( *)/);
      const line0 = m?.[1] ? [m[1], first.slice(m[1].length)] : ["", first];
      const lines = [line0];
      for (let i = 1; i < split.length; i += 2)
        lines.push([split[i], split[i + 1]]);
      return lines;
    }
    exports.resolveBlockScalar = resolveBlockScalar;
  }
});

// ../../node_modules/yaml/dist/compose/resolve-flow-scalar.js
var require_resolve_flow_scalar = __commonJS({
  "../../node_modules/yaml/dist/compose/resolve-flow-scalar.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var resolveEnd = require_resolve_end();
    function resolveFlowScalar(scalar, strict, onError) {
      const { offset, type, source, end } = scalar;
      let _type;
      let value;
      const _onError = (rel, code, msg) => onError(offset + rel, code, msg);
      switch (type) {
        case "scalar":
          _type = Scalar.Scalar.PLAIN;
          value = plainValue(source, _onError);
          break;
        case "single-quoted-scalar":
          _type = Scalar.Scalar.QUOTE_SINGLE;
          value = singleQuotedValue(source, _onError);
          break;
        case "double-quoted-scalar":
          _type = Scalar.Scalar.QUOTE_DOUBLE;
          value = doubleQuotedValue(source, _onError);
          break;
        /* istanbul ignore next should not happen */
        default:
          onError(scalar, "UNEXPECTED_TOKEN", `Expected a flow scalar value, but found: ${type}`);
          return {
            value: "",
            type: null,
            comment: "",
            range: [offset, offset + source.length, offset + source.length]
          };
      }
      const valueEnd = offset + source.length;
      const re = resolveEnd.resolveEnd(end, valueEnd, strict, onError);
      return {
        value,
        type: _type,
        comment: re.comment,
        range: [offset, valueEnd, re.offset]
      };
    }
    function plainValue(source, onError) {
      let badChar = "";
      switch (source[0]) {
        /* istanbul ignore next should not happen */
        case "	":
          badChar = "a tab character";
          break;
        case ",":
          badChar = "flow indicator character ,";
          break;
        case "%":
          badChar = "directive indicator character %";
          break;
        case "|":
        case ">": {
          badChar = `block scalar indicator ${source[0]}`;
          break;
        }
        case "@":
        case "`": {
          badChar = `reserved character ${source[0]}`;
          break;
        }
      }
      if (badChar)
        onError(0, "BAD_SCALAR_START", `Plain value cannot start with ${badChar}`);
      return foldLines(source);
    }
    function singleQuotedValue(source, onError) {
      if (source[source.length - 1] !== "'" || source.length === 1)
        onError(source.length, "MISSING_CHAR", "Missing closing 'quote");
      return foldLines(source.slice(1, -1)).replace(/''/g, "'");
    }
    function foldLines(source) {
      let first, line;
      try {
        first = new RegExp("(.*?)(?<![ 	])[ 	]*\r?\n", "sy");
        line = new RegExp("[ 	]*(.*?)(?:(?<![ 	])[ 	]*)?\r?\n", "sy");
      } catch {
        first = /(.*?)[ \t]*\r?\n/sy;
        line = /[ \t]*(.*?)[ \t]*\r?\n/sy;
      }
      let match = first.exec(source);
      if (!match)
        return source;
      let res = match[1];
      let sep2 = " ";
      let pos = first.lastIndex;
      line.lastIndex = pos;
      while (match = line.exec(source)) {
        if (match[1] === "") {
          if (sep2 === "\n")
            res += sep2;
          else
            sep2 = "\n";
        } else {
          res += sep2 + match[1];
          sep2 = " ";
        }
        pos = line.lastIndex;
      }
      const last = /[ \t]*(.*)/sy;
      last.lastIndex = pos;
      match = last.exec(source);
      return res + sep2 + (match?.[1] ?? "");
    }
    function doubleQuotedValue(source, onError) {
      let res = "";
      for (let i = 1; i < source.length - 1; ++i) {
        const ch = source[i];
        if (ch === "\r" && source[i + 1] === "\n")
          continue;
        if (ch === "\n") {
          const { fold, offset } = foldNewline(source, i);
          res += fold;
          i = offset;
        } else if (ch === "\\") {
          let next = source[++i];
          const cc = escapeCodes[next];
          if (cc)
            res += cc;
          else if (next === "\n") {
            next = source[i + 1];
            while (next === " " || next === "	")
              next = source[++i + 1];
          } else if (next === "\r" && source[i + 1] === "\n") {
            next = source[++i + 1];
            while (next === " " || next === "	")
              next = source[++i + 1];
          } else if (next === "x" || next === "u" || next === "U") {
            const length = next === "x" ? 2 : next === "u" ? 4 : 8;
            res += parseCharCode(source, i + 1, length, onError);
            i += length;
          } else {
            const raw = source.substr(i - 1, 2);
            onError(i - 1, "BAD_DQ_ESCAPE", `Invalid escape sequence ${raw}`);
            res += raw;
          }
        } else if (ch === " " || ch === "	") {
          const wsStart = i;
          let next = source[i + 1];
          while (next === " " || next === "	")
            next = source[++i + 1];
          if (next !== "\n" && !(next === "\r" && source[i + 2] === "\n"))
            res += i > wsStart ? source.slice(wsStart, i + 1) : ch;
        } else {
          res += ch;
        }
      }
      if (source[source.length - 1] !== '"' || source.length === 1)
        onError(source.length, "MISSING_CHAR", 'Missing closing "quote');
      return res;
    }
    function foldNewline(source, offset) {
      let fold = "";
      let ch = source[offset + 1];
      while (ch === " " || ch === "	" || ch === "\n" || ch === "\r") {
        if (ch === "\r" && source[offset + 2] !== "\n")
          break;
        if (ch === "\n")
          fold += "\n";
        offset += 1;
        ch = source[offset + 1];
      }
      if (!fold)
        fold = " ";
      return { fold, offset };
    }
    var escapeCodes = {
      "0": "\0",
      // null character
      a: "\x07",
      // bell character
      b: "\b",
      // backspace
      e: "\x1B",
      // escape character
      f: "\f",
      // form feed
      n: "\n",
      // line feed
      r: "\r",
      // carriage return
      t: "	",
      // horizontal tab
      v: "\v",
      // vertical tab
      N: "\x85",
      // Unicode next line
      _: "\xA0",
      // Unicode non-breaking space
      L: "\u2028",
      // Unicode line separator
      P: "\u2029",
      // Unicode paragraph separator
      " ": " ",
      '"': '"',
      "/": "/",
      "\\": "\\",
      "	": "	"
    };
    function parseCharCode(source, offset, length, onError) {
      const cc = source.substr(offset, length);
      const ok = cc.length === length && /^[0-9a-fA-F]+$/.test(cc);
      const code = ok ? parseInt(cc, 16) : NaN;
      try {
        return String.fromCodePoint(code);
      } catch {
        const raw = source.substr(offset - 2, length + 2);
        onError(offset - 2, "BAD_DQ_ESCAPE", `Invalid escape sequence ${raw}`);
        return raw;
      }
    }
    exports.resolveFlowScalar = resolveFlowScalar;
  }
});

// ../../node_modules/yaml/dist/compose/compose-scalar.js
var require_compose_scalar = __commonJS({
  "../../node_modules/yaml/dist/compose/compose-scalar.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Scalar = require_Scalar();
    var resolveBlockScalar = require_resolve_block_scalar();
    var resolveFlowScalar = require_resolve_flow_scalar();
    function composeScalar(ctx, token, tagToken, onError) {
      const { value, type, comment, range } = token.type === "block-scalar" ? resolveBlockScalar.resolveBlockScalar(ctx, token, onError) : resolveFlowScalar.resolveFlowScalar(token, ctx.options.strict, onError);
      const tagName = tagToken ? ctx.directives.tagName(tagToken.source, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg)) : null;
      let tag;
      if (ctx.options.stringKeys && ctx.atKey) {
        tag = ctx.schema[identity.SCALAR];
      } else if (tagName)
        tag = findScalarTagByName(ctx.schema, value, tagName, tagToken, onError);
      else if (token.type === "scalar")
        tag = findScalarTagByTest(ctx, value, token, onError);
      else
        tag = ctx.schema[identity.SCALAR];
      let scalar;
      try {
        const res = tag.resolve(value, (msg) => onError(tagToken ?? token, "TAG_RESOLVE_FAILED", msg), ctx.options);
        scalar = identity.isScalar(res) ? res : new Scalar.Scalar(res);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        onError(tagToken ?? token, "TAG_RESOLVE_FAILED", msg);
        scalar = new Scalar.Scalar(value);
      }
      scalar.range = range;
      scalar.source = value;
      if (type)
        scalar.type = type;
      if (tagName)
        scalar.tag = tagName;
      if (tag.format)
        scalar.format = tag.format;
      if (comment)
        scalar.comment = comment;
      return scalar;
    }
    function findScalarTagByName(schema, value, tagName, tagToken, onError) {
      if (tagName === "!")
        return schema[identity.SCALAR];
      const matchWithTest = [];
      for (const tag of schema.tags) {
        if (!tag.collection && tag.tag === tagName) {
          if (tag.default && tag.test)
            matchWithTest.push(tag);
          else
            return tag;
        }
      }
      for (const tag of matchWithTest)
        if (tag.test?.test(value))
          return tag;
      const kt = schema.knownTags[tagName];
      if (kt && !kt.collection) {
        schema.tags.push(Object.assign({}, kt, { default: false, test: void 0 }));
        return kt;
      }
      onError(tagToken, "TAG_RESOLVE_FAILED", `Unresolved tag: ${tagName}`, tagName !== "tag:yaml.org,2002:str");
      return schema[identity.SCALAR];
    }
    function findScalarTagByTest({ atKey, directives, schema }, value, token, onError) {
      const tag = schema.tags.find((tag2) => (tag2.default === true || atKey && tag2.default === "key") && tag2.test?.test(value)) || schema[identity.SCALAR];
      if (schema.compat) {
        const compat = schema.compat.find((tag2) => tag2.default && tag2.test?.test(value)) ?? schema[identity.SCALAR];
        if (tag.tag !== compat.tag) {
          const ts = directives.tagString(tag.tag);
          const cs = directives.tagString(compat.tag);
          const msg = `Value may be parsed as either ${ts} or ${cs}`;
          onError(token, "TAG_RESOLVE_FAILED", msg, true);
        }
      }
      return tag;
    }
    exports.composeScalar = composeScalar;
  }
});

// ../../node_modules/yaml/dist/compose/util-empty-scalar-position.js
var require_util_empty_scalar_position = __commonJS({
  "../../node_modules/yaml/dist/compose/util-empty-scalar-position.js"(exports) {
    "use strict";
    function emptyScalarPosition(offset, before, pos) {
      if (before) {
        pos ?? (pos = before.length);
        for (let i = pos - 1; i >= 0; --i) {
          let st = before[i];
          switch (st.type) {
            case "space":
            case "comment":
            case "newline":
              offset -= st.source.length;
              continue;
          }
          st = before[++i];
          while (st?.type === "space") {
            offset += st.source.length;
            st = before[++i];
          }
          break;
        }
      }
      return offset;
    }
    exports.emptyScalarPosition = emptyScalarPosition;
  }
});

// ../../node_modules/yaml/dist/compose/compose-node.js
var require_compose_node = __commonJS({
  "../../node_modules/yaml/dist/compose/compose-node.js"(exports) {
    "use strict";
    var Alias = require_Alias();
    var identity = require_identity();
    var composeCollection = require_compose_collection();
    var composeScalar = require_compose_scalar();
    var resolveEnd = require_resolve_end();
    var utilEmptyScalarPosition = require_util_empty_scalar_position();
    var CN = { composeNode, composeEmptyNode };
    function composeNode(ctx, token, props, onError) {
      const atKey = ctx.atKey;
      const { spaceBefore, comment, anchor, tag } = props;
      let node;
      let isSrcToken = true;
      switch (token.type) {
        case "alias":
          node = composeAlias(ctx, token, onError);
          if (anchor || tag)
            onError(token, "ALIAS_PROPS", "An alias node must not specify any properties");
          break;
        case "scalar":
        case "single-quoted-scalar":
        case "double-quoted-scalar":
        case "block-scalar":
          node = composeScalar.composeScalar(ctx, token, tag, onError);
          if (anchor)
            node.anchor = anchor.source.substring(1);
          break;
        case "block-map":
        case "block-seq":
        case "flow-collection":
          try {
            node = composeCollection.composeCollection(CN, ctx, token, props, onError);
            if (anchor)
              node.anchor = anchor.source.substring(1);
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            onError(token, "RESOURCE_EXHAUSTION", message);
          }
          break;
        default: {
          const message = token.type === "error" ? token.message : `Unsupported token (type: ${token.type})`;
          onError(token, "UNEXPECTED_TOKEN", message);
          isSrcToken = false;
        }
      }
      node ?? (node = composeEmptyNode(ctx, token.offset, void 0, null, props, onError));
      if (anchor && node.anchor === "")
        onError(anchor, "BAD_ALIAS", "Anchor cannot be an empty string");
      if (atKey && ctx.options.stringKeys && (!identity.isScalar(node) || typeof node.value !== "string" || node.tag && node.tag !== "tag:yaml.org,2002:str")) {
        const msg = "With stringKeys, all keys must be strings";
        onError(tag ?? token, "NON_STRING_KEY", msg);
      }
      if (spaceBefore)
        node.spaceBefore = true;
      if (comment) {
        if (token.type === "scalar" && token.source === "")
          node.comment = comment;
        else
          node.commentBefore = comment;
      }
      if (ctx.options.keepSourceTokens && isSrcToken)
        node.srcToken = token;
      return node;
    }
    function composeEmptyNode(ctx, offset, before, pos, { spaceBefore, comment, anchor, tag, end }, onError) {
      const token = {
        type: "scalar",
        offset: utilEmptyScalarPosition.emptyScalarPosition(offset, before, pos),
        indent: -1,
        source: ""
      };
      const node = composeScalar.composeScalar(ctx, token, tag, onError);
      if (anchor) {
        node.anchor = anchor.source.substring(1);
        if (node.anchor === "")
          onError(anchor, "BAD_ALIAS", "Anchor cannot be an empty string");
      }
      if (spaceBefore)
        node.spaceBefore = true;
      if (comment) {
        node.comment = comment;
        node.range[2] = end;
      }
      return node;
    }
    function composeAlias({ options }, { offset, source, end }, onError) {
      const alias = new Alias.Alias(source.substring(1));
      if (alias.source === "")
        onError(offset, "BAD_ALIAS", "Alias cannot be an empty string");
      if (alias.source.endsWith(":"))
        onError(offset + source.length - 1, "BAD_ALIAS", "Alias ending in : is ambiguous", true);
      const valueEnd = offset + source.length;
      const re = resolveEnd.resolveEnd(end, valueEnd, options.strict, onError);
      alias.range = [offset, valueEnd, re.offset];
      if (re.comment)
        alias.comment = re.comment;
      return alias;
    }
    exports.composeEmptyNode = composeEmptyNode;
    exports.composeNode = composeNode;
  }
});

// ../../node_modules/yaml/dist/compose/compose-doc.js
var require_compose_doc = __commonJS({
  "../../node_modules/yaml/dist/compose/compose-doc.js"(exports) {
    "use strict";
    var Document = require_Document();
    var composeNode = require_compose_node();
    var resolveEnd = require_resolve_end();
    var resolveProps = require_resolve_props();
    function composeDoc(options, directives, { offset, start, value, end }, onError) {
      const opts = Object.assign({ _directives: directives }, options);
      const doc = new Document.Document(void 0, opts);
      const ctx = {
        atKey: false,
        atRoot: true,
        directives: doc.directives,
        options: doc.options,
        schema: doc.schema
      };
      const props = resolveProps.resolveProps(start, {
        indicator: "doc-start",
        next: value ?? end?.[0],
        offset,
        onError,
        parentIndent: 0,
        startOnNewline: true
      });
      if (props.found) {
        doc.directives.docStart = true;
        if (value && (value.type === "block-map" || value.type === "block-seq") && !props.hasNewline)
          onError(props.end, "MISSING_CHAR", "Block collection cannot start on same line with directives-end marker");
      }
      doc.contents = value ? composeNode.composeNode(ctx, value, props, onError) : composeNode.composeEmptyNode(ctx, props.end, start, null, props, onError);
      const contentEnd = doc.contents.range[2];
      const re = resolveEnd.resolveEnd(end, contentEnd, false, onError);
      if (re.comment)
        doc.comment = re.comment;
      doc.range = [offset, contentEnd, re.offset];
      return doc;
    }
    exports.composeDoc = composeDoc;
  }
});

// ../../node_modules/yaml/dist/compose/composer.js
var require_composer = __commonJS({
  "../../node_modules/yaml/dist/compose/composer.js"(exports) {
    "use strict";
    var node_process = __require("process");
    var directives = require_directives();
    var Document = require_Document();
    var errors = require_errors();
    var identity = require_identity();
    var composeDoc = require_compose_doc();
    var resolveEnd = require_resolve_end();
    function getErrorPos(src) {
      if (typeof src === "number")
        return [src, src + 1];
      if (Array.isArray(src))
        return src.length === 2 ? src : [src[0], src[1]];
      const { offset, source } = src;
      return [offset, offset + (typeof source === "string" ? source.length : 1)];
    }
    function parsePrelude(prelude) {
      let comment = "";
      let atComment = false;
      let afterEmptyLine = false;
      for (let i = 0; i < prelude.length; ++i) {
        const source = prelude[i];
        switch (source[0]) {
          case "#":
            comment += (comment === "" ? "" : afterEmptyLine ? "\n\n" : "\n") + (source.substring(1) || " ");
            atComment = true;
            afterEmptyLine = false;
            break;
          case "%":
            if (prelude[i + 1]?.[0] !== "#")
              i += 1;
            atComment = false;
            break;
          default:
            if (!atComment)
              afterEmptyLine = true;
            atComment = false;
        }
      }
      return { comment, afterEmptyLine };
    }
    var Composer = class {
      constructor(options = {}) {
        this.doc = null;
        this.atDirectives = false;
        this.prelude = [];
        this.errors = [];
        this.warnings = [];
        this.onError = (source, code, message, warning) => {
          const pos = getErrorPos(source);
          if (warning)
            this.warnings.push(new errors.YAMLWarning(pos, code, message));
          else
            this.errors.push(new errors.YAMLParseError(pos, code, message));
        };
        this.directives = new directives.Directives({ version: options.version || "1.2" });
        this.options = options;
      }
      decorate(doc, afterDoc) {
        const { comment, afterEmptyLine } = parsePrelude(this.prelude);
        if (comment) {
          const dc = doc.contents;
          if (afterDoc) {
            doc.comment = doc.comment ? `${doc.comment}
${comment}` : comment;
          } else if (afterEmptyLine || doc.directives.docStart || !dc) {
            doc.commentBefore = comment;
          } else if (identity.isCollection(dc) && !dc.flow && dc.items.length > 0) {
            let it = dc.items[0];
            if (identity.isPair(it))
              it = it.key;
            const cb = it.commentBefore;
            it.commentBefore = cb ? `${comment}
${cb}` : comment;
          } else {
            const cb = dc.commentBefore;
            dc.commentBefore = cb ? `${comment}
${cb}` : comment;
          }
        }
        if (afterDoc) {
          for (let i = 0; i < this.errors.length; ++i)
            doc.errors.push(this.errors[i]);
          for (let i = 0; i < this.warnings.length; ++i)
            doc.warnings.push(this.warnings[i]);
        } else {
          doc.errors = this.errors;
          doc.warnings = this.warnings;
        }
        this.prelude = [];
        this.errors = [];
        this.warnings = [];
      }
      /**
       * Current stream status information.
       *
       * Mostly useful at the end of input for an empty stream.
       */
      streamInfo() {
        return {
          comment: parsePrelude(this.prelude).comment,
          directives: this.directives,
          errors: this.errors,
          warnings: this.warnings
        };
      }
      /**
       * Compose tokens into documents.
       *
       * @param forceDoc - If the stream contains no document, still emit a final document including any comments and directives that would be applied to a subsequent document.
       * @param endOffset - Should be set if `forceDoc` is also set, to set the document range end and to indicate errors correctly.
       */
      *compose(tokens, forceDoc = false, endOffset = -1) {
        for (const token of tokens)
          yield* this.next(token);
        yield* this.end(forceDoc, endOffset);
      }
      /** Advance the composer by one CST token. */
      *next(token) {
        if (node_process.env.LOG_STREAM)
          console.dir(token, { depth: null });
        switch (token.type) {
          case "directive":
            this.directives.add(token.source, (offset, message, warning) => {
              const pos = getErrorPos(token);
              pos[0] += offset;
              this.onError(pos, "BAD_DIRECTIVE", message, warning);
            });
            this.prelude.push(token.source);
            this.atDirectives = true;
            break;
          case "document": {
            const doc = composeDoc.composeDoc(this.options, this.directives, token, this.onError);
            if (this.atDirectives && !doc.directives.docStart)
              this.onError(token, "MISSING_CHAR", "Missing directives-end/doc-start indicator line");
            this.decorate(doc, false);
            if (this.doc)
              yield this.doc;
            this.doc = doc;
            this.atDirectives = false;
            break;
          }
          case "byte-order-mark":
          case "space":
            break;
          case "comment":
          case "newline":
            this.prelude.push(token.source);
            break;
          case "error": {
            const msg = token.source ? `${token.message}: ${JSON.stringify(token.source)}` : token.message;
            const error = new errors.YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", msg);
            if (this.atDirectives || !this.doc)
              this.errors.push(error);
            else
              this.doc.errors.push(error);
            break;
          }
          case "doc-end": {
            if (!this.doc) {
              const msg = "Unexpected doc-end without preceding document";
              this.errors.push(new errors.YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", msg));
              break;
            }
            this.doc.directives.docEnd = true;
            const end = resolveEnd.resolveEnd(token.end, token.offset + token.source.length, this.doc.options.strict, this.onError);
            this.decorate(this.doc, true);
            if (end.comment) {
              const dc = this.doc.comment;
              this.doc.comment = dc ? `${dc}
${end.comment}` : end.comment;
            }
            this.doc.range[2] = end.offset;
            break;
          }
          default:
            this.errors.push(new errors.YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", `Unsupported token ${token.type}`));
        }
      }
      /**
       * Call at end of input to yield any remaining document.
       *
       * @param forceDoc - If the stream contains no document, still emit a final document including any comments and directives that would be applied to a subsequent document.
       * @param endOffset - Should be set if `forceDoc` is also set, to set the document range end and to indicate errors correctly.
       */
      *end(forceDoc = false, endOffset = -1) {
        if (this.doc) {
          this.decorate(this.doc, true);
          yield this.doc;
          this.doc = null;
        } else if (forceDoc) {
          const opts = Object.assign({ _directives: this.directives }, this.options);
          const doc = new Document.Document(void 0, opts);
          if (this.atDirectives)
            this.onError(endOffset, "MISSING_CHAR", "Missing directives-end indicator line");
          doc.range = [0, endOffset, endOffset];
          this.decorate(doc, false);
          yield doc;
        }
      }
    };
    exports.Composer = Composer;
  }
});

// ../../node_modules/yaml/dist/parse/cst-scalar.js
var require_cst_scalar = __commonJS({
  "../../node_modules/yaml/dist/parse/cst-scalar.js"(exports) {
    "use strict";
    var resolveBlockScalar = require_resolve_block_scalar();
    var resolveFlowScalar = require_resolve_flow_scalar();
    var errors = require_errors();
    var stringifyString = require_stringifyString();
    function resolveAsScalar(token, strict = true, onError) {
      if (token) {
        const _onError = (pos, code, message) => {
          const offset = typeof pos === "number" ? pos : Array.isArray(pos) ? pos[0] : pos.offset;
          if (onError)
            onError(offset, code, message);
          else
            throw new errors.YAMLParseError([offset, offset + 1], code, message);
        };
        switch (token.type) {
          case "scalar":
          case "single-quoted-scalar":
          case "double-quoted-scalar":
            return resolveFlowScalar.resolveFlowScalar(token, strict, _onError);
          case "block-scalar":
            return resolveBlockScalar.resolveBlockScalar({ options: { strict } }, token, _onError);
        }
      }
      return null;
    }
    function createScalarToken(value, context) {
      const { implicitKey = false, indent, inFlow = false, offset = -1, type = "PLAIN" } = context;
      const source = stringifyString.stringifyString({ type, value }, {
        implicitKey,
        indent: indent > 0 ? " ".repeat(indent) : "",
        inFlow,
        options: { blockQuote: true, lineWidth: -1 }
      });
      const end = context.end ?? [
        { type: "newline", offset: -1, indent, source: "\n" }
      ];
      switch (source[0]) {
        case "|":
        case ">": {
          const he = source.indexOf("\n");
          const head = source.substring(0, he);
          const body = source.substring(he + 1) + "\n";
          const props = [
            { type: "block-scalar-header", offset, indent, source: head }
          ];
          if (!addEndtoBlockProps(props, end))
            props.push({ type: "newline", offset: -1, indent, source: "\n" });
          return { type: "block-scalar", offset, indent, props, source: body };
        }
        case '"':
          return { type: "double-quoted-scalar", offset, indent, source, end };
        case "'":
          return { type: "single-quoted-scalar", offset, indent, source, end };
        default:
          return { type: "scalar", offset, indent, source, end };
      }
    }
    function setScalarValue(token, value, context = {}) {
      let { afterKey = false, implicitKey = false, inFlow = false, type } = context;
      let indent = "indent" in token ? token.indent : null;
      if (afterKey && typeof indent === "number")
        indent += 2;
      if (!type)
        switch (token.type) {
          case "single-quoted-scalar":
            type = "QUOTE_SINGLE";
            break;
          case "double-quoted-scalar":
            type = "QUOTE_DOUBLE";
            break;
          case "block-scalar": {
            const header = token.props[0];
            if (header.type !== "block-scalar-header")
              throw new Error("Invalid block scalar header");
            type = header.source[0] === ">" ? "BLOCK_FOLDED" : "BLOCK_LITERAL";
            break;
          }
          default:
            type = "PLAIN";
        }
      const source = stringifyString.stringifyString({ type, value }, {
        implicitKey: implicitKey || indent === null,
        indent: indent !== null && indent > 0 ? " ".repeat(indent) : "",
        inFlow,
        options: { blockQuote: true, lineWidth: -1 }
      });
      switch (source[0]) {
        case "|":
        case ">":
          setBlockScalarValue(token, source);
          break;
        case '"':
          setFlowScalarValue(token, source, "double-quoted-scalar");
          break;
        case "'":
          setFlowScalarValue(token, source, "single-quoted-scalar");
          break;
        default:
          setFlowScalarValue(token, source, "scalar");
      }
    }
    function setBlockScalarValue(token, source) {
      const he = source.indexOf("\n");
      const head = source.substring(0, he);
      const body = source.substring(he + 1) + "\n";
      if (token.type === "block-scalar") {
        const header = token.props[0];
        if (header.type !== "block-scalar-header")
          throw new Error("Invalid block scalar header");
        header.source = head;
        token.source = body;
      } else {
        const { offset } = token;
        const indent = "indent" in token ? token.indent : -1;
        const props = [
          { type: "block-scalar-header", offset, indent, source: head }
        ];
        if (!addEndtoBlockProps(props, "end" in token ? token.end : void 0))
          props.push({ type: "newline", offset: -1, indent, source: "\n" });
        for (const key of Object.keys(token))
          if (key !== "type" && key !== "offset")
            delete token[key];
        Object.assign(token, { type: "block-scalar", indent, props, source: body });
      }
    }
    function addEndtoBlockProps(props, end) {
      if (end)
        for (const st of end)
          switch (st.type) {
            case "space":
            case "comment":
              props.push(st);
              break;
            case "newline":
              props.push(st);
              return true;
          }
      return false;
    }
    function setFlowScalarValue(token, source, type) {
      switch (token.type) {
        case "scalar":
        case "double-quoted-scalar":
        case "single-quoted-scalar":
          token.type = type;
          token.source = source;
          break;
        case "block-scalar": {
          const end = token.props.slice(1);
          let oa = source.length;
          if (token.props[0].type === "block-scalar-header")
            oa -= token.props[0].source.length;
          for (const tok of end)
            tok.offset += oa;
          delete token.props;
          Object.assign(token, { type, source, end });
          break;
        }
        case "block-map":
        case "block-seq": {
          const offset = token.offset + source.length;
          const nl = { type: "newline", offset, indent: token.indent, source: "\n" };
          delete token.items;
          Object.assign(token, { type, source, end: [nl] });
          break;
        }
        default: {
          const indent = "indent" in token ? token.indent : -1;
          const end = "end" in token && Array.isArray(token.end) ? token.end.filter((st) => st.type === "space" || st.type === "comment" || st.type === "newline") : [];
          for (const key of Object.keys(token))
            if (key !== "type" && key !== "offset")
              delete token[key];
          Object.assign(token, { type, indent, source, end });
        }
      }
    }
    exports.createScalarToken = createScalarToken;
    exports.resolveAsScalar = resolveAsScalar;
    exports.setScalarValue = setScalarValue;
  }
});

// ../../node_modules/yaml/dist/parse/cst-stringify.js
var require_cst_stringify = __commonJS({
  "../../node_modules/yaml/dist/parse/cst-stringify.js"(exports) {
    "use strict";
    var stringify = (cst) => "type" in cst ? stringifyToken(cst) : stringifyItem(cst);
    function stringifyToken(token) {
      switch (token.type) {
        case "block-scalar": {
          let res = "";
          for (const tok of token.props)
            res += stringifyToken(tok);
          return res + token.source;
        }
        case "block-map":
        case "block-seq": {
          let res = "";
          for (const item of token.items)
            res += stringifyItem(item);
          return res;
        }
        case "flow-collection": {
          let res = token.start.source;
          for (const item of token.items)
            res += stringifyItem(item);
          for (const st of token.end)
            res += st.source;
          return res;
        }
        case "document": {
          let res = stringifyItem(token);
          if (token.end)
            for (const st of token.end)
              res += st.source;
          return res;
        }
        default: {
          let res = token.source;
          if ("end" in token && token.end)
            for (const st of token.end)
              res += st.source;
          return res;
        }
      }
    }
    function stringifyItem({ start, key, sep: sep2, value }) {
      let res = "";
      for (const st of start)
        res += st.source;
      if (key)
        res += stringifyToken(key);
      if (sep2)
        for (const st of sep2)
          res += st.source;
      if (value)
        res += stringifyToken(value);
      return res;
    }
    exports.stringify = stringify;
  }
});

// ../../node_modules/yaml/dist/parse/cst-visit.js
var require_cst_visit = __commonJS({
  "../../node_modules/yaml/dist/parse/cst-visit.js"(exports) {
    "use strict";
    var BREAK = /* @__PURE__ */ Symbol("break visit");
    var SKIP = /* @__PURE__ */ Symbol("skip children");
    var REMOVE = /* @__PURE__ */ Symbol("remove item");
    function visit(cst, visitor) {
      if ("type" in cst && cst.type === "document")
        cst = { start: cst.start, value: cst.value };
      _visit(Object.freeze([]), cst, visitor);
    }
    visit.BREAK = BREAK;
    visit.SKIP = SKIP;
    visit.REMOVE = REMOVE;
    visit.itemAtPath = (cst, path) => {
      let item = cst;
      for (const [field, index] of path) {
        const tok = item?.[field];
        if (tok && "items" in tok) {
          item = tok.items[index];
        } else
          return void 0;
      }
      return item;
    };
    visit.parentCollection = (cst, path) => {
      const parent = visit.itemAtPath(cst, path.slice(0, -1));
      const field = path[path.length - 1][0];
      const coll = parent?.[field];
      if (coll && "items" in coll)
        return coll;
      throw new Error("Parent collection not found");
    };
    function _visit(path, item, visitor) {
      let ctrl = visitor(item, path);
      if (typeof ctrl === "symbol")
        return ctrl;
      for (const field of ["key", "value"]) {
        const token = item[field];
        if (token && "items" in token) {
          for (let i = 0; i < token.items.length; ++i) {
            const ci = _visit(Object.freeze(path.concat([[field, i]])), token.items[i], visitor);
            if (typeof ci === "number")
              i = ci - 1;
            else if (ci === BREAK)
              return BREAK;
            else if (ci === REMOVE) {
              token.items.splice(i, 1);
              i -= 1;
            }
          }
          if (typeof ctrl === "function" && field === "key")
            ctrl = ctrl(item, path);
        }
      }
      return typeof ctrl === "function" ? ctrl(item, path) : ctrl;
    }
    exports.visit = visit;
  }
});

// ../../node_modules/yaml/dist/parse/cst.js
var require_cst = __commonJS({
  "../../node_modules/yaml/dist/parse/cst.js"(exports) {
    "use strict";
    var cstScalar = require_cst_scalar();
    var cstStringify = require_cst_stringify();
    var cstVisit = require_cst_visit();
    var BOM = "\uFEFF";
    var DOCUMENT = "";
    var FLOW_END = "";
    var SCALAR = "";
    var isCollection = (token) => !!token && "items" in token;
    var isScalar = (token) => !!token && (token.type === "scalar" || token.type === "single-quoted-scalar" || token.type === "double-quoted-scalar" || token.type === "block-scalar");
    function prettyToken(token) {
      switch (token) {
        case BOM:
          return "<BOM>";
        case DOCUMENT:
          return "<DOC>";
        case FLOW_END:
          return "<FLOW_END>";
        case SCALAR:
          return "<SCALAR>";
        default:
          return JSON.stringify(token);
      }
    }
    function tokenType(source) {
      switch (source) {
        case BOM:
          return "byte-order-mark";
        case DOCUMENT:
          return "doc-mode";
        case FLOW_END:
          return "flow-error-end";
        case SCALAR:
          return "scalar";
        case "---":
          return "doc-start";
        case "...":
          return "doc-end";
        case "":
        case "\n":
        case "\r\n":
          return "newline";
        case "-":
          return "seq-item-ind";
        case "?":
          return "explicit-key-ind";
        case ":":
          return "map-value-ind";
        case "{":
          return "flow-map-start";
        case "}":
          return "flow-map-end";
        case "[":
          return "flow-seq-start";
        case "]":
          return "flow-seq-end";
        case ",":
          return "comma";
      }
      switch (source[0]) {
        case " ":
        case "	":
          return "space";
        case "#":
          return "comment";
        case "%":
          return "directive-line";
        case "*":
          return "alias";
        case "&":
          return "anchor";
        case "!":
          return "tag";
        case "'":
          return "single-quoted-scalar";
        case '"':
          return "double-quoted-scalar";
        case "|":
        case ">":
          return "block-scalar-header";
      }
      return null;
    }
    exports.createScalarToken = cstScalar.createScalarToken;
    exports.resolveAsScalar = cstScalar.resolveAsScalar;
    exports.setScalarValue = cstScalar.setScalarValue;
    exports.stringify = cstStringify.stringify;
    exports.visit = cstVisit.visit;
    exports.BOM = BOM;
    exports.DOCUMENT = DOCUMENT;
    exports.FLOW_END = FLOW_END;
    exports.SCALAR = SCALAR;
    exports.isCollection = isCollection;
    exports.isScalar = isScalar;
    exports.prettyToken = prettyToken;
    exports.tokenType = tokenType;
  }
});

// ../../node_modules/yaml/dist/parse/lexer.js
var require_lexer = __commonJS({
  "../../node_modules/yaml/dist/parse/lexer.js"(exports) {
    "use strict";
    var cst = require_cst();
    function isEmpty(ch) {
      switch (ch) {
        case void 0:
        case " ":
        case "\n":
        case "\r":
        case "	":
          return true;
        default:
          return false;
      }
    }
    var hexDigits = new Set("0123456789ABCDEFabcdef");
    var tagChars = new Set("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-#;/?:@&=+$_.!~*'()");
    var flowIndicatorChars = new Set(",[]{}");
    var invalidAnchorChars = new Set(" ,[]{}\n\r	");
    var isNotAnchorChar = (ch) => !ch || invalidAnchorChars.has(ch);
    var Lexer = class {
      constructor() {
        this.atEnd = false;
        this.blockScalarIndent = -1;
        this.blockScalarKeep = false;
        this.buffer = "";
        this.flowKey = false;
        this.flowLevel = 0;
        this.indentNext = 0;
        this.indentValue = 0;
        this.lineEndPos = null;
        this.next = null;
        this.pos = 0;
      }
      /**
       * Generate YAML tokens from the `source` string. If `incomplete`,
       * a part of the last line may be left as a buffer for the next call.
       *
       * @returns A generator of lexical tokens
       */
      *lex(source, incomplete = false) {
        if (source) {
          if (typeof source !== "string")
            throw TypeError("source is not a string");
          this.buffer = this.buffer ? this.buffer + source : source;
          this.lineEndPos = null;
        }
        this.atEnd = !incomplete;
        let next = this.next ?? "stream";
        while (next && (incomplete || this.hasChars(1)))
          next = yield* this.parseNext(next);
      }
      atLineEnd() {
        let i = this.pos;
        let ch = this.buffer[i];
        while (ch === " " || ch === "	")
          ch = this.buffer[++i];
        if (!ch || ch === "#" || ch === "\n")
          return true;
        if (ch === "\r")
          return this.buffer[i + 1] === "\n";
        return false;
      }
      charAt(n) {
        return this.buffer[this.pos + n];
      }
      continueScalar(offset) {
        let ch = this.buffer[offset];
        if (this.indentNext > 0) {
          let indent = 0;
          while (ch === " ")
            ch = this.buffer[++indent + offset];
          if (ch === "\r") {
            const next = this.buffer[indent + offset + 1];
            if (next === "\n" || !next && !this.atEnd)
              return offset + indent + 1;
          }
          return ch === "\n" || indent >= this.indentNext || !ch && !this.atEnd ? offset + indent : -1;
        }
        if (ch === "-" || ch === ".") {
          const dt = this.buffer.substr(offset, 3);
          if ((dt === "---" || dt === "...") && isEmpty(this.buffer[offset + 3]))
            return -1;
        }
        return offset;
      }
      getLine() {
        let end = this.lineEndPos;
        if (typeof end !== "number" || end !== -1 && end < this.pos) {
          end = this.buffer.indexOf("\n", this.pos);
          this.lineEndPos = end;
        }
        if (end === -1)
          return this.atEnd ? this.buffer.substring(this.pos) : null;
        if (this.buffer[end - 1] === "\r")
          end -= 1;
        return this.buffer.substring(this.pos, end);
      }
      hasChars(n) {
        return this.pos + n <= this.buffer.length;
      }
      setNext(state) {
        this.buffer = this.buffer.substring(this.pos);
        this.pos = 0;
        this.lineEndPos = null;
        this.next = state;
        return null;
      }
      peek(n) {
        return this.buffer.substr(this.pos, n);
      }
      *parseNext(next) {
        switch (next) {
          case "stream":
            return yield* this.parseStream();
          case "line-start":
            return yield* this.parseLineStart();
          case "block-start":
            return yield* this.parseBlockStart();
          case "doc":
            return yield* this.parseDocument();
          case "flow":
            return yield* this.parseFlowCollection();
          case "quoted-scalar":
            return yield* this.parseQuotedScalar();
          case "block-scalar":
            return yield* this.parseBlockScalar();
          case "plain-scalar":
            return yield* this.parsePlainScalar();
        }
      }
      *parseStream() {
        let line = this.getLine();
        if (line === null)
          return this.setNext("stream");
        if (line[0] === cst.BOM) {
          yield* this.pushCount(1);
          line = line.substring(1);
        }
        if (line[0] === "%") {
          let dirEnd = line.length;
          let cs = line.indexOf("#");
          while (cs !== -1) {
            const ch = line[cs - 1];
            if (ch === " " || ch === "	") {
              dirEnd = cs - 1;
              break;
            } else {
              cs = line.indexOf("#", cs + 1);
            }
          }
          while (true) {
            const ch = line[dirEnd - 1];
            if (ch === " " || ch === "	")
              dirEnd -= 1;
            else
              break;
          }
          const n = (yield* this.pushCount(dirEnd)) + (yield* this.pushSpaces(true));
          yield* this.pushCount(line.length - n);
          this.pushNewline();
          return "stream";
        }
        if (this.atLineEnd()) {
          const sp = yield* this.pushSpaces(true);
          yield* this.pushCount(line.length - sp);
          yield* this.pushNewline();
          return "stream";
        }
        yield cst.DOCUMENT;
        return yield* this.parseLineStart();
      }
      *parseLineStart() {
        const ch = this.charAt(0);
        if (!ch && !this.atEnd)
          return this.setNext("line-start");
        if (ch === "-" || ch === ".") {
          if (!this.atEnd && !this.hasChars(4))
            return this.setNext("line-start");
          const s = this.peek(3);
          if ((s === "---" || s === "...") && isEmpty(this.charAt(3))) {
            yield* this.pushCount(3);
            this.indentValue = 0;
            this.indentNext = 0;
            return s === "---" ? "doc" : "stream";
          }
        }
        this.indentValue = yield* this.pushSpaces(false);
        if (this.indentNext > this.indentValue && !isEmpty(this.charAt(1)))
          this.indentNext = this.indentValue;
        return yield* this.parseBlockStart();
      }
      *parseBlockStart() {
        const [ch0, ch1] = this.peek(2);
        if (!ch1 && !this.atEnd)
          return this.setNext("block-start");
        if ((ch0 === "-" || ch0 === "?" || ch0 === ":") && isEmpty(ch1)) {
          const n = (yield* this.pushCount(1)) + (yield* this.pushSpaces(true));
          this.indentNext = this.indentValue + 1;
          this.indentValue += n;
          return "block-start";
        }
        return "doc";
      }
      *parseDocument() {
        yield* this.pushSpaces(true);
        const line = this.getLine();
        if (line === null)
          return this.setNext("doc");
        let n = yield* this.pushIndicators();
        switch (line[n]) {
          case "#":
            yield* this.pushCount(line.length - n);
          // fallthrough
          case void 0:
            yield* this.pushNewline();
            return yield* this.parseLineStart();
          case "{":
          case "[":
            yield* this.pushCount(1);
            this.flowKey = false;
            this.flowLevel = 1;
            return "flow";
          case "}":
          case "]":
            yield* this.pushCount(1);
            return "doc";
          case "*":
            yield* this.pushUntil(isNotAnchorChar);
            return "doc";
          case '"':
          case "'":
            return yield* this.parseQuotedScalar();
          case "|":
          case ">":
            n += yield* this.parseBlockScalarHeader();
            n += yield* this.pushSpaces(true);
            yield* this.pushCount(line.length - n);
            yield* this.pushNewline();
            return yield* this.parseBlockScalar();
          default:
            return yield* this.parsePlainScalar();
        }
      }
      *parseFlowCollection() {
        let nl, sp;
        let indent = -1;
        do {
          nl = yield* this.pushNewline();
          if (nl > 0) {
            sp = yield* this.pushSpaces(false);
            this.indentValue = indent = sp;
          } else {
            sp = 0;
          }
          sp += yield* this.pushSpaces(true);
        } while (nl + sp > 0);
        const line = this.getLine();
        if (line === null)
          return this.setNext("flow");
        if (indent !== -1 && indent < this.indentNext && line[0] !== "#" || indent === 0 && (line.startsWith("---") || line.startsWith("...")) && isEmpty(line[3])) {
          const atFlowEndMarker = indent === this.indentNext - 1 && this.flowLevel === 1 && (line[0] === "]" || line[0] === "}");
          if (!atFlowEndMarker) {
            this.flowLevel = 0;
            yield cst.FLOW_END;
            return yield* this.parseLineStart();
          }
        }
        let n = 0;
        while (line[n] === ",") {
          n += yield* this.pushCount(1);
          n += yield* this.pushSpaces(true);
          this.flowKey = false;
        }
        n += yield* this.pushIndicators();
        switch (line[n]) {
          case void 0:
            return "flow";
          case "#":
            yield* this.pushCount(line.length - n);
            return "flow";
          case "{":
          case "[":
            yield* this.pushCount(1);
            this.flowKey = false;
            this.flowLevel += 1;
            return "flow";
          case "}":
          case "]":
            yield* this.pushCount(1);
            this.flowKey = true;
            this.flowLevel -= 1;
            return this.flowLevel ? "flow" : "doc";
          case "*":
            yield* this.pushUntil(isNotAnchorChar);
            return "flow";
          case '"':
          case "'":
            this.flowKey = true;
            return yield* this.parseQuotedScalar();
          case ":": {
            const next = this.charAt(1);
            if (this.flowKey || isEmpty(next) || next === ",") {
              this.flowKey = false;
              yield* this.pushCount(1);
              yield* this.pushSpaces(true);
              return "flow";
            }
          }
          // fallthrough
          default:
            this.flowKey = false;
            return yield* this.parsePlainScalar();
        }
      }
      *parseQuotedScalar() {
        const quote = this.charAt(0);
        let end = this.buffer.indexOf(quote, this.pos + 1);
        if (quote === "'") {
          while (end !== -1 && this.buffer[end + 1] === "'")
            end = this.buffer.indexOf("'", end + 2);
        } else {
          while (end !== -1) {
            let n = 0;
            while (this.buffer[end - 1 - n] === "\\")
              n += 1;
            if (n % 2 === 0)
              break;
            end = this.buffer.indexOf('"', end + 1);
          }
        }
        const qb = this.buffer.substring(0, end);
        let nl = qb.indexOf("\n", this.pos);
        if (nl !== -1) {
          while (nl !== -1) {
            const cs = this.continueScalar(nl + 1);
            if (cs === -1)
              break;
            nl = qb.indexOf("\n", cs);
          }
          if (nl !== -1) {
            end = nl - (qb[nl - 1] === "\r" ? 2 : 1);
          }
        }
        if (end === -1) {
          if (!this.atEnd)
            return this.setNext("quoted-scalar");
          end = this.buffer.length;
        }
        yield* this.pushToIndex(end + 1, false);
        return this.flowLevel ? "flow" : "doc";
      }
      *parseBlockScalarHeader() {
        this.blockScalarIndent = -1;
        this.blockScalarKeep = false;
        let i = this.pos;
        while (true) {
          const ch = this.buffer[++i];
          if (ch === "+")
            this.blockScalarKeep = true;
          else if (ch > "0" && ch <= "9")
            this.blockScalarIndent = Number(ch) - 1;
          else if (ch !== "-")
            break;
        }
        return yield* this.pushUntil((ch) => isEmpty(ch) || ch === "#");
      }
      *parseBlockScalar() {
        let nl = this.pos - 1;
        let indent = 0;
        let ch;
        loop: for (let i2 = this.pos; ch = this.buffer[i2]; ++i2) {
          switch (ch) {
            case " ":
              indent += 1;
              break;
            case "\n":
              nl = i2;
              indent = 0;
              break;
            case "\r": {
              const next = this.buffer[i2 + 1];
              if (!next && !this.atEnd)
                return this.setNext("block-scalar");
              if (next === "\n")
                break;
            }
            // fallthrough
            default:
              break loop;
          }
        }
        if (!ch && !this.atEnd)
          return this.setNext("block-scalar");
        if (indent >= this.indentNext) {
          if (this.blockScalarIndent === -1)
            this.indentNext = indent;
          else {
            this.indentNext = this.blockScalarIndent + (this.indentNext === 0 ? 1 : this.indentNext);
          }
          do {
            const cs = this.continueScalar(nl + 1);
            if (cs === -1)
              break;
            nl = this.buffer.indexOf("\n", cs);
          } while (nl !== -1);
          if (nl === -1) {
            if (!this.atEnd)
              return this.setNext("block-scalar");
            nl = this.buffer.length;
          }
        }
        let i = nl + 1;
        ch = this.buffer[i];
        while (ch === " ")
          ch = this.buffer[++i];
        if (ch === "	") {
          while (ch === "	" || ch === " " || ch === "\r" || ch === "\n")
            ch = this.buffer[++i];
          nl = i - 1;
        } else if (!this.blockScalarKeep) {
          do {
            let i2 = nl - 1;
            let ch2 = this.buffer[i2];
            if (ch2 === "\r")
              ch2 = this.buffer[--i2];
            const lastChar = i2;
            while (ch2 === " ")
              ch2 = this.buffer[--i2];
            if (ch2 === "\n" && i2 >= this.pos && i2 + 1 + indent > lastChar)
              nl = i2;
            else
              break;
          } while (true);
        }
        yield cst.SCALAR;
        yield* this.pushToIndex(nl + 1, true);
        return yield* this.parseLineStart();
      }
      *parsePlainScalar() {
        const inFlow = this.flowLevel > 0;
        let end = this.pos - 1;
        let i = this.pos - 1;
        let ch;
        while (ch = this.buffer[++i]) {
          if (ch === ":") {
            const next = this.buffer[i + 1];
            if (isEmpty(next) || inFlow && flowIndicatorChars.has(next))
              break;
            end = i;
          } else if (isEmpty(ch)) {
            let next = this.buffer[i + 1];
            if (ch === "\r") {
              if (next === "\n") {
                i += 1;
                ch = "\n";
                next = this.buffer[i + 1];
              } else
                end = i;
            }
            if (next === "#" || inFlow && flowIndicatorChars.has(next))
              break;
            if (ch === "\n") {
              const cs = this.continueScalar(i + 1);
              if (cs === -1)
                break;
              i = Math.max(i, cs - 2);
            }
          } else {
            if (inFlow && flowIndicatorChars.has(ch))
              break;
            end = i;
          }
        }
        if (!ch && !this.atEnd)
          return this.setNext("plain-scalar");
        yield cst.SCALAR;
        yield* this.pushToIndex(end + 1, true);
        return inFlow ? "flow" : "doc";
      }
      *pushCount(n) {
        if (n > 0) {
          yield this.buffer.substr(this.pos, n);
          this.pos += n;
          return n;
        }
        return 0;
      }
      *pushToIndex(i, allowEmpty) {
        const s = this.buffer.slice(this.pos, i);
        if (s) {
          yield s;
          this.pos += s.length;
          return s.length;
        } else if (allowEmpty)
          yield "";
        return 0;
      }
      *pushIndicators() {
        let n = 0;
        loop: while (true) {
          switch (this.charAt(0)) {
            case "!":
              n += yield* this.pushTag();
              n += yield* this.pushSpaces(true);
              continue loop;
            case "&":
              n += yield* this.pushUntil(isNotAnchorChar);
              n += yield* this.pushSpaces(true);
              continue loop;
            case "-":
            // this is an error
            case "?":
            // this is an error outside flow collections
            case ":": {
              const inFlow = this.flowLevel > 0;
              const ch1 = this.charAt(1);
              if (isEmpty(ch1) || inFlow && flowIndicatorChars.has(ch1)) {
                if (!inFlow)
                  this.indentNext = this.indentValue + 1;
                else if (this.flowKey)
                  this.flowKey = false;
                n += yield* this.pushCount(1);
                n += yield* this.pushSpaces(true);
                continue loop;
              }
            }
          }
          break loop;
        }
        return n;
      }
      *pushTag() {
        if (this.charAt(1) === "<") {
          let i = this.pos + 2;
          let ch = this.buffer[i];
          while (!isEmpty(ch) && ch !== ">")
            ch = this.buffer[++i];
          return yield* this.pushToIndex(ch === ">" ? i + 1 : i, false);
        } else {
          let i = this.pos + 1;
          let ch = this.buffer[i];
          while (ch) {
            if (tagChars.has(ch))
              ch = this.buffer[++i];
            else if (ch === "%" && hexDigits.has(this.buffer[i + 1]) && hexDigits.has(this.buffer[i + 2])) {
              ch = this.buffer[i += 3];
            } else
              break;
          }
          return yield* this.pushToIndex(i, false);
        }
      }
      *pushNewline() {
        const ch = this.buffer[this.pos];
        if (ch === "\n")
          return yield* this.pushCount(1);
        else if (ch === "\r" && this.charAt(1) === "\n")
          return yield* this.pushCount(2);
        else
          return 0;
      }
      *pushSpaces(allowTabs) {
        let i = this.pos - 1;
        let ch;
        do {
          ch = this.buffer[++i];
        } while (ch === " " || allowTabs && ch === "	");
        const n = i - this.pos;
        if (n > 0) {
          yield this.buffer.substr(this.pos, n);
          this.pos = i;
        }
        return n;
      }
      *pushUntil(test) {
        let i = this.pos;
        let ch = this.buffer[i];
        while (!test(ch))
          ch = this.buffer[++i];
        return yield* this.pushToIndex(i, false);
      }
    };
    exports.Lexer = Lexer;
  }
});

// ../../node_modules/yaml/dist/parse/line-counter.js
var require_line_counter = __commonJS({
  "../../node_modules/yaml/dist/parse/line-counter.js"(exports) {
    "use strict";
    var LineCounter = class {
      constructor() {
        this.lineStarts = [];
        this.addNewLine = (offset) => this.lineStarts.push(offset);
        this.linePos = (offset) => {
          let low = 0;
          let high = this.lineStarts.length;
          while (low < high) {
            const mid = low + high >> 1;
            if (this.lineStarts[mid] < offset)
              low = mid + 1;
            else
              high = mid;
          }
          if (this.lineStarts[low] === offset)
            return { line: low + 1, col: 1 };
          if (low === 0)
            return { line: 0, col: offset };
          const start = this.lineStarts[low - 1];
          return { line: low, col: offset - start + 1 };
        };
      }
    };
    exports.LineCounter = LineCounter;
  }
});

// ../../node_modules/yaml/dist/parse/parser.js
var require_parser = __commonJS({
  "../../node_modules/yaml/dist/parse/parser.js"(exports) {
    "use strict";
    var node_process = __require("process");
    var cst = require_cst();
    var lexer = require_lexer();
    function includesToken(list, type) {
      for (let i = 0; i < list.length; ++i)
        if (list[i].type === type)
          return true;
      return false;
    }
    function findNonEmptyIndex(list) {
      for (let i = 0; i < list.length; ++i) {
        switch (list[i].type) {
          case "space":
          case "comment":
          case "newline":
            break;
          default:
            return i;
        }
      }
      return -1;
    }
    function isFlowToken(token) {
      switch (token?.type) {
        case "alias":
        case "scalar":
        case "single-quoted-scalar":
        case "double-quoted-scalar":
        case "flow-collection":
          return true;
        default:
          return false;
      }
    }
    function getPrevProps(parent) {
      switch (parent.type) {
        case "document":
          return parent.start;
        case "block-map": {
          const it = parent.items[parent.items.length - 1];
          return it.sep ?? it.start;
        }
        case "block-seq":
          return parent.items[parent.items.length - 1].start;
        /* istanbul ignore next should not happen */
        default:
          return [];
      }
    }
    function getFirstKeyStartProps(prev) {
      if (prev.length === 0)
        return [];
      let i = prev.length;
      loop: while (--i >= 0) {
        switch (prev[i].type) {
          case "doc-start":
          case "explicit-key-ind":
          case "map-value-ind":
          case "seq-item-ind":
          case "newline":
            break loop;
        }
      }
      while (prev[++i]?.type === "space") {
      }
      return prev.splice(i, prev.length);
    }
    function arrayPushArray(target, source) {
      if (source.length < 1e5)
        Array.prototype.push.apply(target, source);
      else
        for (let i = 0; i < source.length; ++i)
          target.push(source[i]);
    }
    function fixFlowSeqItems(fc) {
      if (fc.start.type === "flow-seq-start") {
        for (const it of fc.items) {
          if (it.sep && !it.value && !includesToken(it.start, "explicit-key-ind") && !includesToken(it.sep, "map-value-ind")) {
            if (it.key)
              it.value = it.key;
            delete it.key;
            if (isFlowToken(it.value)) {
              if (it.value.end)
                arrayPushArray(it.value.end, it.sep);
              else
                it.value.end = it.sep;
            } else
              arrayPushArray(it.start, it.sep);
            delete it.sep;
          }
        }
      }
    }
    var Parser = class {
      /**
       * @param onNewLine - If defined, called separately with the start position of
       *   each new line (in `parse()`, including the start of input).
       */
      constructor(onNewLine) {
        this.atNewLine = true;
        this.atScalar = false;
        this.indent = 0;
        this.offset = 0;
        this.onKeyLine = false;
        this.stack = [];
        this.source = "";
        this.type = "";
        this.lexer = new lexer.Lexer();
        this.onNewLine = onNewLine;
      }
      /**
       * Parse `source` as a YAML stream.
       * If `incomplete`, a part of the last line may be left as a buffer for the next call.
       *
       * Errors are not thrown, but yielded as `{ type: 'error', message }` tokens.
       *
       * @returns A generator of tokens representing each directive, document, and other structure.
       */
      *parse(source, incomplete = false) {
        if (this.onNewLine && this.offset === 0)
          this.onNewLine(0);
        for (const lexeme of this.lexer.lex(source, incomplete))
          yield* this.next(lexeme);
        if (!incomplete)
          yield* this.end();
      }
      /**
       * Advance the parser by the `source` of one lexical token.
       */
      *next(source) {
        this.source = source;
        if (node_process.env.LOG_TOKENS)
          console.log("|", cst.prettyToken(source));
        if (this.atScalar) {
          this.atScalar = false;
          yield* this.step();
          this.offset += source.length;
          return;
        }
        const type = cst.tokenType(source);
        if (!type) {
          const message = `Not a YAML token: ${source}`;
          yield* this.pop({ type: "error", offset: this.offset, message, source });
          this.offset += source.length;
        } else if (type === "scalar") {
          this.atNewLine = false;
          this.atScalar = true;
          this.type = "scalar";
        } else {
          this.type = type;
          yield* this.step();
          switch (type) {
            case "newline":
              this.atNewLine = true;
              this.indent = 0;
              if (this.onNewLine)
                this.onNewLine(this.offset + source.length);
              break;
            case "space":
              if (this.atNewLine && source[0] === " ")
                this.indent += source.length;
              break;
            case "explicit-key-ind":
            case "map-value-ind":
            case "seq-item-ind":
              if (this.atNewLine)
                this.indent += source.length;
              break;
            case "doc-mode":
            case "flow-error-end":
              return;
            default:
              this.atNewLine = false;
          }
          this.offset += source.length;
        }
      }
      /** Call at end of input to push out any remaining constructions */
      *end() {
        while (this.stack.length > 0)
          yield* this.pop();
      }
      get sourceToken() {
        const st = {
          type: this.type,
          offset: this.offset,
          indent: this.indent,
          source: this.source
        };
        return st;
      }
      *step() {
        const top = this.peek(1);
        if (this.type === "doc-end" && top?.type !== "doc-end") {
          while (this.stack.length > 0)
            yield* this.pop();
          this.stack.push({
            type: "doc-end",
            offset: this.offset,
            source: this.source
          });
          return;
        }
        if (!top)
          return yield* this.stream();
        switch (top.type) {
          case "document":
            return yield* this.document(top);
          case "alias":
          case "scalar":
          case "single-quoted-scalar":
          case "double-quoted-scalar":
            return yield* this.scalar(top);
          case "block-scalar":
            return yield* this.blockScalar(top);
          case "block-map":
            return yield* this.blockMap(top);
          case "block-seq":
            return yield* this.blockSequence(top);
          case "flow-collection":
            return yield* this.flowCollection(top);
          case "doc-end":
            return yield* this.documentEnd(top);
        }
        yield* this.pop();
      }
      peek(n) {
        return this.stack[this.stack.length - n];
      }
      *pop(error) {
        const token = error ?? this.stack.pop();
        if (!token) {
          const message = "Tried to pop an empty stack";
          yield { type: "error", offset: this.offset, source: "", message };
        } else if (this.stack.length === 0) {
          yield token;
        } else {
          const top = this.peek(1);
          if (token.type === "block-scalar") {
            token.indent = "indent" in top ? top.indent : 0;
          } else if (token.type === "flow-collection" && top.type === "document") {
            token.indent = 0;
          }
          if (token.type === "flow-collection")
            fixFlowSeqItems(token);
          switch (top.type) {
            case "document":
              top.value = token;
              break;
            case "block-scalar":
              top.props.push(token);
              break;
            case "block-map": {
              const it = top.items[top.items.length - 1];
              if (it.value) {
                top.items.push({ start: [], key: token, sep: [] });
                this.onKeyLine = true;
                return;
              } else if (it.sep) {
                it.value = token;
              } else {
                Object.assign(it, { key: token, sep: [] });
                this.onKeyLine = !it.explicitKey;
                return;
              }
              break;
            }
            case "block-seq": {
              const it = top.items[top.items.length - 1];
              if (it.value)
                top.items.push({ start: [], value: token });
              else
                it.value = token;
              break;
            }
            case "flow-collection": {
              const it = top.items[top.items.length - 1];
              if (!it || it.value)
                top.items.push({ start: [], key: token, sep: [] });
              else if (it.sep)
                it.value = token;
              else
                Object.assign(it, { key: token, sep: [] });
              return;
            }
            /* istanbul ignore next should not happen */
            default:
              yield* this.pop();
              yield* this.pop(token);
          }
          if ((top.type === "document" || top.type === "block-map" || top.type === "block-seq") && (token.type === "block-map" || token.type === "block-seq")) {
            const last = token.items[token.items.length - 1];
            if (last && !last.sep && !last.value && last.start.length > 0 && findNonEmptyIndex(last.start) === -1 && (token.indent === 0 || last.start.every((st) => st.type !== "comment" || st.indent < token.indent))) {
              if (top.type === "document")
                top.end = last.start;
              else
                top.items.push({ start: last.start });
              token.items.splice(-1, 1);
            }
          }
        }
      }
      *stream() {
        switch (this.type) {
          case "directive-line":
            yield { type: "directive", offset: this.offset, source: this.source };
            return;
          case "byte-order-mark":
          case "space":
          case "comment":
          case "newline":
            yield this.sourceToken;
            return;
          case "doc-mode":
          case "doc-start": {
            const doc = {
              type: "document",
              offset: this.offset,
              start: []
            };
            if (this.type === "doc-start")
              doc.start.push(this.sourceToken);
            this.stack.push(doc);
            return;
          }
        }
        yield {
          type: "error",
          offset: this.offset,
          message: `Unexpected ${this.type} token in YAML stream`,
          source: this.source
        };
      }
      *document(doc) {
        if (doc.value)
          return yield* this.lineEnd(doc);
        switch (this.type) {
          case "doc-start": {
            if (findNonEmptyIndex(doc.start) !== -1) {
              yield* this.pop();
              yield* this.step();
            } else
              doc.start.push(this.sourceToken);
            return;
          }
          case "anchor":
          case "tag":
          case "space":
          case "comment":
          case "newline":
            doc.start.push(this.sourceToken);
            return;
        }
        const bv = this.startBlockValue(doc);
        if (bv)
          this.stack.push(bv);
        else {
          yield {
            type: "error",
            offset: this.offset,
            message: `Unexpected ${this.type} token in YAML document`,
            source: this.source
          };
        }
      }
      *scalar(scalar) {
        if (this.type === "map-value-ind") {
          const prev = getPrevProps(this.peek(2));
          const start = getFirstKeyStartProps(prev);
          let sep2;
          if (scalar.end) {
            sep2 = scalar.end;
            sep2.push(this.sourceToken);
            delete scalar.end;
          } else
            sep2 = [this.sourceToken];
          const map = {
            type: "block-map",
            offset: scalar.offset,
            indent: scalar.indent,
            items: [{ start, key: scalar, sep: sep2 }]
          };
          this.onKeyLine = true;
          this.stack[this.stack.length - 1] = map;
        } else
          yield* this.lineEnd(scalar);
      }
      *blockScalar(scalar) {
        switch (this.type) {
          case "space":
          case "comment":
          case "newline":
            scalar.props.push(this.sourceToken);
            return;
          case "scalar":
            scalar.source = this.source;
            this.atNewLine = true;
            this.indent = 0;
            if (this.onNewLine) {
              let nl = this.source.indexOf("\n") + 1;
              while (nl !== 0) {
                this.onNewLine(this.offset + nl);
                nl = this.source.indexOf("\n", nl) + 1;
              }
            }
            yield* this.pop();
            break;
          /* istanbul ignore next should not happen */
          default:
            yield* this.pop();
            yield* this.step();
        }
      }
      *blockMap(map) {
        const it = map.items[map.items.length - 1];
        switch (this.type) {
          case "newline":
            this.onKeyLine = false;
            if (it.value) {
              const end = "end" in it.value ? it.value.end : void 0;
              const last = Array.isArray(end) ? end[end.length - 1] : void 0;
              if (last?.type === "comment")
                end?.push(this.sourceToken);
              else
                map.items.push({ start: [this.sourceToken] });
            } else if (it.sep) {
              it.sep.push(this.sourceToken);
            } else {
              it.start.push(this.sourceToken);
            }
            return;
          case "space":
          case "comment":
            if (it.value) {
              map.items.push({ start: [this.sourceToken] });
            } else if (it.sep) {
              it.sep.push(this.sourceToken);
            } else {
              if (this.atIndentedComment(it.start, map.indent)) {
                const prev = map.items[map.items.length - 2];
                const end = prev?.value?.end;
                if (Array.isArray(end)) {
                  arrayPushArray(end, it.start);
                  end.push(this.sourceToken);
                  map.items.pop();
                  return;
                }
              }
              it.start.push(this.sourceToken);
            }
            return;
        }
        if (this.indent >= map.indent) {
          const atMapIndent = !this.onKeyLine && this.indent === map.indent;
          const atNextItem = atMapIndent && (it.sep || it.explicitKey) && this.type !== "seq-item-ind";
          let start = [];
          if (atNextItem && it.sep && !it.value) {
            const nl = [];
            for (let i = 0; i < it.sep.length; ++i) {
              const st = it.sep[i];
              switch (st.type) {
                case "newline":
                  nl.push(i);
                  break;
                case "space":
                  break;
                case "comment":
                  if (st.indent > map.indent)
                    nl.length = 0;
                  break;
                default:
                  nl.length = 0;
              }
            }
            if (nl.length >= 2)
              start = it.sep.splice(nl[1]);
          }
          switch (this.type) {
            case "anchor":
            case "tag":
              if (atNextItem || it.value) {
                start.push(this.sourceToken);
                map.items.push({ start });
                this.onKeyLine = true;
              } else if (it.sep) {
                it.sep.push(this.sourceToken);
              } else {
                it.start.push(this.sourceToken);
              }
              return;
            case "explicit-key-ind":
              if (!it.sep && !it.explicitKey) {
                it.start.push(this.sourceToken);
                it.explicitKey = true;
              } else if (atNextItem || it.value) {
                start.push(this.sourceToken);
                map.items.push({ start, explicitKey: true });
              } else {
                this.stack.push({
                  type: "block-map",
                  offset: this.offset,
                  indent: this.indent,
                  items: [{ start: [this.sourceToken], explicitKey: true }]
                });
              }
              this.onKeyLine = true;
              return;
            case "map-value-ind":
              if (it.explicitKey) {
                if (!it.sep) {
                  if (includesToken(it.start, "newline")) {
                    Object.assign(it, { key: null, sep: [this.sourceToken] });
                  } else {
                    const start2 = getFirstKeyStartProps(it.start);
                    this.stack.push({
                      type: "block-map",
                      offset: this.offset,
                      indent: this.indent,
                      items: [{ start: start2, key: null, sep: [this.sourceToken] }]
                    });
                  }
                } else if (it.value) {
                  map.items.push({ start: [], key: null, sep: [this.sourceToken] });
                } else if (includesToken(it.sep, "map-value-ind")) {
                  this.stack.push({
                    type: "block-map",
                    offset: this.offset,
                    indent: this.indent,
                    items: [{ start, key: null, sep: [this.sourceToken] }]
                  });
                } else if (isFlowToken(it.key) && !includesToken(it.sep, "newline")) {
                  const start2 = getFirstKeyStartProps(it.start);
                  const key = it.key;
                  const sep2 = it.sep;
                  sep2.push(this.sourceToken);
                  delete it.key;
                  delete it.sep;
                  this.stack.push({
                    type: "block-map",
                    offset: this.offset,
                    indent: this.indent,
                    items: [{ start: start2, key, sep: sep2 }]
                  });
                } else if (start.length > 0) {
                  it.sep = it.sep.concat(start, this.sourceToken);
                } else {
                  it.sep.push(this.sourceToken);
                }
              } else {
                if (!it.sep) {
                  Object.assign(it, { key: null, sep: [this.sourceToken] });
                } else if (it.value || atNextItem) {
                  map.items.push({ start, key: null, sep: [this.sourceToken] });
                } else if (includesToken(it.sep, "map-value-ind")) {
                  this.stack.push({
                    type: "block-map",
                    offset: this.offset,
                    indent: this.indent,
                    items: [{ start: [], key: null, sep: [this.sourceToken] }]
                  });
                } else {
                  it.sep.push(this.sourceToken);
                }
              }
              this.onKeyLine = true;
              return;
            case "alias":
            case "scalar":
            case "single-quoted-scalar":
            case "double-quoted-scalar": {
              const fs = this.flowScalar(this.type);
              if (atNextItem || it.value) {
                map.items.push({ start, key: fs, sep: [] });
                this.onKeyLine = true;
              } else if (it.sep) {
                this.stack.push(fs);
              } else {
                Object.assign(it, { key: fs, sep: [] });
                this.onKeyLine = true;
              }
              return;
            }
            default: {
              const bv = this.startBlockValue(map);
              if (bv) {
                if (bv.type === "block-seq") {
                  if (!it.explicitKey && it.sep && !includesToken(it.sep, "newline")) {
                    yield* this.pop({
                      type: "error",
                      offset: this.offset,
                      message: "Unexpected block-seq-ind on same line with key",
                      source: this.source
                    });
                    return;
                  }
                } else if (atMapIndent) {
                  map.items.push({ start });
                }
                this.stack.push(bv);
                return;
              }
            }
          }
        }
        yield* this.pop();
        yield* this.step();
      }
      *blockSequence(seq) {
        const it = seq.items[seq.items.length - 1];
        switch (this.type) {
          case "newline":
            if (it.value) {
              const end = "end" in it.value ? it.value.end : void 0;
              const last = Array.isArray(end) ? end[end.length - 1] : void 0;
              if (last?.type === "comment")
                end?.push(this.sourceToken);
              else
                seq.items.push({ start: [this.sourceToken] });
            } else
              it.start.push(this.sourceToken);
            return;
          case "space":
          case "comment":
            if (it.value)
              seq.items.push({ start: [this.sourceToken] });
            else {
              if (this.atIndentedComment(it.start, seq.indent)) {
                const prev = seq.items[seq.items.length - 2];
                const end = prev?.value?.end;
                if (Array.isArray(end)) {
                  arrayPushArray(end, it.start);
                  end.push(this.sourceToken);
                  seq.items.pop();
                  return;
                }
              }
              it.start.push(this.sourceToken);
            }
            return;
          case "anchor":
          case "tag":
            if (it.value || this.indent <= seq.indent)
              break;
            it.start.push(this.sourceToken);
            return;
          case "seq-item-ind":
            if (this.indent !== seq.indent)
              break;
            if (it.value || includesToken(it.start, "seq-item-ind"))
              seq.items.push({ start: [this.sourceToken] });
            else
              it.start.push(this.sourceToken);
            return;
        }
        if (this.indent > seq.indent) {
          const bv = this.startBlockValue(seq);
          if (bv) {
            this.stack.push(bv);
            return;
          }
        }
        yield* this.pop();
        yield* this.step();
      }
      *flowCollection(fc) {
        const it = fc.items[fc.items.length - 1];
        if (this.type === "flow-error-end") {
          let top;
          do {
            yield* this.pop();
            top = this.peek(1);
          } while (top?.type === "flow-collection");
        } else if (fc.end.length === 0) {
          switch (this.type) {
            case "comma":
            case "explicit-key-ind":
              if (!it || it.sep)
                fc.items.push({ start: [this.sourceToken] });
              else
                it.start.push(this.sourceToken);
              return;
            case "map-value-ind":
              if (!it || it.value)
                fc.items.push({ start: [], key: null, sep: [this.sourceToken] });
              else if (it.sep)
                it.sep.push(this.sourceToken);
              else
                Object.assign(it, { key: null, sep: [this.sourceToken] });
              return;
            case "space":
            case "comment":
            case "newline":
            case "anchor":
            case "tag":
              if (!it || it.value)
                fc.items.push({ start: [this.sourceToken] });
              else if (it.sep)
                it.sep.push(this.sourceToken);
              else
                it.start.push(this.sourceToken);
              return;
            case "alias":
            case "scalar":
            case "single-quoted-scalar":
            case "double-quoted-scalar": {
              const fs = this.flowScalar(this.type);
              if (!it || it.value)
                fc.items.push({ start: [], key: fs, sep: [] });
              else if (it.sep)
                this.stack.push(fs);
              else
                Object.assign(it, { key: fs, sep: [] });
              return;
            }
            case "flow-map-end":
            case "flow-seq-end":
              fc.end.push(this.sourceToken);
              return;
          }
          const bv = this.startBlockValue(fc);
          if (bv)
            this.stack.push(bv);
          else {
            yield* this.pop();
            yield* this.step();
          }
        } else {
          const parent = this.peek(2);
          if (parent.type === "block-map" && (this.type === "map-value-ind" && parent.indent === fc.indent || this.type === "newline" && !parent.items[parent.items.length - 1].sep)) {
            yield* this.pop();
            yield* this.step();
          } else if (this.type === "map-value-ind" && parent.type !== "flow-collection") {
            const prev = getPrevProps(parent);
            const start = getFirstKeyStartProps(prev);
            fixFlowSeqItems(fc);
            const sep2 = fc.end.splice(1, fc.end.length);
            sep2.push(this.sourceToken);
            const map = {
              type: "block-map",
              offset: fc.offset,
              indent: fc.indent,
              items: [{ start, key: fc, sep: sep2 }]
            };
            this.onKeyLine = true;
            this.stack[this.stack.length - 1] = map;
          } else {
            yield* this.lineEnd(fc);
          }
        }
      }
      flowScalar(type) {
        if (this.onNewLine) {
          let nl = this.source.indexOf("\n") + 1;
          while (nl !== 0) {
            this.onNewLine(this.offset + nl);
            nl = this.source.indexOf("\n", nl) + 1;
          }
        }
        return {
          type,
          offset: this.offset,
          indent: this.indent,
          source: this.source
        };
      }
      startBlockValue(parent) {
        switch (this.type) {
          case "alias":
          case "scalar":
          case "single-quoted-scalar":
          case "double-quoted-scalar":
            return this.flowScalar(this.type);
          case "block-scalar-header":
            return {
              type: "block-scalar",
              offset: this.offset,
              indent: this.indent,
              props: [this.sourceToken],
              source: ""
            };
          case "flow-map-start":
          case "flow-seq-start":
            return {
              type: "flow-collection",
              offset: this.offset,
              indent: this.indent,
              start: this.sourceToken,
              items: [],
              end: []
            };
          case "seq-item-ind":
            return {
              type: "block-seq",
              offset: this.offset,
              indent: this.indent,
              items: [{ start: [this.sourceToken] }]
            };
          case "explicit-key-ind": {
            this.onKeyLine = true;
            const prev = getPrevProps(parent);
            const start = getFirstKeyStartProps(prev);
            start.push(this.sourceToken);
            return {
              type: "block-map",
              offset: this.offset,
              indent: this.indent,
              items: [{ start, explicitKey: true }]
            };
          }
          case "map-value-ind": {
            this.onKeyLine = true;
            const prev = getPrevProps(parent);
            const start = getFirstKeyStartProps(prev);
            return {
              type: "block-map",
              offset: this.offset,
              indent: this.indent,
              items: [{ start, key: null, sep: [this.sourceToken] }]
            };
          }
        }
        return null;
      }
      atIndentedComment(start, indent) {
        if (this.type !== "comment")
          return false;
        if (this.indent <= indent)
          return false;
        return start.every((st) => st.type === "newline" || st.type === "space");
      }
      *documentEnd(docEnd) {
        if (this.type !== "doc-mode") {
          if (docEnd.end)
            docEnd.end.push(this.sourceToken);
          else
            docEnd.end = [this.sourceToken];
          if (this.type === "newline")
            yield* this.pop();
        }
      }
      *lineEnd(token) {
        switch (this.type) {
          case "comma":
          case "doc-start":
          case "doc-end":
          case "flow-seq-end":
          case "flow-map-end":
          case "map-value-ind":
            yield* this.pop();
            yield* this.step();
            break;
          case "newline":
            this.onKeyLine = false;
          // fallthrough
          case "space":
          case "comment":
          default:
            if (token.end)
              token.end.push(this.sourceToken);
            else
              token.end = [this.sourceToken];
            if (this.type === "newline")
              yield* this.pop();
        }
      }
    };
    exports.Parser = Parser;
  }
});

// ../../node_modules/yaml/dist/public-api.js
var require_public_api = __commonJS({
  "../../node_modules/yaml/dist/public-api.js"(exports) {
    "use strict";
    var composer = require_composer();
    var Document = require_Document();
    var errors = require_errors();
    var log = require_log();
    var identity = require_identity();
    var lineCounter = require_line_counter();
    var parser = require_parser();
    function parseOptions(options) {
      const prettyErrors = options.prettyErrors !== false;
      const lineCounter$1 = options.lineCounter || prettyErrors && new lineCounter.LineCounter() || null;
      return { lineCounter: lineCounter$1, prettyErrors };
    }
    function parseAllDocuments(source, options = {}) {
      const { lineCounter: lineCounter2, prettyErrors } = parseOptions(options);
      const parser$1 = new parser.Parser(lineCounter2?.addNewLine);
      const composer$1 = new composer.Composer(options);
      const docs = Array.from(composer$1.compose(parser$1.parse(source)));
      if (prettyErrors && lineCounter2)
        for (const doc of docs) {
          doc.errors.forEach(errors.prettifyError(source, lineCounter2));
          doc.warnings.forEach(errors.prettifyError(source, lineCounter2));
        }
      if (docs.length > 0)
        return docs;
      return Object.assign([], { empty: true }, composer$1.streamInfo());
    }
    function parseDocument(source, options = {}) {
      const { lineCounter: lineCounter2, prettyErrors } = parseOptions(options);
      const parser$1 = new parser.Parser(lineCounter2?.addNewLine);
      const composer$1 = new composer.Composer(options);
      let doc = null;
      for (const _doc of composer$1.compose(parser$1.parse(source), true, source.length)) {
        if (!doc)
          doc = _doc;
        else if (doc.options.logLevel !== "silent") {
          doc.errors.push(new errors.YAMLParseError(_doc.range.slice(0, 2), "MULTIPLE_DOCS", "Source contains multiple documents; please use YAML.parseAllDocuments()"));
          break;
        }
      }
      if (prettyErrors && lineCounter2) {
        doc.errors.forEach(errors.prettifyError(source, lineCounter2));
        doc.warnings.forEach(errors.prettifyError(source, lineCounter2));
      }
      return doc;
    }
    function parse2(src, reviver, options) {
      let _reviver = void 0;
      if (typeof reviver === "function") {
        _reviver = reviver;
      } else if (options === void 0 && reviver && typeof reviver === "object") {
        options = reviver;
      }
      const doc = parseDocument(src, options);
      if (!doc)
        return null;
      doc.warnings.forEach((warning) => log.warn(doc.options.logLevel, warning));
      if (doc.errors.length > 0) {
        if (doc.options.logLevel !== "silent")
          throw doc.errors[0];
        else
          doc.errors = [];
      }
      return doc.toJS(Object.assign({ reviver: _reviver }, options));
    }
    function stringify(value, replacer, options) {
      let _replacer = null;
      if (typeof replacer === "function" || Array.isArray(replacer)) {
        _replacer = replacer;
      } else if (options === void 0 && replacer) {
        options = replacer;
      }
      if (typeof options === "string")
        options = options.length;
      if (typeof options === "number") {
        const indent = Math.round(options);
        options = indent < 1 ? void 0 : indent > 8 ? { indent: 8 } : { indent };
      }
      if (value === void 0) {
        const { keepUndefined } = options ?? replacer ?? {};
        if (!keepUndefined)
          return void 0;
      }
      if (identity.isDocument(value) && !_replacer)
        return value.toString(options);
      return new Document.Document(value, _replacer, options).toString(options);
    }
    exports.parse = parse2;
    exports.parseAllDocuments = parseAllDocuments;
    exports.parseDocument = parseDocument;
    exports.stringify = stringify;
  }
});

// ../../node_modules/yaml/dist/index.js
var require_dist = __commonJS({
  "../../node_modules/yaml/dist/index.js"(exports) {
    "use strict";
    var composer = require_composer();
    var Document = require_Document();
    var Schema = require_Schema();
    var errors = require_errors();
    var Alias = require_Alias();
    var identity = require_identity();
    var Pair = require_Pair();
    var Scalar = require_Scalar();
    var YAMLMap = require_YAMLMap();
    var YAMLSeq = require_YAMLSeq();
    var cst = require_cst();
    var lexer = require_lexer();
    var lineCounter = require_line_counter();
    var parser = require_parser();
    var publicApi = require_public_api();
    var visit = require_visit();
    exports.Composer = composer.Composer;
    exports.Document = Document.Document;
    exports.Schema = Schema.Schema;
    exports.YAMLError = errors.YAMLError;
    exports.YAMLParseError = errors.YAMLParseError;
    exports.YAMLWarning = errors.YAMLWarning;
    exports.Alias = Alias.Alias;
    exports.isAlias = identity.isAlias;
    exports.isCollection = identity.isCollection;
    exports.isDocument = identity.isDocument;
    exports.isMap = identity.isMap;
    exports.isNode = identity.isNode;
    exports.isPair = identity.isPair;
    exports.isScalar = identity.isScalar;
    exports.isSeq = identity.isSeq;
    exports.Pair = Pair.Pair;
    exports.Scalar = Scalar.Scalar;
    exports.YAMLMap = YAMLMap.YAMLMap;
    exports.YAMLSeq = YAMLSeq.YAMLSeq;
    exports.CST = cst;
    exports.Lexer = lexer.Lexer;
    exports.LineCounter = lineCounter.LineCounter;
    exports.Parser = parser.Parser;
    exports.parse = publicApi.parse;
    exports.parseAllDocuments = publicApi.parseAllDocuments;
    exports.parseDocument = publicApi.parseDocument;
    exports.stringify = publicApi.stringify;
    exports.visit = visit.visit;
    exports.visitAsync = visit.visitAsync;
  }
});

// src/index.ts
import { readFile as readFile3 } from "fs/promises";
import { resolve as resolve2 } from "path";

// ../../node_modules/commander/esm.mjs
var import_index = __toESM(require_commander(), 1);
var {
  program,
  createCommand,
  createArgument,
  createOption,
  CommanderError,
  InvalidArgumentError,
  InvalidOptionArgumentError,
  // deprecated old name
  Command,
  Argument,
  Option,
  Help
} = import_index.default;

// ../../packages/core/src/localization/messages.ts
var zhMessages = {
  "App updates": "\u5E94\u7528\u66F4\u65B0",
  "Version checks and automatic updates": "\u7248\u672C\u68C0\u6D4B\u4E0E\u81EA\u52A8\u66F4\u65B0",
  "Get new versions from the official GitHub release.": "\u4ECE\u5B98\u65B9 GitHub Release \u83B7\u53D6\u65B0\u7248\u672C\u3002",
  "Current version: {0}": "\u5F53\u524D\u7248\u672C\uFF1A{0}",
  "Ready to check for updates.": "\u53EF\u4EE5\u68C0\u67E5\u65B0\u7248\u672C\u3002",
  "Checking for updates\u2026": "\u6B63\u5728\u68C0\u67E5\u66F4\u65B0\u2026",
  "You are using the latest version.": "\u5F53\u524D\u5DF2\u662F\u6700\u65B0\u7248\u672C\u3002",
  "Version {0} is available.": "\u53D1\u73B0\u65B0\u7248\u672C {0}\u3002",
  "Downloading update\u2026 {0}%": "\u6B63\u5728\u4E0B\u8F7D\u66F4\u65B0\u2026 {0}%",
  "Version {0} is ready. It will install when you quit.": "\u7248\u672C {0} \u5DF2\u5C31\u7EEA\uFF0C\u9000\u51FA\u5E94\u7528\u65F6\u5C06\u5B89\u88C5\u66F4\u65B0\u3002",
  "No published update is available yet. Try again later.": "\u6682\u65F6\u6CA1\u6709\u5DF2\u53D1\u5E03\u7684\u66F4\u65B0\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002",
  "Could not check or download the update. Check your connection and try again.": "\u68C0\u67E5\u6216\u4E0B\u8F7D\u66F4\u65B0\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5\u7F51\u7EDC\u540E\u91CD\u8BD5\u3002",
  "Update download progress": "\u66F4\u65B0\u4E0B\u8F7D\u8FDB\u5EA6",
  "Update checks are available in the installed desktop app.": "\u5B89\u88C5\u7248\u684C\u9762\u5E94\u7528\u652F\u6301\u68C0\u6D4B\u66F4\u65B0\u3002",
  "This macOS build requires a manual update. Download the new version from Releases.": "\u6B64 macOS \u6784\u5EFA\u9700\u8981\u624B\u52A8\u66F4\u65B0\uFF0C\u8BF7\u4ECE Release \u4E0B\u8F7D\u65B0\u7248\u672C\u3002",
  "Update this Linux package using your package installer, or use the AppImage for automatic updates.": "\u8BF7\u4F7F\u7528\u8F6F\u4EF6\u5305\u5B89\u88C5\u5668\u66F4\u65B0\u6B64 Linux \u7248\u672C\uFF0C\u6216\u4F7F\u7528\u652F\u6301\u81EA\u52A8\u66F4\u65B0\u7684 AppImage\u3002",
  "Automatically check for updates": "\u81EA\u52A8\u68C0\u67E5\u66F4\u65B0",
  "Check once after startup.": "\u542F\u52A8\u540E\u68C0\u67E5\u4E00\u6B21\u3002",
  "Automatically download updates": "\u81EA\u52A8\u4E0B\u8F7D\u66F4\u65B0",
  "Downloaded updates install on exit, after your work is saved.": "\u66F4\u65B0\u4E0B\u8F7D\u540E\uFF0C\u5728\u4FDD\u5B58\u5DE5\u4F5C\u5E76\u9000\u51FA\u5E94\u7528\u65F6\u5B89\u88C5\u3002",
  "Check for updates": "\u68C0\u67E5\u66F4\u65B0",
  "Download update": "\u4E0B\u8F7D\u66F4\u65B0",
  "Quit and install update": "\u9000\u51FA\u5E76\u5B89\u88C5\u66F4\u65B0",
  "View releases": "\u67E5\u770B\u53D1\u5E03\u7248\u672C",
  "Could not complete the update action. Try again.": "\u672A\u80FD\u5B8C\u6210\u66F4\u65B0\u64CD\u4F5C\uFF0C\u8BF7\u91CD\u8BD5\u3002",
  "Run all upstream": "\u8FD0\u884C\u5168\u90E8\u4E0A\u6E38",
  "Run all downstream": "\u8FD0\u884C\u5168\u90E8\u4E0B\u6E38",
  "Rerun all upstream dependencies, then this Agent": "\u91CD\u65B0\u8FD0\u884C\u5168\u90E8\u4E0A\u6E38\u4F9D\u8D56\uFF0C\u6700\u540E\u8FD0\u884C\u5F53\u524D Agent",
  "Rerun this Agent and every downstream node, reusing other upstream outputs": "\u91CD\u65B0\u8FD0\u884C\u5F53\u524D Agent \u53CA\u5168\u90E8\u4E0B\u6E38\u8282\u70B9\uFF0C\u590D\u7528\u5176\u4ED6\u4E0A\u6E38\u7684\u5DF2\u6709\u6210\u679C",
  "Missing reusable upstream output: {0}. Run those Agents first.": "\u7F3A\u5C11\u53EF\u590D\u7528\u7684\u4E0A\u6E38\u6210\u679C\uFF1A{0}\u3002\u8BF7\u5148\u8FD0\u884C\u8FD9\u4E9B Agent\u3002",
  "Upstream run completed through {0}": "\u5168\u90E8\u4E0A\u6E38\u53CA {0} \u5DF2\u8FD0\u884C\u5B8C\u6210",
  "Downstream run completed from {0}": "\u4ECE {0} \u5F00\u59CB\u7684\u5168\u90E8\u4E0B\u6E38\u5DF2\u8FD0\u884C\u5B8C\u6210",
  "The provider returned an invalid response": "\u6A21\u578B\u670D\u52A1\u8FD4\u56DE\u4E86\u65E0\u6548\u7684\u54CD\u5E94",
  "The Agent did not return any usable output files": "Agent \u6CA1\u6709\u8FD4\u56DE\u53EF\u7528\u7684\u8F93\u51FA\u6587\u4EF6",
  "Model request timed out after {0} seconds": "\u6A21\u578B\u8BF7\u6C42\u8D85\u65F6\uFF08{0} \u79D2\uFF09",
  "The provider reported an error: {0}": "\u6A21\u578B\u670D\u52A1\u8FD4\u56DE\u9519\u8BEF\uFF1A{0}",
  "The provider returned malformed streaming data": "\u6A21\u578B\u670D\u52A1\u8FD4\u56DE\u4E86\u683C\u5F0F\u9519\u8BEF\u7684\u6D41\u5F0F\u6570\u636E",
  "The provider stopped before completing the response: {0}": "\u6A21\u578B\u670D\u52A1\u672A\u5B8C\u6210\u54CD\u5E94\u5C31\u505C\u6B62\u4E86\uFF1A{0}",
  "This batch launcher cannot preserve these arguments. Configure its executable or Node entry point directly.": "\u6B64\u6279\u5904\u7406\u542F\u52A8\u5668\u65E0\u6CD5\u5B8C\u6574\u4FDD\u7559\u8FD9\u4E9B\u53C2\u6570\u3002\u8BF7\u76F4\u63A5\u914D\u7F6E\u5DE5\u5177\u7684\u53EF\u6267\u884C\u6587\u4EF6\u6216 Node \u5165\u53E3\u3002",
  "{0} is disabled in settings": "{0} \u5DF2\u5728\u8BBE\u7F6E\u4E2D\u505C\u7528",
  "{0} finished without returning text or output files": "{0} \u5DF2\u7ED3\u675F\uFF0C\u4F46\u6CA1\u6709\u8FD4\u56DE\u6587\u672C\u6216\u8F93\u51FA\u6587\u4EF6",
  "Output files generated: {0}": "\u5DF2\u751F\u6210 {0} \u4E2A\u8F93\u51FA\u6587\u4EF6",
  "No error details": "\u6CA1\u6709\u9519\u8BEF\u8BE6\u60C5",
  "Your {0} login has expired. Reconnect in Settings \u2192 Subscription accounts and try again.": "{0} \u7684\u767B\u5F55\u5DF2\u5931\u6548\u3002\u8BF7\u524D\u5F80\u201C\u8BBE\u7F6E \u2192 \u8BA2\u9605\u8D26\u6237\u201D\u91CD\u65B0\u8FDE\u63A5\u540E\u518D\u8BD5\u3002",
  "Antigravity is installed but needs a valid login. Go to Settings \u2192 Local Agent tools \u2192 Antigravity, click \u201CSign in with Google\u201D, and paste the authorization code.": "Antigravity \u5DF2\u5B89\u88C5\uFF0C\u4F46\u5C1A\u672A\u767B\u5F55\u6216\u767B\u5F55\u5DF2\u5931\u6548\u3002\u8BF7\u524D\u5F80\u201C\u8BBE\u7F6E \u2192 \u672C\u673A Agent \u5DE5\u5177 \u2192 Antigravity\u201D\u70B9\u51FB\u201C\u767B\u5F55 Google\u201D\uFF0C\u7C98\u8D34\u7F51\u9875\u6388\u6743\u7801\u540E\u91CD\u8BD5\u3002",
  "{0} is installed but needs a valid login. Run \u201C{1}\u201D in a terminal, sign in, then return to AgentFlow and try again.": "{0} \u5DF2\u5B89\u88C5\uFF0C\u4F46\u5C1A\u672A\u767B\u5F55\u6216\u767B\u5F55\u5DF2\u5931\u6548\u3002\u8BF7\u5148\u5728\u7EC8\u7AEF\u8FD0\u884C\u201C{1}\u201D\uFF0C\u5B8C\u6210\u767B\u5F55\u540E\u56DE\u5230 AgentFlow \u91CD\u8BD5\u3002",
  "{0} exited with code {1}: {2}": "{0} \u9000\u51FA\u7801 {1}\uFF1A{2}",
  "The output directory does not exist ({0}): {1}": "\u6307\u5B9A\u8F93\u51FA\u76EE\u5F55\u4E0D\u5B58\u5728\uFF08{0}\uFF09\uFF1A{1}",
  "The output path is not a directory: {0}": "\u6307\u5B9A\u8F93\u51FA\u4E0D\u662F\u76EE\u5F55\uFF1A{0}",
  "The Agent tool did not produce final text or files": "Agent \u5DE5\u5177\u6CA1\u6709\u751F\u6210\u6700\u7EC8\u8F93\u51FA\u6587\u672C\u6216\u6587\u4EF6",
  "An output directory can contain up to 100 collected files": "\u6307\u5B9A\u8F93\u51FA\u76EE\u5F55\u6700\u591A\u6536\u96C6 100 \u4E2A\u6587\u4EF6",
  "Output file exceeds 8 MB: {0}": "\u8F93\u51FA\u6587\u4EF6\u8D85\u8FC7 8 MB\uFF1A{0}",
  "Text extraction is unavailable for this file format": "\u8BE5\u6587\u4EF6\u683C\u5F0F\u6CA1\u6709\u53EF\u7528\u7684\u6587\u672C\u63D0\u53D6\u5668",
  "The output path must be relative to the working directory: {0}": "\u8F93\u51FA\u8DEF\u5F84\u5FC5\u987B\u76F8\u5BF9\u4E8E\u5DE5\u4F5C\u76EE\u5F55\uFF1A{0}",
  "The output path is outside the working directory: {0}": "\u8F93\u51FA\u8DEF\u5F84\u8D85\u51FA\u5DE5\u4F5C\u76EE\u5F55\uFF1A{0}",
  "Command timed out": "\u547D\u4EE4\u6267\u884C\u8D85\u65F6",
  "This login has ended. Click Sign in with Google again.": "\u8FD9\u6B21\u767B\u5F55\u5DF2\u7ED3\u675F\uFF0C\u8BF7\u91CD\u65B0\u70B9\u51FB\u767B\u5F55 Google\u3002",
  "Paste only the authorization code shown on the Google page.": "\u8BF7\u53EA\u7C98\u8D34 Google \u9875\u9762\u663E\u793A\u7684\u6388\u6743\u7801\u3002",
  "A Google login is already in progress. Complete or cancel it first.": "\u5DF2\u6709 Google \u767B\u5F55\u6B63\u5728\u8FDB\u884C\uFF0C\u8BF7\u5148\u5B8C\u6210\u6216\u53D6\u6D88\u3002",
  "Google account connected. You can return to your Agent.": "Google \u8D26\u6237\u5DF2\u8FDE\u63A5\uFF0C\u53EF\u4EE5\u8FD4\u56DE Agent \u7EE7\u7EED\u8FD0\u884C\u3002",
  "Google login timed out. Sign in again using the code from the new page.": "Google \u767B\u5F55\u8D85\u65F6\uFF0C\u8BF7\u91CD\u65B0\u767B\u5F55\u5E76\u4F7F\u7528\u65B0\u9875\u9762\u4E2D\u7684\u6388\u6743\u7801\u3002",
  "Antigravity could not start login. Check your connection and try again.": "Antigravity \u672A\u80FD\u6253\u5F00\u767B\u5F55\u6D41\u7A0B\uFF0C\u8BF7\u68C0\u67E5\u7F51\u7EDC\u540E\u91CD\u65B0\u767B\u5F55\u3002",
  "Google login cancelled.": "\u5DF2\u53D6\u6D88 Google \u767B\u5F55\u3002",
  "Wait for the login page to be ready before submitting the code.": "\u5F53\u524D\u8FD8\u4E0D\u80FD\u63D0\u4EA4\u6388\u6743\u7801\uFF0C\u8BF7\u7B49\u5F85\u767B\u5F55\u9875\u9762\u5C31\u7EEA\u3002",
  "Verifying authorization code\u2026": "\u6B63\u5728\u9A8C\u8BC1\u6388\u6743\u7801\u2026",
  "Authorization is incomplete. Check your connection and sign in again.": "\u6388\u6743\u9A8C\u8BC1\u672A\u5B8C\u6210\uFF0C\u8BF7\u68C0\u67E5\u7F51\u7EDC\u5E76\u91CD\u65B0\u767B\u5F55\u3002",
  "Could not pass the code to Antigravity. Sign in again.": "\u6388\u6743\u7801\u672A\u80FD\u4F20\u5165 Antigravity\uFF0C\u8BF7\u91CD\u65B0\u767B\u5F55\u3002",
  "Preparing Google login\u2026": "\u6B63\u5728\u51C6\u5907 Google \u767B\u5F55\u2026",
  "The Google authorization code is invalid or expired. Sign in again to get a new code.": "Google \u6388\u6743\u7801\u65E0\u6548\u6216\u5DF2\u8FC7\u671F\uFF0C\u8BF7\u91CD\u65B0\u767B\u5F55\u83B7\u53D6\u65B0\u6388\u6743\u7801\u3002",
  "Sign in on the Google page, then paste its authorization code below.": "\u5728 Google \u9875\u9762\u5B8C\u6210\u767B\u5F55\uFF0C\u5C06\u9875\u9762\u663E\u793A\u7684\u6388\u6743\u7801\u7C98\u8D34\u5230\u4E0B\u65B9\u3002",
  "The browser did not open. Click \u201COpen Google login page\u201D, sign in, and paste the code.": "\u6D4F\u89C8\u5668\u672A\u80FD\u81EA\u52A8\u6253\u5F00\uFF0C\u8BF7\u70B9\u51FB\u201C\u6253\u5F00 Google \u767B\u5F55\u9875\u201D\uFF0C\u767B\u5F55\u540E\u7C98\u8D34\u6388\u6743\u7801\u3002",
  "The Antigravity login process has exited. Sign in again.": "Antigravity \u767B\u5F55\u8FDB\u7A0B\u5DF2\u9000\u51FA\uFF0C\u8BF7\u91CD\u65B0\u767B\u5F55\u3002",
  "Could not verify Google login. Check your connection and sign in again.": "\u65E0\u6CD5\u786E\u8BA4 Google \u767B\u5F55\u72B6\u6001\uFF0C\u8BF7\u68C0\u67E5\u7F51\u7EDC\u540E\u91CD\u65B0\u767B\u5F55\u3002",
  "Could not start Antigravity login. Check the runtime and your connection, then try again.": "\u65E0\u6CD5\u542F\u52A8 Antigravity \u767B\u5F55\uFF0C\u8BF7\u68C0\u67E5\u8FD0\u884C\u65F6\u548C\u7F51\u7EDC\u540E\u91CD\u8BD5\u3002",
  "This Claude login has ended. Reconnect to continue.": "\u8FD9\u6B21 Claude \u767B\u5F55\u5DF2\u7ED3\u675F\uFF0C\u8BF7\u91CD\u65B0\u8FDE\u63A5\u3002",
  "Paste only the authorization code shown on the Claude page.": "\u8BF7\u53EA\u7C98\u8D34 Claude \u9875\u9762\u663E\u793A\u7684\u6388\u6743\u7801\u3002",
  "A Claude login is already in progress. Complete or cancel it first.": "\u5DF2\u6709 Claude \u767B\u5F55\u6B63\u5728\u8FDB\u884C\uFF0C\u8BF7\u5148\u5B8C\u6210\u6216\u53D6\u6D88\u3002",
  "Claude initialization could not continue. A new confirmation may be required. Update the runtime and try again.": "Claude \u521D\u59CB\u5316\u672A\u80FD\u7EE7\u7EED\uFF0C\u53EF\u80FD\u51FA\u73B0\u4E86\u65B0\u7684\u786E\u8BA4\u63D0\u793A\u3002\u8BF7\u66F4\u65B0\u8FD0\u884C\u65F6\u540E\u91CD\u8BD5\u3002",
  "Claude could not reach Anthropic services. Check your network, proxy, DNS, and supported region, then reconnect.": "Claude \u65E0\u6CD5\u8FDE\u63A5 Anthropic \u670D\u52A1\u3002\u8BF7\u68C0\u67E5\u7F51\u7EDC\u3001\u4EE3\u7406\u3001DNS \u548C\u670D\u52A1\u53EF\u7528\u5730\u533A\uFF0C\u7136\u540E\u91CD\u65B0\u8FDE\u63A5\u3002",
  "Claude could not start its local login callback. Close other Claude login attempts and reconnect.": "Claude \u65E0\u6CD5\u542F\u52A8\u672C\u5730\u767B\u5F55\u56DE\u8C03\u3002\u8BF7\u5173\u95ED\u5176\u4ED6 Claude \u767B\u5F55\u8FDB\u7A0B\u540E\u91CD\u65B0\u8FDE\u63A5\u3002",
  "The Claude login input channel has closed. Reconnect to continue.": "Claude \u767B\u5F55\u8F93\u5165\u901A\u9053\u5DF2\u5173\u95ED\uFF0C\u8BF7\u91CD\u65B0\u8FDE\u63A5\u3002",
  "Claude account connected and initialization complete.": "Claude \u8D26\u6237\u5DF2\u8FDE\u63A5\uFF0C\u9ED8\u8BA4\u521D\u59CB\u5316\u5DF2\u5B8C\u6210\u3002",
  "Claude account connected.": "Claude \u8D26\u6237\u5DF2\u8FDE\u63A5\u3002",
  "Opening Claude subscription login\u2026": "\u6B63\u5728\u6253\u5F00 Claude \u8BA2\u9605\u767B\u5F55\u2026",
  "The Claude authorization code is invalid or expired. Reconnect to get a new code.": "Claude \u6388\u6743\u7801\u65E0\u6548\u6216\u5DF2\u8FC7\u671F\uFF0C\u8BF7\u91CD\u65B0\u8FDE\u63A5\u83B7\u53D6\u65B0\u6388\u6743\u7801\u3002",
  "Preparing the AgentFlow runtime directory\u2026": "\u6B63\u5728\u521D\u59CB\u5316 AgentFlow \u4E13\u7528\u8FD0\u884C\u76EE\u5F55\u2026",
  "Applying default interface settings\u2026": "\u6B63\u5728\u5E94\u7528\u9ED8\u8BA4\u754C\u9762\u8BBE\u7F6E\u2026",
  "Claude login options have changed. Update the runtime and try again.": "Claude \u767B\u5F55\u9009\u9879\u53D1\u751F\u53D8\u5316\uFF0C\u8BF7\u66F4\u65B0\u8FD0\u884C\u65F6\u540E\u91CD\u8BD5\u3002",
  "Selecting the Claude subscription account\u2026": "\u6B63\u5728\u9009\u62E9 Claude \u8BA2\u9605\u8D26\u6237\u2026",
  "Signed in. Completing initialization\u2026": "\u767B\u5F55\u6210\u529F\uFF0C\u6B63\u5728\u5B8C\u6210\u521D\u59CB\u5316\u2026",
  "Completing Claude safety information and initialization\u2026": "\u6B63\u5728\u5B8C\u6210 Claude \u5B89\u5168\u8BF4\u660E\u4E0E\u521D\u59CB\u5316\u2026",
  "Authorize Claude in your browser. If the page shows an authorization code, paste it below.": "\u8BF7\u5728\u6D4F\u89C8\u5668\u5B8C\u6210 Claude \u6388\u6743\uFF1B\u5982\u679C\u9875\u9762\u663E\u793A\u6388\u6743\u7801\uFF0C\u5C06\u5176\u7C98\u8D34\u5230\u4E0B\u65B9\u3002",
  "Checking Claude subscription and initialization\u2026": "\u6B63\u5728\u786E\u8BA4 Claude \u8BA2\u9605\u4E0E\u521D\u59CB\u5316\u72B6\u6001\u2026",
  "Claude login timed out. Reconnect to continue.": "Claude \u767B\u5F55\u8D85\u65F6\uFF0C\u8BF7\u91CD\u65B0\u8FDE\u63A5\u3002",
  "Claude login cancelled.": "\u5DF2\u53D6\u6D88 Claude \u767B\u5F55\u3002",
  "Wait for the Claude login page to be ready before submitting the code.": "\u5F53\u524D\u8FD8\u4E0D\u80FD\u63D0\u4EA4\u6388\u6743\u7801\uFF0C\u8BF7\u7B49\u5F85 Claude \u767B\u5F55\u9875\u9762\u5C31\u7EEA\u3002",
  "Verifying Claude authorization code\u2026": "\u6B63\u5728\u9A8C\u8BC1 Claude \u6388\u6743\u7801\u2026",
  "Preparing Claude login and initialization\u2026": "\u6B63\u5728\u51C6\u5907 Claude \u767B\u5F55\u4E0E\u9ED8\u8BA4\u521D\u59CB\u5316\u2026",
  "Preparing Claude subscription login\u2026": "\u6B63\u5728\u51C6\u5907 Claude \u8BA2\u9605\u767B\u5F55\u2026",
  "Complete Claude subscription login in your browser. Email or organization verification can remain open for up to three minutes.": "\u8BF7\u5728\u6D4F\u89C8\u5668\u4E2D\u5B8C\u6210 Claude \u8BA2\u9605\u767B\u5F55\uFF1B\u90AE\u7BB1\u6216\u7EC4\u7EC7\u9A8C\u8BC1\u6700\u957F\u53EF\u7B49\u5F85\u4E09\u5206\u949F\u3002",
  "Checking Claude subscription\u2026": "\u6B63\u5728\u68C0\u67E5 Claude \u8BA2\u9605\u8D26\u6237\u2026",
  "Claude login finished without a valid subscription account. Reconnect to continue.": "Claude \u767B\u5F55\u5DF2\u7ED3\u675F\uFF0C\u4F46\u672A\u68C0\u6D4B\u5230\u6709\u6548\u7684\u8BA2\u9605\u8D26\u6237\u3002\u8BF7\u91CD\u65B0\u8FDE\u63A5\u3002",
  "The Claude login process exited before authentication completed. Reconnect to continue.": "Claude \u767B\u5F55\u8FDB\u7A0B\u5728\u8BA4\u8BC1\u5B8C\u6210\u524D\u5DF2\u9000\u51FA\u3002\u8BF7\u91CD\u65B0\u8FDE\u63A5\u3002",
  "The Claude initialization process has exited. Reconnect to continue.": "Claude \u521D\u59CB\u5316\u8FDB\u7A0B\u5DF2\u9000\u51FA\uFF0C\u8BF7\u91CD\u65B0\u8FDE\u63A5\u3002",
  "Could not start Claude login. Check the runtime and shell configuration, then try again.": "\u65E0\u6CD5\u542F\u52A8 Claude \u767B\u5F55\uFF0C\u8BF7\u68C0\u67E5\u8FD0\u884C\u65F6\u548C\u547D\u4EE4\u884C\u73AF\u5883\u540E\u91CD\u8BD5\u3002",
  "Reconnect DeepSeek in Settings \u2192 Subscription accounts.": "\u8BF7\u5728\u8BBE\u7F6E \u2192 \u8BA2\u9605\u8D26\u6237\u4E2D\u91CD\u65B0\u8FDE\u63A5 DeepSeek\u3002",
  "DeepSeek is disconnecting. Reconnect shortly.": "DeepSeek \u6B63\u5728\u65AD\u5F00\uFF0C\u8BF7\u7A0D\u540E\u91CD\u65B0\u8FDE\u63A5\u3002",
  "DeepSeek connection cancelled.": "DeepSeek \u8FDE\u63A5\u5DF2\u53D6\u6D88\u3002",
  "DeepSeek disconnected.": "DeepSeek \u8FDE\u63A5\u5DF2\u65AD\u5F00\u3002",
  "The DeepSeek login window was closed. Click \u201CSign in to DeepSeek\u201D again.": "DeepSeek \u767B\u5F55\u7A97\u53E3\u5DF2\u5173\u95ED\uFF0C\u8BF7\u91CD\u65B0\u70B9\u51FB\u201C\u767B\u5F55 DeepSeek\u201D\u3002",
  "Sign in to DeepSeek in the dedicated browser and complete any verification challenge.": "\u8BF7\u5728\u4E13\u7528\u6D4F\u89C8\u5668\u4E2D\u767B\u5F55 DeepSeek\uFF1B\u5982\u6709\u9A8C\u8BC1\u7801\uFF0C\u8BF7\u624B\u52A8\u5B8C\u6210\u3002",
  "DeepSeek login timed out. Reconnect to continue.": "DeepSeek \u767B\u5F55\u8D85\u65F6\uFF0C\u8BF7\u91CD\u65B0\u8FDE\u63A5\u3002",
  "DeepSeek Web Bridge supports text input. Remove the images and try again.": "DeepSeek \u7F51\u9875\u8FDE\u63A5\u76EE\u524D\u652F\u6301\u6587\u672C\u8F93\u5165\uFF0C\u8BF7\u79FB\u9664\u56FE\u7247\u540E\u91CD\u8BD5\u3002",
  "The DeepSeek web response timed out. Try again shortly.": "DeepSeek \u7F51\u9875 \u54CD\u5E94\u8D85\u65F6\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002",
  "DeepSeek login has expired. {0}": "DeepSeek \u767B\u5F55\u5DF2\u5931\u6548\u3002{0}",
  "DeepSeek Web Bridge request failed: {0}. The web protocol may have changed. Try again later or use the DeepSeek API.": "DeepSeek \u7F51\u9875\u8FDE\u63A5\u8C03\u7528\u5931\u8D25\uFF1A{0}\u3002\u7F51\u9875\u534F\u8BAE\u53EF\u80FD\u5DF2\u53D8\u5316\uFF1B\u8BF7\u7A0D\u540E\u91CD\u8BD5\u6216\u4F7F\u7528 DeepSeek API\u3002",
  "No text to send": "\u6CA1\u6709\u53EF\u53D1\u9001\u7684\u6587\u672C",
  "DeepSeek login is missing": "\u5C1A\u672A\u767B\u5F55 DeepSeek",
  "The web service did not return a valid session": "\u7F51\u9875\u6CA1\u6709\u8FD4\u56DE\u6709\u6548\u4F1A\u8BDD",
  "The web service returned an error": "\u7F51\u9875\u670D\u52A1\u8FD4\u56DE\u9519\u8BEF",
  "The web connection closed before the answer was confirmed complete": "\u7F51\u9875\u8FDE\u63A5\u63D0\u524D\u4E2D\u65AD\uFF0C\u672A\u6536\u5230\u56DE\u7B54\u5B8C\u6210\u786E\u8BA4",
  "The web service did not return a final answer": "\u7F51\u9875\u670D\u52A1\u6CA1\u6709\u8FD4\u56DE\u6700\u7EC8\u56DE\u7B54",
  "Connect DeepSeek \xB7 AgentFlow": "\u8FDE\u63A5 DeepSeek \xB7 AgentFlow",
  "Could not verify DeepSeek login. Refresh shortly.": "DeepSeek \u767B\u5F55\u72B6\u6001\u6682\u65F6\u65E0\u6CD5\u9A8C\u8BC1\uFF0C\u8BF7\u7A0D\u540E\u5237\u65B0\u3002",
  "DeepSeek web request failed (HTTP {0}){1}": "DeepSeek \u7F51\u9875\u8BF7\u6C42\u5931\u8D25\uFF08HTTP {0}\uFF09{1}",
  "No event stream returned": "\u672A\u8FD4\u56DE\u4E8B\u4EF6\u6D41",
  "DeepSeek web: {0}": "DeepSeek \u7F51\u9875\uFF1A{0}",
  "DeepSeek web returned an empty response": "DeepSeek \u7F51\u9875\u8FD4\u56DE\u4E86\u7A7A\u54CD\u5E94",
  "Could not write logs to disk. Check directory permissions and free space. The report includes recent records from this session.": "\u65E5\u5FD7\u65E0\u6CD5\u5199\u5165\u78C1\u76D8\uFF0C\u8BF7\u68C0\u67E5\u76EE\u5F55\u6743\u9650\u548C\u5269\u4F59\u7A7A\u95F4\u3002\u62A5\u544A\u4ECD\u5305\u542B\u672C\u6B21\u8FD0\u884C\u7684\u6700\u8FD1\u8BB0\u5F55\u3002",
  "Some logs could not be read. The report includes the available records.": "\u90E8\u5206\u65E5\u5FD7\u65E0\u6CD5\u8BFB\u53D6\uFF1B\u62A5\u544A\u4ECD\u5305\u542B\u53EF\u8BFB\u53D6\u7684\u8BB0\u5F55\u3002",
  "Invalid project file path": "\u65E0\u6548\u7684\u9879\u76EE\u6587\u4EF6\u8DEF\u5F84",
  "Symbolic links and junctions are not allowed inside .flow": ".flow \u5185\u4E0D\u5141\u8BB8\u7B26\u53F7\u94FE\u63A5\u6216\u76EE\u5F55\u8054\u63A5",
  "Could not read {0}. Check that the file is complete.": "\u65E0\u6CD5\u8BFB\u53D6 {0}\uFF0C\u8BF7\u68C0\u67E5\u6587\u4EF6\u662F\u5426\u5B8C\u6574\u3002",
  "Unrecognized project format, version, or records in .flow/project.json": "\u65E0\u6CD5\u8BC6\u522B .flow/\u9879\u76EE.json \u7684\u9879\u76EE\u683C\u5F0F\u3001\u7248\u672C\u6216\u8BB0\u5F55\u5185\u5BB9",
  "The destination already contains another Flow project. Open it or choose another directory.": "\u76EE\u6807\u76EE\u5F55\u5DF2\u5305\u542B\u53E6\u4E00\u4E2A Flow \u9879\u76EE\uFF0C\u8BF7\u6253\u5F00\u8BE5\u9879\u76EE\u6216\u9009\u62E9\u5176\u4ED6\u76EE\u5F55\u3002",
  "Logs and diagnostics \xB7 AgentFlow": "\u65E5\u5FD7\u4E0E\u8BCA\u65AD \xB7 \u4F20\u58F0\u7B52AgentFlow",
  "Export diagnostic report": "\u5BFC\u51FA\u8BCA\u65AD\u62A5\u544A",
  "Export": "\u5BFC\u51FA",
  "Diagnostic report JSON": "\u8BCA\u65AD\u62A5\u544A JSON",
  "Open project folder": "\u6253\u5F00\u9879\u76EE\u6587\u4EF6\u5939",
  "Open folder": "\u6253\u5F00\u6587\u4EF6\u5939",
  "About AgentFlow": "\u5173\u4E8E AgentFlow",
  "Version {0}\nA local-first desktop app for multi-Agent workflows.": "\u7248\u672C {0}\n\u672C\u5730\u4F18\u5148\u7684\u591A Agent \u5DE5\u4F5C\u6D41\u684C\u9762\u5E94\u7528\u3002",
  "OK": "\u786E\u5B9A",
  "File": "\u6587\u4EF6",
  "New temporary project": "\u65B0\u5EFA\u4E34\u65F6\u9879\u76EE",
  "Open project folder\u2026": "\u6253\u5F00\u9879\u76EE\u6587\u4EF6\u5939\u2026",
  "Open current directory in file manager": "\u5728\u6587\u4EF6\u7BA1\u7406\u5668\u4E2D\u6253\u5F00\u5F53\u524D\u76EE\u5F55",
  "Save": "\u4FDD\u5B58",
  "Close window": "\u5173\u95ED\u7A97\u53E3",
  "Quit AgentFlow": "\u9000\u51FA AgentFlow",
  "View": "\u89C6\u56FE",
  "Reload": "\u91CD\u65B0\u8F7D\u5165",
  "Developer tools": "\u5F00\u53D1\u8005\u5DE5\u5177",
  "Actual size": "\u5B9E\u9645\u5927\u5C0F",
  "Zoom in": "\u653E\u5927",
  "Zoom out": "\u7F29\u5C0F",
  "Toggle full screen": "\u5207\u6362\u5168\u5C4F",
  "Help": "\u5E2E\u52A9",
  "Interactive tutorial": "\u4EA4\u4E92\u6559\u7A0B",
  "Logs and diagnostics\u2026": "\u65E5\u5FD7\u4E0E\u8BCA\u65AD\u2026",
  "Export diagnostic report\u2026": "\u5BFC\u51FA\u8BCA\u65AD\u62A5\u544A\u2026",
  "Export failed": "\u5BFC\u51FA\u5931\u8D25",
  "Open log directory": "\u6253\u5F00\u65E5\u5FD7\u76EE\u5F55",
  "Could not open log directory": "\u65E0\u6CD5\u6253\u5F00\u65E5\u5FD7\u76EE\u5F55",
  "Invalid temporary workspace id": "\u4E34\u65F6\u5DE5\u4F5C\u533A\u6807\u8BC6\u65E0\u6548",
  "Choose project working directory": "\u9009\u62E9\u9879\u76EE\u5DE5\u4F5C\u76EE\u5F55",
  "Project does not exist.": "\u9879\u76EE\u4E0D\u5B58\u5728\u3002",
  "An account login is already in progress. Complete or cancel it first.": "\u5DF2\u6709\u8D26\u6237\u6B63\u5728\u767B\u5F55\uFF0C\u8BF7\u5148\u5B8C\u6210\u6216\u53D6\u6D88\u3002",
  "This login session has ended. Sign in again.": "\u767B\u5F55\u4F1A\u8BDD\u5DF2\u7ED3\u675F\uFF0C\u8BF7\u91CD\u65B0\u767B\u5F55\u3002",
  "Invalid model request id": "\u6A21\u578B\u8BF7\u6C42\u6807\u8BC6\u65E0\u6548",
  "Invalid model request": "\u6A21\u578B\u8BF7\u6C42\u65E0\u6548",
  "AgentFlow": "\u4F20\u58F0\u7B52AgentFlow",
  "AgentFlow failed to start": "AgentFlow \u542F\u52A8\u5931\u8D25",
  "Retrieve diagnostics from the log directory:\n": "\u8BF7\u4ECE\u65E5\u5FD7\u76EE\u5F55\u63D0\u53D6\u8BCA\u65AD\u4FE1\u606F\uFF1A\n",
  "Invalid custom provider ID": "\u81EA\u5B9A\u4E49\u670D\u52A1\u5546 ID \u65E0\u6548",
  "Provider does not exist": "\u670D\u52A1\u5546\u4E0D\u5B58\u5728",
  "{0} is disabled": "{0} \u5DF2\u505C\u7528",
  "Provider {0} does not exist or is disabled": "\u670D\u52A1\u5546 {0} \u4E0D\u5B58\u5728\u6216\u5DF2\u505C\u7528",
  "Model {1} from {0} is disabled. Enable it in Settings \u2192 API providers before running.": "{0} \u7684\u6A21\u578B {1} \u5DF2\u505C\u7528\uFF0C\u8BF7\u5728\u8BBE\u7F6E \u2192 API \u670D\u52A1\u5546\u4E2D\u542F\u7528\u540E\u518D\u8FD0\u884C\u3002",
  "This tool does not support in-app login yet": "\u8BE5\u5DE5\u5177\u6682\u4E0D\u652F\u6301\u5728\u5E94\u7528\u5185\u767B\u5F55",
  "Antigravity configuration not found": "\u672A\u627E\u5230 Antigravity \u914D\u7F6E",
  "Antigravity was not found. Check its command and try again.": "\u672A\u627E\u5230 Antigravity\uFF0C\u8BF7\u68C0\u67E5\u68C0\u6D4B\u547D\u4EE4\u540E\u91CD\u8BD5\u3002",
  "Agent tool {0} does not exist": "Agent \u5DE5\u5177 {0} \u4E0D\u5B58\u5728",
  "{0} was not found on this computer (command: {1})": "\u672C\u673A\u672A\u68C0\u6D4B\u5230 {0}\uFF08\u547D\u4EE4\uFF1A{1}\uFF09",
  "Models for {0} are disabled. Enable them in Settings \u2192 Local Agent tools before running.": "{0} \u7684\u6A21\u578B\u5DF2\u505C\u7528\uFF0C\u8BF7\u5728\u8BBE\u7F6E \u2192 \u672C\u673A Agent \u5DE5\u5177\u4E2D\u542F\u7528\u540E\u518D\u8FD0\u884C\u3002",
  "The installed version of {0} has no supported reasoning effort argument": "{0} \u5F53\u524D\u5B89\u88C5\u7248\u672C\u6CA1\u6709\u53EF\u7528\u7684\u63A8\u7406\u5F3A\u5EA6\u542F\u52A8\u53C2\u6570",
  "{0} \xB7 {1}: {2}": "{0} \u7684 {1} {2}",
  "Default model": "\u9ED8\u8BA4\u6A21\u578B",
  "Supported reasoning effort: {0}": "\u4EC5\u652F\u6301\u63A8\u7406\u5F3A\u5EA6\uFF1A{0}",
  "No reasoning effort levels are available. Use the tool defaults.": "\u672A\u63D0\u4F9B\u53EF\u7528\u7684\u63A8\u7406\u5F3A\u5EA6\u6863\u4F4D\uFF0C\u8BF7\u4F7F\u7528\u5DE5\u5177\u9ED8\u8BA4\u8BBE\u7F6E\u3002",
  "Invalid Anthropic workspace ID. Copy an ID starting with wrkspc_ from Claude Console \u2192 Settings \u2192 Workspaces.": "Anthropic \u5DE5\u4F5C\u533A ID \u683C\u5F0F\u65E0\u6548\uFF0C\u8BF7\u4ECE Claude \u63A7\u5236\u53F0\u7684\u8BBE\u7F6E \u2192 \u5DE5\u4F5C\u533A\u590D\u5236\u4EE5 wrkspc_ \u5F00\u5934\u7684 ID\u3002",
  "Tool default model": "\u5DE5\u5177\u9ED8\u8BA4\u6A21\u578B",
  "Subscription default model": "\u8BA2\u9605\u9ED8\u8BA4\u6A21\u578B",
  "The command for {0} cannot be empty": "{0} \u7684\u547D\u4EE4\u4E0D\u80FD\u4E3A\u7A7A",
  "Provider URLs must use http or https": "\u670D\u52A1\u5546 URL \u5FC5\u987B\u4F7F\u7528 http \u6216 https",
  "Operating system credential encryption is unavailable. The API key was not saved": "\u64CD\u4F5C\u7CFB\u7EDF\u51ED\u636E\u52A0\u5BC6\u5F53\u524D\u4E0D\u53EF\u7528\uFF0CAPI \u5BC6\u94A5\u672A\u4FDD\u5B58",
  "No API key configured for {0}": "{0} \u5C1A\u672A\u914D\u7F6E API \u5BC6\u94A5",
  "The provider completed the response without returning text": "\u670D\u52A1\u5546\u5DF2\u7ED3\u675F\u54CD\u5E94\uFF0C\u4F46\u6CA1\u6709\u8FD4\u56DE\u6587\u672C\u5185\u5BB9",
  "This Messages endpoint requires a positive integer output limit": "\u6B64 Messages \u63A5\u53E3\u8981\u6C42\u6307\u5B9A\u6B63\u6574\u6570\u8F93\u51FA\u4E0A\u9650",
  "The provider returned an empty streaming response": "\u670D\u52A1\u5546\u8FD4\u56DE\u4E86\u7A7A\u7684\u6D41\u5F0F\u54CD\u5E94",
  "This API key requires a workspace. Enter the ID (wrkspc_\u2026) from Claude Console \u2192 Settings \u2192 Workspaces in this provider\u2019s \u201CAnthropic workspace ID\u201D, then test the connection again.": "\u6B64 API \u5BC6\u94A5\u9700\u8981\u6307\u5B9A\u5DE5\u4F5C\u533A\u3002\u8BF7\u5728\u6B64\u670D\u52A1\u5546\u7684\u201CAnthropic \u5DE5\u4F5C\u533A ID\u201D\u4E2D\u586B\u5199 Claude \u63A7\u5236\u53F0\u7684\u8BBE\u7F6E \u2192 \u5DE5\u4F5C\u533A\u4E2D\u7684 ID\uFF08wrkspc_\u2026\uFF09\uFF0C\u7136\u540E\u91CD\u65B0\u6D4B\u8BD5\u8FDE\u63A5\u3002",
  "{0} request failed ({1}): {2}{3}": "{0} \u8BF7\u6C42\u5931\u8D25 ({1})\uFF1A{2}{3}",
  "Connect your ChatGPT account through the official Codex runtime.": "\u901A\u8FC7\u5B98\u65B9 Codex \u8FD0\u884C\u65F6\u8FDE\u63A5 ChatGPT \u8D26\u6237\u3002",
  "Uses the Codex allowance included in your ChatGPT plan.": "\u6D88\u8017 ChatGPT \u8BA1\u5212\u4E2D\u7684 Codex \u4F7F\u7528\u989D\u5EA6\uFF0C\u4E0D\u4F7F\u7528 API \u4F59\u989D\u3002",
  "Connect your Claude account through the official Claude Code runtime.": "\u901A\u8FC7\u5B98\u65B9 Claude Code \u8FD0\u884C\u65F6\u8FDE\u63A5 Claude \u8D26\u6237\u3002",
  "Uses the Claude Code allowance in Claude Pro, Max, Team, or Enterprise.": "\u6D88\u8017 Claude Pro\u3001Max\u3001Team \u6216 Enterprise \u4E2D\u7684 Claude Code \u989D\u5EA6\u3002",
  "Connect your Kimi account with device-code login through the official Kimi Code CLI.": "\u901A\u8FC7\u5B98\u65B9 Kimi Code \u547D\u4EE4\u884C\u7684\u8BBE\u5907\u7801\u767B\u5F55\u8FDE\u63A5 Kimi \u8D26\u6237\u3002",
  "Uses your Kimi Code subscription allowance. Git Bash is required on Windows.": "\u6D88\u8017 Kimi Code \u8D26\u6237\u5BF9\u5E94\u7684\u8BA2\u9605\u989D\u5EA6\u3002Windows \u9700\u8981 Git Bash\u3002",
  "Connect your Google account through the official Antigravity CLI.": "\u901A\u8FC7\u5B98\u65B9 Antigravity \u547D\u4EE4\u884C\u8FDE\u63A5 Google \u8D26\u6237\u3002",
  "Uses your Antigravity / Gemini account allowance.": "\u6D88\u8017 Antigravity / Gemini \u8D26\u6237\u989D\u5EA6\uFF0C\u4E0D\u4F7F\u7528 Gemini API \u5BC6\u94A5\u3002",
  "Sign in to your DeepSeek web account in a dedicated browser.": "\u901A\u8FC7\u4E13\u7528\u6D4F\u89C8\u5668\u767B\u5F55 DeepSeek \u7F51\u9875\u8D26\u6237\u3002",
  "Uses the DeepSeek web service. This experimental connection may stop working after web protocol or account security changes.": "\u4F7F\u7528 DeepSeek \u7F51\u9875\u670D\u52A1\uFF0C\u65E0\u9700 API \u5BC6\u94A5\u3002\u5B9E\u9A8C\u6027\u8FDE\u63A5\u53EF\u80FD\u56E0\u7F51\u9875\u534F\u8BAE\u6216\u8D26\u53F7\u98CE\u63A7\u53D8\u5316\u800C\u5931\u6548\u3002",
  "DeepSeek login has expired. Reconnect to continue.": "DeepSeek \u767B\u5F55\u5DF2\u5931\u6548\uFF0C\u8BF7\u91CD\u65B0\u8FDE\u63A5\u3002",
  "Could not verify DeepSeek status. Your login is retained; refresh shortly.": "DeepSeek \u72B6\u6001\u6682\u65F6\u65E0\u6CD5\u9A8C\u8BC1\uFF0C\u5DF2\u4FDD\u7559\u767B\u5F55\u72B6\u6001\uFF1B\u8BF7\u7A0D\u540E\u5237\u65B0\u3002",
  "{0} is connecting. Complete the current login first.": "{0} \u6B63\u5728\u8FDE\u63A5\uFF0C\u8BF7\u5148\u5B8C\u6210\u5F53\u524D\u767B\u5F55\u3002",
  "Checking the {0} runtime\u2026": "\u6B63\u5728\u68C0\u67E5 {0} \u8FD0\u884C\u73AF\u5883\u2026",
  "{0} is already installed. Configure the existing installation in \u201CLocal Agent tools\u201D.": "\u68C0\u6D4B\u5230\u672C\u673A\u5DF2\u6709 {0}\u3002\u8BF7\u5728\u201C\u672C\u673A Agent \u5DE5\u5177\u201D\u4E2D\u914D\u7F6E\u73B0\u6709\u5B89\u88C5\u3002",
  "Sign in to {0} in your browser.": "\u8BF7\u5728\u6D4F\u89C8\u5668\u4E2D\u767B\u5F55 {0}\u3002",
  "{0} connected.": "{0} \u5DF2\u8FDE\u63A5\u3002",
  "{0} connection failed": "{0} \u8FDE\u63A5\u5931\u8D25",
  "Subscription connector does not exist": "\u8BA2\u9605\u8FDE\u63A5\u5668\u4E0D\u5B58\u5728",
  "DeepSeek Web Bridge uses a web session": "DeepSeek \u7F51\u9875\u8FDE\u63A5\u901A\u8FC7\u7F51\u9875\u4F1A\u8BDD\u8C03\u7528\uFF0C\u4E0D\u4F7F\u7528\u672C\u673A\u8FD0\u884C\u65F6",
  "Connect {0} in \u201CSubscription accounts\u201D first": "{0} \u5C1A\u672A\u5728\u201C\u8BA2\u9605\u8D26\u6237\u201D\u4E2D\u8FDE\u63A5",
  "Web connector does not exist": "\u7F51\u9875\u8FDE\u63A5\u5668\u4E0D\u5B58\u5728",
  "Connect DeepSeek Web Bridge in Settings \u2192 Subscription accounts first.": "\u8BF7\u5148\u5728\u8BBE\u7F6E \u2192 \u8BA2\u9605\u8D26\u6237\u4E2D\u8FDE\u63A5 DeepSeek \u7F51\u9875\u8FDE\u63A5\u3002",
  "DeepSeek Web Bridge is unavailable in this environment": "\u5F53\u524D\u73AF\u5883\u6CA1\u6709 DeepSeek \u7F51\u9875\u8FDE\u63A5",
  "Accept the experimental risks of DeepSeek Web Bridge first.": "\u8BF7\u5148\u786E\u8BA4 DeepSeek \u7F51\u9875\u8FDE\u63A5\u7684\u5B9E\u9A8C\u6027\u98CE\u9669\u3002",
  "DeepSeek login is incomplete. Reconnect to continue.": "DeepSeek \u767B\u5F55\u5C1A\u672A\u5B8C\u6210\uFF0C\u8BF7\u91CD\u65B0\u8FDE\u63A5\u3002",
  "DeepSeek connected. The dedicated browser session is saved.": "DeepSeek \u5DF2\u8FDE\u63A5\uFF0C\u4E13\u7528\u6D4F\u89C8\u5668\u767B\u5F55\u6001\u5DF2\u4FDD\u5B58\u3002",
  "DeepSeek connection failed": "DeepSeek \u8FDE\u63A5\u5931\u8D25",
  "Invalid subscription request id": "\u8BA2\u9605\u8BF7\u6C42\u6807\u8BC6\u65E0\u6548",
  "Downloading the official {0} installer\u2026": "\u6B63\u5728\u4E0B\u8F7D {0} \u5B98\u65B9\u5B89\u88C5\u7A0B\u5E8F\u2026",
  "The {0} installer is invalid": "{0} \u5B89\u88C5\u7A0B\u5E8F\u5185\u5BB9\u65E0\u6548",
  "Installing {0} in the background\u2026": "\u6B63\u5728\u540E\u53F0\u5B89\u88C5 {0}\u2026",
  "{0} installation failed: {1}": "{0} \u5B89\u88C5\u5931\u8D25\uFF1A{1}",
  "{0} was installed, but its executable was not found": "{0} \u5B89\u88C5\u5B8C\u6210\uFF0C\u4F46\u6CA1\u6709\u627E\u5230\u53EF\u6267\u884C\u6587\u4EF6",
  "Preparing Git Bash for Kimi Code\u2026": "\u6B63\u5728\u51C6\u5907 Kimi Code \u6240\u9700\u7684 Git Bash\u2026",
  "Kimi Code requires Git Bash on Windows. Automatic setup failed: {0}": "Kimi Code \u5728 Windows \u4E0A\u9700\u8981 Git Bash\uFF0C\u81EA\u52A8\u51C6\u5907\u5931\u8D25\uFF1A{0}",
  "Could not start {0}: {1}": "{0} \u65E0\u6CD5\u542F\u52A8\uFF1A{1}",
  "Claude login channel is not configured": "Claude \u767B\u5F55\u901A\u9053\u672A\u914D\u7F6E",
  "Claude initialization finished without a valid subscription login. Reconnect to continue.": "Claude \u521D\u59CB\u5316\u5DF2\u7ED3\u675F\uFF0C\u4F46\u672A\u68C0\u6D4B\u5230\u6709\u6548\u8BA2\u9605\u767B\u5F55\uFF0C\u8BF7\u91CD\u65B0\u8FDE\u63A5\u3002",
  "Antigravity login channel is not configured": "Antigravity \u767B\u5F55\u901A\u9053\u672A\u914D\u7F6E",
  "Could not disconnect Claude: {0}": "Claude \u65AD\u5F00\u5931\u8D25\uFF1A{0}",
  "Antigravity could not clear the login automatically. Run /logout in the Antigravity CLI.": "Antigravity \u672A\u80FD\u81EA\u52A8\u6E05\u9664\u767B\u5F55\uFF0C\u8BF7\u5728 Antigravity \u547D\u4EE4\u884C\u4E2D\u8FD0\u884C /logout\u3002",
  "Could not detect Claude command capabilities. Check the runtime.": "\u65E0\u6CD5\u68C0\u6D4B Claude \u547D\u4EE4\u80FD\u529B\uFF0C\u8BF7\u68C0\u67E5\u8FD0\u884C\u65F6\u3002",
  "Codex login timed out. Reconnect to continue.": "Codex \u767B\u5F55\u8D85\u65F6\uFF0C\u8BF7\u91CD\u65B0\u8FDE\u63A5\u3002",
  "The browser is open. Complete your ChatGPT login.": "\u6D4F\u89C8\u5668\u5DF2\u6253\u5F00\uFF0C\u8BF7\u5B8C\u6210 ChatGPT \u767B\u5F55\u3002",
  "Codex login failed": "Codex \u767B\u5F55\u5931\u8D25",
  "Codex did not return a ChatGPT subscription account": "Codex \u6CA1\u6709\u8FD4\u56DE ChatGPT \u8BA2\u9605\u8D26\u6237",
  "Codex App Server exited ({0}): {1}": "Codex App Server \u5DF2\u9000\u51FA\uFF08{0}\uFF09\uFF1A{1}",
  "Confirm device login on the Kimi page.": "\u8BF7\u5728 Kimi \u9875\u9762\u786E\u8BA4\u8BBE\u5907\u767B\u5F55\u3002",
  "Kimi login failed: {0}": "Kimi \u767B\u5F55\u5931\u8D25\uFF1A{0}",
  "Kimi login finished, but OAuth credentials were not found.": "Kimi \u767B\u5F55\u5B8C\u6210\uFF0C\u4F46\u6CA1\u6709\u627E\u5230 OAuth \u51ED\u636E\u3002",
  "Codex {0} timed out": "Codex {0} \u8D85\u65F6",
  "Login URLs must use HTTPS": "\u767B\u5F55\u5730\u5740\u5FC5\u987B\u4F7F\u7528 HTTPS",
  "Subscription connector {0} does not exist": "\u8BA2\u9605\u8FDE\u63A5\u5668 {0} \u4E0D\u5B58\u5728",
  "DeepSeek Web Bridge does not use runtime templates": "DeepSeek \u7F51\u9875\u8FDE\u63A5\u4F7F\u7528\u7F51\u9875\u4F1A\u8BDD",
  "Exit code {0}": "\u9000\u51FA\u7801 {0}",
  "Codex App Server request failed": "Codex App Server \u8BF7\u6C42\u5931\u8D25",
  "Installer download failed (HTTP {0})": "\u4E0B\u8F7D\u5B89\u88C5\u7A0B\u5E8F\u5931\u8D25\uFF08HTTP {0}\uFF09",
  "openExternal dependency is not configured": "\u5C1A\u672A\u914D\u7F6E\u5916\u90E8\u94FE\u63A5\u6253\u5F00\u529F\u80FD",
  "{0} timed out": "{0} \u6267\u884C\u8D85\u65F6",
  "The output path must be inside the current project.": "\u8F93\u51FA\u8DEF\u5F84\u5FC5\u987B\u4F4D\u4E8E\u5F53\u524D\u9879\u76EE\u5185\u3002",
  "The output path cannot pass through symbolic links or junctions.": "\u8F93\u51FA\u8DEF\u5F84\u4E0D\u80FD\u7ECF\u8FC7\u7B26\u53F7\u94FE\u63A5\u6216\u76EE\u5F55\u8054\u63A5\u3002",
  "The output file does not exist or is not a file.": "\u8F93\u51FA\u6587\u4EF6\u4E0D\u5B58\u5728\u6216\u4E0D\u662F\u6587\u4EF6\u3002",
  "Unsupported workspace entry: {0}": "\u4E0D\u652F\u6301\u7684\u5DE5\u4F5C\u533A\u6761\u76EE\uFF1A{0}",
  "Flow or record ownership does not match the project": "\u9879\u76EE\u4E2D\u7684 Flow \u6216\u8BB0\u5F55\u5F52\u5C5E\u4E0D\u4E00\u81F4",
  "Output file does not exist": "\u8F93\u51FA\u6587\u4EF6\u4E0D\u5B58\u5728",
  "Project does not exist": "\u9879\u76EE\u4E0D\u5B58\u5728",
  "Fast mode": "\u5FEB\u901F\u6A21\u5F0F",
  "Expert mode": "\u4E13\u5BB6\u6A21\u5F0F",
  "Turn these 8 customer interviews into a one-page weekly brief: plan the analysis and outline, then read the CSV to calculate topic counts, average ratings, and low-rating feedback. Save the statistics, check the results, and write the key findings and two actions for next week.": "\u628A\u8FD9 8 \u4EFD\u5BA2\u6237\u56DE\u8BBF\u6574\u7406\u6210\u4E00\u9875\u5468\u4F1A\u7B80\u62A5\uFF1A\u5148\u5236\u5B9A\u6574\u7406\u8BA1\u5212\u548C\u7B80\u62A5\u7ED3\u6784\uFF0C\u518D\u8BFB\u53D6 CSV \u7EDF\u8BA1\u4E3B\u9898\u5206\u5E03\u3001\u5E73\u5747\u8BC4\u5206\u4E0E\u4F4E\u5206\u53CD\u9988\u3002\u4FDD\u5B58\u7EDF\u8BA1\u6587\u4EF6\uFF0C\u6838\u5BF9\u7ED3\u679C\uFF0C\u6700\u540E\u5199\u51FA\u4E3B\u8981\u53D1\u73B0\u548C\u4E24\u9879\u4E0B\u5468\u884C\u52A8\u3002",
  "# Customer feedback \xB7 Weekly meeting brief\n\nFriday\u2019s meeting needs a one-page brief to help the customer success team choose next week\u2019s priorities.\n- Source: 8 customer interviews, rated 1\u20135, with 5 the highest.\n- Include an overview, key issues, and two actions for next week.\n- Cite customer IDs and distinguish observations from recommendations.\n- Keep all statistics traceable to the source table and include sample sizes.": "# \u672C\u5468\u5BA2\u6237\u56DE\u8BBF \xB7 \u5468\u4F1A\u4EFB\u52A1\n\n\u5468\u4E94\u4F8B\u4F1A\u9700\u8981\u4E00\u9875\u7B80\u62A5\uFF0C\u5E2E\u52A9\u5BA2\u6237\u6210\u529F\u56E2\u961F\u51B3\u5B9A\u4E0B\u5468\u5148\u505A\u4EC0\u4E48\u3002\n- \u6750\u6599\uFF1A8 \u4EFD\u5BA2\u6237\u56DE\u8BBF\uFF0C\u8BC4\u5206\u4E3A 1\u20135 \u5206\uFF0C5 \u5206\u6700\u9AD8\u3002\n- \u7B80\u62A5\u5185\u5BB9\uFF1A\u6574\u4F53\u60C5\u51B5\u3001\u4E3B\u8981\u95EE\u9898\u3001\u4E24\u9879\u4E0B\u5468\u884C\u52A8\u3002\n- \u7528\u5BA2\u6237\u7F16\u53F7\u5F15\u7528\u53CD\u9988\uFF0C\u533A\u5206\u89C2\u5BDF\u5230\u7684\u4E8B\u5B9E\u4E0E\u884C\u52A8\u5EFA\u8BAE\u3002\n- \u6240\u6709\u7EDF\u8BA1\u5E94\u80FD\u8FFD\u6EAF\u5230\u539F\u8868\uFF0C\u4FDD\u7559\u6837\u672C\u6570\u3002",
  "Customer ID,Topic,Rating,Feedback\nC01,Response time,3,Slow replies during peak hours\nC02,Training materials,4,Clear introductory guide but more examples would help\nC03,Response time,2,Long wait for urgent issues\nC04,Process clarity,3,Unclear who received the escalated issue\nC05,Training materials,5,Video tutorials are very helpful\nC06,Response time,3,Would like estimated response times\nC07,Process clarity,4,Progress updates are generally timely\nC08,Training materials,4,Would like a frequently asked questions index": "\u5BA2\u6237\u7F16\u53F7,\u4E3B\u9898,\u8BC4\u5206,\u53CD\u9988\nC01,\u54CD\u5E94\u65F6\u6548,3,\u9AD8\u5CF0\u671F\u56DE\u590D\u504F\u6162\nC02,\u57F9\u8BAD\u8D44\u6599,4,\u5165\u95E8\u624B\u518C\u6E05\u695A\u4F46\u5E0C\u671B\u8865\u5145\u6848\u4F8B\nC03,\u54CD\u5E94\u65F6\u6548,2,\u7D27\u6025\u95EE\u9898\u7B49\u5F85\u8F83\u4E45\nC04,\u6D41\u7A0B\u6E05\u6670\u5EA6,3,\u4E0D\u6E05\u695A\u95EE\u9898\u8F6C\u4EA4\u7ED9\u4E86\u8C01\nC05,\u57F9\u8BAD\u8D44\u6599,5,\u89C6\u9891\u6559\u7A0B\u5F88\u6709\u5E2E\u52A9\nC06,\u54CD\u5E94\u65F6\u6548,3,\u5E0C\u671B\u660E\u786E\u9884\u8BA1\u56DE\u590D\u65F6\u95F4\nC07,\u6D41\u7A0B\u6E05\u6670\u5EA6,4,\u8FDB\u5EA6\u66F4\u65B0\u57FA\u672C\u53CA\u65F6\nC08,\u57F9\u8BAD\u8D44\u6599,4,\u5E0C\u671B\u589E\u52A0\u5E38\u89C1\u95EE\u9898\u7D22\u5F15",
  "## Analysis plan\n\n1. Check all 8 interviews and the 1\u20135 rating range.\n2. Calculate the overall average, topic counts, and number of ratings at or below 3.\n3. Keep customer IDs with each finding for review.\n4. Organize the brief into an overview, customer feedback, and next week\u2019s actions.": "## \u6574\u7406\u8BA1\u5212\n\n1. \u6838\u5BF9 8 \u4EFD\u56DE\u8BBF\uFF0C\u8BC4\u5206\u8303\u56F4\u4E3A 1\u20135 \u5206\u3002\n2. \u7EDF\u8BA1\u6574\u4F53\u5E73\u5747\u5206\u3001\u4E3B\u9898\u6570\u91CF\u548C\u8BC4\u5206\u4E0D\u9AD8\u4E8E 3 \u7684\u6570\u91CF\u3002\n3. \u6BCF\u6761\u53D1\u73B0\u4FDD\u7559\u5BA2\u6237\u7F16\u53F7\uFF0C\u4F9B\u5468\u4F1A\u6838\u67E5\u3002\n4. \u7B80\u62A5\u6309\u6574\u4F53\u60C5\u51B5\u3001\u5BA2\u6237\u58F0\u97F3\u3001\u4E0B\u5468\u884C\u52A8\u4E09\u90E8\u5206\u7EC4\u7EC7\u3002",
  "## Draft outline\n\nTitle: Weekly customer feedback brief.\n\n- Opening: Average rating and the week\u2019s main issues.\n- Middle: Customer feedback by topic.\n- Closing: Two actions for next week.\n\nKeep it to one page, with conclusions followed by evidence.": "## \u7B80\u62A5\u7ED3\u6784\u521D\u7A3F\n\n\u6807\u9898\uFF1A\u672C\u5468\u5BA2\u6237\u56DE\u8BBF\u7B80\u62A5\u3002\n\n- \u5F00\u5934\uFF1A\u5E73\u5747\u8BC4\u5206\u4E0E\u672C\u5468\u4E3B\u8981\u95EE\u9898\u3002\n- \u4E2D\u95F4\uFF1A\u6309\u4E3B\u9898\u5C55\u793A\u5BA2\u6237\u58F0\u97F3\u3002\n- \u7ED3\u5C3E\uFF1A\u5217\u51FA\u4E0B\u5468\u7684\u4E24\u9879\u884C\u52A8\u3002\n\n\u63A7\u5236\u5728\u4E00\u9875\uFF0C\u5148\u7ED9\u7ED3\u8BBA\uFF0C\u518D\u7ED9\u4F9D\u636E\u3002",
  "## Review\n\nThe outline covers ratings, topics, and actions. Add three details:\n\n1. Show the sample size and 1\u20135 scale beside the average.\n2. Retain customer IDs to trace feedback to the source.\n3. Separate actual feedback from recommendations.": "## \u5BA1\u6838\u610F\u89C1\n\n\u7ED3\u6784\u5305\u542B\u6574\u4F53\u8BC4\u5206\u3001\u4E3B\u9898\u4E0E\u884C\u52A8\uFF0C\u9002\u5408\u5468\u4F1A\u3002\u8BF7\u8865\u9F50\u4E09\u5904\uFF1A\n\n1. \u5E73\u5747\u5206\u65C1\u6CE8\u660E\u6837\u672C\u6570\u548C 1\u20135 \u5206\u91CF\u8868\u3002\n2. \u5BA2\u6237\u58F0\u97F3\u4FDD\u7559\u7F16\u53F7\uFF0C\u4FBF\u4E8E\u56DE\u5230\u539F\u8868\u3002\n3. \u5206\u5F00\u5199\u5B9E\u9645\u53CD\u9988\u4E0E\u884C\u52A8\u5EFA\u8BAE\u3002",
  "## Revised outline\n\n- Overview: 8 interviews, a 1\u20135 scale, and the average rating.\n- Topic distribution: Counts must total 8.\n- Customer feedback: Retain IDs and explain ratings at or below 3.\n- Next week: Propose two actions and suggested owners for the meeting to confirm.": "## \u4FEE\u8BA2\u540E\u7684\u7B80\u62A5\u7ED3\u6784\n\n- \u6574\u4F53\u60C5\u51B5\uFF1A8 \u4EFD\u56DE\u8BBF\u30011\u20135 \u5206\u91CF\u8868\u3001\u5E73\u5747\u5206\u3002\n- \u4E3B\u9898\u5206\u5E03\uFF1A\u5404\u4E3B\u9898\u6570\u91CF\uFF0C\u5408\u8BA1\u5E94\u4E3A 8\u3002\n- \u5BA2\u6237\u58F0\u97F3\uFF1A\u4FDD\u7559\u7F16\u53F7\uFF0C\u8BF4\u660E\u8BC4\u5206\u4E0D\u9AD8\u4E8E 3 \u7684\u53CD\u9988\u3002\n- \u4E0B\u5468\u884C\u52A8\uFF1A\u63D0\u51FA\u4E24\u9879\u5EFA\u8BAE\uFF0C\u6807\u660E\u5EFA\u8BAE\u8D1F\u8D23\u4EBA\uFF0C\u4F9B\u5468\u4F1A\u786E\u8BA4\u3002",
  "# findings.md\n\n## Statistics\n- Interviews: 8.\n- Average rating: 3.50 / 5 (28 \xF7 8).\n- Ratings at or below 3: 4, or 50%.\n\n| Topic | Interviews | Average rating |\n| --- | ---: | ---: |\n| Response time | 3 | 2.67 |\n| Training materials | 3 | 4.33 |\n| Process clarity | 2 | 3.50 |\n\n## Source evidence\nC01, C03, and C06 mention waiting or estimated response times. C04 wants to know who handles an escalated issue. C02 and C08 ask for examples and an FAQ index.\n\n## Verification\nPython read 8 rows; topic counts total 3 + 3 + 2 = 8; ratings total 28.\nOutput files: summary.csv and findings.md.": "# findings.md\n\n## \u7EDF\u8BA1\u7ED3\u679C\n- \u56DE\u8BBF\u6837\u672C\uFF1A8 \u4EFD\u3002\n- \u5E73\u5747\u8BC4\u5206\uFF1A3.50 / 5\uFF08\u603B\u5206 28 \xF7 8\uFF09\u3002\n- \u8BC4\u5206\u4E0D\u9AD8\u4E8E 3\uFF1A4 \u4EFD\uFF0C\u5360 50%\u3002\n\n| \u4E3B\u9898 | \u56DE\u8BBF\u6570 | \u5E73\u5747\u8BC4\u5206 |\n| --- | ---: | ---: |\n| \u54CD\u5E94\u65F6\u6548 | 3 | 2.67 |\n| \u57F9\u8BAD\u8D44\u6599 | 3 | 4.33 |\n| \u6D41\u7A0B\u6E05\u6670\u5EA6 | 2 | 3.50 |\n\n## \u539F\u8868\u4F9D\u636E\nC01\u3001C03\u3001C06 \u63D0\u5230\u7B49\u5F85\u6216\u9884\u8BA1\u56DE\u590D\u65F6\u95F4\u3002C04 \u5E0C\u671B\u77E5\u9053\u95EE\u9898\u8F6C\u4EA4\u7ED9\u8C01\u3002C02\u3001C08 \u5E0C\u671B\u8865\u5145\u6848\u4F8B\u548C\u5E38\u89C1\u95EE\u9898\u7D22\u5F15\u3002\n\n## \u6838\u5BF9\u8BB0\u5F55\nPython \u5DF2\u8BFB\u5165 8 \u884C\uFF1B\u4E3B\u9898\u6570\u91CF 3 + 3 + 2 = 8\uFF1B\u8BC4\u5206\u603B\u548C\u4E3A 28\u3002\n\u8F93\u51FA\u6587\u4EF6\uFF1Asummary.csv\u3001findings.md\u3002",
  "# Weekly customer feedback brief\n\nThis week\u2019s **8 interviews** have an average rating of **3.50 / 5**; 4 ratings are at or below 3. Ratings use a 1\u20135 scale, with 5 the highest.\n\n## Key findings\n- **Response time needs priority attention**: 3 interviews averaging 2.67. C01, C03, and C06 want shorter waits or estimated response times.\n- **Training materials are well received**: 3 interviews averaging 4.33. C02 and C08 request examples and an index.\n- **Issue handoffs could be clearer**: 2 interviews averaging 3.50. C04 wants to know the current owner.\n\n## Proposed actions for next week\n1. The support lead should trial response-time estimates and owner indicators, then review feedback next week.\n2. The training owner should add a common example and FAQ index, then gather feedback in the next interviews.\n\nSource: customer-feedback.csv \u2192 summary.csv / findings.md.": "# \u672C\u5468\u5BA2\u6237\u56DE\u8BBF\u7B80\u62A5\n\n\u672C\u5468\u6536\u96C6 **8 \u4EFD\u56DE\u8BBF**\uFF0C\u5E73\u5747\u8BC4\u5206 **3.50 / 5**\uFF1B\u5176\u4E2D 4 \u4EFD\u8BC4\u5206\u4E0D\u9AD8\u4E8E 3\u3002\u8BC4\u5206\u91CF\u8868\u4E3A 1\u20135 \u5206\uFF0C5 \u5206\u6700\u9AD8\u3002\n\n## \u4E3B\u8981\u53D1\u73B0\n- **\u54CD\u5E94\u65F6\u6548\u503C\u5F97\u4F18\u5148\u5173\u6CE8**\uFF1A3 \u4EFD\u53CD\u9988\uFF0C\u5E73\u5747 2.67 \u5206\u3002C01\u3001C03\u3001C06 \u5E0C\u671B\u7F29\u77ED\u7B49\u5F85\u6216\u660E\u786E\u9884\u8BA1\u56DE\u590D\u65F6\u95F4\u3002\n- **\u57F9\u8BAD\u8D44\u6599\u6574\u4F53\u8BC4\u4EF7\u8F83\u597D**\uFF1A3 \u4EFD\u53CD\u9988\uFF0C\u5E73\u5747 4.33 \u5206\u3002C02\u3001C08 \u5E0C\u671B\u8865\u5145\u6848\u4F8B\u548C\u7D22\u5F15\u3002\n- **\u95EE\u9898\u6D41\u8F6C\u53EF\u4EE5\u66F4\u6E05\u695A**\uFF1A2 \u4EFD\u53CD\u9988\uFF0C\u5E73\u5747 3.50 \u5206\u3002C04 \u5E0C\u671B\u77E5\u9053\u5F53\u524D\u5904\u7406\u4EBA\u3002\n\n## \u4E0B\u5468\u884C\u52A8\u5EFA\u8BAE\n1. \u7531\u5BA2\u670D\u7EC4\u957F\u8BD5\u884C\u9884\u8BA1\u56DE\u590D\u65F6\u95F4\u548C\u5904\u7406\u4EBA\u63D0\u793A\uFF0C\u4E0B\u5468\u56DE\u770B\u76F8\u5173\u53CD\u9988\u3002\n2. \u7531\u57F9\u8BAD\u8D1F\u8D23\u4EBA\u8865\u5145\u4E00\u4E2A\u5E38\u89C1\u6848\u4F8B\u548C\u95EE\u9898\u7D22\u5F15\uFF0C\u5728\u4E0B\u6B21\u56DE\u8BBF\u65F6\u6536\u96C6\u8BC4\u4EF7\u3002\n\n\u4F9D\u636E\uFF1Acustomer-feedback.csv \u2192 summary.csv / findings.md\u3002",
  "Add input, write an input prompt, or generate upstream output before running this Agent alone.": "\u8BF7\u5148\u6DFB\u52A0\u8F93\u5165\u5185\u5BB9\u3001\u586B\u5199\u8F93\u5165\u63D0\u793A\u8BCD\uFF0C\u6216\u751F\u6210\u4E0A\u6E38\u8F93\u51FA\u540E\u518D\u5355\u72EC\u8FD0\u884C\u3002",
  "Could not load model presets and Agent library: {0}": "\u6A21\u578B\u9884\u8BBE\u4E0E Agent \u5E93\u8BFB\u53D6\u5931\u8D25\uFF1A{0}",
  "The Agent library has not loaded. Restart the app and try again": "Agent \u5E93\u5C1A\u672A\u52A0\u8F7D\uFF0C\u8BF7\u91CD\u542F\u5E94\u7528\u540E\u91CD\u8BD5",
  "Could not save the Agent library: {0}": "Agent \u5E93\u4FDD\u5B58\u5931\u8D25\uFF1A{0}",
  "AgentLibraryProvider is missing": "Agent \u5E93\u4E0A\u4E0B\u6587\u672A\u52A0\u8F7D",
  "Could not update OpenRouter model capabilities. Fetch models again in provider settings.": "OpenRouter \u6A21\u578B\u80FD\u529B\u66F4\u65B0\u5931\u8D25\uFF0C\u8BF7\u5728\u670D\u52A1\u5546\u8BBE\u7F6E\u4E2D\u91CD\u65B0\u83B7\u53D6\u6A21\u578B\u3002",
  "Could not load model settings: {0}": "\u6A21\u578B\u8BBE\u7F6E\u8BFB\u53D6\u5931\u8D25\uFF1A{0}",
  "Autosave failed. Try again.": "\u81EA\u52A8\u4FDD\u5B58\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5\u3002",
  "Could not save. The window has been kept open.": "\u65E0\u6CD5\u4FDD\u5B58\uFF0C\u5DF2\u4FDD\u7559\u7A97\u53E3\u3002",
  "Could not open the project directory": "\u65E0\u6CD5\u6253\u5F00\u9879\u76EE\u76EE\u5F55",
  "Choose a save directory in the desktop app": "\u8BF7\u5728\u684C\u9762\u5E94\u7528\u4E2D\u9009\u62E9\u4FDD\u5B58\u76EE\u5F55",
  "This directory already contains a Flow project. Choose another directory or move into an existing project.": "\u8BE5\u76EE\u5F55\u5DF2\u6709 Flow \u9879\u76EE\uFF0C\u8BF7\u9009\u62E9\u5176\u4ED6\u76EE\u5F55\u6216\u79FB\u5165\u73B0\u6709\u9879\u76EE\u3002",
  "The destination contains files with the same names. Choose another location.": "\u76EE\u6807\u76EE\u5F55\u5B58\u5728\u540C\u540D\u6587\u4EF6\uFF0C\u8BF7\u9009\u62E9\u5176\u4ED6\u4FDD\u5B58\u4F4D\u7F6E\u3002",
  "The temporary or destination project is no longer available.": "\u4E34\u65F6\u9879\u76EE\u6216\u76EE\u6807\u9879\u76EE\u5DF2\u4E0D\u53EF\u7528\u3002",
  "Could not check or copy files from the temporary directory.": "\u65E0\u6CD5\u68C0\u67E5\u6216\u590D\u5236\u4E34\u65F6\u76EE\u5F55\u4E2D\u7684\u6587\u4EF6\u3002",
  "Files were processed, but project metadata could not be saved. Try again.": "\u6587\u4EF6\u5DF2\u5904\u7406\uFF0C\u4F46\u9879\u76EE\u5143\u6570\u636E\u4FDD\u5B58\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5\u3002",
  "Could not read the local workspace": "\u65E0\u6CD5\u8BFB\u53D6\u672C\u5730\u5DE5\u4F5C\u533A",
  "Opening project": "\u6B63\u5728\u6253\u5F00\u9879\u76EE",
  "Logs and diagnostics": "\u65E5\u5FD7\u4E0E\u8BCA\u65AD",
  "Close": "\u5173\u95ED",
  "New group": "\u65B0\u5206\u7EC4",
  "{0} \xB7 Provider is not configured or enabled": "{0} \xB7 \u670D\u52A1\u5546\u672A\u914D\u7F6E\u6216\u672A\u542F\u7528",
  "{0} \xB7 Model {1} is not in the current model list": "{0} \xB7 \u6A21\u578B {1} \u4E0D\u5728\u5F53\u524D\u6A21\u578B\u5217\u8868\u4E2D",
  "The complete example is ready. Open \u201CWeekly brief\u201D to view the result.": "\u5B8C\u6574\u793A\u4F8B\u5DF2\u5C31\u7EEA\uFF0C\u53EF\u6253\u5F00\u300C\u5468\u4F1A\u7B80\u62A5\u300D\u67E5\u770B\u6210\u679C\u3002",
  "Finish or stop the current task before opening the tutorial.": "\u8BF7\u7B49\u5F85\u5F53\u524D\u4EFB\u52A1\u5B8C\u6210\u6216\u505C\u6B62\u540E\uFF0C\u518D\u6253\u5F00\u6559\u7A0B\u3002",
  "Could not open the tutorial project": "\u65E0\u6CD5\u6253\u5F00\u6559\u7A0B\u9879\u76EE",
  "Complete the highlighted action to continue.": "\u8BF7\u5B8C\u6210\u9AD8\u4EAE\u4F4D\u7F6E\u7684\u64CD\u4F5C\u540E\u7EE7\u7EED\u3002",
  "Replay this example from Help \u2192 Interactive tutorial.": "\u4ECE\u300C\u5E2E\u52A9 \u2192 \u4EA4\u4E92\u6559\u7A0B\u300D\u53EF\u91CD\u65B0\u4F53\u9A8C\u8FD9\u4E2A\u793A\u4F8B\u3002",
  "Codex data analysis": "Codex \u8BFB\u8868\u4E0E\u7EDF\u8BA1",
  "Claude Code data analysis": "Claude Code \u8BFB\u8868\u4E0E\u7EDF\u8BA1",
  "Historical state": "\u5386\u53F2\u72B6\u6001",
  "Created a local branch from the historical Flow. You can edit it now.": "\u5DF2\u4ECE\u5386\u53F2 Flow \u521B\u5EFA\u672C\u5730\u5206\u652F\uFF0C\u53EF\u7EE7\u7EED\u4FEE\u6539\uFF1B\u539F\u5DE5\u4F5C\u72B6\u6001\u4FDD\u6301\u4E0D\u53D8",
  "Viewing a read-only historical state. Fork it to edit and run.": "\u6B63\u5728\u67E5\u770B\u53EA\u8BFB\u5386\u53F2\u72B6\u6001\uFF1B\u6D3E\u751F\u540E\u53EF\u7EE7\u7EED\u7F16\u8F91\u548C\u8FD0\u884C",
  "Returned to working state": "\u5DF2\u8FD4\u56DE\u5DE5\u4F5C\u72B6\u6001",
  "State renamed": "\u72B6\u6001\u5DF2\u91CD\u547D\u540D",
  "Forked historical state into a new Flow": "\u5DF2\u4ECE\u5386\u53F2\u72B6\u6001\u6D3E\u751F\u4E3A\u65B0\u7684 Flow",
  "Nothing to undo": "\u6CA1\u6709\u53EF\u64A4\u9500\u7684\u64CD\u4F5C",
  "Undid the last Flow edit": "\u5DF2\u64A4\u9500\u4E0A\u4E00\u6B65 Flow \u7F16\u8F91",
  "Nothing to redo": "\u6CA1\u6709\u53EF\u91CD\u505A\u7684\u64CD\u4F5C",
  "Redid the Flow edit": "\u5DF2\u91CD\u505A Flow \u7F16\u8F91",
  "{0} added": "{0} \u5DF2\u6DFB\u52A0",
  "This connection is unavailable. Reconnect in settings before adding it.": "\u8BE5\u8FDE\u63A5\u5DF2\u4E0D\u53EF\u7528\uFF0C\u8BF7\u5728\u8BBE\u7F6E\u4E2D\u91CD\u65B0\u8FDE\u63A5\u540E\u518D\u6DFB\u52A0\u3002",
  "{0} is no longer available from {1}. Choose another model.": "{0} \u5DF2\u4E0D\u5728 {1} \u7684\u53EF\u7528\u6A21\u578B\u5217\u8868\u4E2D\uFF0C\u8BF7\u91CD\u65B0\u9009\u62E9\u3002",
  "{0} duplicated": "{0} \u5DF2\u590D\u5236",
  "{0} copied. Press Ctrl+V to paste": "{0} \u5DF2\u590D\u5236\uFF0C\u53EF\u7528 Ctrl+V \u7C98\u8D34",
  "Input {0}": "\u8F93\u5165 {0}",
  "Text input": "\u6587\u672C\u8F93\u5165",
  "The result node is required by its Agent. Delete the owning Agent to remove it": "\u7ED3\u679C\u4E3A\u6240\u5C5E Agent \u7684\u5FC5\u8981\u8282\u70B9\uFF1B\u5982\u9700\u5220\u9664\uFF0C\u8BF7\u5220\u9664\u6240\u5C5E Agent",
  "Deleted {0} nodes and {1} selected links": "\u5DF2\u5220\u9664 {0} \u4E2A\u8282\u70B9\u548C {1} \u6761\u6240\u9009\u8FDE\u63A5",
  "Group {0}": "\u5206\u7EC4 {0}",
  "Added {0} nodes to a new group": "\u5DF2\u5C06 {0} \u4E2A\u8282\u70B9\u52A0\u5165\u65B0\u5206\u7EC4",
  "Selected all {0} nodes and {1} links": "\u5DF2\u9009\u62E9\u5168\u90E8 {0} \u4E2A\u8282\u70B9\u548C {1} \u6761\u8FDE\u63A5",
  "This Flow has no elements to select": "\u5F53\u524D Flow \u6CA1\u6709\u53EF\u9009\u62E9\u7684\u5143\u7D20",
  "Ungrouped nodes": "\u5DF2\u53D6\u6D88\u5206\u7EC4\uFF0C\u8282\u70B9\u4F4D\u7F6E\u4FDD\u6301\u4E0D\u53D8",
  "\u201C{0}\u201D saved to Agent library": "\u300C{0}\u300D\u5DF2\u4FDD\u5B58\u5230 Agent \u5E93",
  "Could not save Agent": "Agent \u4FDD\u5B58\u5931\u8D25",
  "Link type updated and default prompts synchronized for {0}": "\u8FDE\u63A5\u7C7B\u578B\u5DF2\u66F4\u65B0\uFF1B{0} \u7684\u9ED8\u8BA4\u63D0\u793A\u8BCD\u5DF2\u540C\u6B65",
  "Downstream Agent": "\u4E0B\u6E38 Agent",
  "Link type updated. Custom or locked prompts for {0} retained": "\u8FDE\u63A5\u7C7B\u578B\u5DF2\u66F4\u65B0\uFF1B{0} \u7684\u81EA\u5B9A\u4E49\u6216\u9501\u5B9A\u63D0\u793A\u8BCD\u5DF2\u4FDD\u7559",
  "Link type updated": "\u8FDE\u63A5\u7C7B\u578B\u5DF2\u66F4\u65B0",
  "Open output files in the desktop app.": "\u8BF7\u5728\u684C\u9762\u5E94\u7528\u4E2D\u6253\u5F00\u8F93\u51FA\u6587\u4EF6\u3002",
  "This node has no output files yet.": "\u8BE5\u8282\u70B9\u5C1A\u65E0\u8F93\u51FA\u6587\u4EF6\u3002",
  "Could not open the output file.": "\u65E0\u6CD5\u6253\u5F00\u8F93\u51FA\u6587\u4EF6\u3002",
  "This node has no files to open yet.": "\u8BE5\u8282\u70B9\u6682\u65E0\u53EF\u6253\u5F00\u7684\u6587\u4EF6\u3002",
  "Could not read the Markdown file": "\u65E0\u6CD5\u8BFB\u53D6 Markdown \u6587\u4EF6",
  "Open attachments in the desktop app.": "\u8BF7\u5728\u684C\u9762\u5E94\u7528\u4E2D\u6253\u5F00\u9644\u4EF6\u3002",
  "Could not open the attachment": "\u65E0\u6CD5\u6253\u5F00\u9644\u4EF6",
  "Link created and downstream default prompts synchronized": "\u8FDE\u63A5\u5DF2\u521B\u5EFA\uFF1B\u4E0B\u6E38\u9ED8\u8BA4\u63D0\u793A\u8BCD\u5DF2\u540C\u6B65",
  "Link created. Downstream custom or locked prompts retained": "\u8FDE\u63A5\u5DF2\u521B\u5EFA\uFF1B\u4E0B\u6E38\u81EA\u5B9A\u4E49\u6216\u9501\u5B9A\u63D0\u793A\u8BCD\u5DF2\u4FDD\u7559",
  "Link created": "\u8FDE\u63A5\u5DF2\u521B\u5EFA",
  "A connection endpoint no longer exists": "\u8FDE\u63A5\u7AEF\u70B9\u5DF2\u4E0D\u5B58\u5728",
  "{0} created and the new link connected to the copy": "{0} \u5DF2\u521B\u5EFA\uFF0C\u65B0\u8FDE\u63A5\u5DF2\u8FDE\u63A5\u5230\u526F\u672C",
  "Upstream links merged and downstream default prompts synchronized": "\u4E0A\u6E38\u8FDE\u63A5\u5DF2\u5408\u5E76\u4E3A\u5408\u5E76\uFF1B\u4E0B\u6E38\u9ED8\u8BA4\u63D0\u793A\u8BCD\u5DF2\u540C\u6B65",
  "Upstream links merged": "\u4E0A\u6E38\u8FDE\u63A5\u5DF2\u5408\u5E76\u4E3A\u5408\u5E76",
  "Historical states are read-only. Fork into a new Flow first": "\u5386\u53F2\u72B6\u6001\u4E3A\u53EA\u8BFB\uFF1B\u8BF7\u5148\u6D3E\u751F\u4E3A\u65B0\u7684 Flow",
  "Live providers can be called from the desktop app": "\u771F\u5B9E\u670D\u52A1\u5546\u53EA\u80FD\u5728\u684C\u9762\u5E94\u7528\u4E2D\u8C03\u7528",
  "Flow paused before {0}": "Flow \u5DF2\u5728 {0} \u524D\u6682\u505C",
  "Flow stopped. Completed Agent outputs are available.": "Flow \u5DF2\u505C\u6B62\uFF0C\u5DF2\u5B8C\u6210\u7684 Agent \u8F93\u51FA\u4F1A\u4FDD\u7559\u3002",
  "Batch run complete \xB7 {0} groups": "\u6279\u91CF\u8FD0\u884C\u5DF2\u5B8C\u6210 \xB7 {0} \u7EC4",
  "Flow complete.": "Flow \u5DF2\u5B8C\u6210\u3002",
  "Flow stopped": "Flow \u5DF2\u505C\u6B62",
  "Run failed": "\u8FD0\u884C\u5931\u8D25",
  "{0} generated a new artifact": "{0} \u5DF2\u751F\u6210\u65B0\u7684\u4EA7\u51FA\u7269",
  "Run stopped. Completed artifacts are available.": "\u8FD0\u884C\u5DF2\u505C\u6B62\uFF0C\u5DF2\u5B8C\u6210\u7684\u4EA7\u51FA\u7269\u4F1A\u4FDD\u7559\u3002",
  "Run stopped": "\u8FD0\u884C\u5DF2\u505C\u6B62",
  "You": "\u4F60",
  "Chat reply": "\u804A\u5929\u56DE\u590D",
  "Full conversation": "\u5B8C\u6574\u5BF9\u8BDD",
  "Current reply set as result output": "\u5F53\u524D\u56DE\u590D\u5DF2\u8BBE\u4E3A\u7ED3\u679C\u8F93\u51FA",
  "Conversation up to this point set as result output": "\u622A\u81F3\u6B64\u5904\u7684\u5B8C\u6574\u5BF9\u8BDD\u5DF2\u8BBE\u4E3A\u7ED3\u679C\u8F93\u51FA",
  "New Agent session created": "\u5DF2\u521B\u5EFA\u65B0\u7684 Agent \u4F1A\u8BDD",
  "Return to Flow to continue.": "\u8BF7\u8FD4\u56DE Flow \u7EE7\u7EED\u64CD\u4F5C\u3002",
  "Received: {0}\n\nThis is a local demo response. Configure a provider API key in settings to use a live model.": "\u5DF2\u6536\u5230\uFF1A{0}\n\n\u8FD9\u662F\u6F14\u793A\u6A21\u578B\u7684\u672C\u5730\u54CD\u5E94\u3002\u8BF7\u5728\u8BBE\u7F6E\u4E2D\u914D\u7F6E\u670D\u52A1\u5546 API \u5BC6\u94A5\u540E\u5207\u6362\u5230\u771F\u5B9E\u6A21\u578B\u3002",
  "Model request failed": "\u6A21\u578B\u8C03\u7528\u5931\u8D25",
  "Model changed to {0} \xB7 {1}": "\u6A21\u578B\u5DF2\u5207\u6362\u4E3A {0} \xB7 {1}",
  "Fork the historical state into a new Flow to start a session": "\u5386\u53F2\u72B6\u6001\u4E0D\u590D\u7528\u5F53\u524D\u4F1A\u8BDD\uFF1B\u8BF7\u5148\u6D3E\u751F\u4E3A\u65B0\u7684 Flow",
  "No importable files": "\u6CA1\u6709\u53EF\u5BFC\u5165\u7684\u6587\u4EF6",
  "Input group \xB7 {0} items": "\u8F93\u5165\u7EC4 {0} \u9879",
  "File input": "\u6587\u4EF6\u8F93\u5165",
  "Imported {0} files; filtered {1} unsupported files": "\u5DF2\u5BFC\u5165 {0} \u4E2A\u6587\u4EF6\uFF0C\u8FC7\u6EE4 {1} \u4E2A\u4E0D\u652F\u6301\u7684\u6587\u4EF6",
  "Imported {0} files": "\u5DF2\u5BFC\u5165 {0} \u4E2A\u6587\u4EF6",
  "File processing failed": "\u6587\u4EF6\u5904\u7406\u5931\u8D25",
  "Drop files onto the current Flow canvas.": "\u8BF7\u5C06\u6587\u4EF6\u62D6\u5230\u5F53\u524D Flow \u7684\u753B\u5E03\u3002",
  "Moved {0} items into a new input": "\u5DF2\u5C06 {0} \u9879\u79FB\u5165\u65B0\u8F93\u5165",
  "Could not move files. Try again.": "\u65E0\u6CD5\u79FB\u52A8\u6587\u4EF6\uFF0C\u8BF7\u91CD\u8BD5\u3002",
  "Could not read the dropped node. Drag it again from the model or Agent library": "\u65E0\u6CD5\u8BFB\u53D6\u62D6\u5165\u7684\u8282\u70B9\uFF0C\u8BF7\u4ECE\u6A21\u578B\u6216 Agent \u5E93\u91CD\u65B0\u62D6\u5165",
  "Add at least one Agent first": "\u8BF7\u5148\u6DFB\u52A0\u81F3\u5C11\u4E00\u4E2A Agent",
  "Connect a provider for prompt autofill in settings first": "\u8BF7\u5148\u5728\u8BBE\u7F6E\u4E2D\u8FDE\u63A5\u81F3\u5C11\u4E00\u4E2A\u53EF\u7528\u4E8E\u81EA\u52A8\u586B\u5199\u63D0\u793A\u8BCD\u7684\u670D\u52A1\u5546",
  "Connect a provider for Flow generation in settings first": "\u8BF7\u5148\u5728\u8BBE\u7F6E\u4E2D\u8FDE\u63A5\u81F3\u5C11\u4E00\u4E2A\u53EF\u7528\u4E8E\u751F\u6210 Flow \u7684\u670D\u52A1\u5546",
  "Use the desktop app to autofill prompts with a live provider": "\u81EA\u52A8\u586B\u5199\u63D0\u793A\u8BCD\u53EA\u80FD\u5728\u684C\u9762\u5E94\u7528\u4E2D\u8C03\u7528\u771F\u5B9E\u670D\u52A1\u5546",
  "Choose a connected provider and an available model": "\u8BF7\u9009\u62E9\u5DF2\u8FDE\u63A5\u7684\u670D\u52A1\u5546\u548C\u53EF\u7528\u6A21\u578B",
  "The Flow has changed. Start autofill again to use the current content.": "Flow \u5DF2\u53D1\u751F\u4FEE\u6539\uFF0C\u8BF7\u91CD\u65B0\u81EA\u52A8\u586B\u5199\uFF0C\u5F53\u524D\u5185\u5BB9\u5DF2\u4FDD\u7559\u3002",
  "{0} Agent names": "{0} \u4E2A Agent \u540D\u79F0",
  "{0} Flow details": "{0} \u9879 Flow \u4FE1\u606F",
  "Autofilled {0} prompts{1}; retained {2} locked prompts": "\u5DF2\u81EA\u52A8\u586B\u5199 {0} \u6BB5\u63D0\u793A\u8BCD{1}\uFF1B{2} \u6BB5\u9501\u5B9A\u5185\u5BB9\u4FDD\u6301\u4E0D\u53D8",
  " and updated {0}": "\uFF0C\u5E76\u66F4\u65B0 {0}",
  "Autofill stopped.": "\u5DF2\u505C\u6B62\u81EA\u52A8\u586B\u5199\uFF0C\u63D0\u793A\u8BCD\u4FDD\u6301\u539F\u6837\u3002",
  "Prompt autofill failed": "\u81EA\u52A8\u586B\u5199\u63D0\u793A\u8BCD\u5931\u8D25",
  "Use the desktop app to generate a Flow with a live provider": "\u4ECE\u63CF\u8FF0\u751F\u6210 Flow \u53EA\u80FD\u5728\u684C\u9762\u5E94\u7528\u4E2D\u8C03\u7528\u771F\u5B9E\u670D\u52A1\u5546",
  "The Flow has changed. Generate another preview using the current content.": "Flow \u5DF2\u53D1\u751F\u4FEE\u6539\uFF0C\u8BF7\u91CD\u65B0\u751F\u6210\u9884\u89C8\uFF0C\u5F53\u524D\u5185\u5BB9\u5DF2\u4FDD\u7559\u3002",
  "Generation stopped.": "\u5DF2\u505C\u6B62\u751F\u6210\uFF0C\u5F53\u524D Flow \u4FDD\u6301\u539F\u6837\u3002",
  "Flow generation failed": "\u4ECE\u63CF\u8FF0\u751F\u6210 Flow \u5931\u8D25",
  "The Flow has changed. Generate another preview.": "Flow \u5DF2\u53D1\u751F\u4FEE\u6539\uFF0C\u8BF7\u91CD\u65B0\u751F\u6210\u9884\u89C8\u3002",
  "New Agents added to the current Flow": "\u5DF2\u5C06\u65B0 Agent \u6DFB\u52A0\u5230\u5F53\u524D Flow",
  "Working state replaced. Use Undo to restore the previous structure": "\u5DF2\u8986\u76D6\u5DE5\u4F5C\u72B6\u6001\uFF0C\u53EF\u4F7F\u7528\u64A4\u9500\u6062\u590D\u539F\u7ED3\u6784",
  "Dismiss error": "\u5173\u95ED\u9519\u8BEF",
  "Flow canvas": "Flow \u753B\u5E03",
  "nodes \xB7": "\u4E2A\u8282\u70B9 \xB7",
  "links": "\u6761\u8FDE\u63A5",
  " \xB7 Read-only history": " \xB7 \u53EA\u8BFB\u5386\u53F2\u72B6\u6001",
  "Save project\u2026": "\u4FDD\u5B58\u9879\u76EE\u2026",
  "Retry save": "\u91CD\u8BD5\u4FDD\u5B58",
  "Batch actions": "\u6279\u91CF\u64CD\u4F5C",
  "selected": "\u9879\u5DF2\u9009\u62E9",
  "Shift-click to select more": "Shift \u70B9\u51FB\u7EE7\u7EED\u9009\u62E9",
  "Create group": "\u521B\u5EFA\u5206\u7EC4",
  "Delete": "\u5220\u9664",
  "Drag to an Agent card to create a link": "\u62D6\u5230 Agent \u5361\u7247\u5EFA\u7ACB\u8FDE\u63A5",
  "Start with the first node": "\u4ECE\u7B2C\u4E00\u4E2A\u8282\u70B9\u5F00\u59CB",
  "Add input, drop text files, or create an Agent, then connect them.": "\u6DFB\u52A0\u8F93\u5165\u3001\u62D6\u5165\u6587\u672C\u6587\u4EF6\u6216\u521B\u5EFA Agent\uFF0C\u7136\u540E\u8FDE\u63A5\u4FE1\u606F\u5173\u7CFB\u3002",
  "Add input": "\u6DFB\u52A0\u8F93\u5165",
  "Choose model": "\u9009\u62E9\u6A21\u578B",
  "{0} \xB7 Output": "{0} \xB7 \u8F93\u51FA",
  "Open chat": "\u6253\u5F00\u804A\u5929",
  "Copy": "\u590D\u5236",
  "Duplicate": "\u521B\u5EFA\u526F\u672C",
  "Delete input": "\u5220\u9664\u8F93\u5165",
  "Open owning Agent settings": "\u6253\u5F00\u6240\u5C5E Agent \u8BBE\u7F6E",
  "Run again": "\u91CD\u65B0\u8FD0\u884C",
  "Delete link": "\u5220\u9664\u8FDE\u63A5",
  "Add from model library": "\u4ECE\u6A21\u578B\u5E93\u6DFB\u52A0",
  "Add input node": "\u6DFB\u52A0\u8F93\u5165",
  "Paste Agent": "\u7C98\u8D34 Agent",
  "Undo": "\u64A4\u9500",
  "Paused run discarded": "\u5DF2\u653E\u5F03\u672C\u6B21\u6682\u505C\u8FD0\u884C",
  "Select at least two nodes to create a group": "\u8BF7\u81F3\u5C11\u9009\u62E9\u4E24\u4E2A\u8282\u70B9\u521B\u5EFA\u5206\u7EC4",
  "Some selected nodes already belong to another group": "\u6240\u9009\u8282\u70B9\u4E2D\u5DF2\u6709\u8282\u70B9\u5C5E\u4E8E\u5176\u4ED6\u5206\u7EC4",
  "This group no longer exists": "\u5206\u7EC4\u5DF2\u4E0D\u5B58\u5728",
  "Temporary working directory": "\u4E34\u65F6\u5DE5\u4F5C\u76EE\u5F55",
  "Edit": "\u7F16\u8F91",
  "Redo": "\u91CD\u505A",
  "Cut": "\u526A\u5207",
  "Paste": "\u7C98\u8D34",
  "Select all": "\u5168\u9009",
  "Settings": "\u8BBE\u7F6E",
  "Show sidebar": "\u5C55\u5F00\u4FA7\u680F",
  "Hide sidebar": "\u9690\u85CF\u4FA7\u680F",
  "Application menu": "\u5E94\u7528\u83DC\u5355",
  "{0} menu": "{0}\u83DC\u5355",
  "Search providers\u2026": "\u641C\u7D22\u670D\u52A1\u5546\u2026",
  "Search models\u2026": "\u641C\u7D22\u6A21\u578B\u2026",
  "Diagnostic report exported: {0}": "\u8BCA\u65AD\u62A5\u544A\u5DF2\u5BFC\u51FA\uFF1A{0}",
  "Export failed. Open the log directory from the Help menu.": "\u5BFC\u51FA\u5931\u8D25\uFF0C\u8BF7\u4ECE\u5E2E\u52A9\u83DC\u5355\u6253\u5F00\u65E5\u5FD7\u76EE\u5F55\u3002",
  "The interface encountered an error": "\u754C\u9762\u9047\u5230\u4E86\u9519\u8BEF",
  "Export a diagnostic report and describe what you did before the error in your issue report.": "\u8BF7\u5BFC\u51FA\u8BCA\u65AD\u62A5\u544A\uFF0C\u5728\u95EE\u9898\u53CD\u9988\u4E2D\u63CF\u8FF0\u51FA\u9519\u524D\u7684\u64CD\u4F5C\u3002",
  "Info": "\u4FE1\u606F",
  "Warning": "\u8B66\u544A",
  "Error": "\u9519\u8BEF",
  "Could not read logs. Try again or open the log directory.": "\u65E5\u5FD7\u8BFB\u53D6\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5\u6216\u6253\u5F00\u65E5\u5FD7\u76EE\u5F55\u3002",
  "Report exported to {0}. Attach it to your issue report with reproduction steps and the time of the problem.": "\u62A5\u544A\u5DF2\u5BFC\u51FA\u81F3 {0}\u3002\u8BF7\u5728\u95EE\u9898\u53CD\u9988\u4E2D\u9644\u4E0A\u6B64\u6587\u4EF6\uFF0C\u5E76\u63CF\u8FF0\u590D\u73B0\u6B65\u9AA4\u548C\u53D1\u751F\u65F6\u95F4\u3002",
  "Could not export the report. Try again and choose a writable directory.": "\u62A5\u544A\u5BFC\u51FA\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5\u5E76\u9009\u62E9\u53EF\u5199\u5165\u7684\u76EE\u5F55\u3002",
  "Could not open the log directory. Open the path below manually.": "\u65E0\u6CD5\u6253\u5F00\u65E5\u5FD7\u76EE\u5F55\uFF0C\u8BF7\u6309\u4E0B\u65B9\u8DEF\u5F84\u624B\u52A8\u6253\u5F00\u3002",
  "When reporting a problem, export a diagnostic report and attach it to your issue.": "\u9047\u5230\u95EE\u9898\u65F6\uFF0C\u5BFC\u51FA\u8BCA\u65AD\u62A5\u544A\u5E76\u4F5C\u4E3A\u9644\u4EF6\u63D0\u4EA4\u5230\u95EE\u9898\u53CD\u9988\u3002",
  "Logs are stored in the desktop app. Open Help \u2192 Logs and diagnostics there to view and export them.": "\u65E5\u5FD7\u4FDD\u5B58\u5728\u684C\u9762\u5E94\u7528\u4E2D\u3002\u8BF7\u5728\u684C\u9762\u5E94\u7528\u7684\u201C\u5E2E\u52A9 \u2192 \u65E5\u5FD7\u4E0E\u8BCA\u65AD\u201D\u4E2D\u67E5\u770B\u548C\u5BFC\u51FA\u3002",
  "Diagnostic information": "\u8BCA\u65AD\u4FE1\u606F",
  "Reading diagnostics\u2026": "\u6B63\u5728\u8BFB\u53D6\u8BCA\u65AD\u4FE1\u606F\u2026",
  "Logs record runtime status and errors, with common credentials filtered out. Check error text and file paths before submitting the report.": "\u65E5\u5FD7\u8BB0\u5F55\u8FD0\u884C\u72B6\u6001\u548C\u9519\u8BEF\uFF0C\u5E76\u8FC7\u6EE4\u5E38\u89C1\u51ED\u636E\u3002\u63D0\u4EA4\u524D\u8BF7\u68C0\u67E5\u62A5\u544A\u4E2D\u7684\u9519\u8BEF\u6587\u672C\u548C\u6587\u4EF6\u8DEF\u5F84\u3002",
  "Recent logs": "\u6700\u8FD1\u65E5\u5FD7",
  "Search logs": "\u641C\u7D22\u65E5\u5FD7",
  "Search events or errors": "\u641C\u7D22\u4E8B\u4EF6\u6216\u9519\u8BEF\u4FE1\u606F",
  "Log level": "\u65E5\u5FD7\u7EA7\u522B",
  "All levels": "\u5168\u90E8\u7EA7\u522B",
  "Refresh": "\u5237\u65B0",
  "Showing": "\u663E\u793A",
  "Main process": "\u4E3B\u8FDB\u7A0B",
  "Interface": "\u754C\u9762",
  "Reading logs\u2026": "\u6B63\u5728\u8BFB\u53D6\u65E5\u5FD7\u2026",
  "No matching logs. Adjust the level or search terms.": "\u6CA1\u6709\u5339\u914D\u7684\u65E5\u5FD7\uFF0C\u8BD5\u8BD5\u8C03\u6574\u7EA7\u522B\u6216\u641C\u7D22\u8BCD\u3002",
  "No logs yet. Reproduce the problem, then refresh.": "\u6682\u65E0\u65E5\u5FD7\u3002\u91CD\u73B0\u95EE\u9898\u540E\uFF0C\u70B9\u51FB\u5237\u65B0\u67E5\u770B\u3002",
  "[Image:": "[\u56FE\u50CF\uFF1A",
  "Untitled": "\u672A\u547D\u540D",
  "Reasoning summary": "\u601D\u8003\u6458\u8981",
  "Save failed. Try again": "\u4FDD\u5B58\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5",
  "Saving\u2026": "\u6B63\u5728\u4FDD\u5B58\u2026",
  "Edit input text": "\u7F16\u8F91\u8F93\u5165\u6587\u672C",
  "View Agent output": "\u67E5\u770B Agent \u8F93\u51FA",
  "Back to Flow": "\u8FD4\u56DE Flow",
  "Text view": "\u6587\u672C\u89C6\u56FE",
  "Preview": "\u9884\u89C8",
  "No content yet": "\u6682\u65E0\u5185\u5BB9",
  "Input text content": "\u8F93\u5165\u6587\u672C\u6B63\u6587",
  "Enter text or Markdown": "\u8F93\u5165\u6587\u672C\u6216 Markdown",
  "Unknown attachment format": "\u9644\u4EF6\u683C\u5F0F\u672A\u77E5",
  "Output": "\u8F93\u51FA",
  "nodes \xB7 Drag to move together": "\u4E2A\u8282\u70B9 \xB7 \u62D6\u52A8\u6574\u4F53\u79FB\u52A8",
  "{0} group menu": "{0} \u5206\u7EC4\u83DC\u5355",
  "{0} group actions": "{0} \u5206\u7EC4\u64CD\u4F5C",
  "Rename": "\u91CD\u547D\u540D",
  "Ungroup": "\u53D6\u6D88\u5206\u7EC4",
  "Link type": "\u8FDE\u63A5\u7C7B\u578B",
  "{0} output files": "{0} \u4E2A\u8F93\u51FA\u6587\u4EF6",
  "No files yet": "\u6682\u65E0\u6587\u4EF6",
  "Markdown output": "Markdown \u8F93\u51FA",
  "Waiting to run": "\u7B49\u5F85\u8FD0\u884C",
  "Open {0}": "\u6253\u5F00 {0}",
  "Open output": "\u6253\u5F00\u8F93\u51FA",
  "Quick-save {0}": "\u5FEB\u901F\u4FDD\u5B58 {0}",
  "Save to Agent library": "\u4FDD\u5B58\u5230 Agent \u5E93",
  " \xB7 Not configured": " \xB7 \u672A\u914D\u7F6E",
  "input items": "\u9879\u8F93\u5165",
  " \xB7 {0} attachments": " \xB7 {0} \u4E2A\u9644\u4EF6",
  "Drag to connect": "\u62D6\u52A8\u8FDE\u63A5",
  "Open {0} output in file manager": "\u5728\u8D44\u6E90\u7BA1\u7406\u5668\u4E2D\u6253\u5F00 {0} \u8F93\u51FA",
  "Open output in file manager": "\u5728\u8D44\u6E90\u7BA1\u7406\u5668\u4E2D\u6253\u5F00\u8F93\u51FA",
  "Node name": "\u8282\u70B9\u540D\u79F0",
  "Running": "\u8FD0\u884C\u4E2D",
  "Completed": "\u5DF2\u5B8C\u6210",
  "Stopped": "\u5DF2\u505C\u6B62",
  "Paused": "\u5DF2\u6682\u505C",
  "Waiting": "\u7B49\u5F85\u4E2D",
  "Not run": "\u672A\u8FD0\u884C",
  "Bind a local directory in the desktop app": "\u8BF7\u5728\u684C\u9762\u5E94\u7528\u4E2D\u7ED1\u5B9A\u672C\u5730\u76EE\u5F55",
  "Working directory updated and Agent sessions reset": "\u5DE5\u4F5C\u76EE\u5F55\u5DF2\u66F4\u65B0\uFF0CAgent \u4F1A\u8BDD\u5DF2\u91CD\u7F6E",
  "Open the working directory in the desktop app": "\u8BF7\u5728\u684C\u9762\u5E94\u7528\u4E2D\u6253\u5F00\u5DE5\u4F5C\u76EE\u5F55",
  "Could not open the working directory": "\u65E0\u6CD5\u6253\u5F00\u5DE5\u4F5C\u76EE\u5F55",
  "Session renamed": "\u4F1A\u8BDD\u5DF2\u91CD\u547D\u540D",
  "Session deleted. A new session will be created when you open the Agent": "\u4F1A\u8BDD\u5DF2\u5220\u9664\uFF1B\u518D\u6B21\u6253\u5F00 Agent \u65F6\u4F1A\u521B\u5EFA\u65B0\u4F1A\u8BDD",
  "{0} renamed": "{0} \u5DF2\u91CD\u547D\u540D",
  "Project removed from the list": "\u9879\u76EE\u5DF2\u4ECE\u5217\u8868\u5220\u9664\uFF0C\u5DE5\u4F5C\u76EE\u5F55\u6587\u4EF6\u4FDD\u6301\u4E0D\u53D8",
  "A project must contain at least one Flow": "\u9879\u76EE\u81F3\u5C11\u9700\u8981\u4FDD\u7559\u4E00\u4E2A Flow",
  "Flow deleted": "Flow \u5DF2\u5220\u9664",
  "Created a copy of \u201C{0}\u201D": "\u5DF2\u521B\u5EFA\u300C{0}\u300D\u7684\u526F\u672C",
  "{0} actions": "{0} \u64CD\u4F5C",
  "Cancel": "\u53D6\u6D88",
  "Remove this project\u2019s record from AgentFlow. Files in the working directory are retained.": "\u53EA\u5220\u9664 AgentFlow \u4E2D\u7684\u9879\u76EE\u8BB0\u5F55\uFF0C\u5DE5\u4F5C\u76EE\u5F55\u6587\u4EF6\u4F1A\u4FDD\u7559\u3002",
  "The Flow, sessions, and run history will be deleted from this project.": "Flow\u3001\u4F1A\u8BDD\u548C\u8FD0\u884C\u8BB0\u5F55\u5C06\u4ECE\u6B64\u9879\u76EE\u4E2D\u5220\u9664\u3002",
  "Confirm deletion": "\u786E\u8BA4\u5220\u9664",
  "Unpin": "\u53D6\u6D88\u7F6E\u9876",
  "Pin": "\u7F6E\u9876",
  "Open in file manager": "\u5728\u8D44\u6E90\u7BA1\u7406\u5668\u4E2D\u6253\u5F00",
  "Change working directory": "\u66F4\u6362\u5DE5\u4F5C\u76EE\u5F55",
  "{0} session actions": "{0} \u4F1A\u8BDD\u64CD\u4F5C",
  "Delete this session\u2019s conversation. Opening the Agent again will create a new session.": "\u5220\u9664\u8BE5\u4F1A\u8BDD\u7684\u5BF9\u8BDD\u8BB0\u5F55\u3002Agent \u4F1A\u4FDD\u7559\uFF0C\u4E4B\u540E\u91CD\u65B0\u6253\u5F00\u4F1A\u521B\u5EFA\u65B0\u4F1A\u8BDD\u3002",
  "Delete session": "\u5220\u9664\u4F1A\u8BDD",
  "New Flow": "\u65B0\u5EFA Flow",
  "Temporary project": "\u4E34\u65F6\u9879\u76EE",
  "Untitled project": "\u672A\u547D\u540D\u9879\u76EE",
  "Temporary project {0}": "\u4E34\u65F6\u9879\u76EE {0}",
  "Projects": "\u9879\u76EE",
  "No projects yet": "\u5C1A\u65E0\u9879\u76EE",
  "Resize sessions area": "\u8C03\u6574\u4F1A\u8BDD\u9AD8\u5EA6",
  "Sessions": "\u4F1A\u8BDD",
  "messages": "\u6761\u6D88\u606F",
  "{0} session menu": "{0} \u4F1A\u8BDD\u83DC\u5355",
  "This Flow has no Agent sessions yet.": "\u5F53\u524D Flow \u8FD8\u6CA1\u6709 Agent \u4F1A\u8BDD\u3002",
  "Resize sidebar": "\u8C03\u6574\u4FA7\u680F\u5BBD\u5EA6",
  "Batch {0}/{1}": "\u6279\u6B21 {0}/{1}",
  "Run {0}": "\u8FD0\u884C {0}",
  "Working State": "\u5DE5\u4F5C\u72B6\u6001",
  "Rename {0}": "\u91CD\u547D\u540D {0}",
  "Fork a new Flow from {0}": "\u4ECE {0} \u6D3E\u751F\u65B0 Flow",
  "Fork into new Flow": "\u6D3E\u751F\u4E3A\u65B0 Flow",
  "Flow actions": "Flow \u64CD\u4F5C",
  "Fork this historical state before running a new Flow": "\u5148\u6D3E\u751F\u8BE5\u5386\u53F2\u72B6\u6001\uFF0C\u518D\u8FD0\u884C\u65B0\u7684 Flow",
  "Stop Flow": "\u505C\u6B62 Flow",
  "Run Flow": "\u8FD0\u884C Flow",
  "Historical state name": "\u5386\u53F2\u72B6\u6001\u540D\u79F0",
  "Save state name": "\u4FDD\u5B58\u72B6\u6001\u540D\u79F0",
  "Cancel rename": "\u53D6\u6D88\u91CD\u547D\u540D",
  "Flow state": "Flow \u72B6\u6001",
  "Fork the historical state before editing prompts": "\u5386\u53F2\u72B6\u6001\u9700\u5148\u6D3E\u751F\u624D\u80FD\u4FEE\u6539\u63D0\u793A\u8BCD",
  "Stop prompt autofill": "\u505C\u6B62\u586B\u5199\u63D0\u793A\u8BCD",
  "Autofill prompts": "\u81EA\u52A8\u586B\u5199\u63D0\u793A\u8BCD",
  "Stop autofill": "\u505C\u6B62\u586B\u5199",
  "Fork the historical state before generating a new Flow": "\u5386\u53F2\u72B6\u6001\u9700\u5148\u6D3E\u751F\u624D\u80FD\u751F\u6210\u65B0 Flow",
  "Stop Flow generation": "\u505C\u6B62\u751F\u6210 Flow",
  "Generate Flow from description": "\u4ECE\u63CF\u8FF0\u751F\u6210 Flow",
  "Stop generation": "\u505C\u6B62\u751F\u6210",
  "Merge": "\u5408\u5E76",
  "{0} upstream \u2192 {1}": "{0} \u4E2A\u4E0A\u6E38 \u2192 {1}",
  "link": "\u8FDE\u63A5",
  "Source": "\u6765\u6E90",
  "Delete merge link": "\u5220\u9664\u5408\u5E76",
  "Relation": "\u5173\u7CFB",
  "Type": "\u7C7B\u578B",
  "graph": "\u753B\u5E03",
  "Flow settings": "Flow \u8BBE\u7F6E",
  "Name": "\u540D\u79F0",
  "Goal": "\u76EE\u6807",
  "Select a node or link to edit its settings": "\u9009\u62E9\u8282\u70B9\u6216\u8FDE\u63A5\u7F16\u8F91\u8BE6\u7EC6\u914D\u7F6E",
  "{0} input items": "{0} \u9879\u8F93\u5165",
  "input": "\u8F93\u5165",
  "Input": "\u8F93\u5165",
  "Input content": "\u8F93\u5165\u5185\u5BB9",
  "Current output": "\u5F53\u524D\u8F93\u51FA",
  "Artifact v": "\u4EA7\u51FA\u7269 v",
  "parent": "\u4E0A\u6E38",
  "Artifacts will be saved here after running": "\u8FD0\u884C\u540E\u5C06\u5728\u8FD9\u91CC\u4FDD\u5B58\u4EA7\u51FA\u7269",
  " output files": " \u4E2A\u8F93\u51FA\u6587\u4EF6",
  "Local Agent output": "\u672C\u673A Agent \u8F93\u51FA",
  "output": "\u8F93\u51FA",
  "Current artifact": "\u5F53\u524D\u4EA7\u51FA\u7269",
  "Run the owning Agent or set a chat reply as output to see it here.": "\u8FD0\u884C\u6240\u5C5E Agent \u6216\u5728\u804A\u5929\u4E2D\u5C06\u56DE\u590D\u8BBE\u4E3A\u8F93\u51FA\u540E\u663E\u793A\u3002",
  "Text": "\u6587\u672C",
  "Attachments": "\u9644\u4EF6",
  "Visible files in this version are sent downstream. Use the eye button to include or exclude a file.": "\u5F53\u524D\u7248\u672C\u4E2D\u663E\u793A\u7684\u6587\u4EF6\u4F1A\u4F20\u7ED9\u4E0B\u6E38\u3002\u70B9\u51FB\u773C\u775B\u5207\u6362\u6587\u4EF6\u662F\u5426\u53C2\u4E0E\u8F93\u5165\u3002",
  "{0} \xB7 Local Agent tool": "{0} \xB7 \u672C\u5730 Agent \u5DE5\u5177",
  "{0} \xB7 Subscription account": "{0} \xB7 \u8BA2\u9605\u8D26\u6237",
  "model": "\u6A21\u578B",
  "Run Agent": "\u5355\u72EC\u8FD0\u884C",
  "Identity and model": "\u8EAB\u4EFD\u4E0E\u6A21\u578B",
  "Prompts": "\u63D0\u793A\u8BCD",
  "Specified output": "\u6307\u5B9A\u8F93\u51FA",
  "Advanced parameters": "\u9AD8\u7EA7\u53C2\u6570",
  "Agent outputs are saved in artifact history after running.": "\u8FD0\u884C Agent \u540E\uFF0C\u8F93\u51FA\u4F1A\u4FDD\u5B58\u5728\u4EA7\u51FA\u7269\u5386\u53F2\u4E2D\u3002",
  "Activity": "\u6D3B\u52A8",
  "No activity yet": "\u6682\u65E0\u8FD0\u884C\u6D3B\u52A8",
  "Delete Agent": "\u5220\u9664 Agent",
  "Empty output": "\u7A7A\u8F93\u51FA",
  "Open Markdown output": "\u6253\u5F00 Markdown \u8F93\u51FA",
  "Open Markdown output in file manager": "\u5728\u8D44\u6E90\u7BA1\u7406\u5668\u4E2D\u6253\u5F00 Markdown \u8F93\u51FA",
  "Local Agent tools": "\u672C\u673A Agent \u5DE5\u5177",
  "Subscription accounts": "\u8BA2\u9605\u8D26\u6237",
  "Agent Provider": "Agent \u670D\u52A1\u5546",
  "Model": "\u6A21\u578B",
  "Agent Model": "Agent \u6A21\u578B",
  "System prompt (optional)": "\u7CFB\u7EDF\u63D0\u793A\u8BCD\uFF08\u53EF\u9009\uFF09",
  "Describe the Agent\u2019s role, responsibilities, or task": "\u63CF\u8FF0 Agent \u7684\u89D2\u8272\u3001\u804C\u8D23\u6216\u4EFB\u52A1",
  "Input prompt (optional)": "\u8F93\u5165\u63D0\u793A\u8BCD\uFF08\u53EF\u9009\uFF09",
  "Describe the input the Agent will receive": "\u63CF\u8FF0 Agent \u5C06\u63A5\u6536\u7684\u8F93\u5165\u6570\u636E",
  "Output prompt (optional)": "\u8F93\u51FA\u63D0\u793A\u8BCD\uFF08\u53EF\u9009\uFF09",
  "Describe the output the Agent should produce": "\u63CF\u8FF0 Agent \u5E94\u751F\u6210\u7684\u8F93\u51FA\u6570\u636E",
  "The result node is being restored. Select this Agent again.": "\u7ED3\u679C\u6B63\u5728\u6062\u590D\uFF0C\u8BF7\u91CD\u65B0\u9009\u62E9\u6B64 Agent\u3002",
  "Output notes (optional)": "\u8F93\u51FA\u5907\u6CE8\uFF08\u53EF\u9009\uFF09",
  "Define the Agent tool\u2019s output. Text answers are saved as Markdown in the result node.": "\u7EA6\u5B9A Agent \u5DE5\u5177\u7684\u8F93\u51FA\u5185\u5BB9\uFF08\u6587\u5B57\u56DE\u7B54\u5C06\u9ED8\u8BA4\u4EE5Markdown\u5F62\u5F0F\u4FDD\u5B58\u8FDB\u7ED3\u679C\u8282\u70B9\uFF09",
  "Extract file text for downstream input": "\u63D0\u53D6\u6587\u4EF6\u6587\u672C\u540E\u4F20\u7ED9\u4E0B\u6E38",
  "Custom": "\u81EA\u5B9A\u4E49",
  "Default": "\u9ED8\u8BA4",
  "Allow autofill to modify": "\u5141\u8BB8\u81EA\u52A8\u586B\u5199\u4FEE\u6539",
  "Lock this prompt": "\u9501\u5B9A\u6B64\u6BB5\u63D0\u793A\u8BCD",
  "Unlock": "\u89E3\u9501",
  "Lock": "\u9501\u5B9A",
  "Unknown size": "\u672A\u77E5\u5927\u5C0F",
  "Back to {0}": "\u8FD4\u56DE {0}",
  "Chat provider": "\u5BF9\u8BDD\u670D\u52A1\u5546",
  "Chat model": "\u5BF9\u8BDD\u6A21\u578B",
  "Chat model parameters": "\u5BF9\u8BDD\u6A21\u578B\u53C2\u6570",
  "Parameters": "\u53C2\u6570",
  "Reset session": "\u91CD\u7F6E\u4F1A\u8BDD",
  " \xB7 Local Agent tool": " \xB7 \u672C\u5730 Agent \u5DE5\u5177",
  " \xB7 Subscription account": " \xB7 \u8BA2\u9605\u8D26\u6237",
  "Chat parameters": "\u5BF9\u8BDD\u53C2\u6570",
  "Model parameters": "\u6A21\u578B\u53C2\u6570",
  "Close model parameters": "\u5173\u95ED\u6A21\u578B\u53C2\u6570",
  "Creating an alternative response to this message": "\u6B63\u5728\u521B\u5EFA\u8FD9\u6761\u6D88\u606F\u7684\u65B0\u5019\u9009",
  "Send a message to {0}": "\u5411 {0} \u53D1\u9001\u6D88\u606F",
  "Flow context \xB7": "Flow \u4E0A\u4E0B\u6587 \xB7",
  "Send message": "\u53D1\u9001\u6D88\u606F",
  "Enter to send \xB7 Shift + Enter for a new line": "Enter \u53D1\u9001 \xB7 Shift + Enter \u6362\u884C",
  "Edit message": "\u7F16\u8F91\u6D88\u606F",
  "Delete message": "\u5220\u9664\u6D88\u606F",
  "Set this reply as result output": "\u5C06\u6B64\u56DE\u590D\u8BBE\u4E3A\u7ED3\u679C\u8F93\u51FA",
  "Set the conversation up to this point as result output": "\u5C06\u622A\u81F3\u6B64\u5904\u7684\u5B8C\u6574\u5BF9\u8BDD\u8BBE\u4E3A\u7ED3\u679C\u8F93\u51FA",
  "Previous response": "\u4E0A\u4E00\u4E2A\u5019\u9009",
  "Next response": "\u4E0B\u4E00\u4E2A\u5019\u9009",
  "An upstream Agent link already exists": "\u5DF2\u6709 Agent \u4E0A\u6E38\u8FDE\u63A5",
  "Agent sources must share one incoming link. Multiple input links are supported.": "Agent \u6765\u6E90\u9700\u8981\u6536\u62E2\u4E3A\u4E00\u6761\u5165\u7AD9\u8FDE\u63A5\uFF1B\u8F93\u5165\u6765\u6E90\u53EF\u4EE5\u4FDD\u7559\u591A\u6761\u3002",
  "New connection: {0} to {1}": "\u65B0\u8FDE\u63A5\uFF1A{0} \u5230 {1}",
  "Current Agent sources:": "\u5F53\u524D Agent \u6765\u6E90\uFF1A",
  "Duplicate creates a downstream Agent copy for the new link. Merge combines the existing and new sources into one link.": "\u590D\u5236\u4F1A\u521B\u5EFA\u4E00\u4E2A\u4E0B\u6E38 Agent \u526F\u672C\uFF0C\u5E76\u628A\u65B0\u8FDE\u63A5\u8FDE\u63A5\u5230\u526F\u672C\u3002\u5408\u5E76\u4F1A\u628A\u73B0\u6709\u6765\u6E90\u548C\u65B0\u6765\u6E90\u5408\u5E76\u4E3A\u4E00\u6761\u5408\u5E76\u8FDE\u63A5\u3002",
  "Duplicate downstream Agent": "\u590D\u5236\u4E0B\u6E38 Agent",
  "Merge sources": "\u5408\u5E76\u4E3A\u5408\u5E76",
  "Confirm prompt autofill": "\u786E\u8BA4\u81EA\u52A8\u586B\u5199",
  "Review the generation scope.": "\u68C0\u67E5\u672C\u6B21\u751F\u6210\u8303\u56F4\u3002",
  "blank or default prompts \xB7": "\u6BB5\u7A7A\u767D\u6216\u9ED8\u8BA4\u63D0\u793A\u8BCD \xB7",
  "connected Agents": "\u4E2A\u5DF2\u8FDE\u63A5 Agent",
  "Prompts to update": "\u672C\u6B21\u5C06\u4FEE\u6539\u4EE5\u4E0B\u63D0\u793A\u8BCD",
  "Blank prompts": "\u7A7A\u767D\u63D0\u793A\u8BCD",
  "No blank prompts": "\u6CA1\u6709\u7A7A\u767D\u63D0\u793A\u8BCD",
  "Default prompts": "\u5DF2\u6709\u9ED8\u8BA4\u63D0\u793A\u8BCD",
  "Modified, unlocked prompts to overwrite": "\u540C\u65F6\u5C06\u8986\u76D6\u4EE5\u4E0B\u88AB\u4FEE\u6539\u8FC7\u4F46\u662F\u672A\u9501\u5B9A\u7684\u63D0\u793A\u8BCD",
  "Modified, unlocked prompts": "\u5DF2\u4FEE\u6539\u4F46\u672A\u9501\u5B9A\u7684\u63D0\u793A\u8BCD",
  "Keep locked": "\u4FDD\u6301\u9501\u5B9A",
  "Disconnected \xB7 Skipped": "\u672A\u8FDE\u5165\u56FE\uFF0C\u4E0D\u751F\u6210",
  "No input is connected yet. Prompt inference may be less accurate.": "\u76EE\u524D\u6CA1\u6709\u8F93\u5165\u8FDE\u63A5\uFF0C\u63D0\u793A\u8BCD\u63A8\u65AD\u53EF\u80FD\u4E0D\u591F\u51C6\u786E\u3002",
  "Input summaries use up to 12 lines and 1,600 characters per item, with 6,000 characters in total.": "\u8F93\u5165\u6458\u8981\u6BCF\u9879\u6700\u591A 12 \u884C\u30011,600 \u5B57\u7B26\uFF0C\u603B\u8BA1\u6700\u591A 6,000 \u5B57\u7B26\u3002",
  "No blank or default prompts": "\u5F53\u524D\u6CA1\u6709\u7A7A\u767D\u6216\u9ED8\u8BA4\u63D0\u793A\u8BCD",
  "Fill blank and default prompts": "\u53EA\u8865\u9F50\u7A7A\u767D\u4E0E\u9ED8\u8BA4",
  "Overwrite all": "\u8986\u76D6\u5168\u90E8",
  "Confirm and autofill": "\u786E\u8BA4\u5E76\u586B\u5199",
  "This Flow already has Agents": "\u5F53\u524D Flow \u5DF2\u6709 Agent",
  "Agents already exist. Choose how to handle the current structure.": "\u4E2A Agent \u5DF2\u5B58\u5728\u3002\u8BF7\u9009\u62E9\u8FD9\u6B21\u751F\u6210\u5982\u4F55\u5904\u7406\u5F53\u524D\u7ED3\u6784\u3002",
  "Extend": "\u7EE7\u7EED\u521B\u5EFA",
  "Add new Agents to the existing Agents, links, prompts, and outputs.": "\u4FDD\u7559\u73B0\u6709 Agent\u3001\u8FDE\u63A5\u3001\u63D0\u793A\u8BCD\u548C\u8F93\u51FA\uFF0C\u5728\u5176\u57FA\u7840\u4E0A\u6DFB\u52A0\u65B0 Agent\u3002",
  "Replace current Flow": "\u8986\u76D6\u73B0\u6709 Flow",
  "Keep inputs and replace current Agents, links, and output selections.": "\u4FDD\u7559\u8F93\u5165\uFF0C\u66FF\u6362\u5F53\u524D Agent\u3001\u8FDE\u63A5\u548C\u8F93\u51FA\u9009\u62E9\u3002",
  "Extend existing Flow": "\u5728\u73B0\u6709\u57FA\u7840\u4E0A\u7EE7\u7EED",
  "{0} inputs \xB7 {1} items used as summary context": "{0} \u4E2A\u8F93\u5165 \xB7 {1} \u9879\u5185\u5BB9\u5C06\u4F5C\u4E3A\u6458\u8981\u4E0A\u4E0B\u6587",
  "No inputs \xB7 Build from description": "\u5F53\u524D\u6CA1\u6709\u8F93\u5165 \xB7 \u53EA\u6839\u636E\u63CF\u8FF0\u6784\u5EFA",
  "Extend \xB7 Keep existing": "\u7EE7\u7EED\u521B\u5EFA \xB7 \u4FDD\u7559\u73B0\u6709",
  "Agents": "Agent",
  "Replace \xB7 Keep inputs and replace existing Agents": "\u8986\u76D6\u6A21\u5F0F \xB7 \u4FDD\u7559\u8F93\u5165\uFF0C\u66FF\u6362\u73B0\u6709 Agent",
  "How should this Flow work together?": "\u4F60\u5E0C\u671B\u8FD9\u4E2A Flow \u5982\u4F55\u534F\u4F5C\uFF1F",
  "For example: Read each interview, extract facts and themes, have a review Agent check the evidence, then generate a structured research summary.": "\u4F8B\u5982\uFF1A\u8BFB\u53D6\u6BCF\u4EFD\u8BBF\u8C08\u8BB0\u5F55\uFF0C\u5148\u63D0\u53D6\u4E8B\u5B9E\u548C\u4E3B\u9898\uFF0C\u518D\u7531\u5BA1\u9605 Agent \u68C0\u67E5\u8BC1\u636E\uFF0C\u6700\u540E\u751F\u6210\u4E00\u4EFD\u7ED3\u6784\u5316\u7814\u7A76\u6458\u8981\u3002",
  "Reads up to 12 lines and 1,600 characters per item, with 6,000 characters across all inputs": "\u6BCF\u9879\u6700\u591A\u8BFB\u53D6 12 \u884C\u30011,600 \u5B57\u7B26\uFF0C\u6240\u6709\u8F93\u5165\u5408\u8BA1\u6700\u591A 6,000 \u5B57\u7B26",
  "; this summary was truncated": "\uFF1B\u672C\u6B21\u6458\u8981\u5DF2\u622A\u65AD",
  "Generate preview": "\u751F\u6210\u9884\u89C8",
  "New Agents": "\u65B0\u589E Agent",
  "New links": "\u65B0\u589E\u8FDE\u63A5",
  "Inputs": "\u8F93\u5165",
  "New Agent": "\u65B0\u589E Agent",
  "Information flow": "\u4FE1\u606F\u5173\u7CFB",
  "Existing Agent {0}": "\u73B0\u6709 Agent {0}",
  "New Agent {0}": "\u65B0\u589E Agent {0}",
  "Regenerate": "\u91CD\u65B0\u751F\u6210",
  "Add to Flow": "\u6DFB\u52A0\u5230 Flow",
  "Replace Flow": "\u8986\u76D6 Flow",
  "Apply Flow": "\u5E94\u7528 Flow",
  "{0} generation model": "{0} \u8C03\u7528\u6A21\u578B",
  "Provider": "\u670D\u52A1\u5546",
  "Choose a connected provider": "\u9009\u62E9\u5DF2\u8FDE\u63A5\u7684\u670D\u52A1\u5546",
  "{0} model": "{0} \u6A21\u578B",
  "Choose a provider first": "\u5148\u9009\u62E9\u670D\u52A1\u5546",
  "Confirm Flow run": "\u786E\u8BA4\u8FD0\u884C Flow",
  "Review inputs and execution scope.": "\u68C0\u67E5\u8F93\u5165\u548C\u6267\u884C\u8303\u56F4\u3002",
  "Agents to run \xB7": "\u4E2A Agent \u5C06\u8FD0\u884C \xB7",
  "inputs": "\u4E2A\u8F93\u5165",
  "groups run sequentially \xB7 Multiple inputs are matched row by row in list order": "\u7EC4\u9010\u9879\u8FD0\u884C \xB7 \u591A\u4E2A\u8F93\u5165\u6309\u5217\u8868\u987A\u5E8F\u9010\u884C\u5BF9\u5E94",
  "Will run": "\u5C06\u8FD0\u884C",
  "No runnable Agents": "\u6CA1\u6709\u53EF\u8FD0\u884C\u7684 Agent",
  "Default prompt values": "\u4EE5\u4E0B\u63D0\u793A\u8BCD\u4E3A\u9ED8\u8BA4\u503C",
  "Disconnected \xB7 Will not run": "\u672A\u8FDE\u63A5\uFF0C\u4E0D\u4F1A\u6267\u884C",
  "{0} \xB7 Unreachable from input": "{0} \xB7 \u65E0\u6CD5\u4ECE\u8F93\u5165\u5230\u8FBE",
  "Empty inputs": "\u7A7A\u8F93\u5165",
  "Resolve before running": "\u8FD0\u884C\u524D\u9700\u8981\u5904\u7406",
  "Batch input issues": "\u6279\u91CF\u8F93\u5165\u9700\u8981\u5904\u7406",
  "Connect at least one input before running.": "\u81F3\u5C11\u8FDE\u63A5\u4E00\u4E2A\u8F93\u5165\u540E\u624D\u80FD\u8FD0\u884C\u3002",
  "Create a local branch?": "\u521B\u5EFA\u672C\u5730\u5206\u652F\uFF1F",
  "Continue to create a new Flow in the current project.": "\u7EE7\u7EED\u540E\u4F1A\u5728\u5F53\u524D\u9879\u76EE\u4E2D\u521B\u5EFA\u4E00\u4E2A\u65B0 Flow\u3002\u539F Flow \u7684\u5DE5\u4F5C\u72B6\u6001\u548C\u5386\u53F2\u8BB0\u5F55\u4FDD\u6301\u4E0D\u53D8\u3002",
  "Create branch": "\u521B\u5EFA\u5206\u652F",
  "Flow paused": "Flow \u5DF2\u6682\u505C",
  "Unsupported files": "\u4E0D\u652F\u6301\u7684\u6587\u4EF6",
  "Reset state": "\u91CD\u7F6E\u72B6\u6001",
  "Handle later": "\u7A0D\u540E\u5904\u7406",
  "Skip files and continue": "\u8DF3\u8FC7\u6587\u4EF6\u5E76\u7EE7\u7EED",
  "Upstream output is missing": "\u4E0A\u6E38\u8FD8\u6CA1\u6709\u8F93\u51FA",
  "Rerun all dependencies from input through {0}.": "\u4ECE\u8F93\u5165\u5F00\u59CB\u91CD\u65B0\u8FD0\u884C\u5168\u90E8\u4E0A\u6E38\u4F9D\u8D56\uFF0C\u6700\u540E\u8FD0\u884C {0}\u3002",
  "Add files": "\u6DFB\u52A0\u6587\u4EF6",
  "files ready": "\u4E2A\u53EF\u5BFC\u5165",
  "Extract text": "\u63D0\u53D6\u6587\u672C",
  "Images": "\u56FE\u7247",
  "Filtered": "\u5DF2\u8FC7\u6EE4",
  "Add to input": "\u52A0\u5165\u8F93\u5165",
  "Choose a project directory in the desktop app": "\u8BF7\u5728\u684C\u9762\u5E94\u7528\u4E2D\u9009\u62E9\u9879\u76EE\u76EE\u5F55",
  "Could not choose directory": "\u65E0\u6CD5\u9009\u62E9\u76EE\u5F55",
  "Save failed. Try again.": "\u4FDD\u5B58\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5\u3002",
  "Could not move into the destination project.": "\u65E0\u6CD5\u79FB\u5165\u76EE\u6807\u9879\u76EE\u3002",
  "Save temporary project": "\u4FDD\u5B58\u4E34\u65F6\u9879\u76EE",
  "Choose where to save the project.": "\u9009\u62E9\u9879\u76EE\u7684\u4FDD\u5B58\u76EE\u5F55\u3002",
  "Save method": "\u4FDD\u5B58\u65B9\u5F0F",
  "New project": "\u65B0\u9879\u76EE",
  "Move into existing project": "\u79FB\u5165\u73B0\u6709\u9879\u76EE",
  "Project name": "\u9879\u76EE\u540D\u79F0",
  "Save location": "\u4FDD\u5B58\u4F4D\u7F6E",
  "Choose the project folder": "\u9009\u62E9\u9879\u76EE\u6240\u5728\u6587\u4EF6\u5939",
  "Choose directory": "\u9009\u62E9\u76EE\u5F55",
  "Project configuration, inputs, Markdown outputs, and attachments are saved in the selected directory\u2019s .flow folder.": "\u9879\u76EE\u914D\u7F6E\u3001\u8F93\u5165\u3001Markdown \u8F93\u51FA\u548C\u9644\u4EF6\u4FDD\u5B58\u5728\u6240\u9009\u76EE\u5F55\u7684 .flow \u6587\u4EF6\u5939\u5185\u3002",
  "Destination project": "\u76EE\u6807\u9879\u76EE",
  "Flows are added to the destination project. Temporary files are copied using their relative paths, without merging file contents.": "Flow \u4F1A\u6DFB\u52A0\u5230\u76EE\u6807\u9879\u76EE\uFF1B\u4E34\u65F6\u76EE\u5F55\u4E2D\u7684\u6587\u4EF6\u6309\u539F\u76F8\u5BF9\u8DEF\u5F84\u76F4\u63A5\u52A0\u5165\u76EE\u6807\u76EE\u5F55\uFF0C\u4E0D\u5408\u5E76\u6587\u4EF6\u5185\u5BB9\u3002",
  "Found": "\u53D1\u73B0",
  "files with different contents at the same paths": "\u4E2A\u4E0D\u540C\u5185\u5BB9\u7684\u540C\u8DEF\u5F84\u6587\u4EF6",
  "No files have been copied yet. Overwriting will replace the destination files.": "\u5C1A\u672A\u590D\u5236\u4EFB\u4F55\u6587\u4EF6\u3002\u8986\u76D6\u4F1A\u76F4\u63A5\u66FF\u6362\u76EE\u6807\u6587\u4EF6\u3002",
  "Plus": "\u53E6\u6709",
  "conflicting files": "\u4E2A\u51B2\u7A81\u6587\u4EF6",
  "Save as new project": "\u4FDD\u5B58\u4E3A\u65B0\u9879\u76EE",
  "Overwrite conflicts and move": "\u8986\u76D6\u51B2\u7A81\u6587\u4EF6\u5E76\u79FB\u5165",
  "Check and move": "\u68C0\u67E5\u5E76\u79FB\u5165",
  "The link references a missing node": "\u8FDE\u63A5\u5F15\u7528\u4E86\u4E0D\u5B58\u5728\u7684\u8282\u70B9",
  "A node cannot connect to itself": "\u8282\u70B9\u4E0D\u80FD\u8FDE\u63A5\u5230\u81EA\u5DF1",
  "The link target must be an Agent": "\u8FDE\u63A5\u7684\u76EE\u6807\u5FC5\u987B\u662F Agent",
  "The relation type does not match the input and Agent": "\u8F93\u5165\u4E0E Agent \u7684\u5173\u7CFB\u7C7B\u578B\u4E0D\u5339\u914D",
  "A merge requires at least two upstream Agents or results": "\u5408\u5E76\u81F3\u5C11\u9700\u8981\u4E24\u4E2A\u4E0A\u6E38 Agent \u6216\u7ED3\u679C",
  "Merge sources must all be Agents or results": "\u5408\u5E76\u7684\u4E0A\u6E38\u5FC5\u987B\u5168\u90E8\u662F Agent \u6216\u7ED3\u679C",
  "Local Agent tools connect downstream through their result nodes": "\u672C\u673A Agent \u5DE5\u5177\u53EA\u80FD\u901A\u8FC7\u6240\u5C5E\u7ED3\u679C\u8282\u70B9\u8FDE\u63A5\u4E0B\u6E38",
  "A link already exists between these nodes": "\u8FD9\u4E24\u4E2A\u8282\u70B9\u5DF2\u7ECF\u5B58\u5728\u8FDE\u63A5",
  "This link would create a cycle. The current version supports DAGs": "\u8FD9\u6761\u8FDE\u63A5\u4F1A\u5F62\u6210\u73AF\uFF0C\u5F53\u524D\u7248\u672C\u53EA\u652F\u6301 DAG",
  "{0} \xB7 Batch list is empty": "{0} \xB7 \u6279\u91CF\u5217\u8868\u4E3A\u7A7A",
  "Batch inputs must have matching item counts: {0}": "\u6279\u91CF\u8F93\u5165\u6570\u91CF\u5FC5\u987B\u4E00\u81F4\uFF1A{0}",
  "{0} \xB7 {1} items": "{0} {1} \u9879",
  "Describe the Flow you want to build first": "\u8BF7\u5148\u63CF\u8FF0\u5E0C\u671B\u6784\u5EFA\u7684 Flow",
  "Flow descriptions cannot exceed {0} characters": "Flow \u63CF\u8FF0\u4E0D\u80FD\u8D85\u8FC7 {0} \u4E2A\u5B57\u7B26",
  "The Flow generation model did not return valid JSON. Try again or choose another model": "Flow \u751F\u6210\u6A21\u578B\u6CA1\u6709\u8FD4\u56DE\u6709\u6548 JSON\uFF0C\u8BF7\u91CD\u8BD5\u6216\u66F4\u6362\u6A21\u578B",
  "Task input": "\u4EFB\u52A1\u8F93\u5165",
  "Agent {0} can have only one upstream Agent route": "Agent {0} \u53EA\u80FD\u6709\u4E00\u6761 Agent \u4E0A\u6E38\u8DEF\u7EBF",
  "The generated result cannot form a valid Flow: {0}": "\u751F\u6210\u7ED3\u679C\u65E0\u6CD5\u7EC4\u6210\u6709\u6548 Flow\uFF1A{0}",
  "The result contains Agents unreachable from input": "\u751F\u6210\u7ED3\u679C\u5305\u542B\u65E0\u6CD5\u4ECE\u8F93\u5165\u5230\u8FBE\u7684 Agent",
  "Could not read the input node": "\u65E0\u6CD5\u8BFB\u53D6\u8F93\u5165\u8282\u70B9",
  "Flow generation result is missing {0}agents or routes": "Flow \u751F\u6210\u7ED3\u679C\u7F3A\u5C11 {0}agents \u6216 routes",
  "Flow generation must include 1\u2013{0} Agents": "Flow \u751F\u6210\u7ED3\u679C\u9700\u8981\u5305\u542B 1\u2013{0} \u4E2A Agent",
  "Flow generation cannot exceed {0} routes": "Flow \u751F\u6210\u7ED3\u679C\u7684\u8FDE\u63A5\u8DEF\u7EBF\u4E0D\u80FD\u8D85\u8FC7 {0} \u6761",
  "Flow generation contains an invalid Agent": "Flow \u751F\u6210\u7ED3\u679C\u5305\u542B\u65E0\u6548 Agent",
  "Flow generation contains an invalid route": "Flow \u751F\u6210\u7ED3\u679C\u5305\u542B\u65E0\u6548\u8DEF\u7EBF",
  "Route target": "\u8DEF\u7EBF target",
  "The route for Agent {0} must contain exactly one source type": "Agent {0} \u7684\u8DEF\u7EBF\u5FC5\u987B\u4E14\u53EA\u80FD\u5305\u542B\u4E00\u79CD\u6765\u6E90",
  "Agent {0} cannot reference an existing Agent": "Agent {0} \u4E0D\u80FD\u5F15\u7528\u73B0\u6709 Agent",
  "Route source": "\u8DEF\u7EBF source",
  "Agent {0} has empty or duplicate route sources": "Agent {0} \u7684\u8DEF\u7EBF\u6765\u6E90\u4E3A\u7A7A\u6216\u91CD\u590D",
  "The input route for Agent {0} does not require a relation": "Agent {0} \u7684\u8F93\u5165\u8DEF\u7EBF\u4E0D\u9700\u8981 relation",
  "The merge route for Agent {0} does not require a relation": "Agent {0} \u7684\u5408\u5E76\u8DEF\u7EBF\u4E0D\u9700\u8981 relation",
  "Agent {0} has only one upstream source and cannot create a merge": "Agent {0} \u53EA\u6709\u4E00\u4E2A\u4E0A\u6E38\u6765\u6E90\uFF0C\u4E0D\u80FD\u521B\u5EFA\u5408\u5E76",
  "Agent {0} has an invalid relation": "Agent {0} \u7684 relation \u65E0\u6548",
  "Multiple upstream sources for Agent {0} must share one merge route": "Agent {0} \u7684\u591A\u4E2A\u4E0A\u6E38\u5FC5\u987B\u5408\u5E76\u5728\u540C\u4E00\u6761\u5408\u5E76\u8DEF\u7EBF\u4E2D",
  "Agent {0} cannot connect to itself": "Agent {0} \u4E0D\u80FD\u8FDE\u63A5\u5230\u81EA\u8EAB",
  "Duplicate link: {0} \u2192 {1}": "\u91CD\u590D\u8FDE\u63A5\uFF1A{0} \u2192 {1}",
  "These Agents have no input source: {0}": "\u4EE5\u4E0B Agent \u6CA1\u6709\u8F93\u5165\u6765\u6E90\uFF1A{0}",
  "No configured models are available for new Agents": "\u5F53\u524D\u6CA1\u6709\u53EF\u4F9B\u65B0 Agent \u4F7F\u7528\u7684\u5DF2\u914D\u7F6E\u6A21\u578B",
  "Invalid {0}": "{0} \u65E0\u6548",
  "{0} is empty": "{0} \u4E3A\u7A7A",
  "{0} is too long": "{0} \u8FC7\u957F",
  "{0} is not a supported text or image format.": "{0} \u4E0D\u662F\u53EF\u63D0\u53D6\u6587\u672C\u6216\u652F\u6301\u7684\u56FE\u7247\u683C\u5F0F\u3002",
  "Text extraction is unavailable for {0}. Convert it to PDF, DOCX, or plain text first.": "{0} \u4E0D\u662F\u5F53\u524D\u53EF\u63D0\u53D6\u7684\u6587\u672C\u6587\u4EF6\uFF1B\u8BF7\u5148\u8F6C\u6362\u4E3A PDF\u3001DOCX \u6216\u7EAF\u6587\u672C\u683C\u5F0F\u3002",
  "Text {0}": "\u6587\u672C {0}",
  "Add text": "\u6DFB\u52A0\u6587\u672C",
  "Run each item": "\u9010\u9879\u8FD0\u884C",
  "Run included input items in order": "\u6309\u987A\u5E8F\u8FD0\u884C\u53C2\u4E0E\u8F93\u5165\u7684\u9879\u76EE",
  "Input item name": "\u8F93\u5165\u9879\u540D\u79F0",
  "Select {0}": "\u9009\u62E9 {0}",
  "Select files; drag to reorder or move into a new input": "\u9009\u62E9\u6587\u4EF6\uFF1B\u62D6\u52A8\u6392\u5E8F\u6216\u79FB\u5165\u65B0\u8F93\u5165",
  "Text file": "\u6587\u672C\u6587\u4EF6",
  "Hidden": "\u9690\u85CF",
  "Show and send downstream": "\u663E\u793A\u5E76\u4F20\u7ED9\u4E0B\u6E38",
  "Hide from downstream input": "\u4ECE\u4E0B\u6E38\u8F93\u5165\u4E2D\u9690\u85CF",
  "Expand to edit {0}": "\u5C55\u5F00\u7F16\u8F91 {0}",
  "Delete {0}": "\u5220\u9664 {0}",
  "Hidden from downstream input": "\u5DF2\u4ECE\u4E0B\u6E38\u8F93\u5165\u4E2D\u9690\u85CF",
  "No text was extracted from this file": "\u6587\u4EF6\u4E2D\u6CA1\u6709\u63D0\u53D6\u5230\u6587\u672C",
  "Enter text to send to the Agent": "\u8F93\u5165\u8981\u4F20\u9012\u7ED9 Agent \u7684\u6587\u672C",
  "Unknown type": "\u672A\u77E5\u7C7B\u578B",
  "Shift-click to select multiple files, then drag onto the canvas to create an input.": "Shift \u70B9\u51FB\u591A\u9009\uFF0C\u62D6\u5230\u753B\u5E03\u6210\u4E3A\u8F93\u5165\u3002",
  "Supports PDF, DOCX, text, and images.": "\u652F\u6301 PDF\u3001DOCX\u3001\u6587\u672C\u4E0E\u56FE\u7247\u3002",
  "Search\u2026": "\u641C\u7D22\u2026",
  "Search {0}": "\u641C\u7D22{0}",
  "Clear search": "\u6E05\u9664\u641C\u7D22",
  "Remove favorite": "\u53D6\u6D88\u6536\u85CF",
  "Favorite": "\u6536\u85CF",
  "Favorite and pin": "\u6536\u85CF\u5E76\u7F6E\u9876",
  "No matching results. Try other keywords.": "\u6CA1\u6709\u5339\u914D\u7684\u7ED3\u679C\uFF0C\u8BF7\u5C1D\u8BD5\u5176\u4ED6\u5173\u952E\u8BCD\u3002",
  "No options available": "\u6682\u65E0\u53EF\u9009\u9879",
  "Favorites could not be saved locally": "\u6536\u85CF\u6682\u672A\u4FDD\u5B58\u5230\u672C\u673A",
  "Try again": "\u91CD\u8BD5",
  "Copied": "\u5DF2\u590D\u5236",
  "Copy failed. Try again": "\u590D\u5236\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5",
  "Copy message": "\u590D\u5236\u6D88\u606F",
  "Maximum output tokens": "\u8F93\u51FA\u4E0A\u9650\uFF08\u8BCD\u5143\uFF09",
  "Reasoning budget \xB7 Tokens": "\u63A8\u7406\u9884\u7B97\uFF08\u8BCD\u5143\uFF09",
  "Reasoning mode": "\u63A8\u7406\u6A21\u5F0F",
  "Reasoning effort": "\u63A8\u7406\u5F3A\u5EA6",
  "On": "\u5F00\u542F",
  "Server default": "\u670D\u52A1\u7AEF\u9ED8\u8BA4",
  "Model default": "\u6A21\u578B\u7AEF",
  "-1 for dynamic budget": "-1 \u52A8\u6001\u9884\u7B97",
  "0 to disable reasoning": "0 \u5173\u95ED\u63A8\u7406",
  "Load model parameter preset": "\u8BFB\u53D6\u6A21\u578B\u53C2\u6570\u9884\u8BBE",
  "Load parameter preset": "\u8BFB\u53D6\u53C2\u6570\u9884\u8BBE",
  "Defaults for this model": "\u6B64\u6A21\u578B\u9ED8\u8BA4\u53C2\u6570",
  "Model defaults applied": "\u5DF2\u5E94\u7528\u6B64\u6A21\u578B\u9ED8\u8BA4\u53C2\u6570",
  "Applied \u201C{0}\u201D": "\u5DF2\u5E94\u7528\u300C{0}\u300D",
  "Delete this parameter preset": "\u5220\u9664\u6B64\u53C2\u6570\u9884\u8BBE",
  "Parameter preset deleted": "\u53C2\u6570\u9884\u8BBE\u5DF2\u5220\u9664",
  "Provider default": "\u5382\u5546\u9ED8\u8BA4",
  "-1 uses the model setting": "-1 \u4F7F\u7528\u6A21\u578B\u7AEF\u8BBE\u7F6E",
  "Fixed by provider": "\u5382\u5546\u56FA\u5B9A\u503C",
  "Unused in the current reasoning mode": "\u5F53\u524D\u63A8\u7406\u6A21\u5F0F\u4E0D\u4F7F\u7528\u6B64\u53C2\u6570",
  "Response detail": "\u56DE\u7B54\u8BE6\u7EC6\u7A0B\u5EA6",
  "Verbosity": "\u56DE\u7B54\u8BE6\u7EC6\u7A0B\u5EA6",
  "Parameter documentation": "\u53C2\u6570\u6587\u6863",
  "Saved as defaults for this model": "\u5DF2\u8BBE\u4E3A\u6B64\u6A21\u578B\u7684\u9ED8\u8BA4\u53C2\u6570",
  "Set as model defaults": "\u8BBE\u4E3A\u6A21\u578B\u9ED8\u8BA4",
  "Save as preset": "\u5B58\u4E3A\u9884\u8BBE",
  "Initial app parameters restored": "\u5DF2\u6062\u590D\u5E94\u7528\u521D\u59CB\u53C2\u6570",
  "Reset": "\u91CD\u7F6E",
  "Model parameter preset saved": "\u6A21\u578B\u53C2\u6570\u9884\u8BBE\u5DF2\u4FDD\u5B58",
  "Parameter preset name": "\u53C2\u6570\u9884\u8BBE\u540D\u79F0",
  "Preset name": "\u9884\u8BBE\u540D\u79F0",
  "Save preset": "\u4FDD\u5B58\u9884\u8BBE",
  "Custom request parameters": "\u81EA\u5B9A\u4E49\u8BF7\u6C42\u53C2\u6570",
  "Add custom request parameter": "\u6DFB\u52A0\u81EA\u5B9A\u4E49\u8BF7\u6C42\u53C2\u6570",
  "Add parameter": "\u6DFB\u52A0\u53C2\u6570",
  "Parameter {0} name": "\u53C2\u6570 {0} \u540D\u79F0",
  "Parameter name": "\u53C2\u6570\u540D",
  "Parameter {0} value": "\u53C2\u6570 {0} \u503C",
  "Value": "\u503C",
  "Delete parameter {0}": "\u5220\u9664\u53C2\u6570 {0}",
  "Parameter names must be nonempty and unique.": "\u53C2\u6570\u540D\u4E0D\u80FD\u4E3A\u7A7A\u6216\u91CD\u590D\u3002",
  "Stop sequences \xB7 One per line, up to 4": "\u505C\u6B62\u5E8F\u5217 \xB7 \u6BCF\u884C\u4E00\u6761\uFF0C\u6700\u591A 4 \u6761",
  "Stop sequences": "\u505C\u6B62\u5E8F\u5217",
  "Not saved: up to 4 stop sequences are allowed.": "\u672A\u4FDD\u5B58\uFF1A\u505C\u6B62\u5E8F\u5217\u6700\u591A 4 \u6761\u3002",
  "The file selection has expired. Drag again.": "\u6587\u4EF6\u9009\u62E9\u5DF2\u5931\u6548\uFF0C\u8BF7\u91CD\u65B0\u62D6\u52A8\u3002",
  "The source file version has changed. Select the files again.": "\u6E90\u6587\u4EF6\u7248\u672C\u5DF2\u53D8\u5316\uFF0C\u8BF7\u91CD\u65B0\u9009\u62E9\u6587\u4EF6\u3002",
  "Some files have moved. Select them again.": "\u90E8\u5206\u6587\u4EF6\u5DF2\u79FB\u52A8\uFF0C\u8BF7\u91CD\u65B0\u9009\u62E9\u6587\u4EF6\u3002",
  "Node files": "\u8282\u70B9\u6587\u4EF6",
  "Open {0} in file manager": "\u5728\u8D44\u6E90\u7BA1\u7406\u5668\u4E2D\u6253\u5F00 {0}",
  " \xB7 Hidden from downstream input": " \xB7 \u5DF2\u4ECE\u4E0B\u6E38\u8F93\u5165\u4E2D\u9690\u85CF",
  "Local Agent tool": "\u672C\u5730 Agent \u5DE5\u5177",
  "Add Flow element": "\u6DFB\u52A0 Flow \u5143\u7D20",
  "Agent library": "Agent \u5E93",
  "Configured model library": "\u5DF2\u914D\u7F6E\u6A21\u578B\u5E93",
  "Saved Agent library": "\u5DF2\u4FDD\u5B58 Agent \u5E93",
  "Configured models": "\u5DF2\u914D\u7F6E\u6A21\u578B",
  "Saved Agents": "\u5DF2\u4FDD\u5B58 Agent",
  "Close node library": "\u5173\u95ED\u8282\u70B9\u5E93",
  "Search configured models": "\u641C\u7D22\u5DF2\u914D\u7F6E\u6A21\u578B",
  "Search saved Agents": "\u641C\u7D22\u5DF2\u4FDD\u5B58 Agent",
  "Search models": "\u641C\u7D22\u6A21\u578B",
  "Search Agents": "\u641C\u7D22 Agent",
  "Click to add, or drag to a position in the Flow.": "\u70B9\u51FB\u6DFB\u52A0\uFF0C\u6216\u62D6\u5230 Flow \u4E2D\u6307\u5B9A\u4F4D\u7F6E\u3002",
  "\xB7 Prompts locked": "\xB7 \u63D0\u793A\u8BCD\u5DF2\u9501\u5B9A",
  "Delete saved {0}": "\u5220\u9664\u5DF2\u4FDD\u5B58\u7684 {0}",
  "No matches.": "\u6CA1\u6709\u5339\u914D\u9879\u3002",
  "Configured and enabled providers or local Agent tools appear here.": "\u914D\u7F6E\u5E76\u542F\u7528\u670D\u52A1\u5546\u6216\u672C\u5730 Agent \u5DE5\u5177\u540E\uFF0C\u4F1A\u663E\u793A\u5728\u8FD9\u91CC\u3002",
  "Click \u201CSave to Agent library\u201D in the Agent sidebar to reuse it in other Flows.": "\u5728 Agent \u53F3\u4FA7\u680F\u70B9\u51FB\u201C\u4FDD\u5B58\u5230 Agent \u5E93\u201D\uFF0C\u5373\u53EF\u5728\u5176\u4ED6 Flow \u590D\u7528\u3002",
  "Read the input and complete the task.": "\u9605\u8BFB\u8F93\u5165\u7684\u5185\u5BB9\u5E76\u5B8C\u6210\u4EFB\u52A1\u3002",
  "Describe what this Flow should accomplish.": "\u63CF\u8FF0\u8FD9\u4E2A Flow \u9700\u8981\u5B8C\u6210\u7684\u76EE\u6807\u3002",
  "Could not read the Agent node": "\u65E0\u6CD5\u8BFB\u53D6 Agent \u8282\u70B9",
  "The autofill model did not return valid JSON. Try again or choose another model": "\u81EA\u52A8\u586B\u5199\u6A21\u578B\u6CA1\u6709\u8FD4\u56DE\u6709\u6548 JSON\uFF0C\u8BF7\u91CD\u8BD5\u6216\u66F4\u6362\u6A21\u578B",
  "Invalid autofill result: missing agents": "\u81EA\u52A8\u586B\u5199\u7ED3\u679C\u683C\u5F0F\u4E0D\u6B63\u786E\uFF1A\u7F3A\u5C11 agents",
  "The autofill result contains no applicable Flow or Agent content": "\u81EA\u52A8\u586B\u5199\u7ED3\u679C\u4E2D\u6CA1\u6709\u53EF\u5E94\u7528\u7684 Flow \u6216 Agent \u5185\u5BB9",
  "The {1} prompt for Agent {0} is not a string": "Agent {0} \u7684 {1} \u63D0\u793A\u8BCD\u4E0D\u662F\u5B57\u7B26\u4E32",
  "The {1} prompt for Agent {0} is too long": "Agent {0} \u7684 {1} \u63D0\u793A\u8BCD\u8FC7\u957F",
  "Returned fields do not match {0}": "{0} \u8FD4\u56DE\u5B57\u6BB5\u4E0D\u5339\u914D",
  "You are {0}.": "\u4F60\u662F {0}\u3002",
  "Continue from {0}\u2019s output. Preserve its conclusions and constraints, and advance the current task. Revisit completed work only when you find a specific issue.": "\u4F20\u9012 \xB7 \u627F\u63A5 {0} \u7684\u8F93\u51FA\u4F5C\u4E3A\u4E0A\u6E38\u6210\u679C\uFF0C\u4FDD\u7559\u5176\u7ED3\u8BBA\u4E0E\u7EA6\u675F\u5E76\u7EE7\u7EED\u5F53\u524D\u4EFB\u52A1\uFF1B\u9664\u975E\u53D1\u73B0\u660E\u786E\u95EE\u9898\uFF0C\u4E0D\u91CD\u590D\u4E0A\u6E38\u5DF2\u7ECF\u5B8C\u6210\u7684\u5DE5\u4F5C\u3002",
  "Review {0}\u2019s output for correctness, completeness, evidence, and constraints. Clearly list issues, risks, and actionable improvements.": "\u5BA1\u6838 \xB7 \u5BA1\u67E5 {0} \u7684\u8F93\u51FA\uFF0C\u6838\u5BF9\u6B63\u786E\u6027\u3001\u5B8C\u6574\u6027\u3001\u8BC1\u636E\u4E0E\u7EA6\u675F\uFF1B\u660E\u786E\u5217\u51FA\u95EE\u9898\u3001\u98CE\u9669\u548C\u53EF\u6267\u884C\u7684\u6539\u8FDB\u5EFA\u8BAE\u3002",
  "Revise {0}\u2019s output. Correct errors and omissions, incorporate useful feedback, and produce a complete replacement.": "\u4FEE\u8BA2 \xB7 \u4FEE\u8BA2 {0} \u7684\u8F93\u51FA\uFF0C\u4FEE\u6B63\u9519\u8BEF\u4E0E\u7F3A\u6F0F\u5E76\u843D\u5B9E\u53EF\u91C7\u7EB3\u7684\u53CD\u9988\uFF1B\u4EA7\u51FA\u4E00\u4EFD\u53EF\u76F4\u63A5\u66FF\u6362\u4E0A\u6E38\u7248\u672C\u7684\u5B8C\u6574\u7ED3\u679C\u3002",
  "Merge the outputs of {0}. Align shared conclusions, resolve conflicts and duplication explicitly, and retain essential constraints from every source.": "\u5408\u5E76 \xB7 \u6574\u5408 {0} \u7684\u8F93\u51FA\uFF0C\u5BF9\u9F50\u5171\u540C\u7ED3\u8BBA\uFF0C\u663E\u5F0F\u5904\u7406\u51B2\u7A81\u4E0E\u91CD\u590D\u5185\u5BB9\uFF0C\u5E76\u4FDD\u7559\u5404\u6765\u6E90\u4E0D\u53EF\u4E22\u5931\u7684\u7EA6\u675F\u3002",
  "Could not cancel login. Try again.": "\u53D6\u6D88\u767B\u5F55\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5\u3002",
  "Sign in": "\u767B\u5F55",
  "runtime": "\u8FD0\u884C\u65F6\u8FDE\u63A5\u8D26\u6237",
  "Login uses the official Claude Code runtime. Claude can make mistakes; check its output and use it only in trusted projects.": "\u767B\u5F55\u4F7F\u7528\u5B98\u65B9 Claude Code \u8FD0\u884C\u65F6\u3002Claude \u53EF\u80FD\u51FA\u9519\uFF0C\u8BF7\u68C0\u67E5\u751F\u6210\u7684\u5185\u5BB9\uFF1B\u4EC5\u5728\u53EF\u4FE1\u9879\u76EE\u4E2D\u4F7F\u7528\u3002",
  "Submission failed. Try again.": "\u63D0\u4EA4\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5\u3002",
  "Authorization code": "\u6388\u6743\u7801",
  "Paste the code shown on the {0} page": "\u7C98\u8D34 {0} \u9875\u9762\u663E\u793A\u7684\u6388\u6743\u7801",
  "The code is sent only to this login process.": "\u6388\u6743\u7801\u4EC5\u4F20\u7ED9\u672C\u6B21\u767B\u5F55\u8FDB\u7A0B\u3002",
  "Claude Code saves login credentials in a dedicated configuration.": "\u767B\u5F55\u51ED\u636E\u7531 Claude Code \u4FDD\u5B58\u5728\u72EC\u7ACB\u914D\u7F6E\u4E2D\u3002",
  "Antigravity saves login credentials in the system credential store.": "\u767B\u5F55\u51ED\u636E\u7531 Antigravity \u4FDD\u5B58\u5230\u7CFB\u7EDF\u51ED\u636E\u5E93\u3002",
  "Cancelling\u2026": "\u6B63\u5728\u53D6\u6D88\u2026",
  "Cancel login": "\u53D6\u6D88\u767B\u5F55",
  "Submitting\u2026": "\u6B63\u5728\u63D0\u4EA4\u2026",
  "Submit authorization code": "\u63D0\u4EA4\u6388\u6743\u7801",
  "Connections": "\u8FDE\u63A5",
  "Sign in to AI accounts and subscriptions": "\u767B\u5F55 AI \u8D26\u6237\u4E0E\u8BA2\u9605",
  "API Provider": "API \u670D\u52A1\u5546",
  "Credentials, endpoints, and available models": "\u51ED\u636E\u3001\u5730\u5740\u4E0E\u53EF\u7528\u6A21\u578B",
  "Commands, models, and runtime capabilities": "\u547D\u4EE4\u3001\u6A21\u578B\u4E0E\u8FD0\u884C\u80FD\u529B",
  "Features": "\u529F\u80FD",
  "AI-assisted building": "AI \u8F85\u52A9\u6784\u5EFA",
  "Models for prompt and Flow generation": "\u63D0\u793A\u8BCD\u4E0E Flow \u751F\u6210\u6A21\u578B",
  "Chat": "\u5BF9\u8BDD",
  "Conversation history and request context": "\u5386\u53F2\u4E0A\u4E0B\u6587\u4E0E\u53D1\u9001\u8303\u56F4",
  "Model defaults": "\u6A21\u578B\u9ED8\u8BA4\u53C2\u6570",
  "Reasoning and sampling for new Agents": "\u65B0 Agent \u7684\u63A8\u7406\u4E0E\u91C7\u6837\u53C2\u6570",
  "Desktop service disconnected. Quit AgentFlow completely and restart it.": "\u684C\u9762\u670D\u52A1\u672A\u8FDE\u63A5\uFF0C\u8BF7\u5B8C\u5168\u9000\u51FA\u5E76\u91CD\u65B0\u542F\u52A8 AgentFlow\u3002",
  "This is the web preview. Use the AgentFlow desktop window to save credentials, test connections, and detect local tools.": "\u5F53\u524D\u4E3A\u7F51\u9875\u9884\u89C8\u3002\u4FDD\u5B58\u51ED\u636E\u3001\u6D4B\u8BD5\u8FDE\u63A5\u4E0E\u68C0\u6D4B\u672C\u673A\u5DE5\u5177\uFF0C\u8BF7\u4F7F\u7528 AgentFlow \u684C\u9762\u7A97\u53E3\u3002",
  "Could not refresh subscription account status": "\u8BA2\u9605\u8D26\u6237\u72B6\u6001\u5237\u65B0\u5931\u8D25",
  "Could not save settings": "\u8BBE\u7F6E\u4FDD\u5B58\u5931\u8D25",
  "Settings saved; synchronized {0} models.": "\u914D\u7F6E\u5DF2\u4FDD\u5B58\uFF0C\u5DF2\u540C\u6B65 {0} \u4E2A\u6A21\u578B\u3002",
  "Could not read models": "\u6A21\u578B\u8BFB\u53D6\u5931\u8D25",
  "Settings saved; model synchronization failed: {0}": "\u914D\u7F6E\u5DF2\u4FDD\u5B58\uFF1B\u6A21\u578B\u540C\u6B65\u5931\u8D25\uFF1A{0}",
  "Verifying credentials and reading models\u2026": "\u6B63\u5728\u9A8C\u8BC1\u51ED\u636E\u5E76\u8BFB\u53D6\u6A21\u578B\u2026",
  "Could not save the configuration for testing.": "\u65E0\u6CD5\u4FDD\u5B58\u5F85\u6D4B\u8BD5\u7684\u914D\u7F6E\u3002",
  "Connected; synchronized {0} models.": "\u8FDE\u63A5\u6210\u529F\uFF0C\u5DF2\u540C\u6B65 {0} \u4E2A\u6A21\u578B\u3002",
  "Provider connection test failed": "\u670D\u52A1\u5546\u8FDE\u63A5\u6D4B\u8BD5\u5931\u8D25",
  "Detected {0} local Agent tools.": "\u68C0\u6D4B\u5230 {0} \u4E2A\u672C\u5730 Agent \u5DE5\u5177\u3002",
  "Tool detection failed": "\u5DE5\u5177\u68C0\u6D4B\u5931\u8D25",
  "Refreshed {0} subscription connectors.": "\u5DF2\u5237\u65B0 {0} \u4E2A\u8BA2\u9605\u8D26\u6237\u8FDE\u63A5\u5668\u3002",
  "Preparing connection\u2026": "\u6B63\u5728\u51C6\u5907\u8FDE\u63A5\u2026",
  "Subscription account connection failed": "\u8BA2\u9605\u8D26\u6237\u8FDE\u63A5\u5931\u8D25",
  "Google login failed": "Google \u767B\u5F55\u5931\u8D25",
  "Subscription account disconnected.": "\u8BA2\u9605\u8D26\u6237\u5DF2\u65AD\u5F00\u3002",
  "Could not disconnect subscription account": "\u8BA2\u9605\u8D26\u6237\u65AD\u5F00\u5931\u8D25",
  "Custom provider": "\u81EA\u5B9A\u4E49\u670D\u52A1\u5546",
  "Settings navigation": "\u8BBE\u7F6E\u5BFC\u822A",
  "Back to AgentFlow": "\u8FD4\u56DE AgentFlow",
  "Search settings": "\u641C\u7D22\u8BBE\u7F6E",
  "Search settings\u2026": "\u641C\u7D22\u8BBE\u7F6E\u2026",
  "No matching settings": "\u6CA1\u6709\u5339\u914D\u7684\u8BBE\u7F6E",
  "Local service disconnected": "\u672C\u673A\u670D\u52A1\u672A\u8FDE\u63A5",
  "Save failed": "\u4FDD\u5B58\u5931\u8D25",
  "Tutorial complete. Connect an API model or local Agent, then create a project for your own task. In \u201CAI-assisted building\u201D, choose models for Flow generation and prompt autofill.": "\u6559\u7A0B\u5DF2\u5B8C\u6210\u3002\u8FDE\u63A5\u4E00\u4E2A API \u6A21\u578B\u6216\u672C\u673A Agent \u540E\uFF0C\u65B0\u5EFA\u9879\u76EE\u5F00\u59CB\u81EA\u5DF1\u7684\u4EFB\u52A1\u3002\u4E5F\u53EF\u5728\u300CAI \u8F85\u52A9\u6784\u5EFA\u300D\u4E2D\u9009\u62E9\u751F\u6210 Flow \u548C\u8865\u5168\u63D0\u793A\u8BCD\u7684\u6A21\u578B\u3002",
  "Choose models for the two Flow-building features": "\u4E3A\u6784\u5EFA Flow \u7684\u4E24\u9879\u529F\u80FD\u5206\u522B\u9009\u62E9\u6A21\u578B",
  "These models design Flows and prompts. Each Agent uses its own execution model.": "\u8FD9\u4E9B\u6A21\u578B\u53EA\u8D1F\u8D23\u8BBE\u8BA1 Flow \u548C\u63D0\u793A\u8BCD\uFF0C\u4E0D\u6539\u53D8 Agent \u6267\u884C\u65F6\u4F7F\u7528\u7684\u6A21\u578B\u3002",
  "Fill in Agent responsibilities and input/output requirements while respecting locked prompts.": "\u586B\u5199 Agent \u804C\u8D23\u4E0E\u8F93\u5165\u8F93\u51FA\u8981\u6C42\uFF1B\u9501\u5B9A\u7684\u63D0\u793A\u8BCD\u4FDD\u6301\u539F\u6837\u3002",
  "Generate Agents, prompts, and links from a description and current input summaries.": "\u6839\u636E\u63CF\u8FF0\u548C\u5F53\u524D\u8F93\u5165\u6458\u8981\u751F\u6210 Agent\u3001\u63D0\u793A\u8BCD\u4E0E\u8FDE\u63A5\u3002",
  "No models available yet": "\u8FD8\u6CA1\u6709\u53EF\u7528\u6A21\u578B",
  "Sign in to a subscription account, connect an API provider, or enable an installed local Agent tool.": "\u5148\u767B\u5F55\u8BA2\u9605\u8D26\u6237\u3001\u8FDE\u63A5 API \u670D\u52A1\u5546\uFF0C\u6216\u542F\u7528\u5DF2\u5B89\u88C5\u7684\u672C\u673A Agent \u5DE5\u5177\u3002",
  "Sign in to a subscription account": "\u767B\u5F55\u8BA2\u9605\u8D26\u6237",
  "Defaults for new Agents": "\u65B0 Agent \u9ED8\u8BA4\u53C2\u6570",
  "Choose a model to configure reasoning, sampling, and output": "\u9009\u62E9\u6A21\u578B\u540E\u8BBE\u7F6E\u5176\u63A8\u7406\u3001\u91C7\u6837\u548C\u8F93\u51FA\u53C2\u6570",
  "New Agents use these saved parameters. Existing Agents keep their own settings.": "\u4FDD\u5B58\u540E\uFF0C\u65B0\u6DFB\u52A0\u7684 Agent \u4F1A\u91C7\u7528\u8FD9\u7EC4\u53C2\u6570\uFF1B\u5DF2\u6709 Agent \u4FDD\u6301\u81EA\u5DF1\u7684\u8BBE\u7F6E\u3002",
  "Default parameters provider": "\u9ED8\u8BA4\u53C2\u6570\u670D\u52A1\u5546",
  "Default parameters model": "\u9ED8\u8BA4\u53C2\u6570\u6A21\u578B",
  "No models to configure": "\u6CA1\u6709\u53EF\u4EE5\u914D\u7F6E\u7684\u6A21\u578B",
  "Model defaults are available for connected and enabled models.": "\u6A21\u578B\u9ED8\u8BA4\u53C2\u6570\u53EA\u9002\u7528\u4E8E\u5DF2\u7ECF\u8FDE\u63A5\u5E76\u542F\u7528\u7684\u6A21\u578B\u3002",
  "Go to API providers": "\u524D\u5F80 API \u670D\u52A1\u5546",
  "connected": "\u4E2A\u5DF2\u8FDE\u63A5",
  "Refresh status": "\u5237\u65B0\u72B6\u6001",
  "Built-in providers": "\u5185\u7F6E\u670D\u52A1\u5546",
  "added": "\u4E2A\u5DF2\u6DFB\u52A0",
  "Add built-in provider": "\u6DFB\u52A0\u5185\u7F6E\u670D\u52A1\u5546",
  "Add provider\u2026": "\u6DFB\u52A0\u670D\u52A1\u5546\u2026",
  "All providers added": "\u5DF2\u6DFB\u52A0\u5168\u90E8\u670D\u52A1\u5546",
  "Choose a provider to connect from the menu above.": "\u4ECE\u4E0A\u65B9\u83DC\u5355\u9009\u62E9\u9700\u8981\u8FDE\u63A5\u7684\u670D\u52A1\u5546\u3002",
  "Custom compatible providers": "\u81EA\u5B9A\u4E49\u517C\u5BB9\u670D\u52A1\u5546",
  "items": "\u4E2A",
  "Add compatible provider": "\u6DFB\u52A0\u517C\u5BB9\u670D\u52A1\u5546",
  "Connect local deployments or compatible services through the OpenAI API protocol.": "\u4F7F\u7528 OpenAI API \u534F\u8BAE\u8FDE\u63A5\u672C\u5730\u90E8\u7F72\u6216\u5176\u4ED6\u517C\u5BB9\u670D\u52A1\u3002",
  "added \xB7": "\u4E2A\u5DF2\u6DFB\u52A0 \xB7",
  "detected": "\u4E2A\u5DF2\u68C0\u6D4B\u5230",
  "Add local Agent tool": "\u6DFB\u52A0\u672C\u673A Agent \u5DE5\u5177",
  "Add Agent tool\u2026": "\u6DFB\u52A0 Agent \u5DE5\u5177\u2026",
  "No tools available to add": "\u6CA1\u6709\u53EF\u6DFB\u52A0\u7684\u5DE5\u5177",
  "Detect tools in the AgentFlow desktop app": "\u8BF7\u5728 AgentFlow \u684C\u9762\u5E94\u7528\u4E2D\u68C0\u6D4B",
  "Detect again": "\u91CD\u65B0\u68C0\u6D4B",
  "Detect tools again, then choose an installed local Agent tool from the menu above.": "\u91CD\u65B0\u68C0\u6D4B\u540E\uFF0C\u4ECE\u4E0A\u65B9\u83DC\u5355\u9009\u62E9\u672C\u673A\u5DF2\u5B89\u88C5\u7684 Agent \u5DE5\u5177\u3002",
  "Conversation context": "\u5BF9\u8BDD\u4E0A\u4E0B\u6587",
  "Control the history sent to the model": "\u63A7\u5236\u53D1\u9001\u7ED9\u6A21\u578B\u7684\u5386\u53F2\u8303\u56F4",
  "Full messages are saved locally. The character limit determines the context sent with the next request.": "\u6D88\u606F\u4ECD\u5B8C\u6574\u4FDD\u5B58\u5728\u672C\u5730\uFF1B\u5B57\u7B26\u4E0A\u9650\u53EA\u5F71\u54CD\u4E0B\u4E00\u6B21\u8BF7\u6C42\u643A\u5E26\u7684\u4E0A\u4E0B\u6587\u3002",
  "Enable experimental DeepSeek Web Bridge?": "\u542F\u7528\u5B9E\u9A8C\u6027 DeepSeek \u7F51\u9875\u8FDE\u63A5\uFF1F",
  "After login, AgentFlow sends requests through a web session.": "\u767B\u5F55\u540E\uFF0CAgentFlow \u4F1A\u901A\u8FC7\u7F51\u9875\u4F1A\u8BDD\u53D1\u9001\u8BF7\u6C42\u3002",
  "This is an unofficial connection. DeepSeek\u2019s terms restrict automated scraping and content copying. Use may lead to rate limits, account restrictions, or suspension. Web protocol changes may also break the connection.": "\u8FD9\u662F\u975E\u5B98\u65B9\u8FDE\u63A5\u65B9\u5F0F\u3002DeepSeek \u670D\u52A1\u6761\u6B3E\u9650\u5236\u81EA\u52A8\u5316\u6293\u53D6\u548C\u590D\u5236\u5185\u5BB9\uFF0C\u4F7F\u7528\u6B64\u529F\u80FD\u53EF\u80FD\u5BFC\u81F4\u9650\u6D41\u3001\u8D26\u53F7\u9650\u5236\u6216\u5C01\u7981\uFF1B\u7F51\u9875\u534F\u8BAE\u53D8\u5316\u4E5F\u53EF\u80FD\u4F7F\u8FDE\u63A5\u5931\u6548\u3002",
  "Flow and chat text is sent to DeepSeek and may appear in web chat history. Login is stored in AgentFlow\u2019s dedicated browser partition and cleared on disconnect.": "\u53D1\u9001\u7684 Flow \u548C\u804A\u5929\u6587\u672C\u4F1A\u63D0\u4EA4\u7ED9 DeepSeek\uFF0C\u5E76\u53EF\u80FD\u51FA\u73B0\u5728\u7F51\u9875\u804A\u5929\u8BB0\u5F55\u4E2D\u3002\u767B\u5F55\u6001\u4FDD\u5B58\u5728 AgentFlow \u4E13\u7528\u6D4F\u89C8\u5668\u5206\u533A\uFF0C\u65AD\u5F00\u65F6\u6E05\u9664\u3002",
  "Complete login and verification challenges manually.": "\u8BF7\u624B\u52A8\u5B8C\u6210\u767B\u5F55\u548C\u9A8C\u8BC1\u7801\u3002",
  "Read DeepSeek terms of service": "\u9605\u8BFB DeepSeek \u670D\u52A1\u6761\u6B3E",
  "Accept risks and open login": "\u63A5\u53D7\u98CE\u9669\u5E76\u6253\u5F00\u767B\u5F55",
  "Connect and fetch models first": "\u8BF7\u5148\u8FDE\u63A5\u5E76\u8BFB\u53D6\u6A21\u578B",
  "Chat context": "\u804A\u5929\u4E0A\u4E0B\u6587",
  "Send the visible conversation. When it exceeds the limit, remove the earliest messages first.": "\u53D1\u9001\u5F53\u524D\u53EF\u89C1\u7684\u5BF9\u8BDD\uFF1B\u8D85\u8FC7\u4E0A\u9650\u65F6\u4ECE\u6700\u65E9\u6D88\u606F\u5F00\u59CB\u79FB\u9664\u3002",
  "History character limit": "\u5386\u53F2\u5B57\u7B26\u4E0A\u9650",
  "; keeps the latest messages.": "\uFF1B\u4FDD\u7559\u6700\u65B0\u6D88\u606F\u3002",
  "Connected \xB7 {0}": "\u5DF2\u8FDE\u63A5 \xB7 {0}",
  "Connected": "\u5DF2\u8FDE\u63A5",
  "Local tool detected": "\u5DF2\u68C0\u6D4B\u5230\u672C\u673A\u5DE5\u5177",
  "Waiting for login": "\u7B49\u5F85\u767B\u5F55",
  "Action required": "\u9700\u8981\u5904\u7406",
  "Not connected": "\u672A\u8FDE\u63A5",
  "Dedicated browser session saved; disconnecting clears the local login": "\u4E13\u7528\u6D4F\u89C8\u5668\u767B\u5F55\u6001\u5DF2\u4FDD\u5B58\uFF1B\u65AD\u5F00\u4F1A\u6E05\u9664\u672C\u673A\u767B\u5F55\u6001",
  "Sign in through AgentFlow\u2019s dedicated browser": "\u65E0\u9700\u5B89\u88C5\u8FD0\u884C\u65F6\uFF1B\u767B\u5F55\u5728 AgentFlow \u4E13\u7528\u6D4F\u89C8\u5668\u4E2D\u5B8C\u6210",
  "Runtime {0}": "\u8FD0\u884C\u65F6 {0}",
  "Official runtime ready": "\u5B98\u65B9\u8FD0\u884C\u65F6\u5DF2\u51C6\u5907",
  "Local tool installed. Reuse it through \u201CLocal Agent tools\u201D": "\u672C\u673A\u5DE5\u5177\u5DF2\u5B89\u88C5\uFF0C\u8BF7\u4ECE\u201C\u672C\u673A Agent \u5DE5\u5177\u201D\u5165\u53E3\u590D\u7528",
  "First connection downloads the official runtime in the background, or visit the": "\u9996\u6B21\u8FDE\u63A5\u4F1A\u5728\u540E\u53F0\u4E0B\u8F7D\u5B98\u65B9\u8FD0\u884C\u65F6\uFF0C\u6216\u524D\u5F80",
  "official installation page": "\u5B98\u65B9\u5B89\u88C5\u9875",
  "to install it manually": "\u624B\u52A8\u4E0B\u8F7D\u5B89\u88C5",
  "Experimental": "\u5B9E\u9A8C\u6027",
  "This tool is already installed on your computer. Reuse it through \u201CLocal Agent tools\u201D to avoid PATH, account, and configuration conflicts.": "\u68C0\u6D4B\u5230\u8FD9\u53F0\u7535\u8111\u5DF2\u7ECF\u5B89\u88C5\u5BF9\u5E94\u5DE5\u5177\u3002\u4E3A\u907F\u514D PATH\u3001\u8D26\u53F7\u548C\u914D\u7F6E\u51B2\u7A81\uFF0C\u8BF7\u4ECE\u201C\u672C\u673A Agent \u5DE5\u5177\u201D\u5165\u53E3\u590D\u7528\u3002",
  "One-time verification code": "\u4E00\u6B21\u6027\u9A8C\u8BC1\u7801",
  "Go to local Agent tools": "\u524D\u5F80\u672C\u673A Agent \u5DE5\u5177",
  "Disconnect": "\u65AD\u5F00",
  "Sign in to DeepSeek": "\u767B\u5F55 DeepSeek",
  "Sign in to account": "\u767B\u5F55\u8D26\u6237",
  "Connect and prepare runtime": "\u8FDE\u63A5\u5E76\u51C6\u5907\u8FD0\u884C\u65F6",
  "Configured": "\u5DF2\u914D\u7F6E",
  "Waiting for connection": "\u7B49\u5F85\u8FDE\u63A5",
  "Waiting for API key": "\u7B49\u5F85 API \u5BC6\u94A5",
  "Disable provider": "\u505C\u7528\u670D\u52A1\u5546",
  "Enable provider": "\u542F\u7528\u670D\u52A1\u5546",
  "Enable {0}": "\u542F\u7528 {0}",
  "Display name": "\u663E\u793A\u540D\u79F0",
  "Base URL": "API \u5730\u5740",
  "API Key": "API \u5BC6\u94A5",
  " (optional)": "\uFF08\u53EF\u7559\u7A7A\uFF09",
  "Anthropic workspace ID (depends on key type)": "Anthropic \u5DE5\u4F5C\u533A ID\uFF08\u6309\u5BC6\u94A5\u7C7B\u578B\u586B\u5199\uFF09",
  "Anthropic workspace ID": "Anthropic \u5DE5\u4F5C\u533A ID",
  "Required for cross-workspace keys; optional for keys bound to one workspace. Copy the ID from Claude Console \u2192 Settings \u2192 Workspaces.": "\u8DE8\u5DE5\u4F5C\u533A\u5BC6\u94A5\u5FC5\u586B\uFF1B\u5DF2\u7ED1\u5B9A\u5355\u4E2A\u5DE5\u4F5C\u533A\u7684\u5BC6\u94A5\u53EF\u7559\u7A7A\u3002\u5728 Claude \u63A7\u5236\u53F0\u7684\u8BBE\u7F6E \u2192 \u5DE5\u4F5C\u533A\u590D\u5236 ID\u3002",
  "View official documentation": "\u67E5\u770B\u5B98\u65B9\u8BF4\u660E",
  "Model IDs (one per line)": "\u6A21\u578B ID\uFF08\u6BCF\u884C\u4E00\u4E2A\uFF09",
  "Enter real model IDs only if the service does not support /models": "\u4EC5\u5728\u670D\u52A1\u4E0D\u652F\u6301 /models \u65F6\u586B\u5199\u771F\u5B9E\u6A21\u578B ID",
  "{0} / {1} models enabled": "{0} / {1} \u4E2A\u6A21\u578B\u5DF2\u542F\u7528",
  "The service returned no chat models": "\u670D\u52A1\u7AEF\u672A\u8FD4\u56DE\u5BF9\u8BDD\u6A21\u578B",
  "Models are fetched automatically after saving": "\u4FDD\u5B58\u540E\u81EA\u52A8\u8BFB\u53D6\u6A21\u578B",
  "Keep key": "\u4FDD\u7559\u5BC6\u94A5",
  "Clear key": "\u6E05\u9664\u5BC6\u94A5",
  "Enter an API key first": "\u8BF7\u5148\u8F93\u5165 API \u5BC6\u94A5",
  "Test connection": "\u6D4B\u8BD5\u8FDE\u63A5",
  "Remove": "\u79FB\u9664",
  "{0} available models": "{0} \u53EF\u9009\u6A21\u578B",
  "Available models": "\u53EF\u9009\u6A21\u578B",
  "Enabled": "\u5DF2\u542F\u7528",
  "Enable all": "\u5168\u90E8\u542F\u7528",
  "Disable all": "\u5168\u90E8\u5173\u95ED",
  "{0} model list": "{0} \u6A21\u578B\u5217\u8868",
  "Enable {0} model {1}": "\u542F\u7528 {0} \u6A21\u578B {1}",
  "The service returned no chat models. Check the configuration and test the connection.": "\u670D\u52A1\u7AEF\u672A\u8FD4\u56DE\u5BF9\u8BDD\u6A21\u578B\uFF0C\u8BF7\u68C0\u67E5\u914D\u7F6E\u540E\u6D4B\u8BD5\u8FDE\u63A5\u3002",
  "Models appear here after testing the connection.": "\u6D4B\u8BD5\u8FDE\u63A5\u540E\u5C06\u5728\u8FD9\u91CC\u663E\u793A\u6A21\u578B\u3002",
  "Enter API key": "\u8F93\u5165 API \u5BC6\u94A5",
  "Available to enable": "\u53EF\u542F\u7528",
  "Not installed": "\u672A\u5B89\u88C5",
  "Desktop detection only": "\u4EC5\u684C\u9762\u68C0\u6D4B",
  "Installed; model override: {0}": "\u5DF2\u5B89\u88C5\uFF1B\u6A21\u578B\u8986\u76D6\uFF1A{0}",
  "Installed; uses the tool\u2019s default model": "\u5DF2\u5B89\u88C5\uFF1B\u8DDF\u968F\u5DE5\u5177\u9ED8\u8BA4\u6A21\u578B",
  "Command not found: {0}": "\u672A\u68C0\u6D4B\u5230\u547D\u4EE4\uFF1A{0}",
  "Launch the desktop app to detect local commands": "\u542F\u52A8\u684C\u9762\u5E94\u7528\u540E\u68C0\u6D4B\u672C\u673A\u547D\u4EE4",
  "Disable tool": "\u505C\u7528\u5DE5\u5177",
  "Enable tool": "\u542F\u7528\u5DE5\u5177",
  "Detect an installation before enabling": "\u68C0\u6D4B\u5230\u5B89\u88C5\u540E\u624D\u80FD\u542F\u7528",
  "Detection command": "\u68C0\u6D4B\u547D\u4EE4",
  "Reasoning effort: {0}": "\u63A8\u7406\u5F3A\u5EA6\uFF1A{0}",
  "Reasoning effort is managed by the tool": "\u63A8\u7406\u5F3A\u5EA6\u7531\u5DE5\u5177\u7BA1\u7406",
  "Default model for new Agents": "\u65B0 Agent \u9ED8\u8BA4\u6A21\u578B",
  "{0} default model": "{0} \u9ED8\u8BA4\u6A21\u578B",
  "Choose an enabled model": "\u9009\u62E9\u5DF2\u542F\u7528\u6A21\u578B",
  "Sign in with Google and paste the authorization code into AgentFlow.": "\u4F7F\u7528 Google \u8D26\u6237\u767B\u5F55\uFF0C\u6388\u6743\u7801\u53EF\u76F4\u63A5\u7C98\u8D34\u5230 AgentFlow\u3002",
  "Sign in with Google": "\u767B\u5F55 Google",
  "Login is checked on the first run. If needed, run": "\u767B\u5F55\u72B6\u6001\u4F1A\u5728\u9996\u6B21\u8FD0\u884C\u65F6\u786E\u8BA4\uFF1B\u5982\u679C\u5C1A\u672A\u767B\u5F55\uFF0C\u8BF7\u5728\u7EC8\u7AEF\u8FD0\u884C",
  "in a terminal, then try again.": "\uFF0C\u5B8C\u6210\u540E\u91CD\u8BD5\u3002",
  "{0} models enabled": "{0} \u4E2A\u6A21\u578B\u5DF2\u542F\u7528",
  "All models disabled": "\u6240\u6709\u6A21\u578B\u5DF2\u5173\u95ED",
  "Plan the customer feedback analysis. Break the weekly decision task into statistics, findings, and recommendations.": "\u4F60\u8D1F\u8D23\u89C4\u5212\u5BA2\u6237\u56DE\u8BBF\u6574\u7406\u5DE5\u4F5C\u3002\u56F4\u7ED5\u5468\u4F1A\u51B3\u7B56\uFF0C\u628A\u4EFB\u52A1\u62C6\u6210\u7EDF\u8BA1\u3001\u5F52\u7EB3\u4E0E\u884C\u52A8\u5EFA\u8BAE\u3002",
  "Read the meeting requirements and feedback table. Identify the rating scale, topic categories, sample size, and brief objectives.": "\u9605\u8BFB\u5468\u4F1A\u8981\u6C42\u4E0E\u56DE\u8BBF\u8868\uFF0C\u660E\u786E\u8BC4\u5206\u53E3\u5F84\u3001\u4E3B\u9898\u5206\u7C7B\u3001\u6837\u672C\u6570\u91CF\u4E0E\u7B80\u62A5\u76EE\u6807\u3002",
  "Produce a short work plan with metrics to calculate, checks to perform, and sections for the final brief.": "\u8F93\u51FA\u7B80\u77ED\u5DE5\u4F5C\u8BA1\u5212\uFF0C\u5217\u51FA\u9700\u8981\u8BA1\u7B97\u7684\u6307\u6807\u3001\u6838\u5BF9\u9879\u4E0E\u6700\u7EC8\u7B80\u62A5\u680F\u76EE\u3002",
  "Design the structure of a one-page weekly brief that busy colleagues can scan quickly.": "\u4F60\u8D1F\u8D23\u8BBE\u8BA1\u4E00\u9875\u5468\u4F1A\u7B80\u62A5\u7684\u5185\u5BB9\u7ED3\u6784\uFF0C\u8BA9\u5FD9\u788C\u7684\u540C\u4E8B\u5FEB\u901F\u4E86\u89E3\u60C5\u51B5\u3002",
  "Follow the analysis plan to arrange the title, key figures, customer feedback, and next week\u2019s actions.": "\u6309\u7167\u6574\u7406\u8BA1\u5212\uFF0C\u5B89\u6392\u6807\u9898\u3001\u5173\u952E\u6570\u5B57\u3001\u5BA2\u6237\u58F0\u97F3\u548C\u4E0B\u5468\u884C\u52A8\u3002",
  "Produce the brief outline and writing requirements for each section. Keep it within one page.": "\u8F93\u51FA\u7B80\u62A5\u7ED3\u6784\u4E0E\u6BCF\u680F\u5199\u4F5C\u8981\u6C42\uFF0C\u63A7\u5236\u5728\u4E00\u9875\u4EE5\u5185\u3002",
  "Review the weekly brief plan for clear statistical definitions, factual support, and wording.": "\u4F60\u8D1F\u8D23\u5BA1\u6838\u5468\u4F1A\u7B80\u62A5\u65B9\u6848\uFF0C\u68C0\u67E5\u7EDF\u8BA1\u53E3\u5F84\u3001\u4E8B\u5B9E\u4F9D\u636E\u4E0E\u8868\u8FBE\u662F\u5426\u6E05\u695A\u3002",
  "Read the outline. Check the sample size, rating range, customer IDs, and separation of facts and recommendations.": "\u9605\u8BFB\u7B80\u62A5\u7ED3\u6784\uFF0C\u68C0\u67E5\u662F\u5426\u4FDD\u7559\u6837\u672C\u6570\u3001\u8BC4\u5206\u8303\u56F4\u3001\u5BA2\u6237\u7F16\u53F7\uFF0C\u4EE5\u53CA\u4E8B\u5B9E\u548C\u5EFA\u8BAE\u7684\u533A\u5206\u3002",
  "Summarize the outline, omissions, and specific revisions for the next author.": "\u8F93\u51FA\u539F\u7ED3\u6784\u6458\u8981\u3001\u9057\u6F0F\u9879\u548C\u5177\u4F53\u4FEE\u8BA2\u5EFA\u8BAE\uFF0C\u4EA4\u7ED9\u4E0B\u4E00\u4F4D\u4F5C\u8005\u4FEE\u8BA2\u3002",
  "Improve the weekly brief outline.": "\u4F60\u8D1F\u8D23\u5B8C\u5584\u5468\u4F1A\u7B80\u62A5\u7ED3\u6784\u3002",
  "Read the draft outline or review feedback and assemble complete analysis and writing requirements.": "\u9605\u8BFB\u6536\u5230\u7684\u7ED3\u6784\u8349\u6848\u6216\u5BA1\u6838\u610F\u89C1\uFF0C\u6574\u7406\u6210\u5B8C\u6574\u7684\u7EDF\u8BA1\u4E0E\u5199\u4F5C\u8981\u6C42\u3002",
  "Produce a complete outline covering 8 interviews, the 1\u20135 rating scale, topic distribution, customer ID evidence, and two actions for next week.": "\u8F93\u51FA\u5B8C\u6574\u7684\u7B80\u62A5\u7ED3\u6784\uFF1A8 \u4EFD\u6837\u672C\u30011\u20135 \u5206\u8BC4\u5206\u3001\u4E3B\u9898\u5206\u5E03\u3001\u5BA2\u6237\u7F16\u53F7\u4F9D\u636E\u3001\u4E24\u9879\u4E0B\u5468\u884C\u52A8\u3002",
  "You are a local data assistant. Use local tools to read CSV files, run short analysis scripts, and generate result files.": "\u4F60\u662F\u672C\u5730\u6570\u636E\u52A9\u624B\u3002\u4F7F\u7528\u672C\u673A\u5DE5\u5177\u8BFB\u53D6 CSV\u3001\u8FD0\u884C\u5C0F\u6BB5\u7EDF\u8BA1\u4EE3\u7801\u5E76\u751F\u6210\u7ED3\u679C\u6587\u4EF6\u3002",
  "Read customer-feedback.csv. Following the plan and brief requirements, calculate the sample size, average rating, topic distribution, and number of ratings at or below 3. Use Python and verify the topic totals.": "\u8BFB\u53D6customer-feedback.csv\uFF0C\u6309\u6574\u7406\u8BA1\u5212\u548C\u7B80\u62A5\u89C4\u8303\u8BA1\u7B97\u603B\u6837\u672C\u6570\u3001\u5E73\u5747\u8BC4\u5206\u3001\u4E3B\u9898\u5206\u5E03\u548C\u8BC4\u5206\u4E0D\u9AD8\u4E8E 3 \u7684\u6570\u91CF\u3002\u7528 Python \u5B8C\u6210\u7EDF\u8BA1\u5E76\u6838\u5BF9\u5404\u4E3B\u9898\u5408\u8BA1\u3002",
  "Write summary.csv and findings.md in the result directory. Include statistical definitions, customer IDs, and verification records for the downstream brief writer.": "\u5728\u7ED3\u679C\u76EE\u5F55\u5199\u51FA summary.csv \u548C findings.md\u3002\u4FDD\u7559\u7EDF\u8BA1\u53E3\u5F84\u3001\u5BA2\u6237\u7F16\u53F7\u4E0E\u6838\u5BF9\u8BB0\u5F55\uFF0C\u4F9B\u4E0B\u6E38\u7F16\u5199\u7B80\u62A5\u3002",
  "Write the customer success team\u2019s weekly brief in concise workplace language.": "\u4F60\u8D1F\u8D23\u64B0\u5199\u5BA2\u6237\u6210\u529F\u56E2\u961F\u7684\u5468\u4F1A\u7B80\u62A5\uFF0C\u4F7F\u7528\u7B80\u6D01\u7684\u529E\u516C\u8BED\u8A00\u3002",
  "Read findings.md and summary.csv from the result and organize the brief around the statistics.": "\u8BFB\u53D6\u7ED3\u679C\u4E2D\u7684 findings.md \u4E0E summary.csv\uFF0C\u4F9D\u636E\u7EDF\u8BA1\u7ED3\u679C\u7EC4\u7EC7\u7B80\u62A5\u3002",
  "Produce a one-page brief with an overview, key findings, and two actions for next week. Cite customer IDs and label recommendations clearly.": "\u8F93\u51FA\u4E00\u9875\u7B80\u62A5\uFF1A\u6574\u4F53\u60C5\u51B5\u3001\u4E3B\u8981\u53D1\u73B0\u3001\u4E24\u9879\u4E0B\u5468\u884C\u52A8\u3002\u4E8B\u5B9E\u5F15\u7528\u5BA2\u6237\u7F16\u53F7\uFF0C\u5EFA\u8BAE\u660E\u786E\u6807\u6CE8\u4E3A\u5EFA\u8BAE\u3002",
  "Meeting requirements and customer feedback": "\u5468\u4F1A\u8981\u6C42\u4E0E\u5BA2\u6237\u56DE\u8BBF",
  "Analysis plan": "\u6574\u7406\u8BA1\u5212",
  "Brief design": "\u7B80\u62A5\u8BBE\u8BA1",
  "Independent review": "\u72EC\u7ACB\u5BA1\u6838",
  "Revised design": "\u4FEE\u8BA2\u8BBE\u8BA1",
  "Weekly brief": "\u5468\u4F1A\u7B80\u62A5",
  "Result \xB7 Statistics files": "\u7ED3\u679C \xB7 \u7EDF\u8BA1\u6587\u4EF6",
  "Output summary.csv and findings.md for the brief Agent to read.": "\u8F93\u51FA summary.csv \u548C findings.md\uFF0C\u4F9B\u7B80\u62A5 Agent \u7EE7\u7EED\u8BFB\u53D6\u3002",
  "Customer feedback \u2192 One-page weekly brief": "\u5BA2\u6237\u56DE\u8BBF \u2192 \u4E00\u9875\u5468\u4F1A\u7B80\u62A5",
  " Write review feedback to review.md.": " \u5C06\u5BA1\u6838\u610F\u89C1\u5199\u5165\u5BA1\u6838.md\u3002",
  "Review result": "\u5BA1\u6838\u7ED3\u679C",
  "Topic,Interviews,Average rating\nResponse time,3,2.67\nTraining materials,3,4.33\nProcess clarity,2,3.50": "\u4E3B\u9898,\u56DE\u8BBF\u6570,\u5E73\u5747\u8BC4\u5206\n\u54CD\u5E94\u65F6\u6548,3,2.67\n\u57F9\u8BAD\u8D44\u6599,3,4.33\n\u6D41\u7A0B\u6E05\u6670\u5EA6,2,3.50",
  "Run result": "\u8FD0\u884C\u7ED3\u679C",
  "Data analysis": "\u8BFB\u8868\u4E0E\u7EDF\u8BA1",
  "Generating Flow": "\u6B63\u5728\u751F\u6210 Flow",
  "Filling review prompts": "\u6B63\u5728\u586B\u5199\u5BA1\u6838\u63D0\u793A\u8BCD",
  "Assigning roles from the description and writing their tasks.": "\u6839\u636E\u63CF\u8FF0\u5B89\u6392\u5404\u4E2A\u89D2\u8272\uFF0C\u5E76\u586B\u5199\u5B83\u4EEC\u7684\u4EFB\u52A1\u3002",
  "Writing input and output requirements from upstream content and review responsibilities.": "\u6839\u636E\u4E0A\u6E38\u5185\u5BB9\u548C\u5BA1\u6838\u804C\u8D23\uFF0C\u586B\u5199\u8F93\u5165\u4E0E\u8F93\u51FA\u8981\u6C42\u3002",
  "Reading customer feedback": "\u6B63\u5728\u8BFB\u53D6\u56DE\u8BBF\u6750\u6599",
  "Saving result files": "\u6B63\u5728\u4FDD\u5B58\u7ED3\u679C\u6587\u4EF6",
  "Running: {0}": "\u6B63\u5728\u8FD0\u884C\uFF1A{0}",
  "Results will be available when complete.": "\u5B8C\u6210\u540E\u5373\u53EF\u67E5\u770B\u7ED3\u679C\u3002",
  "When this node finishes, its result follows the link to the next step.": "\u5B8C\u6210\u5F53\u524D\u8282\u70B9\u540E\uFF0C\u7ED3\u679C\u5C06\u6CBF\u8FDE\u63A5\u4F20\u7ED9\u4E0B\u4E00\u6B65\u3002",
  "Flow generated": "Flow \u5DF2\u751F\u6210",
  "Inputs, planning, brief design, and local analysis are ready, with prompts for each Agent. Add an independent reviewer next.": "\u6750\u6599\u3001\u8BA1\u5212\u3001\u7B80\u62A5\u8BBE\u8BA1\u548C\u672C\u5730\u7EDF\u8BA1\u5DF2\u5C31\u4F4D\uFF0C\u5404 Agent \u4E5F\u6709\u4E86\u63D0\u793A\u8BCD\u3002\u63A5\u4E0B\u6765\u52A0\u4E0A\u72EC\u7ACB\u5BA1\u6838\u3002",
  "Place the Flow on the canvas": "\u628A\u6D41\u7A0B\u653E\u5230\u753B\u5E03\u4E0A",
  "See a description become a Flow": "\u770B\u770B\u63CF\u8FF0\u5982\u4F55\u53D8\u6210 Flow",
  "Click \u201CApply Flow\u201D to see the complete process.": "\u70B9\u51FB\u300C\u5E94\u7528 Flow\u300D\uFF0C\u67E5\u770B\u5B8C\u6574\u6D41\u7A0B\u3002",
  "Click \u201CGenerate preview\u201D to turn customer feedback into a weekly brief.": "\u70B9\u51FB\u300C\u751F\u6210\u9884\u89C8\u300D\uFF0C\u628A\u5BA2\u6237\u56DE\u8BBF\u6574\u7406\u6210\u5468\u4F1A\u7B80\u62A5\u3002",
  "Complete the review Agent\u2019s prompts": "\u8865\u9F50\u5BA1\u6838 Agent \u7684\u63D0\u793A\u8BCD",
  "Click \u201CFill blank and default prompts\u201D to define review requirements for the new Agent.": "\u70B9\u51FB\u300C\u53EA\u8865\u9F50\u7A7A\u767D\u4E0E\u9ED8\u8BA4\u300D\uFF0C\u4E3A\u65B0 Agent \u586B\u5199\u5BA1\u6838\u8981\u6C42\u3002",
  "Confirm execution order": "\u786E\u8BA4\u6267\u884C\u987A\u5E8F",
  "The merge joins the plan and revised design. Click \u201CRun Flow\u201D to execute in order from the inputs.": "\u5408\u5E76\u6C47\u5408\u8BA1\u5212\u4E0E\u4FEE\u8BA2\u8BBE\u8BA1\u3002\u70B9\u51FB\u300C\u8FD0\u884C Flow\u300D\uFF0C\u4ECE\u8F93\u5165\u6750\u6599\u5F00\u59CB\u4F9D\u6B21\u8FD0\u884C\u3002",
  "Inspect the generated prompts": "\u67E5\u770B\u521A\u751F\u6210\u7684\u63D0\u793A\u8BCD",
  "Click \u201CPrompts\u201D to inspect the reviewer\u2019s role, input, and output requirements.": "\u70B9\u51FB\u300C\u63D0\u793A\u8BCD\u300D\uFF0C\u67E5\u770B\u5BA1\u6838 Agent \u7684\u804C\u8D23\u3001\u8F93\u5165\u548C\u8F93\u51FA\u8981\u6C42\u3002",
  "Review requirements are ready": "\u5BA1\u6838\u8981\u6C42\u5DF2\u7ECF\u586B\u597D",
  "System defines the role, Input describes the material to review, and Output specifies the format. Review them, then click \u201CRun Flow\u201D.": "\u7CFB\u7EDF\u5B9A\u4E49\u804C\u8D23\uFF0C\u8F93\u5165\u8BF4\u660E\u5BA1\u6838\u5185\u5BB9\uFF0C\u8F93\u51FA\u7EA6\u5B9A\u7ED3\u679C\u683C\u5F0F\u3002\u67E5\u770B\u540E\uFF0C\u70B9\u51FB\u300C\u8FD0\u884C Flow\u300D\u3002",
  "Statistics files are ready to use": "\u7EDF\u8BA1\u6587\u4EF6\u53EF\u4EE5\u7EE7\u7EED\u4F7F\u7528",
  "Click the back arrow at the top left to pass these results to the brief Agent.": "\u70B9\u51FB\u5DE6\u4E0A\u89D2\u8FD4\u56DE\u7BAD\u5934\uFF0C\u628A\u8FD9\u4EFD\u7ED3\u679C\u4EA4\u7ED9\u7B80\u62A5 Agent\u3002",
  "Choose a review model": "\u9009\u62E9\u5BA1\u6838\u6A21\u578B",
  "Select a model for the review Agent. You can search the list first.": "\u4ECE\u5217\u8868\u4E2D\u9009\u4E00\u4E2A\u6A21\u578B\u4F5C\u4E3A\u5BA1\u6838 Agent\uFF0C\u4E5F\u53EF\u4EE5\u5148\u641C\u7D22\u3002",
  "Connect brief design to review": "\u8FDE\u63A5\u7B80\u62A5\u8BBE\u8BA1\u4E0E\u5BA1\u6838",
  "Send review feedback to the author": "\u628A\u5BA1\u6838\u610F\u89C1\u4EA4\u7ED9\u4F5C\u8005",
  "Send statistics to the brief Agent": "\u628A\u7EDF\u8BA1\u7ED3\u679C\u4EA4\u7ED9\u7B80\u62A5 Agent",
  "Drag from the highlighted dot on the right of \u201C{0}\u201D to the dot on the left of \u201C{1}\u201D, following the arrow.": "\u6309\u4F4F\u300C{0}\u300D\u53F3\u4FA7\u4EAE\u8D77\u7684\u5706\u70B9\uFF0C\u6CBF\u7BAD\u5934\u62D6\u5230\u300C{1}\u300D\u5DE6\u4FA7\u5706\u70B9\u540E\u677E\u5F00\u3002",
  "Set this link to review": "\u628A\u8FD9\u6761\u8FDE\u63A5\u8BBE\u4E3A\u5BA1\u6838",
  "Revise from review feedback": "\u6839\u636E\u5BA1\u6838\u610F\u89C1\u4FEE\u8BA2",
  "Click \u201C{0}\u201D.": "\u70B9\u51FB\u300C{0}\u300D\u3002",
  "Click the highlighted link-type button and choose \u201C{0}\u201D.": "\u70B9\u51FB\u4EAE\u8D77\u7684\u8FDE\u7EBF\u7C7B\u578B\u6309\u94AE\uFF0C\u9009\u62E9\u300C{0}\u300D\u3002",
  "Inspect statistics files": "\u67E5\u770B\u7EDF\u8BA1\u6587\u4EF6",
  "Click \u201CFiles\u201D to expand the local Agent\u2019s output.": "\u70B9\u51FB\u300C\u6587\u4EF6\u300D\uFF0C\u5C55\u5F00\u672C\u5730 Agent \u7684\u8F93\u51FA\u3002",
  "Read the statistics": "\u67E5\u770B\u7EDF\u8BA1\u7ED3\u679C",
  "Click the open icon beside findings.md to read the report.": "\u70B9\u51FB findings.md \u65C1\u7684\u6253\u5F00\u56FE\u6807\uFF0C\u9605\u8BFB\u7EDF\u8BA1\u62A5\u544A\u3002",
  "Your weekly brief is ready": "\u8FD9\u5C31\u662F\u4F60\u7684\u5468\u4F1A\u7B80\u62A5",
  "Read the overall rating, customer feedback, and two actions for next week. Then click the back arrow to open connection settings.": "\u67E5\u770B\u6574\u4F53\u8BC4\u5206\u3001\u5BA2\u6237\u53CD\u9988\u548C\u4E24\u9879\u4E0B\u5468\u884C\u52A8\u3002\u8BFB\u5B8C\u540E\u70B9\u51FB\u8FD4\u56DE\u7BAD\u5934\uFF0C\u524D\u5F80\u8FDE\u63A5\u8BBE\u7F6E\u3002",
  "View the final brief": "\u67E5\u770B\u6700\u7EC8\u7B80\u62A5",
  "Click \u201COutput\u201D to expand the weekly brief.": "\u70B9\u51FB\u300C\u8F93\u51FA\u300D\uFF0C\u5C55\u5F00\u5468\u4F1A\u7B80\u62A5\u3002",
  "Open the final brief": "\u6253\u5F00\u6700\u7EC8\u7B80\u62A5",
  "Click the open icon to read the one-page brief.": "\u70B9\u51FB\u6253\u5F00\u56FE\u6807\uFF0C\u9605\u8BFB\u8FD9\u4E00\u9875\u5468\u4F1A\u7B80\u62A5\u3002",
  "Start with a description": "\u4ECE\u4E00\u53E5\u63CF\u8FF0\u5F00\u59CB",
  "Click \u201CGenerate Flow from description\u201D to turn 8 customer interviews into a one-page weekly brief.": "\u70B9\u51FB\u300C\u4ECE\u63CF\u8FF0\u751F\u6210 Flow\u300D\uFF0C\u628A 8 \u6761\u5BA2\u6237\u56DE\u8BBF\u6574\u7406\u6210\u4E00\u9875\u5468\u4F1A\u7B80\u62A5\u3002",
  "Add a review Agent": "\u6DFB\u52A0\u5BA1\u6838 Agent",
  "Click \u201CModels\u201D to add an independent reviewer to the brief.": "\u70B9\u51FB\u300C\u6A21\u578B\u300D\uFF0C\u4E3A\u7B80\u62A5\u589E\u52A0\u4E00\u4E2A\u72EC\u7ACB\u5BA1\u6838\u89D2\u8272\u3002",
  "Autofill the new Agent\u2019s prompts": "\u81EA\u52A8\u586B\u5199\u65B0 Agent \u7684\u63D0\u793A\u8BCD",
  "Click \u201CAutofill prompts\u201D to complete the reviewer\u2019s role and output requirements.": "\u70B9\u51FB\u300C\u81EA\u52A8\u586B\u5199\u63D0\u793A\u8BCD\u300D\uFF0C\u8865\u9F50\u5BA1\u6838\u89D2\u8272\u7684\u804C\u8D23\u548C\u8F93\u51FA\u8981\u6C42\u3002",
  "Generate the weekly brief": "\u751F\u6210\u5468\u4F1A\u7B80\u62A5",
  "Click \u201CRun Agent\u201D to write the brief from the connected statistics.": "\u70B9\u51FB\u300C\u5355\u72EC\u8FD0\u884C\u300D\uFF0C\u6839\u636E\u521A\u8FDE\u63A5\u7684\u7EDF\u8BA1\u7ED3\u679C\u64B0\u5199\u7B80\u62A5\u3002",
  "Start using your own connections": "\u5F00\u59CB\u4F7F\u7528\u81EA\u5DF1\u7684\u8FDE\u63A5",
  "Click \u201CSettings\u201D to add model services or local Agent tools and start your own task.": "\u70B9\u51FB\u300C\u8BBE\u7F6E\u300D\uFF0C\u6DFB\u52A0\u6A21\u578B\u670D\u52A1\u6216\u672C\u5730 Agent \u5DE5\u5177\uFF0C\u5F00\u59CB\u81EA\u5DF1\u7684\u4EFB\u52A1\u3002",
  "Skip tutorial": "\u8DF3\u8FC7\u6559\u7A0B",
  "Back": "\u4E0A\u4E00\u6B65",
  "Skip": "\u8DF3\u8FC7",
  "{0} copy": "{0} \u526F\u672C",
  "Forked from {0}": "\u6D3E\u751F\u81EA {0}",
  "Customer feedback \xB7 Weekly brief tutorial": "\u5BA2\u6237\u56DE\u8BBF \xB7 \u5468\u4F1A\u7B80\u62A5\u6559\u7A0B",
  "Project files are incomplete. The current project was retained.": "\u9879\u76EE\u6587\u4EF6\u4E0D\u5B8C\u6574\uFF0C\u672A\u8986\u76D6\u5F53\u524D\u9879\u76EE\u3002",
  "Node {0} is not an agent": "\u8282\u70B9 {0} \u4E0D\u662F Agent",
  "Upstream input for {0} is empty. Add content or show the files to send.": "{0} \u7684\u4E0A\u6E38\u8F93\u5165\u4E3A\u7A7A\uFF0C\u8BF7\u6DFB\u52A0\u5185\u5BB9\u6216\u663E\u793A\u8981\u4F20\u9012\u7684\u6587\u4EF6\u3002",
  "{0} cannot receive {1}: {2}": "{0} \u65E0\u6CD5\u63A5\u6536 {1}\uFF1A{2}",
  "Image: {0}": "\u56FE\u7247\uFF1A{0}",
  "## Review conclusion": "## \u8BC4\u5BA1\u7ED3\u8BBA",
  "The main approach is clear and ready for prototype validation. Refine three points before implementation:": "\u65B9\u6848\u4E3B\u8DEF\u5F84\u6E05\u695A\uFF0C\u53EF\u4EE5\u8FDB\u5165\u539F\u578B\u9A8C\u8BC1\u3002\u5EFA\u8BAE\u5728\u5B9E\u73B0\u524D\u6536\u7D27\u4E09\u70B9\uFF1A",
  "1. The GUI and CLI must read the same Flow schema.": "1. \u56FE\u5F62\u754C\u9762\u4E0E\u547D\u4EE4\u884C\u5FC5\u987B\u8BFB\u53D6\u540C\u4E00\u4EFD Flow \u7ED3\u6784\u5B9A\u4E49\u3002",
  "2. Links describe information relationships. Tasks belong in downstream Agent prompts.": "2. \u8FDE\u63A5\u53EA\u8868\u8FBE\u4FE1\u606F\u5173\u7CFB\uFF0C\u5177\u4F53\u4EFB\u52A1\u96C6\u4E2D\u5728\u4E0B\u6E38 Agent \u63D0\u793A\u8BCD\u3002",
  "3. Runs, artifacts, and parent dependencies need immutable version records.": "3. \u8FD0\u884C\u3001\u4EA7\u51FA\u7269\u548C\u7236\u7EA7\u4F9D\u8D56\u9700\u8981\u4F7F\u7528\u4E0D\u53EF\u53D8\u7248\u672C\u8BB0\u5F55\u3002",
  "Reviewed {0} upstream artifacts.": "\u5DF2\u68C0\u67E5 {0} \u4EFD\u4E0A\u6E38\u4EA7\u51FA\u7269\u3002",
  "## Prototype plan": "## \u539F\u578B\u65B9\u6848",
  "Use a shared core to support both the desktop canvas and CLI:": "\u4EE5\u5171\u4EAB\u6838\u5FC3\u4E3A\u4E2D\u5FC3\uFF0C\u540C\u65F6\u63D0\u4F9B\u684C\u9762\u753B\u5E03\u548C\u547D\u4EE4\u884C\uFF1A",
  "- The Flow schema validates nodes, relations, and versions.": "- Flow \u7ED3\u6784\u5B9A\u4E49\u8D1F\u8D23\u8282\u70B9\u3001\u5173\u7CFB\u548C\u7248\u672C\u6821\u9A8C\u3002",
  "- The runtime follows DAG dependencies and streams status events.": "- \u8FD0\u884C\u65F6\u6309 DAG \u4F9D\u8D56\u6267\u884C\uFF0C\u5E76\u6D41\u5F0F\u53D1\u5E03\u72B6\u6001\u4E8B\u4EF6\u3002",
  "- Each node produces an immutable artifact and supports partial reruns.": "- \u6BCF\u4E2A\u8282\u70B9\u8F93\u51FA\u4E0D\u53EF\u53D8\u4EA7\u51FA\u7269\uFF0C\u652F\u6301\u5C40\u90E8\u91CD\u8DD1\u3002",
  "- Each Agent retains its prompts, model configuration, and runtime context.": "- Agent \u8282\u70B9\u4FDD\u7559\u5404\u81EA\u7684\u63D0\u793A\u8BCD\u3001\u6A21\u578B\u914D\u7F6E\u4E0E\u8FD0\u884C\u4E0A\u4E0B\u6587\u3002",
  "This request received {0} upstream inputs.": "\u5F53\u524D\u8C03\u7528\u5DF2\u63A5\u6536 {0} \u4E2A\u4E0A\u6E38\u8F93\u5165\u3002",
  "The tutorial Flow uses preset results. Run it in the interactive tutorial.": "\u6559\u7A0B Flow \u4F7F\u7528\u9884\u7F6E\u7ED3\u679C\uFF0C\u8BF7\u5728\u5E94\u7528\u7684\u4EA4\u4E92\u6559\u7A0B\u4E2D\u8FD0\u884C\u3002",
  "Runtime stalled because graph dependencies are unresolved": "\u8282\u70B9\u4F9D\u8D56\u672A\u89E3\u51B3\uFF0C\u8FD0\u884C\u5DF2\u505C\u6EDE",
  "{0} is waiting for unsupported files to be handled": "{0} \u7B49\u5F85\u5904\u7406\u4E0D\u652F\u6301\u7684\u6587\u4EF6",
  "{0} stopped": "{0} \u5DF2\u505C\u6B62",
  "Stopped before execution": "\u5DF2\u505C\u6B62\uFF0C\u672A\u6267\u884C",
  "Provider {0} requires a model invoker": "\u670D\u52A1\u5546 {0} \u9700\u8981\u6A21\u578B\u8C03\u7528\u63A5\u53E3",
  "{0} attachments are not supported": "\u4E0D\u652F\u6301 {0} \u9644\u4EF6",
  "Unknown format": "\u672A\u77E5\u683C\u5F0F",
  "{0} does not accept {1}": "{0} \u4E0D\u63A5\u53D7 {1}",
  "Local Agent tools do not support image attachments yet": "\u672C\u673A Agent \u5DE5\u5177\u6682\u4E0D\u63A5\u6536\u56FE\u7247\u9644\u4EF6",
  "Subscription connectors do not support image attachments yet": "\u8BA2\u9605\u8D26\u6237\u8FDE\u63A5\u5668\u6682\u4E0D\u63A5\u6536\u56FE\u7247\u9644\u4EF6",
  "{0} does not support image input": "{0} \u4E0D\u652F\u6301\u56FE\u7247\u8F93\u5165",
  "Image capabilities for {0} are missing. Refresh the model list first": "\u7F3A\u5C11 {0} \u7684\u56FE\u7247\u80FD\u529B\u4FE1\u606F\uFF0C\u8BF7\u5148\u5237\u65B0\u6A21\u578B\u5217\u8868",
  "{0} has not declared image input support": "{0} \u672A\u58F0\u660E\u56FE\u7247\u8F93\u5165\u80FD\u529B",
  "Sampling is managed by the model. The output limit includes reasoning tokens.": "\u91C7\u6837\u7531\u6A21\u578B\u7BA1\u7406\uFF1B\u8F93\u51FA\u4E0A\u9650\u5305\u542B\u63A8\u7406\u8BCD\u5143\u3002",
  "Adaptive reasoning. The output limit includes reasoning tokens and is required by this endpoint. The initial value is the model\u2019s maximum output.": "\u81EA\u9002\u5E94\u63A8\u7406\uFF1B\u8F93\u51FA\u4E0A\u9650\u5305\u542B\u63A8\u7406\u8BCD\u5143\u3002\u6B64\u63A5\u53E3\u8981\u6C42\u6307\u5B9A\u4E0A\u9650\uFF0C\u521D\u59CB\u503C\u4F7F\u7528\u6A21\u578B\u6700\u5927\u8F93\u51FA\u91CF\u3002",
  "Adaptive reasoning uses effort. The output limit includes reasoning tokens.": "\u81EA\u9002\u5E94\u63A8\u7406\u4F7F\u7528\u63A8\u7406\u5F3A\u5EA6\uFF1B\u8F93\u51FA\u4E0A\u9650\u5305\u542B\u63A8\u7406\u8BCD\u5143\u3002",
  "Uses thinking level. Sampling for this Flash generation is managed by the server.": "\u4F7F\u7528\u601D\u8003\u5F3A\u5EA6\uFF1B\u6B64\u4EE3 Flash \u7684\u91C7\u6837\u53C2\u6570\u7531\u670D\u52A1\u7AEF\u7BA1\u7406\u3002",
  "Sampling and penalty parameters are unused during reasoning. Select Off to disable reasoning.": "\u63A8\u7406\u6A21\u5F0F\u4E0D\u4F7F\u7528\u91C7\u6837\u548C\u60E9\u7F5A\u53C2\u6570\uFF1B\u5173\u95ED\u5173\u95ED\u63A8\u7406\u3002",
  "Reasoning is always enabled for this model.": "\u6B64\u6A21\u578B\u59CB\u7EC8\u542F\u7528\u63A8\u7406\u3002",
  "Sampling parameters are fixed by the provider. Kimi K3 always reasons.": "\u91C7\u6837\u53C2\u6570\u4E3A\u5382\u5546\u56FA\u5B9A\u503C\uFF1BKimi K3 \u59CB\u7EC8\u542F\u7528\u63A8\u7406\u3002",
  "Pro requires reasoning. Keep temperature at 1.": "Pro \u4E0D\u652F\u6301\u5173\u95ED\u63A8\u7406\u3002\u5EFA\u8BAE\u4FDD\u6301\u6E29\u5EA6\u4E3A 1\u3002",
  "A reasoning budget of -1 enables a dynamic budget{0}.": "\u63A8\u7406\u9884\u7B97 -1 \u8868\u793A\u52A8\u6001\u9884\u7B97{0}\u3002",
  "; Pro requires a nonzero value": "\uFF1BPro \u4E0D\u80FD\u8BBE\u4E3A 0",
  "; 0 disables reasoning": "\uFF0C0 \u5173\u95ED\u63A8\u7406",
  "Select Off to disable reasoning.": "\u5173\u95ED\u5173\u95ED\u63A8\u7406\u3002",
  "Reasoning is always on. Temperature is fixed at 1 and Top-P at 0.95.": "\u63A8\u7406\u59CB\u7EC8\u5F00\u542F\uFF1B\u6E29\u5EA6 = 1\u3001\u6838\u91C7\u6837 = 0.95 \u4E3A\u56FA\u5B9A\u503C\u3002",
  "Temperature is 1 with reasoning on and 0.6 with it off. Top-P is fixed at 0.95.": "\u63A8\u7406\u5F00\u542F\u65F6\u6E29\u5EA6 = 1\uFF0C\u5173\u95ED\u65F6 = 0.6\uFF1B\u6838\u91C7\u6837\u56FA\u5B9A\u4E3A 0.95\u3002",
  "Web expert mode enables deep thinking. Output length is managed by the web service.": "\u7F51\u9875\u4E13\u5BB6\u6A21\u5F0F\u542F\u7528\u6DF1\u5EA6\u601D\u8003\uFF1B\u8F93\u51FA\u957F\u5EA6\u7531\u7F51\u9875\u670D\u52A1\u7BA1\u7406\u3002",
  "Web default mode supports toggling deep thinking. Output length is managed by the web service.": "\u7F51\u9875\u9ED8\u8BA4\u6A21\u5F0F\u53EF\u5207\u6362\u6DF1\u5EA6\u601D\u8003\uFF1B\u8F93\u51FA\u957F\u5EA6\u7531\u7F51\u9875\u670D\u52A1\u7BA1\u7406\u3002",
  "Reasoning capabilities and defaults come from the OpenRouter model catalog.": "\u63A8\u7406\u80FD\u529B\u4E0E\u9ED8\u8BA4\u503C\u6765\u81EA OpenRouter \u6A21\u578B\u76EE\u5F55\u3002",
  "This endpoint requires an output limit. Enter a positive integer supported by the model": "\u6B64\u63A5\u53E3\u5FC5\u987B\u6307\u5B9A\u8F93\u51FA\u4E0A\u9650\uFF1B\u8BF7\u586B\u5199\u8BE5\u6A21\u578B\u652F\u6301\u7684\u6B63\u6574\u6570",
  "Up to 4 nonempty stop sequences are allowed": "\u505C\u6B62\u5E8F\u5217\u6700\u591A 4 \u6761\uFF0C\u4E14\u4E0D\u80FD\u4E3A\u7A7A",
  "Response detail supports Low, Medium, and High": "\u56DE\u7B54\u8BE6\u7EC6\u7A0B\u5EA6\u652F\u6301\u4F4E\u3001\u4E2D\u3001\u9AD8",
  "Custom parameters cannot change: {0}": "\u81EA\u5B9A\u4E49\u53C2\u6570\u4E0D\u80FD\u4FEE\u6539\uFF1A{0}",
  "Invalid parameters for {0}: {1}": "{0} \u53C2\u6570\u65E0\u6548\uFF1A{1}",
  "Temperature": "\u6E29\u5EA6",
  "Top-P": "\u6838\u91C7\u6837",
  "Top-K": "\u5019\u9009\u91C7\u6837\u6570",
  "Presence penalty": "\u5B58\u5728\u60E9\u7F5A",
  "Frequency penalty": "\u9891\u7387\u60E9\u7F5A",
  "Seed": "\u968F\u673A\u79CD\u5B50",
  "Pass": "\u4F20\u9012",
  "Review": "\u5BA1\u6838",
  "Revise": "\u4FEE\u8BA2",
  "System": "\u7CFB\u7EDF",
  "Active": "\u6D3B\u8DC3",
  "Archived": "\u5DF2\u5F52\u6863",
  "Low": "\u4F4E",
  "Medium": "\u4E2D",
  "High": "\u9AD8",
  "Minimal": "\u6700\u4F4E",
  "Very high": "\u5F88\u9AD8",
  "Maximum": "\u6700\u9AD8",
  "Off": "\u5173\u95ED",
  "Auto": "\u81EA\u52A8",
  "Files": "\u6587\u4EF6",
  "Demo model": "\u6F14\u793A\u6A21\u578B",
  "General": "\u901A\u7528",
  "Language": "\u8BED\u8A00",
  "Follow system": "\u8DDF\u968F\u7CFB\u7EDF",
  "Display language": "\u754C\u9762\u8BED\u8A00",
  "Choose your interface language. Changes apply immediately.": "\u9009\u62E9\u754C\u9762\u8BED\u8A00\uFF0C\u5207\u6362\u540E\u7ACB\u5373\u751F\u6548\u3002",
  "Detected language: {0}": "\u68C0\u6D4B\u5230\u7684\u8BED\u8A00\uFF1A{0}",
  "Chinese": "\u4E2D\u6587",
  "English": "\u82F1\u8BED",
  "Could not save language preference. Try again.": "\u65E0\u6CD5\u4FDD\u5B58\u8BED\u8A00\u8BBE\u7F6E\uFF0C\u8BF7\u91CD\u8BD5\u3002",
  "Fit view": "\u9002\u5E94\u753B\u5E03",
  "Toggle interactivity": "\u5207\u6362\u4EA4\u4E92",
  "Flow overview": "Flow \u6982\u89C8",
  "Press Enter or Space to select a node. Use arrow keys to move it. Press Delete to remove it and Escape to cancel.": "\u6309\u56DE\u8F66\u6216\u7A7A\u683C\u9009\u62E9\u8282\u70B9\uFF0C\u65B9\u5411\u952E\u79FB\u52A8\uFF0CDelete \u5220\u9664\uFF0CEsc \u53D6\u6D88\u3002",
  "Press Enter or Space to select a link. Press Delete to remove it and Escape to cancel.": "\u6309\u56DE\u8F66\u6216\u7A7A\u683C\u9009\u62E9\u8FDE\u63A5\uFF0CDelete \u5220\u9664\uFF0CEsc \u53D6\u6D88\u3002",
  "Result": "\u7ED3\u679C",
  "Untitled Flow": "\u672A\u547D\u540D Flow",
  "Project": "\u9879\u76EE",
  "Prompt": "\u63D0\u793A\u8BCD",
  "Links": "\u8FDE\u63A5",
  "Flow name": "Flow \u540D\u79F0",
  "Flow goal": "Flow \u76EE\u6807",
  "{0} provider": "{0} \u670D\u52A1\u5546",
  "Run started \xB7 {0}": "\u5F00\u59CB\u8FD0\u884C \xB7 {0}",
  "{0} started": "{0} \u5F00\u59CB\u8FD0\u884C",
  "{0} failed": "{0} \u5931\u8D25",
  "{0} completed": "{0} \u5DF2\u5B8C\u6210",
  "{0} produced artifact v{1}": "{0} \u5DF2\u751F\u6210\u4EA7\u51FA\u7269 v{1}",
  "Run completed": "\u8FD0\u884C\u5B8C\u6210",
  "Connection handle": "\u8FDE\u63A5\u7AEF\u70B9",
  "Select a node with Enter or Space. Press Escape to cancel.": "\u6309\u56DE\u8F66\u6216\u7A7A\u683C\u9009\u62E9\u8282\u70B9\uFF0CEsc \u53D6\u6D88\u3002",
  "Node moved to x {0}, y {1}.": "\u8282\u70B9\u5DF2\u79FB\u52A8\u5230 x {0}\uFF0Cy {1}\u3002",
  "No results for \u201C{0}\u201D. Try a provider or command name.": "\u672A\u627E\u5230\u201C{0}\u201D\uFF0C\u8BF7\u5C1D\u8BD5\u670D\u52A1\u5546\u540D\u79F0\u6216\u547D\u4EE4\u540D\u3002",
  "Connect your account through the official {0} runtime": "\u901A\u8FC7\u5B98\u65B9 {0} \u8FD0\u884C\u65F6\u8FDE\u63A5\u8D26\u6237",
  "Open {0} login page": "\u6253\u5F00 {0} \u767B\u5F55\u9875",
  "{0} log files, up to {1} MB each. Exports include all retained records.": "\u6700\u591A\u4FDD\u7559 {0} \u4E2A\u65E5\u5FD7\u6587\u4EF6\uFF0C\u6BCF\u4E2A\u7EA6 {1} MB\u3002\u5BFC\u51FA\u5305\u542B\u5168\u90E8\u4FDD\u7559\u8BB0\u5F55\u3002",
  "Showing {0} entries \xB7 Latest 500 records \xB7 Local time": "\u663E\u793A {0} \u6761 \xB7 \u6700\u8FD1 500 \u6761\u8BB0\u5F55 \xB7 \u65F6\u95F4\u4E3A\u672C\u5730\u65F6\u95F4",
  "Editing \u201C{0}\u201D at historical state \u201C{1}\u201D.": "\u6B63\u5728\u7F16\u8F91\u201C{0}\u201D\u7684\u5386\u53F2\u72B6\u6001\u201C{1}\u201D\u3002",
  "{0} cannot receive the following files.": "{0} \u65E0\u6CD5\u63A5\u6536\u4EE5\u4E0B\u6587\u4EF6\u3002",
  "{0} is missing output from {1}.": "{0} \u7F3A\u5C11 {1} \u7684\u4EA7\u51FA\u7269\u3002",
  "Not saved: enter {0}.": "\u5C1A\u672A\u4FDD\u5B58\uFF1A\u8BF7\u8F93\u5165 {0}\u3002",
  "a number from {0} to {1}": "{0} \u81F3 {1} \u4E4B\u95F4\u7684\u6570\u503C",
  "a number greater than or equal to {0}": "\u5927\u4E8E\u6216\u7B49\u4E8E {0} \u7684\u6570\u503C",
  "an integer from {0} to {1}": "{0} \u81F3 {1} \u4E4B\u95F4\u7684\u6574\u6570",
  "an integer greater than or equal to {0}": "\u5927\u4E8E\u6216\u7B49\u4E8E {0} \u7684\u6574\u6570",
  "{0}, or one of {1}": "{0}\uFF0C\u6216 {1} \u4E2D\u7684\u4E00\u4E2A\u503C",
  "{0} must be {1}.": "{0} \u5E94\u4E3A{1}\u3002",
  "DeepSeek web connection": "DeepSeek \u7F51\u9875\u8FDE\u63A5",
  "Reviewer Agent {0}": "\u5BA1\u6838 Agent {0}",
  "Reviser Agent {0}": "\u4FEE\u8BA2 Agent {0}",
  "Merger Agent {0}": "\u5408\u5E76 Agent {0}",
  "Agent {0}": "Agent {0}",
  "; ": "\uFF1B",
  ", ": "\u3001",
  ".": "\u3002",
  "DeepSeek challenge failed": "DeepSeek \u9A8C\u8BC1\u8BF7\u6C42\u5931\u8D25",
  "DeepSeek PoW worker failed: {0}": "DeepSeek \u5DE5\u4F5C\u91CF\u8BC1\u660E\u8BA1\u7B97\u52A0\u8F7D\u5931\u8D25\uFF1A{0}",
  "DeepSeek PoW timed out": "DeepSeek \u5DE5\u4F5C\u91CF\u8BC1\u660E\u8BA1\u7B97\u8D85\u65F6",
  "DeepSeek session creation failed": "DeepSeek \u4F1A\u8BDD\u521B\u5EFA\u5931\u8D25",
  "DeepSeek status check failed (HTTP {0})": "DeepSeek \u72B6\u6001\u68C0\u67E5\u5931\u8D25\uFF08HTTP {0}\uFF09",
  "DeepSeek status check failed": "DeepSeek \u72B6\u6001\u68C0\u67E5\u5931\u8D25",
  "{0} nodes \xB7 {1} links": "{0} \u4E2A\u8282\u70B9 \xB7 {1} \u6761\u8FDE\u63A5",
  "Artifact v{0}": "\u4EA7\u51FA\u7269 v{0}",
  "Agent {0} name": "Agent {0} \u540D\u79F0",
  "Agent {0} system prompt": "Agent {0} \u7CFB\u7EDF\u63D0\u793A\u8BCD",
  "Agent {0} input prompt": "Agent {0} \u8F93\u5165\u63D0\u793A\u8BCD",
  "Agent {0} output prompt": "Agent {0} \u8F93\u51FA\u63D0\u793A\u8BCD",
  "{0} name": "{0}\u540D\u79F0",
  "{0} \xB7 Fork": "{0} \xB7 \u6D3E\u751F",
  "Page {0}": "\u7B2C {0} \u9875"
};

// ../../packages/core/src/localization/index.ts
var LANGUAGE_STORAGE_KEY = "agentflow.language";
function isLanguagePreference(value) {
  return value === "system" || value === "zh" || value === "en";
}
function detectLanguage(languages) {
  for (const language of languages) {
    const code = language.trim().replaceAll("_", "-").split("-")[0]?.toLowerCase();
    if (code === "zh" || code === "en") return code;
  }
  return "en";
}
function browserPreference() {
  try {
    const value = globalThis.localStorage?.getItem(LANGUAGE_STORAGE_KEY);
    return isLanguagePreference(value) ? value : "system";
  } catch {
    return "system";
  }
}
var settings = {
  preference: browserPreference(),
  systemLanguages: typeof navigator === "undefined" ? [] : [...navigator.languages]
};
var getLanguage = () => settings.preference === "system" ? detectLanguage(settings.systemLanguages) : settings.preference;
function t(key, values = []) {
  const message = getLanguage() === "zh" ? zhMessages[key] : key;
  return message.replace(/\{(\d+)\}/g, (placeholder, index) => index in values ? String(values[Number(index)] ?? "") : placeholder);
}
var reverseMessages = new Map(Object.entries(zhMessages).map(([key, value]) => [value, key]));
var messagePatterns = Object.entries(zhMessages).flatMap(([key, zh]) => /\{\d+\}/.test(key) ? [key, zh].map((pattern) => {
  const indices = [];
  const escaped = pattern.split(/(\{\d+\})/).map((part) => {
    if (/^\{\d+\}$/.test(part)) {
      indices.push(Number(part.slice(1, -1)));
      return "(.*?)";
    }
    return part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }).join("");
  return { key, indices, regex: new RegExp("^" + escaped + "$", "s") };
}) : []);

// ../../packages/schema/src/index.ts
var import_yaml = __toESM(require_dist(), 1);

// ../../node_modules/zod/v3/external.js
var external_exports = {};
__export(external_exports, {
  BRAND: () => BRAND,
  DIRTY: () => DIRTY,
  EMPTY_PATH: () => EMPTY_PATH,
  INVALID: () => INVALID,
  NEVER: () => NEVER,
  OK: () => OK,
  ParseStatus: () => ParseStatus,
  Schema: () => ZodType,
  ZodAny: () => ZodAny,
  ZodArray: () => ZodArray,
  ZodBigInt: () => ZodBigInt,
  ZodBoolean: () => ZodBoolean,
  ZodBranded: () => ZodBranded,
  ZodCatch: () => ZodCatch,
  ZodDate: () => ZodDate,
  ZodDefault: () => ZodDefault,
  ZodDiscriminatedUnion: () => ZodDiscriminatedUnion,
  ZodEffects: () => ZodEffects,
  ZodEnum: () => ZodEnum,
  ZodError: () => ZodError,
  ZodFirstPartyTypeKind: () => ZodFirstPartyTypeKind,
  ZodFunction: () => ZodFunction,
  ZodIntersection: () => ZodIntersection,
  ZodIssueCode: () => ZodIssueCode,
  ZodLazy: () => ZodLazy,
  ZodLiteral: () => ZodLiteral,
  ZodMap: () => ZodMap,
  ZodNaN: () => ZodNaN,
  ZodNativeEnum: () => ZodNativeEnum,
  ZodNever: () => ZodNever,
  ZodNull: () => ZodNull,
  ZodNullable: () => ZodNullable,
  ZodNumber: () => ZodNumber,
  ZodObject: () => ZodObject,
  ZodOptional: () => ZodOptional,
  ZodParsedType: () => ZodParsedType,
  ZodPipeline: () => ZodPipeline,
  ZodPromise: () => ZodPromise,
  ZodReadonly: () => ZodReadonly,
  ZodRecord: () => ZodRecord,
  ZodSchema: () => ZodType,
  ZodSet: () => ZodSet,
  ZodString: () => ZodString,
  ZodSymbol: () => ZodSymbol,
  ZodTransformer: () => ZodEffects,
  ZodTuple: () => ZodTuple,
  ZodType: () => ZodType,
  ZodUndefined: () => ZodUndefined,
  ZodUnion: () => ZodUnion,
  ZodUnknown: () => ZodUnknown,
  ZodVoid: () => ZodVoid,
  addIssueToContext: () => addIssueToContext,
  any: () => anyType,
  array: () => arrayType,
  bigint: () => bigIntType,
  boolean: () => booleanType,
  coerce: () => coerce,
  custom: () => custom,
  date: () => dateType,
  datetimeRegex: () => datetimeRegex,
  defaultErrorMap: () => en_default,
  discriminatedUnion: () => discriminatedUnionType,
  effect: () => effectsType,
  enum: () => enumType,
  function: () => functionType,
  getErrorMap: () => getErrorMap,
  getParsedType: () => getParsedType,
  instanceof: () => instanceOfType,
  intersection: () => intersectionType,
  isAborted: () => isAborted,
  isAsync: () => isAsync,
  isDirty: () => isDirty,
  isValid: () => isValid,
  late: () => late,
  lazy: () => lazyType,
  literal: () => literalType,
  makeIssue: () => makeIssue,
  map: () => mapType,
  nan: () => nanType,
  nativeEnum: () => nativeEnumType,
  never: () => neverType,
  null: () => nullType,
  nullable: () => nullableType,
  number: () => numberType,
  object: () => objectType,
  objectUtil: () => objectUtil,
  oboolean: () => oboolean,
  onumber: () => onumber,
  optional: () => optionalType,
  ostring: () => ostring,
  pipeline: () => pipelineType,
  preprocess: () => preprocessType,
  promise: () => promiseType,
  quotelessJson: () => quotelessJson,
  record: () => recordType,
  set: () => setType,
  setErrorMap: () => setErrorMap,
  strictObject: () => strictObjectType,
  string: () => stringType,
  symbol: () => symbolType,
  transformer: () => effectsType,
  tuple: () => tupleType,
  undefined: () => undefinedType,
  union: () => unionType,
  unknown: () => unknownType,
  util: () => util,
  void: () => voidType
});

// ../../node_modules/zod/v3/helpers/util.js
var util;
(function(util2) {
  util2.assertEqual = (_) => {
  };
  function assertIs(_arg) {
  }
  util2.assertIs = assertIs;
  function assertNever(_x) {
    throw new Error();
  }
  util2.assertNever = assertNever;
  util2.arrayToEnum = (items) => {
    const obj = {};
    for (const item of items) {
      obj[item] = item;
    }
    return obj;
  };
  util2.getValidEnumValues = (obj) => {
    const validKeys = util2.objectKeys(obj).filter((k) => typeof obj[obj[k]] !== "number");
    const filtered = {};
    for (const k of validKeys) {
      filtered[k] = obj[k];
    }
    return util2.objectValues(filtered);
  };
  util2.objectValues = (obj) => {
    return util2.objectKeys(obj).map(function(e) {
      return obj[e];
    });
  };
  util2.objectKeys = typeof Object.keys === "function" ? (obj) => Object.keys(obj) : (object) => {
    const keys = [];
    for (const key in object) {
      if (Object.prototype.hasOwnProperty.call(object, key)) {
        keys.push(key);
      }
    }
    return keys;
  };
  util2.find = (arr, checker) => {
    for (const item of arr) {
      if (checker(item))
        return item;
    }
    return void 0;
  };
  util2.isInteger = typeof Number.isInteger === "function" ? (val) => Number.isInteger(val) : (val) => typeof val === "number" && Number.isFinite(val) && Math.floor(val) === val;
  function joinValues(array, separator = " | ") {
    return array.map((val) => typeof val === "string" ? `'${val}'` : val).join(separator);
  }
  util2.joinValues = joinValues;
  util2.jsonStringifyReplacer = (_, value) => {
    if (typeof value === "bigint") {
      return value.toString();
    }
    return value;
  };
})(util || (util = {}));
var objectUtil;
(function(objectUtil2) {
  objectUtil2.mergeShapes = (first, second) => {
    return {
      ...first,
      ...second
      // second overwrites first
    };
  };
})(objectUtil || (objectUtil = {}));
var ZodParsedType = util.arrayToEnum([
  "string",
  "nan",
  "number",
  "integer",
  "float",
  "boolean",
  "date",
  "bigint",
  "symbol",
  "function",
  "undefined",
  "null",
  "array",
  "object",
  "unknown",
  "promise",
  "void",
  "never",
  "map",
  "set"
]);
var getParsedType = (data) => {
  const t2 = typeof data;
  switch (t2) {
    case "undefined":
      return ZodParsedType.undefined;
    case "string":
      return ZodParsedType.string;
    case "number":
      return Number.isNaN(data) ? ZodParsedType.nan : ZodParsedType.number;
    case "boolean":
      return ZodParsedType.boolean;
    case "function":
      return ZodParsedType.function;
    case "bigint":
      return ZodParsedType.bigint;
    case "symbol":
      return ZodParsedType.symbol;
    case "object":
      if (Array.isArray(data)) {
        return ZodParsedType.array;
      }
      if (data === null) {
        return ZodParsedType.null;
      }
      if (data.then && typeof data.then === "function" && data.catch && typeof data.catch === "function") {
        return ZodParsedType.promise;
      }
      if (typeof Map !== "undefined" && data instanceof Map) {
        return ZodParsedType.map;
      }
      if (typeof Set !== "undefined" && data instanceof Set) {
        return ZodParsedType.set;
      }
      if (typeof Date !== "undefined" && data instanceof Date) {
        return ZodParsedType.date;
      }
      return ZodParsedType.object;
    default:
      return ZodParsedType.unknown;
  }
};

// ../../node_modules/zod/v3/ZodError.js
var ZodIssueCode = util.arrayToEnum([
  "invalid_type",
  "invalid_literal",
  "custom",
  "invalid_union",
  "invalid_union_discriminator",
  "invalid_enum_value",
  "unrecognized_keys",
  "invalid_arguments",
  "invalid_return_type",
  "invalid_date",
  "invalid_string",
  "too_small",
  "too_big",
  "invalid_intersection_types",
  "not_multiple_of",
  "not_finite"
]);
var quotelessJson = (obj) => {
  const json = JSON.stringify(obj, null, 2);
  return json.replace(/"([^"]+)":/g, "$1:");
};
var ZodError = class _ZodError extends Error {
  get errors() {
    return this.issues;
  }
  constructor(issues) {
    super();
    this.issues = [];
    this.addIssue = (sub) => {
      this.issues = [...this.issues, sub];
    };
    this.addIssues = (subs = []) => {
      this.issues = [...this.issues, ...subs];
    };
    const actualProto = new.target.prototype;
    if (Object.setPrototypeOf) {
      Object.setPrototypeOf(this, actualProto);
    } else {
      this.__proto__ = actualProto;
    }
    this.name = "ZodError";
    this.issues = issues;
  }
  format(_mapper) {
    const mapper = _mapper || function(issue) {
      return issue.message;
    };
    const fieldErrors = { _errors: [] };
    const processError = (error) => {
      for (const issue of error.issues) {
        if (issue.code === "invalid_union") {
          issue.unionErrors.map(processError);
        } else if (issue.code === "invalid_return_type") {
          processError(issue.returnTypeError);
        } else if (issue.code === "invalid_arguments") {
          processError(issue.argumentsError);
        } else if (issue.path.length === 0) {
          fieldErrors._errors.push(mapper(issue));
        } else {
          let curr = fieldErrors;
          let i = 0;
          while (i < issue.path.length) {
            const el = issue.path[i];
            const terminal = i === issue.path.length - 1;
            if (!terminal) {
              curr[el] = curr[el] || { _errors: [] };
            } else {
              curr[el] = curr[el] || { _errors: [] };
              curr[el]._errors.push(mapper(issue));
            }
            curr = curr[el];
            i++;
          }
        }
      }
    };
    processError(this);
    return fieldErrors;
  }
  static assert(value) {
    if (!(value instanceof _ZodError)) {
      throw new Error(`Not a ZodError: ${value}`);
    }
  }
  toString() {
    return this.message;
  }
  get message() {
    return JSON.stringify(this.issues, util.jsonStringifyReplacer, 2);
  }
  get isEmpty() {
    return this.issues.length === 0;
  }
  flatten(mapper = (issue) => issue.message) {
    const fieldErrors = {};
    const formErrors = [];
    for (const sub of this.issues) {
      if (sub.path.length > 0) {
        const firstEl = sub.path[0];
        fieldErrors[firstEl] = fieldErrors[firstEl] || [];
        fieldErrors[firstEl].push(mapper(sub));
      } else {
        formErrors.push(mapper(sub));
      }
    }
    return { formErrors, fieldErrors };
  }
  get formErrors() {
    return this.flatten();
  }
};
ZodError.create = (issues) => {
  const error = new ZodError(issues);
  return error;
};

// ../../node_modules/zod/v3/locales/en.js
var errorMap = (issue, _ctx) => {
  let message;
  switch (issue.code) {
    case ZodIssueCode.invalid_type:
      if (issue.received === ZodParsedType.undefined) {
        message = "Required";
      } else {
        message = `Expected ${issue.expected}, received ${issue.received}`;
      }
      break;
    case ZodIssueCode.invalid_literal:
      message = `Invalid literal value, expected ${JSON.stringify(issue.expected, util.jsonStringifyReplacer)}`;
      break;
    case ZodIssueCode.unrecognized_keys:
      message = `Unrecognized key(s) in object: ${util.joinValues(issue.keys, ", ")}`;
      break;
    case ZodIssueCode.invalid_union:
      message = `Invalid input`;
      break;
    case ZodIssueCode.invalid_union_discriminator:
      message = `Invalid discriminator value. Expected ${util.joinValues(issue.options)}`;
      break;
    case ZodIssueCode.invalid_enum_value:
      message = `Invalid enum value. Expected ${util.joinValues(issue.options)}, received '${issue.received}'`;
      break;
    case ZodIssueCode.invalid_arguments:
      message = `Invalid function arguments`;
      break;
    case ZodIssueCode.invalid_return_type:
      message = `Invalid function return type`;
      break;
    case ZodIssueCode.invalid_date:
      message = `Invalid date`;
      break;
    case ZodIssueCode.invalid_string:
      if (typeof issue.validation === "object") {
        if ("includes" in issue.validation) {
          message = `Invalid input: must include "${issue.validation.includes}"`;
          if (typeof issue.validation.position === "number") {
            message = `${message} at one or more positions greater than or equal to ${issue.validation.position}`;
          }
        } else if ("startsWith" in issue.validation) {
          message = `Invalid input: must start with "${issue.validation.startsWith}"`;
        } else if ("endsWith" in issue.validation) {
          message = `Invalid input: must end with "${issue.validation.endsWith}"`;
        } else {
          util.assertNever(issue.validation);
        }
      } else if (issue.validation !== "regex") {
        message = `Invalid ${issue.validation}`;
      } else {
        message = "Invalid";
      }
      break;
    case ZodIssueCode.too_small:
      if (issue.type === "array")
        message = `Array must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `more than`} ${issue.minimum} element(s)`;
      else if (issue.type === "string")
        message = `String must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `over`} ${issue.minimum} character(s)`;
      else if (issue.type === "number")
        message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
      else if (issue.type === "bigint")
        message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
      else if (issue.type === "date")
        message = `Date must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${new Date(Number(issue.minimum))}`;
      else
        message = "Invalid input";
      break;
    case ZodIssueCode.too_big:
      if (issue.type === "array")
        message = `Array must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `less than`} ${issue.maximum} element(s)`;
      else if (issue.type === "string")
        message = `String must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `under`} ${issue.maximum} character(s)`;
      else if (issue.type === "number")
        message = `Number must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
      else if (issue.type === "bigint")
        message = `BigInt must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
      else if (issue.type === "date")
        message = `Date must be ${issue.exact ? `exactly` : issue.inclusive ? `smaller than or equal to` : `smaller than`} ${new Date(Number(issue.maximum))}`;
      else
        message = "Invalid input";
      break;
    case ZodIssueCode.custom:
      message = `Invalid input`;
      break;
    case ZodIssueCode.invalid_intersection_types:
      message = `Intersection results could not be merged`;
      break;
    case ZodIssueCode.not_multiple_of:
      message = `Number must be a multiple of ${issue.multipleOf}`;
      break;
    case ZodIssueCode.not_finite:
      message = "Number must be finite";
      break;
    default:
      message = _ctx.defaultError;
      util.assertNever(issue);
  }
  return { message };
};
var en_default = errorMap;

// ../../node_modules/zod/v3/errors.js
var overrideErrorMap = en_default;
function setErrorMap(map) {
  overrideErrorMap = map;
}
function getErrorMap() {
  return overrideErrorMap;
}

// ../../node_modules/zod/v3/helpers/parseUtil.js
var makeIssue = (params) => {
  const { data, path, errorMaps, issueData } = params;
  const fullPath = [...path, ...issueData.path || []];
  const fullIssue = {
    ...issueData,
    path: fullPath
  };
  if (issueData.message !== void 0) {
    return {
      ...issueData,
      path: fullPath,
      message: issueData.message
    };
  }
  let errorMessage = "";
  const maps = errorMaps.filter((m) => !!m).slice().reverse();
  for (const map of maps) {
    errorMessage = map(fullIssue, { data, defaultError: errorMessage }).message;
  }
  return {
    ...issueData,
    path: fullPath,
    message: errorMessage
  };
};
var EMPTY_PATH = [];
function addIssueToContext(ctx, issueData) {
  const overrideMap = getErrorMap();
  const issue = makeIssue({
    issueData,
    data: ctx.data,
    path: ctx.path,
    errorMaps: [
      ctx.common.contextualErrorMap,
      // contextual error map is first priority
      ctx.schemaErrorMap,
      // then schema-bound map if available
      overrideMap,
      // then global override map
      overrideMap === en_default ? void 0 : en_default
      // then global default map
    ].filter((x) => !!x)
  });
  ctx.common.issues.push(issue);
}
var ParseStatus = class _ParseStatus {
  constructor() {
    this.value = "valid";
  }
  dirty() {
    if (this.value === "valid")
      this.value = "dirty";
  }
  abort() {
    if (this.value !== "aborted")
      this.value = "aborted";
  }
  static mergeArray(status, results) {
    const arrayValue = [];
    for (const s of results) {
      if (s.status === "aborted")
        return INVALID;
      if (s.status === "dirty")
        status.dirty();
      arrayValue.push(s.value);
    }
    return { status: status.value, value: arrayValue };
  }
  static async mergeObjectAsync(status, pairs) {
    const syncPairs = [];
    for (const pair of pairs) {
      const key = await pair.key;
      const value = await pair.value;
      syncPairs.push({
        key,
        value
      });
    }
    return _ParseStatus.mergeObjectSync(status, syncPairs);
  }
  static mergeObjectSync(status, pairs) {
    const finalObject = {};
    for (const pair of pairs) {
      const { key, value } = pair;
      if (key.status === "aborted")
        return INVALID;
      if (value.status === "aborted")
        return INVALID;
      if (key.status === "dirty")
        status.dirty();
      if (value.status === "dirty")
        status.dirty();
      if (key.value !== "__proto__" && (typeof value.value !== "undefined" || pair.alwaysSet)) {
        finalObject[key.value] = value.value;
      }
    }
    return { status: status.value, value: finalObject };
  }
};
var INVALID = Object.freeze({
  status: "aborted"
});
var DIRTY = (value) => ({ status: "dirty", value });
var OK = (value) => ({ status: "valid", value });
var isAborted = (x) => x.status === "aborted";
var isDirty = (x) => x.status === "dirty";
var isValid = (x) => x.status === "valid";
var isAsync = (x) => typeof Promise !== "undefined" && x instanceof Promise;

// ../../node_modules/zod/v3/helpers/errorUtil.js
var errorUtil;
(function(errorUtil2) {
  errorUtil2.errToObj = (message) => typeof message === "string" ? { message } : message || {};
  errorUtil2.toString = (message) => typeof message === "string" ? message : message?.message;
})(errorUtil || (errorUtil = {}));

// ../../node_modules/zod/v3/types.js
var ParseInputLazyPath = class {
  constructor(parent, value, path, key) {
    this._cachedPath = [];
    this.parent = parent;
    this.data = value;
    this._path = path;
    this._key = key;
  }
  get path() {
    if (!this._cachedPath.length) {
      if (Array.isArray(this._key)) {
        this._cachedPath.push(...this._path, ...this._key);
      } else {
        this._cachedPath.push(...this._path, this._key);
      }
    }
    return this._cachedPath;
  }
};
var handleResult = (ctx, result) => {
  if (isValid(result)) {
    return { success: true, data: result.value };
  } else {
    if (!ctx.common.issues.length) {
      throw new Error("Validation failed but no issues detected.");
    }
    return {
      success: false,
      get error() {
        if (this._error)
          return this._error;
        const error = new ZodError(ctx.common.issues);
        this._error = error;
        return this._error;
      }
    };
  }
};
function processCreateParams(params) {
  if (!params)
    return {};
  const { errorMap: errorMap2, invalid_type_error, required_error, description } = params;
  if (errorMap2 && (invalid_type_error || required_error)) {
    throw new Error(`Can't use "invalid_type_error" or "required_error" in conjunction with custom error map.`);
  }
  if (errorMap2)
    return { errorMap: errorMap2, description };
  const customMap = (iss, ctx) => {
    const { message } = params;
    if (iss.code === "invalid_enum_value") {
      return { message: message ?? ctx.defaultError };
    }
    if (typeof ctx.data === "undefined") {
      return { message: message ?? required_error ?? ctx.defaultError };
    }
    if (iss.code !== "invalid_type")
      return { message: ctx.defaultError };
    return { message: message ?? invalid_type_error ?? ctx.defaultError };
  };
  return { errorMap: customMap, description };
}
var ZodType = class {
  get description() {
    return this._def.description;
  }
  _getType(input) {
    return getParsedType(input.data);
  }
  _getOrReturnCtx(input, ctx) {
    return ctx || {
      common: input.parent.common,
      data: input.data,
      parsedType: getParsedType(input.data),
      schemaErrorMap: this._def.errorMap,
      path: input.path,
      parent: input.parent
    };
  }
  _processInputParams(input) {
    return {
      status: new ParseStatus(),
      ctx: {
        common: input.parent.common,
        data: input.data,
        parsedType: getParsedType(input.data),
        schemaErrorMap: this._def.errorMap,
        path: input.path,
        parent: input.parent
      }
    };
  }
  _parseSync(input) {
    const result = this._parse(input);
    if (isAsync(result)) {
      throw new Error("Synchronous parse encountered promise.");
    }
    return result;
  }
  _parseAsync(input) {
    const result = this._parse(input);
    return Promise.resolve(result);
  }
  parse(data, params) {
    const result = this.safeParse(data, params);
    if (result.success)
      return result.data;
    throw result.error;
  }
  safeParse(data, params) {
    const ctx = {
      common: {
        issues: [],
        async: params?.async ?? false,
        contextualErrorMap: params?.errorMap
      },
      path: params?.path || [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    const result = this._parseSync({ data, path: ctx.path, parent: ctx });
    return handleResult(ctx, result);
  }
  "~validate"(data) {
    const ctx = {
      common: {
        issues: [],
        async: !!this["~standard"].async
      },
      path: [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    if (!this["~standard"].async) {
      try {
        const result = this._parseSync({ data, path: [], parent: ctx });
        return isValid(result) ? {
          value: result.value
        } : {
          issues: ctx.common.issues
        };
      } catch (err) {
        if (err?.message?.toLowerCase()?.includes("encountered")) {
          this["~standard"].async = true;
        }
        ctx.common = {
          issues: [],
          async: true
        };
      }
    }
    return this._parseAsync({ data, path: [], parent: ctx }).then((result) => isValid(result) ? {
      value: result.value
    } : {
      issues: ctx.common.issues
    });
  }
  async parseAsync(data, params) {
    const result = await this.safeParseAsync(data, params);
    if (result.success)
      return result.data;
    throw result.error;
  }
  async safeParseAsync(data, params) {
    const ctx = {
      common: {
        issues: [],
        contextualErrorMap: params?.errorMap,
        async: true
      },
      path: params?.path || [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    const maybeAsyncResult = this._parse({ data, path: ctx.path, parent: ctx });
    const result = await (isAsync(maybeAsyncResult) ? maybeAsyncResult : Promise.resolve(maybeAsyncResult));
    return handleResult(ctx, result);
  }
  refine(check, message) {
    const getIssueProperties = (val) => {
      if (typeof message === "string" || typeof message === "undefined") {
        return { message };
      } else if (typeof message === "function") {
        return message(val);
      } else {
        return message;
      }
    };
    return this._refinement((val, ctx) => {
      const result = check(val);
      const setError = () => ctx.addIssue({
        code: ZodIssueCode.custom,
        ...getIssueProperties(val)
      });
      if (typeof Promise !== "undefined" && result instanceof Promise) {
        return result.then((data) => {
          if (!data) {
            setError();
            return false;
          } else {
            return true;
          }
        });
      }
      if (!result) {
        setError();
        return false;
      } else {
        return true;
      }
    });
  }
  refinement(check, refinementData) {
    return this._refinement((val, ctx) => {
      if (!check(val)) {
        ctx.addIssue(typeof refinementData === "function" ? refinementData(val, ctx) : refinementData);
        return false;
      } else {
        return true;
      }
    });
  }
  _refinement(refinement) {
    return new ZodEffects({
      schema: this,
      typeName: ZodFirstPartyTypeKind.ZodEffects,
      effect: { type: "refinement", refinement }
    });
  }
  superRefine(refinement) {
    return this._refinement(refinement);
  }
  constructor(def) {
    this.spa = this.safeParseAsync;
    this._def = def;
    this.parse = this.parse.bind(this);
    this.safeParse = this.safeParse.bind(this);
    this.parseAsync = this.parseAsync.bind(this);
    this.safeParseAsync = this.safeParseAsync.bind(this);
    this.spa = this.spa.bind(this);
    this.refine = this.refine.bind(this);
    this.refinement = this.refinement.bind(this);
    this.superRefine = this.superRefine.bind(this);
    this.optional = this.optional.bind(this);
    this.nullable = this.nullable.bind(this);
    this.nullish = this.nullish.bind(this);
    this.array = this.array.bind(this);
    this.promise = this.promise.bind(this);
    this.or = this.or.bind(this);
    this.and = this.and.bind(this);
    this.transform = this.transform.bind(this);
    this.brand = this.brand.bind(this);
    this.default = this.default.bind(this);
    this.catch = this.catch.bind(this);
    this.describe = this.describe.bind(this);
    this.pipe = this.pipe.bind(this);
    this.readonly = this.readonly.bind(this);
    this.isNullable = this.isNullable.bind(this);
    this.isOptional = this.isOptional.bind(this);
    this["~standard"] = {
      version: 1,
      vendor: "zod",
      validate: (data) => this["~validate"](data)
    };
  }
  optional() {
    return ZodOptional.create(this, this._def);
  }
  nullable() {
    return ZodNullable.create(this, this._def);
  }
  nullish() {
    return this.nullable().optional();
  }
  array() {
    return ZodArray.create(this);
  }
  promise() {
    return ZodPromise.create(this, this._def);
  }
  or(option) {
    return ZodUnion.create([this, option], this._def);
  }
  and(incoming) {
    return ZodIntersection.create(this, incoming, this._def);
  }
  transform(transform) {
    return new ZodEffects({
      ...processCreateParams(this._def),
      schema: this,
      typeName: ZodFirstPartyTypeKind.ZodEffects,
      effect: { type: "transform", transform }
    });
  }
  default(def) {
    const defaultValueFunc = typeof def === "function" ? def : () => def;
    return new ZodDefault({
      ...processCreateParams(this._def),
      innerType: this,
      defaultValue: defaultValueFunc,
      typeName: ZodFirstPartyTypeKind.ZodDefault
    });
  }
  brand() {
    return new ZodBranded({
      typeName: ZodFirstPartyTypeKind.ZodBranded,
      type: this,
      ...processCreateParams(this._def)
    });
  }
  catch(def) {
    const catchValueFunc = typeof def === "function" ? def : () => def;
    return new ZodCatch({
      ...processCreateParams(this._def),
      innerType: this,
      catchValue: catchValueFunc,
      typeName: ZodFirstPartyTypeKind.ZodCatch
    });
  }
  describe(description) {
    const This = this.constructor;
    return new This({
      ...this._def,
      description
    });
  }
  pipe(target) {
    return ZodPipeline.create(this, target);
  }
  readonly() {
    return ZodReadonly.create(this);
  }
  isOptional() {
    return this.safeParse(void 0).success;
  }
  isNullable() {
    return this.safeParse(null).success;
  }
};
var cuidRegex = /^c[^\s-]{8,}$/i;
var cuid2Regex = /^[0-9a-z]+$/;
var ulidRegex = /^[0-9A-HJKMNP-TV-Z]{26}$/i;
var uuidRegex = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/i;
var nanoidRegex = /^[a-z0-9_-]{21}$/i;
var jwtRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/;
var durationRegex = /^[-+]?P(?!$)(?:(?:[-+]?\d+Y)|(?:[-+]?\d+[.,]\d+Y$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:(?:[-+]?\d+W)|(?:[-+]?\d+[.,]\d+W$))?(?:(?:[-+]?\d+D)|(?:[-+]?\d+[.,]\d+D$))?(?:T(?=[\d+-])(?:(?:[-+]?\d+H)|(?:[-+]?\d+[.,]\d+H$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:[-+]?\d+(?:[.,]\d+)?S)?)??$/;
var emailRegex = /^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-\.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9\-]*\.)+[A-Z]{2,}$/i;
var _emojiRegex = `^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$`;
var emojiRegex;
var ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/;
var ipv4CidrRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/(3[0-2]|[12]?[0-9])$/;
var ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
var ipv6CidrRegex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/;
var base64Regex = /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/;
var base64urlRegex = /^([0-9a-zA-Z-_]{4})*(([0-9a-zA-Z-_]{2}(==)?)|([0-9a-zA-Z-_]{3}(=)?))?$/;
var dateRegexSource = `((\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-((0[13578]|1[02])-(0[1-9]|[12]\\d|3[01])|(0[469]|11)-(0[1-9]|[12]\\d|30)|(02)-(0[1-9]|1\\d|2[0-8])))`;
var dateRegex = new RegExp(`^${dateRegexSource}$`);
function timeRegexSource(args) {
  let secondsRegexSource = `[0-5]\\d`;
  if (args.precision) {
    secondsRegexSource = `${secondsRegexSource}\\.\\d{${args.precision}}`;
  } else if (args.precision == null) {
    secondsRegexSource = `${secondsRegexSource}(\\.\\d+)?`;
  }
  const secondsQuantifier = args.precision ? "+" : "?";
  return `([01]\\d|2[0-3]):[0-5]\\d(:${secondsRegexSource})${secondsQuantifier}`;
}
function timeRegex(args) {
  return new RegExp(`^${timeRegexSource(args)}$`);
}
function datetimeRegex(args) {
  let regex = `${dateRegexSource}T${timeRegexSource(args)}`;
  const opts = [];
  opts.push(args.local ? `Z?` : `Z`);
  if (args.offset)
    opts.push(`([+-]\\d{2}:?\\d{2})`);
  regex = `${regex}(${opts.join("|")})`;
  return new RegExp(`^${regex}$`);
}
function isValidIP(ip, version) {
  if ((version === "v4" || !version) && ipv4Regex.test(ip)) {
    return true;
  }
  if ((version === "v6" || !version) && ipv6Regex.test(ip)) {
    return true;
  }
  return false;
}
function isValidJWT(jwt, alg) {
  if (!jwtRegex.test(jwt))
    return false;
  try {
    const [header] = jwt.split(".");
    if (!header)
      return false;
    const base64 = header.replace(/-/g, "+").replace(/_/g, "/").padEnd(header.length + (4 - header.length % 4) % 4, "=");
    const decoded = JSON.parse(atob(base64));
    if (typeof decoded !== "object" || decoded === null)
      return false;
    if ("typ" in decoded && decoded?.typ !== "JWT")
      return false;
    if (!decoded.alg)
      return false;
    if (alg && decoded.alg !== alg)
      return false;
    return true;
  } catch {
    return false;
  }
}
function isValidCidr(ip, version) {
  if ((version === "v4" || !version) && ipv4CidrRegex.test(ip)) {
    return true;
  }
  if ((version === "v6" || !version) && ipv6CidrRegex.test(ip)) {
    return true;
  }
  return false;
}
var ZodString = class _ZodString extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = String(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.string) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.string,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    const status = new ParseStatus();
    let ctx = void 0;
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        if (input.data.length < check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            minimum: check.value,
            type: "string",
            inclusive: true,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        if (input.data.length > check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            maximum: check.value,
            type: "string",
            inclusive: true,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "length") {
        const tooBig = input.data.length > check.value;
        const tooSmall = input.data.length < check.value;
        if (tooBig || tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          if (tooBig) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_big,
              maximum: check.value,
              type: "string",
              inclusive: true,
              exact: true,
              message: check.message
            });
          } else if (tooSmall) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_small,
              minimum: check.value,
              type: "string",
              inclusive: true,
              exact: true,
              message: check.message
            });
          }
          status.dirty();
        }
      } else if (check.kind === "email") {
        if (!emailRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "email",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "emoji") {
        if (!emojiRegex) {
          emojiRegex = new RegExp(_emojiRegex, "u");
        }
        if (!emojiRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "emoji",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "uuid") {
        if (!uuidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "uuid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "nanoid") {
        if (!nanoidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "nanoid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cuid") {
        if (!cuidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cuid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cuid2") {
        if (!cuid2Regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cuid2",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "ulid") {
        if (!ulidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "ulid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "url") {
        try {
          new URL(input.data);
        } catch {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "url",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "regex") {
        check.regex.lastIndex = 0;
        const testResult = check.regex.test(input.data);
        if (!testResult) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "regex",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "trim") {
        input.data = input.data.trim();
      } else if (check.kind === "includes") {
        if (!input.data.includes(check.value, check.position)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { includes: check.value, position: check.position },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "toLowerCase") {
        input.data = input.data.toLowerCase();
      } else if (check.kind === "toUpperCase") {
        input.data = input.data.toUpperCase();
      } else if (check.kind === "startsWith") {
        if (!input.data.startsWith(check.value)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { startsWith: check.value },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "endsWith") {
        if (!input.data.endsWith(check.value)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { endsWith: check.value },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "datetime") {
        const regex = datetimeRegex(check);
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "datetime",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "date") {
        const regex = dateRegex;
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "date",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "time") {
        const regex = timeRegex(check);
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "time",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "duration") {
        if (!durationRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "duration",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "ip") {
        if (!isValidIP(input.data, check.version)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "ip",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "jwt") {
        if (!isValidJWT(input.data, check.alg)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "jwt",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cidr") {
        if (!isValidCidr(input.data, check.version)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cidr",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "base64") {
        if (!base64Regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "base64",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "base64url") {
        if (!base64urlRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "base64url",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  _regex(regex, validation, message) {
    return this.refinement((data) => regex.test(data), {
      validation,
      code: ZodIssueCode.invalid_string,
      ...errorUtil.errToObj(message)
    });
  }
  _addCheck(check) {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  email(message) {
    return this._addCheck({ kind: "email", ...errorUtil.errToObj(message) });
  }
  url(message) {
    return this._addCheck({ kind: "url", ...errorUtil.errToObj(message) });
  }
  emoji(message) {
    return this._addCheck({ kind: "emoji", ...errorUtil.errToObj(message) });
  }
  uuid(message) {
    return this._addCheck({ kind: "uuid", ...errorUtil.errToObj(message) });
  }
  nanoid(message) {
    return this._addCheck({ kind: "nanoid", ...errorUtil.errToObj(message) });
  }
  cuid(message) {
    return this._addCheck({ kind: "cuid", ...errorUtil.errToObj(message) });
  }
  cuid2(message) {
    return this._addCheck({ kind: "cuid2", ...errorUtil.errToObj(message) });
  }
  ulid(message) {
    return this._addCheck({ kind: "ulid", ...errorUtil.errToObj(message) });
  }
  base64(message) {
    return this._addCheck({ kind: "base64", ...errorUtil.errToObj(message) });
  }
  base64url(message) {
    return this._addCheck({
      kind: "base64url",
      ...errorUtil.errToObj(message)
    });
  }
  jwt(options) {
    return this._addCheck({ kind: "jwt", ...errorUtil.errToObj(options) });
  }
  ip(options) {
    return this._addCheck({ kind: "ip", ...errorUtil.errToObj(options) });
  }
  cidr(options) {
    return this._addCheck({ kind: "cidr", ...errorUtil.errToObj(options) });
  }
  datetime(options) {
    if (typeof options === "string") {
      return this._addCheck({
        kind: "datetime",
        precision: null,
        offset: false,
        local: false,
        message: options
      });
    }
    return this._addCheck({
      kind: "datetime",
      precision: typeof options?.precision === "undefined" ? null : options?.precision,
      offset: options?.offset ?? false,
      local: options?.local ?? false,
      ...errorUtil.errToObj(options?.message)
    });
  }
  date(message) {
    return this._addCheck({ kind: "date", message });
  }
  time(options) {
    if (typeof options === "string") {
      return this._addCheck({
        kind: "time",
        precision: null,
        message: options
      });
    }
    return this._addCheck({
      kind: "time",
      precision: typeof options?.precision === "undefined" ? null : options?.precision,
      ...errorUtil.errToObj(options?.message)
    });
  }
  duration(message) {
    return this._addCheck({ kind: "duration", ...errorUtil.errToObj(message) });
  }
  regex(regex, message) {
    return this._addCheck({
      kind: "regex",
      regex,
      ...errorUtil.errToObj(message)
    });
  }
  includes(value, options) {
    return this._addCheck({
      kind: "includes",
      value,
      position: options?.position,
      ...errorUtil.errToObj(options?.message)
    });
  }
  startsWith(value, message) {
    return this._addCheck({
      kind: "startsWith",
      value,
      ...errorUtil.errToObj(message)
    });
  }
  endsWith(value, message) {
    return this._addCheck({
      kind: "endsWith",
      value,
      ...errorUtil.errToObj(message)
    });
  }
  min(minLength, message) {
    return this._addCheck({
      kind: "min",
      value: minLength,
      ...errorUtil.errToObj(message)
    });
  }
  max(maxLength, message) {
    return this._addCheck({
      kind: "max",
      value: maxLength,
      ...errorUtil.errToObj(message)
    });
  }
  length(len, message) {
    return this._addCheck({
      kind: "length",
      value: len,
      ...errorUtil.errToObj(message)
    });
  }
  /**
   * Equivalent to `.min(1)`
   */
  nonempty(message) {
    return this.min(1, errorUtil.errToObj(message));
  }
  trim() {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "trim" }]
    });
  }
  toLowerCase() {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "toLowerCase" }]
    });
  }
  toUpperCase() {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "toUpperCase" }]
    });
  }
  get isDatetime() {
    return !!this._def.checks.find((ch) => ch.kind === "datetime");
  }
  get isDate() {
    return !!this._def.checks.find((ch) => ch.kind === "date");
  }
  get isTime() {
    return !!this._def.checks.find((ch) => ch.kind === "time");
  }
  get isDuration() {
    return !!this._def.checks.find((ch) => ch.kind === "duration");
  }
  get isEmail() {
    return !!this._def.checks.find((ch) => ch.kind === "email");
  }
  get isURL() {
    return !!this._def.checks.find((ch) => ch.kind === "url");
  }
  get isEmoji() {
    return !!this._def.checks.find((ch) => ch.kind === "emoji");
  }
  get isUUID() {
    return !!this._def.checks.find((ch) => ch.kind === "uuid");
  }
  get isNANOID() {
    return !!this._def.checks.find((ch) => ch.kind === "nanoid");
  }
  get isCUID() {
    return !!this._def.checks.find((ch) => ch.kind === "cuid");
  }
  get isCUID2() {
    return !!this._def.checks.find((ch) => ch.kind === "cuid2");
  }
  get isULID() {
    return !!this._def.checks.find((ch) => ch.kind === "ulid");
  }
  get isIP() {
    return !!this._def.checks.find((ch) => ch.kind === "ip");
  }
  get isCIDR() {
    return !!this._def.checks.find((ch) => ch.kind === "cidr");
  }
  get isBase64() {
    return !!this._def.checks.find((ch) => ch.kind === "base64");
  }
  get isBase64url() {
    return !!this._def.checks.find((ch) => ch.kind === "base64url");
  }
  get minLength() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxLength() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
};
ZodString.create = (params) => {
  return new ZodString({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodString,
    coerce: params?.coerce ?? false,
    ...processCreateParams(params)
  });
};
function floatSafeRemainder(val, step) {
  const valDecCount = (val.toString().split(".")[1] || "").length;
  const stepDecCount = (step.toString().split(".")[1] || "").length;
  const decCount = valDecCount > stepDecCount ? valDecCount : stepDecCount;
  const valInt = Number.parseInt(val.toFixed(decCount).replace(".", ""));
  const stepInt = Number.parseInt(step.toFixed(decCount).replace(".", ""));
  return valInt % stepInt / 10 ** decCount;
}
var ZodNumber = class _ZodNumber extends ZodType {
  constructor() {
    super(...arguments);
    this.min = this.gte;
    this.max = this.lte;
    this.step = this.multipleOf;
  }
  _parse(input) {
    if (this._def.coerce) {
      input.data = Number(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.number) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.number,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    let ctx = void 0;
    const status = new ParseStatus();
    for (const check of this._def.checks) {
      if (check.kind === "int") {
        if (!util.isInteger(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: "integer",
            received: "float",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "min") {
        const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
        if (tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            minimum: check.value,
            type: "number",
            inclusive: check.inclusive,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
        if (tooBig) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            maximum: check.value,
            type: "number",
            inclusive: check.inclusive,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "multipleOf") {
        if (floatSafeRemainder(input.data, check.value) !== 0) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_multiple_of,
            multipleOf: check.value,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "finite") {
        if (!Number.isFinite(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_finite,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  gte(value, message) {
    return this.setLimit("min", value, true, errorUtil.toString(message));
  }
  gt(value, message) {
    return this.setLimit("min", value, false, errorUtil.toString(message));
  }
  lte(value, message) {
    return this.setLimit("max", value, true, errorUtil.toString(message));
  }
  lt(value, message) {
    return this.setLimit("max", value, false, errorUtil.toString(message));
  }
  setLimit(kind, value, inclusive, message) {
    return new _ZodNumber({
      ...this._def,
      checks: [
        ...this._def.checks,
        {
          kind,
          value,
          inclusive,
          message: errorUtil.toString(message)
        }
      ]
    });
  }
  _addCheck(check) {
    return new _ZodNumber({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  int(message) {
    return this._addCheck({
      kind: "int",
      message: errorUtil.toString(message)
    });
  }
  positive(message) {
    return this._addCheck({
      kind: "min",
      value: 0,
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  negative(message) {
    return this._addCheck({
      kind: "max",
      value: 0,
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  nonpositive(message) {
    return this._addCheck({
      kind: "max",
      value: 0,
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  nonnegative(message) {
    return this._addCheck({
      kind: "min",
      value: 0,
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  multipleOf(value, message) {
    return this._addCheck({
      kind: "multipleOf",
      value,
      message: errorUtil.toString(message)
    });
  }
  finite(message) {
    return this._addCheck({
      kind: "finite",
      message: errorUtil.toString(message)
    });
  }
  safe(message) {
    return this._addCheck({
      kind: "min",
      inclusive: true,
      value: Number.MIN_SAFE_INTEGER,
      message: errorUtil.toString(message)
    })._addCheck({
      kind: "max",
      inclusive: true,
      value: Number.MAX_SAFE_INTEGER,
      message: errorUtil.toString(message)
    });
  }
  get minValue() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxValue() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
  get isInt() {
    return !!this._def.checks.find((ch) => ch.kind === "int" || ch.kind === "multipleOf" && util.isInteger(ch.value));
  }
  get isFinite() {
    let max = null;
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "finite" || ch.kind === "int" || ch.kind === "multipleOf") {
        return true;
      } else if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      } else if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return Number.isFinite(min) && Number.isFinite(max);
  }
};
ZodNumber.create = (params) => {
  return new ZodNumber({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodNumber,
    coerce: params?.coerce || false,
    ...processCreateParams(params)
  });
};
var ZodBigInt = class _ZodBigInt extends ZodType {
  constructor() {
    super(...arguments);
    this.min = this.gte;
    this.max = this.lte;
  }
  _parse(input) {
    if (this._def.coerce) {
      try {
        input.data = BigInt(input.data);
      } catch {
        return this._getInvalidInput(input);
      }
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.bigint) {
      return this._getInvalidInput(input);
    }
    let ctx = void 0;
    const status = new ParseStatus();
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
        if (tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            type: "bigint",
            minimum: check.value,
            inclusive: check.inclusive,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
        if (tooBig) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            type: "bigint",
            maximum: check.value,
            inclusive: check.inclusive,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "multipleOf") {
        if (input.data % check.value !== BigInt(0)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_multiple_of,
            multipleOf: check.value,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  _getInvalidInput(input) {
    const ctx = this._getOrReturnCtx(input);
    addIssueToContext(ctx, {
      code: ZodIssueCode.invalid_type,
      expected: ZodParsedType.bigint,
      received: ctx.parsedType
    });
    return INVALID;
  }
  gte(value, message) {
    return this.setLimit("min", value, true, errorUtil.toString(message));
  }
  gt(value, message) {
    return this.setLimit("min", value, false, errorUtil.toString(message));
  }
  lte(value, message) {
    return this.setLimit("max", value, true, errorUtil.toString(message));
  }
  lt(value, message) {
    return this.setLimit("max", value, false, errorUtil.toString(message));
  }
  setLimit(kind, value, inclusive, message) {
    return new _ZodBigInt({
      ...this._def,
      checks: [
        ...this._def.checks,
        {
          kind,
          value,
          inclusive,
          message: errorUtil.toString(message)
        }
      ]
    });
  }
  _addCheck(check) {
    return new _ZodBigInt({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  positive(message) {
    return this._addCheck({
      kind: "min",
      value: BigInt(0),
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  negative(message) {
    return this._addCheck({
      kind: "max",
      value: BigInt(0),
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  nonpositive(message) {
    return this._addCheck({
      kind: "max",
      value: BigInt(0),
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  nonnegative(message) {
    return this._addCheck({
      kind: "min",
      value: BigInt(0),
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  multipleOf(value, message) {
    return this._addCheck({
      kind: "multipleOf",
      value,
      message: errorUtil.toString(message)
    });
  }
  get minValue() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxValue() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
};
ZodBigInt.create = (params) => {
  return new ZodBigInt({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodBigInt,
    coerce: params?.coerce ?? false,
    ...processCreateParams(params)
  });
};
var ZodBoolean = class extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = Boolean(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.boolean) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.boolean,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodBoolean.create = (params) => {
  return new ZodBoolean({
    typeName: ZodFirstPartyTypeKind.ZodBoolean,
    coerce: params?.coerce || false,
    ...processCreateParams(params)
  });
};
var ZodDate = class _ZodDate extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = new Date(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.date) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.date,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    if (Number.isNaN(input.data.getTime())) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_date
      });
      return INVALID;
    }
    const status = new ParseStatus();
    let ctx = void 0;
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        if (input.data.getTime() < check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            message: check.message,
            inclusive: true,
            exact: false,
            minimum: check.value,
            type: "date"
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        if (input.data.getTime() > check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            message: check.message,
            inclusive: true,
            exact: false,
            maximum: check.value,
            type: "date"
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return {
      status: status.value,
      value: new Date(input.data.getTime())
    };
  }
  _addCheck(check) {
    return new _ZodDate({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  min(minDate, message) {
    return this._addCheck({
      kind: "min",
      value: minDate.getTime(),
      message: errorUtil.toString(message)
    });
  }
  max(maxDate, message) {
    return this._addCheck({
      kind: "max",
      value: maxDate.getTime(),
      message: errorUtil.toString(message)
    });
  }
  get minDate() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min != null ? new Date(min) : null;
  }
  get maxDate() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max != null ? new Date(max) : null;
  }
};
ZodDate.create = (params) => {
  return new ZodDate({
    checks: [],
    coerce: params?.coerce || false,
    typeName: ZodFirstPartyTypeKind.ZodDate,
    ...processCreateParams(params)
  });
};
var ZodSymbol = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.symbol) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.symbol,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodSymbol.create = (params) => {
  return new ZodSymbol({
    typeName: ZodFirstPartyTypeKind.ZodSymbol,
    ...processCreateParams(params)
  });
};
var ZodUndefined = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.undefined) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.undefined,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodUndefined.create = (params) => {
  return new ZodUndefined({
    typeName: ZodFirstPartyTypeKind.ZodUndefined,
    ...processCreateParams(params)
  });
};
var ZodNull = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.null) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.null,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodNull.create = (params) => {
  return new ZodNull({
    typeName: ZodFirstPartyTypeKind.ZodNull,
    ...processCreateParams(params)
  });
};
var ZodAny = class extends ZodType {
  constructor() {
    super(...arguments);
    this._any = true;
  }
  _parse(input) {
    return OK(input.data);
  }
};
ZodAny.create = (params) => {
  return new ZodAny({
    typeName: ZodFirstPartyTypeKind.ZodAny,
    ...processCreateParams(params)
  });
};
var ZodUnknown = class extends ZodType {
  constructor() {
    super(...arguments);
    this._unknown = true;
  }
  _parse(input) {
    return OK(input.data);
  }
};
ZodUnknown.create = (params) => {
  return new ZodUnknown({
    typeName: ZodFirstPartyTypeKind.ZodUnknown,
    ...processCreateParams(params)
  });
};
var ZodNever = class extends ZodType {
  _parse(input) {
    const ctx = this._getOrReturnCtx(input);
    addIssueToContext(ctx, {
      code: ZodIssueCode.invalid_type,
      expected: ZodParsedType.never,
      received: ctx.parsedType
    });
    return INVALID;
  }
};
ZodNever.create = (params) => {
  return new ZodNever({
    typeName: ZodFirstPartyTypeKind.ZodNever,
    ...processCreateParams(params)
  });
};
var ZodVoid = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.undefined) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.void,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodVoid.create = (params) => {
  return new ZodVoid({
    typeName: ZodFirstPartyTypeKind.ZodVoid,
    ...processCreateParams(params)
  });
};
var ZodArray = class _ZodArray extends ZodType {
  _parse(input) {
    const { ctx, status } = this._processInputParams(input);
    const def = this._def;
    if (ctx.parsedType !== ZodParsedType.array) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.array,
        received: ctx.parsedType
      });
      return INVALID;
    }
    if (def.exactLength !== null) {
      const tooBig = ctx.data.length > def.exactLength.value;
      const tooSmall = ctx.data.length < def.exactLength.value;
      if (tooBig || tooSmall) {
        addIssueToContext(ctx, {
          code: tooBig ? ZodIssueCode.too_big : ZodIssueCode.too_small,
          minimum: tooSmall ? def.exactLength.value : void 0,
          maximum: tooBig ? def.exactLength.value : void 0,
          type: "array",
          inclusive: true,
          exact: true,
          message: def.exactLength.message
        });
        status.dirty();
      }
    }
    if (def.minLength !== null) {
      if (ctx.data.length < def.minLength.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_small,
          minimum: def.minLength.value,
          type: "array",
          inclusive: true,
          exact: false,
          message: def.minLength.message
        });
        status.dirty();
      }
    }
    if (def.maxLength !== null) {
      if (ctx.data.length > def.maxLength.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_big,
          maximum: def.maxLength.value,
          type: "array",
          inclusive: true,
          exact: false,
          message: def.maxLength.message
        });
        status.dirty();
      }
    }
    if (ctx.common.async) {
      return Promise.all([...ctx.data].map((item, i) => {
        return def.type._parseAsync(new ParseInputLazyPath(ctx, item, ctx.path, i));
      })).then((result2) => {
        return ParseStatus.mergeArray(status, result2);
      });
    }
    const result = [...ctx.data].map((item, i) => {
      return def.type._parseSync(new ParseInputLazyPath(ctx, item, ctx.path, i));
    });
    return ParseStatus.mergeArray(status, result);
  }
  get element() {
    return this._def.type;
  }
  min(minLength, message) {
    return new _ZodArray({
      ...this._def,
      minLength: { value: minLength, message: errorUtil.toString(message) }
    });
  }
  max(maxLength, message) {
    return new _ZodArray({
      ...this._def,
      maxLength: { value: maxLength, message: errorUtil.toString(message) }
    });
  }
  length(len, message) {
    return new _ZodArray({
      ...this._def,
      exactLength: { value: len, message: errorUtil.toString(message) }
    });
  }
  nonempty(message) {
    return this.min(1, message);
  }
};
ZodArray.create = (schema, params) => {
  return new ZodArray({
    type: schema,
    minLength: null,
    maxLength: null,
    exactLength: null,
    typeName: ZodFirstPartyTypeKind.ZodArray,
    ...processCreateParams(params)
  });
};
function deepPartialify(schema) {
  if (schema instanceof ZodObject) {
    const newShape = {};
    for (const key in schema.shape) {
      const fieldSchema = schema.shape[key];
      newShape[key] = ZodOptional.create(deepPartialify(fieldSchema));
    }
    return new ZodObject({
      ...schema._def,
      shape: () => newShape
    });
  } else if (schema instanceof ZodArray) {
    return new ZodArray({
      ...schema._def,
      type: deepPartialify(schema.element)
    });
  } else if (schema instanceof ZodOptional) {
    return ZodOptional.create(deepPartialify(schema.unwrap()));
  } else if (schema instanceof ZodNullable) {
    return ZodNullable.create(deepPartialify(schema.unwrap()));
  } else if (schema instanceof ZodTuple) {
    return ZodTuple.create(schema.items.map((item) => deepPartialify(item)));
  } else {
    return schema;
  }
}
var ZodObject = class _ZodObject extends ZodType {
  constructor() {
    super(...arguments);
    this._cached = null;
    this.nonstrict = this.passthrough;
    this.augment = this.extend;
  }
  _getCached() {
    if (this._cached !== null)
      return this._cached;
    const shape = this._def.shape();
    const keys = util.objectKeys(shape);
    this._cached = { shape, keys };
    return this._cached;
  }
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.object) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    const { status, ctx } = this._processInputParams(input);
    const { shape, keys: shapeKeys } = this._getCached();
    const extraKeys = [];
    if (!(this._def.catchall instanceof ZodNever && this._def.unknownKeys === "strip")) {
      for (const key in ctx.data) {
        if (!shapeKeys.includes(key)) {
          extraKeys.push(key);
        }
      }
    }
    const pairs = [];
    for (const key of shapeKeys) {
      const keyValidator = shape[key];
      const value = ctx.data[key];
      pairs.push({
        key: { status: "valid", value: key },
        value: keyValidator._parse(new ParseInputLazyPath(ctx, value, ctx.path, key)),
        alwaysSet: key in ctx.data
      });
    }
    if (this._def.catchall instanceof ZodNever) {
      const unknownKeys = this._def.unknownKeys;
      if (unknownKeys === "passthrough") {
        for (const key of extraKeys) {
          pairs.push({
            key: { status: "valid", value: key },
            value: { status: "valid", value: ctx.data[key] }
          });
        }
      } else if (unknownKeys === "strict") {
        if (extraKeys.length > 0) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.unrecognized_keys,
            keys: extraKeys
          });
          status.dirty();
        }
      } else if (unknownKeys === "strip") {
      } else {
        throw new Error(`Internal ZodObject error: invalid unknownKeys value.`);
      }
    } else {
      const catchall = this._def.catchall;
      for (const key of extraKeys) {
        const value = ctx.data[key];
        pairs.push({
          key: { status: "valid", value: key },
          value: catchall._parse(
            new ParseInputLazyPath(ctx, value, ctx.path, key)
            //, ctx.child(key), value, getParsedType(value)
          ),
          alwaysSet: key in ctx.data
        });
      }
    }
    if (ctx.common.async) {
      return Promise.resolve().then(async () => {
        const syncPairs = [];
        for (const pair of pairs) {
          const key = await pair.key;
          const value = await pair.value;
          syncPairs.push({
            key,
            value,
            alwaysSet: pair.alwaysSet
          });
        }
        return syncPairs;
      }).then((syncPairs) => {
        return ParseStatus.mergeObjectSync(status, syncPairs);
      });
    } else {
      return ParseStatus.mergeObjectSync(status, pairs);
    }
  }
  get shape() {
    return this._def.shape();
  }
  strict(message) {
    errorUtil.errToObj;
    return new _ZodObject({
      ...this._def,
      unknownKeys: "strict",
      ...message !== void 0 ? {
        errorMap: (issue, ctx) => {
          const defaultError = this._def.errorMap?.(issue, ctx).message ?? ctx.defaultError;
          if (issue.code === "unrecognized_keys")
            return {
              message: errorUtil.errToObj(message).message ?? defaultError
            };
          return {
            message: defaultError
          };
        }
      } : {}
    });
  }
  strip() {
    return new _ZodObject({
      ...this._def,
      unknownKeys: "strip"
    });
  }
  passthrough() {
    return new _ZodObject({
      ...this._def,
      unknownKeys: "passthrough"
    });
  }
  // const AugmentFactory =
  //   <Def extends ZodObjectDef>(def: Def) =>
  //   <Augmentation extends ZodRawShape>(
  //     augmentation: Augmentation
  //   ): ZodObject<
  //     extendShape<ReturnType<Def["shape"]>, Augmentation>,
  //     Def["unknownKeys"],
  //     Def["catchall"]
  //   > => {
  //     return new ZodObject({
  //       ...def,
  //       shape: () => ({
  //         ...def.shape(),
  //         ...augmentation,
  //       }),
  //     }) as any;
  //   };
  extend(augmentation) {
    return new _ZodObject({
      ...this._def,
      shape: () => ({
        ...this._def.shape(),
        ...augmentation
      })
    });
  }
  /**
   * Prior to zod@1.0.12 there was a bug in the
   * inferred type of merged objects. Please
   * upgrade if you are experiencing issues.
   */
  merge(merging) {
    const merged = new _ZodObject({
      unknownKeys: merging._def.unknownKeys,
      catchall: merging._def.catchall,
      shape: () => ({
        ...this._def.shape(),
        ...merging._def.shape()
      }),
      typeName: ZodFirstPartyTypeKind.ZodObject
    });
    return merged;
  }
  // merge<
  //   Incoming extends AnyZodObject,
  //   Augmentation extends Incoming["shape"],
  //   NewOutput extends {
  //     [k in keyof Augmentation | keyof Output]: k extends keyof Augmentation
  //       ? Augmentation[k]["_output"]
  //       : k extends keyof Output
  //       ? Output[k]
  //       : never;
  //   },
  //   NewInput extends {
  //     [k in keyof Augmentation | keyof Input]: k extends keyof Augmentation
  //       ? Augmentation[k]["_input"]
  //       : k extends keyof Input
  //       ? Input[k]
  //       : never;
  //   }
  // >(
  //   merging: Incoming
  // ): ZodObject<
  //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
  //   Incoming["_def"]["unknownKeys"],
  //   Incoming["_def"]["catchall"],
  //   NewOutput,
  //   NewInput
  // > {
  //   const merged: any = new ZodObject({
  //     unknownKeys: merging._def.unknownKeys,
  //     catchall: merging._def.catchall,
  //     shape: () =>
  //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
  //     typeName: ZodFirstPartyTypeKind.ZodObject,
  //   }) as any;
  //   return merged;
  // }
  setKey(key, schema) {
    return this.augment({ [key]: schema });
  }
  // merge<Incoming extends AnyZodObject>(
  //   merging: Incoming
  // ): //ZodObject<T & Incoming["_shape"], UnknownKeys, Catchall> = (merging) => {
  // ZodObject<
  //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
  //   Incoming["_def"]["unknownKeys"],
  //   Incoming["_def"]["catchall"]
  // > {
  //   // const mergedShape = objectUtil.mergeShapes(
  //   //   this._def.shape(),
  //   //   merging._def.shape()
  //   // );
  //   const merged: any = new ZodObject({
  //     unknownKeys: merging._def.unknownKeys,
  //     catchall: merging._def.catchall,
  //     shape: () =>
  //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
  //     typeName: ZodFirstPartyTypeKind.ZodObject,
  //   }) as any;
  //   return merged;
  // }
  catchall(index) {
    return new _ZodObject({
      ...this._def,
      catchall: index
    });
  }
  pick(mask) {
    const shape = {};
    for (const key of util.objectKeys(mask)) {
      if (mask[key] && this.shape[key]) {
        shape[key] = this.shape[key];
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => shape
    });
  }
  omit(mask) {
    const shape = {};
    for (const key of util.objectKeys(this.shape)) {
      if (!mask[key]) {
        shape[key] = this.shape[key];
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => shape
    });
  }
  /**
   * @deprecated
   */
  deepPartial() {
    return deepPartialify(this);
  }
  partial(mask) {
    const newShape = {};
    for (const key of util.objectKeys(this.shape)) {
      const fieldSchema = this.shape[key];
      if (mask && !mask[key]) {
        newShape[key] = fieldSchema;
      } else {
        newShape[key] = fieldSchema.optional();
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => newShape
    });
  }
  required(mask) {
    const newShape = {};
    for (const key of util.objectKeys(this.shape)) {
      if (mask && !mask[key]) {
        newShape[key] = this.shape[key];
      } else {
        const fieldSchema = this.shape[key];
        let newField = fieldSchema;
        while (newField instanceof ZodOptional) {
          newField = newField._def.innerType;
        }
        newShape[key] = newField;
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => newShape
    });
  }
  keyof() {
    return createZodEnum(util.objectKeys(this.shape));
  }
};
ZodObject.create = (shape, params) => {
  return new ZodObject({
    shape: () => shape,
    unknownKeys: "strip",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
ZodObject.strictCreate = (shape, params) => {
  return new ZodObject({
    shape: () => shape,
    unknownKeys: "strict",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
ZodObject.lazycreate = (shape, params) => {
  return new ZodObject({
    shape,
    unknownKeys: "strip",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
var ZodUnion = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const options = this._def.options;
    function handleResults(results) {
      for (const result of results) {
        if (result.result.status === "valid") {
          return result.result;
        }
      }
      for (const result of results) {
        if (result.result.status === "dirty") {
          ctx.common.issues.push(...result.ctx.common.issues);
          return result.result;
        }
      }
      const unionErrors = results.map((result) => new ZodError(result.ctx.common.issues));
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union,
        unionErrors
      });
      return INVALID;
    }
    if (ctx.common.async) {
      return Promise.all(options.map(async (option) => {
        const childCtx = {
          ...ctx,
          common: {
            ...ctx.common,
            issues: []
          },
          parent: null
        };
        return {
          result: await option._parseAsync({
            data: ctx.data,
            path: ctx.path,
            parent: childCtx
          }),
          ctx: childCtx
        };
      })).then(handleResults);
    } else {
      let dirty = void 0;
      const issues = [];
      for (const option of options) {
        const childCtx = {
          ...ctx,
          common: {
            ...ctx.common,
            issues: []
          },
          parent: null
        };
        const result = option._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: childCtx
        });
        if (result.status === "valid") {
          return result;
        } else if (result.status === "dirty" && !dirty) {
          dirty = { result, ctx: childCtx };
        }
        if (childCtx.common.issues.length) {
          issues.push(childCtx.common.issues);
        }
      }
      if (dirty) {
        ctx.common.issues.push(...dirty.ctx.common.issues);
        return dirty.result;
      }
      const unionErrors = issues.map((issues2) => new ZodError(issues2));
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union,
        unionErrors
      });
      return INVALID;
    }
  }
  get options() {
    return this._def.options;
  }
};
ZodUnion.create = (types, params) => {
  return new ZodUnion({
    options: types,
    typeName: ZodFirstPartyTypeKind.ZodUnion,
    ...processCreateParams(params)
  });
};
var getDiscriminator = (type) => {
  if (type instanceof ZodLazy) {
    return getDiscriminator(type.schema);
  } else if (type instanceof ZodEffects) {
    return getDiscriminator(type.innerType());
  } else if (type instanceof ZodLiteral) {
    return [type.value];
  } else if (type instanceof ZodEnum) {
    return type.options;
  } else if (type instanceof ZodNativeEnum) {
    return util.objectValues(type.enum);
  } else if (type instanceof ZodDefault) {
    return getDiscriminator(type._def.innerType);
  } else if (type instanceof ZodUndefined) {
    return [void 0];
  } else if (type instanceof ZodNull) {
    return [null];
  } else if (type instanceof ZodOptional) {
    return [void 0, ...getDiscriminator(type.unwrap())];
  } else if (type instanceof ZodNullable) {
    return [null, ...getDiscriminator(type.unwrap())];
  } else if (type instanceof ZodBranded) {
    return getDiscriminator(type.unwrap());
  } else if (type instanceof ZodReadonly) {
    return getDiscriminator(type.unwrap());
  } else if (type instanceof ZodCatch) {
    return getDiscriminator(type._def.innerType);
  } else {
    return [];
  }
};
var ZodDiscriminatedUnion = class _ZodDiscriminatedUnion extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.object) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const discriminator = this.discriminator;
    const discriminatorValue = ctx.data[discriminator];
    const option = this.optionsMap.get(discriminatorValue);
    if (!option) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union_discriminator,
        options: Array.from(this.optionsMap.keys()),
        path: [discriminator]
      });
      return INVALID;
    }
    if (ctx.common.async) {
      return option._parseAsync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
    } else {
      return option._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
    }
  }
  get discriminator() {
    return this._def.discriminator;
  }
  get options() {
    return this._def.options;
  }
  get optionsMap() {
    return this._def.optionsMap;
  }
  /**
   * The constructor of the discriminated union schema. Its behaviour is very similar to that of the normal z.union() constructor.
   * However, it only allows a union of objects, all of which need to share a discriminator property. This property must
   * have a different value for each object in the union.
   * @param discriminator the name of the discriminator property
   * @param types an array of object schemas
   * @param params
   */
  static create(discriminator, options, params) {
    const optionsMap = /* @__PURE__ */ new Map();
    for (const type of options) {
      const discriminatorValues = getDiscriminator(type.shape[discriminator]);
      if (!discriminatorValues.length) {
        throw new Error(`A discriminator value for key \`${discriminator}\` could not be extracted from all schema options`);
      }
      for (const value of discriminatorValues) {
        if (optionsMap.has(value)) {
          throw new Error(`Discriminator property ${String(discriminator)} has duplicate value ${String(value)}`);
        }
        optionsMap.set(value, type);
      }
    }
    return new _ZodDiscriminatedUnion({
      typeName: ZodFirstPartyTypeKind.ZodDiscriminatedUnion,
      discriminator,
      options,
      optionsMap,
      ...processCreateParams(params)
    });
  }
};
function mergeValues(a, b) {
  const aType = getParsedType(a);
  const bType = getParsedType(b);
  if (a === b) {
    return { valid: true, data: a };
  } else if (aType === ZodParsedType.object && bType === ZodParsedType.object) {
    const bKeys = util.objectKeys(b);
    const sharedKeys = util.objectKeys(a).filter((key) => bKeys.indexOf(key) !== -1);
    const newObj = { ...a, ...b };
    for (const key of sharedKeys) {
      const sharedValue = mergeValues(a[key], b[key]);
      if (!sharedValue.valid) {
        return { valid: false };
      }
      newObj[key] = sharedValue.data;
    }
    return { valid: true, data: newObj };
  } else if (aType === ZodParsedType.array && bType === ZodParsedType.array) {
    if (a.length !== b.length) {
      return { valid: false };
    }
    const newArray = [];
    for (let index = 0; index < a.length; index++) {
      const itemA = a[index];
      const itemB = b[index];
      const sharedValue = mergeValues(itemA, itemB);
      if (!sharedValue.valid) {
        return { valid: false };
      }
      newArray.push(sharedValue.data);
    }
    return { valid: true, data: newArray };
  } else if (aType === ZodParsedType.date && bType === ZodParsedType.date && +a === +b) {
    return { valid: true, data: a };
  } else {
    return { valid: false };
  }
}
var ZodIntersection = class extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    const handleParsed = (parsedLeft, parsedRight) => {
      if (isAborted(parsedLeft) || isAborted(parsedRight)) {
        return INVALID;
      }
      const merged = mergeValues(parsedLeft.value, parsedRight.value);
      if (!merged.valid) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_intersection_types
        });
        return INVALID;
      }
      if (isDirty(parsedLeft) || isDirty(parsedRight)) {
        status.dirty();
      }
      return { status: status.value, value: merged.data };
    };
    if (ctx.common.async) {
      return Promise.all([
        this._def.left._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        }),
        this._def.right._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        })
      ]).then(([left, right]) => handleParsed(left, right));
    } else {
      return handleParsed(this._def.left._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      }), this._def.right._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      }));
    }
  }
};
ZodIntersection.create = (left, right, params) => {
  return new ZodIntersection({
    left,
    right,
    typeName: ZodFirstPartyTypeKind.ZodIntersection,
    ...processCreateParams(params)
  });
};
var ZodTuple = class _ZodTuple extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.array) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.array,
        received: ctx.parsedType
      });
      return INVALID;
    }
    if (ctx.data.length < this._def.items.length) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.too_small,
        minimum: this._def.items.length,
        inclusive: true,
        exact: false,
        type: "array"
      });
      return INVALID;
    }
    const rest = this._def.rest;
    if (!rest && ctx.data.length > this._def.items.length) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.too_big,
        maximum: this._def.items.length,
        inclusive: true,
        exact: false,
        type: "array"
      });
      status.dirty();
    }
    const items = [...ctx.data].map((item, itemIndex) => {
      const schema = this._def.items[itemIndex] || this._def.rest;
      if (!schema)
        return null;
      return schema._parse(new ParseInputLazyPath(ctx, item, ctx.path, itemIndex));
    }).filter((x) => !!x);
    if (ctx.common.async) {
      return Promise.all(items).then((results) => {
        return ParseStatus.mergeArray(status, results);
      });
    } else {
      return ParseStatus.mergeArray(status, items);
    }
  }
  get items() {
    return this._def.items;
  }
  rest(rest) {
    return new _ZodTuple({
      ...this._def,
      rest
    });
  }
};
ZodTuple.create = (schemas, params) => {
  if (!Array.isArray(schemas)) {
    throw new Error("You must pass an array of schemas to z.tuple([ ... ])");
  }
  return new ZodTuple({
    items: schemas,
    typeName: ZodFirstPartyTypeKind.ZodTuple,
    rest: null,
    ...processCreateParams(params)
  });
};
var ZodRecord = class _ZodRecord extends ZodType {
  get keySchema() {
    return this._def.keyType;
  }
  get valueSchema() {
    return this._def.valueType;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.object) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const pairs = [];
    const keyType = this._def.keyType;
    const valueType = this._def.valueType;
    for (const key in ctx.data) {
      pairs.push({
        key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, key)),
        value: valueType._parse(new ParseInputLazyPath(ctx, ctx.data[key], ctx.path, key)),
        alwaysSet: key in ctx.data
      });
    }
    if (ctx.common.async) {
      return ParseStatus.mergeObjectAsync(status, pairs);
    } else {
      return ParseStatus.mergeObjectSync(status, pairs);
    }
  }
  get element() {
    return this._def.valueType;
  }
  static create(first, second, third) {
    if (second instanceof ZodType) {
      return new _ZodRecord({
        keyType: first,
        valueType: second,
        typeName: ZodFirstPartyTypeKind.ZodRecord,
        ...processCreateParams(third)
      });
    }
    return new _ZodRecord({
      keyType: ZodString.create(),
      valueType: first,
      typeName: ZodFirstPartyTypeKind.ZodRecord,
      ...processCreateParams(second)
    });
  }
};
var ZodMap = class extends ZodType {
  get keySchema() {
    return this._def.keyType;
  }
  get valueSchema() {
    return this._def.valueType;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.map) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.map,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const keyType = this._def.keyType;
    const valueType = this._def.valueType;
    const pairs = [...ctx.data.entries()].map(([key, value], index) => {
      return {
        key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, [index, "key"])),
        value: valueType._parse(new ParseInputLazyPath(ctx, value, ctx.path, [index, "value"]))
      };
    });
    if (ctx.common.async) {
      const finalMap = /* @__PURE__ */ new Map();
      return Promise.resolve().then(async () => {
        for (const pair of pairs) {
          const key = await pair.key;
          const value = await pair.value;
          if (key.status === "aborted" || value.status === "aborted") {
            return INVALID;
          }
          if (key.status === "dirty" || value.status === "dirty") {
            status.dirty();
          }
          finalMap.set(key.value, value.value);
        }
        return { status: status.value, value: finalMap };
      });
    } else {
      const finalMap = /* @__PURE__ */ new Map();
      for (const pair of pairs) {
        const key = pair.key;
        const value = pair.value;
        if (key.status === "aborted" || value.status === "aborted") {
          return INVALID;
        }
        if (key.status === "dirty" || value.status === "dirty") {
          status.dirty();
        }
        finalMap.set(key.value, value.value);
      }
      return { status: status.value, value: finalMap };
    }
  }
};
ZodMap.create = (keyType, valueType, params) => {
  return new ZodMap({
    valueType,
    keyType,
    typeName: ZodFirstPartyTypeKind.ZodMap,
    ...processCreateParams(params)
  });
};
var ZodSet = class _ZodSet extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.set) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.set,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const def = this._def;
    if (def.minSize !== null) {
      if (ctx.data.size < def.minSize.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_small,
          minimum: def.minSize.value,
          type: "set",
          inclusive: true,
          exact: false,
          message: def.minSize.message
        });
        status.dirty();
      }
    }
    if (def.maxSize !== null) {
      if (ctx.data.size > def.maxSize.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_big,
          maximum: def.maxSize.value,
          type: "set",
          inclusive: true,
          exact: false,
          message: def.maxSize.message
        });
        status.dirty();
      }
    }
    const valueType = this._def.valueType;
    function finalizeSet(elements2) {
      const parsedSet = /* @__PURE__ */ new Set();
      for (const element of elements2) {
        if (element.status === "aborted")
          return INVALID;
        if (element.status === "dirty")
          status.dirty();
        parsedSet.add(element.value);
      }
      return { status: status.value, value: parsedSet };
    }
    const elements = [...ctx.data.values()].map((item, i) => valueType._parse(new ParseInputLazyPath(ctx, item, ctx.path, i)));
    if (ctx.common.async) {
      return Promise.all(elements).then((elements2) => finalizeSet(elements2));
    } else {
      return finalizeSet(elements);
    }
  }
  min(minSize, message) {
    return new _ZodSet({
      ...this._def,
      minSize: { value: minSize, message: errorUtil.toString(message) }
    });
  }
  max(maxSize, message) {
    return new _ZodSet({
      ...this._def,
      maxSize: { value: maxSize, message: errorUtil.toString(message) }
    });
  }
  size(size, message) {
    return this.min(size, message).max(size, message);
  }
  nonempty(message) {
    return this.min(1, message);
  }
};
ZodSet.create = (valueType, params) => {
  return new ZodSet({
    valueType,
    minSize: null,
    maxSize: null,
    typeName: ZodFirstPartyTypeKind.ZodSet,
    ...processCreateParams(params)
  });
};
var ZodFunction = class _ZodFunction extends ZodType {
  constructor() {
    super(...arguments);
    this.validate = this.implement;
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.function) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.function,
        received: ctx.parsedType
      });
      return INVALID;
    }
    function makeArgsIssue(args, error) {
      return makeIssue({
        data: args,
        path: ctx.path,
        errorMaps: [ctx.common.contextualErrorMap, ctx.schemaErrorMap, getErrorMap(), en_default].filter((x) => !!x),
        issueData: {
          code: ZodIssueCode.invalid_arguments,
          argumentsError: error
        }
      });
    }
    function makeReturnsIssue(returns, error) {
      return makeIssue({
        data: returns,
        path: ctx.path,
        errorMaps: [ctx.common.contextualErrorMap, ctx.schemaErrorMap, getErrorMap(), en_default].filter((x) => !!x),
        issueData: {
          code: ZodIssueCode.invalid_return_type,
          returnTypeError: error
        }
      });
    }
    const params = { errorMap: ctx.common.contextualErrorMap };
    const fn = ctx.data;
    if (this._def.returns instanceof ZodPromise) {
      const me = this;
      return OK(async function(...args) {
        const error = new ZodError([]);
        const parsedArgs = await me._def.args.parseAsync(args, params).catch((e) => {
          error.addIssue(makeArgsIssue(args, e));
          throw error;
        });
        const result = await Reflect.apply(fn, this, parsedArgs);
        const parsedReturns = await me._def.returns._def.type.parseAsync(result, params).catch((e) => {
          error.addIssue(makeReturnsIssue(result, e));
          throw error;
        });
        return parsedReturns;
      });
    } else {
      const me = this;
      return OK(function(...args) {
        const parsedArgs = me._def.args.safeParse(args, params);
        if (!parsedArgs.success) {
          throw new ZodError([makeArgsIssue(args, parsedArgs.error)]);
        }
        const result = Reflect.apply(fn, this, parsedArgs.data);
        const parsedReturns = me._def.returns.safeParse(result, params);
        if (!parsedReturns.success) {
          throw new ZodError([makeReturnsIssue(result, parsedReturns.error)]);
        }
        return parsedReturns.data;
      });
    }
  }
  parameters() {
    return this._def.args;
  }
  returnType() {
    return this._def.returns;
  }
  args(...items) {
    return new _ZodFunction({
      ...this._def,
      args: ZodTuple.create(items).rest(ZodUnknown.create())
    });
  }
  returns(returnType) {
    return new _ZodFunction({
      ...this._def,
      returns: returnType
    });
  }
  implement(func) {
    const validatedFunc = this.parse(func);
    return validatedFunc;
  }
  strictImplement(func) {
    const validatedFunc = this.parse(func);
    return validatedFunc;
  }
  static create(args, returns, params) {
    return new _ZodFunction({
      args: args ? args : ZodTuple.create([]).rest(ZodUnknown.create()),
      returns: returns || ZodUnknown.create(),
      typeName: ZodFirstPartyTypeKind.ZodFunction,
      ...processCreateParams(params)
    });
  }
};
var ZodLazy = class extends ZodType {
  get schema() {
    return this._def.getter();
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const lazySchema = this._def.getter();
    return lazySchema._parse({ data: ctx.data, path: ctx.path, parent: ctx });
  }
};
ZodLazy.create = (getter, params) => {
  return new ZodLazy({
    getter,
    typeName: ZodFirstPartyTypeKind.ZodLazy,
    ...processCreateParams(params)
  });
};
var ZodLiteral = class extends ZodType {
  _parse(input) {
    if (input.data !== this._def.value) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_literal,
        expected: this._def.value
      });
      return INVALID;
    }
    return { status: "valid", value: input.data };
  }
  get value() {
    return this._def.value;
  }
};
ZodLiteral.create = (value, params) => {
  return new ZodLiteral({
    value,
    typeName: ZodFirstPartyTypeKind.ZodLiteral,
    ...processCreateParams(params)
  });
};
function createZodEnum(values, params) {
  return new ZodEnum({
    values,
    typeName: ZodFirstPartyTypeKind.ZodEnum,
    ...processCreateParams(params)
  });
}
var ZodEnum = class _ZodEnum extends ZodType {
  _parse(input) {
    if (typeof input.data !== "string") {
      const ctx = this._getOrReturnCtx(input);
      const expectedValues = this._def.values;
      addIssueToContext(ctx, {
        expected: util.joinValues(expectedValues),
        received: ctx.parsedType,
        code: ZodIssueCode.invalid_type
      });
      return INVALID;
    }
    if (!this._cache) {
      this._cache = new Set(this._def.values);
    }
    if (!this._cache.has(input.data)) {
      const ctx = this._getOrReturnCtx(input);
      const expectedValues = this._def.values;
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_enum_value,
        options: expectedValues
      });
      return INVALID;
    }
    return OK(input.data);
  }
  get options() {
    return this._def.values;
  }
  get enum() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  get Values() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  get Enum() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  extract(values, newDef = this._def) {
    return _ZodEnum.create(values, {
      ...this._def,
      ...newDef
    });
  }
  exclude(values, newDef = this._def) {
    return _ZodEnum.create(this.options.filter((opt) => !values.includes(opt)), {
      ...this._def,
      ...newDef
    });
  }
};
ZodEnum.create = createZodEnum;
var ZodNativeEnum = class extends ZodType {
  _parse(input) {
    const nativeEnumValues = util.getValidEnumValues(this._def.values);
    const ctx = this._getOrReturnCtx(input);
    if (ctx.parsedType !== ZodParsedType.string && ctx.parsedType !== ZodParsedType.number) {
      const expectedValues = util.objectValues(nativeEnumValues);
      addIssueToContext(ctx, {
        expected: util.joinValues(expectedValues),
        received: ctx.parsedType,
        code: ZodIssueCode.invalid_type
      });
      return INVALID;
    }
    if (!this._cache) {
      this._cache = new Set(util.getValidEnumValues(this._def.values));
    }
    if (!this._cache.has(input.data)) {
      const expectedValues = util.objectValues(nativeEnumValues);
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_enum_value,
        options: expectedValues
      });
      return INVALID;
    }
    return OK(input.data);
  }
  get enum() {
    return this._def.values;
  }
};
ZodNativeEnum.create = (values, params) => {
  return new ZodNativeEnum({
    values,
    typeName: ZodFirstPartyTypeKind.ZodNativeEnum,
    ...processCreateParams(params)
  });
};
var ZodPromise = class extends ZodType {
  unwrap() {
    return this._def.type;
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.promise && ctx.common.async === false) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.promise,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const promisified = ctx.parsedType === ZodParsedType.promise ? ctx.data : Promise.resolve(ctx.data);
    return OK(promisified.then((data) => {
      return this._def.type.parseAsync(data, {
        path: ctx.path,
        errorMap: ctx.common.contextualErrorMap
      });
    }));
  }
};
ZodPromise.create = (schema, params) => {
  return new ZodPromise({
    type: schema,
    typeName: ZodFirstPartyTypeKind.ZodPromise,
    ...processCreateParams(params)
  });
};
var ZodEffects = class extends ZodType {
  innerType() {
    return this._def.schema;
  }
  sourceType() {
    return this._def.schema._def.typeName === ZodFirstPartyTypeKind.ZodEffects ? this._def.schema.sourceType() : this._def.schema;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    const effect = this._def.effect || null;
    const checkCtx = {
      addIssue: (arg) => {
        addIssueToContext(ctx, arg);
        if (arg.fatal) {
          status.abort();
        } else {
          status.dirty();
        }
      },
      get path() {
        return ctx.path;
      }
    };
    checkCtx.addIssue = checkCtx.addIssue.bind(checkCtx);
    if (effect.type === "preprocess") {
      const processed = effect.transform(ctx.data, checkCtx);
      if (ctx.common.async) {
        return Promise.resolve(processed).then(async (processed2) => {
          if (status.value === "aborted")
            return INVALID;
          const result = await this._def.schema._parseAsync({
            data: processed2,
            path: ctx.path,
            parent: ctx
          });
          if (result.status === "aborted")
            return INVALID;
          if (result.status === "dirty")
            return DIRTY(result.value);
          if (status.value === "dirty")
            return DIRTY(result.value);
          return result;
        });
      } else {
        if (status.value === "aborted")
          return INVALID;
        const result = this._def.schema._parseSync({
          data: processed,
          path: ctx.path,
          parent: ctx
        });
        if (result.status === "aborted")
          return INVALID;
        if (result.status === "dirty")
          return DIRTY(result.value);
        if (status.value === "dirty")
          return DIRTY(result.value);
        return result;
      }
    }
    if (effect.type === "refinement") {
      const executeRefinement = (acc) => {
        const result = effect.refinement(acc, checkCtx);
        if (ctx.common.async) {
          return Promise.resolve(result);
        }
        if (result instanceof Promise) {
          throw new Error("Async refinement encountered during synchronous parse operation. Use .parseAsync instead.");
        }
        return acc;
      };
      if (ctx.common.async === false) {
        const inner = this._def.schema._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (inner.status === "aborted")
          return INVALID;
        if (inner.status === "dirty")
          status.dirty();
        executeRefinement(inner.value);
        return { status: status.value, value: inner.value };
      } else {
        return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((inner) => {
          if (inner.status === "aborted")
            return INVALID;
          if (inner.status === "dirty")
            status.dirty();
          return executeRefinement(inner.value).then(() => {
            return { status: status.value, value: inner.value };
          });
        });
      }
    }
    if (effect.type === "transform") {
      if (ctx.common.async === false) {
        const base = this._def.schema._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (!isValid(base))
          return INVALID;
        const result = effect.transform(base.value, checkCtx);
        if (result instanceof Promise) {
          throw new Error(`Asynchronous transform encountered during synchronous parse operation. Use .parseAsync instead.`);
        }
        return { status: status.value, value: result };
      } else {
        return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((base) => {
          if (!isValid(base))
            return INVALID;
          return Promise.resolve(effect.transform(base.value, checkCtx)).then((result) => ({
            status: status.value,
            value: result
          }));
        });
      }
    }
    util.assertNever(effect);
  }
};
ZodEffects.create = (schema, effect, params) => {
  return new ZodEffects({
    schema,
    typeName: ZodFirstPartyTypeKind.ZodEffects,
    effect,
    ...processCreateParams(params)
  });
};
ZodEffects.createWithPreprocess = (preprocess, schema, params) => {
  return new ZodEffects({
    schema,
    effect: { type: "preprocess", transform: preprocess },
    typeName: ZodFirstPartyTypeKind.ZodEffects,
    ...processCreateParams(params)
  });
};
var ZodOptional = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType === ZodParsedType.undefined) {
      return OK(void 0);
    }
    return this._def.innerType._parse(input);
  }
  unwrap() {
    return this._def.innerType;
  }
};
ZodOptional.create = (type, params) => {
  return new ZodOptional({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodOptional,
    ...processCreateParams(params)
  });
};
var ZodNullable = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType === ZodParsedType.null) {
      return OK(null);
    }
    return this._def.innerType._parse(input);
  }
  unwrap() {
    return this._def.innerType;
  }
};
ZodNullable.create = (type, params) => {
  return new ZodNullable({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodNullable,
    ...processCreateParams(params)
  });
};
var ZodDefault = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    let data = ctx.data;
    if (ctx.parsedType === ZodParsedType.undefined) {
      data = this._def.defaultValue();
    }
    return this._def.innerType._parse({
      data,
      path: ctx.path,
      parent: ctx
    });
  }
  removeDefault() {
    return this._def.innerType;
  }
};
ZodDefault.create = (type, params) => {
  return new ZodDefault({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodDefault,
    defaultValue: typeof params.default === "function" ? params.default : () => params.default,
    ...processCreateParams(params)
  });
};
var ZodCatch = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const newCtx = {
      ...ctx,
      common: {
        ...ctx.common,
        issues: []
      }
    };
    const result = this._def.innerType._parse({
      data: newCtx.data,
      path: newCtx.path,
      parent: {
        ...newCtx
      }
    });
    if (isAsync(result)) {
      return result.then((result2) => {
        return {
          status: "valid",
          value: result2.status === "valid" ? result2.value : this._def.catchValue({
            get error() {
              return new ZodError(newCtx.common.issues);
            },
            input: newCtx.data
          })
        };
      });
    } else {
      return {
        status: "valid",
        value: result.status === "valid" ? result.value : this._def.catchValue({
          get error() {
            return new ZodError(newCtx.common.issues);
          },
          input: newCtx.data
        })
      };
    }
  }
  removeCatch() {
    return this._def.innerType;
  }
};
ZodCatch.create = (type, params) => {
  return new ZodCatch({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodCatch,
    catchValue: typeof params.catch === "function" ? params.catch : () => params.catch,
    ...processCreateParams(params)
  });
};
var ZodNaN = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.nan) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.nan,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return { status: "valid", value: input.data };
  }
};
ZodNaN.create = (params) => {
  return new ZodNaN({
    typeName: ZodFirstPartyTypeKind.ZodNaN,
    ...processCreateParams(params)
  });
};
var BRAND = /* @__PURE__ */ Symbol("zod_brand");
var ZodBranded = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const data = ctx.data;
    return this._def.type._parse({
      data,
      path: ctx.path,
      parent: ctx
    });
  }
  unwrap() {
    return this._def.type;
  }
};
var ZodPipeline = class _ZodPipeline extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.common.async) {
      const handleAsync = async () => {
        const inResult = await this._def.in._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (inResult.status === "aborted")
          return INVALID;
        if (inResult.status === "dirty") {
          status.dirty();
          return DIRTY(inResult.value);
        } else {
          return this._def.out._parseAsync({
            data: inResult.value,
            path: ctx.path,
            parent: ctx
          });
        }
      };
      return handleAsync();
    } else {
      const inResult = this._def.in._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
      if (inResult.status === "aborted")
        return INVALID;
      if (inResult.status === "dirty") {
        status.dirty();
        return {
          status: "dirty",
          value: inResult.value
        };
      } else {
        return this._def.out._parseSync({
          data: inResult.value,
          path: ctx.path,
          parent: ctx
        });
      }
    }
  }
  static create(a, b) {
    return new _ZodPipeline({
      in: a,
      out: b,
      typeName: ZodFirstPartyTypeKind.ZodPipeline
    });
  }
};
var ZodReadonly = class extends ZodType {
  _parse(input) {
    const result = this._def.innerType._parse(input);
    const freeze = (data) => {
      if (isValid(data)) {
        data.value = Object.freeze(data.value);
      }
      return data;
    };
    return isAsync(result) ? result.then((data) => freeze(data)) : freeze(result);
  }
  unwrap() {
    return this._def.innerType;
  }
};
ZodReadonly.create = (type, params) => {
  return new ZodReadonly({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodReadonly,
    ...processCreateParams(params)
  });
};
function cleanParams(params, data) {
  const p = typeof params === "function" ? params(data) : typeof params === "string" ? { message: params } : params;
  const p2 = typeof p === "string" ? { message: p } : p;
  return p2;
}
function custom(check, _params = {}, fatal) {
  if (check)
    return ZodAny.create().superRefine((data, ctx) => {
      const r = check(data);
      if (r instanceof Promise) {
        return r.then((r2) => {
          if (!r2) {
            const params = cleanParams(_params, data);
            const _fatal = params.fatal ?? fatal ?? true;
            ctx.addIssue({ code: "custom", ...params, fatal: _fatal });
          }
        });
      }
      if (!r) {
        const params = cleanParams(_params, data);
        const _fatal = params.fatal ?? fatal ?? true;
        ctx.addIssue({ code: "custom", ...params, fatal: _fatal });
      }
      return;
    });
  return ZodAny.create();
}
var late = {
  object: ZodObject.lazycreate
};
var ZodFirstPartyTypeKind;
(function(ZodFirstPartyTypeKind2) {
  ZodFirstPartyTypeKind2["ZodString"] = "ZodString";
  ZodFirstPartyTypeKind2["ZodNumber"] = "ZodNumber";
  ZodFirstPartyTypeKind2["ZodNaN"] = "ZodNaN";
  ZodFirstPartyTypeKind2["ZodBigInt"] = "ZodBigInt";
  ZodFirstPartyTypeKind2["ZodBoolean"] = "ZodBoolean";
  ZodFirstPartyTypeKind2["ZodDate"] = "ZodDate";
  ZodFirstPartyTypeKind2["ZodSymbol"] = "ZodSymbol";
  ZodFirstPartyTypeKind2["ZodUndefined"] = "ZodUndefined";
  ZodFirstPartyTypeKind2["ZodNull"] = "ZodNull";
  ZodFirstPartyTypeKind2["ZodAny"] = "ZodAny";
  ZodFirstPartyTypeKind2["ZodUnknown"] = "ZodUnknown";
  ZodFirstPartyTypeKind2["ZodNever"] = "ZodNever";
  ZodFirstPartyTypeKind2["ZodVoid"] = "ZodVoid";
  ZodFirstPartyTypeKind2["ZodArray"] = "ZodArray";
  ZodFirstPartyTypeKind2["ZodObject"] = "ZodObject";
  ZodFirstPartyTypeKind2["ZodUnion"] = "ZodUnion";
  ZodFirstPartyTypeKind2["ZodDiscriminatedUnion"] = "ZodDiscriminatedUnion";
  ZodFirstPartyTypeKind2["ZodIntersection"] = "ZodIntersection";
  ZodFirstPartyTypeKind2["ZodTuple"] = "ZodTuple";
  ZodFirstPartyTypeKind2["ZodRecord"] = "ZodRecord";
  ZodFirstPartyTypeKind2["ZodMap"] = "ZodMap";
  ZodFirstPartyTypeKind2["ZodSet"] = "ZodSet";
  ZodFirstPartyTypeKind2["ZodFunction"] = "ZodFunction";
  ZodFirstPartyTypeKind2["ZodLazy"] = "ZodLazy";
  ZodFirstPartyTypeKind2["ZodLiteral"] = "ZodLiteral";
  ZodFirstPartyTypeKind2["ZodEnum"] = "ZodEnum";
  ZodFirstPartyTypeKind2["ZodEffects"] = "ZodEffects";
  ZodFirstPartyTypeKind2["ZodNativeEnum"] = "ZodNativeEnum";
  ZodFirstPartyTypeKind2["ZodOptional"] = "ZodOptional";
  ZodFirstPartyTypeKind2["ZodNullable"] = "ZodNullable";
  ZodFirstPartyTypeKind2["ZodDefault"] = "ZodDefault";
  ZodFirstPartyTypeKind2["ZodCatch"] = "ZodCatch";
  ZodFirstPartyTypeKind2["ZodPromise"] = "ZodPromise";
  ZodFirstPartyTypeKind2["ZodBranded"] = "ZodBranded";
  ZodFirstPartyTypeKind2["ZodPipeline"] = "ZodPipeline";
  ZodFirstPartyTypeKind2["ZodReadonly"] = "ZodReadonly";
})(ZodFirstPartyTypeKind || (ZodFirstPartyTypeKind = {}));
var instanceOfType = (cls, params = {
  message: `Input not instance of ${cls.name}`
}) => custom((data) => data instanceof cls, params);
var stringType = ZodString.create;
var numberType = ZodNumber.create;
var nanType = ZodNaN.create;
var bigIntType = ZodBigInt.create;
var booleanType = ZodBoolean.create;
var dateType = ZodDate.create;
var symbolType = ZodSymbol.create;
var undefinedType = ZodUndefined.create;
var nullType = ZodNull.create;
var anyType = ZodAny.create;
var unknownType = ZodUnknown.create;
var neverType = ZodNever.create;
var voidType = ZodVoid.create;
var arrayType = ZodArray.create;
var objectType = ZodObject.create;
var strictObjectType = ZodObject.strictCreate;
var unionType = ZodUnion.create;
var discriminatedUnionType = ZodDiscriminatedUnion.create;
var intersectionType = ZodIntersection.create;
var tupleType = ZodTuple.create;
var recordType = ZodRecord.create;
var mapType = ZodMap.create;
var setType = ZodSet.create;
var functionType = ZodFunction.create;
var lazyType = ZodLazy.create;
var literalType = ZodLiteral.create;
var enumType = ZodEnum.create;
var nativeEnumType = ZodNativeEnum.create;
var promiseType = ZodPromise.create;
var effectsType = ZodEffects.create;
var optionalType = ZodOptional.create;
var nullableType = ZodNullable.create;
var preprocessType = ZodEffects.createWithPreprocess;
var pipelineType = ZodPipeline.create;
var ostring = () => stringType().optional();
var onumber = () => numberType().optional();
var oboolean = () => booleanType().optional();
var coerce = {
  string: ((arg) => ZodString.create({ ...arg, coerce: true })),
  number: ((arg) => ZodNumber.create({ ...arg, coerce: true })),
  boolean: ((arg) => ZodBoolean.create({
    ...arg,
    coerce: true
  })),
  bigint: ((arg) => ZodBigInt.create({ ...arg, coerce: true })),
  date: ((arg) => ZodDate.create({ ...arg, coerce: true }))
};
var NEVER = INVALID;

// ../../packages/schema/src/index.ts
var positionSchema = external_exports.object({
  x: external_exports.number(),
  y: external_exports.number()
});
var agentParametersSchema = external_exports.object({
  temperature: external_exports.number().min(0).max(2).optional(),
  topP: external_exports.number().min(0).max(1).optional(),
  maxTokens: external_exports.union([external_exports.number().int().positive(), external_exports.literal(-1), external_exports.null()]).optional(),
  reasoningLevel: external_exports.string().optional(),
  reasoningBudget: external_exports.number().int().min(-1).optional(),
  topK: external_exports.number().int().nonnegative().optional(),
  presencePenalty: external_exports.number().min(-2).max(2).optional(),
  frequencyPenalty: external_exports.number().min(-2).max(2).optional(),
  seed: external_exports.number().int().optional(),
  stopSequences: external_exports.array(external_exports.string().min(1)).max(4).optional(),
  verbosity: external_exports.enum(["low", "medium", "high"]).optional(),
  customParameters: external_exports.record(external_exports.string(), external_exports.unknown()).optional()
});
var inputItemSchema = external_exports.object({
  id: external_exports.string().min(1),
  name: external_exports.string().min(1),
  kind: external_exports.enum(["text", "file"]),
  mode: external_exports.enum(["text", "attachment"]),
  mimeType: external_exports.string().optional(),
  size: external_exports.number().int().nonnegative().optional(),
  content: external_exports.string(),
  dataBase64: external_exports.string().optional(),
  hidden: external_exports.boolean().optional(),
  workspacePath: external_exports.string().refine((value) => !/^[\\/]/.test(value) && !/^[A-Za-z]:/.test(value) && !/(?:^|[\\/])\.\.(?:[\\/]|$)/.test(value), "Input file path must stay inside the workspace").optional()
});
var inputNodeSchema = external_exports.object({
  type: external_exports.literal("input"),
  name: external_exports.string().min(1),
  items: external_exports.array(inputItemSchema).default([]),
  executionMode: external_exports.enum(["all", "for-each"]).optional(),
  orderMode: external_exports.enum(["name", "manual"]).optional(),
  position: positionSchema.optional()
});
var agentPromptSchema = external_exports.object({
  content: external_exports.string(),
  customized: external_exports.boolean().default(false),
  locked: external_exports.boolean().default(false)
});
var agentPromptsSchema = external_exports.object({
  system: agentPromptSchema,
  input: agentPromptSchema,
  output: agentPromptSchema
});
var workspaceRelativePathSchema = external_exports.string().min(1).refine(
  (value) => !/^[\\/]/.test(value) && !/^[A-Za-z]:[\\/]/.test(value) && !/(?:^|[\\/])\.\.(?:[\\/]|$)/.test(value),
  "Output path must stay inside the workspace"
);
var outputNodeSchema = external_exports.object({
  type: external_exports.literal("output"),
  name: external_exports.string().min(1),
  ownerAgentId: external_exports.string().min(1),
  directory: workspaceRelativePathSchema,
  note: external_exports.string().default(""),
  extractText: external_exports.boolean().default(true),
  fileStates: external_exports.record(external_exports.string(), external_exports.record(external_exports.string(), external_exports.enum(["hidden", "detached"]))).optional(),
  position: positionSchema.optional()
});
var agentNodeSchema = external_exports.object({
  type: external_exports.literal("agent"),
  name: external_exports.string().min(1),
  nameCustomized: external_exports.boolean().optional(),
  provider: external_exports.string().min(1),
  model: external_exports.string().min(1),
  parameters: agentParametersSchema.optional(),
  prompts: agentPromptsSchema,
  position: positionSchema.optional()
});
var graphNodeSchema = external_exports.discriminatedUnion("type", [
  inputNodeSchema,
  agentNodeSchema,
  outputNodeSchema
]);
var graphGroupSchema = external_exports.object({
  id: external_exports.string().min(1),
  name: external_exports.string().min(1),
  nodeIds: external_exports.array(external_exports.string().min(1)).min(2).refine(
    (nodeIds) => new Set(nodeIds).size === nodeIds.length,
    "Group nodes must be unique"
  )
});
var linkRelationSchema = external_exports.enum([
  "input",
  "pass",
  "review",
  "revise",
  "merge"
]);
var singleLinkRelationSchema = external_exports.enum([
  "input",
  "pass",
  "review",
  "revise"
]);
var singleLinkSchema = external_exports.object({
  id: external_exports.string().min(1),
  sourceId: external_exports.string().min(1),
  targetId: external_exports.string().min(1),
  type: singleLinkRelationSchema
});
var mergeLinkSchema = external_exports.object({
  id: external_exports.string().min(1),
  sourceIds: external_exports.array(external_exports.string().min(1)).min(2).refine(
    (sourceIds) => new Set(sourceIds).size === sourceIds.length,
    "Merge sources must be unique"
  ),
  targetId: external_exports.string().min(1),
  type: external_exports.literal("merge")
});
var linkSchema = external_exports.union([singleLinkSchema, mergeLinkSchema]);
var workspaceBindingSchema = external_exports.discriminatedUnion("mode", [
  external_exports.object({
    mode: external_exports.literal("directory"),
    rootPath: external_exports.string().min(1)
  }),
  external_exports.object({
    mode: external_exports.literal("temporary"),
    tempId: external_exports.string().min(1)
  })
]);
var projectDefinitionSchema = external_exports.object({
  id: external_exports.string().min(1),
  name: external_exports.string().min(1),
  workspace: workspaceBindingSchema,
  createdAt: external_exports.string().datetime(),
  updatedAt: external_exports.string().datetime()
});
var graphDefinitionOutputSchema = external_exports.object({
  version: external_exports.literal(1),
  executionMode: external_exports.literal("tutorial").optional(),
  name: external_exports.string().min(1),
  goal: external_exports.string(),
  groups: external_exports.array(graphGroupSchema).optional(),
  nodes: external_exports.record(external_exports.string(), graphNodeSchema),
  links: external_exports.array(linkSchema)
}).superRefine((graph, context) => {
  const nodeIds = new Set(Object.keys(graph.nodes));
  const linkIds = /* @__PURE__ */ new Set();
  const linkPairs = /* @__PURE__ */ new Set();
  const groupedNodeIds = /* @__PURE__ */ new Set();
  const outputOwners = /* @__PURE__ */ new Set();
  for (const [nodeId, node] of Object.entries(graph.nodes)) {
    if (node.type !== "output") continue;
    const owner = graph.nodes[node.ownerAgentId];
    if (owner?.type !== "agent" || !(owner.provider.startsWith("agent-tool:") || graph.executionMode === "tutorial" && owner.provider === "fake")) {
      context.addIssue({
        code: external_exports.ZodIssueCode.custom,
        message: `Output ${nodeId} must belong to a local agent tool`,
        path: ["nodes", nodeId, "ownerAgentId"]
      });
    }
    if (outputOwners.has(node.ownerAgentId)) {
      context.addIssue({
        code: external_exports.ZodIssueCode.custom,
        message: `Agent ${node.ownerAgentId} may own only one output node`,
        path: ["nodes", nodeId, "ownerAgentId"]
      });
    }
    outputOwners.add(node.ownerAgentId);
  }
  for (const [groupIndex, group] of (graph.groups ?? []).entries()) {
    for (const nodeId of group.nodeIds) {
      if (!nodeIds.has(nodeId)) {
        context.addIssue({
          code: external_exports.ZodIssueCode.custom,
          message: `Group ${group.id} references a missing node`,
          path: ["groups", groupIndex, "nodeIds"]
        });
      }
      if (groupedNodeIds.has(nodeId)) {
        context.addIssue({
          code: external_exports.ZodIssueCode.custom,
          message: `Node ${nodeId} belongs to more than one group`,
          path: ["groups", groupIndex, "nodeIds"]
        });
      }
      groupedNodeIds.add(nodeId);
    }
  }
  for (const link of graph.links) {
    if (linkIds.has(link.id)) {
      context.addIssue({
        code: external_exports.ZodIssueCode.custom,
        message: `Duplicate link id: ${link.id}`,
        path: ["links"]
      });
    }
    linkIds.add(link.id);
    const sourceIds = linkSourceIds(link);
    if (!sourceIds.every((sourceId) => nodeIds.has(sourceId)) || !nodeIds.has(link.targetId)) {
      context.addIssue({
        code: external_exports.ZodIssueCode.custom,
        message: `Link ${link.id} references a missing node`,
        path: ["links"]
      });
      continue;
    }
    const target = graph.nodes[link.targetId];
    if (target?.type !== "agent") {
      context.addIssue({
        code: external_exports.ZodIssueCode.custom,
        message: `Link ${link.id} must target an agent`,
        path: ["links"]
      });
    }
    for (const sourceId of sourceIds) {
      const pair = `${sourceId}\0${link.targetId}`;
      if (linkPairs.has(pair)) {
        context.addIssue({
          code: external_exports.ZodIssueCode.custom,
          message: `Duplicate link: ${sourceId} -> ${link.targetId}`,
          path: ["links"]
        });
      }
      linkPairs.add(pair);
      const source = graph.nodes[sourceId];
      if (link.type === "merge" && source?.type !== "agent" && source?.type !== "output" || link.type !== "merge" && (source?.type === "input" || source?.type === "output") && link.type !== "input" || link.type !== "merge" && source?.type === "agent" && link.type === "input" || source?.type === "agent" && outputOwners.has(sourceId)) {
        context.addIssue({
          code: external_exports.ZodIssueCode.custom,
          message: `Link ${link.id} has an invalid relation for its source`,
          path: ["links"]
        });
      }
    }
  }
  const indegree = new Map([...nodeIds].map((id) => [id, 0]));
  const outgoing = new Map([...nodeIds].map((id) => [id, []]));
  for (const link of graph.links) {
    for (const sourceId of linkSourceIds(link)) {
      if (!nodeIds.has(sourceId) || !nodeIds.has(link.targetId)) continue;
      indegree.set(link.targetId, (indegree.get(link.targetId) ?? 0) + 1);
      outgoing.get(sourceId)?.push(link.targetId);
    }
  }
  for (const [nodeId, node] of Object.entries(graph.nodes)) {
    if (node.type !== "output" || !nodeIds.has(node.ownerAgentId)) continue;
    indegree.set(nodeId, (indegree.get(nodeId) ?? 0) + 1);
    outgoing.get(node.ownerAgentId)?.push(nodeId);
  }
  const queue = [...indegree.entries()].filter(([, degree]) => degree === 0).map(([id]) => id);
  let visited = 0;
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;
    visited += 1;
    for (const target of outgoing.get(current) ?? []) {
      const next = (indegree.get(target) ?? 0) - 1;
      indegree.set(target, next);
      if (next === 0) queue.push(target);
    }
  }
  if (visited !== nodeIds.size) {
    context.addIssue({
      code: external_exports.ZodIssueCode.custom,
      message: "Graph must be a DAG",
      path: ["links"]
    });
  }
});
var graphDefinitionSchema = external_exports.preprocess(
  migrateLegacyGraph,
  graphDefinitionOutputSchema
);
function linkSourceIds(link) {
  return link.type === "merge" ? link.sourceIds : [link.sourceId];
}
function migrateLegacyGraph(value) {
  if (!isRecord(value) || !isRecord(value.nodes)) return value;
  const addedOutputs = [];
  const existingOutputOwners = new Set(Object.values(value.nodes).flatMap((node) => isRecord(node) && node.type === "output" && typeof node.ownerAgentId === "string" ? [node.ownerAgentId] : []));
  const usedNodeIds = new Set(Object.keys(value.nodes));
  const nextOutputId = (agentId) => {
    const base = `output_${agentId}`;
    let outputId = base;
    let index = 2;
    while (usedNodeIds.has(outputId)) outputId = `${base}_${index++}`;
    usedNodeIds.add(outputId);
    return outputId;
  };
  const nodes = Object.fromEntries(Object.entries(value.nodes).map(([nodeId, candidate]) => {
    if (!isRecord(candidate)) return [nodeId, candidate];
    if (candidate.type === "input" && !Array.isArray(candidate.items)) {
      const content = typeof candidate.content === "string" ? candidate.content : "";
      return [nodeId, {
        ...candidate,
        items: content ? [{
          id: `text_${nodeId}`,
          name: "\u6587\u672C\u8F93\u5165",
          kind: "text",
          mode: "text",
          content
        }] : []
      }];
    }
    let current = candidate;
    if (candidate.type === "agent" && !isRecord(candidate.prompts)) {
      const system = typeof candidate.basePrompt === "string" ? candidate.basePrompt : "";
      const input = typeof candidate.graphRolePrompt === "string" ? candidate.graphRolePrompt : "";
      const { basePrompt: _basePrompt, graphRolePrompt: _graphRolePrompt, ...rest } = candidate;
      current = {
        ...rest,
        prompts: {
          system: { content: system, customized: Boolean(system), locked: false },
          input: { content: input, customized: Boolean(input), locked: false },
          output: { content: "", customized: false, locked: false }
        }
      };
    }
    if (current.type === "agent" && !existingOutputOwners.has(nodeId) && typeof current.provider === "string" && current.provider.startsWith("agent-tool:")) {
      addedOutputs.push([nextOutputId(nodeId), {
        type: "output",
        name: "Result",
        ownerAgentId: nodeId,
        directory: `.flow/agent-results/${nodeId}`,
        note: "",
        extractText: true,
        position: isRecord(current.position) && typeof current.position.x === "number" && typeof current.position.y === "number" ? { x: current.position.x + 360, y: current.position.y + 48 } : void 0
      }]);
      existingOutputOwners.add(nodeId);
    }
    return [nodeId, current];
  }));
  for (const [nodeId, output] of addedOutputs) if (!nodes[nodeId]) nodes[nodeId] = output;
  for (const [nodeId, candidate] of Object.entries(nodes)) {
    if (!isRecord(candidate) || candidate.type !== "output" || typeof candidate.ownerAgentId !== "string") continue;
    nodes[nodeId] = { ...candidate, directory: `.flow/agent-results/${candidate.ownerAgentId}` };
  }
  return { ...value, nodes, links: migrateOwnedOutputLinks(value.links, nodes) };
}
function migrateOwnedOutputLinks(links, nodes) {
  if (!Array.isArray(links)) return links;
  const outputByOwner = /* @__PURE__ */ new Map();
  for (const [nodeId, candidate] of Object.entries(nodes)) {
    if (isRecord(candidate) && candidate.type === "output" && typeof candidate.ownerAgentId === "string") outputByOwner.set(candidate.ownerAgentId, nodeId);
  }
  const usedIds = new Set(links.flatMap((candidate) => isRecord(candidate) && typeof candidate.id === "string" ? [candidate.id] : []));
  const nextId = (base) => {
    let id = base;
    let index = 2;
    while (usedIds.has(id)) id = `${base}-${index++}`;
    usedIds.add(id);
    return id;
  };
  return links.flatMap((candidate) => {
    if (!isRecord(candidate) || typeof candidate.id !== "string" || typeof candidate.targetId !== "string") return [candidate];
    if (candidate.type !== "merge") {
      const outputId = typeof candidate.sourceId === "string" ? outputByOwner.get(candidate.sourceId) : void 0;
      return outputId ? [{ ...candidate, sourceId: outputId, type: "input" }] : [candidate];
    }
    if (!Array.isArray(candidate.sourceIds)) return [candidate];
    const sourceIds = candidate.sourceIds.filter((sourceId) => typeof sourceId === "string");
    const outputSources = sourceIds.flatMap((sourceId) => {
      const outputId = outputByOwner.get(sourceId);
      return outputId ? [outputId] : [];
    });
    if (!outputSources.length) return [candidate];
    const remainingSources = sourceIds.filter((sourceId) => !outputByOwner.has(sourceId));
    const retained = remainingSources.length >= 2 ? [{ ...candidate, sourceIds: remainingSources }] : remainingSources.length === 1 ? [{ id: candidate.id, sourceId: remainingSources[0], targetId: candidate.targetId, type: "pass" }] : [];
    return [
      ...retained,
      ...outputSources.map((sourceId, index) => ({
        id: !retained.length && index === 0 ? candidate.id : nextId(`${candidate.id}-output`),
        sourceId,
        targetId: candidate.targetId,
        type: "input"
      }))
    ];
  });
}
function isRecord(value) {
  return typeof value === "object" && value !== null;
}
function parseGraph(source) {
  const value = (0, import_yaml.parse)(source);
  return graphDefinitionSchema.parse(value);
}
function formatValidationError(error) {
  if (!(error instanceof external_exports.ZodError)) {
    return error instanceof Error ? error.message : String(error);
  }
  return error.issues.map((issue) => `${issue.path.join(".") || "graph"}: ${issue.message}`).join("\n");
}

// ../../packages/core/src/input-content.ts
function visibleInputItems(node) {
  return node.items.filter((item) => !item.hidden);
}
function inputItemHasContent(item) {
  return !item.hidden && fileHasInputContent(item);
}
function fileHasInputContent(file) {
  return file.mode === "text" ? Boolean(file.content?.trim()) : Boolean(file.dataBase64?.trim());
}
function resultFileState(node, artifact, path) {
  return node.fileStates?.[artifact.id]?.[path];
}
function resultFiles(node, artifact, visibleOnly = false) {
  return (artifact?.files ?? []).filter((file) => {
    const state = artifact && resultFileState(node, artifact, file.relativePath);
    return state !== "detached" && (!visibleOnly || state !== "hidden");
  });
}
function nodeHasInputContent(node, artifact) {
  if (node?.type === "input") return node.items.some(inputItemHasContent);
  if (node?.type === "output" && artifact?.files !== void 0) {
    return resultFiles(node, artifact, true).some(fileHasInputContent);
  }
  return Boolean(artifact?.content.trim() || artifact?.files?.some(fileHasInputContent));
}
function inputText(node) {
  return visibleInputItems(node).filter(inputItemHasContent).map((item) => item.mode === "text" ? item.content : `[Attachment: ${item.name} \xB7 ${item.mimeType ?? "unknown"}]`).join("\n\n");
}
function transferableArtifact(node, artifact) {
  if (node?.type === "input") return { ...artifact, content: inputText(node), files: void 0, parts: void 0 };
  if (node?.type === "output" && artifact.files !== void 0) {
    const files = resultFiles(node, artifact, true);
    return { ...artifact, files, content: files.map((file) => file.name).join("\n"), parts: void 0 };
  }
  return artifact;
}

// ../../packages/core/src/model-parameters.ts
var providerMetadata = /* @__PURE__ */ new Map();
var openAiImageModels = /^(gpt-(?:4o|4\.1|5)|o[134])/i;
var anthropicImageModels = /^claude-(?:[^-]+-)*(?:3|4|5)(?:[-.]|$)/i;
var geminiImageModels = /^gemini-(?:1\.5|2|3)/i;
function modelAttachmentIssue(providerId, model, mimeType) {
  const provider = providerId.trim().toLowerCase();
  const normalizedMime = mimeType.trim().toLowerCase();
  const metadata = providerMetadata.get(provider)?.[model] ?? providerMetadata.get(provider)?.[model.toLowerCase()];
  const image = normalizedMime.startsWith("image/");
  if (!image) return t("{0} attachments are not supported", [normalizedMime || t("Unknown format")]);
  const formats = provider === "google" || provider === "gemini" ? /* @__PURE__ */ new Set(["image/png", "image/jpeg", "image/webp", "image/heic", "image/heif"]) : /* @__PURE__ */ new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
  if (!formats.has(normalizedMime)) return t("{0} does not accept {1}", [model, mimeType]);
  if (provider.startsWith("agent-tool:")) return t("Local Agent tools do not support image attachments yet");
  if (provider.startsWith("subscription:")) return t("Subscription connectors do not support image attachments yet");
  if (metadata?.inputModalities) {
    return metadata.inputModalities.includes("image") ? void 0 : t("{0} does not support image input", [model]);
  }
  if (provider === "openrouter") return t("Image capabilities for {0} are missing. Refresh the model list first", [model]);
  if (provider === "openai") return openAiImageModels.test(model) ? void 0 : t("{0} has not declared image input support", [model]);
  if (provider === "anthropic") return anthropicImageModels.test(model) ? void 0 : t("{0} has not declared image input support", [model]);
  if (provider === "google" || provider === "gemini") return geminiImageModels.test(model) ? void 0 : t("{0} has not declared image input support", [model]);
  if (provider === "deepseek") return /vision|vl/i.test(model) ? void 0 : t("{0} does not support image input", [model]);
  if (provider === "zai") return /(?:^|[-_.])(?:vl|\d+(?:\.\d+)?v)(?:[-_.]|$)/i.test(model) ? void 0 : t("{0} has not declared image input support", [model]);
  if (provider === "kimi") return /vision|vl/i.test(model) ? void 0 : t("{0} has not declared image input support", [model]);
  return t("{0} has not declared image input support", [model]);
}
var tokenRule = (max, defaultValue = -1) => ({ min: 1, max, integer: true, default: defaultValue, specialValues: [-1] });
var sampling = { temperature: { min: 0, max: 2, default: 1 }, topP: { min: 0, max: 1, default: 1 } };
var penalties = { presencePenalty: { min: -2, max: 2, default: 0 }, frequencyPenalty: { min: -2, max: 2, default: 0 } };
var generic = { id: "openai-compatible", verified: false, numeric: { ...sampling, maxTokens: tokenRule() }, omitMaxTokens: true, maxTokensField: "max_tokens" };
var openai = {
  id: "gpt-5.6",
  verified: true,
  source: "https://developers.openai.com/api/docs/guides/latest-model",
  numeric: { maxTokens: tokenRule(128e3) },
  omitMaxTokens: true,
  maxTokensField: "max_completion_tokens",
  reasoning: { kind: "effort", levels: ["none", "low", "medium", "high", "xhigh", "max"], default: "medium", wire: "openai" },
  verbosity: true,
  get note() {
    return t("Sampling is managed by the model. The output limit includes reasoning tokens.");
  }
};
var claude = {
  id: "claude-5",
  verified: true,
  source: "https://platform.claude.com/docs/en/build-with-claude/effort",
  numeric: { maxTokens: tokenRule(128e3, 128e3) },
  omitMaxTokens: false,
  maxTokensField: "max_tokens",
  reasoning: { kind: "effort", levels: ["low", "medium", "high", "xhigh", "max"], default: "high", wire: "adaptive" },
  stopSequences: true,
  get note() {
    return t("Adaptive reasoning. The output limit includes reasoning tokens and is required by this endpoint. The initial value is the model\u2019s maximum output.");
  }
};
var claude46 = {
  ...claude,
  id: "claude-4.6-adaptive",
  reasoning: { kind: "effort", levels: ["low", "medium", "high", "max"], default: "high", wire: "adaptive" },
  get note() {
    return t("Adaptive reasoning uses effort. The output limit includes reasoning tokens.");
  }
};
var gemini = {
  id: "gemini-3-flash",
  verified: true,
  source: "https://ai.google.dev/gemini-api/docs/generate-content/thinking",
  numeric: { maxTokens: tokenRule(65536, 65536) },
  omitMaxTokens: true,
  maxTokensField: "max_tokens",
  reasoning: { kind: "effort", levels: ["low", "medium", "high"], default: "medium", wire: "gemini" },
  get note() {
    return t("Uses thinking level. Sampling for this Flash generation is managed by the server.");
  }
};
var deepseek = {
  id: "deepseek-v4",
  verified: true,
  source: "https://api-docs.deepseek.com/api/create-chat-completion/",
  numeric: { ...sampling, ...penalties, maxTokens: tokenRule(393216) },
  omitMaxTokens: true,
  maxTokensField: "max_tokens",
  reasoning: { kind: "effort", levels: ["none", "low", "high", "max"], default: "high", wire: "thinking" },
  samplingOnlyWithoutThinking: true,
  stopSequences: true,
  get note() {
    return t("Sampling and penalty parameters are unused during reasoning. Select Off to disable reasoning.");
  }
};
var zai = {
  id: "glm-5.3",
  verified: true,
  source: "https://docs.z.ai/guides/overview/concept-param",
  numeric: { temperature: { min: 0, max: 1, default: 1 }, topP: { min: 0.01, max: 1, default: 0.95 }, maxTokens: tokenRule(131072, 65536) },
  omitMaxTokens: true,
  maxTokensField: "max_tokens",
  reasoning: { kind: "effort", levels: ["low", "high", "max"], default: "max", wire: "thinking" },
  get note() {
    return t("Reasoning is always enabled for this model.");
  }
};
var kimi = {
  id: "kimi-k3",
  verified: true,
  source: "https://platform.kimi.ai/docs/guide/kimi-k3-quickstart",
  numeric: { temperature: { min: 1, max: 1, default: 1, fixed: true }, topP: { min: 0.95, max: 0.95, default: 0.95, fixed: true }, maxTokens: tokenRule(1048576, 131072) },
  omitMaxTokens: true,
  maxTokensField: "max_completion_tokens",
  reasoning: { kind: "effort", levels: ["low", "high", "max"], default: "max", wire: "openai" },
  get note() {
    return t("Sampling parameters are fixed by the provider. Kimi K3 always reasons.");
  }
};
var MODEL_PARAMETER_PROFILES = [
  { provider: "openai", models: ["gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna", "gpt-5.6"], profile: openai },
  { provider: "anthropic", models: ["claude-fable-5-1", "claude-opus-5", "claude-sonnet-5"], profile: claude },
  { provider: "anthropic", models: ["claude-opus-4-8", "claude-opus-4-7"], profile: claude },
  { provider: "anthropic", models: ["claude-opus-4-6", "claude-sonnet-4-6"], profile: claude46 },
  { provider: "google", models: ["gemini-3.7-flash"], profile: gemini },
  { provider: "google", models: ["gemini-3.6-flash", "gemini-3.5-flash"], profile: { ...gemini, reasoning: { ...gemini.reasoning, levels: ["minimal", "low", "medium", "high"] } } },
  { provider: "google", models: ["gemini-3.5-flash-lite"], profile: { ...gemini, reasoning: { ...gemini.reasoning, levels: ["minimal", "low", "medium", "high"], default: "minimal" } } },
  { provider: "google", models: ["gemini-3.1-pro-preview"], profile: { ...gemini, numeric: { ...sampling, topP: { min: 0, max: 1, default: 0.95 }, maxTokens: tokenRule(65536, 65536) }, reasoning: { ...gemini.reasoning, default: "high" }, get note() {
    return t("Pro requires reasoning. Keep temperature at 1.");
  } } },
  ...["pro", "flash", "flash-lite"].map((tier) => ({ provider: "google", models: [`gemini-2.5-${tier}`], profile: {
    ...gemini,
    id: `gemini-2.5-${tier}`,
    stopSequences: true,
    numeric: { ...sampling, seed: { min: -2147483648, max: 2147483647, integer: true }, topP: { min: 0, max: 1, default: 0.95 }, maxTokens: tokenRule(65536, 65536), reasoningBudget: { min: tier === "pro" ? 128 : tier === "flash-lite" ? 512 : 0, max: tier === "pro" ? 32768 : 24576, integer: true, default: tier === "flash-lite" ? 0 : -1, specialValues: tier === "pro" ? [-1] : [-1, 0] } },
    reasoning: { kind: "budget", wire: "gemini" },
    note: t("A reasoning budget of -1 enables a dynamic budget{0}.", [tier === "pro" ? t("; Pro requires a nonzero value") : t("; 0 disables reasoning")])
  } })),
  { provider: "deepseek", models: ["deepseek-v4-flash", "deepseek-v4-flash-0731", "deepseek-v4-pro", "deepseek-v4-pro-0813", "deepseek-v4-flash-vision-exp"], profile: deepseek },
  { provider: "zai", models: ["glm-5.3", "glm-5.3-flash"], profile: zai },
  { provider: "zai", models: ["glm-5.2"], profile: { ...zai, id: "glm-5.2", reasoning: { ...zai.reasoning, levels: ["none", "low", "high", "max"] }, get note() {
    return t("Select Off to disable reasoning.");
  } } },
  { provider: "kimi", models: ["kimi-k3"], profile: kimi },
  { provider: "kimi", models: ["kimi-k2.7-code", "kimi-k2.7-code-highspeed"], profile: { ...kimi, id: "kimi-k2.7-code", source: "https://platform.kimi.ai/docs/guide/kimi-k2-7-code-quickstart", maxTokensField: "max_tokens", numeric: { ...kimi.numeric, maxTokens: tokenRule(262144, 32768) }, reasoning: void 0, get note() {
    return t("Reasoning is always on. Temperature is fixed at 1 and Top-P at 0.95.");
  } } },
  { provider: "kimi", models: ["kimi-k2.6"], profile: { ...kimi, id: "kimi-k2.6", source: "https://platform.kimi.ai/docs/guide/kimi-k2-6-quickstart", maxTokensField: "max_tokens", numeric: { ...kimi.numeric, maxTokens: tokenRule(262144, 32768) }, reasoning: { kind: "toggle", levels: ["none", "enabled"], default: "enabled", wire: "thinking" }, get note() {
    return t("Temperature is 1 with reasoning on and 0.6 with it off. Top-P is fixed at 0.95.");
  } } }
];

// ../../packages/core/src/model-response.ts
var MODEL_TIMEOUT_MS = 18e4;
var AGENT_TOOL_TIMEOUT_MS = 6e5;
function hasFileContent(file) {
  return file && typeof file.name === "string" && file.name.trim() && typeof file.relativePath === "string" && file.relativePath.trim() && (file.mode === "text" ? typeof file.content === "string" && file.content.trim() : file.mode === "attachment" && file.size > 0);
}
function validateModelResponse(result, requireFiles = false) {
  if (!result || typeof result.content !== "string" || result.files !== void 0 && !Array.isArray(result.files)) {
    throw new Error(t("The provider returned an invalid response"));
  }
  const files = result.files?.some(hasFileContent);
  if (requireFiles && !files) throw new Error(t("The Agent did not return any usable output files"));
  if (!result.content.trim() && !files) throw new Error(t("The provider completed the response without returning text"));
}
async function invokeModelSafely(invoke, request, onDelta, signal, timeoutMs = request.providerId.startsWith("agent-tool:") || request.providerId.startsWith("subscription:") && request.providerId !== "subscription:deepseek-web" ? AGENT_TOOL_TIMEOUT_MS : MODEL_TIMEOUT_MS) {
  signal?.throwIfAborted();
  const controller = new AbortController();
  const forwardAbort = () => controller.abort(signal?.reason);
  signal?.addEventListener("abort", forwardAbort, { once: true });
  let rejectAbort = () => {
  };
  let finished = false;
  const cancelled = new Promise((_, reject) => {
    rejectAbort = () => reject(controller.signal.reason);
    controller.signal.addEventListener("abort", rejectAbort, { once: true });
  });
  const timer = setTimeout(() => controller.abort(new Error(t("Model request timed out after {0} seconds", [Math.ceil(timeoutMs / 1e3)]))), timeoutMs);
  try {
    const result = await Promise.race([
      invoke(request, (delta) => {
        if (!finished && !controller.signal.aborted) onDelta?.(delta);
      }, controller.signal),
      cancelled
    ]);
    controller.signal.throwIfAborted();
    validateModelResponse(result, Boolean(request.outputDirectory));
    return result;
  } finally {
    finished = true;
    clearTimeout(timer);
    signal?.removeEventListener("abort", forwardAbort);
    controller.signal.removeEventListener("abort", rejectAbort);
  }
}

// ../../packages/core/src/index.ts
function sleep(duration, signal) {
  return new Promise((resolve3, reject) => {
    signal?.throwIfAborted();
    const abort = () => {
      clearTimeout(timer);
      reject(signal?.reason);
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", abort);
      resolve3();
    }, duration);
    signal?.addEventListener("abort", abort, { once: true });
  });
}
function createRunId() {
  const suffix = Math.random().toString(36).slice(2, 8);
  return `run_${Date.now().toString(36)}_${suffix}`;
}
function now() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
function composeInvocation(graph, nodeId, artifactByNode) {
  const node = graph.nodes[nodeId];
  if (!node || node.type !== "agent") {
    throw new Error(t("Node {0} is not an agent", [nodeId]));
  }
  const incoming = graph.links.filter((link) => link.targetId === nodeId);
  if (incoming.length && !(node.prompts.input.customized && node.prompts.input.content.trim()) && !incoming.flatMap(linkSourceIds).some((sourceId) => nodeHasInputContent(graph.nodes[sourceId], artifactByNode.get(sourceId)))) {
    throw new Error(t("Upstream input for {0} is empty. Add content or show the files to send.", [node.name]));
  }
  const upstream = incoming.flatMap((link) => linkSourceIds(link)).map((sourceId) => artifactByNode.get(sourceId)).filter((artifact) => Boolean(artifact)).map((artifact) => transferableArtifact(graph.nodes[artifact.nodeId], artifact));
  const sourceBlocks = upstream.map((artifact, index) => {
    const sourceNode = graph.nodes[artifact.nodeId];
    const textFiles = (artifact.files ?? []).filter((file) => file.mode === "text" && file.content).map((file) => `### ${file.name}
${file.content}`).join("\n\n");
    const workspaceFiles = node.provider.startsWith("agent-tool:") ? sourceNode?.type === "output" ? (artifact.files ?? []).filter((file) => file.mode === "attachment").map((file) => `- ${sourceNode.directory}/${file.relativePath}`).join("\n") : sourceNode?.type === "input" ? visibleInputItems(sourceNode).filter((item) => item.mode === "attachment" && item.workspacePath).map((item) => `- ${item.workspacePath}`).join("\n") : "" : "";
    return [upstream.length > 1 ? `## Source ${index + 1}` : void 0, artifact.content, textFiles, workspaceFiles ? `Workspace files:
${workspaceFiles}` : void 0].filter(Boolean).join("\n\n");
  }).join("\n\n");
  const goal = graph.goal.trim();
  const ownInstructions = [node.prompts.system.content, node.prompts.input.content, node.prompts.output.content].join("\n");
  const userPrompt = [
    node.prompts.input.content,
    goal && !ownInstructions.includes(goal) ? `# Current task
${goal}` : void 0,
    sourceBlocks ? `# Connected context
${sourceBlocks}` : void 0,
    node.prompts.output.content ? `# Required output
${node.prompts.output.content}` : void 0,
    outputContract(graph, nodeId)
  ].filter(Boolean).join("\n\n");
  const messages = [];
  const systemPrompt = node.prompts.system.content;
  if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
  const imageParts = incoming.flatMap((link) => linkSourceIds(link)).flatMap((sourceId) => {
    const source = graph.nodes[sourceId];
    if (source?.type === "input") return visibleInputItems(source).flatMap((item) => item.mode === "attachment" && item.mimeType?.startsWith("image/") && item.dataBase64 && !(node.provider.startsWith("agent-tool:") && item.workspacePath) ? [{ type: "image", name: item.name, mimeType: item.mimeType, dataBase64: item.dataBase64 }] : []);
    const artifact = artifactByNode.get(sourceId);
    if (node.provider.startsWith("agent-tool:") && source?.type === "output") return [];
    return (artifact ? transferableArtifact(source, artifact).files ?? [] : []).flatMap((file) => file.mode === "attachment" && file.mimeType.startsWith("image/") && file.dataBase64 ? [{ type: "image", name: file.name, mimeType: file.mimeType, dataBase64: file.dataBase64 }] : []);
  });
  for (const image of imageParts) {
    const issue = modelAttachmentIssue(node.provider, node.model, image.mimeType);
    if (issue) throw new Error(t("{0} cannot receive {1}: {2}", [node.name, image.name, issue]));
  }
  const content = imageParts.length ? [{ type: "text", text: userPrompt }, ...imageParts.flatMap((image) => [{ type: "text", text: t("Image: {0}", [image.name]) }, image])] : userPrompt;
  messages.push({ role: "user", content });
  return {
    nodeId,
    messages,
    upstream,
    relations: incoming.map((link) => link.type)
  };
}
function outputContract(graph, agentId) {
  const output = Object.values(graph.nodes).find((node) => node.type === "output" && node.ownerAgentId === agentId);
  if (!output) return void 0;
  return [
    "# Deliverables",
    `Write final deliverables to this workspace-relative directory: ${output.directory}`,
    "Only final deliverables belong there.",
    output.note ? `Output note: ${output.note}` : void 0
  ].filter(Boolean).join("\n");
}
function fakeResponse(nodeId, node, invocation) {
  const lowerName = `${nodeId} ${node.name} ${node.prompts.input.content}`.toLowerCase();
  if (lowerName.includes("review")) {
    return [
      t("## Review conclusion"),
      "",
      t("The main approach is clear and ready for prototype validation. Refine three points before implementation:"),
      "",
      t("1. The GUI and CLI must read the same Flow schema."),
      t("2. Links describe information relationships. Tasks belong in downstream Agent prompts."),
      t("3. Runs, artifacts, and parent dependencies need immutable version records."),
      "",
      t("Reviewed {0} upstream artifacts.", [invocation.upstream.length])
    ].join("\n");
  }
  return [
    t("## Prototype plan"),
    "",
    t("Use a shared core to support both the desktop canvas and CLI:"),
    "",
    t("- The Flow schema validates nodes, relations, and versions."),
    t("- The runtime follows DAG dependencies and streams status events."),
    t("- Each node produces an immutable artifact and supports partial reruns."),
    t("- Each Agent retains its prompts, model configuration, and runtime context."),
    "",
    t("This request received {0} upstream inputs.", [invocation.upstream.length])
  ].join("\n");
}
function dependenciesFor(graph, nodeId) {
  const node = graph.nodes[nodeId];
  if (node?.type === "output") return [node.ownerAgentId];
  return graph.links.filter((link) => link.targetId === nodeId).flatMap((link) => linkSourceIds(link));
}
function collectInputSources(graph, nodeId, artifactByNode) {
  const direct = dependenciesFor(graph, nodeId);
  const sources = /* @__PURE__ */ new Set();
  for (const sourceId of direct) {
    const source = graph.nodes[sourceId];
    if (source?.type === "input") sources.add(sourceId);
    const artifact = artifactByNode.get(sourceId);
    artifact?.sourceInputs.forEach((id) => sources.add(id));
  }
  return [...sources];
}
async function executeGraph(graph, options = {}) {
  if (graph.executionMode === "tutorial") throw new Error(t("The tutorial Flow uses preset results. Run it in the interactive tutorial."));
  const delayMs = options.delayMs ?? 480;
  const runId = createRunId();
  const events = [];
  const controller = new AbortController();
  const signal = options.signal ? AbortSignal.any([options.signal, controller.signal]) : controller.signal;
  const runOptions = { ...options, signal };
  const requested = options.nodeIds ? new Set(options.nodeIds) : void 0;
  const artifactByNode = new Map((options.resumeArtifacts ?? []).filter((artifact) => graph.nodes[artifact.nodeId] && !requested?.has(artifact.nodeId)).map((artifact) => [artifact.nodeId, artifact]));
  const pending = new Set((options.nodeIds ?? Object.keys(graph.nodes)).filter((nodeId) => !artifactByNode.has(nodeId)));
  let failure;
  const emit = async (event) => {
    events.push(event);
    await options.onEvent?.(event);
  };
  await emit({
    type: "run.started",
    runId,
    at: now(),
    message: t("Run started \xB7 {0}", [graph.name])
  });
  for (const nodeId of pending) if (!signal.aborted) await emit({ type: "node.status", runId, nodeId, status: "waiting", at: now(), message: t("Waiting to run") });
  while (pending.size > 0 && !signal.aborted) {
    const ready = [...pending].filter(
      (nodeId) => dependenciesFor(graph, nodeId).every(
        (dependency) => artifactByNode.has(dependency)
      )
    );
    if (ready.length === 0) {
      throw new Error(t("Runtime stalled because graph dependencies are unresolved"));
    }
    const blocked = ready.flatMap((nodeId) => {
      const node = graph.nodes[nodeId];
      if (node?.type !== "agent") return [];
      const files = unsupportedArtifactFiles(graph, nodeId, artifactByNode);
      return files.length ? [{ nodeId, nodeName: node.name, files }] : [];
    })[0];
    const runnable = blocked && !options.skipUnsupportedFiles ? ready.filter((nodeId) => nodeId !== blocked.nodeId) : ready;
    if (!runnable.length && blocked && !options.skipUnsupportedFiles) {
      await emit({ type: "node.status", runId, nodeId: blocked.nodeId, status: "paused", at: now(), message: t("{0} is waiting for unsupported files to be handled", [blocked.nodeName]) });
      await emit({ type: "run.paused", runId, at: now(), message: t("Flow paused") });
      return { runId, status: "paused", artifacts: [...artifactByNode.values()], events, blocked };
    }
    const results = await Promise.allSettled(
      runnable.map(async (nodeId) => {
        const node = graph.nodes[nodeId];
        if (!node) return;
        pending.delete(nodeId);
        try {
          await runNode(graph, runId, nodeId, node, artifactByNode, delayMs, emit, runOptions);
        } catch (error) {
          const cancelled = signal.aborted;
          if (!cancelled) {
            failure = { error };
            controller.abort(error);
          }
          await emit({
            type: "node.status",
            runId,
            nodeId,
            status: cancelled ? "cancelled" : "failed",
            at: now(),
            message: cancelled ? t("{0} stopped", [node.name]) : error instanceof Error ? error.message : t("{0} failed", [node.name])
          });
          throw error;
        }
      })
    );
    if (signal.aborted) break;
    const failed = results.find((result) => result.status === "rejected");
    if (failed?.status === "rejected") throw failed.reason;
  }
  if (signal.aborted) for (const nodeId of pending) {
    await emit({ type: "node.status", runId, nodeId, status: "cancelled", at: now(), message: t("Stopped before execution") });
  }
  if (failure) throw failure.error;
  await emit({
    type: options.signal?.aborted ? "run.cancelled" : "run.completed",
    runId,
    at: now(),
    message: options.signal?.aborted ? t("Flow stopped") : t("Run completed")
  });
  return {
    runId,
    status: options.signal?.aborted ? "cancelled" : "completed",
    artifacts: [...artifactByNode.values()],
    events
  };
}
function unsupportedArtifactFiles(graph, nodeId, artifactByNode) {
  const node = graph.nodes[nodeId];
  if (node?.type !== "agent") return [];
  if (node.provider === "fake" || node.provider.startsWith("agent-tool:")) return [];
  return dependenciesFor(graph, nodeId).flatMap((dependency) => {
    const source = graph.nodes[dependency];
    if (source?.type === "input") return visibleInputItems(source).filter((item) => item.mode === "attachment").map((item) => ({ ...item, mimeType: item.mimeType ?? "" }));
    const artifact = artifactByNode.get(dependency);
    return artifact ? transferableArtifact(source, artifact).files ?? [] : [];
  }).flatMap((file) => {
    if (file.mode === "text") return [];
    if (file.mimeType.startsWith("image/") && !modelAttachmentIssue(node.provider, node.model, file.mimeType)) return [];
    return [file.name];
  });
}
async function runNode(graph, runId, nodeId, node, artifactByNode, delayMs, emit, options) {
  options.signal?.throwIfAborted();
  await emit({
    type: "node.status",
    runId,
    nodeId,
    status: "running",
    at: now(),
    message: t("{0} started", [node.name])
  });
  if (delayMs > 0) await sleep(node.type === "input" || node.type === "output" ? delayMs / 3 : delayMs, options.signal);
  options.signal?.throwIfAborted();
  const parents = dependenciesFor(graph, nodeId).map((dependency) => artifactByNode.get(dependency)?.id).filter((id) => Boolean(id));
  let content;
  let files;
  let parts;
  let providerState;
  const specifiedOutput = node.type === "agent" ? Object.values(graph.nodes).find((candidate) => candidate.type === "output" && candidate.ownerAgentId === nodeId) : void 0;
  if (node.type === "input") {
    content = inputText(node);
  } else if (node.type === "output") {
    const owner = artifactByNode.get(node.ownerAgentId);
    files = owner?.files ?? [];
    content = files.map((file) => file.name).join("\n");
  } else {
    const invocation = composeInvocation(graph, nodeId, artifactByNode);
    if (node.provider.toLowerCase() === "fake") {
      content = fakeResponse(nodeId, node, invocation);
    } else {
      if (!options.modelInvoker) throw new Error(t("Provider {0} requires a model invoker", [node.provider]));
      const response = await invokeModelSafely(options.modelInvoker, {
        providerId: node.provider,
        model: node.model,
        messages: invocation.messages,
        parameters: node.parameters,
        outputDirectory: specifiedOutput ? { path: specifiedOutput.directory, note: specifiedOutput.note, extractText: specifiedOutput.extractText } : void 0
      }, (delta) => {
        if (!options.signal?.aborted) options.onTextDelta?.(nodeId, delta);
      }, options.signal, options.modelTimeoutMs);
      content = response.content;
      files = response.files;
      parts = response.parts;
      providerState = response.providerState;
    }
  }
  options.signal?.throwIfAborted();
  const version = options.artifactVersions?.[nodeId] ?? 1;
  const artifact = {
    id: `${runId}:${nodeId}:v${version}`,
    runId,
    nodeId,
    version,
    content,
    parentArtifacts: parents,
    sourceInputs: node.type === "input" ? [nodeId] : collectInputSources(graph, nodeId, artifactByNode),
    createdAt: now(),
    files,
    parts,
    providerState
  };
  artifactByNode.set(nodeId, artifact);
  await emit({
    type: "artifact.created",
    runId,
    nodeId,
    artifact,
    at: now(),
    message: t("{0} produced artifact v{1}", [node.name, version])
  });
  await emit({
    type: "node.status",
    runId,
    nodeId,
    status: "completed",
    at: now(),
    message: t("{0} completed", [node.name])
  });
}

// src/host-commands.ts
import { readFile as readFile2, stat, writeFile as writeFile2 } from "fs/promises";

// ../../packages/core/src/host-run.ts
function validateHostGraph(value) {
  const graph = graphDefinitionSchema.parse(value);
  if (graph.executionMode) throw new Error("Host execution requires an ordinary Flow.");
  if (!Object.values(graph.nodes).some((node) => node.type === "agent")) throw new Error("Add at least one Agent.");
  for (const [id, node] of Object.entries(graph.nodes)) {
    if (node.type === "output") throw new Error(`Output ${id}: host Agents return Markdown artifacts; describe deliverable files in their output prompts.`);
    if (node.type === "agent") {
      if (node.provider !== "host" || node.model !== "inherit") throw new Error(`Agent ${id}: host execution requires provider: host and model: inherit.`);
      if (node.parameters && Object.keys(node.parameters).length) throw new Error(`Agent ${id}: model parameters are controlled by the host session.`);
      if (!node.prompts.system.content.trim() || !node.prompts.output.content.trim()) throw new Error(`Agent ${id}: supply system and output prompts.`);
    } else {
      if (node.executionMode === "for-each") throw new Error(`Input ${id}: expand for-each into explicit nodes before host execution.`);
      if (visibleInputItems(node).some((item) => item.mode !== "text")) throw new Error(`Input ${id}: read or extract attachments with host tools, then supply text or a workspace-relative file reference as text.`);
      if (!inputText(node).trim()) throw new Error(`Input ${id}: supply the material before starting the Flow.`);
    }
  }
  return graph;
}
function hostDependencies(graph, nodeId) {
  return graph.links.filter((link) => link.targetId === nodeId).flatMap(linkSourceIds);
}
function artifactFor(run, nodeId, content, at) {
  const parents = hostDependencies(run.graph, nodeId).map((id) => run.artifacts.find((artifact) => artifact.nodeId === id));
  return {
    id: `${run.runId}:${nodeId}:v1`,
    runId: run.runId,
    nodeId,
    version: 1,
    content,
    parentArtifacts: parents.map((parent) => parent.id),
    sourceInputs: run.graph.nodes[nodeId]?.type === "input" ? [nodeId] : [...new Set(parents.flatMap((parent) => parent.sourceInputs))],
    createdAt: at
  };
}
function createHostRun(graph, workspace, runId, at) {
  const run = {
    format: "agentflow-host-run",
    version: 1,
    runId,
    workspace,
    createdAt: at,
    graph: validateHostGraph(graph),
    artifacts: [],
    tasks: []
  };
  for (const [id, node] of Object.entries(run.graph.nodes)) {
    if (node.type === "input") run.artifacts.push(artifactFor(run, id, inputText(node), at));
  }
  return run;
}
function hostRunStatus(run) {
  const completed = new Set(run.artifacts.map((artifact) => artifact.nodeId));
  const nodes = Object.entries(run.graph.nodes).map(([nodeId, node]) => {
    const task = run.tasks.filter((task2) => task2.nodeId === nodeId).at(-1);
    const waitingFor = hostDependencies(run.graph, nodeId).filter((id) => !completed.has(id));
    const status2 = completed.has(nodeId) ? "completed" : task?.status === "running" ? "running" : task?.status === "failed" ? "failed" : waitingFor.length ? "waiting" : "ready";
    return { nodeId, name: node.name, type: node.type, status: status2, waitingFor, taskId: task?.id, error: task?.error };
  });
  const status = nodes.every((node) => node.status === "completed") ? "completed" : nodes.some((node) => node.status === "running") ? "running" : nodes.some((node) => node.status === "failed") ? "blocked" : "ready";
  return {
    runId: run.runId,
    workspace: run.workspace,
    name: run.graph.name,
    status,
    nodes,
    ready: nodes.filter((node) => node.status === "ready").map((node) => node.nodeId)
  };
}
function claimHostTask(run, taskId, at, requestedNodeId) {
  const ready = hostRunStatus(run).ready;
  const nodeId = requestedNodeId ?? ready[0];
  if (!nodeId) return null;
  if (!ready.includes(nodeId)) throw new Error(`Node ${nodeId} is not ready. Inspect host status.`);
  if (run.tasks.some((task2) => task2.id === taskId)) throw new Error("Task ID already exists.");
  const invocation = composeInvocation(run.graph, nodeId, new Map(run.artifacts.map((artifact) => [artifact.nodeId, artifact])));
  const task = { id: taskId, nodeId, attempt: run.tasks.filter((task2) => task2.nodeId === nodeId).length + 1, status: "running", startedAt: at };
  run.tasks.push(task);
  return { task, invocation };
}
function submitHostTask(run, taskId, content, at) {
  const task = run.tasks.find((task2) => task2.id === taskId);
  if (!task) throw new Error("Unknown task ID.");
  const existing = run.artifacts.find((artifact2) => artifact2.nodeId === task.nodeId);
  if (task.status === "completed" && existing?.content === content) return existing;
  if (task.status !== "running" || existing) throw new Error("Task is no longer running; completed results are immutable.");
  if (!content.trim()) throw new Error("A completed task must contain a non-empty result.");
  const artifact = artifactFor(run, task.nodeId, content, at);
  run.artifacts.push(artifact);
  task.status = "completed";
  task.finishedAt = at;
  return artifact;
}
function failHostTask(run, taskId, error, at) {
  const task = run.tasks.find((task2) => task2.id === taskId);
  if (!task || task.status !== "running") throw new Error("Only a running task can be failed.");
  if (!error.trim()) throw new Error("Supply the reason execution stopped.");
  task.status = "failed";
  task.error = error;
  task.finishedAt = at;
}
function retryHostTask(run, nodeId, taskId, at) {
  if (run.tasks.some((task2) => task2.id === taskId)) throw new Error("Task ID already exists.");
  const previous = run.tasks.filter((task2) => task2.nodeId === nodeId).at(-1);
  if (!previous || previous.status !== "failed") throw new Error("Only a failed node can be retried. Mark an interrupted task failed first.");
  const eligible = { ...run, tasks: run.tasks.filter((task2) => task2.nodeId !== nodeId) };
  if (!hostRunStatus(eligible).ready.includes(nodeId)) throw new Error("Dependencies are not complete.");
  const invocation = composeInvocation(run.graph, nodeId, new Map(run.artifacts.map((artifact) => [artifact.nodeId, artifact])));
  const task = { id: taskId, nodeId, attempt: run.tasks.filter((task2) => task2.nodeId === nodeId).length + 1, status: "running", startedAt: at };
  run.tasks.push(task);
  return { task, invocation };
}

// src/host-storage.ts
import { createHash, randomUUID } from "crypto";
import { lstat, mkdir, open, readFile, realpath, rename, unlink, writeFile } from "fs/promises";
import { join, parse, resolve, sep } from "path";
var hash = (value) => createHash("sha256").update(value).digest("hex");
var artifactFilename = (nodeId) => `${hash(nodeId)}.md`;
var invocationPath = (path) => resolve(process.env.INIT_CWD ?? process.cwd(), path);
var newTaskId = () => `task-${randomUUID()}`;
async function ordinaryPath(path, directory = false) {
  const info = await lstat(path);
  if (info.isSymbolicLink() || (directory ? !info.isDirectory() : !info.isFile())) {
    throw new Error(`Expected an ordinary ${directory ? "directory" : "file"}: ${path}`);
  }
}
async function checkRunDirectory(directory) {
  await directoryTree(directory);
  await ordinaryPath(directory, true);
  for (const child of ["artifacts", "results"]) await ordinaryPath(join(directory, child), true);
  await ordinaryPath(join(directory, "state.json"));
}
async function directoryTree(path, create = false) {
  const absolute = resolve(path);
  let current = parse(absolute).root;
  for (const segment of absolute.slice(current.length).split(sep).filter(Boolean)) {
    current = join(current, segment);
    if (process.platform === "darwin" && ["/var", "/tmp", "/etc"].includes(current) && await realpath(current) === `/private${current}`) current = `/private${current}`;
    if (create) await mkdir(current).catch((error) => {
      if (error.code !== "EEXIST") throw error;
    });
    await ordinaryPath(current, true);
  }
}
async function readHostRun(directory) {
  await checkRunDirectory(directory);
  const envelope = JSON.parse(await readFile(join(directory, "state.json"), "utf8"));
  const run = envelope.run;
  if (!run || run.format !== "agentflow-host-run" || run.version !== 1 || !Array.isArray(run.artifacts) || !Array.isArray(run.tasks) || typeof run.workspace !== "string" || envelope.checksum !== hash(JSON.stringify(run))) throw new Error("Invalid or edited host run state. Start a new run from the edited Flow.");
  validateHostGraph(run.graph);
  return run;
}
async function immutableFile(path, content) {
  try {
    await writeFile(path, content, { encoding: "utf8", flag: "wx" });
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    await ordinaryPath(path);
    if (await readFile(path, "utf8") !== content) throw new Error(`Stored artifact was modified: ${path}`);
  }
}
async function saveHostRun(directory, run) {
  for (const artifact of run.artifacts) {
    await immutableFile(join(directory, "artifacts", artifactFilename(artifact.nodeId)), artifact.content);
  }
  const temporary = join(directory, `.state-${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, JSON.stringify({ checksum: hash(JSON.stringify(run)), run }, null, 2) + "\n", { flag: "wx" });
    await rename(temporary, join(directory, "state.json"));
  } finally {
    await unlink(temporary).catch((error) => {
      if (error.code !== "ENOENT") throw error;
    });
  }
}
async function startHostRun(graph, workspacePath, requestedDirectory) {
  const workspace = await realpath(workspacePath);
  await ordinaryPath(workspace, true);
  const runId = `run-${randomUUID()}`;
  const run = createHostRun(graph, workspace, runId, (/* @__PURE__ */ new Date()).toISOString());
  const directory = requestedDirectory ?? join(workspace, ".agentflow", "runs", runId);
  await directoryTree(resolve(directory, ".."), true);
  await mkdir(directory);
  for (const child of ["artifacts", "results"]) await mkdir(join(directory, child));
  await immutableFile(join(directory, "graph.json"), JSON.stringify(run.graph, null, 2) + "\n");
  await saveHostRun(directory, run);
  return describeHostRun(directory, run);
}
async function withHostRun(directory, action2) {
  await checkRunDirectory(directory);
  const lockPath = join(directory, ".lock");
  let lock;
  try {
    lock = await open(lockPath, "wx");
  } catch (error) {
    if (error.code === "EEXIST") throw new Error("Run is locked by another command. Retry after it exits. If it crashed, verify the recorded process has exited before removing .lock.");
    throw error;
  }
  try {
    await lock.writeFile(JSON.stringify({ pid: process.pid, at: (/* @__PURE__ */ new Date()).toISOString() }));
    const run = await readHostRun(directory);
    const result = await action2(run);
    await saveHostRun(directory, run);
    return result;
  } finally {
    await lock.close();
    await unlink(lockPath);
  }
}
function describeHostRun(directory, run) {
  return {
    ...hostRunStatus(run),
    runDirectory: directory,
    graphPath: join(directory, "graph.json"),
    artifacts: run.artifacts.map(({ content: _content, ...artifact }) => ({ ...artifact, path: join(directory, "artifacts", artifactFilename(artifact.nodeId)) }))
  };
}
function describeHostTask(directory, run, task) {
  const invocation = composeInvocation(run.graph, task.nodeId, new Map(run.artifacts.map((artifact) => [artifact.nodeId, artifact])));
  return {
    runDirectory: directory,
    workspace: run.workspace,
    task,
    node: { id: task.nodeId, name: run.graph.nodes[task.nodeId].name },
    messages: invocation.messages,
    relations: invocation.relations,
    upstream: invocation.upstream.map((artifact) => ({
      nodeId: artifact.nodeId,
      artifactId: artifact.id,
      path: join(directory, "artifacts", artifactFilename(artifact.nodeId))
    })),
    resultPath: join(directory, "results", `${task.id}.md`)
  };
}

// src/host-panel.ts
function createHostPanel(graph, run) {
  const payload = JSON.stringify({ graph, run: run ? { createdAt: run.createdAt, ...hostRunStatus(run), artifacts: run.artifacts } : null }).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
  return String.raw`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'">
<title>AgentFlow</title><style>
:root{color-scheme:light;--canvas:#fbfbfa;--surface:#fff;--ink:#20201e;--muted:#62625c;--line:#d5d5cf;--blue:#2563eb;--soft:#edf3ff;--green:#39775a;--red:#b7473d}
*{box-sizing:border-box}body{margin:0;background:var(--canvas);color:var(--ink);font:14px/1.55 system-ui,-apple-system,"Segoe UI","Microsoft YaHei",sans-serif}button,input,textarea,select{font:inherit;color:inherit}button{cursor:pointer;border:1px solid var(--line);background:var(--surface);border-radius:9px;padding:8px 14px;min-height:40px}button:hover{background:#f2f2ef}button:focus-visible,input:focus-visible,textarea:focus-visible,select:focus-visible{outline:2px solid var(--blue);outline-offset:3px}button:disabled{cursor:default;opacity:.55}::selection{background:#d8e6ff}input,textarea{caret-color:var(--blue)}*{scrollbar-color:#aaa9a3 #f2f2ef;scrollbar-width:thin}a{text-underline-offset:3px}header{display:flex;align-items:center;gap:24px;padding:20px 28px;border-bottom:1px solid var(--line);background:var(--surface)}.brand{font-weight:650;font-size:18px;white-space:nowrap}.identity{min-width:0;flex:1}.identity input{font-size:20px;font-weight:600;border:0;padding:2px 0;background:transparent;width:100%;letter-spacing:-.02em}.meta{color:var(--muted);font-size:12px;font-variant-numeric:tabular-nums}.primary{background:var(--ink);color:white;border-color:var(--ink);white-space:nowrap}.primary:hover{background:#41413c}main{display:grid;grid-template-columns:minmax(0,1fr) 360px;min-height:calc(100vh - 96px)}.work{min-width:0}.goal{padding:24px 28px 16px}.goal label{display:block;font-weight:600;margin-bottom:8px}.goal textarea{width:100%;min-height:82px;background:transparent;border:1px solid var(--line);border-radius:9px;padding:10px 12px;resize:vertical;line-height:1.6}.canvas{overflow:auto;min-height:440px;padding:12px 28px 32px}.stage{position:relative;min-height:380px}.wires{position:absolute;inset:0;overflow:visible;pointer-events:none}.node{position:absolute;width:220px;min-height:108px;text-align:left;padding:16px;border-radius:15px;background:var(--surface)}.node[aria-pressed="true"]{border:2px solid var(--blue);padding:15px;background:var(--soft)}.node strong{display:block;font-size:15px;white-space:normal;overflow-wrap:anywhere;line-height:1.45;margin:4px 0}.node .meta{display:block}.node .state{font-size:12px;color:var(--muted)}.node[data-status="completed"] .state{color:var(--green)}.node[data-status="failed"] .state{color:var(--red)}.node[data-status="running"] .state{color:var(--blue)}aside{border-left:1px solid var(--line);background:var(--surface);padding:24px;min-width:0}h1{font-size:18px;margin:0 0 6px;letter-spacing:-.02em;overflow-wrap:anywhere}h2{font-size:14px;margin:28px 0 12px}.field{display:block;margin-top:20px}.field span{display:block;font-size:12px;font-weight:600;margin-bottom:6px}.field input,.field textarea,.field select{width:100%;padding:9px 10px;border:1px solid var(--line);border-radius:8px;background:var(--surface)}.field textarea{min-height:112px;resize:vertical;line-height:1.65}.field textarea[readonly],.field input[readonly]{background:#f7f7f4}.edge{padding:12px 0;border-bottom:1px solid #e5e5e0}.edge .field{margin:6px 0 0}.edge p{margin:0;font-size:12px;color:var(--muted);overflow-wrap:anywhere}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:13px/1.7 system-ui,sans-serif;margin:0;max-height:480px;overflow:auto}footer{padding:16px 28px;border-top:1px solid var(--line);color:var(--muted);font-size:12px}#notice{color:var(--green);min-height:20px;margin-top:8px}.error{color:var(--red)!important}.empty{padding:20px 0;color:var(--muted)}
@media(max-width:860px){header{padding:16px;gap:14px;flex-wrap:wrap}.identity{order:3;flex-basis:100%}.identity input{font-size:18px}main{grid-template-columns:1fr}aside{border-left:0;border-top:1px solid var(--line);padding:24px 20px}.canvas{min-height:340px;padding:12px 20px 24px}.stage{min-height:300px}.goal{padding:20px}.primary{margin-left:auto}footer{padding:16px 20px}}@media(prefers-reduced-motion:no-preference){button{transition:background-color .15s ease-out,border-color .15s ease-out}}
</style></head><body>
<header><div class="brand">AgentFlow</div><div class="identity"><input id="name" aria-label="Flow name"><div class="meta" id="summary"></div></div><button class="primary" id="export"></button></header>
<main><section class="work"><div class="goal"><label for="goal" id="goal-label"></label><textarea id="goal"></textarea><div id="notice" role="status" aria-live="polite"></div></div><div class="canvas" aria-label="Flow"><div class="stage" id="stage"></div></div></section><aside id="inspector" aria-label="Node details"></aside></main>
<footer id="footnote"></footer>
<script type="application/json" id="data">` + payload + String.raw`</script>
<script>
'use strict';
const data=JSON.parse(document.getElementById('data').textContent),graph=data.graph,run=data.run;
const zh=/[\u3400-\u9fff]/u.test(graph.name+graph.goal);
const labels=zh?{goal:'任务目标',export:'导出 Flow',snapshot:'运行快照',edit:'编辑流程',nodes:'个节点',links:'条连接',name:'名称',system:'职责与判断标准',input:'如何使用输入',output:'交付要求',locked:'已锁定',incoming:'接收材料',result:'执行结果',ready:'就绪',waiting:'等待上游',running:'执行中',completed:'已完成',failed:'失败',agent:'Agent · 当前会话模型',source:'Input · 原始材料',empty:'此节点从任务目标开始。',saved:'已导出。将 Flow 文件交给 agent，即可校验并运行。',draftFoot:'修改后导出 Flow，交给 agent 运行。',runFoot:'此面板展示生成时的运行快照。最新进度可由 agent 重新生成。',relation:'关系'}:{goal:'Task goal',export:'Export Flow',snapshot:'Run snapshot',edit:'Edit flow',nodes:'nodes',links:'links',name:'Name',system:'Role and criteria',input:'Use of supplied material',output:'Required deliverable',locked:'Locked',incoming:'Incoming material',result:'Result',ready:'Ready',waiting:'Waiting for upstream',running:'Running',completed:'Completed',failed:'Failed',agent:'Agent · Current session model',source:'Input · Source material',empty:'This node starts from the task goal.',saved:'Exported. Give the Flow file to your agent to validate and run.',draftFoot:'Export your changes and give the Flow to your agent to run.',runFoot:'This panel shows progress when it was generated. Ask your agent to refresh the snapshot.',relation:'Relation'};
document.documentElement.lang=zh?'zh-CN':'en';document.title=graph.name+' · AgentFlow';
const el=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e};
const notice=document.getElementById('notice'),inspector=document.getElementById('inspector');
const nameField=document.getElementById('name'),goalField=document.getElementById('goal');
nameField.value=graph.name;goalField.value=graph.goal;nameField.readOnly=goalField.readOnly=!!run;
document.getElementById('goal-label').textContent=labels.goal;
document.getElementById('summary').textContent=(run?labels.snapshot:labels.edit)+' · '+Object.keys(graph.nodes).length+' '+labels.nodes+' · '+graph.links.length+' '+labels.links+(run?' · '+run.createdAt:'');
document.getElementById('footnote').textContent=run?labels.runFoot:labels.draftFoot;
document.getElementById('export').textContent=labels.export;
nameField.oninput=()=>{graph.name=nameField.value};goalField.oninput=()=>{graph.goal=goalField.value};
let selected=Object.keys(graph.nodes).find(id=>graph.nodes[id].type==='agent')||Object.keys(graph.nodes)[0];
const sources=link=>link.type==='merge'?link.sourceIds:[link.sourceId];
const stateFor=id=>run?.nodes.find(node=>node.nodeId===id)?.status||'ready';
function field(title,value,oninput,locked=false,single=false){const label=el('label',undefined,'field');label.append(el('span',title+(locked?' · '+labels.locked:'')));const control=el(single?'input':'textarea');control.value=value;control.readOnly=!!run||locked;control.oninput=()=>oninput(control.value);label.append(control);return label}
function draw(){
 const focusedId=document.activeElement?.classList.contains('node')?document.activeElement.dataset.nodeId:null;
 const stage=document.getElementById('stage');stage.replaceChildren();
 const ids=Object.keys(graph.nodes),depth=new Map(ids.map(id=>[id,0]));
 for(let i=0;i<ids.length;i++)for(const link of graph.links)for(const source of sources(link))depth.set(link.targetId,Math.max(depth.get(link.targetId),depth.get(source)+1));
 const routes=graph.links.flatMap(link=>sources(link).map(source=>({link,source,long:depth.get(link.targetId)-depth.get(source)>1})));
 const laneCount=routes.filter(route=>route.long).length;
 const rows=new Map(),positions=new Map();for(const id of ids){const d=depth.get(id),row=rows.get(d)||0;rows.set(d,row+1);positions.set(id,{x:d*310,y:50+laneCount*26+row*170})}
 const width=Math.max(280,...[...positions.values()].map(p=>p.x+240)),height=Math.max(300,...[...positions.values()].map(p=>p.y+150));
 const available=stage.parentElement.clientWidth-(innerWidth>860?56:40),scale=innerWidth>860?Math.max(.72,Math.min(1,available/width)):1;
 stage.style.width=width*scale+'px';stage.style.height=height*scale+'px';
 const scene=el('div');scene.style.cssText='position:absolute;left:0;top:0;transform-origin:top left;width:'+width+'px;height:'+height+'px;transform:scale('+scale+')';stage.append(scene);
 const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('width',width);svg.setAttribute('height',height);svg.classList.add('wires');
 const defs=document.createElementNS(ns,'defs'),marker=document.createElementNS(ns,'marker');for(const [k,v]of Object.entries({id:'arrow',viewBox:'0 0 10 10',refX:'9',refY:'5',markerWidth:'6',markerHeight:'6',orient:'auto-start-reverse'}))marker.setAttribute(k,v);const tip=document.createElementNS(ns,'path');tip.setAttribute('d','M 0 0 L 10 5 L 0 10 z');tip.setAttribute('fill','#8a8983');marker.append(tip);defs.append(marker);svg.append(defs);
 let lane=0;
 for(const {link,source,long} of routes){const a=positions.get(source),b=positions.get(link.targetId),path=document.createElementNS(ns,'path'),laneY=20+lane*26;if(long)lane++;
 path.setAttribute('d',long?'M '+(a.x+220)+' '+(a.y+36)+' H '+(a.x+246)+' V '+laneY+' H '+(b.x-26)+' V '+(b.y+36)+' H '+b.x:'M '+(a.x+220)+' '+(a.y+64)+' C '+(a.x+265)+' '+(a.y+64)+', '+(b.x-45)+' '+(b.y+64)+', '+b.x+' '+(b.y+64));path.setAttribute('stroke','#8a8983');path.setAttribute('fill','none');path.setAttribute('stroke-width','1.5');path.setAttribute('stroke-linejoin','round');path.setAttribute('marker-end','url(#arrow)');svg.append(path);
 const text=document.createElementNS(ns,'text');text.setAttribute('x',long?(a.x+220+b.x)/2:a.x+245);text.setAttribute('y',long?laneY-6:a.y+53);text.setAttribute('fill','#62625c');text.setAttribute('font-size','12');text.textContent=link.type;svg.append(text)}scene.append(svg);
 for(const id of ids){const node=graph.nodes[id],p=positions.get(id),button=el('button',undefined,'node');button.style.left=p.x+'px';button.style.top=p.y+'px';button.dataset.nodeId=id;button.dataset.status=stateFor(id);button.setAttribute('aria-pressed',String(selected===id));button.append(el('span',node.type==='agent'?labels.agent:labels.source,'meta'),el('strong',node.name),el('span',run?labels[stateFor(id)]:id,'state'));button.onclick=()=>{selected=id;draw();inspect()};scene.append(button);if(focusedId===id)button.focus({preventScroll:true})}
}
function inspect(){
 inspector.replaceChildren();const node=graph.nodes[selected];if(!node)return;
 inspector.append(el('h1',node.name),el('div',selected,'meta'));
 inspector.append(field(labels.name,node.name,value=>{node.name=value;draw()},false,true));
 if(node.type==='agent')for(const key of ['system','input','output'])inspector.append(field(labels[key],node.prompts[key].content,value=>{node.prompts[key].content=value;node.prompts[key].customized=true},node.prompts[key].locked));
 if(node.type==='input')for(const item of node.items)inspector.append(field(item.name+(item.hidden?' (hidden)':''),item.content,value=>item.content=value,item.hidden));
 inspector.append(el('h2',labels.incoming));const incoming=graph.links.filter(link=>link.targetId===selected);
 if(!incoming.length)inspector.append(el('p',labels.empty,'empty'));
 for(const link of incoming){const row=el('div',undefined,'edge');row.append(el('p',sources(link).map(id=>graph.nodes[id].name).join(' + ')));if(link.type==='input'||link.type==='merge'||run)row.append(el('div',link.type));else{const label=el('label',undefined,'field');label.append(el('span',labels.relation));const select=el('select');for(const relation of ['pass','review','revise']){const option=el('option',relation);option.value=relation;select.append(option)}select.value=link.type;select.onchange=()=>{link.type=select.value;draw()};label.append(select);row.append(label)}inspector.append(row)}
 const artifact=run?.artifacts.find(a=>a.nodeId===selected);if(artifact){inspector.append(el('h2',labels.result),el('pre',artifact.content))}
 const error=run?.nodes.find(n=>n.nodeId===selected)?.error;if(error)inspector.append(el('p',error,'error'));
}
document.getElementById('export').onclick=()=>{
 if(!graph.name.trim()||Object.values(graph.nodes).some(n=>!n.name.trim())){notice.className='error';notice.textContent=zh?'请填写 Flow 和节点名称。':'Fill in the Flow and node names.';return}
 const blob=new Blob([JSON.stringify(graph,null,2)+'\n'],{type:'application/json'}),url=URL.createObjectURL(blob),link=el('a');link.href=url;link.download='flow.json';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);notice.className='';notice.textContent=labels.saved;
};
addEventListener('resize',draw);draw();inspect();
</script></body></html>`;
}

// src/host-commands.ts
function action(callback) {
  return async (...args) => {
    try {
      process.stdout.write(JSON.stringify(await callback(...args), null, 2) + "\n");
    } catch (error) {
      process.stderr.write(JSON.stringify({ error: formatValidationError(error) }) + "\n");
      process.exitCode = 1;
    }
  };
}
function registerHostCommands(program3) {
  const host = program3.command("host").description("Execute a Flow with the current coding-agent session; every command returns JSON");
  host.command("validate").argument("<graph>").action(action(async (path) => {
    const graph = validateHostGraph(parseGraph(await readFile2(invocationPath(path), "utf8")));
    return { valid: true, name: graph.name, nodes: Object.keys(graph.nodes).length };
  }));
  host.command("start").argument("<graph>").option("--workspace <directory>", "working directory for host Agents", ".").option("--run-dir <directory>", "allocate a new run at this path").action(action(async (path, options) => {
    const graph = validateHostGraph(parseGraph(await readFile2(invocationPath(path), "utf8")));
    return startHostRun(graph, invocationPath(options.workspace), options.runDir ? invocationPath(options.runDir) : void 0);
  }));
  host.command("status").argument("<run>").action(action(async (path) => {
    const directory = invocationPath(path);
    return describeHostRun(directory, await readHostRun(directory));
  }));
  host.command("next").argument("<run>").option("--node <id>", "claim a particular ready Agent").action(action(async (path, options) => {
    const directory = invocationPath(path);
    return withHostRun(directory, (run) => {
      const claimed = claimHostTask(run, newTaskId(), (/* @__PURE__ */ new Date()).toISOString(), options.node);
      return claimed ? describeHostTask(directory, run, claimed.task) : { task: null, ...describeHostRun(directory, run) };
    });
  }));
  host.command("request").argument("<run>").argument("<task>").action(action(async (path, id) => {
    const directory = invocationPath(path);
    const run = await readHostRun(directory);
    const task = run.tasks.find((task2) => task2.id === id);
    if (!task || task.status !== "running") throw new Error("Task is not running. Inspect host status.");
    return describeHostTask(directory, run, task);
  }));
  host.command("submit").argument("<run>").argument("<task>").requiredOption("--file <path>", "UTF-8 Markdown result file").action(action(async (path, taskId, options) => {
    const content = await readFile2(invocationPath(options.file), "utf8");
    const directory = invocationPath(path);
    return withHostRun(directory, (run) => {
      const artifact = submitHostTask(run, taskId, content, (/* @__PURE__ */ new Date()).toISOString());
      return { artifactId: artifact.id, ...describeHostRun(directory, run) };
    });
  }));
  host.command("fail").argument("<run>").argument("<task>").requiredOption("--reason <text>", "why execution stopped").action(action(async (path, taskId, options) => {
    const directory = invocationPath(path);
    return withHostRun(directory, (run) => {
      failHostTask(run, taskId, options.reason, (/* @__PURE__ */ new Date()).toISOString());
      return describeHostRun(directory, run);
    });
  }));
  host.command("retry").argument("<run>").argument("<node>").action(action(async (path, nodeId) => {
    const directory = invocationPath(path);
    return withHostRun(directory, (run) => {
      const claimed = retryHostTask(run, nodeId, newTaskId(), (/* @__PURE__ */ new Date()).toISOString());
      return describeHostTask(directory, run, claimed.task);
    });
  }));
  host.command("panel").argument("<graph-or-run>").requiredOption("--out <html>", "write a standalone HTML panel").action(action(async (path, options) => {
    const source = invocationPath(path);
    const run = (await stat(source)).isDirectory() ? await readHostRun(source) : void 0;
    const graph = run?.graph ?? validateHostGraph(parseGraph(await readFile2(source, "utf8")));
    const output = invocationPath(options.out);
    if (output === source) throw new Error("Panel output must be a new HTML file.");
    await writeFile2(output, createHostPanel(graph, run), { encoding: "utf8", flag: "wx" });
    return { panelPath: output, mode: run ? "run-snapshot" : "edit", name: graph.name };
  }));
}

// src/skill-install.ts
import { access } from "fs/promises";
import { fileURLToPath } from "url";
function registerSkillCommands(program3) {
  program3.command("skill").description("Install the independent AgentFlow Skill").command("install").requiredOption("--host <host>", "codex, claude, or both").option("--project <directory>", "install for one project").option("--user", "install for the current user").option("--revision <sha>", "commit used to obtain this Skill directory").action(async (options) => {
    try {
      const candidates = [new URL("../", import.meta.url), new URL("../../../dist/skills/agentflow/", import.meta.url)];
      const source = await (async () => {
        for (const candidate of candidates) if (await access(new URL("bundle.json", candidate)).then(() => true, () => false)) return candidate;
        throw new Error("Use the complete skills/agentflow bundle to install the Skill.");
      })();
      const { installSkill } = await import(new URL("scripts/skill-setup.mjs", source).href);
      process.stdout.write(`${JSON.stringify(await installSkill({ ...options, source: fileURLToPath(source) }), null, 2)}
`);
    } catch (error) {
      process.stderr.write(`${JSON.stringify({ error: String(error) })}
`);
      process.exitCode = 1;
    }
  });
}

// src/index.ts
var program2 = new Command();
async function readGraph(path) {
  const invocationDirectory = process.env.INIT_CWD ?? process.cwd();
  const absolutePath = resolve2(invocationDirectory, path);
  const source = await readFile3(absolutePath, "utf8");
  return { graph: parseGraph(source), absolutePath };
}
function printEvent(event) {
  const time = event.at.slice(11, 19);
  if (event.type === "node.status") {
    process.stdout.write(`${time}  ${event.status.padEnd(9)} ${event.nodeId}
`);
    return;
  }
  if (event.type === "artifact.created") {
    process.stdout.write(`${time}  artifact  ${event.nodeId} \u2192 v${event.artifact.version}
`);
    return;
  }
  process.stdout.write(`${time}  ${event.message}
`);
}
program2.name("agentflow").description("Run AgentFlow graphs from the command line").version("0.2.0");
program2.command("validate").argument("<graph>", "YAML or JSON graph file").option("--json", "print machine-readable output").action(async (path, options) => {
  try {
    const { graph, absolutePath } = await readGraph(path);
    const result = {
      valid: true,
      path: absolutePath,
      name: graph.name,
      nodes: Object.keys(graph.nodes).length,
      links: graph.links.length
    };
    process.stdout.write(options.json ? `${JSON.stringify(result)}
` : `Valid graph \xB7 ${graph.name} \xB7 ${result.nodes} nodes \xB7 ${result.links} links
`);
  } catch (error) {
    process.stderr.write(`${formatValidationError(error)}
`);
    process.exitCode = 1;
  }
});
program2.command("run").argument("<graph>", "YAML or JSON graph file").option("--json", "print the completed run as JSON").option("--no-delay", "run the fake provider without simulated latency").action(async (path, options) => {
  try {
    const { graph } = await readGraph(path);
    const result = await executeGraph(graph, {
      delayMs: options.delay === false ? 0 : 420,
      onEvent: options.json ? void 0 : printEvent
    });
    if (options.json) process.stdout.write(`${JSON.stringify(result, null, 2)}
`);
    else process.stdout.write(`
${result.runId} \xB7 ${result.artifacts.length} artifacts \xB7 completed
`);
  } catch (error) {
    process.stderr.write(`${formatValidationError(error)}
`);
    process.exitCode = 1;
  }
});
registerHostCommands(program2);
registerSkillCommands(program2);
await program2.parseAsync(process.argv);
