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