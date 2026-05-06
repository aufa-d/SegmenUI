import { useState, useRef, useEffect } from 'react';
import './App.css';

function App() {
  const [imageFile, setImageFile] = useState(null);
  
  // Base image reference to prevent cumulative extraction degradation
  const [baseImage, setBaseImage] = useState(null); 
  const [fileName, setFileName] = useState("No file selected");
  const [mode, setMode] = useState('idle'); 
  const [isDrawing, setIsDrawing] = useState(false);
  const [path, setPath] = useState([]);
  const [boundingBox, setBoundingBox] = useState(null);
  const [isExtracting, setIsExtracting] = useState(false);
  
  const [sensitivity, setSensitivity] = useState(3);
  const [history, setHistory] = useState([]);
  const [redoStack, setRedoStack] = useState([]);

  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const abortControllerRef = useRef(null);

  const drawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas || !imageFile) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(imageFile, 0, 0, canvas.width, canvas.height);

    if (mode === 'search') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    if (path.length > 0) {
      ctx.beginPath();
      ctx.moveTo(path[0].x, path[0].y);
      for (let i = 1; i < path.length; i++) {
        ctx.lineTo(path[i].x, path[i].y);
      }
      ctx.strokeStyle = '#00A8FF';
      ctx.lineWidth = 8; 
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    if (boundingBox) {
      ctx.strokeStyle = '#00C853';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.strokeRect(boundingBox.x, boundingBox.y, boundingBox.width, boundingBox.height);
      ctx.setLineDash([]);
      
      if (mode === 'search') {
        ctx.save();
        ctx.beginPath();
        ctx.rect(boundingBox.x, boundingBox.y, boundingBox.width, boundingBox.height);
        ctx.clip();
        ctx.drawImage(imageFile, 0, 0, canvas.width, canvas.height);
        ctx.restore();
      }
    }
  };

  useEffect(() => {
    drawCanvas();
  }, [imageFile, mode, path, boundingBox]);

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      setFileName(file.name);
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = canvasRef.current;
          canvas.width = img.width;
          canvas.height = img.height;
          setImageFile(img);
          setBaseImage(img);
          setHistory([img]); 
          setRedoStack([]); 
          resetTools();
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    }
    event.target.value = null;
  };

  const resetTools = () => {
    setMode('idle');
    setPath([]);
    setBoundingBox(null);
  };

  const toggleSearchMode = () => {
    if (mode === 'search') {
      resetTools(); 
    } else {
      setMode('search');
    }
  };

  const getCanvasMousePos = (event) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY
    };
  };

  const handleMouseDown = (e) => {
    if (mode !== 'search') return;
    setIsDrawing(true);
    setBoundingBox(null);
    setPath([getCanvasMousePos(e)]);
  };

  const handleMouseMove = (e) => {
    if (!isDrawing || mode !== 'search') return;
    setPath((prev) => [...prev, getCanvasMousePos(e)]);
  };

  const handleMouseUp = () => {
    if (!isDrawing || mode !== 'search') return;
    setIsDrawing(false);
    
    if (path.length > 5) {
      const xs = path.map(p => p.x);
      const ys = path.map(p => p.y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      
      setBoundingBox({ x: minX, y: minY, width: maxX - minX, height: maxY - minY });
    }
    setPath([]);
  };

  const handleCrop = () => {
    if (!boundingBox || !imageFile) return;
    const canvas = canvasRef.current;
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = boundingBox.width;
    tempCanvas.height = boundingBox.height;
    const tempCtx = tempCanvas.getContext('2d');
    
    tempCtx.drawImage(
      imageFile,
      boundingBox.x, boundingBox.y, boundingBox.width, boundingBox.height,
      0, 0, boundingBox.width, boundingBox.height
    );
    
    const croppedImg = new Image();
    croppedImg.onload = () => {
      canvas.width = croppedImg.width;
      canvas.height = croppedImg.height;
      setImageFile(croppedImg);
      setBaseImage(croppedImg);
      setHistory(prev => [...prev, croppedImg]);
      setRedoStack([]); 
      resetTools();
    };
    croppedImg.src = tempCanvas.toDataURL();
  };

  const handleUndo = () => {
    if (history.length > 1) {
      const currentState = history[history.length - 1];
      setRedoStack(prev => [currentState, ...prev]);

      const newHistory = [...history];
      newHistory.pop();
      const prevImg = newHistory[newHistory.length - 1];
      
      const canvas = canvasRef.current;
      canvas.width = prevImg.width;
      canvas.height = prevImg.height;
      setImageFile(prevImg);
      setHistory(newHistory);
      resetTools();
    }
  };

  const handleRedo = () => {
    if (redoStack.length > 0) {
      const nextState = redoStack[0];
      setHistory(prev => [...prev, nextState]);

      const newRedoStack = [...redoStack];
      newRedoStack.shift();
      setRedoStack(newRedoStack);

      const canvas = canvasRef.current;
      canvas.width = nextState.width;
      canvas.height = nextState.height;
      setImageFile(nextState);
      resetTools();
    }
  };

  const handleSave = () => {
    if (!imageFile) return;
    const canvas = canvasRef.current;
    const link = document.createElement('a');
    link.download = `Export_${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const handleExtract = async () => {
    if (!baseImage) return;
    setIsExtracting(true);
    
    const controller = new AbortController();
    abortControllerRef.current = controller;
    
    try {
      // Create local canvas from base reference to preserve quality
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = baseImage.width;
      tempCanvas.height = baseImage.height;
      const tempCtx = tempCanvas.getContext('2d');
      tempCtx.drawImage(baseImage, 0, 0);
      
      const base64Image = tempCanvas.toDataURL('image/png');

      const response = await fetch('http://127.0.0.1:8000/api/remove-bg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          image_data: base64Image,
          sensitivity: sensitivity 
        }),
        signal: controller.signal
      });

      if (response.ok) {
        const data = await response.json();
        const newImg = new Image();
        newImg.onload = () => {
          const canvas = canvasRef.current;
          canvas.width = newImg.width;
          canvas.height = newImg.height;
          setImageFile(newImg);
          setHistory(prev => [...prev, newImg]); 
          setRedoStack([]);
          setIsExtracting(false);
        };
        newImg.src = data.result_image;
      } else {
        alert('Failed to process image on server.');
        setIsExtracting(false);
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('Extraction aborted by user.');
      } else {
        console.error(error);
        alert('Server connection error.');
      }
      setIsExtracting(false);
    }
  };

  const handleCancelExtract = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  return (
    <div className="app-container">
      <div className="canvas-area">
        <div 
          className="canvas-wrapper" 
          onClick={() => !imageFile && fileInputRef.current.click()}
          style={{ cursor: !imageFile ? 'pointer' : 'default' }}
        >
          <div className="checkerboard-bg"></div>
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            style={{ 
              zIndex: 1, 
              maxWidth: '100%', 
              maxHeight: '100%', 
              objectFit: 'contain',
              cursor: mode === 'search' ? 'crosshair' : (imageFile ? 'default' : 'pointer'),
              display: imageFile ? 'block' : 'none'
            }}
          />
          {!imageFile && <span className="empty-text">Click here to open an image</span>}
        </div>
      </div>

      <div className="control-panel">
        <div className="panel-header">
          <h2>SegmenUI</h2>
          <p>Image Segmentation Editor</p>
        </div>

        <div className="tools-container">
          <div className="tool-group">
            <label>File</label>
            <div className="action-row">
              <input type="file" accept="image/*" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileChange} />
              <button className="btn btn-outline" onClick={() => fileInputRef.current.click()}>Open</button>
              <div className="file-display" title={fileName}>{fileName}</div>
            </div>
          </div>

          <div className="tool-group">
            <label>Crop Selection</label>
            <div className="action-row">
              <button 
                className="btn btn-action" 
                onClick={toggleSearchMode}
                disabled={!imageFile}
                style={{ backgroundColor: mode === 'search' ? '#E53935' : '' }}
              >
                {mode === 'search' ? 'Cancel' : 'Define Area'}
              </button>
              <button className="btn btn-action" disabled={!boundingBox} onClick={handleCrop}>Apply Crop</button>
            </div>
            <small className="hint-text">Define a bounding box to isolate the target object prior to extraction.</small>
          </div>

          <div className="tool-group">
            <label>Background Removal</label>
            
            <div className="slider-container">
              <span className="slider-label">Level {sensitivity}</span>
              <input 
                type="range" 
                min="1" 
                max="5" 
                value={sensitivity} 
                onChange={(e) => setSensitivity(parseInt(e.target.value))}
                className="custom-slider"
                title="Adjust edge erosion aggressiveness"
              />
            </div>

            <div className="action-row">
              <button 
                className="btn btn-magic" 
                disabled={!imageFile || isExtracting} 
                onClick={handleExtract}
              >
                {isExtracting ? "Processing..." : "Extract"}
              </button>
              
              {isExtracting ? (
                <button className="btn btn-action" style={{ backgroundColor: '#E53935', color: '#fff' }} onClick={handleCancelExtract}>
                  Abort
                </button>
              ) : (
                <button className="btn btn-success" disabled={!imageFile} onClick={handleSave}>
                  Save Image
                </button>
              )}
            </div>
            <small className="hint-text">Extraction automatically executes alpha matting based on the defined level.</small>
          </div>
        </div>

        <div className="history-group">
          <button className="btn btn-icon" onClick={handleUndo} disabled={history.length <= 1}>Undo</button>
          <button className="btn btn-icon" onClick={handleRedo} disabled={redoStack.length === 0}>Redo</button>
        </div>
      </div>
    </div>
  );
}

export default App;