import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import AppShell from "@/layouts/AppShell";
import JazzDashboard from "@/components/jazz-dashboard";
import BrainManagement from "@/pages/brain-management";
import ProjectWorkspace from "@/pages/project-workspace";
import ListenerCities from "@/pages/listener-cities";
import NotFound from "@/pages/not-found";
import type { Profile } from "@/types";

function Router() {
  const { data: activeProfile } = useQuery<Profile>({
    queryKey: ['/api/profiles/active'],
    refetchInterval: false,
  });

  return (
    <AppShell activeProfile={activeProfile}>
      <Switch>
        <Route path="/" component={JazzDashboard} />
        <Route path="/memory" component={BrainManagement} />
        <Route path="/workspace" component={ProjectWorkspace} />
        <Route path="/listener-cities" component={ListenerCities} />
        <Route component={NotFound} />
      </Switch>
    </AppShell>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
