import AWSSDK from "aws-sdk"

import { getConfiguration } from "./configuration"
import { fileRead } from "./io"

async function getLambdaApi() {
  const configuration = await getConfiguration()
  AWSSDK.config.update({ region: configuration.value("awsRegion") })

  return new AWSSDK.Lambda({ apiVersion: "2015-03-31" })
}

export async function getVersionNumber(name, stage) {
  const lambda = await getLambdaApi()

  return lambda
    .getAlias({
      FunctionName: name,
      Name: stage
    })
    .promise()
}

export async function checkVersionDeployed() {
  return false
}

export async function createFunctionAsService(name, version, distFile) {
  const lambda = await getLambdaApi()
  const distFileContent = await fileRead(distFile)

  const lambdaName = `WOLKE_${name}`

  let flist = null
  try {
    flist = await lambda
      .listVersionsByFunction({
        FunctionName: lambdaName
      })
      .promise()
  } catch (error) {
    // noop
    console.error(error)
  }

  let lambdaFnt
  if (flist && flist.Versions && flist.Versions.length > 0) {
    lambdaFnt = await lambda
      .updateFunctionCode({
        FunctionName: lambdaName,
        Publish: true,
        ZipFile: distFileContent
      })
      .promise()
  } else {
    lambdaFnt = await lambda
      .createFunction({
        Code: {
          ZipFile: distFileContent
        },
        FunctionName: lambdaName,
        Handler: "wolke-proxy.handler",
        Role: "arn:aws:iam::759216673650:role/wolke-example-executor",
        Runtime: "nodejs6.10",
        Publish: true
      })
      .promise()
  }

  console.log(">>", lambdaFnt)

  return lambdaFnt
}

export async function handleExpressApp(context) {
  // noop
}
