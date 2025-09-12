import React, { useEffect, useRef, useState } from 'react';

interface NeuralNode {
  id: string;
  label: string;
  type: 'fact' | 'cluster' | 'gap';
  x: number;
  y: number;
  cluster?: string;
  importance?: number;
  qualityScore?: number;
}

interface NeuralConnection {
  source: string;
  target: string;
  type: 'SUPPORTS' | 'CONTRADICTS' | 'ENHANCES' | 'DEPENDS_ON' | 'TEMPORAL_SEQUENCE';
  strength: number;
}

interface NeuralMapProps {
  facts?: any[];
  relationships?: any[];
  clusters?: any[];
  knowledgeGaps?: any[];
  width?: number;
  height?: number;
}

export default function NeuralMap({ 
  facts = [], 
  relationships = [], 
  clusters = [], 
  knowledgeGaps = [],
  width = 600,
  height = 400 
}: NeuralMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [nodes, setNodes] = useState<NeuralNode[]>([]);
  const [connections, setConnections] = useState<NeuralConnection[]>([]);

  const clusterColors = [
    '#8B5CF6', '#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#EC4899',
    '#14B8A6', '#F97316', '#84CC16', '#6366F1'
  ];

  // Initialize nodes and connections
  useEffect(() => {
    const newNodes: NeuralNode[] = [];
    const newConnections: NeuralConnection[] = [];

    // Create fact nodes
    facts.forEach((fact, index) => {
      const angle = (index / facts.length) * 2 * Math.PI;
      const radius = Math.min(width, height) * 0.3;
      newNodes.push({
        id: fact.id,
        label: fact.content.length > 40 ? fact.content.substring(0, 40) + '...' : fact.content,
        type: 'fact',
        x: width/2 + Math.cos(angle) * radius,
        y: height/2 + Math.sin(angle) * radius,
        cluster: fact.clusterId,
        importance: fact.importance,
        qualityScore: fact.qualityScore
      });
    });

    // Create cluster nodes (central nodes)
    clusters.forEach((cluster, index) => {
      const angle = (index / clusters.length) * 2 * Math.PI;
      const radius = Math.min(width, height) * 0.15;
      newNodes.push({
        id: cluster.id,
        label: cluster.name,
        type: 'cluster',
        x: width/2 + Math.cos(angle) * radius,
        y: height/2 + Math.sin(angle) * radius,
        importance: cluster.importance
      });
    });

    // Create knowledge gap nodes
    knowledgeGaps.forEach((gap, index) => {
      const angle = (index / knowledgeGaps.length) * 2 * Math.PI;
      const radius = Math.min(width, height) * 0.45;
      newNodes.push({
        id: `gap-${index}`,
        label: gap.category,
        type: 'gap',
        x: width/2 + Math.cos(angle) * radius,
        y: height/2 + Math.sin(angle) * radius,
        importance: gap.priority
      });
    });

    // Create connections from relationships
    relationships.forEach(rel => {
      newConnections.push({
        source: rel.sourceFactId,
        target: rel.targetFactId,
        type: rel.relationshipType,
        strength: rel.strength
      });
    });

    setNodes(newNodes);
    setConnections(newConnections);
  }, [facts, relationships, clusters, knowledgeGaps, width, height]);

  // Animation and rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrame: number;

    const render = () => {
      // Clear canvas
      ctx.fillStyle = '#0F0F0F';
      ctx.fillRect(0, 0, width, height);

      // Draw connections
      connections.forEach(conn => {
        const sourceNode = nodes.find(n => n.id === conn.source);
        const targetNode = nodes.find(n => n.id === conn.target);
        
        if (sourceNode && targetNode) {
          ctx.beginPath();
          ctx.moveTo(sourceNode.x, sourceNode.y);
          ctx.lineTo(targetNode.x, targetNode.y);
          
          // Connection color based on type
          switch (conn.type) {
            case 'SUPPORTS':
              ctx.strokeStyle = '#10B981';
              break;
            case 'CONTRADICTS':
              ctx.strokeStyle = '#EF4444';
              break;
            case 'ENHANCES':
              ctx.strokeStyle = '#3B82F6';
              break;
            case 'DEPENDS_ON':
              ctx.strokeStyle = '#F59E0B';
              break;
            case 'TEMPORAL_SEQUENCE':
              ctx.strokeStyle = '#8B5CF6';
              break;
            default:
              ctx.strokeStyle = '#64748B';
          }
          
          ctx.lineWidth = Math.max(1, conn.strength / 2);
          ctx.globalAlpha = 0.6;
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
      });

      // Draw nodes
      nodes.forEach((node, index) => {
        const isHovered = hoveredNode === node.id;
        const size = isHovered ? 12 : 8;
        
        // Node color based on type and cluster
        let color = '#64748B';
        if (node.type === 'fact') {
          const clusterIndex = clusters.findIndex(c => c.id === node.cluster);
          color = clusterIndex >= 0 ? clusterColors[clusterIndex % clusterColors.length] : '#64748B';
        } else if (node.type === 'cluster') {
          color = clusterColors[index % clusterColors.length];
        } else if (node.type === 'gap') {
          color = '#DC2626';
        }

        // Draw node
        ctx.beginPath();
        ctx.arc(node.x, node.y, size, 0, 2 * Math.PI);
        ctx.fillStyle = color;
        ctx.fill();
        
        // Add glow effect for important nodes
        if (node.importance && node.importance > 5) {
          ctx.beginPath();
          ctx.arc(node.x, node.y, size + 4, 0, 2 * Math.PI);
          ctx.strokeStyle = color;
          ctx.lineWidth = 2;
          ctx.globalAlpha = 0.3;
          ctx.stroke();
          ctx.globalAlpha = 1;
        }

        // Draw node border
        ctx.beginPath();
        ctx.arc(node.x, node.y, size, 0, 2 * Math.PI);
        ctx.strokeStyle = isHovered ? '#FFFFFF' : '#374151';
        ctx.lineWidth = isHovered ? 2 : 1;
        ctx.stroke();
      });

      animationFrame = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [nodes, connections, hoveredNode, width, height, clusters]);

  // Handle mouse interactions
  const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Find hovered node
    const hovered = nodes.find(node => {
      const distance = Math.sqrt((x - node.x) ** 2 + (y - node.y) ** 2);
      return distance <= 12;
    });

    setHoveredNode(hovered?.id || null);
  };

  const getHoveredNodeInfo = () => {
    if (!hoveredNode) return null;
    const node = nodes.find(n => n.id === hoveredNode);
    if (!node) return null;

    return (
      <div className="absolute bottom-2 left-2 bg-black/80 text-white p-2 rounded text-xs max-w-xs">
        <div className="font-semibold">{node.label}</div>
        <div className="text-gray-300">
          Type: {node.type.charAt(0).toUpperCase() + node.type.slice(1)}
        </div>
        {node.importance && (
          <div className="text-gray-300">Importance: {node.importance}/10</div>
        )}
        {node.qualityScore && (
          <div className="text-gray-300">Quality: {node.qualityScore}/10</div>
        )}
      </div>
    );
  };

  return (
    <div className="relative bg-gray-900 rounded-lg border border-gray-700 overflow-hidden">
      <div className="absolute top-2 left-2 z-10">
        <div className="text-xs text-gray-300 bg-black/60 px-2 py-1 rounded">
          <div className="flex items-center space-x-4">
            <div className="flex items-center">
              <div className="w-2 h-2 bg-blue-400 rounded-full mr-1"></div>
              <span>Facts</span>
            </div>
            <div className="flex items-center">
              <div className="w-2 h-2 bg-purple-400 rounded-full mr-1"></div>
              <span>Clusters</span>
            </div>
            <div className="flex items-center">
              <div className="w-2 h-2 bg-red-500 rounded-full mr-1"></div>
              <span>Knowledge Gaps</span>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute top-2 right-2 z-10 text-xs text-gray-300 bg-black/60 px-2 py-1 rounded">
        Neural Map: {nodes.length} nodes, {connections.length} connections
      </div>

      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoveredNode(null)}
        className="cursor-pointer"
        data-testid="neural-map-canvas"
      />

      {getHoveredNodeInfo()}
    </div>
  );
}