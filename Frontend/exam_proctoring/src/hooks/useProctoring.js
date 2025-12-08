// frontend/src/hooks/useProctoring.js
import { useState, useEffect, useRef, useCallback } from 'react';
import websocketService from '../services/websocket';
import faceDetectionService from '../services/faceDetection';
import audioMonitoringService from '../services/audioMonitoring';
import api from '../services/api';

export const useProctoring = (attemptId, onTabSwitchLimitReached = null) => {
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
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

  const logViolation = useCallback(async (violationType, description) => {
    const violation = {
      type: violationType,
      description: description,
      timestamp: new Date().toISOString(),
      severity: 'MEDIUM'
    };
    
    setViolations(prev => [...prev, violation]);
    
    // Violation logging disabled for backend to reduce load
    // Violations are still tracked locally in state
    // Backend reporting can be enabled later if needed
  }, []);

  const initializeMedia = async () => {
    try {
      // Initializing media devices
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
      
      // Media stream obtained
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCameraEnabled(true);
        
        // Wait for video to load before starting face detection
        videoRef.current.onloadedmetadata = () => {
          // Video metadata loaded, starting face detection
          startFaceDetection();
        };
        
        videoRef.current.onerror = (error) => {
          // Video error occurred
          setError('Failed to load video stream');
          setCameraEnabled(false);
        };
      }

      // Start audio monitoring
      const audioStarted = await startAudioMonitoring(stream);
      setMicrophoneEnabled(audioStarted);

      return true;
    } catch (error) {
      // Error accessing media devices
      setError(`Media access error: ${error.message}`);
      setCameraEnabled(false);
      setMicrophoneEnabled(false);
      return false;
    }
  };

  const startFaceDetection = () => {
    if (!videoRef.current) {
      // Video element not available for face detection
      return;
    }

    // Starting face detection
    
    faceDetectionService.startDetection(videoRef.current, (result) => {
      // Face detection result received
      
      if (result.error) {
        // Face detection error occurred
        setFaceDetected(false);
      } else {
        const detected = result.faces > 0;
        setFaceDetected(detected);
        
        // Send face detection data to WebSocket if connected (WITHOUT IMAGE DATA)
        if (isConnected) {
          websocketService.send({
            type: 'face_detection',
            faces_detected: result.faces,
            confidence: result.confidence
            // Removed image data to reduce WebSocket errors and bandwidth
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
      // Starting audio monitoring
      
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
      // Audio monitoring error occurred
      return false;
    }
  };

  const startProctoring = useCallback(async () => {
    // Prevent multiple simultaneous initializations
    if (isInitialized) {
      return false;
    }
    
    // Starting proctoring for attempt
    if (!attemptId) {
      // No attempt ID provided
      return false;
    }

    try {
      // Initialize media devices first
      const mediaInitialized = await initializeMedia();
      if (!mediaInitialized) {
        // Failed to initialize media devices
        return false;
      }

      // WebSocket connection removed - violations are sent via HTTP POST instead
      // Keeping isConnected false since we're not using WebSocket anymore
      setIsConnected(false);

      setIsInitialized(true);
      // Proctoring initialized successfully
      return true;
    } catch (error) {
      // Error starting proctoring
      setError(`Failed to start proctoring: ${error.message}`);
      return false;
    }
  }, [attemptId, isInitialized]);

  const stopProctoring = useCallback(() => {
    // Stopping proctoring
    
    // Stop face detection first
    faceDetectionService.stopDetection();
    audioMonitoringService.stopMonitoring();
    
    // Stop media tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
        // Stopped track
      });
      streamRef.current = null;
    }
    
    // Stop audio context
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    // Clear video element
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    // Disconnect WebSocket
    websocketService.disconnect();
    
    // Reset all state
    setIsInitialized(false);
    setIsConnected(false);
    setCameraEnabled(false);
    setMicrophoneEnabled(false);
    setCameraStream(null);
    setFaceDetected(false);
    setAudioLevel(0);
    setError('');
    
    // Proctoring stopped
  }, []);

  // Monitor tab visibility and other violations
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && isInitialized) {
        const newCount = tabSwitchCount + 1;
        setTabSwitchCount(newCount);
        logViolation('TAB_SWITCH', `User switched tabs or minimized window (Count: ${newCount})`);
        // No auto-submit - just log the violation
      }
    };

    const handleWindowBlur = (e) => {
      if (isInitialized) {
        // Ignore blur events from file inputs (file picker dialogs)
        const activeElement = document.activeElement;
        if (activeElement && (
          activeElement.tagName === 'INPUT' && activeElement.type === 'file' ||
          activeElement.closest('input[type="file"]') ||
          activeElement.closest('label[for*="file"]') ||
          activeElement.closest('label[for*="file-input"]')
        )) {
          // This is a file input click - ignore the blur event completely
          return;
        }
        
        // Longer delay to check if focus returns (file dialog can take time)
        setTimeout(() => {
          // Check if focus returned to the window (file dialog closed)
          // Also check if a file input is still focused or was recently interacted with
          const currentActive = document.activeElement;
          const isFileInputActive = currentActive && (
            currentActive.tagName === 'INPUT' && currentActive.type === 'file' ||
            currentActive.closest('input[type="file"]') ||
            currentActive.closest('label[for*="file"]')
          );
          
          if (isFileInputActive || 
              document.activeElement === document.body || 
              document.activeElement === document.documentElement ||
              document.hasFocus()) {
            // Focus returned quickly or file input is active, likely just a file dialog
            return;
          }
          
          // Real blur event - user switched away
          const newCount = tabSwitchCount + 1;
          setTabSwitchCount(newCount);
          logViolation('WINDOW_BLUR', `Window lost focus (Count: ${newCount})`);
          // No auto-submit - just log the violation
        }, 500); // Increased delay to 500ms to allow file dialog to fully open/close
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
  }, [isInitialized, logViolation, tabSwitchCount, onTabSwitchLimitReached]);

  // Auto-start proctoring when attemptId is available
  useEffect(() => {
    if (attemptId && !isInitialized) {
      // Auto-starting proctoring for attempt
      // Add a delay to ensure component is fully mounted and prevent rapid re-initialization
      const timer = setTimeout(() => {
        // Double-check that we're still not initialized (prevent race conditions)
        if (!isInitialized) {
          startProctoring();
        }
      }, 1500); // Slightly increased delay
      
      return () => clearTimeout(timer);
    }
  }, [attemptId, isInitialized, startProctoring]);

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
    error,
    tabSwitchCount
  };
};
