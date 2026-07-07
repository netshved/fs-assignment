import { Point } from '../../models';

export function getCenter(points: Point[]): Point {
  const x = points.reduce((sum, p) => sum + p.x, 0) / points.length;
  const y = points.reduce((sum, p) => sum + p.y, 0) / points.length;
  return { x, y };
}

export function rotatePoints(points: Point[], center: Point, angle: number): Point[] {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return points.map((p) => {
    const dx = p.x - center.x;
    const dy = p.y - center.y;
    return {
      x: center.x + dx * cos - dy * sin,
      y: center.y + dx * sin + dy * cos,
    };
  });
}

export function translatePoints(points: Point[], dx: number, dy: number): Point[] {
  return points.map((p) => ({ x: p.x + dx, y: p.y + dy }));
}

export function scalePoints(points: Point[], scaleX: number, scaleY: number): Point[] {
  return points.map((p) => ({ x: p.x * scaleX, y: p.y * scaleY }));
}

/** Ray-casting point-in-polygon test. */
export function pointInPolygon(point: Point, polygon: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    if (yi > point.y !== yj > point.y && point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

export function toRelative(points: Point[], width: number, height: number): Point[] {
  return scalePoints(points, 1 / Math.max(width, 1), 1 / Math.max(height, 1));
}

export function toAbsolute(points: Point[], width: number, height: number): Point[] {
  return scalePoints(points, Math.max(width, 1), Math.max(height, 1));
}
