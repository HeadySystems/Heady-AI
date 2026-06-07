// HEADY_BRAND:BEGIN
// ╔══════════════════════════════════════════════════════════════════╗
// ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
// ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
// ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
// ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
// ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
// ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
// ║                                                                  ║
// ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
// ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
// ║  FILE: HeadyAI-IDE/src/components/Terminal.jsx                                                    ║
// ║  LAYER: backend/src                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Terminal Component v1.0.0                                ║
// ║  Terminal UI component with cloud backend sync integration        ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder              ║
// ╚══════════════════════════════════════════════════════════════════╝

import React, { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import cloudService from '../services/CloudService';
import 'xterm/css/xterm.css';

export default function Terminal({ onCommand }) {
  const terminalRef = useRef(null);
  const xtermRef = useRef(null);
  const fitAddonRef = useRef(null);
  const [inputBuffer, setInputBuffer] = useState('');

  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new XTerm({
      fontFamily: "'Fira Code', 'Cascadia Code', 'JetBrains Mono', monospace",
      fontSize: 13,
      theme: {
        background: '#0a0d18', // Match bottom panel
        foreground: '#e2e8f0',
        cursor: '#22d3ee',
        cursorAccent: '#0a0d18',
        selection: 'rgba(99, 102, 241, 0.3)',
        black: '#0a0d18',
        red: '#f87171',
        green: '#4ade80',
        yellow: '#facc15',
        blue: '#60a5fa',
        magenta: '#c084fc',
        cyan: '#22d3ee',
        white: '#f8fafc',
        brightBlack: '#475569',
        brightRed: '#fca5a5',
        brightGreen: '#86efac',
        brightYellow: '#fef08a',
        brightBlue: '#93c5fd',
        brightMagenta: '#d8b4fe',
        brightCyan: '#67e8f9',
        brightWhite: '#ffffff',
      },
      cursorBlink: true,
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);

    term.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    term.writeln('HeadyAI-IDE Terminal \x1b[36mv1.0.0\x1b[0m');
    if (cloudService.isConnected) {
      term.writeln('Connected to Heady Cloud Compute via WebSockets.');
    } else {
      term.writeln('Connected to Heady Cloud Compute (Local fallback active).');
    }
    term.write('\r\n\x1b[36mheady@cloud\x1b[0m:~$ ');

    const handleResize = () => {
      fitAddon.fit();
    };
    window.addEventListener('resize', handleResize);

    // Subscribe to cloud output if connected
    const unsubscribeCloud = cloudService.on('output', (data) => {
      term.write(data.data);
      term.write('\x1b[36mheady@cloud\x1b[0m:~$ ');
    });

    // Basic echo and routing logic
    let currentLine = '';

    term.onData(e => {
      if (cloudService.isConnected) {
        switch (e) {
          case '\r': // Enter
            term.write('\r\n');
            if (currentLine.trim()) {
              cloudService.sendTerminalInput(currentLine);
            } else {
              term.write('\x1b[36mheady@cloud\x1b[0m:~$ ');
            }
            currentLine = '';
            break;
          case '\u007F': // Backspace
            if (currentLine.length > 0) {
              term.write('\b \b');
              currentLine = currentLine.slice(0, -1);
            }
            break;
          case '\u0003': // Ctrl+C
            term.write('^C\r\n');
            currentLine = '';
            term.write('\x1b[36mheady@cloud\x1b[0m:~$ ');
            break;
          default:
            if (e >= String.fromCharCode(0x20) && e <= String.fromCharCode(0x7E) || e >= '\u00a0') {
              currentLine += e;
              term.write(e);
            }
        }
      } else {
        switch (e) {
          case '\r': // Enter
            term.write('\r\n');
            if (currentLine.trim()) {
              if (onCommand) {
                onCommand(currentLine.trim(), term);
              } else {
                term.writeln(`\x1b[31mCommand not found: ${currentLine}\x1b[0m`);
              }
            }
            currentLine = '';
            term.write('\x1b[36mheady@cloud\x1b[0m:~$ ');
            break;
          case '\u007F': // Backspace
            if (currentLine.length > 0) {
              term.write('\b \b');
              currentLine = currentLine.slice(0, -1);
            }
            break;
          case '\u0003': // Ctrl+C
            term.write('^C\r\n');
            currentLine = '';
            term.write('\x1b[36mheady@cloud\x1b[0m:~$ ');
            break;
          default:
            if (e >= String.fromCharCode(0x20) && e <= String.fromCharCode(0x7E) || e >= '\u00a0') {
              currentLine += e;
              term.write(e);
            }
        }
      }
    });

    return () => {
      window.removeEventListener('resize', handleResize);
      unsubscribeCloud();
      term.dispose();
    };
  }, [onCommand]);

  // Refresh size when container mounts/changes
  useEffect(() => {
    const timer = setTimeout(() => {
      if (fitAddonRef.current) fitAddonRef.current.fit();
    }, 100);
    return () => clearTimeout(timer);
  });

  return (
    <div 
      ref={terminalRef} 
      style={{ width: '100%', height: '100%', padding: '4px' }} 
      className="xterm-container"
    />
  );
}
