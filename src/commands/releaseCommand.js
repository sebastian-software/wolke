import chalk from "chalk"
import {
  configurationAvailable,
  getConfiguration,
  printConfigurationErrors
} from "../common/configuration"
import initCommand from "./initCommand"

export default async function releaseCommand(context) {
  if (!await configurationAvailable()) {
    return await initCommand(context)
  }

  const configuration = await getConfiguration()
  if (configuration.hasErrors) {
    console.log(chalk.red("wolke configuration has errors"))
    return printConfigurationErrors(configuration)
  }

  console.log("RELEASE", context)
  return 0
}
