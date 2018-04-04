import { get as getRoot } from "app-root-dir"
import merge from "lodash/merge"
import fs from "fs"

export const ROOT = getRoot()

// eslint-disable-next-line security/detect-non-literal-require
export let appPkg = require(`${ROOT}/package.json`)
export async function annotatePkg(config) {
  appPkg = merge(appPkg, config)
  const configStr = JSON.stringify(appPkg, null, 2)

  await writeFile(`${ROOT}/package.json`, configStr)

  return appPkg
}

function writeFile(fileName, content) {
  // eslint-disable-next-line compat/compat
  return new Promise((resolve, reject) => {
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    fs.writeFile(fileName, content, "utf8", (err) => {
      if (err)
        return reject(err)

      return resolve()
    })
  })
}
