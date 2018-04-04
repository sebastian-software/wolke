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

export async function getApiByName(name) {
  const apigateway = await getApiGateway()

  const apiName = `wolke-${name}`
  const restApis = await apigateway.getRestApis().promise()

  return restApis.items.filter((item) => item.name === apiName)[0]
}

export async function createOrGetApi() {
  const configuration = await getConfiguration()
  const apigateway = await getApiGateway()

  const restApiId = configuration.value("apiId")
  if (restApiId)
    return await apigateway.getRestApi({
      restApiId
    }).promise()

  const apiName = `wolke-${appPkg.name}`

  const apiResult = await apigateway.createRestApi({
    name: apiName
  }).promise()

  await annotatePkg({
    wolke: {
      apiId: apiResult.id
    }
  })

  return apiResult
}

export async function createOrGetVersionResource(restApiId, versionHash) {
  const apigateway = await getApiGateway()

  const resources = (await apigateway.getResources({
    restApiId
  }).promise()).items

  const versionResource = resources.filter((item) => item.path === `/${versionHash}`)

  if (versionResource.length > 0)
    return versionResource[0]

  const parentResource = resources.filter((item) => item.path === "/")[0]

  return await apigateway.createResource({
    pathPart: versionHash,
    parentId: parentResource.id,
    restApiId
  }).promise()
}

export async function createOrGetProxyResource(restApiId, versionResource) {
  const apigateway = await getApiGateway()

  const resources = (await apigateway.getResources({
    restApiId
  }).promise()).items

  const proxyResource = resources.filter((item) => item.path === `${versionResource.path}/{proxy+}`)

  if (proxyResource.length > 0)
    return proxyResource[0]

  return await apigateway.createResource({
    pathPart: "{proxy+}",
    parentId: versionResource.id,
    restApiId
  }).promise()
}

export async function createOrGetProxyMethods(restApiId, proxyResource) {
  const apigateway = await getApiGateway()

  /*
  const proxyResource = await apigateway.getResource({
    restApiId,
    resourceId: proxyResource.id
  }).promise()
  */

  const anyMethod = get(proxyResource, "resourceMethods.ANY")
  if (anyMethod)
    return await apigateway.getMethod({
      restApiId,
      resourceId: proxyResource.id,
      httpMethod: "ANY"
    }).promise()

  await apigateway.putMethod({
    restApiId,
    resourceId: proxyResource.id,

    authorizationType: "NONE",
    httpMethod: "ANY",
    apiKeyRequired: false,
    requestParameters: {
      "method.request.path.proxy": true
    }
  }).promise()

  await apigateway.putIntegration({
    resourceId: proxyResource.id,
    restApiId,

    type: "AWS_PROXY",
    httpMethod: "POST",
    uri: "arn:aws:apigateway:eu-central-1:lambda:path/2015-03-31/functions/arn:aws:lambda:eu-central-1:759216673650:function:example:${stageVariables.lambdaVersion}/invocations",
    passthroughBehavior: "WHEN_NO_MATCH",
    timeoutInMillis: 29000,
    cacheNamespace: proxyResource.id,
    cacheKeyParameters: [
      "method.request.path.proxy"
    ]
  })

  /* eslint-disable */
  const data =
    {
      "httpMethod": "ANY",
      "authorizationType": "NONE",
      "apiKeyRequired": false,
      "requestParameters": {
        "method.request.path.proxy": true
      },
      "methodResponses": {
        "200": {
          "statusCode": "200"
        }
      },
      "methodIntegration": {
        "type": "AWS_PROXY",
        "httpMethod": "POST",
        "uri": "arn:aws:apigateway:eu-central-1:lambda:path/2015-03-31/functions/arn:aws:lambda:eu-central-1:759216673650:function:example:${stageVariables.lambdaVersion}/invocations",
        "passthroughBehavior": "WHEN_NO_MATCH",
        "timeoutInMillis": 29000,
        "cacheNamespace": "5ljssn",
        "cacheKeyParameters": [
          "method.request.path.proxy"
        ],
        "integrationResponses": {
          "200": {
            "statusCode": "200"
          }
        }
      }
    }

  return await apigateway.getMethod({
    restApiId,
    resourceId: proxyResource.id,
    httpMethod: "ANY"
  }).promise()
}

export async function cleanStages(restApiId) {
  const apigateway = await getApiGateway()

  const stages = (await apigateway.getStages({
    restApiId
  }).promise()).item

  return stages
}

export async function getCustomDomainNames() {
  const apigateway = await getApiGateway()

  return await apigateway.getDomainNames().promise()
}

export async function getBasePathMappings(domainName) {
  const apigateway = await getApiGateway()

  return await apigateway.getBasePathMappings({
    domainName
  }).promise()
}
