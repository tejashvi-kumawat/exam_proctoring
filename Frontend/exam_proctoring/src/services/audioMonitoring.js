// frontend/src/services/audioMonitoring.js
class AudioMonitoringService {
  constructor() {
    this.audioContext = null;
    this.analyser = null;
    this.microphone = null;
    this.isMonitoring = false;
    this.animationFrame = null;
  }

  async startMonitoring(onAudioLevel) {
    if (this.isMonitoring) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      this.audioContext = new AudioContext();
      this.analyser = this.audioContext.createAnalyser();
      this.microphone = this.audioContext.createMediaStreamSource(stream);
      
      this.analyser.fftSize = 256;
      this.microphone.connect(this.analyser);
      
      this.isMonitoring = true;
      this.monitorAudioLevel(onAudioLevel);
      
      return true;
    } catch (error) {
      console.error('Error starting audio monitoring:', error);
      return false;
    }
  }

  monitorAudioLevel(onAudioLevel) {
    if (!this.isMonitoring || !this.analyser) return;

    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    const checkLevel = () => {
      if (!this.isMonitoring) return;
      
      this.analyser.getByteFrequencyData(dataArray);
      
      const average = dataArray.reduce((sum, value) => sum + value, 0) / bufferLength;
      const normalizedLevel = average / 255;
      
      if (onAudioLevel) {
        onAudioLevel(normalizedLevel);
      }
      
      this.animationFrame = requestAnimationFrame(checkLevel);
    };
    
    checkLevel();
  }

  stopMonitoring() {
    this.isMonitoring = false;
    
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    this.analyser = null;
    this.microphone = null;
  }
}

export default new AudioMonitoringService();
