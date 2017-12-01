import AWSSDK from "aws-sdk"

export async function getOwnerAccountId() {
  const sts = new AWSSDK.STS({ apiVersion: "2011-06-15" })

  const callerIdentity = await sts.getCallerIdentity().promise()
  return callerIdentity.Account
}
