import { configurationAvailable } from "../common/configuration"
import { execNpm } from "../common/io"
import initCommand from "./initCommand"

export default async function defaultCommand(context) {
  if (!await configurationAvailable()) {
    return await initCommand(context)
  }

  await execNpm(context, "run", "wolke:deploy")
  return 0
}
