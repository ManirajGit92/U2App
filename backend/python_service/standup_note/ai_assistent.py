
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="U2Tools API")

# Allow your Angular website to call this API.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://u2tools.web.app",
        "http://localhost:4200",
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def home():
    return {"message": "U2Tools API is running"}


@app.get("/api/hello")
def hello():
    return {
        "message": "Hello from Python FastAPI!",
        "status": "success",
        "technology": "Python"
    }
