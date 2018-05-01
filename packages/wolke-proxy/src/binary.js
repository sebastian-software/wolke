import net from "net"
import http from "http"
import url from "url"
import { fork } from "child_process"
import path from "path"
import filesystem from "fs"

import binarycase from "./binaryCase"

const httpPort = 8000

function getContentType(params) {
  // only compare mime type; ignore encoding part
  return params.contentTypeHeader ? params.contentTypeHeader.split(";")[0] : ""
}

function isContentTypeBinaryMimeType(params) {
  return params.binaryMimeTypes.includes(params.contentType)
}

function omitHeader(map, omittedHeaders) {
  const headers = {}
  const checkOmittedHeaders = omittedHeaders.map((key) => key.toUpperCase())

  Object.keys(map).forEach((key) => {
    if (!checkOmittedHeaders.includes(key.toUpperCase())) {
      // eslint-disable-next-line security/detect-object-injection
      headers[key] = map[key]
    }
  })

  return headers
}

function mapApiGatewayEventToHttpRequest(event, context, server) {
  // NOTE: Mutating event.headers; prefer deep clone of event.headers
  const headers = omitHeader(event.headers || {}, [ "accept-encoding" ])
  const eventWithoutBody = Object.assign({}, event)
  delete eventWithoutBody.body

  const pathUrl = url.format({ pathname: event.path, query: event.queryStringParameters })

  return {
    method: event.httpMethod,
    path: pathUrl,
    headers,
    port: server.port
  }
}

function forwardResponseToApiGateway(server, response, context) {
  const buf = []

  response.on("data", (chunk) => buf.push(chunk)).on("end", () => {
    const bodyBuffer = Buffer.concat(buf)
    const statusCode = response.statusCode
    const headers = response.headers

    // chunked transfer not currently supported by API Gateway
    if (headers["transfer-encoding"] === "chunked") delete headers["transfer-encoding"]

    // HACK: modifies header casing to get around API Gateway's limitation of not allowing multiple
    // headers with the same name, as discussed on the AWS Forum https://forums.aws.amazon.com/message.jspa?messageID=725953#725953
    Object.keys(headers).forEach((h) => {
      // eslint-disable-next-line security/detect-object-injection
      if (Array.isArray(headers[h])) {
        if (h.toLowerCase() === "set-cookie") {
          // eslint-disable-next-line security/detect-object-injection
          headers[h].forEach((value, i) => {
            headers[binarycase(h, i + 1)] = value
          })
          // eslint-disable-next-line security/detect-object-injection
          delete headers[h]
        } else {
          // eslint-disable-next-line security/detect-object-injection
          headers[h] = headers[h].join(",")
        }
      }
    })

    const contentType = getContentType({ contentTypeHeader: headers["content-type"] })
    const isBase64Encoded = isContentTypeBinaryMimeType({ contentType, binaryMimeTypes: server._binaryTypes })
    const body = bodyBuffer.toString(isBase64Encoded ? "base64" : "utf8")
    const successResponse = { statusCode, body, headers, isBase64Encoded }

    context.succeed(successResponse)
  })
}

function forwardConnectionErrorResponseToApiGateway(server, error, context) {
  console.log("ERROR: wolke-proxy connection error")
  console.error(error)
  const errorResponse = {
    // "DNS resolution, TCP level errors, or actual HTTP parse errors" - https://nodejs.org/api/http.html#http_http_request_options_callback
    statusCode: 502,
    body: "",
    headers: {}
  }

  context.succeed(errorResponse)
}

function forwardLibraryErrorResponseToApiGateway(server, error, context) {
  console.log("ERROR: wolke-proxy error")
  console.error(error)
  const errorResponse = {
    statusCode: 500,
    body: "",
    headers: {}
  }

  context.succeed(errorResponse)
}

function listenerOnPort(port, host, callback) {
  try {
    const socket = net
      .createConnection(port, host, (error) => {
        if (socket) {
          socket.destroy()
        }

        if (!error) {
          callback(true)
        } else {
          callback(false)
        }
      })
      .on("error", (error) => {
        callback(false)
      })
  } catch (error) {
    callback(false)
  }
}

