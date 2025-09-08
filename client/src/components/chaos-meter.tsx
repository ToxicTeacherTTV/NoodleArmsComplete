import React from 'react';

interface ChaosMeterProps {
  chaosLevel: number; // 0-100
  chaosMode: 'FULL_PSYCHO' | 'FAKE_PROFESSIONAL' | 'HYPER_FOCUSED' | 'CONSPIRACY';
}

export default function ChaosMeter({ chaosLevel, chaosMode }: ChaosMeterProps) {
  const getModeLabel = (mode: string) => {
    switch (mode) {
      case 'FULL_PSYCHO': return 'FULL PSYCHO';
      case 'FAKE_PROFESSIONAL': return 'FAKE PROFESSIONAL';
      case 'HYPER_FOCUSED': return 'HYPER FOCUSED';
      case 'CONSPIRACY': return 'CONSPIRACY THEORIST';
      default: return 'UNKNOWN';
    }
  };

  const getModeColor = (mode: string) => {
    switch (mode) {
      case 'FULL_PSYCHO': return 'text-red-400';
      case 'FAKE_PROFESSIONAL': return 'text-blue-400';
      case 'HYPER_FOCUSED': return 'text-yellow-400';
      case 'CONSPIRACY': return 'text-purple-400';
      default: return 'text-gray-400';
    }
  };

  const getFillColor = (level: number) => {
    if (level >= 80) return 'bg-red-500'; // Full psycho
    if (level >= 60) return 'bg-orange-500'; // Getting wild
    if (level >= 40) return 'bg-yellow-500'; // Moderately unhinged
    if (level >= 20) return 'bg-blue-500'; // Somewhat composed
    return 'bg-green-500'; // Fake professional (rare)
  };

  return (
    <div className="bg-card border border-border rounded-lg p-3 w-full max-w-sm">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-foreground">Nicky's Chaos Level</h3>
        <span className={`text-xs font-bold ${getModeColor(chaosMode)}`}>
          {getModeLabel(chaosMode)}
        </span>
      </div>
      
      {/* Gas Tank Style Meter */}
      <div className="relative">
        {/* Tank outline */}
        <div className="w-full h-8 bg-muted border-2 border-border rounded-md relative overflow-hidden">
          {/* Fill */}
          <div 
            className={`h-full ${getFillColor(chaosLevel)} transition-all duration-500 ease-out`}
            style={{ width: `${chaosLevel}%` }}
          />
          
          {/* Tank markings */}
          <div className="absolute inset-0 flex">
            <div className="w-1/4 border-r border-border/30 h-full" />
            <div className="w-1/4 border-r border-border/30 h-full" />
            <div className="w-1/4 border-r border-border/30 h-full" />
            <div className="w-1/4 h-full" />
          </div>
          
          {/* Level indicator */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs font-bold text-black drop-shadow-sm">
              {chaosLevel}%
            </span>
          </div>
        </div>
        
        {/* Labels */}
        <div className="flex justify-between mt-1 text-xs text-muted-foreground">
          <span>FAKE PROFESSIONAL</span>
          <span>FULL PSYCHO</span>
        </div>
      </div>
      
      {/* Mode description */}
      <div className="mt-2 text-xs text-muted-foreground text-center">
        {chaosMode === 'FULL_PSYCHO' && '🤬 Maximum chaos and profanity'}
        {chaosMode === 'FAKE_PROFESSIONAL' && '😤 Trying to sound composed'}
        {chaosMode === 'HYPER_FOCUSED' && '🎯 Intense gaming concentration'}
        {chaosMode === 'CONSPIRACY' && '🍝 Everything is rigged against him'}
      </div>
    </div>
  );
}