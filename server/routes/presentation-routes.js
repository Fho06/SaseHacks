import express from "express"
import { generateSlides } from "../services/presentation-ai.js"
import { createPresentation } from "../services/ppt-generator.js"
import { generateBackground } from "../utils/background-generator.js"

const router = express.Router()

/*
GENERATE SLIDES
*/

router.post("/generate-presentation", async (req, res) => {

  try {

    const { briefing, instructions, existingSlides } = req.body

    const slides = await generateSlides(briefing, instructions, existingSlides)

    /*
    Generate AI background for each slide
    */

    let backgroundImage = null

    try {

    backgroundImage = await generateBackground(
        "minimal dark corporate presentation background with gradient shapes"
    )

    } catch (err) {

    console.error("background generation failed:", err)

    }

    for (const slide of slides.slides) {

    slide.backgroundImage = backgroundImage

    }

        res.json(slides)

    } catch (err) {

    console.error("slide generation error:", err)

    res.status(500).json({
      error: "slide generation failed"
    })
  }

})

/*
EXPORT POWERPOINT
*/

router.post("/export-presentation", async (req, res) => {

  try {

    const slides = req.body

    const ppt = await createPresentation(slides)

    res.setHeader(
      "Content-Disposition",
      "attachment; filename=analysis.pptx"
    )

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    )

    res.send(ppt)

  } catch (err) {

    console.error("ppt export error:", err)

    res.status(500).json({
      error: "ppt export failed"
    })
  }

})

export default router