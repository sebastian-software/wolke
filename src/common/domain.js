import AWSSDK from "aws-sdk"
import get from "lodash/get"

import { getConfiguration } from "./configuration"
import {
  appPkg,
  annotatePkg
} from "../common/appPackage"

async function getApiGateway() {
  const configuration = await getConfiguration()
  AWSSDK.config.update({ region: configuration.value("awsRegion") })

  return new AWSSDK.APIGateway({ apiVersion: "2015-07-09" })
}

export async function assignPathToDomain(domainName, devCertId, restApiId, stage) {
  const apigateway = await getApiGateway()
  const publishDomainName = `${appPkg.name}-${stage}.${domainName}`

  let domainNameResult
  try {
    domainNameResult = await apigateway.getDomainName({
      domainName: publishDomainName
    }).promise()
  } catch (error) {
    // noop
  }

  if (!domainNameResult) {
    domainNameResult = await apigateway.createDomainName({
      domainName: publishDomainName,
      certificateArn: devCertId
    }).promise()
  }

  try {
    await apigateway.deleteBasePathMapping({
      basePath: "(none)",
      domainName: domainNameResult.domainName
    }).promise()
  } catch (error) {
    // noop
  }

  const result = await apigateway.createBasePathMapping({
    restApiId,
    domainName: domainNameResult.domainName,
    basePath: "(none)",
    stage
  }).promise()

  return {
    ...result,
    ...domainNameResult
  }
}
