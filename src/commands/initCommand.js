import chalk from "chalk"
import inquirer from "inquirer"
import omit from "lodash/omit"
import { dirname } from "path"

import { configurationAvailable } from "../common/configuration"
import { annotatePkg, appPkg } from "../common/appPackage"
import { execNpm, writeContent } from "../common/io"

const DEPS = [
  "claudia",
  "wolke"
]

const AWS_ZONES = [
  "us-east-1",
  "us-east-2",
  "us-west-1",
  "us-west-2",
  "ca-central-1",
  "eu-west-1",
  "eu-central-1",
  "eu-west-2",
  "ap-northeast-1",
  "ap-northeast-2",
  "ap-southeast-1",
  "ap-southeast-2",
  "ap-south-1",
  "sa-east-1"
]

function parseDefaultDistPath(modulePath, mainPath) {
  const distPath = modulePath || mainPath

  if (!distPath)
    return "."

  const dirName = dirname(distPath)
  if (!dirName)
    return "."

  return dirName
}

function validateDomain(stage) {
  return true
}

export default async function initCommand(context) {
  if (await configurationAvailable()) {
    console.log(chalk.yellow("wolke section is already available in package.json"))
    return 1
  }

  const answers = await inquirer.prompt([
    {
      type: "confirm",
      name: "continueInit",
      message: `Should I add WOLKE to your project ${appPkg.name}`
    },
    {
      type: "list",
      name: "awsRegion",
      message: "What AWS region should be used?",
      default: "eu-central-1",
      choices: AWS_ZONES,
      when: (currentAnswers) => currentAnswers.continueInit
    },
    {
      type: "input",
      name: "developmentDomain",
      message: "Custom domain for development stage (default is a random AWS assigned domain name)",
      validate: validateDomain
    },
    {
      type: "input",
      name: "productionDomain",
      message: "Custom domain for production stage (default is a random AWS assigned domain name)",
      validate: validateDomain
    },
    {
      type: "input",
      name: "parallelDeployments",
      message: "Number of parallel deployments in development stage",
      default: 1000,
      validate: (currentAnswers) => {
        return (/^\d+$/).test(currentAnswers)
      }
    },
    {
      type: "input",
      name: "distPath",
      message: "Path to distribution output",
      default: parseDefaultDistPath(appPkg.module, appPkg.main)
    }
  ])

  if (!answers.continueInit) {
    console.log("Aborting")
    return 1
  }

  await annotatePkg({
    wolke: omit(answers, [ "continueInit" ]),
    scripts: {
      "wolke:deploy": "wolke deploy",
      "wolke:release": "wolke release",
      "wolke:status": "wolke status"
    }
  })

  await writeContent(
    ".env",
    `CLOUDFLARE_EMAIL=${answers.cloudflareEmail}\nCLOUDFLARE_TOKEN=${answers.cloudflareToken}`
  )

  await execNpm(context, "install", "--save-dev", ...DEPS)

  return 0
}
