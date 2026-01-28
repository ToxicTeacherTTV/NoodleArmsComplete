import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

type CurrentGame = 'none' | 'dbd' | 'arc_raiders' | 'other';
type SpiceLevel = 'platform_safe' | 'normal' | 'spicy';
type HeatLevel = 'grumpy' | 'heated' | 'ranting' | 'explosive';

interface HeatState {
    heat: number;
    currentGame: CurrentGame;
    spice: SpiceLevel;
    lastUpdated: string;
}

export default function HeatControlPanel() {
    const [heatState, setHeatState] = useState<HeatState | null>(null);
    const [pendingHeat, setPendingHeat] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Fetch heat state
    const fetchHeatState = async () => {
        try {
            const res = await fetch('/api/heat/state');
            if (res.ok) {
                const data = await res.json();
                setHeatState(data);
                if (pendingHeat === null) {
                    setPendingHeat(data.heat);
                }
            }
        } catch (err) {
            console.error('Failed to fetch heat state:', err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchHeatState();
        // Poll every 5 seconds for responsive updates
        const interval = setInterval(fetchHeatState, 5000);
        return () => clearInterval(interval);
    }, []);

    // Listen for chat messages to refresh heat state immediately
    useEffect(() => {
        const handleChatMessage = () => {
            // Small delay to let backend process heat changes
            setTimeout(fetchHeatState, 500);
        };

        // Listen for custom event dispatched after chat responses
        window.addEventListener('nicky-response', handleChatMessage);
        return () => window.removeEventListener('nicky-response', handleChatMessage);
    }, []);

    // Update heat
    const handleHeatChange = async (value: number[]) => {
        setPendingHeat(value[0]);
    };

    const handleHeatCommit = async () => {
        if (pendingHeat === null || pendingHeat === heatState?.heat) return;

        try {
            const res = await fetch('/api/heat/set', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ heat: pendingHeat }),
            });
            if (res.ok) {
                const data = await res.json();
                setHeatState(data);
            }
        } catch (err) {
            console.error('Failed to update heat:', err);
        }
    };

    // Update game
    const handleGameChange = async (game: CurrentGame) => {
        try {
            const res = await fetch('/api/heat/game', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ game }),
            });
            if (res.ok) {
                const data = await res.json();
                setHeatState(data);
            }
        } catch (err) {
            console.error('Failed to update game:', err);
        }
    };

    // Update spice
    const handleSpiceChange = async (spice: SpiceLevel) => {
        try {
            const res = await fetch('/api/heat/spice', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ spice }),
            });
            if (res.ok) {
                const data = await res.json();
                setHeatState(data);
            }
        } catch (err) {
            console.error('Failed to update spice:', err);
        }
    };

    // Trigger events
    const handleTriggerEvent = async (event: string) => {
        try {
            const res = await fetch('/api/heat/event', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ event }),
            });
            if (res.ok) {
                const data = await res.json();
                setHeatState(data);
                setPendingHeat(data.heat);
            }
        } catch (err) {
            console.error('Failed to trigger event:', err);
        }
    };

    // Get heat level info
    const getHeatInfo = (heat: number): { level: HeatLevel; color: string; bgColor: string; icon: string; description: string } => {
        if (heat <= 30) return {
            level: 'grumpy',
            color: 'text-yellow-500',
            bgColor: 'bg-yellow-500/20',
            icon: 'fa-face-meh',
            description: 'Annoyed but contained'
        };
        if (heat <= 55) return {
            level: 'heated',
            color: 'text-orange-500',
            bgColor: 'bg-orange-500/20',
            icon: 'fa-face-angry',
            description: 'Agitated, getting worked up'
        };
        if (heat <= 80) return {
            level: 'ranting',
            color: 'text-red-500',
            bgColor: 'bg-red-500/20',
            icon: 'fa-fire',
            description: 'Full rant mode engaged'
        };
        return {
            level: 'explosive',
            color: 'text-red-600',
            bgColor: 'bg-red-600/20',
            icon: 'fa-explosion',
            description: 'MAXIMUM INTENSITY'
        };
    };

    const getSpiceInfo = (spice: SpiceLevel) => {
        switch (spice) {
            case 'platform_safe': return { label: 'Safe', color: 'text-green-500', description: 'No profanity' };
            case 'normal': return { label: 'Normal', color: 'text-yellow-500', description: 'Light swearing' };
            case 'spicy': return { label: 'Spicy', color: 'text-red-500', description: 'Full profanity' };
        }
    };

    if (isLoading || !heatState) {
        return (
            <Card>
                <CardContent className="p-4">
                    <div className="animate-pulse text-center text-muted-foreground">
                        Loading heat state...
                    </div>
                </CardContent>
            </Card>
        );
    }

    const heatInfo = getHeatInfo(pendingHeat ?? heatState.heat);
    const spiceInfo = getSpiceInfo(heatState.spice);

    return (
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <i className={`fas ${heatInfo.icon} ${heatInfo.color}`} />
                    Heat Control
                </CardTitle>
            </CardHeader>

            <CardContent className="space-y-4">
                {/* Heat Level Display & Slider */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Heat Level</span>
                        <Badge
                            variant="outline"
                            className={cn("gap-1", heatInfo.color, heatInfo.bgColor)}
                        >
                            {pendingHeat ?? heatState.heat} - {heatInfo.level.toUpperCase()}
                        </Badge>
                    </div>

                    <Slider
                        value={[pendingHeat ?? heatState.heat]}
                        onValueChange={handleHeatChange}
                        onValueCommit={handleHeatCommit}
                        min={10}
                        max={100}
                        step={5}
                        className="w-full"
                    />

                    <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span>Grumpy</span>
                        <span>Heated</span>
                        <span>Ranting</span>
                        <span>Explosive</span>
                    </div>

                    <p className="text-xs text-muted-foreground text-center">
                        {heatInfo.description}
                    </p>
                </div>

                {/* Quick Heat Buttons */}
                <div className="flex gap-1">
                    <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 text-xs h-7"
                        onClick={() => handleTriggerEvent('calm_down')}
                    >
                        <i className="fas fa-temperature-arrow-down mr-1" />
                        Cool
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 text-xs h-7"
                        onClick={() => handleTriggerEvent('provocation')}
                    >
                        <i className="fas fa-temperature-arrow-up mr-1" />
                        Provoke
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 text-xs h-7 text-red-500"
                        onClick={() => handleTriggerEvent('rage')}
                    >
                        <i className="fas fa-burst mr-1" />
                        Rage
                    </Button>
                </div>

                {/* Game Selector */}
                <div className="space-y-1">
                    <label className="text-xs text-muted-foreground flex items-center gap-1">
                        <i className="fas fa-gamepad" />
                        Current Game
                    </label>
                    <Select
                        value={heatState.currentGame}
                        onValueChange={(value) => handleGameChange(value as CurrentGame)}
                    >
                        <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none">No Game</SelectItem>
                            <SelectItem value="dbd">Dead by Daylight</SelectItem>
                            <SelectItem value="arc_raiders">Arc Raiders</SelectItem>
                            <SelectItem value="other">Other Game</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Spice Selector */}
                <div className="space-y-1">
                    <label className="text-xs text-muted-foreground flex items-center gap-1">
                        <i className="fas fa-pepper-hot" />
                        Spice Level
                    </label>
                    <Select
                        value={heatState.spice}
                        onValueChange={(value) => handleSpiceChange(value as SpiceLevel)}
                    >
                        <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="platform_safe">
                                <span className="flex items-center gap-2">
                                    <span className="text-green-500">Safe</span>
                                    <span className="text-muted-foreground text-[10px]">No profanity</span>
                                </span>
                            </SelectItem>
                            <SelectItem value="normal">
                                <span className="flex items-center gap-2">
                                    <span className="text-yellow-500">Normal</span>
                                    <span className="text-muted-foreground text-[10px]">Light swearing</span>
                                </span>
                            </SelectItem>
                            <SelectItem value="spicy">
                                <span className="flex items-center gap-2">
                                    <span className="text-red-500">Spicy</span>
                                    <span className="text-muted-foreground text-[10px]">Full profanity</span>
                                </span>
                            </SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Current State Summary */}
                <div className="pt-2 border-t text-[10px] text-muted-foreground text-center">
                    {heatState.currentGame !== 'none' && (
                        <span className="mr-2">
                            <i className="fas fa-gamepad mr-1" />
                            {heatState.currentGame === 'dbd' ? 'DbD' :
                             heatState.currentGame === 'arc_raiders' ? 'Arc Raiders' : 'Gaming'}
                        </span>
                    )}
                    <span className={spiceInfo.color}>
                        <i className="fas fa-pepper-hot mr-1" />
                        {spiceInfo.label}
                    </span>
                </div>
            </CardContent>
        </Card>
    );
}
