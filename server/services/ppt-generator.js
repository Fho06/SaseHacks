import PptxGenJS from "pptxgenjs"
import sharp from "sharp"

export async function createPresentation(slideData) {

  const pptx = new PptxGenJS()

  /*
  Layout grid (PowerPoint is 10 x 5.63 inches)
  */

  const marginX = 0.7
  const contentWidth = 8.6

  function getTextColor(slide) {
    return slide.backgroundImage ? "FFFFFF" : "000000"
  }

  for (const s of slideData.slides) {

    const slide = pptx.addSlide()

    /*
    BACKGROUND IMAGE
    */

    if (s.backgroundImage) {

      try {

        const pngBuffer = await sharp(
          Buffer.from(s.backgroundImage, "base64")
        )
        .png()
        .toBuffer()

        slide.addImage({
          data: `image/png;base64,${pngBuffer.toString("base64")}`,
          x: 0,
          y: 0,
          w: "100%",
          h: "100%"
        })

      } catch (err) {

        console.error("background conversion failed:", err)
        slide.background = { fill: "FFFFFF" }

      }

    } else {

      slide.background = { fill: "FFFFFF" }

    }

    const textColor = getTextColor(s)

    /*
    TITLE SLIDE
    */

    if (s.type === "title") {

      slide.addText(s.title || "", {
        x: marginX,
        y: 2,
        w: contentWidth,
        align: "center",
        fontSize: 44,
        bold: true,
        color: textColor
      })

      if (s.subtitle) {

        slide.addText(s.subtitle, {
          x: marginX,
          y: 3.1,
          w: contentWidth,
          align: "center",
          fontSize: 22,
          color: textColor
        })

      }
    }

    /*
    BULLET SLIDE
    */

    if (s.type === "bullets") {

      slide.addText(s.title || "", {
        x: marginX,
        y: 0.7,
        w: contentWidth,
        fontSize: 30,
        bold: true,
        color: textColor
      })

      const bullets = Array.isArray(s.bullets) ? s.bullets : []

      slide.addText(
        bullets.map(b => ({ text: b })),
        {
          x: marginX,
          y: 1.7,
          w: contentWidth - 1,
          bullet: true,
          fontSize: 20,
          lineSpacing: 28,
          color: textColor
        }
      )
    }

    /*
    INSIGHT SLIDE
    */

    if (s.type === "insight") {

      slide.addText(s.title || "", {
        x: marginX,
        y: 0.6,
        w: contentWidth,
        fontSize: 34,
        bold: true,
        color: textColor
      })

      const bullets = (s.text || "")
        .split(".")
        .map(t => t.trim())
        .filter(Boolean)

      slide.addText(
        bullets.map(b => ({ text: b })),
        {
          x: marginX,
          y: 1.8,
          w: contentWidth,
          bullet: true,
          fontSize: 20,
          lineSpacing: 28,
          color: textColor
        }
      )
    }

    /*
    METRIC SLIDE
    */

    if (s.type === "metric") {

      slide.addText(s.title || "", {
        x: marginX,
        y: 0.7,
        w: contentWidth,
        fontSize: 28,
        bold: true,
        color: textColor
      })

      slide.addText(s.value || "", {
        x: marginX,
        y: 2,
        w: contentWidth,
        align: "center",
        fontSize: 64,
        bold: true,
        color: slideData.accentColor?.replace("#","") || "2563EB"
      })

      if (s.change) {

        slide.addText(s.change, {
          x: marginX,
          y: 3.4,
          w: contentWidth,
          align: "center",
          fontSize: 24,
          color: textColor
        })

      }
    }

    /*
    TWO COLUMN
    */

    if (s.type === "twoColumn") {

      slide.addText(s.title || "", {
        x: marginX,
        y: 0.7,
        w: contentWidth,
        fontSize: 30,
        bold: true,
        color: textColor
      })

      const left = Array.isArray(s.left) ? s.left : []
      const right = Array.isArray(s.right) ? s.right : []

      slide.addText(
        left.map(b => ({ text: b })),
        {
          x: marginX,
          y: 1.8,
          w: 4,
          bullet: true,
          fontSize: 20,
          lineSpacing: 28,
          color: textColor
        }
      )

      slide.addText(
        right.map(b => ({ text: b })),
        {
          x: 5,
          y: 1.8,
          w: 4,
          bullet: true,
          fontSize: 20,
          lineSpacing: 28,
          color: textColor
        }
      )
    }

    /*
    CHART SLIDE
    */

    if (s.type === "chart") {

      slide.addText(s.title || "", {
        x: marginX,
        y: 0.7,
        w: contentWidth,
        fontSize: 30,
        bold: true,
        color: textColor
      })

      slide.addChart(
        pptx.ChartType.bar,
        [
          {
            name: "Series",
            labels: s.labels || [],
            values: s.values || []
          }
        ],
        {
          x: marginX,
          y: 1.6,
          w: contentWidth,
          h: 3.5,
          barDir: "col"
        }
      )
    }

  }

  return pptx.write("nodebuffer")
}