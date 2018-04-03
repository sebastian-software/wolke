import { appPkg } from "./appPackage"
import { exec } from "./io"

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

  return {
    name: clVersion ? clVersion : appPkg.version.replace(/\./g, "x"),
    hash: gitVersion
  }
}
