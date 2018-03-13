import { spawn } from "child_process"
import Promise from "bluebird"
import { ROOT } from "./appPackage"
import whichFnt from "which"
import path from "path"
import filesystem from "fs"
import chalk from "chalk"
import readline from "readline"
import mkdirp from "mkdirp"
import rimrafFnt from "rimraf"

export const which = Promise.promisify(whichFnt) // eslint-disable-line
export const fileAccess = Promise.promisify(filesystem.access) // eslint-disable-line
export const fileWrite = Promise.promisify(filesystem.writeFile) // eslint-disable-line
export const fileAppend = Promise.promisify(filesystem.appendFile) // eslint-disable-line
export const fileRead = Promise.promisify(filesystem.readFile) // eslint-disable-line
export const mkdir = Promise.promisify(mkdirp) // eslint-disable-line
export const rimraf = Promise.promisify(rimrafFnt) // eslint-disable-line
export const chmod = Promise.promisify(filesystem.chmod) // eslint-disable-line

export async function exec(context, command, ...parameter) {
  const absoluteCommand = await which(command, {
    path: `${path.join(ROOT, "node_modules", ".bin")}${path.delimiter}${process.env.PATH}`
  })

  if (context.flags.verbose) console.log(chalk.yellow(command, ...parameter))

  return new Promise((resolve) => {
    const proc = spawn(absoluteCommand, parameter, {
      cwd: context.cwd || ROOT
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

const DEFAULT_NODE_VERSION = "8"
// const DEFAULT_NODE_VERSION = "6"

// Runs npm inside of docker if not on a linux system
export async function execDockerNpm(context, command, ...parameter) {
  if (process.platform === "linux") {
    return execNpm(context, command, ...parameter)
  }

  await mkdir(`${context.cwd}/.npm_cache`)

  return exec(
    context,
    "docker",
    "run",
    "-v",
    `${context.cwd}:/usr/src/app`,
    "-v",
    `${context.cwd}/.npm_cache:/home/node/.npm`,
    "--workdir",
    "/usr/src/app",
    "--rm",
    "--user",
    "node",
    `node:${DEFAULT_NODE_VERSION}`,
    "npm",
    command,
    ...parameter
  )
}

export function execClaudia(context, command, ...parameter) {
  return exec(context, "claudia", command, ...parameter)
}

export function sleep(time) {
  return new Promise((resolve) => {
    setTimeout(() => resolve(), time)
  })
}

export function fileAccessible(filename) {
  return fileAccess(filename, filesystem.constants.R_OK)
    .then((result) => {
      return true
    })
    .catch((error) => {
      return false
    })
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
  } catch (error) {
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
    return !lines.some((contentItem) => comparator(item, contentItem))
  })

  await fileWrite(filename, filterContent.concat(lines).join("\n"))
}

export function copyFile(src, dst) {
  return new Promise((resolve, reject) => {
    const dstStream = filesystem.createWriteStream(dst)
    const srcStream = filesystem.createReadStream(src)

    srcStream
      .pipe(dstStream)
      .on("close", () => resolve())
      .on("error", (error) => reject(error))
  })
}

export function makeExecutable(file) {
  return chmod(file, "755")
}
