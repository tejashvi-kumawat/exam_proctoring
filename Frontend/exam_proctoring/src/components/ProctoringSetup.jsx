// frontend/src/components/ProctoringSetup.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useExam } from '../hooks/useExam';
import faceDetectionService from '../services/faceDetection';
import Icon from './Icon';
import './ProctoringSetup.css';

const ProctoringSetup = () => {
  const { examId } = useParams();
  const navigate = useNavigate();
  const { fetchExamById } = useExam();
  const [exam, setExam] = useState(null);
  const [permissionsGranted, setPermissionsGranted] = useState(false);
  const [cameraTest, setCameraTest] = useState(false);
  const [microphoneTest, setMicrophoneTest] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [faceDetected, setFaceDetected] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [debugInfo, setDebugInfo] = useState('');
  const [faceDetectionStatus, setFaceDetectionStatus] = useState('Initializing...');
  
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const audioContextRef = useRef(null);

  useEffect(() => {
    loadExam();
    return () => {
      cleanup();
    };
  }, [examId]);

  const loadExam = async () => {
    try {
      const examData = await fetchExamById(examId);
      setExam(examData);
    } catch (error) {
      setError('Failed to load exam details');
    }
  };

  const cleanup = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
    }
    faceDetectionService.stopDetection();
  };

  const checkPermissions = async () => {
    try {
      setError('');
      setDebugInfo('Requesting camera and microphone permissions...');
      
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
      
      setDebugInfo('Permissions granted, setting up video...');
      setPermissionsGranted(true);
      setCameraTest(true);
      setMicrophoneTest(true);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        videoRef.current.onloadedmetadata = () => {
          setDebugInfo('Video loaded, starting face detection...');
          startFaceDetection();
          startAudioMonitoring(stream);
        };

        videoRef.current.onerror = (error) => {
          console.error('Video error:', error);
          setError('Failed to load video stream');
        };
      }
      
    } catch (error) {
      console.error('Permission error:', error);
      setPermissionsGranted(false);
      setError(`Camera and microphone permissions are required: ${error.message}`);
      setDebugInfo(`Permission error: ${error.name} - ${error.message}`);
    }
  };

  const startFaceDetection = () => {
    if (!videoRef.current) return;

    setFaceDetectionStatus('Starting face detection...');
    
    faceDetectionService.startDetection(videoRef.current, (result) => {
      if (result.error) {
        setFaceDetectionStatus(`Error: ${result.error}`);
        setFaceDetected(false);
      } else {
        const detected = result.faces > 0;
        setFaceDetected(detected);
        
        if (detected) {
          setFaceDetectionStatus(`Face detected (confidence: ${(result.confidence * 100).toFixed(0)}%)`);
        } else {
          setFaceDetectionStatus('No face detected - Please position your face in the camera');
        }
      }
    });
  };

  const startAudioMonitoring = (stream) => {
    try {
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
        requestAnimationFrame(monitorAudio);
      };
      
      monitorAudio();
    } catch (error) {
      console.error('Audio monitoring error:', error);
    }
  };

  const startExam = async () => {
    if (!faceDetected) {
      setError('Please ensure your face is clearly visible before starting the exam');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      // Store permission status for the exam interface
      localStorage.setItem('proctoringPermissionsGranted', 'true');
      localStorage.setItem('proctoringSetupCompleted', 'true');
      
      // Navigate to exam interface
      navigate(`/exam/${examId}/interface`);
    } catch (error) {
      console.error('Error starting exam:', error);
      setError('Failed to start exam. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!exam) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading exam details...</p>
      </div>
    );
  }

  return (
    <div className="proctoring-setup">
      <div className="setup-container">
        <div className="setup-header">
          <h1>Exam Proctoring Setup</h1>
          <div className="exam-info">
            <h2>{exam.title}</h2>
            <p>{exam.description}</p>
            <div className="exam-details">
              <span>Duration: {exam.duration_minutes} minutes</span>
              <span>Total Marks: {exam.total_marks}</span>
              <span>Questions: {exam.questions?.length || 0}</span>
            </div>
          </div>
        </div>

        {error && <div className="error-message">{error}</div>}
        
        {debugInfo && (
          <div className="debug-info">
            <small>Debug: {debugInfo}</small>
          </div>
        )}
        
        <div className="setup-steps">
          {/* Camera Test */}
          <div className={`setup-step ${cameraTest ? 'completed' : ''}`}>
            <div className="step-header">
              <h3>
                <Icon name="Video" size={20} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                Camera Test
              </h3>
              <div className="step-status">
                {cameraTest ? (
                  <>
                    <Icon name="CheckCircle" size={16} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                    Ready
                  </>
                ) : (
                  <>
                    <Icon name="XCircle" size={16} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                    Not Ready
                  </>
                )}
              </div>
            </div>
            
            <div className="camera-preview">
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="preview-video"
              />
              <div className="face-detection-indicator">
                <div className={`detection-status ${faceDetected ? 'detected' : 'not-detected'}`}>
                  {faceDetectionStatus}
                </div>
                <div className="detection-tips">
                  <h4>Tips for better face detection:</h4>
                  <ul>
                    <li>Ensure good lighting on your face</li>
                    <li>Position your face in the center of the camera</li>
                    <li>Remove any face coverings or sunglasses</li>
                    <li>Maintain a distance of 2-3 feet from the camera</li>
                    <li>Avoid backlighting (light source behind you)</li>
                  </ul>
                </div>
              </div>
            </div>
            
            {!cameraTest && (
              <p className="step-error">Camera access required for proctoring</p>
            )}
          </div>

          {/* Microphone Test */}
          <div className={`setup-step ${microphoneTest ? 'completed' : ''}`}>
            <div className="step-header">
              <h3>
                <Icon name="Mic" size={20} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                Microphone Test
              </h3>
              <div className="step-status">
                {microphoneTest ? (
                  <>
                    <Icon name="CheckCircle" size={16} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                    Ready
                  </>
                ) : (
                  <>
                    <Icon name="XCircle" size={16} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                    Not Ready
                  </>
                )}
              </div>
            </div>
            
            <div className="audio-test">
              <div className="audio-level-container">
                <div className="audio-level-bar">
                  <div 
                    className="audio-level-fill"
                    style={{ width: `${audioLevel * 100}%` }}
                  />
                </div>
                <span className="audio-level-text">
                  Audio Level: {Math.round(audioLevel * 100)}%
                </span>
              </div>
              <p className="audio-instruction">
                Speak normally to test your microphone
              </p>
            </div>
            
            {!microphoneTest && (
              <p className="step-error">Microphone access required for proctoring</p>
            )}
          </div>

          {/* Instructions */}
          <div className="setup-step instructions-step">
            <h3>
              <Icon name="FileText" size={20} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
              Proctoring Instructions
            </h3>
            <div className="instructions-content">
              <div className="instructions-grid">
                <div className="instruction-item">
                  <span className="instruction-icon">
                    <Icon name="User" size={24} />
                  </span>
                  <p>Keep your face visible to the camera at all times</p>
                </div>
                <div className="instruction-item">
                  <span className="instruction-icon">
                    <Icon name="Ban" size={24} />
                  </span>
                  <p>Do not switch tabs or minimize the browser window</p>
                </div>
                <div className="instruction-item">
                  <span className="instruction-icon">
                    <Icon name="Smartphone" size={24} />
                  </span>
                  <p>Do not use any external devices or materials</p>
                </div>
                <div className="instruction-item">
                  <span className="instruction-icon">
                    <Icon name="VolumeX" size={24} />
                  </span>
                  <p>Maintain a quiet environment</p>
                </div>
                <div className="instruction-item">
                  <span className="instruction-icon">
                    <Icon name="Keyboard" size={24} />
                  </span>
                  <p>Do not copy, paste, or right-click during the exam</p>
                </div>
                <div className="instruction-item">
                  <span className="instruction-icon">
                    <Icon name="AlertTriangle" size={24} />
                  </span>
                  <p>Any violations will be logged and may result in exam termination</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="setup-actions">
          {!permissionsGranted ? (
            <button 
              onClick={checkPermissions}
              className="btn btn-primary"
            >
              Grant Permissions
            </button>
          ) : (
            <div className="action-buttons">
              <button 
                onClick={() => navigate('/dashboard')}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button 
                onClick={startExam}
                disabled={!cameraTest || !microphoneTest || !faceDetected || loading}
                className="btn btn-success"
              >
                {loading ? 'Starting Exam...' : 'Start Exam'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProctoringSetup;
