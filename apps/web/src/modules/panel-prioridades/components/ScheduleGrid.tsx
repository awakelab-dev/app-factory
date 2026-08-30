import React, { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { X } from 'lucide-react';
import type { ScheduleWeek } from '../panel-prioridades.types';

interface ScheduleGridProps {
  schedule?: ScheduleWeek | null;
  onReleaseBlock: (day: number, hour: number) => Promise<void>;
}

const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
const HOURS = Array.from({ length: 10 }, (_, i) => 8 + i);

export function ScheduleGrid({ schedule, onReleaseBlock }: ScheduleGridProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-awk-blue-700">
      <table className="w-full text-left text-sm border-collapse">
        <thead>
          <tr className="bg-awk-navy-800 border-b border-awk-blue-700">
            <th className="px-4 py-3 font-medium text-awk-blue-100 w-16">Hora</th>
            {DAYS.map(day => (
              <th key={day} className="px-4 py-3 font-medium text-awk-blue-100">
                {day}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {HOURS.map(hour => (
            <tr key={hour} className="border-b border-awk-blue-700 hover:bg-awk-blue-800/10">
              <td className="px-4 py-3 font-medium text-awk-blue-200 text-xs">{hour}:00</td>
              {Array.from({ length: 5 }).map((_, dayIdx) => (
                <td key={dayIdx} className="px-4 py-3 border-l border-awk-blue-700">
                  <ScheduleCell
                    schedule={schedule}
                    day={dayIdx}
                    hour={hour}
                    onRelease={() => onReleaseBlock(dayIdx, hour)}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface ScheduleCellProps {
  schedule?: ScheduleWeek | null;
  day: number;
  hour: number;
  onRelease: () => Promise<void>;
}

function ScheduleCell({ schedule, day, hour, onRelease }: ScheduleCellProps) {
  const dayData = schedule?.find(d => d.day === day);
  const block = dayData?.blocks.find(b => b.hour === hour);
  const [releasing, setReleasing] = useState(false);

  if (!block?.taskId) {
    return <DropZone day={day} hour={hour} />;
  }

  const handleRelease = async () => {
    setReleasing(true);
    try {
      await onRelease();
    } finally {
      setReleasing(false);
    }
  };

  return (
    <div className="relative group p-2 rounded-lg bg-awk-cyan-900/30 border border-awk-cyan-500/50 min-h-12">
      <p className="text-xs font-medium text-awk-cyan-100 line-clamp-2">{block.taskTitle}</p>
      <button
        onClick={handleRelease}
        disabled={releasing}
        className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
        title="Liberar bloque"
      >
        <X className="h-3 w-3 text-red-400" />
      </button>
    </div>
  );
}

function DropZone({ day, hour }: { day: number; hour: number }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `${day}-${hour}`
  });

  return (
    <div
      ref={setNodeRef}
      className={`h-12 rounded-lg border-2 transition-colors ${
        isOver ? 'border-awk-cyan-400 bg-awk-cyan-400/10' : 'border-transparent'
      }`}
    />
  );
}
