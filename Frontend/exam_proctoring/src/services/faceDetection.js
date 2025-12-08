// frontend/src/services/faceDetection.js
class FaceDetectionService {
  constructor() {
    this.isDetecting = false;
    this.detectionInterval = null;
    this.faceDetector = null;
    this.initializeFaceDetection();
  }

  async initializeFaceDetection() {
    // Check if browser supports face detection API
    if ('FaceDetector' in window) {
      try {
        this.faceDetector = new FaceDetector();
      } catch (error) {
        // Face Detection API not supported, using fallback
      }
    }
  }

  async startDetection(videoElement, onDetection) {
    if (this.isDetecting) return;

    this.isDetecting = true;
    
    this.detectionInterval = setInterval(() => {
      this.detectFaces(videoElement, onDetection);
    }, 1000); // Check every second
  }

  async detectFaces(videoElement, onDetection) {
    if (!videoElement || videoElement.videoWidth === 0 || videoElement.videoHeight === 0) {
      if (onDetection) {
        onDetection({
          faces: 0,
          confidence: 0,
          imageData: null,
          error: 'Video not ready'
        });
      }
      return;
    }

    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      canvas.width = videoElement.videoWidth;
      canvas.height = videoElement.videoHeight;
      
      ctx.drawImage(videoElement, 0, 0);
      
      // Get image data for analysis
      const imageData = canvas.toDataURL('image/jpeg', 0.8);
      
      let faceCount = 0;
      let confidence = 0;

      // Try native face detection first
      if (this.faceDetector) {
        try {
          const faces = await this.faceDetector.detect(canvas);
          faceCount = faces.length;
          confidence = faceCount > 0 ? 0.9 : 0;
        } catch (error) {
          // Native detection failed, using fallback
          const result = this.fallbackFaceDetection(ctx, canvas);
          faceCount = result.faces;
          confidence = result.confidence;
        }
      } else {
        // Use fallback detection
        const result = this.fallbackFaceDetection(ctx, canvas);
        faceCount = result.faces;
        confidence = result.confidence;
      }

      if (onDetection) {
        onDetection({
          faces: faceCount,
          confidence: confidence,
          imageData: imageData
        });
      }

    } catch (error) {
      if (onDetection) {
        onDetection({
          faces: 0,
          confidence: 0,
          imageData: null,
          error: error.message
        });
      }
    }
  }

  fallbackFaceDetection(ctx, canvas) {
    try {
      // Simple heuristic-based face detection
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      // Check for skin tone pixels and face-like patterns
      let skinPixels = 0;
      let totalPixels = data.length / 4;
      let brightPixels = 0;
      
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        // Check for skin tone (simplified)
        if (this.isSkinTone(r, g, b)) {
          skinPixels++;
        }
        
        // Check for brightness (face should have some illumination)
        const brightness = (r + g + b) / 3;
        if (brightness > 50) {
          brightPixels++;
        }
      }
      
      const skinRatio = skinPixels / totalPixels;
      const brightRatio = brightPixels / totalPixels;
      
      // Heuristic: if we have enough skin-tone pixels and brightness, assume face present
      const hasValidVideo = brightRatio > 0.1; // At least 10% of pixels are not black
      const hasSkinTone = skinRatio > 0.05; // At least 5% skin-tone pixels
      const hasMovement = this.detectMovement(data);
      
      if (hasValidVideo && (hasSkinTone || hasMovement)) {
        return { faces: 1, confidence: 0.7 };
      } else if (hasValidVideo) {
        return { faces: 0, confidence: 0.3 };
      } else {
        return { faces: 0, confidence: 0 };
      }
      
    } catch (error) {
      return { faces: 0, confidence: 0 };
    }
  }

  isSkinTone(r, g, b) {
    // Simplified skin tone detection
    return (
      r > 95 && g > 40 && b > 20 &&
      r > g && r > b &&
      Math.abs(r - g) > 15 &&
      Math.max(r, g, b) - Math.min(r, g, b) > 15
    );
  }

  detectMovement(currentData) {
    // Simple movement detection by comparing with previous frame
    if (!this.previousFrameData) {
      this.previousFrameData = currentData.slice();
      return true; // Assume movement on first frame
    }
    
    let differences = 0;
    const threshold = 30;
    const sampleRate = 100; // Check every 100th pixel for performance
    
    for (let i = 0; i < currentData.length; i += sampleRate * 4) {
      const currentBrightness = (currentData[i] + currentData[i + 1] + currentData[i + 2]) / 3;
      const previousBrightness = (this.previousFrameData[i] + this.previousFrameData[i + 1] + this.previousFrameData[i + 2]) / 3;
      
      if (Math.abs(currentBrightness - previousBrightness) > threshold) {
        differences++;
      }
    }
    
    this.previousFrameData = currentData.slice();
    
    // If more than 1% of sampled pixels changed significantly, assume movement
    return (differences / (currentData.length / (sampleRate * 4))) > 0.01;
  }

  stopDetection() {
    this.isDetecting = false;
    if (this.detectionInterval) {
      clearInterval(this.detectionInterval);
      this.detectionInterval = null;
    }
    this.previousFrameData = null;
  }
}

export default new FaceDetectionService();
