import chalk from "chalk"
import get from "lodash/get"
import {
  configurationAvailable,
  getConfiguration,
  printConfigurationErrors
} from "../common/configuration"
import initCommand from "./initCommand"

import {
  getCustomDomainNames,
  getBasePathMappings,
  getApiByName
} from "../common/apiGateway"
import {
  getVersionNumber as getLambdaVersion
} from "../common/lambda"
import {
  appPkg
} from "../common/appPackage"

export default async function statusCommand(context) {
  if (!await configurationAvailable()) {
    return await initCommand(context)
  }

  const configuration = await getConfiguration()
  if (configuration.hasErrors) {
    console.log(chalk.red("wolke configuration has errors"))
    return printConfigurationErrors(configuration)
  }

  const restApiId = (await getApiByName(appPkg.name)).id

  const customDomainNames = (await getCustomDomainNames())
    .items
    .map((item) => ({
      domainName: item.domainName,
      distributionDomainName: item.distributionDomainName
    }))

  const basePathMappings = (await Promise.all(
    customDomainNames.map(
      (item) => getBasePathMappings(item.domainName)
        .then((basePathMapping) => ({
          ...item,
          stage: get(basePathMapping, "items[0].stage"),
          restApiId: get(basePathMapping, "items[0].restApiId")
        }))
    )
  )).filter((item) => item.restApiId === restApiId)

  const lambdaDeployments = await Promise.all(
    basePathMappings.map(
      (item) => getLambdaVersion(`wolke-${appPkg.name}`, item.stage)
        .then((lambdaVersion) => ({
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

  console.log(`
Current deployment status of ${appPkg.name}:


  `)
  console.log(">>>", JSON.stringify(result, null, 2))
  return 0
}
