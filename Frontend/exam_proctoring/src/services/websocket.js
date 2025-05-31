// frontend/src/services/websocket.js
class WebSocketService {
  constructor() {
    this.socket = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectInterval = 3000;
  }

  connect(attemptId, callbacks = {}) {
    const wsUrl = `ws://localhost:8000/ws/proctoring/${attemptId}/`;
    
    this.socket = new WebSocket(wsUrl);

    this.socket.onopen = () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
      if (callbacks.onOpen) callbacks.onOpen();
    };

    this.socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (callbacks.onMessage) callbacks.onMessage(data);
    };

    this.socket.onclose = () => {
      console.log('WebSocket disconnected');
      if (callbacks.onClose) callbacks.onClose();
      this.handleReconnect(attemptId, callbacks);
    };

    this.socket.onerror = (error) => {
      console.error('WebSocket error:', error);
      if (callbacks.onError) callbacks.onError(error);
    };
  }

  handleReconnect(attemptId, callbacks) {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      setTimeout(() => {
        console.log(`Reconnecting... Attempt ${this.reconnectAttempts}`);
        this.connect(attemptId, callbacks);
      }, this.reconnectInterval);
    }
  }

  send(data) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(data));
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }
}

export default new WebSocketService();
