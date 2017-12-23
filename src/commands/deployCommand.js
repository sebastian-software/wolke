import chalk from "chalk"
import path from "path"

// import baseX from "base-x"
import ora from "ora"

import {
  configurationAvailable,
  getConfiguration,
  printConfigurationErrors,
  getClaudiaConfig
} from "../common/configuration"
import {
  execNpm,
  execClaudia,
  fileAccessible
} from "../common/io"
import {
  ROOT,
  appPkg
} from "../common/appPackage"

/*
import {
  cleanStages,
  createOrGetApi,
  createOrGetVersionResource,
  createOrGetProxyResource,
  createOrGetProxyMethods
} from "../common/apiGateway"
*/

import {
  assignPathToDomain,
  domainToZone
} from "../common/domain"
import {

  // getCertIdForDomain,

  getWildcardCertIdForDomain
} from "../common/cert"

import {
  findZone,
  findDnsRecord,
  updateDnsRecord,
  createDnsRecord
} from "../common/cloudflare"

import initCommand from "./initCommand"
import certCommand from "./certCommand"

/*
const BASE36_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz"
const baseEncoder = baseX(BASE36_ALPHABET)
*/

function removeSchemeFromDomainName(domainName) {
  try {
    return domainName.split("://")[1]
  } catch (error) {
    return domainName
  }
}

/* eslint-disable max-statements */
export default async function deployCommand(context) {
  let spinner

  if (!await configurationAvailable()) {
    return await initCommand(context)
  }

  const configuration = await getConfiguration()
  if (configuration.hasErrors) {
    console.log(chalk.red("wolke configuration has errors"))
    return printConfigurationErrors(configuration)
  }

  const buildDate = (new Date()).toISOString()

  await certCommand(context)

  spinner = ora("Start build process").start()
  const exitCode = (await execNpm(context, "run", "build")).code
  if (exitCode > 0) {
    spinner.warn("'npm run build' failed. Maybe you don't need one?")
  } else {
    spinner.succeed("'npm run build' finished")
  }

  const lambdaFile = path.join(ROOT, "lambda.js")
  const sourceName = appPkg.main.substring(0, appPkg.main.length - path.extname(appPkg.main).length)

  let claudiaExitCode
  if (!await fileAccessible(lambdaFile)) {
    spinner = ora("Create serverless express proxy").start()
    claudiaExitCode = await execClaudia(
      context,
      "generate-serverless-express-proxy",
      "--express-module",
      sourceName
    )

    if (claudiaExitCode.code > 0) {
      spinner.fail("Cannot create lambda proxy")
      return 1
    }

    await execNpm(context, "install", "express")

    spinner.succeed("Serverless express proxy created")
  }

  if (!await fileAccessible(path.join(ROOT, "claudia.json"))) {
    spinner = ora(`Claudia initial deployment of ${appPkg.name} started`)
    if (!context.flags.verbose)
      spinner.start()

    claudiaExitCode = await execClaudia(
      context,
      "create",
      "--name",
      `wolke-${appPkg.name}`,
      "--cache-api-config",
      "wolkeConfigCache",
      "--handler",
      "lambda.handler",
      "--deploy-proxy-api",
      "--region",
      configuration.value("awsRegion"),
      "--version",
      "development",
      "--set-env",
      `WOLKE_DEPLOY_DATE=${buildDate}`
    )

    if (claudiaExitCode.code > 0) {
      spinner.fail("Could not deploy initial lambda function")
      return claudiaExitCode.code
    }

    spinner.succeed("Deployment of lambda function succeeded")
  } else {
    spinner = ora(`Claudia deployment of ${appPkg.name} started`)
    if (!context.flags.verbose)
      spinner.start()

    claudiaExitCode = await execClaudia(
      context,
      "update",
      "--cache-api-config",
      "wolkeConfigCache",
      "--version",
      "development",
      "--update-env",
      `WOLKE_DEPLOY_DATE=${buildDate}`
    )

    if (claudiaExitCode.code > 0) {
      spinner.fail("Could not deploy lambda function")
      return claudiaExitCode.code
    }

    spinner.succeed("Deployment of lambda function succeeded")
  }

  let result

  const devDomain = configuration.value("developmentDomain")
  spinner = ora(`Set up domain ${devDomain}`).start()
  if (devDomain) {
    const devCertId = await getWildcardCertIdForDomain(devDomain)
    result = await assignPathToDomain(
      devDomain,
      devCertId,
      await getClaudiaConfig("api.id"),
      "development"
    )
    spinner.succeed(`Domain ${devDomain} is set up`)

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
  } else {
    spinner.succeed("No custom development domain")

    result = {
      domainName: removeSchemeFromDomainName(claudiaExitCode.json.url || claudiaExitCode.json.api.url)
    }
  }

  /*
  const hash = Buffer.from(claudiaExitCode.json.CodeSha256, "base64")
  const b36Hash = baseEncoder.encode(hash).substring(0, 10)

  const restApiId = await getClaudiaConfig("api.id")
  await cleanStages(restApiId)
  */

  /*
  const restApi = await createOrGetApi(b36Hash)
  const versionResource = await createOrGetVersionResource(restApi.id, b36Hash)
  const proxyResource = await createOrGetProxyResource(restApi.id, versionResource)
  const proxyMethods = await createOrGetProxyMethods(restApi.id, proxyResource)
  console.log(">>>>", JSON.stringify(proxyMethods, null, 2))
  */

  /*
  if (claudiaExitCode.json) {
    const versionReturn = await execClaudia(
      context,
      "set-version",
      "--version",
      b36Hash,
      "--update-env",
      `WOLKE_DEPLOY_DATE=${buildDate}`
    )

    console.log(`${chalk.cyan("Deployed to")} ${chalk.green(versionReturn.json.url)}`)
  }
  */

  const deployedDomainName = `https://${result.domainName}`
  console.log(`\n${chalk.cyan("Deployed to")} ${chalk.green(deployedDomainName)}`)

  return 0
}
