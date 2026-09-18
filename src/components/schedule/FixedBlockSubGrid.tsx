import React from 'react';

export interface FixedBlockState {
  id: string;
  label: string; // e.g. "10A" (for View 3) or "S1" (for View 4)
  isFilled?: boolean;
  occupied?: boolean; // backwards compatibility alias
  color?: string; // color of subject if filled
  teacherColor?: string; // color of teacher for chip border
  tooltip: string;
  subjectName?: string;
  subjectCode?: string;
  teacherName?: string;
  roomName?: string;
  hasException?: boolean;
  ruleId?: string;
  slot?: any;
}

interface FixedBlockSubGridProps {
  count: number;
  getStateFn: (index: number) => FixedBlockState;
  onBlockClick?: (index: number, state: FixedBlockState) => void;
  interactive?: boolean;
}

export const FixedBlockSubGrid: React.FC<FixedBlockSubGridProps> = ({
  count,
  getStateFn,
  onBlockClick,
  interactive = false
}) => {
  const blocks = Array.from({ length: count }, (_, i) => getStateFn(i));

  // Determine grid column layout based on class count
  let colCount = Math.max(1, Math.min(count, 4));
  if (count > 8) {
    colCount = Math.min(count, 6);
  }
  if (count > 16) {
    colCount = Math.min(count, 8);
  }

  const isDense = count > 6;
  const isUltraDense = count > 12;

  return (
    <div
      className={`w-full h-full min-h-[44px] rounded-xl bg-slate-50/60 border border-slate-200/80 grid items-stretch ${
        isUltraDense ? 'p-0.5 gap-1' : isDense ? 'p-1 gap-1' : 'p-1 gap-1.5'
      }`}
      style={{
        gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))`
      }}
    >
      {blocks.map((block, idx) => {
        const filled = Boolean(block.isFilled ?? block.occupied);
        const { color, teacherColor, label, tooltip, hasException, subjectCode } = block;
        const blockColor = color || '#4F46E5';
        const borderColor = teacherColor || blockColor;
        const displayLabel = label || `Kls ${idx + 1}`;

        if (filled) {
          // Solid colored block: Subject is background fill, Teacher is border frame color!
          return (
            <button
              key={block.id || idx}
              type="button"
              title={tooltip}
              disabled={!interactive}
              onClick={() => interactive && onBlockClick && onBlockClick(idx, block)}
              style={{
                backgroundColor: blockColor,
                borderColor: borderColor
              }}
              className={`border-2 rounded-lg flex flex-col items-center justify-center font-mono text-white shadow-xs transition-all overflow-hidden ${
                isUltraDense
                  ? 'min-h-[22px] h-6 p-0.5'
                  : isDense
                  ? 'min-h-[28px] px-1 py-0.5'
                  : 'min-h-[36px] px-1.5 py-1'
              } ${
                interactive
                  ? 'cursor-pointer hover:scale-[1.03] hover:brightness-110 active:scale-95 focus:outline-none focus:ring-2 focus:ring-indigo-400'
                  : 'cursor-default'
              }`}
            >
              {/* If ultra dense (lots of classes), show compact short label or color block only */}
              {isUltraDense ? (
                <span className="truncate leading-none font-bold text-[9px] select-none max-w-full px-0.5">
                  {hasException ? '⚡' : displayLabel.length <= 3 ? displayLabel : ''}
                </span>
              ) : isDense ? (
                <span className="truncate leading-tight font-bold text-[10px] select-none flex items-center justify-center gap-0.5 max-w-full px-0.5">
                  {hasException && <span className="text-[8px] text-amber-300 font-sans">⚡</span>}
                  <span className="truncate">{displayLabel}</span>
                </span>
              ) : (
                <>
                  <span className="truncate leading-tight font-bold text-[11px] select-none flex items-center justify-center gap-0.5 max-w-full">
                    {hasException && <span className="text-[9px] text-amber-300 font-sans">⚡</span>}
                    <span className="truncate">{displayLabel}</span>
                  </span>
                  {subjectCode && (
                    <span className="text-[9px] font-sans font-medium opacity-90 truncate max-w-full leading-none mt-0.5">
                      {subjectCode}
                    </span>
                  )}
                </>
              )}
            </button>
          );
        }

        // Hollow / Outlined block: class-section is free at that slot (never omitted!)
        return (
          <button
            key={block.id || idx}
            type="button"
            title={tooltip}
            disabled={!interactive}
            onClick={() => interactive && onBlockClick && onBlockClick(idx, block)}
            className={`border border-dashed border-slate-300 bg-white/80 rounded-lg flex flex-col items-center justify-center font-mono text-slate-400 transition-colors overflow-hidden ${
              isUltraDense
                ? 'min-h-[22px] h-6 p-0.5'
                : isDense
                ? 'min-h-[28px] px-1 py-0.5'
                : 'min-h-[36px] px-1.5 py-1'
            } ${
              interactive
                ? 'cursor-pointer hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/50 active:scale-95 focus:outline-none focus:ring-1 focus:ring-indigo-300'
                : 'cursor-default'
            }`}
          >
            <span
              className={`truncate leading-tight select-none text-slate-500 max-w-full ${
                isUltraDense ? 'text-[8px]' : 'text-[10px] font-medium'
              }`}
            >
              {displayLabel}
            </span>
            {!isDense && !isUltraDense && (
              <span className="text-[8px] text-slate-300 select-none mt-0.5">Kosong</span>
            )}
          </button>
        );
      })}
    </div>
  );
};
