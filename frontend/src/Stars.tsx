import { useEffect, useRef, useState } from "react";

export type Match = {
  index: number;
  leading: string;
  assigned: { file: string; index: number; leading: string; score: number }[];
};

function clip(text: string, max = 42) {
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

function at(svg: SVGSVGElement, e: { clientX: number; clientY: number }) {
  const p = svg.createSVGPoint();
  p.x = e.clientX;
  p.y = e.clientY;
  return p.matrixTransform(svg.getScreenCTM()!.inverse());
}

function Star({ group }: { group: Match }) {
  const size = 420;
  const cx = size / 2;
  const cy = size / 2;
  const radius = 150;
  const leaves = group.assigned;
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<number | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pts, setPts] = useState(() => {
    const nodes = [{ x: cx, y: cy }];
    for (let i = 0; i < leaves.length; i++) {
      const angle = (2 * Math.PI * i) / Math.max(leaves.length, 1) - Math.PI / 2;
      nodes.push({ x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) });
    }
    return nodes;
  });

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setZoom((z) => Math.min(2.5, Math.max(0.6, z * (e.deltaY < 0 ? 1.12 : 1 / 1.12))));
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, []);

  function grab(index: number, e: React.PointerEvent<SVGCircleElement>) {
    e.preventDefault();
    drag.current = index;
    svgRef.current?.setPointerCapture(e.pointerId);
  }

  const center = pts[0];

  return (
    <svg
      ref={svgRef}
      width={size * zoom}
      height={size * zoom}
      viewBox={`0 0 ${size} ${size}`}
      onPointerMove={(e) => {
        if (drag.current === null || !svgRef.current) return;
        const p = at(svgRef.current, e);
        const i = drag.current;
        setPts((nodes) => nodes.map((pt, j) => (j === i ? p : pt)));
      }}
      onPointerUp={() => {
        drag.current = null;
      }}
    >
      {leaves.map((item, i) => {
        const p = pts[i + 1];
        return (
          <g key={`${item.file}-${item.index}`}>
            <line x1={center.x} y1={center.y} x2={p.x} y2={p.y} stroke="#000" />
            <text x={(center.x + p.x) / 2} y={(center.y + p.y) / 2} fontSize="11" textAnchor="middle">
              {item.score.toFixed(3)}
            </text>
            <circle cx={p.x} cy={p.y} r="8" onPointerDown={(e) => grab(i + 1, e)}>
              <title>{item.leading}</title>
            </circle>
            <text x={p.x} y={p.y + 18} fontSize="10" textAnchor="middle">
              {clip(`${item.file} #${item.index}`)}
            </text>
          </g>
        );
      })}
      <circle cx={center.x} cy={center.y} r="10" onPointerDown={(e) => grab(0, e)}>
        <title>{group.leading}</title>
      </circle>
      <text x={center.x} y={center.y - 16} fontSize="11" textAnchor="middle">
        {clip(`#${group.index} ${group.leading}`)}
      </text>
    </svg>
  );
}

export default function Stars({ matches }: { matches: Match[] }) {
  return matches
    .filter((group) => group.assigned.length > 0)
    .map((group) => <Star key={group.index} group={group} />);
}
