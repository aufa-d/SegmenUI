
# SegmenUI

SegmenUI is a desktop application for local image background removal. It uses a sidecar architecture, combining a React/Electron frontend with a Python/FastAPI backend that handles the image processing via `rembg`. 

## Features
* Local image processing without cloud dependencies.
* Hardware acceleration (DirectML/CPU) via ONNX Runtime.
* Sidecar execution model (Electron automatically manages the Python backend process).

## Core Technologies
This application integrates the following open-source projects and models:
* **[rembg](https://github.com/danielgatis/rembg)**: Background removal tool.
* **[U-2-Net](https://github.com/xuebinqin/U-2-Net)**: Salient object detection models (`u2net.onnx`, `u2netp.onnx`).
* **[FastAPI](https://github.com/tiangolo/fastapi)** & **[Uvicorn](https://www.uvicorn.org/)**: Python API server.
* **[React](https://react.dev/)** & **[Vite](https://vitejs.dev/)**: UI rendering and bundling.
* **[Electron](https://www.electronjs.org/)**: Desktop packaging and background process orchestration.

## Development Setup

### Prerequisites
* Node.js v18+
* Python 3.9+

### 1. Backend 
Navigate to the `backend` directory, set up a virtual environment, and install the required dependencies.
```bash
cd backend
python -m venv env

# Activate environment (Windows)
.\env\Scripts\activate
# Activate environment (macOS/Linux)
source env/bin/activate

pip install -r requirements.txt
```

*Note: Ensure your downloaded `u2net.onnx` or `u2netp.onnx` file is placed inside the `backend/models/` directory to prevent automatic downloads on the first run.*

Start the backend server:
```bash
uvicorn main:app --reload --port 8000
```

### 2. Frontend
Open a new terminal at the project root directory.
```bash
npm install
npm run dev
```

## Building for Production (Windows)

To generate a standalone Windows installer, compile the Python backend first, followed by the Electron app.

**Step 1: Compile the Backend**
From the `backend` directory (ensure your virtual environment is active):
```bash
pip install pyinstaller
pyinstaller --name segmen-engine --onedir --add-data "models;models" --hidden-import="uvicorn" --hidden-import="fastapi" --hidden-import="pydantic" --hidden-import="anyio" --hidden-import="starlette" main.py
```

**Step 2: Build the Electron App**
From the project root directory:
```bash
npm run electron:build
```
The final installer will be generated in the `release/` directory.

## License
MIT License