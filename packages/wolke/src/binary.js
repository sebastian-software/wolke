/* eslint-disable no-process-exit, promise/prefer-await-to-then, node/no-missing-require,
                  import/no-commonjs, security/detect-non-literal-require */

let wolkePath

try {
  // Load local version of wolke if available
  wolkePath = require.resolve("wolke", { paths: [ process.cwd() ] })
} catch (error) {
  // Load global version
  wolkePath = require.resolve("wolke")
}

const wolke = require(wolkePath)

wolke
  .cli()
  .then((exitCode) => process.exit(exitCode))
  .catch((error) => console.error(error))
