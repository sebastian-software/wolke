import AWSSDK from "aws-sdk"
import Promise from "bluebird"
import ora from "ora"
import { sleep } from "./io"

const AWS_POLL_SLEEPTIME = 5000

AWSSDK.config.update({ region: "us-east-1" })
const amazonCertificateManager = new AWSSDK.ACM({ apiVersion: "2015-12-08" })

async function getCertificateDetails(certArn) {
  return amazonCertificateManager.describeCertificate({
    CertificateArn: certArn
  }).promise()
}

async function getAllCertificateInfos() {
  const certs = await amazonCertificateManager.listCertificates({
    CertificateStatuses: [ "ISSUED" ]
  }).promise()

  return Promise.all(
    certs.CertificateSummaryList.map(
      (cert) => getCertificateDetails(cert.CertificateArn)
    )
  )
}

export async function getCertIdForDomain(domain) {
  const certsDetails = await getAllCertificateInfos()

  for (const certificateInfo of certsDetails) {
    const domainName = certificateInfo.Certificate.DomainName
    const alternativeNames = certificateInfo.Certificate.SubjectAlternativeNames
    const certificateArn = certificateInfo.Certificate.CertificateArn

    if (domainName === domain)
      return certificateArn

    if (alternativeNames.includes(domain))
      return certificateArn
  }

  return null
}

export async function getWildcardCertIdForDomain(domain) {
  return getCertIdForDomain(`*.${domain}`)
}

export async function requestNewCert(
  domainName,
  {
    wildcard = false
  } = {}
) {
  let spinner = ora(`Request new TLS certificate for domain ${domainName}`).start()
  const DomainName = wildcard ? `*.${domainName}` : domainName

  const requestedCertificate = await amazonCertificateManager.requestCertificate({
    DomainName
  }).promise()

  spinner.succeed(`Certificate for domain ${domainName} requested`)
  spinner = ora(`Waiting for validation of domain ${domainName} (look at your emails)`).start()

  let isValidated = false
  while (!isValidated) {
    const certDetails = await getCertificateDetails(requestedCertificate.CertificateArn)

    if (certDetails.Certificate.Status === "ISSUED")
      isValidated = true
    else await sleep(AWS_POLL_SLEEPTIME)
  }

  spinner.succeed(`Certificate for domain ${domainName} validated`)

  return requestedCertificate.CertificateArn
}
