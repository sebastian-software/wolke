import cloudflare from "cloudflare"

function cloudFlare() {
  return cloudflare({
    email: process.env.CLOUDFLARE_EMAIL,
    key: process.env.CLOUDFLARE_TOKEN
  })
}

export async function findZone(domainName) {
  const zones = await cloudFlare().zones.browse()

  const zone = zones.result.filter(
    ({ name }) => name === domainName
  )

  if (zone.length >= 1) {
    return zone[0]
  }

  return null
}

export async function getDnsRecords(zone) {
  return await cloudFlare().dnsRecords.browse(zone.id)
}

export async function findDnsRecord(zone, domainName) {
  const dnsRecords = await getDnsRecords(zone)

  const dnsRecord = dnsRecords.result.filter(
    ({ name }) => name === domainName
  )

  if (dnsRecord.length >= 0) {
    return dnsRecord[0]
  }

  return null
}

export async function updateDnsRecord(zone, dnsRecord, parameter) {
  return await cloudFlare().dnsRecords.edit(
    zone.id,
    dnsRecord.id,
    {
      type: "CNAME",
      name: dnsRecord.name,
      content: parameter.cname
    }
  )
}

export async function createDnsRecord(zone, domainName, parameter) {
  return await cloudFlare().dnsRecords.add(zone.id, {
    type: "CNAME",
    name: domainName,
    content: parameter.cname,
    proxied: false,
    ttl: 1
  })
}
