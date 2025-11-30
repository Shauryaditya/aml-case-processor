from fastapi import FastAPI, UploadFile, File, BackgroundTasks
from fastapi.responses import JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
import uuid
from .jobs import process_uploaded_file, JOB_STORE
from pathlib import Path

app = FastAPI(title="AML Case Processor")

# CORS so Next.js frontend can call this API
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://aml-case-processor.vercel.app"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = Path(__file__).resolve().parent.parent  # backend/
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)  # create folder if it doesn't exist

@app.post("/api/upload")
async def upload(file: UploadFile = File(...), background_tasks: BackgroundTasks = None):
    job_id = str(uuid.uuid4())

    # build a path like: backend/uploads/<job_id>_filename.ext
    file_path = UPLOAD_DIR / f"{job_id}_{file.filename}"

    contents = await file.read()
    with open(file_path, "wb") as f:
        f.write(contents)

    JOB_STORE[job_id] = {
        "status": "queued",
        "file": str(file_path),
    }

    if background_tasks is not None:
        background_tasks.add_task(process_uploaded_file, job_id)
    else:
        # synchronous for debugging
        process_uploaded_file(job_id)

    return {"job_id": job_id}

@app.get("/api/status/{job_id}")
def status(job_id: str):
    return JOB_STORE.get(job_id, {"error":"not_found"})

@app.get("/api/result/{job_id}")
def result(job_id: str):
    job = JOB_STORE.get(job_id)
    if not job:
        return JSONResponse({"error":"not_found"}, status_code=404)
    return job.get("result", {"status": job.get("status")})

@app.get("/api/download/{job_id}")
def download(job_id: str):
    job = JOB_STORE.get(job_id)
    if not job:
        return JSONResponse({"error":"not_found"}, status_code=404)
    pdf_path = job.get("pdf")
    if not pdf_path:
        return JSONResponse({"error":"no_pdf"}, status_code=400)
    return FileResponse(pdf_path, media_type="application/pdf", filename=f"sar_{job_id}.pdf")
