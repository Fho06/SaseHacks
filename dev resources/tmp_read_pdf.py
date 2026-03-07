import sys
from PyPDF2 import PdfReader
from pathlib import Path
sys.stdout.reconfigure(encoding='utf-8')
reader = PdfReader(Path(r'c:/Users/Owner/Downloads/Sasehacks.pdf'))
text = '\n'.join(page.extract_text() or '' for page in reader.pages)
print(len(text))
print(text[:2000])
