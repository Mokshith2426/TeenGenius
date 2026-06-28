import React, { useState, useEffect, useRef } from 'react';
import { Stage, Layer, Line } from 'react-konva';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, onSnapshot, updateDoc, arrayUnion } from 'firebase/firestore';
import { Eraser, Pencil, Trash2, Download } from 'lucide-react';
import { cn } from '../lib/utils';

interface Stroke {
  tool: string;
  points: number[];
  color: string;
}

interface CollaborativeWhiteboardProps {
  groupId: string;
  userId: string;
}

export default function CollaborativeWhiteboard({ groupId, userId }: CollaborativeWhiteboardProps) {
  const [tool, setTool] = useState('pencil');
  const [lines, setLines] = useState<Stroke[]>([]);
  const isDrawing = useRef(false);
  const stageRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height
        });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!groupId) return;

    if (groupId === 'personal' || userId.includes('sandbox') || userId === 'guest') {
      const stored = localStorage.getItem(`PERSONAL_WHITEBOARD_DATA_${userId}`);
      if (stored) {
        try {
          setLines(JSON.parse(stored));
        } catch (e) {
          console.warn("Failed to parse local whiteboard session data:", e);
        }
      }
      return () => {};
    }

    const groupRef = doc(db, 'studyGroups', groupId);
    const unsubscribe = onSnapshot(groupRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        if (data.whiteboardLines) {
          setLines(data.whiteboardLines);
        }
      }
    }, (err) => handleFirestoreError(err, OperationType.GET, `studyGroups/${groupId}/whiteboard`));

    return () => unsubscribe();
  }, [groupId, userId]);

  const handleMouseDown = (e: any) => {
    isDrawing.current = true;
    const pos = e.target.getStage().getPointerPosition();
    const newLine = { tool, points: [pos.x, pos.y], color: tool === 'eraser' ? '#ffffff' : '#3b82f6' };
    setLines([...lines, newLine]);
  };

  const handleMouseMove = (e: any) => {
    if (!isDrawing.current) return;

    const stage = e.target.getStage();
    const point = stage.getPointerPosition();
    let lastLine = lines[lines.length - 1];
    
    if (lastLine) {
        lastLine.points = lastLine.points.concat([point.x, point.y]);
        lines.splice(lines.length - 1, 1, lastLine);
        setLines(concat => [...lines]);
    }
  };

  const handleMouseUp = async () => {
    isDrawing.current = false;
    // Sync to Firestore or LocalStorage on mouse up to avoid excessive writes
    if (!groupId) return;

    if (groupId === 'personal' || userId.includes('sandbox') || userId === 'guest') {
      localStorage.setItem(`PERSONAL_WHITEBOARD_DATA_${userId}`, JSON.stringify(lines));
      return;
    }

    try {
      await updateDoc(doc(db, 'studyGroups', groupId), {
        whiteboardLines: lines
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `studyGroups/${groupId}`);
    }
  };

  const clearCanvas = async () => {
    setLines([]);
    if (groupId === 'personal' || userId.includes('sandbox') || userId === 'guest') {
      localStorage.setItem(`PERSONAL_WHITEBOARD_DATA_${userId}`, JSON.stringify([]));
      return;
    }

    try {
      await updateDoc(doc(db, 'studyGroups', groupId), {
        whiteboardLines: []
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `studyGroups/${groupId}`);
    }
  };

  const downloadCanvas = () => {
    const uri = stageRef.current.toDataURL();
    const link = document.createElement('a');
    link.download = `whiteboard-${groupId}.png`;
    link.href = uri;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-zinc-950 rounded-[2.5rem] border border-zinc-100 dark:border-zinc-800 overflow-hidden shadow-sm">
      <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTool('pencil')}
            className={cn(
              "p-2 rounded-xl transition-all",
              tool === 'pencil' ? "bg-blue-600 text-white" : "text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900"
            )}
          >
            <Pencil size={18} />
          </button>
          <button
            onClick={() => setTool('eraser')}
            className={cn(
              "p-2 rounded-xl transition-all",
              tool === 'eraser' ? "bg-blue-600 text-white" : "text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900"
            )}
          >
            <Eraser size={18} />
          </button>
          <div className="w-px h-6 bg-zinc-100 dark:bg-zinc-800 mx-2" />
          <button
            onClick={clearCanvas}
            className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-xl transition-all"
          >
            <Trash2 size={18} />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={downloadCanvas}
            className="p-2 text-zinc-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/10 rounded-xl transition-all flex items-center gap-2 font-bold text-[10px] uppercase tracking-widest"
          >
            <Download size={14} /> Export
          </button>
          <div className="px-3 py-1 bg-green-500/10 text-green-500 rounded-full text-[8px] font-black uppercase tracking-widest animate-pulse">
            Live
          </div>
        </div>
      </div>

      <div ref={containerRef} className="flex-1 bg-zinc-55 dark:bg-zinc-900/50 relative min-h-[500px]">
        <Stage
          width={dimensions.width}
          height={dimensions.height}
          onMouseDown={handleMouseDown}
          onMousemove={handleMouseMove}
          onMouseup={handleMouseUp}
          onTouchStart={handleMouseDown}
          onTouchMove={handleMouseMove}
          onTouchEnd={handleMouseUp}
          ref={stageRef}
          className="cursor-crosshair"
        >
          <Layer>
            {lines.map((line, i) => (
              <Line
                key={i}
                points={line.points}
                stroke={line.color}
                strokeWidth={5}
                tension={0.5}
                lineCap="round"
                lineJoin="round"
                globalCompositeOperation={
                  line.tool === 'eraser' ? 'destination-out' : 'source-over'
                }
              />
            ))}
          </Layer>
        </Stage>
      </div>
    </div>
  );
}
