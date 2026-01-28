import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import SettingsSidebar, { type SettingsSectionId } from "@/components/settings/SettingsSidebar";
import PersonalitySettings from "@/components/settings/PersonalitySettings";
import IntegrationsSettings from "@/components/settings/IntegrationsSettings";
import ContentPipelineSettings from "@/components/settings/ContentPipelineSettings";
import SystemSettings from "@/components/settings/SystemSettings";
import type { Profile } from "@/types";

export default function Settings() {
  const [currentSection, setCurrentSection] = useState<SettingsSectionId>('personality');

  // Fetch active profile
  const { data: activeProfile } = useQuery<Profile>({
    queryKey: ['/api/profiles/active'],
    refetchInterval: false,
  });

  // Render current section
  const renderSection = () => {
    switch (currentSection) {
      case 'personality':
        return <PersonalitySettings activeProfile={activeProfile} />;
      case 'integrations':
        return <IntegrationsSettings activeProfile={activeProfile} />;
      case 'content-pipeline':
        return <ContentPipelineSettings activeProfile={activeProfile} />;
      case 'system':
        return <SystemSettings activeProfile={activeProfile} />;
      default:
        return null;
    }
  };

  return (
    <div className="h-screen flex flex-col">
      {/* Top Bar */}
      <div className="border-b bg-background px-6 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground">Configure Nicky's behavior and integrations</p>
        </div>
      </div>

      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <SettingsSidebar
          currentSection={currentSection}
          onSectionChange={setCurrentSection}
        />

        {/* Content Area */}
        <div className="flex-1 overflow-hidden bg-background">
          {renderSection()}
        </div>
      </div>
    </div>
  );
}
