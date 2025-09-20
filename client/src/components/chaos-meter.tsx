import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Settings, RotateCcw } from 'lucide-react';

interface ChaosMeterProps {
  chaosLevel: number; // 0-100
  chaosMode: 'FULL_PSYCHO' | 'FAKE_PROFESSIONAL' | 'HYPER_FOCUSED' | 'CONSPIRACY';
  manualOverride?: number; // Manual override level if active
  effectiveLevel?: number; // The level actually being used (override or natural)
}

export default function ChaosMeter({ chaosLevel, chaosMode, manualOverride, effectiveLevel }: ChaosMeterProps) {
  const [showOverride, setShowOverride] = useState(false);
  const [sliderValue, setSliderValue] = useState([chaosLevel]);
  const queryClient = useQueryClient();

  // Display effective level (override or natural)
  const displayLevel = effectiveLevel ?? chaosLevel;
  const isOverrideActive = manualOverride !== undefined;

  // Manual override mutation
  const overrideMutation = useMutation({
    mutationFn: (level: number) => apiRequest('POST', '/api/chaos/override', { level }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/chaos/state'] });
      setShowOverride(false);
    },
    onError: (error) => {
      console.error('Failed to set chaos override:', error);
    }
  });
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

  const handleOverride = () => {
    const level = sliderValue[0];
    overrideMutation.mutate(level);
  };

  return (
    <div className="bg-card border border-border rounded-lg p-3 w-full max-w-sm">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-foreground">
          Nicky's Chaos Level
          {isOverrideActive && (
            <span className="ml-2 text-xs text-orange-400 font-normal">
              (Manual Override)
            </span>
          )}
        </h3>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold ${getModeColor(chaosMode)}`}>
            {getModeLabel(chaosMode)}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowOverride(!showOverride)}
            className="h-6 w-6 p-0"
            data-testid="button-chaos-override-toggle"
          >
            <Settings className="h-3 w-3" />
          </Button>
        </div>
      </div>
      
      {/* Manual Override Slider */}
      {showOverride && (
        <div className="mb-4 p-3 bg-muted/50 rounded-md border border-dashed border-orange-400">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-orange-400">Manual Override (Next Response Only)</span>
            <span className="text-xs text-muted-foreground">{sliderValue[0]}%</span>
          </div>
          <Slider
            value={sliderValue}
            onValueChange={setSliderValue}
            max={100}
            min={0}
            step={5}
            className="mb-3"
            data-testid="slider-chaos-override"
          />
          <div className="flex gap-2">
            <Button
              onClick={handleOverride}
              disabled={overrideMutation.isPending}
              size="sm"
              className="flex-1 text-xs h-7"
              data-testid="button-apply-override"
            >
              {overrideMutation.isPending ? 'Setting...' : `Set ${sliderValue[0]}%`}
            </Button>
            <Button
              variant="ghost"
              onClick={() => setShowOverride(false)}
              size="sm"
              className="h-7 w-7 p-0"
              data-testid="button-cancel-override"
            >
              <RotateCcw className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}

      {/* Gas Tank Style Meter */}
      <div className="relative">
        {/* Tank outline */}
        <div className="w-full h-8 bg-muted border-2 border-border rounded-md relative overflow-hidden">
          {/* Fill */}
          <div 
            className={`h-full ${getFillColor(displayLevel)} transition-all duration-500 ease-out ${
              isOverrideActive ? 'ring-2 ring-orange-400 ring-inset' : ''
            }`}
            style={{ width: `${displayLevel}%` }}
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
              {displayLevel}%
            </span>
          </div>

          {/* Override indicator overlay */}
          {isOverrideActive && (
            <div className="absolute top-0 right-0 h-2 w-2 bg-orange-400 rounded-full animate-pulse" />
          )}
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