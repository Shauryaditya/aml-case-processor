from gtts import gTTS
import os

text = """
Welcome to your quick audit summary of the AML Case Processor project. Let's break down what we've found.

1. The Overview
This application is a specialized tool for Anti-Money Laundering investigators. Its job is to take raw financial transaction files—like CSVs or PDFs—and automatically detect suspicious patterns, such as 'smurfing' or 'structuring'. It then uses AI to draft a regulatory Suspicious Activity Report, or SAR, saving investigators hours of paperwork.

2. Under the Hood
Technically, the project is built on a modern, split-stack architecture.
On the backend, we have FastAPI running on Python, which handles the heavy lifting of parsing files and running detection rules.
On the frontend, it’s a sleek Next.js application that gives users real-time feedback and visualization.
Crucially, it leverages OpenRouter to access advanced AI models—using Google Gemini for writing narratives and Arcee Trinity for pinpointing locations.

3. Key Strengths
Our analysis found some major wins:
First, the architecture is clean. It smartly separates 'hard' deterministic rules from 'soft' generative AI. This is critical for compliance auditing.
Second, the error handling is robust. If the AI service fails, the system doesn't crash; it gracefully falls back to a pre-defined template, ensuring business continuity.

4. The Roadmap
However, to get this production-ready, we need to address two things:
One: Persistence. Right now, everything is stored in memory. If the server restarts, you lose your case history. We need to implement a database like PostgreSQL.
Two: Scalability. The background processing is currently simple. For high volumes, we should upgrade to a proper job queue using Redis.

Conclusion
In short: The AML Case Processor is a solid, well-engineered foundation. With the addition of a database, it will be ready for deployment.

Analysis complete.
"""

# Generate audio
tts = gTTS(text=text, lang='en', tld='co.uk') # using UK accent for "professional" feel
output_path = "project_summary.mp3"
tts.save(output_path)

print(f"Audio summary generated at: {os.path.abspath(output_path)}")
