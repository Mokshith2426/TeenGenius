import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { Camera, RotateCw, X, Check, RefreshCw, AlertCircle } from 'lucide-react';

interface CameraCaptureProps {
  onCapture: (file: File) => void;
  onClose: () => void;
}

export default function CameraCapture({ onCapture, onClose }: CameraCaptureProps) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [capturedDataUrl, setCapturedDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Check for multiple video input devices (e.g., front/rear cameras)
  useEffect(() => {
    navigator.mediaDevices.enumerateDevices()
      .then(devices => {
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        setHasMultipleCameras(videoDevices.length > 1);
      })
      .catch(err => {
        console.warn('Enumerating devices failed:', err);
      });
  }, []);

  // Initialize and run the selected camera facing mode
  const startCamera = async () => {
    setIsInitializing(true);
    setError(null);
    
    // Stop any previously playing streams to clear hardware locks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setStream(null);

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingMode,
          width: { ideal: 1080 },
          height: { ideal: 1080 }
        },
        audio: false
      });
      
      streamRef.current = mediaStream;
      setStream(mediaStream);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err: any) {
      console.error('Error starting video stream:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError('Camera permission denied. Please allow camera access in your browser preferences.');
      } else {
        setError(err.message || 'Unable to load camera input stream on your device.');
      }
    } finally {
      setIsInitializing(false);
    }
  };

  useEffect(() => {
    if (!capturedDataUrl) {
      startCamera();
    }

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [facingMode, capturedDataUrl]);

  const toggleFacingMode = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !stream) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Dynamically lock dimension
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 640;

    // Apply front-facing horizontal mirror effect to matching output canvas
    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    if (facingMode === 'user') {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }

    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setCapturedDataUrl(dataUrl);

    // Stop streams helper to reduce processor heat & battery strain
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setStream(null);
  };

  const handleRetake = () => {
    setCapturedDataUrl(null);
  };

  const handleSendCapturedImage = () => {
    if (!capturedDataUrl) return;

    try {
      // Decode base64 to File object
      const arr = capturedDataUrl.split(',');
      const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      
      const file = new File([u8arr], `instashot_${Date.now()}.jpg`, { type: mime });
      onCapture(file);
      onClose();
    } catch (e) {
      console.error('Failed to translate camera data URL into raw binary:', e);
      setError('Corrupt picture data stream. Please try taking another photo.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[100] flex items-center justify-center p-4">
      <div className="bg-zinc-950 text-white rounded-[2rem] w-full max-w-md border border-zinc-800 shadow-2xl overflow-hidden relative flex flex-col h-[560px]">
        
        {/* Top Control Bar */}
        <div className="p-4 flex items-center justify-between border-b border-zinc-900 shrink-0 z-10 bg-zinc-950">
          <div className="flex items-center gap-2">
            <Camera className="text-blue-500 animate-pulse" size={18} />
            <h3 className="font-black text-xs uppercase tracking-widest text-zinc-100 italic">
              Academic Lens
            </h3>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-xl transition-all cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Viewfinder or Preview Area */}
        <div className="flex-1 min-h-0 bg-black relative flex items-center justify-center overflow-hidden">
          {error ? (
            <div className="p-8 text-center max-w-xs space-y-4">
              <div className="p-3 bg-red-500/10 text-red-500 rounded-full w-fit mx-auto border border-red-500/20">
                <AlertCircle size={28} />
              </div>
              <p className="text-xs font-semibold text-zinc-300 leading-relaxed">{error}</p>
              <button 
                onClick={startCamera}
                className="mt-2 px-5 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-xs font-black uppercase tracking-wider rounded-xl transition-all inline-flex items-center gap-2 border border-zinc-800"
              >
                <RefreshCw size={12} /> Retry Camera
              </button>
            </div>
          ) : isInitializing ? (
            <div className="text-center space-y-3">
              <RefreshCw className="animate-spin text-blue-500 mx-auto" size={28} />
              <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 font-mono">
                Powering Sensor Matrix...
              </p>
            </div>
          ) : capturedDataUrl ? (
            // Photo Preview State
            <img 
              src={capturedDataUrl} 
              alt="Preview" 
              className="w-full h-full object-cover animate-fadeIn select-none"
            />
          ) : (
            // Live Stream State
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover transition-transform duration-300 ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
            />
          )}

          {/* Hidden Snapshot Canvas */}
          <canvas ref={canvasRef} className="hidden" />
        </div>

        {/* Action Controls Panel */}
        <div className="p-6 bg-zinc-950 border-t border-zinc-900 shrink-0 flex items-center justify-center min-h-[110px]">
          {error ? null : capturedDataUrl ? (
            // REVIEW CONTROLS
            <div className="flex items-center gap-6 w-full px-4 animate-slideUp">
              <button
                type="button"
                onClick={handleRetake}
                className="flex-1 py-4 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 rounded-2xl font-black text-xs uppercase tracking-wider select-none transition-all active:scale-95 cursor-pointer text-center flex items-center justify-center gap-2"
              >
                <RefreshCw size={14} /> Retake
              </button>
              <button
                type="button"
                onClick={handleSendCapturedImage}
                className="flex-1 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black text-xs uppercase tracking-wider select-none transition-all active:scale-95 cursor-pointer text-center flex items-center justify-center gap-2 shadow-lg shadow-blue-500/10"
              >
                <Check size={14} /> Send Shot
              </button>
            </div>
          ) : (
            // LIVE HUD CONTROLS
            <div className="flex items-center justify-between w-full px-8">
              {/* Spacer / Flip Toggle */}
              <div className="w-12 h-12 flex items-center justify-center">
                {hasMultipleCameras && !isInitializing && (
                  <button
                    type="button"
                    onClick={toggleFacingMode}
                    className="p-3 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-xl transition-all cursor-pointer active:scale-90"
                    title="Flip Camera Input"
                  >
                    <RotateCw size={16} />
                  </button>
                )}
              </div>

              {/* Shutter Halo Button */}
              <button
                type="button"
                onClick={capturePhoto}
                disabled={isInitializing || !stream}
                className="w-16 h-16 rounded-full border-4 border-white/30 hover:border-white/50 flex items-center justify-center p-1 cursor-pointer transition-all hover:scale-105 active:scale-95 disabled:opacity-40"
                title="Capture Photographic Frame"
              >
                <div className="w-full h-full bg-white rounded-full transition-transform hover:scale-95 active:scale-90" />
              </button>

              {/* Standard text cancel placeholder for architectural visual balance */}
              <button
                type="button"
                onClick={onClose}
                className="w-12 text-center text-zinc-500 hover:text-zinc-300 text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer select-none"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
