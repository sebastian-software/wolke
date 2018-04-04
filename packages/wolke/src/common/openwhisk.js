import openwhisk from "openwhisk"
import path from "path"
import semver from "semver"

import { fileRead, fileWrite, execNpm } from "./io"

async function getOpenwhiskApi() {
  const ow = openwhisk({
    apihost: "openwhisk.eu-de.bluemix.net",
    api_key:
      "88512d24-ae73-4871-8b48-419234167133:ulyyqLOHSXM8Cnv1rReHIxgTXzvpEeSsVtSuq8fjFE1biGKBEkF06QFiIu0N3GQI"
  })
  return ow
}

export async function getDeployedMetadata(name) {
  const ow = await getOpenwhiskApi()
  const actionList = await ow.actions.list()

  const appAction = actionList.filter((item) => item.name === `WOLKE_${name}`)

  if (appAction.length > 0) {
    return appAction[0]
  }

  return null
}

export async function checkVersionDeployed(name, version) {
  const appAction = await getDeployedMetadata(name)

  if (appAction) {
    return semver.gt(version, appAction.version)
  }

  return true
}

export async function createFunctionAsService(name, version, distFile) {
  const ow = await getOpenwhiskApi()

  const action = await fileRead(distFile)

  const owName = `WOLKE_${name}`

  const appAction = await getDeployedMetadata(name)
  let val
  if (!appAction) {
    val = await ow.actions.create({ name: owName, version, action, kind: "nodejs:8" })
  } else {
    val = await ow.actions.update({ name: owName, version, action, kind: "nodejs:8" })
  }

  await fileWrite("./output.json", JSON.stringify(val, null, 2))
}

export async function handleExpressApp(context) {
  const packagePath = path.join(context.cwd, "package.json")
  const packageContent = JSON.parse(await fileRead(packagePath, "utf8"))

  await fileWrite(
    path.join(context.cwd, "openwhisk.js"),
    `
const getRoot = require("app-root-dir").get;
const openWhiskExpress = require("expressjs-openwhisk");
const fs = require("fs");

function pick(map, items) {
  const result = {};

  items.forEach((item) => {
    result[item] = map[item];
  });

  return result;
}

function main(request) {
  process.chdir(__dirname);
  const appPromise = require(__dirname + "/${packageContent.main}");

  return Promise.resolve(appPromise())
    .then((app) => {
      const forward = openWhiskExpress(app);

      request.__ow_headers["accept-encoding"] = "";
      return forward(request);
    })
    .catch((error) => {
      return {
        statusCode: 500,
        headers: {
          "Content-type": "text/html"
        },
        body: "<pre>" + error + "</pre>"
      };
    });
  }

  exports.main = main;
  `
  )

  packageContent.main = "openwhisk.js"
  await fileWrite(packagePath, JSON.stringify(packageContent, null, 2))

  await execNpm(context, "install", "expressjs-openwhisk")
}
