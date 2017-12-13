import chalk from "chalk"
import ora from "ora"

import {
  configurationAvailable,
  getConfiguration,
  printConfigurationErrors,
  getClaudiaConfig
} from "../common/configuration"
import {
  execClaudia
} from "../common/io"
import {
  findZone,
  findDnsRecord,
  updateDnsRecord,
  createDnsRecord
} from "../common/cloudflare"
import {
  assignPathToDomain,
  domainToZone
} from "../common/domain"
import {
  getCertIdForDomain
} from "../common/cert"
import initCommand from "./initCommand"
import certCommand from "./certCommand"

export default async function releaseCommand(context) {
  let spinner

  if (!await configurationAvailable()) {
    return await initCommand(context)
  }

  const configuration = await getConfiguration()
  if (configuration.hasErrors) {
    console.log(chalk.red("wolke configuration has errors"))
    return printConfigurationErrors(configuration)
  }

  await certCommand(context)

  spinner = ora("Start release process").start()

  const claudiaExitCode = await execClaudia(
    context,
    "set-version",
    "--version",
    "production"
  )

  if (claudiaExitCode.code > 0) {
    spinner.fail("Could not set current version to production")
    return claudiaExitCode.code
  }

  spinner.succeed("Release of production version done")

  const prodDomain = configuration.value("productionDomain")
  spinner = ora(`Set up domain ${prodDomain}`).start()
  const devCertId = await getCertIdForDomain(prodDomain)
  const result = await assignPathToDomain(
    prodDomain,
    devCertId,
    await getClaudiaConfig("api.id"),
    "production",
    {
      fixedDomainName: true
    }
  )
  spinner.succeed(`Domain ${prodDomain} is set up`)

  spinner = ora("Set up DNS records").start()
  const zone = await findZone(domainToZone(result.domainName))
  const dnsRecord = await findDnsRecord(zone, result.domainName)
  if (dnsRecord) {
    spinner.text = "Update DNS record"
    await updateDnsRecord(
      zone,
      dnsRecord,
      {
        cname: result.distributionDomainName
      }
    )
    spinner.succeed("DNS record updated")
  } else {
    spinner.text = "Create DNS record"
    await createDnsRecord(
      zone,
      result.domainName,
      {
        cname: result.distributionDomainName
      }
    )
    spinner.succeed("DNS record created")
  }

  return 0
}
