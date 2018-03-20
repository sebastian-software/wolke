/*
 * NodeJS build environment
 */
/* eslint-disable security/detect-non-literal-fs-filename, max-statements */

import path from "path"
import tar from "tar"
import filesystem from "fs"
import request from "request"
import archiver from "archiver"

import { execNpm, execDockerNpm, mkdir, rimraf, copyFile, makeExecutable, fileWrite } from "./io"
import { ROOT, appPkg } from "./appPackage"
import { handleExpressApp } from "./lambda"
import { getServerlessYmlContent } from "./serverless"

function unpack(tarFile, cwd, options = {}) {
  return new Promise((resolve) => {
    filesystem
      .createReadStream(tarFile)
      .pipe(
        tar.x({
          ...options,
          cwd
        })
      )
      .on("end", () => resolve())
  })
}

function requestNode(cwd, version = "8.9.4") {
  return new Promise((resolve) => {
    request(`https://nodejs.org/dist/v8.9.4/node-v${version}-linux-x64.tar.gz`)
      .pipe(
        tar.x({
          cwd,
          strip: 1
        })
      )
      .on("end", () => resolve())
  })
}

async function pack(distArchive, distPath) {
  return new Promise((resolve, reject) => {
    const output = filesystem.createWriteStream(distArchive)
    const archive = archiver("zip", {
      zlib: { level: 9 }
    })

    output.on("close", () => {
      console.log(`${archive.pointer()} total bytes`)
      console.log("archiver has been finalized and the output file descriptor has closed.")

      resolve(distArchive)
    })

    output.on("end", () => {
      console.log("Data has been drained")
    })

    archive.on("warning", (error) => {
      if (error.code === "ENOENT") {
        // log warning
      } else {
        // throw error
        throw error
      }
    })

    // good practice to catch this error explicitly
    archive.on("error", (error) => {
      throw error
    })

    archive.pipe(output)

    archive.directory(distPath, false)
    archive.finalize()
  })
}

async function createServerlessConfig(basePath) {
  const serverlessYmlPath = path.join(basePath, "serverless.yml")
  await fileWrite(serverlessYmlPath, getServerlessYmlContent())
}

export async function createDistribution(context) {
  try {
    // await execNpm(context, "install")
    // await execNpm(context, "run", "build")
    await execNpm(context, "pack")

    const packagedFilename = path.join(ROOT, `${appPkg.name}-${appPkg.version}.tgz`)
    const outputFilename = path.join(ROOT, `${appPkg.name}-${appPkg.version}.zip`)

    const tmpDistPath = path.join(ROOT, "tmpDist")

    const appPath = path.join(tmpDistPath, "app")
    const newContext = {
      ...context,
      cwd: appPath
    }

    await rimraf(tmpDistPath)
    await mkdir(tmpDistPath)
    await mkdir(appPath)
    await unpack(packagedFilename, appPath, {
      strip: 1
    })

    await execDockerNpm(newContext, "install", "--production")
    await handleExpressApp(newContext)

    const wolkeProxy = path.join(tmpDistPath, "wolke-proxy.js")
    await copyFile("/Users/bs5/Code/wolke-proxy/bin/wolke-proxy", wolkeProxy)
    await makeExecutable(wolkeProxy)

    const wolkeShell = path.join(tmpDistPath, "wolke-shell.sh")
    await copyFile("/Users/bs5/Code/wolke-proxy/wolke-shell.sh", wolkeShell)
    await makeExecutable(wolkeShell)

    const wolkeNpmSimulation = path.join(tmpDistPath, "npm")
    await copyFile("/Users/bs5/Code/wolke-proxy/npm-simulation.js", wolkeNpmSimulation)
    await makeExecutable(wolkeNpmSimulation)

    const nodePath = path.join(tmpDistPath, "node")
    await mkdir(nodePath)
    await requestNode(nodePath)

    await createServerlessConfig(tmpDistPath)

    return {
      path: tmpDistPath,
      context: newContext
    } // await pack(outputFilename, tmpDistPath)
  } catch (error) {
    console.error(error)
    throw error
  }
}