const DEFAULT_RETRIES = 200
const DEFAULT_TIMEOUT = 500
function waitForPort(port, callback, retries = DEFAULT_RETRIES) {
  if (retries <= 0) {
    callback(false)
    return
  }

  listenerOnPort(port, "localhost", (isListeneing) => {
    if (isListeneing) {
      callback(true)
      return
    }

    setTimeout(() => {
      waitForPort(port, callback, retries - 1)
    }, DEFAULT_TIMEOUT)
  })
}

function findExecutable(cmd, cwd) {
  const binFile = path.join(cwd, "./node_modules/.bin", cmd)

  const symlinkFile = JSON.parse(filesystem.readFileSync("./symlink.json", "utf8"))

  try {
    console.log("Check cmd", binFile)

    // eslint-disable-next-line security/detect-object-injection
    const symlnk = symlinkFile[cmd]
    if (symlnk) {
      const realPath = path.join(cwd, symlnk)
      console.log("Found symlink", realPath)
      return realPath
    }

    filesystem.accessSync(binFile, filesystem.constants.R_OK)

    // eslint-disable-next-line security/detect-non-literal-fs-filename
    return filesystem.realpathSync(binFile)
  } catch (error) {
    console.log("Not found, use ", cmd)
    return cmd
  }
}

function forkCmd(command, cwd, env) {
  const cmdSplit = command.split(/\s+/g)
  const cmd = findExecutable(cmdSplit[0], cwd)
  const args = cmdSplit.slice(1)

  console.log("Fork ", cmd, args, cwd)

  const proc = fork(cmd, args, {
    cwd,
    env: {
      ...process.env,
      ...env
    }
  })

  return proc
}

function startServer(server, callback, port = httpPort) {
  console.log("Start new server")
  listenerOnPort(port, "localhost", (isListening) => {
    if (isListening) {
      console.warn(
        `WARNING: Attempting to listen on port ${port}, but it is already in use. This is likely as a `,
        `result of a previous invocation error or timeout. Check the logs for the invocation(s) immediately `,
        `prior to this for root cause, and consider increasing the timeout and/or cpu/memory allocation `,
        `if this is purely as a result of a timeout. wolke-proxy will restart the Node.js server listening `,
        `on a new port and continue with this request.`
      )
      startServer(server, callback, port + 1)
      return
    }

    const lambdaCwd = process.env.LAMBDA_TASK_ROOT
    const appDir = path.join(lambdaCwd, "app")

    // eslint-disable-next-line security/detect-non-literal-fs-filename
    const packageJson = JSON.parse(filesystem.readFileSync(path.join(appDir, "package.json"), "utf8"))

    const proc = forkCmd(packageJson.scripts.start, appDir, { PORT: port })
    proc.on("close", () => {
      server.isListening = false
    })

    console.log("Wait for port")
    waitForPort(port, (currentlyIsListeneing) => {
      console.log("Detected server start", Boolean(currentlyIsListeneing), currentlyIsListeneing)
      if (currentlyIsListeneing) {
        Object.assign(server, {
          isListening: true,
          port,
          proc
        })

        callback()
      } else {
        console.error("app server not listening")
      }
    })
  })
}

function forwardRequestToApp(server, event, context) {
  try {
    const requestOptions = mapApiGatewayEventToHttpRequest(event, context, server)
    const req = http.request(requestOptions, (response, body) =>
      forwardResponseToApiGateway(server, response, context)
    )
    if (event.body) {
      if (event.isBase64Encoded) {
        event.body = Buffer.from(event.body, "base64")
      }

      req.write(event.body)
    }

    req.on("error", (error) => forwardConnectionErrorResponseToApiGateway(server, error, context)).end()
  } catch (error) {
    forwardLibraryErrorResponseToApiGateway(server, error, context)
  }
}

const forwardServer = {
  _binaryTypes: []
}

const startedServer = new Promise((resolve) => {
  startServer(forwardServer, () => {
    console.log("New server started")
    resolve()
  })
})

export function handler(event, context) {
  if (forwardServer.isListening) {
    console.log("Forward request", event, context)
    forwardRequestToApp(forwardServer, event, context)
  } else {
    // eslint-disable-next-line promise/prefer-await-to-then
    startedServer.then(() => handler(event, context)).catch((error) => console.error("error", error))
  }
}

console.log("startup code")
