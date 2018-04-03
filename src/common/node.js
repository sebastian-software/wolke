/*
 * NodeJS build environment
 */
/* eslint-disable security/detect-non-literal-fs-filename, max-statements */

import path from "path"
import tar from "tar"
import filesystem from "fs"

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

async function createServerlessConfig(basePath) {
  const serverlessYmlPath = path.join(basePath, "serverless.yml")
  await fileWrite(serverlessYmlPath, getServerlessYmlContent())
}

export async function createDistribution(context) {
  try {
    await execNpm(context, "install")
    await execNpm(context, "run", "build")
    await execNpm(context, "pack")

    const packagedFilename = path.join(ROOT, `${appPkg.name}-${appPkg.version}.tgz`)

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
    await rimraf(path.join(appPath, ".npm_cache"))

    const wolkeProxy = path.join(tmpDistPath, "wolke-proxy.js")
    await copyFile("/Users/bs5/Code/wolke-proxy/bin/wolke-proxy", wolkeProxy)
    await makeExecutable(wolkeProxy)

    await createServerlessConfig(tmpDistPath)

    return {
      path: tmpDistPath,
      context: newContext
    }
  } catch (error) {
    console.error(error)
    throw error
  }
}
