/* eslint-disable */
const glob = require("glob")
const puppeteer = require("puppeteer")

const path = require("path")
const fs = require("fs")
const crypto = require("crypto")

const css = require("css")

async function renderGraph(definition, id) {
  const width = 800
  const height = 600
  const mermaidConfig = {}

  const browser = await puppeteer.launch()
  const page = await browser.newPage()
  page.setViewport({ width, height })
  page.on("console", (msg) => {
    console.log(msg.text())
  })
  await page.goto(`file://${path.join(__dirname, "regenerate.html")}`)
  await page.$eval(
    "#container",
    (container, definition, mermaidConfig, id) => {
      container.innerHTML = definition
      window.mermaid.initialize(mermaidConfig)
      window.mermaid.render(id, definition, (svgCode) => {
        container.innerHTML = svgCode
      })
    },
    definition,
    mermaidConfig,
    id
  )
  const svg = await page.$eval("#container", (container) => container.innerHTML)
  const svgId = await page.$eval("#container", (container) => container.childNodes[0].getAttribute("id"))
  await browser.close()

  const svgContent = {
    content: svg.replace(/<br>/g, "<br />"),
    id: svgId
  }

  return svgContent
}

function fixRules(rules, id) {
  return rules.map((item) => {
    item.selectors = item.selectors.map((selector) => {
      return "#" + id + " " + selector
    })
    return item
  })
}

async function styleSvg(svgObject, cssContent) {
  if (!cssContent) {
    return svgObject.content
  }

  const svgId = svgObject.id
  const ast = css.parse(cssContent)
  ast.stylesheet.rules = fixRules(ast.stylesheet.rules, svgId)
  const cssStr = css.stringify(ast)

  const content = svgObject.content

  const lastStylePos = content.lastIndexOf("</style>") + 8

  return (
    content.substring(0, lastStylePos) + "<style>" + cssStr + "</style>" + content.substring(lastStylePos)
  )
}

function readFile(path) {
  return new Promise((resolve, reject) => {
    fs.readFile(path, "utf8", (err, data) => {
      if (err) {
        resolve(null)
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
    const svgFilename = file.replace(".mmd", ".svg")
    const cssFilename = file.replace(".mmd", ".css")

    const graphDefinition = await readFile(file)
    const id =
      "mmd-" +
      crypto
        .createHash("sha256")
        .update(graphDefinition, "utf8")
        .digest("hex")
        .substring(0, 8)
    const svg = await renderGraph(graphDefinition, id)

    const cssContent = await readFile(cssFilename)
    const styledSvg = await styleSvg(svg, cssContent)

    await writeFile(svgFilename, styledSvg)
    console.log(svgFilename, "written")
  }
})
