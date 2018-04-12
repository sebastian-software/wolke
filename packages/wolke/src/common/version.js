import { appPkg } from "./appPackage"
import { exec } from "./io"
import { valid, major } from "semver"

function getMajorVersion(versionStr) {
  if (!versionStr) {
    return 0
  }

  if (!valid(versionStr)) {
    return 0
  }

  return major(versionStr)
}

export async function getVersion(context) {
  const clVersion = context.flags.deployVersion

  const gitresult = await exec(context, "git", "rev-parse", "--short", "HEAD")
  let gitVersion = gitresult.content.trim()

  if (gitresult.code === 0) {
    if (!context.flags.force) {
      const checkChangedFiles = await exec(context, "git", "status", "--untracked-files=no", "--porcelain")

      if (checkChangedFiles.content.trim().length > 0) {
        throw new Error("No clean git repository! Use --force to proceed.")
      }
    }
  } else {
    gitVersion = null
  }

  const version = clVersion || appPkg.version
  const majorVersion = getMajorVersion(version)

  return {
    name: `v${majorVersion}`,
    majorVersion,
    version,
    hash: gitVersion
  }
}
