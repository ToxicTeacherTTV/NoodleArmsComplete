import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { MapPin, Upload, Plus, Trash2, Check, Globe, Filter, Shuffle, BarChart3, ChevronDown, ChevronUp } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

interface ListenerCity {
  id: string;
  city: string;
  stateProvince?: string;
  country: string;
  continent: string;
  region?: string;
  isCovered: boolean;
  coveredDate?: string;
  coveredEpisode?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

interface CityStats {
  total: number;
  covered: number;
  uncovered: number;
  byContinents: Record<string, number>;
  byCountries: Record<string, number>;
  byRegions: Record<string, number>;
}

export default function ListenerCitiesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Filters
  const [filterCountry, setFilterCountry] = useState<string>("");
  const [filterContinent, setFilterContinent] = useState<string>("");
  const [filterRegion, setFilterRegion] = useState<string>("");
  const [filterCovered, setFilterCovered] = useState<string>("all");
  const [isFiltersOpen, setIsFiltersOpen] = useState(true);

  // Add city form
  const [newCity, setNewCity] = useState("");
  const [newState, setNewState] = useState("");
  const [newCountry, setNewCountry] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);

  // Import form
  const [importContent, setImportContent] = useState("");
  const [showImportDialog, setShowImportDialog] = useState(false);

  // Build query params
  const buildQueryParams = () => {
    const params = new URLSearchParams();
    if (filterCountry) params.append("country", filterCountry);
    if (filterContinent) params.append("continent", filterContinent);
    if (filterRegion) params.append("region", filterRegion);
    if (filterCovered !== "all") params.append("covered", filterCovered);
    return params.toString();
  };

  // Fetch cities
  const { data: cities = [], isLoading } = useQuery<ListenerCity[]>({
    queryKey: ["listener-cities", filterCountry, filterContinent, filterRegion, filterCovered],
    queryFn: async () => {
      const params = buildQueryParams();
      const url = `/api/podcast/cities${params ? `?${params}` : ""}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch cities");
      return res.json();
    },
  });

  // Fetch stats
  const { data: stats } = useQuery<CityStats>({
    queryKey: ["listener-cities-stats"],
    queryFn: async () => {
      const res = await fetch("/api/podcast/cities/stats");
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
  });

  // Add city mutation
  const addCityMutation = useMutation({
    mutationFn: async (data: { city: string; stateProvince?: string; country?: string }) => {
      const res = await fetch("/api/podcast/cities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to add city");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["listener-cities"] });
      queryClient.invalidateQueries({ queryKey: ["listener-cities-stats"] });
      setNewCity("");
      setNewState("");
      setNewCountry("");
      setShowAddDialog(false);
      toast({ title: "City added successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Import cities mutation
  const importCitiesMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await fetch("/api/podcast/cities/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error("Failed to import cities");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["listener-cities"] });
      queryClient.invalidateQueries({ queryKey: ["listener-cities-stats"] });
      setImportContent("");
      setShowImportDialog(false);
      toast({
        title: "Import complete",
        description: `Imported ${data.imported} cities, skipped ${data.skipped}, failed ${data.failed}`,
      });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Update city mutation
  const updateCityMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<ListenerCity> }) => {
      const res = await fetch(`/api/podcast/cities/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error("Failed to update city");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["listener-cities"] });
      queryClient.invalidateQueries({ queryKey: ["listener-cities-stats"] });
      toast({ title: "City updated" });
    },
  });

  // Delete city mutation
  const deleteCityMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/podcast/cities/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete city");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["listener-cities"] });
      queryClient.invalidateQueries({ queryKey: ["listener-cities-stats"] });
      toast({ title: "City deleted" });
    },
  });

  // Get random uncovered city
  const getRandomCityMutation = useMutation({
    mutationFn: async () => {
      const params = buildQueryParams();
      const url = `/api/podcast/cities/random-uncovered${params ? `?${params}` : ""}`;
      const res = await fetch(url);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "No uncovered cities found");
      }
      return res.json();
    },
    onSuccess: (city: ListenerCity) => {
      toast({
        title: "🎲 Nicky's pick!",
        description: `${city.city}${city.stateProvince ? `, ${city.stateProvince}` : ""}, ${city.country}`,
      });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // File upload handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/podcast/cities/import", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Failed to import file");

      const data = await res.json();
      queryClient.invalidateQueries({ queryKey: ["listener-cities"] });
      queryClient.invalidateQueries({ queryKey: ["listener-cities-stats"] });

      toast({
        title: "Import complete",
        description: `Imported ${data.imported} cities, skipped ${data.skipped}, failed ${data.failed}`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to import",
        variant: "destructive",
      });
    }

    // Reset file input
    e.target.value = "";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <MapPin className="h-8 w-8" />
            Podcast Listener Cities
          </h1>
          <p className="text-muted-foreground mt-1">
            Track cities for "Where the fuck are the viewers from"
          </p>
        </div>

        <div className="flex gap-2">
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Add City
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Listener City</DialogTitle>
                <DialogDescription>
                  Add a new city manually. We'll auto-detect the country if possible.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>City Name *</Label>
                  <Input
                    value={newCity}
                    onChange={(e) => setNewCity(e.target.value)}
                    placeholder="e.g., New York"
                  />
                </div>
                <div>
                  <Label>State/Province (Optional)</Label>
                  <Input
                    value={newState}
                    onChange={(e) => setNewState(e.target.value)}
                    placeholder="e.g., New York, Ontario"
                  />
                </div>
                <div>
                  <Label>Country (Optional - auto-detected if famous city)</Label>
                  <Input
                    value={newCountry}
                    onChange={(e) => setNewCountry(e.target.value)}
                    placeholder="e.g., USA, Canada"
                  />
                </div>
                <Button
                  onClick={() =>
                    addCityMutation.mutate({
                      city: newCity,
                      stateProvince: newState || undefined,
                      country: newCountry || undefined,
                    })
                  }
                  disabled={!newCity || addCityMutation.isPending}
                >
                  Add City
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Upload className="h-4 w-4 mr-2" />
                Import
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Import Cities</DialogTitle>
                <DialogDescription>
                  Upload a CSV file or paste city names (one per line).
                  <br />
                  Format: City, State/Province, Country (State is optional)
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Upload File</Label>
                  <Input type="file" accept=".csv,.txt" onChange={handleFileUpload} />
                </div>
                <div className="text-center text-sm text-muted-foreground">OR</div>
                <div>
                  <Label>Paste Cities</Label>
                  <Textarea
                    value={importContent}
                    onChange={(e) => setImportContent(e.target.value)}
                    placeholder="New York, NY, USA&#10;Paris, France&#10;Toronto, Ontario, Canada&#10;London, UK"
                    rows={8}
                  />
                </div>
                <Button
                  onClick={() => importCitiesMutation.mutate(importContent)}
                  disabled={!importContent || importCitiesMutation.isPending}
                >
                  Import Cities
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Button
            onClick={() => getRandomCityMutation.mutate()}
            disabled={getRandomCityMutation.isPending}
            className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
          >
            <Shuffle className="h-4 w-4 mr-2" />
            Pick Random
          </Button>
        </div>
      </div>

      {/* Statistics */}
      {stats && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Statistics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-2xl font-bold">{stats.total}</div>
                <div className="text-sm text-muted-foreground">Total Cities</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">{stats.covered}</div>
                <div className="text-sm text-muted-foreground">Covered</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-600">{stats.uncovered}</div>
                <div className="text-sm text-muted-foreground">Uncovered</div>
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {Object.keys(stats.byCountries).length}
                </div>
                <div className="text-sm text-muted-foreground">Countries</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Collapsible open={isFiltersOpen} onOpenChange={setIsFiltersOpen}>
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filters
              </CardTitle>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="w-9 p-0">
                  {isFiltersOpen ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                  <span className="sr-only">Toggle filters</span>
                </Button>
              </CollapsibleTrigger>
            </div>
          </CardHeader>
          <CollapsibleContent>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <Label>Continent</Label>
                  <Select value={filterContinent || "all-continents"} onValueChange={(v) => setFilterContinent(v === "all-continents" ? "" : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Continents" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all-continents">All Continents</SelectItem>
                      {stats &&
                        Object.keys(stats.byContinents).map((continent) => (
                          <SelectItem key={continent} value={continent}>
                            {continent} ({stats.byContinents[continent]})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Country</Label>
                  <Select value={filterCountry || "all-countries"} onValueChange={(v) => setFilterCountry(v === "all-countries" ? "" : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Countries" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all-countries">All Countries</SelectItem>
                      {stats &&
                        Object.keys(stats.byCountries).map((country) => (
                          <SelectItem key={country} value={country}>
                            {country} ({stats.byCountries[country]})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Region</Label>
                  <Select value={filterRegion || "all-regions"} onValueChange={(v) => setFilterRegion(v === "all-regions" ? "" : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Regions" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all-regions">All Regions</SelectItem>
                      {stats &&
                        Object.keys(stats.byRegions).map((region) => (
                          <SelectItem key={region} value={region}>
                            {region} ({stats.byRegions[region]})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Status</Label>
                  <Select value={filterCovered} onValueChange={setFilterCovered}>
                    <SelectTrigger>
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Cities</SelectItem>
                      <SelectItem value="true">Covered Only</SelectItem>
                      <SelectItem value="false">Uncovered Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Cities List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Cities ({cities.length})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading cities...</div>
          ) : cities.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No cities found. Add some cities to get started!
            </div>
          ) : (
            <div className="space-y-2">
              {cities.map((city) => (
                <div
                  key={city.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <Checkbox
                      checked={city.isCovered}
                      onCheckedChange={(checked) =>
                        updateCityMutation.mutate({
                          id: city.id,
                          updates: { isCovered: checked as boolean },
                        })
                      }
                    />
                    <div className="flex-1">
                      <div className="font-medium">
                        {city.city}
                        {city.stateProvince && `, ${city.stateProvince}`}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {city.country} • {city.continent}
                        {city.region && ` • ${city.region}`}
                      </div>
                      {city.isCovered && city.coveredEpisode && (
                        <div className="text-xs text-green-600 mt-1">
                          ✓ Covered in {city.coveredEpisode}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {city.isCovered ? (
                      <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-500/20">
                        <Check className="h-3 w-3 mr-1" />
                        Covered
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-blue-500/10 text-blue-700 border-blue-500/20">
                        Uncovered
                      </Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteCityMutation.mutate(city.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
