const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";

type MessageHandler = (data: any) => void;

class GameWebSocket {
  private ws: WebSocket | null = null;
  private handlers: Set<MessageHandler> = new Set();
  private campaignId: number | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  connect(campaignId: number) {
    this.campaignId = campaignId;
    this.disconnect();

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    let wsUrl: string;

    if (API_BASE) {
      // Deployed - use proxy path
      const base = window.location.origin + window.location.pathname.replace(/\/[^/]*$/, "");
      wsUrl = `${protocol}//${window.location.host}${base}/${API_BASE}/ws`;
    } else {
      // Local dev
      wsUrl = `${protocol}//${window.location.hostname}:5000/ws`;
    }

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      this.ws?.send(JSON.stringify({ type: "subscribe", campaignId }));
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handlers.forEach((handler) => handler(data));
      } catch { /* ignore */ }
    };

    this.ws.onclose = () => {
      // Reconnect after 3 seconds
      this.reconnectTimer = setTimeout(() => {
        if (this.campaignId) this.connect(this.campaignId);
      }, 3000);
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  subscribe(handler: MessageHandler) {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }
}

export const gameWs = new GameWebSocket();
