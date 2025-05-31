// frontend/src/hooks/useProctoring.js
import { useState, useEffect, useRef, useCallback } from 'react';
import websocketService from '../services/websocket';
import faceDetectionService from '../services/faceDetection';
import audioMonitoringService from '../services/audioMonitoring';

export const useProctoring = (attemptId) => {
  const [isConnected, setIsConnected] = useState(false);
  const [violations, setViolations] = useState([]);
  const [cameraStream, setCameraStream] = useState(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [faceDetected, setFaceDetected] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [microphoneEnabled, setMicrophoneEnabled] = useState(false);
  const [error, setError] = useState('');
  
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const audioContextRef = useRef(null);

  const logViolation = useCallback((violationType, description) => {
    const violation = {
      type: violationType,
      description: description,
      timestamp: new Date().toISOString(),
      severity: 'MEDIUM'
    };
    
    setViolations(prev => [...prev, violation]);
    
    if (isConnected) {
      websocketService.send({
        type: 'violation',
        violation_type: violationType,
        description: description,
        timestamp: violation.timestamp
      });
    }
  }, [isConnected]);

  const initializeMedia = async () => {
    try {
      console.log('Initializing media devices...');
      setError('');
      
      const constraints = {
        video: { 
          width: { ideal: 640 }, 
          height: { ideal: 480 },
          facingMode: 'user'
        },
        audio: true
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      setCameraStream(stream);
      
      console.log('Media stream obtained:', stream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCameraEnabled(true);
        
        // Wait for video to load before starting face detection
        videoRef.current.onloadedmetadata = () => {
          console.log('Video metadata loaded, starting face detection...');
          startFaceDetection();
        };
        
        videoRef.current.onerror = (error) => {
          console.error('Video error:', error);
          setError('Failed to load video stream');
          setCameraEnabled(false);
        };
      }

      // Start audio monitoring
      const audioStarted = await startAudioMonitoring(stream);
      setMicrophoneEnabled(audioStarted);

      return true;
    } catch (error) {
      console.error('Error accessing media devices:', error);
      setError(`Media access error: ${error.message}`);
      setCameraEnabled(false);
      setMicrophoneEnabled(false);
      return false;
    }
  };

  const startFaceDetection = () => {
    if (!videoRef.current) {
      console.log('Video element not available for face detection');
      return;
    }

    console.log('Starting face detection...');
    
    faceDetectionService.startDetection(videoRef.current, (result) => {
      console.log('Face detection result:', result);
      
      if (result.error) {
        console.error('Face detection error:', result.error);
        setFaceDetected(false);
      } else {
        const detected = result.faces > 0;
        setFaceDetected(detected);
        
        // Send face detection data to WebSocket if connected
        if (isConnected && result.imageData) {
          websocketService.send({
            type: 'face_detection',
            faces_detected: result.faces,
            confidence: result.confidence,
            image: result.imageData
          });
        }
        
        // Log violation if no face detected for extended period
        if (!detected) {
          logViolation('NO_FACE_DETECTED', 'Face not visible in camera');
        }
      }
    });
  };

  const startAudioMonitoring = async (stream) => {
    try {
      console.log('Starting audio monitoring...');
      
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = audioContextRef.current.createAnalyser();
      const microphone = audioContextRef.current.createMediaStreamSource(stream);
      
      analyser.fftSize = 256;
      microphone.connect(analyser);
      
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const monitorAudio = () => {
        if (!audioContextRef.current || audioContextRef.current.state === 'closed') return;
        
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((sum, value) => sum + value, 0) / bufferLength;
        const normalizedLevel = average / 255;
        
        setAudioLevel(normalizedLevel);
        
        // Send audio level to WebSocket if connected
        if (isConnected) {
          websocketService.send({
            type: 'audio_level',
            level: normalizedLevel
          });
        }
        
        requestAnimationFrame(monitorAudio);
      };
      
      monitorAudio();
      return true;
    } catch (error) {
      console.error('Audio monitoring error:', error);
      return false;
    }
  };

  const startProctoring = async () => {
    console.log('Starting proctoring for attempt:', attemptId);
    
    if (!attemptId) {
      console.log('No attempt ID provided');
      return false;
    }

    try {
      // Initialize media devices
      const mediaInitialized = await initializeMedia();
      if (!mediaInitialized) {
        console.error('Failed to initialize media devices');
        return false;
      }

      // Connect WebSocket
      websocketService.connect(attemptId, {
        onOpen: () => {
          console.log('WebSocket connected');
          setIsConnected(true);
        },
        onClose: () => {
          console.log('WebSocket disconnected');
          setIsConnected(false);
        },
        onMessage: (data) => {
          console.log('WebSocket message received:', data);
          
          switch (data.type) {
            case 'face_detection_result':
              setFaceDetected(data.faces_detected === 1);
              break;
            case 'violation_logged':
              setViolations(prev => [...prev, data.violation]);
              break;
            case 'proctoring_status':
              // Handle proctoring status updates
              break;
            default:
              console.log('Unknown message type:', data.type);
          }
        },
        onError: (error) => {
          console.error('WebSocket error:', error);
          setError('Connection error occurred');
        }
      });

      setIsInitialized(true);
      console.log('Proctoring initialized successfully');
      return true;
    } catch (error) {
      console.error('Error starting proctoring:', error);
      setError(`Failed to start proctoring: ${error.message}`);
      return false;
    }
  };

  const stopProctoring = () => {
    console.log('Stopping proctoring...');
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
        console.log('Stopped track:', track.kind);
      });
      streamRef.current = null;
    }
    
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    faceDetectionService.stopDetection();
    audioMonitoringService.stopMonitoring();
    websocketService.disconnect();
    
    setIsInitialized(false);
    setIsConnected(false);
    setCameraEnabled(false);
    setMicrophoneEnabled(false);
    setCameraStream(null);
    setFaceDetected(false);
    setAudioLevel(0);
    
    console.log('Proctoring stopped');
  };

  // Monitor tab visibility and other violations
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && isInitialized) {
        logViolation('TAB_SWITCH', 'User switched tabs or minimized window');
      }
    };

    const handleWindowBlur = () => {
      if (isInitialized) {
        logViolation('WINDOW_BLUR', 'Window lost focus');
      }
    };

    const handleContextMenu = (e) => {
      if (isInitialized) {
        e.preventDefault();
        logViolation('RIGHT_CLICK', 'Right click attempted');
      }
    };

    const handleCopyPaste = (e) => {
      if (isInitialized && e.ctrlKey && (e.key === 'c' || e.key === 'v' || e.key === 'x')) {
        e.preventDefault();
        logViolation('COPY_PASTE', `${e.key.toUpperCase()} key combination attempted`);
      }
    };

    const handleKeyDown = (e) => {
      if (isInitialized) {
        // Prevent F12, Ctrl+Shift+I, Ctrl+U, etc.
        if (e.key === 'F12' || 
            (e.ctrlKey && e.shiftKey && e.key === 'I') ||
            (e.ctrlKey && e.key === 'u')) {
          e.preventDefault();
          logViolation('DEV_TOOLS', 'Attempted to open developer tools');
        }
      }
    };

    const handleBeforeUnload = (e) => {
      if (isInitialized) {
        logViolation('PAGE_UNLOAD', 'User attempted to leave the page');
        e.preventDefault();
        e.returnValue = '';
      }
    };

    if (isInitialized) {
      document.addEventListener('visibilitychange', handleVisibilityChange);
      window.addEventListener('blur', handleWindowBlur);
      document.addEventListener('contextmenu', handleContextMenu);
      document.addEventListener('keydown', handleCopyPaste);
      document.addEventListener('keydown', handleKeyDown);
      window.addEventListener('beforeunload', handleBeforeUnload);
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleCopyPaste);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isInitialized, logViolation]);

  // Auto-start proctoring when attemptId is available
  useEffect(() => {
    if (attemptId && !isInitialized) {
      console.log('Auto-starting proctoring for attempt:', attemptId);
      // Add a small delay to ensure component is fully mounted
      const timer = setTimeout(() => {
        startProctoring();
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [attemptId, isInitialized]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopProctoring();
    };
  }, []);

  return {
    isConnected,
    violations,
    audioLevel,
    faceDetected,
    cameraEnabled,
    microphoneEnabled,
    videoRef,
    startProctoring,
    stopProctoring,
    logViolation,
    isInitialized,
    error
  };
};
