import chalk from "chalk"
import { appPkg, ROOT } from "./appPackage"
import get from "lodash/get"
import Promise from "bluebird"
import filesystem from "fs"
import path from "path"

const readFile = Promise.promisify(filesystem.readFile) // eslint-disable-line

function checkCloudflareEnvironment() {
  return "CLOUDFLARE_EMAIL" in process.env &&
    process.env.CLOUDFLARE_EMAIL.length > 0 &&
    "CLOUDFLARE_TOKEN" in process.env &&
    process.env.CLOUDFLARE_TOKEN.length > 0
}

export async function configurationAvailable() {
  return "wolke" in appPkg && checkCloudflareEnvironment()
}

export async function getConfiguration() {
  return {
    value: (key) => get(appPkg, `wolke.${key}`),
    hasErrors: false,
    errors: []
  }
}

export function printConfigurationErrors(configuration) {
  configuration.errors.forEach((element) => {
    console.log(chalk.red(`- ${element}`))
  })

  return 1
}

export async function getClaudiaConfig(key) {
  try {
    const config = JSON.parse(
      await readFile(path.join(ROOT, "claudia.json"), "utf8")
    )

    return get(config, key)
  } catch (error) {
    return null
  }
}
