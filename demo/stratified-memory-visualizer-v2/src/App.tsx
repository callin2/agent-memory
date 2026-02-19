import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { loadStratifiedMemory } from '@/lib/api';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';

interface MemoryData {
  success: boolean;
  tenant_id: string;
  layers_loaded: string[];
  estimated_tokens: number;
  metadata: any;
  layers: any;
  compression_ratio?: number;
}

interface LayerInfo {
  id: string;
  name: string;
  description: string;
  color: string;
  tokens: string;
}

const LAYERS: LayerInfo[] = [
  { id: 'metadata', name: 'Metadata Layer', description: 'Session count, first session', color: 'hsl(var(--layer-metadata))', tokens: '~50' },
  { id: 'reflection', name: 'Reflection Layer', description: 'Core insights and identity evolution', color: 'hsl(var(--layer-reflection))', tokens: '~200' },
  { id: 'recent', name: 'Recent Layer', description: 'Recent handoffs and experiences', color: 'hsl(var(--layer-recent))', tokens: '~500' },
  { id: 'progressive', name: 'Progressive Layer', description: 'Topic-specific retrieval on demand', color: 'hsl(var(--layer-progressive))', tokens: '~100' },
];

function App() {
  const [currentTenant, setCurrentTenant] = useState<string>('claude-session');
  const [memoryData, setMemoryData] = useState<MemoryData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
  const [expandedLayer, setExpandedLayer] = useState<string | null>(null);
  const [displayedTokens, setDisplayedTokens] = useState<number>(25000);

  useEffect(() => {
    loadMemoryForTenant(currentTenant);
  }, []);

  async function loadMemoryForTenant(tenantId: string) {
    if (isLoading) return;

    setIsLoading(true);
    setConnectionStatus('connecting');

    try {
      const data = await loadStratifiedMemory(
        tenantId,
        ['metadata', 'reflection', 'recent', 'progressive'],
        3
      );

      setMemoryData(data);
      setCurrentTenant(tenantId);
      setConnectionStatus('connected');

      // Animate token counter
      animateTokens(25000, data.estimated_tokens);

    } catch (error) {
      console.error('Failed to load memory:', error);
      setConnectionStatus('error');
    } finally {
      setIsLoading(false);
    }
  }

  function animateTokens(start: number, end: number) {
    const duration = 2000;
    const startTime = performance.now();

    function step(currentTime: number) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = 1 - Math.pow(1 - progress, 3); // ease-out-cubic
      const current = Math.round(start - (start - end) * easedProgress);

      setDisplayedTokens(current);

      if (progress < 1) {
        requestAnimationFrame(step);
      }
    }

    requestAnimationFrame(step);
  }

  function formatNumber(num: number): string {
    return num.toLocaleString();
  }

  function handleTenantChange(tenantId: string) {
    if (tenantId === currentTenant || isLoading) return;
    loadMemoryForTenant(tenantId);
  }

  function toggleLayer(layerId: string) {
    setExpandedLayer(expandedLayer === layerId ? null : layerId);
  }

  function renderLayerContent(layerId: string) {
    if (!memoryData?.layers) return null;

    const layer = memoryData.layers[layerId as keyof typeof memoryData.layers];
    if (!layer) return <p className="text-sm text-muted-foreground">No data available</p>;

    return (
      <div className="space-y-2 text-sm">
        {layerId === 'metadata' && (
          <div className="space-y-1">
            <p><strong>Tenant:</strong> {memoryData.tenant_id}</p>
            <p><strong>Sessions:</strong> {memoryData.metadata?.session_count || 'N/A'}</p>
            <p><strong>First Session:</strong> {memoryData.metadata?.first_session || 'N/A'}</p>
          </div>
        )}
        {layerId === 'reflection' && (
          <div className="space-y-2">
            {Array.isArray(layer.content) ? (
              layer.content.map((item: any, idx: number) => (
                <div key={idx} className="border-l-2 pl-3" style={{ borderColor: LAYERS[1].color }}>
                  <p className="text-xs text-muted-foreground">Confidence: {(item.confidence * 100).toFixed(0)}%</p>
                  <p className="text-xs">{item.principle}</p>
                </div>
              ))
            ) : (
              <p className="text-xs">{JSON.stringify(layer.content, null, 2)}</p>
            )}
          </div>
        )}
        {layerId === 'recent' && (
          <div className="space-y-2">
            {Array.isArray(layer.content) ? (
              layer.content.map((handoff: any, idx: number) => (
                <div key={idx} className="border rounded p-2">
                  <p className="text-xs font-medium">{handoff.session_id}</p>
                  <p className="text-xs text-muted-foreground mt-1">{handoff.becoming?.substring(0, 100)}...</p>
                </div>
              ))
            ) : (
              <p className="text-xs">{JSON.stringify(layer.content, null, 2)}</p>
            )}
          </div>
        )}
        {layerId === 'progressive' && (
          <p className="text-xs text-muted-foreground">
            Progressive retrieval is loaded on-demand based on topic context.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                Stratified Memory Visualizer
              </h1>
              <p className="text-sm text-muted-foreground">
                Watch 25,000 tokens compress to ~850
              </p>
            </div>
            <div className="flex items-center gap-4">
              {/* Connection Status */}
              <div className="flex items-center gap-2">
                {connectionStatus === 'connected' && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                {connectionStatus === 'connecting' && <Loader2 className="w-4 h-4 animate-spin text-yellow-500" />}
                {connectionStatus === 'error' && <XCircle className="w-4 h-4 text-red-500" />}
                <span className="text-sm text-muted-foreground">
                  {connectionStatus === 'connected' && 'Connected'}
                  {connectionStatus === 'connecting' && 'Connecting...'}
                  {connectionStatus === 'error' && 'Error'}
                </span>
              </div>

              {/* Tenant Selector */}
              <select
                value={currentTenant}
                onChange={(e) => handleTenantChange(e.target.value)}
                disabled={isLoading}
                className="border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
              >
                <option value="claude-session">claude-session</option>
                <option value="default">default</option>
              </select>
            </div>
          </div>
        </div>
      </header>

      {/* Stats Bar */}
      <section className="border-b bg-muted/30">
        <div className="container mx-auto px-4 py-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="text-center">
                  <p className="text-2xl font-bold">{memoryData?.metadata?.session_count || '-'}</p>
                  <p className="text-xs text-muted-foreground">Sessions</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-center">
                  <p className="text-2xl font-bold">{memoryData?.compression_ratio ? `${memoryData.compression_ratio}x` : '-'}</p>
                  <p className="text-xs text-muted-foreground">Compression</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-red-500">{formatNumber(displayedTokens)}</p>
                  <p className="text-xs text-muted-foreground">Before</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-500">{memoryData ? formatNumber(memoryData.estimated_tokens) : '-'}</p>
                  <p className="text-xs text-muted-foreground">After</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Layer Cards */}
        <div className="space-y-4">
          {LAYERS.map((layer) => {
            const isLoaded = memoryData?.layers_loaded?.includes(layer.id);
            const isExpanded = expandedLayer === layer.id;

            return (
              <Card
                key={layer.id}
                className="overflow-hidden transition-all duration-300"
                style={{
                  borderLeftWidth: '4px',
                  borderLeftColor: layer.color,
                }}
              >
                <button
                  onClick={() => toggleLayer(layer.id)}
                  disabled={isLoading}
                  className="w-full text-left"
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: layer.color }}
                        />
                        <CardTitle className="text-lg">{layer.name}</CardTitle>
                        <span className="text-sm text-muted-foreground">({layer.tokens} tokens)</span>
                        {isLoading && !isLoaded && (
                          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                        )}
                        {isLoaded && (
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {isLoaded ? 'Loaded' : 'Loading...'}
                        </span>
                        <span className="text-muted-foreground">
                          {isExpanded ? '▼' : '▶'}
                        </span>
                      </div>
                    </div>
                    <CardDescription>{layer.description}</CardDescription>
                  </CardHeader>
                </button>

                {isExpanded && (
                  <CardContent className="pt-0 border-t">
                    {renderLayerContent(layer.id)}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t mt-16">
        <div className="container mx-auto px-4 py-6 text-center text-sm text-muted-foreground">
          <p>Stratified Memory Visualizer • Thread's Memory System</p>
          <p className="mt-1">Demonstrating 32x token compression through semantic layers</p>
        </div>
      </footer>
    </div>
  );
}

export default App;
