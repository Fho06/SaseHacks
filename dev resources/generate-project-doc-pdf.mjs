import fs from "node:fs"
import path from "node:path"

const rootDir = process.cwd()
const sourcePath = path.join(rootDir, "dev resources", "project-documentation.md")
const outputPath = path.join(rootDir, "dev resources", "FinVoice_Project_Documentation.pdf")

const PAGE_WIDTH = 612
const PAGE_HEIGHT = 792
const MARGIN_X = 54
const MARGIN_TOP = 56
const MARGIN_BOTTOM = 54
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2

const FONT_REGULAR = "F1"
const FONT_BOLD = "F2"

function escapePdfText(text) {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
}

function lineWidthEstimate(text, fontSize) {
  return text.length * fontSize * 0.52
}

function wrapText(text, fontSize) {
  const words = text.split(/\s+/).filter(Boolean)
  if (words.length === 0) return [""]

  const lines = []
  let current = words[0]

  for (let i = 1; i < words.length; i += 1) {
    const next = `${current} ${words[i]}`
    if (lineWidthEstimate(next, fontSize) <= CONTENT_WIDTH) {
      current = next
    } else {
      lines.push(current)
      current = words[i]
    }
  }

  lines.push(current)
  return lines
}

function parseMarkdown(markdown) {
  const blocks = []
  const lines = markdown.replace(/\r\n/g, "\n").split("\n")

  for (const line of lines) {
    const trimmed = line.trim()

    if (!trimmed) {
      blocks.push({ type: "blank" })
      continue
    }

    if (trimmed.startsWith("# ")) {
      blocks.push({ type: "h1", text: trimmed.slice(2).trim() })
      continue
    }

    if (trimmed.startsWith("## ")) {
      blocks.push({ type: "h2", text: trimmed.slice(3).trim() })
      continue
    }

    if (trimmed.startsWith("### ")) {
      blocks.push({ type: "h3", text: trimmed.slice(4).trim() })
      continue
    }

    if (trimmed.startsWith("- ")) {
      blocks.push({ type: "bullet", text: trimmed.slice(2).trim() })
      continue
    }

    blocks.push({ type: "p", text: trimmed })
  }

  return blocks
}

function styleForBlock(type) {
  switch (type) {
    case "h1":
      return { font: FONT_BOLD, fontSize: 22, lineHeight: 28, spaceBefore: 6, spaceAfter: 10 }
    case "h2":
      return { font: FONT_BOLD, fontSize: 16, lineHeight: 22, spaceBefore: 8, spaceAfter: 6 }
    case "h3":
      return { font: FONT_BOLD, fontSize: 13, lineHeight: 18, spaceBefore: 4, spaceAfter: 4 }
    case "bullet":
      return { font: FONT_REGULAR, fontSize: 11, lineHeight: 15, spaceBefore: 0, spaceAfter: 1, indent: 16, bullet: "- " }
    case "p":
      return { font: FONT_REGULAR, fontSize: 11, lineHeight: 15, spaceBefore: 0, spaceAfter: 5 }
    default:
      return { font: FONT_REGULAR, fontSize: 11, lineHeight: 15, spaceBefore: 0, spaceAfter: 4 }
  }
}

function createPages(blocks) {
  const pages = []
  let currentLines = []
  let y = PAGE_HEIGHT - MARGIN_TOP
  let pageNumber = 1

  function pushPage() {
    pages.push({ pageNumber, lines: currentLines })
    pageNumber += 1
    currentLines = []
    y = PAGE_HEIGHT - MARGIN_TOP
  }

  function ensureSpace(heightNeeded) {
    if (y - heightNeeded < MARGIN_BOTTOM) {
      pushPage()
    }
  }

  for (const block of blocks) {
    if (block.type === "blank") {
      y -= 8
      continue
    }

    const style = styleForBlock(block.type)
    const baseText = block.type === "bullet" ? `${style.bullet}${block.text}` : block.text
    const wrapped = wrapText(baseText, style.fontSize)
    const blockHeight = style.spaceBefore + wrapped.length * style.lineHeight + style.spaceAfter

    ensureSpace(blockHeight)
    y -= style.spaceBefore

    for (const wrappedLine of wrapped) {
      const x = MARGIN_X + (style.indent || 0)
      currentLines.push({
        text: wrappedLine,
        x,
        y,
        font: style.font,
        fontSize: style.fontSize
      })
      y -= style.lineHeight
    }

    y -= style.spaceAfter
  }

  const footerY = 24
  const addFooter = (page) => {
    page.lines.push({
      text: `FinVoice AI Repository Documentation | Page ${page.pageNumber}`,
      x: MARGIN_X,
      y: footerY,
      font: FONT_REGULAR,
      fontSize: 9
    })
  }

  pushPage()
  pages.forEach(addFooter)
  return pages
}

function pageContentStream(page) {
  return page.lines
    .map((line) => {
      return `BT /${line.font} ${line.fontSize} Tf 1 0 0 1 ${line.x} ${line.y} Tm (${escapePdfText(line.text)}) Tj ET`
    })
    .join("\n")
}

function buildPdf(pages) {
  const objects = []

  function addObject(content) {
    objects.push(content)
    return objects.length
  }

  const catalogId = addObject("<< /Type /Catalog /Pages 2 0 R >>")
  const pagesId = addObject("<< /Type /Pages /Count 0 /Kids [] >>")
  const fontRegularId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
  const fontBoldId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>")

  const pageIds = []

  for (const page of pages) {
    const stream = pageContentStream(page)
    const streamId = addObject(`<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream`)
    const pageId = addObject(
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /${FONT_REGULAR} ${fontRegularId} 0 R /${FONT_BOLD} ${fontBoldId} 0 R >> >> /Contents ${streamId} 0 R >>`
    )
    pageIds.push(pageId)
  }

  objects[pagesId - 1] = `<< /Type /Pages /Count ${pageIds.length} /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] >>`
  objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`

  let pdf = "%PDF-1.4\n"
  const offsets = [0]

  for (let i = 0; i < objects.length; i += 1) {
    offsets.push(Buffer.byteLength(pdf, "utf8"))
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`
  }

  const xrefOffset = Buffer.byteLength(pdf, "utf8")
  pdf += `xref\n0 ${objects.length + 1}\n`
  pdf += "0000000000 65535 f \n"

  for (let i = 1; i < offsets.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`
  }

  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`
  return pdf
}

function main() {
  const markdown = fs.readFileSync(sourcePath, "utf8")
  const blocks = parseMarkdown(markdown)
  const pages = createPages(blocks)
  const pdf = buildPdf(pages)
  fs.writeFileSync(outputPath, pdf, "binary")
  console.log(`Wrote ${outputPath}`)
}

main()
