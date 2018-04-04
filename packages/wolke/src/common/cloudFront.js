import AWSSDK from "aws-sdk"
import { getConfiguration } from "./configuration"

export async function findDistribution() {
  const configuration = await getConfiguration()
  AWSSDK.config.update({ region: configuration.value("awsRegion") })

  // const cloudfront = new AWSSDK.CloudFront({ apiVersion: "2017-03-25" })
  const apigateway = new AWSSDK.APIGateway({ apiVersion: "2015-07-09" })
  /*
  const results = (await apigateway.getDomainNames().promise()).items

  for (const domain of results) {
    domain.mappings = (await apigateway.getBasePathMappings({
      domainName: domain.domainName
    }).promise()).items
  }
*/

  const results = await apigateway
    .getMethod({
      httpMethod: "ANY",
      resourceId: "5ljssn",
      restApiId: "bcu5zytycd"
    })
    .promise()

  /*
  const results = await cloudfront.listDistributions().promise()

  const origin = results.DistributionList.Items.filter(
    (item) => {
      return item.Origins.Items[0].DomainName === "kraizyteqi.execute-api.eu-central-1.amazonaws.com"
    }
  )[0] */

  // const info = await cloudfront.getDistribution({ Id: origin.Id }).promise()
  console.log(">>>", JSON.stringify(results, null, 2))
  // console.log(origin.DomainName)
  // console.log(origin.Aliases)
}
