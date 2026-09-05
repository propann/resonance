import React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

/**
 * The folder tree the tool panels are drawn with.
 *
 * The workshop column reads like the library tree facing it — folders that
 * open onto what they hold — and every panel that offers a set of tools should
 * read the same way, so that knowing one means knowing the others. These rows
 * live here rather than inside one panel so a second panel cannot drift into
 * looking almost, but not quite, like the first.
 */

/** A folder row, drawn like the library tree's. */
export const FolderRow: React.FC<{
  label: string;
  color: string;
  open: boolean;
  count?: number;
  onToggle: () => void;
  children?: React.ReactNode;
}> = ({ label, color, open, count, onToggle, children }) => (
  <div
    className={`group flex items-center justify-between border px-2 py-1.5 transition pixel-btn ${
      open
        ? 'border-[#FFE600] bg-[#1A1A26] font-bold text-white'
        : 'border-[#1E1E28] bg-[#101016] text-[#EDEDEE] hover:border-[#333344]'
    }`}
  >
    <button onClick={onToggle} className="flex min-w-0 flex-1 items-center gap-1.5 text-left">
      {open ? (
        <ChevronDown className="h-3 w-3 shrink-0 text-[#FFE600]" />
      ) : (
        <ChevronRight className="h-3 w-3 shrink-0 text-[#8E8E93]" />
      )}
      <span style={{ color }} className="text-xs">
        📁
      </span>
      <span className="truncate font-pixel text-[9px] tracking-tight">{label}</span>
    </button>
    <div className="flex shrink-0 items-center gap-1.5">
      {children}
      {count !== undefined && (
        <span
          className="border px-1.5 py-0.2 font-pixel text-[9px]"
          style={{ color, borderColor: `${color}44`, backgroundColor: `${color}15` }}
        >
          {count}
        </span>
      )}
    </div>
  </div>
);

/** A leaf inside a folder: one tool you can add. */
export const LeafRow: React.FC<{ label: string; title?: string; onClick: () => void }> = ({
  label,
  title,
  onClick,
}) => (
  <button
    onClick={onClick}
    title={title}
    className="flex w-full items-center gap-1.5 border border-[#14141E] bg-[#0A0A0F] px-2 py-0.5 text-left text-[#A5A5B5] transition hover:border-[#222230] hover:text-[#00F0FF] pixel-btn"
  >
    <span className="text-[9px] text-[#8E8E93]">•</span>
    <span className="truncate text-[10px]">{label}</span>
  </button>
);

/** The heading above a group of leaves inside a folder. */
export const GroupLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="px-1 py-0.5 font-mono text-[8px] font-bold uppercase tracking-widest text-[#55556A]">
    {children}
  </div>
);
