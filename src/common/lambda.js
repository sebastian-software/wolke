import AWSSDK from "aws-sdk"

import { getConfiguration } from "./configuration"

async function getLambdaApi() {
  const configuration = await getConfiguration()
  AWSSDK.config.update({ region: configuration.value("awsRegion") })

  return new AWSSDK.Lambda({ apiVersion: "2015-03-31" })
}

export async function getVersionNumber(name, stage) {
  const lambda = await getLambdaApi()

  return lambda.getAlias({
    FunctionName: name,
    Name: stage
  }).promise()
}
