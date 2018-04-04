import AWSSDK from "aws-sdk"

import { getConfiguration } from "./configuration"
import {
  appPkg
} from "../common/appPackage"

async function getApiGateway() {
  const configuration = await getConfiguration()
  AWSSDK.config.update({ region: configuration.value("awsRegion") })

  return new AWSSDK.APIGateway({ apiVersion: "2015-07-09" })
}

export async function assignPathToDomain(domainName, devCertId, restApiId, stage, options = {}) {
  const apigateway = await getApiGateway()

  let publishDomainName = domainName
  if (!options.fixedDomainName) {
    publishDomainName = `${appPkg.name}-${stage}.${domainName}`
  }

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

const ZONE_ELEMENTS = 2
export function domainToZone(fqdn) {
  const splittedDomainName = fqdn.split(/\./g)

  return splittedDomainName.slice(-ZONE_ELEMENTS).join(".")
}
