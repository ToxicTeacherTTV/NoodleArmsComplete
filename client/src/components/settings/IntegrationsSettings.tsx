import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronRight, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import DiscordManagementPanel from "@/components/discord-management-panel";

interface IntegrationsSettingsProps {
  activeProfile?: any;
}

export default function IntegrationsSettings({ activeProfile }: IntegrationsSettingsProps) {
  const [showApiKeys, setShowApiKeys] = useState(false);

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <div className="border-b bg-background p-4">
        <h2 className="text-xl font-semibold text-foreground">Integrations</h2>
        <p className="text-sm text-muted-foreground">
          Connect Nicky to Discord, Twitch, and other platforms
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 space-y-6">
        {/* Discord */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Discord Integration
              <Badge variant="secondary" className="text-xs">Beta</Badge>
            </CardTitle>
            <CardDescription>
              Manage Discord bot connection and server configurations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DiscordManagementPanel activeProfile={activeProfile} />
          </CardContent>
        </Card>

        {/* Twitch */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Twitch Integration
              <Badge variant="default" className="text-xs bg-purple-600">Live</Badge>
            </CardTitle>
            <CardDescription>
              Twitch bot is configured via environment variables
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg border">
                <div>
                  <div className="font-medium">Twitch Bot</div>
                  <div className="text-sm text-muted-foreground">
                    Configured via TWITCH_CHANNEL and TWITCH_OAUTH_TOKEN
                  </div>
                </div>
                <Badge variant="outline">Environment</Badge>
              </div>

              <div className="text-sm text-muted-foreground">
                <p className="mb-2">The Twitch bot connects automatically on server start if credentials are present.</p>
                <p>Check server logs to verify connection status.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* API Keys */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>API Keys & Credentials</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowApiKeys(!showApiKeys)}
                className="gap-2"
              >
                {showApiKeys ? (
                  <>
                    <EyeOff className="h-4 w-4" />
                    Hide
                  </>
                ) : (
                  <>
                    <Eye className="h-4 w-4" />
                    Show
                  </>
                )}
              </Button>
            </CardTitle>
            <CardDescription>
              Sensitive credentials managed via environment variables
            </CardDescription>
          </CardHeader>
          {showApiKeys && (
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                  <div className="flex-1">
                    <div className="text-sm font-medium">Gemini API Key</div>
                    <div className="text-xs text-muted-foreground">GEMINI_API_KEY</div>
                  </div>
                  <Badge variant={process.env.GEMINI_API_KEY ? "default" : "secondary"}>
                    {process.env.GEMINI_API_KEY ? "Set" : "Not Set"}
                  </Badge>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                  <div className="flex-1">
                    <div className="text-sm font-medium">ElevenLabs API Key</div>
                    <div className="text-xs text-muted-foreground">ELEVENLABS_API_KEY</div>
                  </div>
                  <Badge variant={process.env.ELEVENLABS_API_KEY ? "default" : "secondary"}>
                    {process.env.ELEVENLABS_API_KEY ? "Set" : "Not Set"}
                  </Badge>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                  <div className="flex-1">
                    <div className="text-sm font-medium">Anthropic API Key</div>
                    <div className="text-xs text-muted-foreground">ANTHROPIC_API_KEY</div>
                  </div>
                  <Badge variant={process.env.ANTHROPIC_API_KEY ? "default" : "secondary"}>
                    {process.env.ANTHROPIC_API_KEY ? "Set" : "Not Set"}
                  </Badge>
                </div>

                <div className="text-xs text-muted-foreground mt-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900">
                  <p className="font-medium text-foreground mb-1">💡 Configuration Note</p>
                  <p>API keys are set in your <code className="px-1 py-0.5 rounded bg-muted">.env</code> file and require server restart to take effect.</p>
                </div>
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}
