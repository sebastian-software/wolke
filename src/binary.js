/* eslint-disable no-console */
import meow from "meow"
import chalk from "chalk"
import updateNotifier from "update-notifier"
import AWSSDK from "aws-sdk"
import dotenv from "dotenv"

import { appPkg } from "./common/appPackage"

import defaultCommand from "./commands/defaultCommand"
import initCommand from "./commands/initCommand"
import certCommand from "./commands/certCommand"
import deployCommand from "./commands/deployCommand"
import releaseCommand from "./commands/releaseCommand"
import statusCommand from "./commands/statusCommand"
import versionCommand from "./commands/versionCommand"

import pkg from "../package.json"

dotenv.load()

const appInfo = ` running on ${chalk.bold.blue(appPkg.name)}-${appPkg.version}`

const IS_INTERACTIVE = process.stdout.isTTY

if (IS_INTERACTIVE) {
  process.stdout.write(
    process.platform === "win32" ? "\x1Bc" : "\x1B[2J\x1B[3J\x1B[H"
  )
}

AWSSDK.config.setPromisesDependency(require("bluebird")) // eslint-disable-line import/no-commonjs

console.log(chalk.bold(`WOLKE ${chalk.green(`v${pkg.version}`)}`) + appInfo)
console.log()

// Parse arguments
const command = meow(`
  Usage:
    $ wolke [<command>]

  Options:
    --no-interaction   Abort with exit code > 0 if interaction is required.
    --verbose, -v      Generate verbose output messages.
    --quiet, -q        Reduce amount of output messages to warnings and errors.
    --help, -h         Show this help

  Without command:     Initialize and deploy app

  Commands:
    init               Initialize WOLKE
    cert               Checks and initialize certificate configuration

    deploy             Deploy app to development stage
    release            Deploy current development stage to production

    status             Show current state of deployments
    version            Print version number

`, {
    alias: {
      v: "verbose",
      q: "quiet",
      h: "help"
    }
  })

const selectedTask = command.input[0] || "default"
const flags = command.flags

// Check for updates first
/* eslint-disable no-magic-numbers */
updateNotifier({
  pkg,

  // check every hour
  updateCheckInterval: 1000 * 60 * 60
}).notify()

// List of tasks we have available
const availableTasks = new Map(
  [
    [ "default", defaultCommand ],
    [ "init", initCommand ],
    [ "cert", certCommand ],
    [ "deploy", deployCommand ],
    [ "release", releaseCommand ],
    [ "status", statusCommand ],
    [ "version", versionCommand ]
  ]
)

// Prevent deprecation messages which should not be displayed to the end user
if (!flags.verbose) {
  process.noDeprecation = true
}

async function executeTask() {
  const taskCommand = availableTasks.get(selectedTask)

  const context = {
    task: selectedTask,
    flags,
    parameter: command.input.slice(1)
  }

  try {
    return await taskCommand(context)
  } catch (error) {
    console.error(chalk.bold.red(`Failed to execute task: ${selectedTask}!`))
    console.error(error)
    return 1
  }
}

if (flags.help || !availableTasks.has(selectedTask)) {
  command.showHelp()
} else {
  executeTask()
    .then((exitCode) => process.exit(exitCode)) // eslint-disable-line no-process-exit
    .catch((error) => console.error(chalk.red(error)))
}
