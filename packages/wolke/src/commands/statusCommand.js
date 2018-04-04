import chalk from "chalk"
import get from "lodash/get"
import { configurationAvailable, getConfiguration, printConfigurationErrors } from "../common/configuration"
import initCommand from "./initCommand"

import { getCustomDomainNames, getBasePathMappings, getApiByName } from "../common/apiGateway"
import { getVersionNumber as getLambdaVersion } from "../common/lambda"
import { appPkg } from "../common/appPackage"

function outputStage(data, stage) {
  const d = get(data, stage)

  return `Stage ${chalk.yellow(stage)}:
  Version:                  ${chalk.cyan(d.version)}
  Distribution domain name: ${chalk.cyan(d.distributionDomainName)}
  Public domain name:       ${chalk.cyan(d.domainName)}`
}

export default async function statusCommand(context) {
  console.log(chalk.red("wolke status is currently not implemented"))
  return 1

  if (!await configurationAvailable()) {
    return await initCommand(context)
  }

  const configuration = await getConfiguration()
  if (configuration.hasErrors) {
    console.log(chalk.red("wolke configuration has errors"))
    return printConfigurationErrors(configuration)
  }

  const api = await getApiByName(appPkg.name)

  if (!api) {
    console.log(chalk.cyan("no deployment found"))
    return 0
  }

  const restApiId = api.id

  const customDomainNames = (await getCustomDomainNames()).items.map((item) => ({
    domainName: item.domainName,
    distributionDomainName: item.distributionDomainName
  }))

  const basePathMappings = (await Promise.all(
    customDomainNames.map((item) =>
      getBasePathMappings(item.domainName).then((basePathMapping) => ({
        ...item,
        stage: get(basePathMapping, "items[0].stage"),
        restApiId: get(basePathMapping, "items[0].restApiId")
      }))
    )
  )).filter((item) => item.restApiId === restApiId)

  const lambdaDeployments = await Promise.all(
    basePathMappings.map((item) =>
      getLambdaVersion(`wolke-${appPkg.name}`, item.stage).then((lambdaVersion) => ({
        ...item,
        version: lambdaVersion.FunctionVersion
      }))
    )
  )

  const result = lambdaDeployments.reduce((arr, item) => {
    return {
      ...arr,
      [item.stage]: item
    }
  }, {})

  if (!result.development) {
    console.log(chalk.red("No deployment for stage development found"))
    return 0
  }

  console.log(`
Current deployment status of ${chalk.cyan(appPkg.name)} (${chalk.gray(`ID ${result.development.restApiId}`)})

${outputStage(result, "development")}

${result.production ? outputStage(result, "production") : ""}
  `)
  return 0
}
