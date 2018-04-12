import { exec } from "./io"
import { appPkg } from "./appPackage"

export function getServerlessYmlContent() {
  return `# serverless.yml

service: WOLKE-${appPkg.name}

provider:
  name: aws
  runtime: nodejs8.10
  memorySize: 256
  timeout: 18
  stage: \${opt:stage, 'dev'}
  region: ${appPkg.wolke.awsRegion}
  #usagePlan: # Optional usage plan configuration
  #  quota:
  #    limit: 5000
  #    offset: 2
  #    period: MONTH
  #  throttle:
  #    burstLimit: 200
  #    rateLimit: 100

functions:
  app:
    handler: wolke-proxy.handler
    events:
      - http: ANY /
      - http: 'ANY {proxy+}'
    warmup: production
    environment:
      GIT_HASH: "\${env:GIT_HASH}"

plugins:
  - serverless-plugin-warmup
  - serverless-content-encoding
  - serverless-domain-manager
  - serverless-prune-plugin

custom:
  domainNames:
    production: "\${file(app/package.json):wolke.productionDomain}"
    development: "${appPkg.name}-\${self:provider.stage}.\${file(app/package.json):wolke.developmentDomain}"

  contentEncoding:
    minimumCompressionSize: 1024

  customDomain:
    domainName: \${self:custom.domainNames.\${self:provider.stage}, self:custom.domainNames.development}
    basePath: ''
    stage: \${self:provider.stage}
    createRoute53Record: false

  apigwBinary:
    types:
      - "application/font-woff"
      - "application/font-woff2"
      - "image/png"
      - "image/jpg"
      - "image/jpeg"

  warmup:
    timeout: \${self:provider.timeout}
    prewarm: true

  prune:
    automatic: true
    number: 5
  `
}

function extractDDN(content) {
  const DDN_MARKER = "Distribution Domain Name"
  let isDDNMarker = false
  return content
    .split("\n")
    .filter((line) => {
      if (line.includes(DDN_MARKER)) {
        isDDNMarker = true
        return false
      }

      if (isDDNMarker) {
        isDDNMarker = false
        return true
      }

      return false
    })
    .pop()
    .trim()
}

export async function runServerless(context, appContext, distPath, version) {
  const newContext = {
    ...context,
    cwd: distPath,
    env: {
      GIT_HASH: version.hash
    }
  }

  const stage = version.name
  await exec(newContext, "sls", "create_domain", "--stage", stage)
  const result = await exec(newContext, "sls", "deploy", "--aws-s3-accelerate", "--stage", stage)

  console.log(">>>", result)

  const distributionDomainName = extractDDN(result.content)

  if (stage === "production") {
    return {
      domainName: appPkg.wolke.productionDomain,
      distributionDomainName
    }
  }

  return {
    domainName: `${appPkg.name}-${stage}.${appPkg.wolke.developmentDomain}`,
    distributionDomainName
  }
}
