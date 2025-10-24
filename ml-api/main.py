from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

app = FastAPI(title="OncoChat ML API")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "OncoChat ML API is running"}

@app.post("/analyze-image")
async def analyze_image(file: UploadFile = File(...)):
    # TODO: Integrate your friend's ML model here
    return {
        "status": "analysis_complete",
        "message": "ML model integration pending",
        "findings": [],
        "confidence": 0.0
    }

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
from fastapi import FastAPI, UploadFile, File
from fastapi.responses import JSONResponse
from model_infer import CancerModel
import os, shutil

app = FastAPI(title="OncoChat ML API")
model = CancerModel()

@app.get("/")
def root():
    return {"message": "ML Inference API running ✅"}

@app.post("/api/analyze")
async def analyze(file: UploadFile = File(...)):
    os.makedirs("temp", exist_ok=True)
    tmp_path = os.path.join("temp", file.filename)
    with open(tmp_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    try:
        result = model.predict(tmp_path)
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})
    finally:
        os.remove(tmp_path)
    return result
