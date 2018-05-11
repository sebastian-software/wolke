import chalk from "chalk"
import { ROOT } from "./appPackage"
import get from "lodash/get"
import Promise from "bluebird"
import { safeLoad, safeDump } from "js-yaml"
import * as filesystem from "fs"
import * as path from "path"

const readFile = Promise.promisify(filesystem.readFile) // eslint-disable-line
const writeFile = Promise.promisify(filesystem.writeFile) // eslint-disable-line

function checkCloudflareEnvironment() {
  return (
    "CLOUDFLARE_EMAIL" in process.env &&
    process.env.CLOUDFLARE_EMAIL.length > 0 &&
    "CLOUDFLARE_TOKEN" in process.env &&
    process.env.CLOUDFLARE_TOKEN.length > 0
  )
}

let configCache = null
async function readConfigurationFile() {
  if (configCache) {
    return configCache
  }
  try {
    const content = await readFile(path.join(ROOT, "wolke.yml"))
    configCache = safeLoad(content)

    return configCache
  } catch (error) {
    console.error(error)
    return null
  }
}

export async function configurationAvailable() {
  const wolkeConfig = await readConfigurationFile()
  return wolkeConfig && checkCloudflareEnvironment()
}

export async function getConfiguration() {
  const wolkeConfig = await readConfigurationFile()

  if (!wolkeConfig) {
    throw new Error("No configuration from wolke.yml loaded")
  }

  return {
    value: (key) => get(wolkeConfig, key),
    hasErrors: false,
    errors: []
  }
}

export async function writeConfiguration(content) {
  const ymlContent = safeDump(content)
  await writeFile(path.join(ROOT, "wolke.yml"), ymlContent)
}

export function printConfigurationErrors(configuration) {
  configuration.errors.forEach((element) => {
    console.log(chalk.red(`- ${element}`))
  })

  return 1
}

export async function getClaudiaConfig(key) {
  try {
    const config = JSON.parse(await readFile(path.join(ROOT, "claudia.json"), "utf8"))

    return get(config, key)
  } catch (error) {
    return null
  }
}
