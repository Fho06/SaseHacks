export function chunkText(text, size = 800, overlap = 100) {

  const chunks = []

  let start = 0

  while (start < text.length) {

    const end = start + size

    const chunk = text.slice(start, end)

    chunks.push(chunk)

    start += size - overlap
  }

  return chunks
}