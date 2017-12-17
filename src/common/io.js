import { spawn } from "child_process"
import Promise from "bluebird"
import { ROOT } from "./appPackage"
import whichFnt from "which"
import path from "path"
import filesystem from "fs"
import chalk from "chalk"
import readline from "readline"

const which = Promise.promisify(whichFnt) // eslint-disable-line
const fileAccess = Promise.promisify(filesystem.access) // eslint-disable-line
const fileWrite = Promise.promisify(filesystem.writeFile) // eslint-disable-line
const fileAppend = Promise.promisify(filesystem.appendFile) // eslint-disable-line
const fileRead = Promise.promisify(filesystem.readFile) // eslint-disable-line

export async function exec(context, command, ...parameter)
{
  const absoluteCommand = await which(command, {
    path: `${path.join(ROOT, "node_modules", ".bin")}${path.delimiter}${process.env.PATH}`
  })

  if (context.flags.verbose)
    console.log(chalk.yellow(command, ...parameter))

  return new Promise((resolve) => {
    const proc = spawn(absoluteCommand, parameter, {
      cwd: ROOT
    })

    let lastChunk = null
    proc.stdout.on("data", (data) => {
      lastChunk = data.toString("utf8")
      if (context.flags.verbose) {
        const content = lastChunk
          .split(/\n/g)
          .map((line) => `| ${line}`)
          .join("\n")
        process.stdout.write(chalk.blue(content))
        process.stdout.write("\n")
      }
    })

    proc.stderr.on("data", (data) => {
      readline.clearLine(process.stdout)
      readline.cursorTo(process.stdout, 0)
      const content = data
        .toString("utf8")
        .split(/\n/g)
        .map((line) => `| ${line}`)
        .join("\n")
      process.stdout.write(chalk.red(content))
      process.stdout.write("\n")
    })

    proc.on("close", (code) => {
      let json = null
      try {
        json = JSON.parse(lastChunk)
      } catch (error) {
        // noop
      }

      if (context.flags.verbose) {
        process.stdout.write("\n")
      }

      resolve({
        code,
        json
      })
    })
  })
}

export function execNpm(context, command, ...parameter) {
  return exec(context, "npm", command, ...parameter)
}

export function execClaudia(context, command, ...parameter) {
  return exec(
    context,
    "claudia",
    command,
    ...parameter
  )
}

export function sleep(time) {
  return new Promise((resolve) => {
    setTimeout(() => resolve(), time)
  })
}

export function fileAccessible(filename) {
  return fileAccess(filename, filesystem.constants.R_OK)
    .then((result) => { return true })
    .catch((error) => { return false })
}

export function writeContent(filename, content) {
  return fileWrite(filename, content)
}

export function appendContent(filename, content) {
  return fileAppend(filename, `\n${content}`)
}

export const identityComparator = (a, b) => a === b
export const preEqualComparator = (a, b) => {
  try {
    return identityComparator(a.split("=")[0], b.split("=")[0])
  }
  catch (error) {
    return false
  }
}

export async function ensureContent(filename, lines, comparator = identityComparator) {
  let content = []

  try {
    content = (await fileRead(filename, "utf8")).split("\n")
  } catch (error) {
    // noop
  }

  const filterContent = content.filter((item) => {
    return !lines.some(
      (contentItem) => comparator(item, contentItem)
    )
  })

  await fileWrite(filename, filterContent.concat(lines).join("\n"))
}
