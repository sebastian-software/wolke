import { spawn } from "child_process"
import Promise from "bluebird"

export function exec(command, ...parameter) {
  return new Promise((resolve) => { // eslint-disable-line
    const proc = spawn(command, parameter, {
      stdio: "inherit"
    })

    proc.on("close", (code) => {
      resolve(code)
    })
  })
}

export function execNpm(command, ...parameter) {
  return exec("npm", command, ...parameter)
}
