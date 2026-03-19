// HEADY_BRAND:BEGIN
// HEADY SYSTEMS :: SACRED GEOMETRY
// FILE: frontend/src/components/Terminal.js
// LAYER: ui/frontend
// 
//         _   _  _____    _    ____   __   __
//        | | | || ____|  / \  |  _ \ \ \ / /
//        | |_| ||  _|   / _ \ | | | | \ V / 
//        |  _  || |___ / ___ \| |_| |  | |  
//        |_| |_||_____/_/   \_\____/   |_|  
// 
//    Sacred Geometry :: Organic Systems :: Breathing Interfaces
// HEADY_BRAND:END

import React, { useEffect, useRef } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import { getToken } from '../utils/auth';

const TerminalComponent = () => {
  const termRef = useRef(null);
  const xtermRef = useRef(null);

  useEffect(() => {
    const term = new Terminal({
        theme: { background: '#1e1e1e' },
        fontSize: 12,
        fontFamily: 'Consolas, "Courier New", monospace',
        convertEol: true,
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    term.open(termRef.current);
    fitAddon.fit();

    xtermRef.current = term;

    term.writeln('Welcome to Heady Admin Console');
    term.writeln('Initializing log stream...');

    const token = getToken();

    // Determine WebSocket URL
    let wsHost = window.location.host;
    if (window.location.port === '3000') {
         wsHost = import.meta.env.VITE_WS_HOST || 'localhost:8000'; // Development fallback
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${wsHost}/api/logs?token=${token}`;

    let ws;
    try {
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
            term.writeln('\x1b[32mConnected to log stream.\x1b[0m');
        };

        ws.onmessage = (event) => {
            term.writeln(event.data);
        };

        ws.onerror = (e) => {
            term.writeln('\x1b[31mWebSocket connection failed.\x1b[0m');
        };

        ws.onclose = () => {
            term.writeln('WebSocket disconnected.');
        };
    } catch (e) {
        term.writeln(`Error: ${e.message}`);
    }

    const handleResize = () => fitAddon.fit();
    window.addEventListener('resize', handleResize);

    // Fit again after a short delay to ensure container is rendered
    setTimeout(() => fitAddon.fit(), 100);

    return () => {
        if (ws) ws.close();
        term.dispose();
        window.removeEventListener('resize', handleResize);
    };
  }, []);

  return <div ref={termRef} style={{ height: '100%', width: '100%', padding: '5px' }} />;
};

export default TerminalComponent;
