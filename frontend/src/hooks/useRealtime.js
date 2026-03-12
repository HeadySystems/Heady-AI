/**
 * useRealtime — WebSocket hook with φ-scaled reconnect backoff (UI-4)
 * Connects to Heady's WebSocket server with automatic reconnection
 */
import { useState, useEffect, useRef, useCallback } from "react";

const PHI = 1.618033988749895;
const BASE_RECONNECT_MS = 1000;
const MAX_RECONNECT_MS = 30000;

export default function useRealtime(channels = []) {
  const [connected, setConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState(null);
  const [messages, setMessages] = useState([]);
  const wsRef = useRef(null);
  const reconnectAttempt = useRef(0);
  const reconnectTimer = useRef(null);

  const getWsUrl = () => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${window.location.host}/ws`;
  };

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(getWsUrl());
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      reconnectAttempt.current = 0;
      // Subscribe to channels
      channels.forEach((ch) => {
        ws.send(JSON.stringify({ type: "subscribe", channel: ch }));
      });
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        setLastMessage(msg);
        setMessages((prev) => [...prev.slice(-100), msg]); // Keep last 100
      } catch { /* ignore non-JSON */ }
    };

    ws.onclose = () => {
      setConnected(false);
      // φ-scaled exponential backoff
      const delay = Math.min(
        BASE_RECONNECT_MS * Math.pow(PHI, reconnectAttempt.current),
        MAX_RECONNECT_MS
      );
      reconnectAttempt.current++;
      reconnectTimer.current = setTimeout(connect, delay);
    };

    ws.onerror = () => ws.close();
  }, [channels]);

  const send = useCallback((type, data) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, ...data }));
    }
  }, []);

  const switchContext = useCallback((contextId, userId) => {
    send("context:switch", { contextId, userId });
  }, [send]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return { connected, lastMessage, messages, send, switchContext };
}
