import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PersonalityPanel from "@/components/personality-panel";
import HeatControlPanel from "@/components/heat-control-panel";

interface PersonalitySettingsProps {
  activeProfile?: any;
}

export default function PersonalitySettings({ activeProfile }: PersonalitySettingsProps) {
  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <div className="border-b bg-background p-4">
        <h2 className="text-xl font-semibold text-foreground">Personality</h2>
        <p className="text-sm text-muted-foreground">
          Define how Nicky thinks, speaks, and behaves
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 space-y-6">
        {/* Core Personality */}
        <Card>
          <CardHeader>
            <CardTitle>Core Personality & Presets</CardTitle>
            <CardDescription>
              Configure Nicky's baseline personality, presets, and behavior modes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PersonalityPanel activeProfile={activeProfile} />
          </CardContent>
        </Card>

        {/* Heat & Chaos Controls */}
        <Card>
          <CardHeader>
            <CardTitle>Heat & Chaos Controls</CardTitle>
            <CardDescription>
              Adjust how spicy and unpredictable Nicky's responses are
            </CardDescription>
          </CardHeader>
          <CardContent>
            <HeatControlPanel activeProfile={activeProfile} />
          </CardContent>
        </Card>

        {/* Voice Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Voice Settings</CardTitle>
            <CardDescription>
              Configure ElevenLabs voice synthesis and emotion range
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Voice Model</label>
                <p className="text-xs text-muted-foreground mb-2">
                  ElevenLabs voice ID for Nicky's voice
                </p>
                <input
                  type="text"
                  className="w-full px-3 py-2 border rounded-md text-sm"
                  placeholder="ElevenLabs Voice ID"
                  disabled
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Voice configuration is managed in environment variables
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
