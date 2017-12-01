import chalk from "chalk"
import {
  configurationAvailable,
  getConfiguration,
  printConfigurationErrors
} from "../common/configuration"
import initCommand from "./initCommand"
import { findDistribution } from "../common/cloudFront"

import {
  cleanStages,
  getCustomDomainNames,
  getBasePathMappings
} from "../common/apiGateway"

import {
  findZone,
  findDnsRecord
} from "../common/cloudflare"

export default async function statusCommand(context) {
  if (!await configurationAvailable()) {
    return await initCommand(context)
  }

  const configuration = await getConfiguration()
  if (configuration.hasErrors) {
    console.log(chalk.red("wolke configuration has errors"))
    return printConfigurationErrors(configuration)
  }

  const zone = await findZone("wolke.run")
  const results = await findDnsRecord(zone, "example-development.wolke.run")
  console.log(">>>", JSON.stringify(results, null, 2))
  return 0
/*
  const r2 = await getCustomDomainNames()
  console.log(">>>", JSON.stringify(r2, null, 2))
  const results = await getBasePathMappings("example-development.wolke.run")
  console.log(">>>", JSON.stringify(results, null, 2))
  return 0
  await findDistribution()

  console.log("STATUS", context)
  return 0
  */
}
