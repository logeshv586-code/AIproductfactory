'use client';

import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';

type LogStep = {
  index: number;
  message: string;
  timestamp: string;
  status: 'info' | 'success' | 'error' | 'repairing';
};

export default function StudioLogStream() {
  const [logs, setLogs] = useState<LogStep[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Initializing connection...');
  
  // Track the last successfully received step index to resume seamlessly on disconnect
  const lastIndexRef = useRef<number>(-1);
  const socketRef = useRef<Socket | null>(null);
  const heartbeatTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // 1. Establish Socket.io connection utilizing XTransformPort matching workspace specs
    const socketInstance = io('/?XTransformPort=3003', {
      transports: ['websocket', 'polling'],
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: 10,       // Max retries extended for long-running repair passes
      reconnectionDelay: 1000,        // Bounded exponential backoff configuration
      reconnectionDelayMax: 5000,
      timeout: 15000
    });

    socketRef.current = socketInstance;

    // 2. Setup Heartbeat Protocol Monitor Loop (15-second Ping/Pong Keepalive)
    const startHeartbeatCheck = () => {
      if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
      
      heartbeatTimerRef.current = setInterval(() => {
        if (socketInstance.connected) {
          // Emit a lightweight ping to prevent proxy/server idle timeouts (60s+)
          socketInstance.emit('ping_heartbeat');
        }
      }, 15000); // 15-second keepalive interval
    };

    socketInstance.on('connect', () => {
      setIsConnected(true);
      setStatusMessage('Executing repair pass...');
      startHeartbeatCheck();

      // Catch up / resume log streaming seamlessly from the last known good step index
      if (lastIndexRef.current !== -1) {
        socketInstance.emit('resume_stream', { last_index: lastIndexRef.current });
      }
    });

    socketInstance.on('disconnect', (reason) => {
      setIsConnected(false);
      if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
      
      // Distinguish explicit closures from silent or unexpected proxy drops
      if (reason === 'io server disconnect' || reason === 'io client disconnect') {
        setStatusMessage('Connection closed intentionally.');
      } else {
        setStatusMessage('Connection lost silently. Attempting to reconnect and resume logs...');
      }
    });

    // 3. Process Stream Logs and Track Step Progress
    socketInstance.on('log_step', (data: LogStep) => {
      setLogs((prev) => {
        // Prevent duplicate logs if connection re-established on same index boundary
        if (prev.some((item) => item.index === data.index)) return prev;
        return [...prev, data];
      });
      
      // Cache the last index boundary point safely in reference memory
      if (data.index > lastIndexRef.current) {
        lastIndexRef.current = data.index;
      }

      if (data.status === 'repairing') {
        setStatusMessage(`Executing repair pass: ${data.message}`);
      }
    });

    // Final clean-up sequence on component tree unmount
    return () => {
      if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
      socketInstance.disconnect();
    };
  }, []);

  return (
    <div className="container mx-auto p-4 max-w-2xl">
      <Card className="border-slate-800 bg-slate-950 text-slate-100 shadow-xl">
        <CardHeader className="border-b border-slate-800 pb-4">
          <CardTitle className="flex items-center justify-between text-lg font-semibold tracking-tight">
            <span>Engineering Agent Output</span>
            <span className={`text-xs font-mono font-medium px-2.5 py-1 rounded-full uppercase transition-all duration-300 ${
              isConnected 
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                : 'bg-rose-500/10 text-rose-400 border border-rose-500/20 animate-pulse'
            }`}>
              {isConnected ? 'Active Stream' : 'Disconnected'}
            </span>
          </CardTitle>
          <p className="text-xs text-slate-400 font-mono mt-1.5">{statusMessage}</p>
        </CardHeader>
        <CardContent className="pt-4">
          <ScrollArea className="h-96 w-full rounded-lg border border-slate-800 bg-slate-900/50 p-4 font-mono text-xs leading-relaxed">
            <div className="space-y-2.5">
              {logs.length === 0 ? (
                <p className="text-slate-500 text-center italic pt-4">Awaiting backend compilation execution steps...</p>
              ) : (
                logs.map((log) => (
                  <div key={log.index} className="flex items-start space-x-2 border-b border-slate-900 pb-2 last:border-0 last:pb-0">
                    <span className="text-slate-600 select-none">[{log.index}]</span>
                    <div className="flex-1">
                      <p className={`font-semibold ${
                        log.status === 'error' ? 'text-rose-400' :
                        log.status === 'success' ? 'text-emerald-400' :
                        log.status === 'repairing' ? 'text-amber-400' : 'text-sky-400'
                      }`}>
                        {log.message}
                      </p>
                    </div>
                    <span className="text-[10px] text-slate-500 select-none">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
