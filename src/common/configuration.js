import { appPkg } from "./appPackage"

export async function configurationAvailable() {
  return "wolke" in appPkg
}
