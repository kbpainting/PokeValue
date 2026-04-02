'use client';

import type { GradingCompany } from '@/types';

const SLAB_STYLES: Record<GradingCompany, { bg: string; border: string; label: string; labelBg: string; accent: string }> = {
  PSA: {
    bg: 'bg-gradient-to-b from-red-950/40 to-gray-900',
    border: 'border-red-600',
    label: 'PSA',
    labelBg: 'bg-red-600',
    accent: 'text-red-400',
  },
  CGC: {
    bg: 'bg-gradient-to-b from-green-950/40 to-gray-900',
    border: 'border-green-600',
    label: 'CGC',
    labelBg: 'bg-green-600',
    accent: 'text-green-400',
  },
  BGS: {
    bg: 'bg-gradient-to-b from-gray-800 to-gray-950',
    border: 'border-gray-400',
    label: 'BGS',
    labelBg: 'bg-gray-600',
    accent: 'text-gray-300',
  },
  TAG: {
    bg: 'bg-gradient-to-b from-purple-950/40 to-gray-900',
    border: 'border-purple-600',
    label: 'TAG',
    labelBg: 'bg-purple-600',
    accent: 'text-purple-400',
  },
  RAW: {
    bg: 'bg-gray-800',
    border: 'border-gray-600',
    label: 'RAW',
    labelBg: 'bg-gray-600',
    accent: 'text-gray-400',
  },
};

interface SlabFrameProps {
  company: GradingCompany;
  grade: string | null;
  cardName: string;
  cardNumber: string;
  setName: string;
  imageUrl: string | null;
  className?: string;
}

export function SlabFrame({ company, grade, cardName, cardNumber, setName, imageUrl, className = '' }: SlabFrameProps) {
  const style = SLAB_STYLES[company];

  if (company === 'RAW') {
    // Raw cards just show the card image without a slab
    return (
      <div className={`relative rounded-xl overflow-hidden ${className}`}>
        <div className="aspect-[2/3] bg-gray-800">
          {imageUrl ? (
            <img src={imageUrl} alt={cardName} loading="lazy" decoding="async" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-600">No Image</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`relative rounded-xl overflow-hidden border-2 ${style.border} ${style.bg} ${className}`}>
      {/* Top label bar */}
      <div className={`${style.labelBg} px-2 py-1.5 flex items-center justify-between`}>
        <span className="text-white text-xs font-bold tracking-wider">{style.label}</span>
        {grade && (
          <span className="text-white text-xs font-bold bg-white/20 px-2 py-0.5 rounded">
            {grade}
          </span>
        )}
      </div>

      {/* Card image area */}
      <div className="p-2">
        <div className="aspect-[2/3] bg-gray-800 rounded overflow-hidden">
          {imageUrl ? (
            <img src={imageUrl} alt={cardName} loading="lazy" decoding="async" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-600 text-xs">No Image</div>
          )}
        </div>
      </div>

      {/* Bottom info bar */}
      <div className="px-2 pb-2">
        <div className="bg-black/30 rounded px-2 py-1">
          <p className="text-white text-[9px] font-medium truncate">{cardName}</p>
          <p className="text-gray-400 text-[8px] truncate">{setName} #{cardNumber}</p>
        </div>
      </div>
    </div>
  );
}
