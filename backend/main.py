import os
import sys
import warnings
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from rembg import remove, new_session
import base64

# Local Model Configuration
current_dir = os.path.dirname(os.path.abspath(__file__))
models_dir = os.path.join(current_dir, "models")
os.environ["U2NET_HOME"] = models_dir

# Suppress mathematically harmless runtime warnings related to Cholesky decomposition
warnings.filterwarnings("ignore", message=".*Thresholded incomplete Cholesky decomposition failed.*")

# Application Initialization
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Engine Initialization
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

logger.info("Initializing AI Model Session...")
ai_session = new_session(
    "u2net", 
    providers=["DmlExecutionProvider", "CPUExecutionProvider"]
)
logger.info("Model loaded and execution providers are ready.")

class ImageData(BaseModel):
    image_data: str
    sensitivity: int = 3 

# Note: Function is maintained as synchronous (def) to allow FastAPIs threadpool
# to handle blocking operations without freezing the main event loop.
@app.post("/api/remove-bg")
def remove_background(data: ImageData):
    try:
        header, encoded = data.image_data.split(",", 1)
        image_bytes = base64.b64decode(encoded)
        
        # Alpha Matting Parameter Mapping
        params_map = {
            1: {"erode": 10, "bg_thresh": 15, "fg_thresh": 100},
            2: {"erode": 15, "bg_thresh": 20, "fg_thresh": 150},
            3: {"erode": 20, "bg_thresh": 30, "fg_thresh": 200},
            4: {"erode": 30, "bg_thresh": 40, "fg_thresh": 300},
            5: {"erode": 40, "bg_thresh": 60, "fg_thresh": 400} 
        }
        
        setting = params_map.get(data.sensitivity, params_map[3])
        
        # AI Execution
        output_bytes = remove(
            image_bytes,
            session=ai_session,
            alpha_matting=True,
            alpha_matting_foreground_threshold=setting["fg_thresh"],
            alpha_matting_background_threshold=setting["bg_thresh"],
            alpha_matting_erode_size=setting["erode"]
        )
        
        output_base64 = base64.b64encode(output_bytes).decode("utf-8")
        result_image = f"{header},{output_base64}"
        
        return {"result_image": result_image}
        
    except Exception as e:
        logger.error(f"Extraction failed: {str(e)}")
        return {"error": str(e)}