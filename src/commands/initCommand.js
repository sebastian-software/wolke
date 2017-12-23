import chalk from "chalk"
import inquirer from "inquirer"
import omit from "lodash/omit"
import { dirname } from "path"
import ora from "ora"

import { configurationAvailable } from "../common/configuration"
import { annotatePkg, appPkg } from "../common/appPackage"
import { execNpm, ensureContent, preEqualComparator } from "../common/io"

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

  if (context.flags.interaction === false) {
    console.log(chalk.red("no interaction allowed due to --no-interaction flag"))
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

    /* {
      type: "input",
      name: "parallelDeployments",
      message: "Number of parallel deployments in development stage",
      default: 1000,
      validate: (currentAnswers) => {
        return (/^\d+$/).test(currentAnswers)
      }
    }, */

    /*
    {
      type: "input",
      name: "distPath",
      message: "Path to distribution output",
      default: parseDefaultDistPath(appPkg.module, appPkg.main)
    }, */

    {
      type: "input",
      name: "cloudflareEmail",
      message: "Email of cloudflare account"
    },
    {
      type: "input",
      name: "cloudflareToken",
      message: "Global API key of cloudflare account (https://www.cloudflare.com/a/profile)"
    }
  ])

  if (!answers.continueInit) {
    console.log("Aborting")
    return 1
  }

  await annotatePkg({
    wolke: omit(answers, [ "continueInit", "cloudflareEmail", "cloudflareToken" ]),
    scripts: {
      "wolke:deploy": "wolke deploy",
      "wolke:release": "wolke release",
      "wolke:status": "wolke status"
    }
  })

  await ensureContent(
    ".env",
    [
      `CLOUDFLARE_EMAIL=${answers.cloudflareEmail}`,
      `CLOUDFLARE_TOKEN=${answers.cloudflareToken}`
    ],
    preEqualComparator
  )

  await ensureContent(
    ".gitignore",
    [ ".env", "node_modules" ]
  )

  await ensureContent(
    ".npmignore",
    [ ".env" ]
  )

  const spinner = ora("Install NPM dependencies of wolke")
  if (!context.flags.verbose)
    spinner.start()

  const npmReturn = await execNpm(context, "install", "--save-dev", ...DEPS)
  if (npmReturn.code > 0) {
    spinner.fail("NPM dependencies of wolke not correctly installed")
    return 1
  }
  spinner.succeed("NPM dependencies of wolke installed")

  return 0
}
