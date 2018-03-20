import chalk from "chalk"

import { configurationAvailable, getConfiguration, printConfigurationErrors } from "../common/configuration"
import { createDistribution } from "../common/node"
import { appPkg } from "../common/appPackage"

import { checkVersionDeployed } from "../common/lambda"
import { runServerless } from "../common/serverless"

import { findZone, findDnsRecord, updateDnsRecord, createDnsRecord } from "../common/cloudflare"

import initCommand from "./initCommand"
import certCommand from "./certCommand"

function getBaseDomainName(domainName) {
  const splittedNames = domainName.split(".")
  const length = splittedNames.length

  return `${splittedNames[length - 2]}.${splittedNames[length - 1]}`
}

async function ensureDnsSetting(domainName, distributionDomainName) {
  const zone = await findZone(getBaseDomainName(domainName))
  const dnsRecord = await findDnsRecord(zone, domainName)

  if (!dnsRecord) {
    return await createDnsRecord(zone, domainName, {
      cname: distributionDomainName
    })
  }
  return await updateDnsRecord(zone, dnsRecord, {
    cname: distributionDomainName
  })
}

/* eslint-disable max-statements */
export default async function deployCommand(context) {
  if (!await configurationAvailable()) {
    return await initCommand(context)
  }

  const configuration = await getConfiguration()
  if (configuration.hasErrors) {
    console.log(chalk.red("wolke configuration has errors"))
    return printConfigurationErrors(configuration)
  }

  // const buildDate = new Date().toISOString()

  await certCommand(context)

  const isDeployed = await checkVersionDeployed(appPkg.name, appPkg.version)
  if (isDeployed) {
    console.error(
      chalk.red(
        `Version ${appPkg.version} is already deployed! Please update your version number in package.json`
      )
    )
  }

  const dist = await createDistribution(context)

  const result = await runServerless(context, dist.context, dist.path, context.flags.stage)

  await ensureDnsSetting(result.domainName, result.distributionDomainName)

  const deployedDomainName = `https://${result.domainName}`
  console.log(`\n${chalk.cyan("Deployed to")} ${chalk.green(deployedDomainName)}`)

  return 0
}
