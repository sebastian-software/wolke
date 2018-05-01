/* eslint-disable no-process-exit, promise/prefer-await-to-then, import/no-unresolved */
import { cli } from "wolke"

cli()
  .then((exitCode) => process.exit(exitCode))
  .catch((error) => console.error(error))
