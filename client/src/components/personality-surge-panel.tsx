import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Settings, RotateCcw, Zap } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import type { PersonalityState } from '@/types';

export default function PersonalitySurgePanel() {
  const [showOverride, setShowOverride] = useState(false);
  const [overridePreset, setOverridePreset] = useState<string | undefined>();
  const [overrideIntensity, setOverrideIntensity] = useState<string | undefined>();
  const [overrideSpice, setOverrideSpice] = useState<string | undefined>();
  const queryClient = useQueryClient();

  // Get personality state from unified controller
  const { data: personalityState, isLoading } = useQuery<PersonalityState>({
    queryKey: ['/api/personality/state'],
    refetchInterval: 2000, // Refresh every 2 seconds
  });

  // Temporary override mutation
  const overrideMutation = useMutation({
    mutationFn: (overrides: any) => apiRequest('POST', '/api/personality/override', overrides),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/personality/state'] });
      setShowOverride(false);
      // Clear override form
      setOverridePreset(undefined);
      setOverrideIntensity(undefined);
      setOverrideSpice(undefined);
    },
    onError: (error) => {
      console.error('Failed to set personality override:', error);
    }
  });

  // Update base personality mutation
  const updateMutation = useMutation({
    mutationFn: (updates: any) => apiRequest('POST', '/api/personality/update', updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/personality/state'] });
    },
    onError: (error) => {
      console.error('Failed to update personality:', error);
    }
  });

  const getPresetColor = (preset: string) => {
    switch (preset) {
      case 'Chill Nicky': return 'bg-blue-500';
      case 'Roast Mode': return 'bg-orange-500';
      case 'Unhinged': return 'bg-red-500';
      case 'Patch Roast': return 'bg-yellow-500';
      case 'Storytime': return 'bg-purple-500';
      case 'Caller War': return 'bg-pink-500';
      default: return 'bg-gray-500';
    }
  };

  const getIntensityColor = (intensity: string) => {
    switch (intensity) {
      case 'low': return 'text-green-400';
      case 'med': return 'text-yellow-400';
      case 'high': return 'text-orange-400';
      case 'ultra': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getSpiceColor = (spice: string) => {
    switch (spice) {
      case 'platform_safe': return 'text-green-400';
      case 'normal': return 'text-yellow-400';
      case 'spicy': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const handleOverride = () => {
    const overrides: any = {};
    if (overridePreset) overrides.preset = overridePreset;
    if (overrideIntensity) overrides.intensity = overrideIntensity;
    if (overrideSpice) overrides.spice = overrideSpice;
    
    if (Object.keys(overrides).length > 0) {
      overrideMutation.mutate(overrides);
    }
  };

  if (isLoading || !personalityState) {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="p-4">
          <div className="animate-pulse text-center text-muted-foreground">
            Loading personality state...
          </div>
        </CardContent>
      </Card>
    );
  }

  const { basePersonality, effectivePersonality, chaosInfluence, source } = personalityState;
  const chaosPresetSuggestion = chaosInfluence?.suggestedPreset ?? chaosInfluence?.presetSuggestion;

  return (
    <Card className="w-full max-w-md" data-testid="personality-surge-panel">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">
            Personality Surge Panel
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {source}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowOverride(!showOverride)}
              className="h-6 w-6 p-0"
              data-testid="button-personality-override-toggle"
            >
              <Settings className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Current Preset Display */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div 
              className={`w-3 h-3 rounded-full ${getPresetColor(effectivePersonality.preset)}`}
            />
            <span className="font-semibold text-sm" data-testid="text-current-preset">
              {effectivePersonality.preset}
            </span>
            {chaosInfluence && (
              <Zap className="h-3 w-3 text-amber-400" />
            )}
          </div>
          
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="text-center">
              <div className="text-muted-foreground">Intensity</div>
              <div className={`font-semibold ${getIntensityColor(effectivePersonality.intensity)}`}>
                {effectivePersonality.intensity.toUpperCase()}
              </div>
            </div>
            <div className="text-center">
              <div className="text-muted-foreground">Spice</div>
              <div className={`font-semibold ${getSpiceColor(effectivePersonality.spice)}`}>
                {effectivePersonality.spice === 'platform_safe' ? 'SAFE' : 
                 effectivePersonality.spice === 'normal' ? 'NORM' : 'SPICY'}
              </div>
            </div>
            <div className="text-center">
              <div className="text-muted-foreground">DbD</div>
              <div className={`font-semibold ${effectivePersonality.dbd_lens ? 'text-green-400' : 'text-gray-400'}`}>
                {effectivePersonality.dbd_lens ? 'ON' : 'OFF'}
              </div>
            </div>
          </div>
        </div>

        {/* Chaos Influence Display */}
        {chaosInfluence && (
          <div className="p-2 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-md">
            <div className="text-xs text-amber-700 dark:text-amber-300 space-y-1">
              <div>🎲 Chaos Influence: {chaosInfluence.reason}</div>
              {chaosPresetSuggestion && (
                <div className="mt-1">
                  Suggests: {chaosPresetSuggestion}
                </div>
              )}
              {chaosInfluence.spiceCap && (
                <div className="mt-1">
                  Spice cap: {chaosInfluence.spiceCap === 'platform_safe' ? 'SAFE' : chaosInfluence.spiceCap.toUpperCase()}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Temporary Override Panel */}
        {showOverride && (
          <div className="p-3 bg-muted/50 rounded-md border border-dashed border-blue-400">
            <div className="text-xs font-semibold text-blue-400 mb-3">
              Temporary Override (Next Response Only)
            </div>
            
            <div className="space-y-2">
              <div>
                <label className="text-xs text-muted-foreground">Preset</label>
                <Select
                  value={overridePreset ?? undefined}
                  onValueChange={(value) =>
                    setOverridePreset(value === 'keep-current' ? undefined : value)
                  }
                >
                  <SelectTrigger className="h-8 text-xs" data-testid="select-override-preset">
                    <SelectValue placeholder="Keep current" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="keep-current">Keep current</SelectItem>
                    <SelectItem value="Chill Nicky">Chill Nicky</SelectItem>
                    <SelectItem value="Roast Mode">Roast Mode</SelectItem>
                    <SelectItem value="Unhinged">Unhinged</SelectItem>
                    <SelectItem value="Patch Roast">Patch Roast</SelectItem>
                    <SelectItem value="Storytime">Storytime</SelectItem>
                    <SelectItem value="Caller War">Caller War</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground">Intensity</label>
                  <Select
                    value={overrideIntensity ?? undefined}
                    onValueChange={(value) =>
                      setOverrideIntensity(value === 'keep-current' ? undefined : value)
                    }
                  >
                    <SelectTrigger className="h-8 text-xs" data-testid="select-override-intensity">
                      <SelectValue placeholder="Keep" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="keep-current">Keep current</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="med">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="ultra">Ultra</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <label className="text-xs text-muted-foreground">Spice</label>
                  <Select
                    value={overrideSpice ?? undefined}
                    onValueChange={(value) =>
                      setOverrideSpice(value === 'keep-current' ? undefined : value)
                    }
                  >
                    <SelectTrigger className="h-8 text-xs" data-testid="select-override-spice">
                      <SelectValue placeholder="Keep" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="keep-current">Keep current</SelectItem>
                      <SelectItem value="platform_safe">Safe</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="spicy">Spicy</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            
            <div className="flex gap-2 mt-3">
              <Button
                onClick={handleOverride}
                disabled={overrideMutation.isPending}
                size="sm"
                className="flex-1 text-xs h-7"
                data-testid="button-apply-personality-override"
              >
                {overrideMutation.isPending ? 'Applying...' : 'Apply Override'}
              </Button>
              <Button
                variant="ghost"
                onClick={() => setShowOverride(false)}
                size="sm"
                className="h-7 w-7 p-0"
                data-testid="button-cancel-personality-override"
              >
                <RotateCcw className="h-3 w-3" />
              </Button>
            </div>
          </div>
        )}

        <Separator />

        {/* Preset Description */}
        <div className="text-xs text-muted-foreground text-center">
          {effectivePersonality.preset === 'Chill Nicky' && '😤 Measured, dry menace with sophisticated delivery'}
          {effectivePersonality.preset === 'Roast Mode' && '🔥 Punchy wiseguy clips with quip→insult→boast cadence'}
          {effectivePersonality.preset === 'Unhinged' && '🤪 Chaotic jump-cuts with manic energy'}
          {effectivePersonality.preset === 'Patch Roast' && '🎯 Analytical DbD focus with low conspiracy'}
          {effectivePersonality.preset === 'Storytime' && '📖 Tall-tale swagger with absurd details'}
          {effectivePersonality.preset === 'Caller War' && '⚔️ Hostile rebuttal mode with maximum spice'}
        </div>
      </CardContent>
    </Card>
  );
}