/* eslint-disable */
const glob = require("glob")
const puppeteer = require("puppeteer")

const path = require("path")
const fs = require("fs")

async function renderGraph(definition) {
  const width = 800
  const height = 600
  const mermaidConfig = {}
  const myCSS = undefined

  const browser = await puppeteer.launch()
  const page = await browser.newPage()
  page.setViewport({ width, height })
  page.on("console", (msg) => {
    console.log(msg.text())
  })
  await page.goto(`file://${path.join(__dirname, "regenerate.html")}`)
  await page.$eval(
    "#container",
    (container, definition, mermaidConfig, myCSS) => {
      container.innerHTML = definition
      window.mermaid.initialize(mermaidConfig)

      if (myCSS) {
        const head = window.document.head || window.document.getElementsByTagName("head")[0]
        const style = document.createElement("style")
        style.type = "text/css"
        if (style.styleSheet) {
          style.styleSheet.cssText = myCSS
        } else {
          style.appendChild(document.createTextNode(myCSS))
        }
        head.appendChild(style)
      }

      window.mermaid.init(undefined, container)
    },
    definition,
    mermaidConfig,
    myCSS
  )
  const svg = await page.$eval("#container", (container) => container.innerHTML)
  await browser.close()

  return svg.replace(/<br>/g, "<br />")
}

function readFile(path) {
  return new Promise((resolve, reject) => {
    fs.readFile(path, "utf8", (err, data) => {
      if (err) {
        reject(err)
        return
      }

      resolve(data)
    })
  })
}

function writeFile(path, content) {
  return new Promise((resolve, reject) => {
    fs.writeFile(path, content, (err) => {
      if (err) {
        reject(err)
      }

      resolve()
    })
  })
}

glob(path.join(__dirname, "./*.mmd"), async (error, files) => {
  for (const file of files) {
    console.log(file)
    const graphDefinition = await readFile(file)
    const svg = await renderGraph(graphDefinition)

    const svgFilename = file.replace(".mmd", ".svg")
    await writeFile(svgFilename, svg)
    console.log(svgFilename, "written")
  }
})
