type MessageHandler = (data: any) => void;

class GameWebSocket {
  private ws: WebSocket | null = null;
  private handlers = new Set<MessageHandler>();
  private campaignId: number | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private manuallyClosed = false;

  connect(campaignId: number) {
    this.campaignId = campaignId;
    this.manuallyClosed = false;
    this.disconnectInternal();

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    try {
      this.ws = new WebSocket(wsUrl);
    } catch (err) {
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN || this.campaignId == null) return;

      this.ws.send(
        JSON.stringify({
          type: "subscribe",
          campaignId: this.campaignId,
        }),
      );
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handlers.forEach((handler) => {
          try {
            handler(data);
          } catch {
            // Individual handler failure should not break the socket.
          }
        });
      } catch {
        // Ignore malformed payloads.
      }
    };

    this.ws.onerror = () => {
      // Let onclose handle reconnect behavior.
      try {
        this.ws?.close();
      } catch {}
    };

    this.ws.onclose = () => {
      this.ws = null;
      if (!this.manuallyClosed) {
        this.scheduleReconnect();
      }
    };
  }

  disconnect() {
    this.manuallyClosed = true;
    this.disconnectInternal();
  }

  private disconnectInternal() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      try {
        this.ws.onopen = null;
        this.ws.onmessage = null;
        this.ws.onerror = null;
        this.ws.onclose = null;
        this.ws.close();
      } catch {}
      this.ws = null;
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer || this.campaignId == null) return;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.manuallyClosed && this.campaignId != null) {
        this.connect(this.campaignId);
      }
    }, 2500);
  }

  subscribe(handler: MessageHandler) {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  isConnected() {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

export const gameWs = new GameWebSocket();
