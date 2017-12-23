import chalk from "chalk"
import ora from "ora"

import {
  configurationAvailable,
  getConfiguration,
  printConfigurationErrors
} from "../common/configuration"
import {
  getCertIdForDomain,
  getWildcardCertIdForDomain,
  requestNewCert
} from "../common/cert"
import initCommand from "./initCommand"

export default async function certCommand(context) {
  if (!await configurationAvailable()) {
    return await initCommand(context)
  }

  const configuration = await getConfiguration()
  if (configuration.hasErrors) {
    console.log(chalk.red("wolke configuration has errors"))
    return printConfigurationErrors(configuration)
  }

  const spinner = ora("Check if certificates are valid").start()
  const devDomain = configuration.value("developmentDomain")
  const prodDomain = configuration.value("productionDomain")

  // Don't do anything with certs if there is no domain name in configuration
  let devCertId = true
  let prodCertId = true

  if (devDomain) {
    devCertId = await getWildcardCertIdForDomain(devDomain)
  }
  if (prodDomain) {
    prodCertId = await getCertIdForDomain(prodDomain)
  }

  if (!devCertId && !prodCertId) {
    spinner.fail(
      `No certificate for ${devDomain} (development statge)
       and ${prodDomain} (production stage) assigned`
    )
  } else if (!devCertId) {
    spinner.fail(`No certificate for ${devDomain} (development statge) assigned`)
  } else if (!prodCertId) {
    spinner.fail(`No certificate for  ${prodDomain} (production stage) assigned`)
  } else {
    spinner.succeed("All certificates correctly assigned")
  }

  if (!devCertId) {
    devCertId = await requestNewCert(devDomain, {
      wildcard: true
    })
  }

  if (!prodCertId) {
    prodCertId = await requestNewCert(prodDomain)
  }

  if (context.flags.verbose) {
    console.log(`${chalk.cyan("Development certificate: ")} ${chalk.green(devCertId)}`)
    console.log(`${chalk.cyan("Production certificate: ")} ${chalk.green(prodCertId)}`)
  }

  return 0
}
