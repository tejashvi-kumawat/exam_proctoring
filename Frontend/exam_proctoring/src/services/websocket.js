// frontend/src/services/websocket.js
class WebSocketService {
  constructor() {
    this.socket = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 3; // Reduced attempts
    this.reconnectInterval = 5000; // Increased interval to 5 seconds
    this.isConnecting = false;
    this.isManuallyDisconnected = false;
    this.reconnectTimeout = null;
  }

  connect(attemptId, callbacks = {}) {
    // Prevent multiple simultaneous connection attempts
    if (this.isConnecting) {
      return;
    }

    // Don't reconnect if manually disconnected
    if (this.isManuallyDisconnected) {
      return;
    }

    // Close existing socket if any
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }

    // Get auth token from localStorage
    const token = localStorage.getItem('token');
    
    // Use environment variable or fallback to PythonAnywhere (note: WebSockets require paid plan)
    const WS_BASE_URL = import.meta.env.VITE_WS_URL || 'wss://exam0proctoring.pythonanywhere.com';
    
    const wsUrl = token 
      ? `${WS_BASE_URL}/ws/proctoring/${attemptId}/?token=${token}`
      : `${WS_BASE_URL}/ws/proctoring/${attemptId}/`;
    
    this.isConnecting = true;
    
    try {
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        if (callbacks.onOpen) callbacks.onOpen();
      };

      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (callbacks.onMessage) callbacks.onMessage(data);
        } catch (error) {
          console.error('WebSocket message parse error:', error);
        }
      };

      this.socket.onclose = (event) => {
        this.isConnecting = false;
        if (callbacks.onClose) callbacks.onClose();
        
        // Only reconnect if not manually disconnected and not a normal closure
        if (!this.isManuallyDisconnected && event.code !== 1000) {
          this.handleReconnect(attemptId, callbacks);
        }
      };

      this.socket.onerror = (error) => {
        this.isConnecting = false;
        // Silently handle WebSocket errors - don't spam console
        if (callbacks.onError) callbacks.onError(error);
      };
    } catch (error) {
      this.isConnecting = false;
      console.error('WebSocket connection error:', error);
      if (callbacks.onError) callbacks.onError(error);
    }
  }

  handleReconnect(attemptId, callbacks) {
    // Clear any existing reconnect timeout
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    if (this.reconnectAttempts < this.maxReconnectAttempts && !this.isManuallyDisconnected) {
      this.reconnectAttempts++;
      this.reconnectTimeout = setTimeout(() => {
        if (!this.isManuallyDisconnected) {
          this.connect(attemptId, callbacks);
        }
      }, this.reconnectInterval);
    }
  }

  send(data) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      try {
        this.socket.send(JSON.stringify(data));
      } catch (error) {
        console.error('WebSocket send error:', error);
      }
    }
  }

  disconnect() {
    this.isManuallyDisconnected = true;
    
    // Clear reconnect timeout
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    if (this.socket) {
      this.socket.close(1000, 'Manual disconnect');
      this.socket = null;
    }
    
    // Reset state after a delay to allow for cleanup
    setTimeout(() => {
      this.reconnectAttempts = 0;
      this.isManuallyDisconnected = false;
    }, 1000);
  }
}

export default new WebSocketService();
