/**
 * frontend/src/components/CanonGraphVisual.tsx
 * High-craft, deterministic SVG entity canon graph for RETCON-RADAR.
 * Fixed viewBox (580x420) with 40px internal margin, rounded rectangle nodes,
 * smooth boundary-clipped curves, live pointer dragging, hover scaling,
 * traveling dashes, pulse rings, and optional sequential stage reveal.
 */

import React, { useState, useRef, useEffect } from "react";

export interface NodeData {
  id: string;
  label: string;
  type: "character" | "injury" | "item" | "rule";
  x: number;
  y: number;
  w: number;
  h: number;
  icon: "user" | "bandage" | "box" | "book";
}

interface CanonGraphVisualProps {
  /** If provided, controls which elements are revealed in sequence: 0..4 */
  stage?: number;
  /** Whether nodes can be dragged by pointer */
  draggable?: boolean;
  /** Custom class for outer wrapper */
  className?: string;
  /** Callback when user starts interacting */
  onUserInteract?: () => void;
}

export const CanonGraphVisual: React.FC<CanonGraphVisualProps> = ({
  stage = 4,
  draggable = true,
  className = "",
  onUserInteract,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);

  // Initial nodes layout with >= 40px padding inside 580x420 viewBox
  const [nodes, setNodes] = useState<NodeData[]>([
    {
      id: "kabir",
      label: "Kabir",
      type: "character",
      x: 45,
      y: 155,
      w: 190,
      h: 68,
      icon: "user",
    },
    {
      id: "injury",
      label: "Right shoulder",
      type: "injury",
      x: 350,
      y: 50,
      w: 175,
      h: 58,
      icon: "bandage",
    },
    {
      id: "item",
      label: "Sniper rifle",
      type: "item",
      x: 65,
      y: 310,
      w: 165,
      h: 58,
      icon: "box",
    },
    {
      id: "rule",
      label: "Injured Heavy Use",
      type: "rule",
      x: 345,
      y: 285,
      w: 185,
      h: 58,
      icon: "book",
    },
  ]);

  const [activeHoverNode, setActiveHoverNode] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  // Floating gentle phase offsets (3 to 6px)
  const [floatOffsets, setFloatOffsets] = useState([
    { x: 0, y: 0 },
    { x: 0, y: 0 },
    { x: 0, y: 0 },
    { x: 0, y: 0 },
  ]);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return;

    let animId: number;
    let start = performance.now();

    const animateFloat = (now: number) => {
      const elapsed = (now - start) / 1000;
      setFloatOffsets([
        { x: Math.sin(elapsed * 0.9) * 2.5, y: Math.cos(elapsed * 0.8) * 3.5 },
        { x: Math.cos(elapsed * 0.7) * 3.2, y: Math.sin(elapsed * 1.1) * 3.0 },
        { x: Math.sin(elapsed * 1.2) * 2.8, y: Math.cos(elapsed * 0.9) * 3.2 },
        { x: Math.cos(elapsed * 1.0) * 3.0, y: Math.sin(elapsed * 0.8) * 3.6 },
      ]);
      animId = requestAnimationFrame(animateFloat);
    };

    animId = requestAnimationFrame(animateFloat);
    return () => cancelAnimationFrame(animId);
  }, []);

  // Compute exact boundary-to-boundary clipped curve between two rect nodes
  const getClippedCurve = (n1: NodeData, n2: NodeData, curvature: number = 0) => {
    const cx1 = n1.x + n1.w / 2;
    const cy1 = n1.y + n1.h / 2;
    const cx2 = n2.x + n2.w / 2;
    const cy2 = n2.y + n2.h / 2;

    const dx = cx2 - cx1;
    const dy = cy2 - cy1;
    const dist = Math.hypot(dx, dy) || 1;

    // Boundary intersection scale for Node 1
    const sX1 = (n1.w / 2 + 2) / (Math.abs(dx) || 0.001);
    const sY1 = (n1.h / 2 + 2) / (Math.abs(dy) || 0.001);
    const s1 = Math.min(sX1, sY1);
    const startX = cx1 + dx * Math.min(s1, 1);
    const startY = cy1 + dy * Math.min(s1, 1);

    // Boundary intersection scale for Node 2
    const sX2 = (n2.w / 2 + 2) / (Math.abs(dx) || 0.001);
    const sY2 = (n2.h / 2 + 2) / (Math.abs(dy) || 0.001);
    const s2 = Math.min(sX2, sY2);
    const endX = cx2 - dx * Math.min(s2, 1);
    const endY = cy2 - dy * Math.min(s2, 1);

    // Midpoint and quadratic control point
    const midX = (startX + endX) / 2;
    const midY = (startY + endY) / 2;
    const ctrlX = midX + (-dy / dist) * curvature;
    const ctrlY = midY + (dx / dist) * curvature;

    const path = `M ${startX.toFixed(1)} ${startY.toFixed(1)} Q ${ctrlX.toFixed(1)} ${ctrlY.toFixed(1)} ${endX.toFixed(1)} ${endY.toFixed(1)}`;
    const labelX = 0.25 * startX + 0.5 * ctrlX + 0.25 * endX;
    const labelY = 0.25 * startY + 0.5 * ctrlY + 0.25 * endY;

    return { startX, startY, endX, endY, ctrlX, ctrlY, path, labelX, labelY };
  };

  // Dragging support in SVG coordinates
  const getSvgCoordinates = (e: React.PointerEvent) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const pt = svgRef.current.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const screenCTM = svgRef.current.getScreenCTM();
    if (screenCTM) {
      const inv = screenCTM.inverse();
      return pt.matrixTransform(inv);
    }
    return { x: 0, y: 0 };
  };

  const handlePointerDown = (id: string, e: React.PointerEvent) => {
    if (!draggable) return;
    onUserInteract?.();
    const coords = getSvgCoordinates(e);
    const node = nodes.find((n) => n.id === id);
    if (!node) return;

    setDraggingId(id);
    dragOffsetRef.current = {
      x: coords.x - node.x,
      y: coords.y - node.y,
    };
    (e.target as SVGElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!draggingId || !draggable) return;
    const coords = getSvgCoordinates(e);
    const node = nodes.find((n) => n.id === draggingId);
    if (!node) return;

    // Keep node safely within viewBox bounds (40px padding)
    const newX = Math.max(30, Math.min(580 - node.w - 30, coords.x - dragOffsetRef.current.x));
    const newY = Math.max(25, Math.min(420 - node.h - 25, coords.y - dragOffsetRef.current.y));

    setNodes((prev) =>
      prev.map((n) => (n.id === draggingId ? { ...n, x: newX, y: newY } : n))
    );
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (draggingId) {
      try {
        (e.target as SVGElement).releasePointerCapture(e.pointerId);
      } catch {}
      setDraggingId(null);
    }
  };

  // Node rendering helper
  const renderNode = (node: NodeData, index: number) => {
    // Stage visibility check (if stage < 4, reveal sequentially)
    let isVisible = true;
    if (stage < 4) {
      if (node.id === "kabir" && stage < 0) isVisible = false;
      if (node.id === "injury" && stage < 1) isVisible = false;
      if (node.id === "item" && stage < 2) isVisible = false;
      if (node.id === "rule" && stage < 3) isVisible = false;
    }

    const float = floatOffsets[index] || { x: 0, y: 0 };
    const curX = node.x + (draggingId === node.id ? 0 : float.x);
    const curY = node.y + (draggingId === node.id ? 0 : float.y);

    const isHovered = activeHoverNode === node.id;
    const isDragging = draggingId === node.id;
    const scale = isHovered || isDragging ? 1.06 : 1;

    // Node styling specs
    let fill = "#e6ebef";
    let stroke = "#8aa0b0";
    let textColor = "#25282c";
    let iconBg = "#8aa0b0";

    if (node.type === "character") {
      fill = "#e6ebef";
      stroke = isHovered ? "#25282c" : "#8aa0b0";
      textColor = "#25282c";
      iconBg = "#8aa0b0";
    } else if (node.type === "item") {
      fill = "#f3e8cf";
      stroke = isHovered ? "#9e7d3b" : "#c9a86a";
      textColor = "#25282c";
      iconBg = "#c9a86a";
    } else if (node.type === "injury") {
      fill = "#f6dcd6";
      stroke = isHovered ? "#b8402f" : "#d28a7d";
      textColor = "#b8402f";
      iconBg = "#d28a7d";
    } else if (node.type === "rule") {
      fill = "#e4eadf";
      stroke = isHovered ? "#3d7a5c" : "#9bb08e";
      textColor = "#3d7a5c";
      iconBg = "#9bb08e";
    }

    return (
      <g
        key={node.id}
        transform={`translate(${curX}, ${curY}) scale(${scale})`}
        style={{
          transformOrigin: `${node.w / 2}px ${node.h / 2}px`,
          transition: isDragging ? "none" : "transform 200ms cubic-bezier(0.16, 1, 0.3, 1)",
        }}
        onPointerDown={(e) => handlePointerDown(node.id, e)}
        onPointerEnter={() => setActiveHoverNode(node.id)}
        onPointerLeave={() => setActiveHoverNode(null)}
        className={`cursor-grab active:cursor-grabbing transition-opacity duration-300 ${
          isVisible ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        {/* Pulse ring for contradiction nodes (Injury & Rule) */}
        {stage >= 4 && (node.type === "injury" || node.type === "rule") && (
          <rect
            x={-6}
            y={-6}
            width={node.w + 12}
            height={node.h + 12}
            rx={node.h > 60 ? 20 : 18}
            fill="none"
            stroke={node.type === "injury" ? "#b8402f" : "#3d7a5c"}
            strokeWidth={1.5}
            strokeDasharray="4 4"
            className="animate-pulse"
            opacity={0.65}
          />
        )}

        {/* Main Node Card Body */}
        <rect
          x={0}
          y={0}
          width={node.w}
          height={node.h}
          rx={node.h > 60 ? 16 : 14}
          fill={fill}
          stroke={stroke}
          strokeWidth={node.id === "kabir" ? 2.5 : 2}
          filter="url(#node-shadow)"
        />

        {/* Small Left Round Icon */}
        <g transform={`translate(16, ${node.h / 2 - 13})`}>
          <circle cx={13} cy={13} r={13} fill={iconBg} fillOpacity={0.2} />
          {node.icon === "user" && (
            <path
              d="M13 7a3 3 0 100 6 3 3 0 000-6zm-5 12c0-2.8 2.2-5 5-5s5 2.2 5 5H8z"
              fill={textColor}
              transform="scale(0.9) translate(1.5, 0.5)"
            />
          )}
          {node.icon === "bandage" && (
            <path
              d="M7 19L19 7l2 2-12 12-2-2zm4.5-4.5l1 1m2-2l1 1m-4 2l1 1"
              stroke={textColor}
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          )}
          {node.icon === "box" && (
            <path
              d="M6 9l7-4 7 4-7 4-7-4zm0 2.5l7 4v7.5l-7-4v-7.5zm14 0l-7 4v7.5l7-4v-7.5z"
              fill="none"
              stroke={textColor}
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
          )}
          {node.icon === "book" && (
            <path
              d="M7 6v14c2-1 4-1 6 0 2-1 4-1 6 0V6c-2-1-4-1-6 0-2-1-4-1-6 0zm6 1v13"
              fill="none"
              stroke={textColor}
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
        </g>

        {/* Label: Newsreader 20px */}
        <text
          x={node.icon ? 52 : 20}
          y={node.h / 2 + 6}
          fontFamily="'Newsreader', Georgia, serif"
          fontSize={node.id === "kabir" ? "21px" : "19.5px"}
          fontWeight="500"
          fill={textColor}
          className="select-none pointer-events-none"
        >
          {node.label}
        </text>
      </g>
    );
  };

  const kabir = nodes[0];
  const injury = nodes[1];
  const item = nodes[2];
  const rule = nodes[3];

  // Geometries for edges
  const edgeKabirInjury = getClippedCurve(kabir, injury, -15);
  const edgeKabirItem = getClippedCurve(kabir, item, 10);
  const edgeItemRule = getClippedCurve(item, rule, -10);
  const edgeContradiction = getClippedCurve(injury, rule, 20);

  return (
    <div className={`relative w-full h-full select-none ${className}`}>
      <svg
        ref={svgRef}
        viewBox="0 0 580 420"
        className="w-full h-full overflow-visible touch-none"
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <defs>
          {/* Node drop shadow */}
          <filter id="node-shadow" x="-15%" y="-15%" width="135%" height="135%">
            <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#3c3728" floodOpacity="0.12" />
          </filter>

          {/* Red contradiction glow */}
          <filter id="red-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#b8402f" floodOpacity="0.5" />
          </filter>
        </defs>

        {/* Graph background grid for craft aesthetic */}
        <pattern id="svg-grid-dots" width="24" height="24" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1" fill="#8aa0b0" fillOpacity="0.25" />
        </pattern>
        <rect width="580" height="420" fill="url(#svg-grid-dots)" opacity={0.6} />

        {/* ============================================================ */}
        {/* EDGES LAYER                                                  */}
        {/* ============================================================ */}

        {/* Edge 1: Kabir -> Right shoulder ("suffered") */}
        {(stage >= 1 || draggable) && (
          <g className="transition-opacity duration-300">
            <path
              d={edgeKabirInjury.path}
              fill="none"
              stroke={
                activeHoverNode === "kabir" || activeHoverNode === "injury" ? "#25282c" : "#8aa0b0"
              }
              strokeWidth={2}
              className="transition-colors duration-200"
            />
            {/* Pill label */}
            <g transform={`translate(${edgeKabirInjury.labelX}, ${edgeKabirInjury.labelY})`}>
              <rect x="-36" y="-10" width="72" height="20" rx="10" fill="#fffefb" stroke="#8aa0b0" strokeWidth="1" />
              <text x="0" y="4" textAnchor="middle" fontSize="13px" fill="#62665f" fontFamily="'Newsreader', serif" fontStyle="italic">
                suffered (0.8)
              </text>
            </g>
          </g>
        )}

        {/* Edge 2: Kabir -> Sniper rifle ("aims") */}
        {(stage >= 2 || draggable) && (
          <g className="transition-opacity duration-300">
            <path
              d={edgeKabirItem.path}
              fill="none"
              stroke={
                activeHoverNode === "kabir" || activeHoverNode === "item" ? "#25282c" : "#8aa0b0"
              }
              strokeWidth={2}
              className="transition-colors duration-200"
            />
            <g transform={`translate(${edgeKabirItem.labelX}, ${edgeKabirItem.labelY})`}>
              <rect x="-24" y="-10" width="48" height="20" rx="10" fill="#fffefb" stroke="#8aa0b0" strokeWidth="1" />
              <text x="0" y="4" textAnchor="middle" fontSize="13px" fill="#62665f" fontFamily="'Newsreader', serif" fontStyle="italic">
                aims
              </text>
            </g>
          </g>
        )}

        {/* Edge 3: Sniper rifle -> Rule ("requires") */}
        {(stage >= 3 || draggable) && (
          <g className="transition-opacity duration-300">
            <path
              d={edgeItemRule.path}
              fill="none"
              stroke={
                activeHoverNode === "item" || activeHoverNode === "rule" ? "#25282c" : "#8aa0b0"
              }
              strokeWidth={2}
              className="transition-colors duration-200"
            />
            <g transform={`translate(${edgeItemRule.labelX}, ${edgeItemRule.labelY})`}>
              <rect x="-28" y="-10" width="56" height="20" rx="10" fill="#fffefb" stroke="#8aa0b0" strokeWidth="1" />
              <text x="0" y="4" textAnchor="middle" fontSize="13px" fill="#62665f" fontFamily="'Newsreader', serif" fontStyle="italic">
                requires
              </text>
            </g>
          </g>
        )}

        {/* Edge 4: CONTRADICTION EDGE (Right shoulder -> Injured Heavy Use) */}
        {(stage >= 4 || draggable) && (
          <g className="transition-opacity duration-300">
            {/* Glowing red underlay */}
            <path
              d={edgeContradiction.path}
              fill="none"
              stroke="#b8402f"
              strokeWidth={4}
              strokeDasharray="6 6"
              className="animate-dash-flow"
              filter="url(#red-glow)"
              opacity={0.4}
            />
            {/* Main traveling red dashed stroke */}
            <path
              d={edgeContradiction.path}
              fill="none"
              stroke="#b8402f"
              strokeWidth={3}
              strokeDasharray="6 6"
              className="animate-dash-flow"
            />
            {/* Conflict Pill Label */}
            <g transform={`translate(${edgeContradiction.labelX}, ${edgeContradiction.labelY})`}>
              <rect
                x="-52"
                y="-12"
                width="104"
                height="24"
                rx="12"
                fill="#b8402f"
                stroke="#fffefb"
                strokeWidth="1.5"
                filter="url(#node-shadow)"
              />
              <text
                x="0"
                y="4.5"
                textAnchor="middle"
                fontSize="12px"
                fontWeight="bold"
                fill="#ffffff"
                fontFamily="system-ui, sans-serif"
                letterSpacing="0.5px"
              >
                CONTRADICTION
              </text>
            </g>
          </g>
        )}

        {/* ============================================================ */}
        {/* NODES LAYER                                                  */}
        {/* ============================================================ */}
        {nodes.map((node, idx) => renderNode(node, idx))}
      </svg>
    </div>
  );
};
