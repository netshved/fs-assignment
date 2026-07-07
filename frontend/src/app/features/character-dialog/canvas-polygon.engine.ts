import { Point, PolygonData } from '../../models';
import {
  getCenter,
  pointInPolygon,
  rotatePoints,
  scalePoints,
  toAbsolute,
  toRelative,
  translatePoints,
} from './polygon-geometry';

export type EngineMode = 'draw' | 'select' | 'rotate';

const CLOSE_DISTANCE_PX = 10;

/**
 * Owns polygon state in absolute canvas pixels; persists via relative (0..1)
 * coordinates so polygons keep their ratio when the image is resized.
 */
export class CanvasPolygonEngine {
  private readonly ctx: CanvasRenderingContext2D;
  private displayWidth = 0;
  private displayHeight = 0;
  private pixelRatio = 1;
  private polygons: PolygonData[] = [];
  private currentPoints: Point[] = [];
  private selectedPolygonId: string | null = null;
  private dragOffset: Point | null = null;
  private isDragging = false;
  private isRotating = false;
  private rotateStartAngle = 0;
  private mode: EngineMode = 'draw';

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly onCommit: () => void,
  ) {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas 2D context is not available');
    }
    this.ctx = ctx;
  }

  setSize(width: number, height: number) {
    this.displayWidth = width;
    this.displayHeight = height;
    this.pixelRatio = window.devicePixelRatio || 1;
    this.canvas.width = Math.round(width * this.pixelRatio);
    this.canvas.height = Math.round(height * this.pixelRatio);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.ctx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
    this.redraw();
  }

  loadPolygons(polygons: PolygonData[]) {
    const width = this.displayWidth || this.canvas.clientWidth;
    const height = this.displayHeight || this.canvas.clientHeight;
    this.polygons = polygons.map((p) => ({
      ...p,
      points: toAbsolute(p.points, width, height),
    }));
    this.redraw();
  }

  getPolygons(): PolygonData[] {
    const width = this.displayWidth || this.canvas.clientWidth;
    const height = this.displayHeight || this.canvas.clientHeight;
    return this.polygons.map((p) => ({
      ...p,
      points: toRelative(p.points, width, height),
    }));
  }

  setMode(mode: EngineMode) {
    this.mode = mode;
    this.currentPoints = [];
    if (mode === 'draw') {
      this.selectedPolygonId = null;
    }
    this.redraw();
  }

  hasSelection(): boolean {
    return this.selectedPolygonId !== null;
  }

  hasCurrentDrawing(): boolean {
    return this.currentPoints.length > 0;
  }

  polygonCount(): number {
    return this.polygons.length;
  }

  handleClick(x: number, y: number) {
    if (this.mode !== 'draw') return;
    if (this.currentPoints.length >= 3) {
      const first = this.currentPoints[0];
      if (Math.hypot(x - first.x, y - first.y) < CLOSE_DISTANCE_PX) {
        this.closePolygon();
        return;
      }
    }
    this.currentPoints.push({ x, y });
    this.redraw();
  }

  handleMouseDown(x: number, y: number) {
    if (this.mode === 'select') {
      const poly = this.findPolygonAt(x, y);
      this.selectedPolygonId = poly?.id ?? null;
      if (poly) {
        this.isDragging = true;
        const center = getCenter(poly.points);
        this.dragOffset = { x: x - center.x, y: y - center.y };
      }
      this.redraw();
      return;
    }

    if (this.mode === 'rotate') {
      const poly = this.findPolygonAt(x, y) ?? this.selectedPolygon();
      if (!poly) return;
      this.selectedPolygonId = poly.id;
      const center = getCenter(poly.points);
      this.isRotating = true;
      this.rotateStartAngle = Math.atan2(y - center.y, x - center.x);
      this.redraw();
    }
  }

  handleMouseMove(x: number, y: number) {
    if (this.isDragging) {
      const poly = this.selectedPolygon();
      if (poly && this.dragOffset) {
        const center = getCenter(poly.points);
        const dx = x - this.dragOffset.x - center.x;
        const dy = y - this.dragOffset.y - center.y;
        poly.points = translatePoints(poly.points, dx, dy);
        this.redraw();
      }
      return;
    }

    if (this.isRotating) {
      const poly = this.selectedPolygon();
      if (poly) {
        const center = getCenter(poly.points);
        const angle = Math.atan2(y - center.y, x - center.x);
        poly.points = rotatePoints(poly.points, center, angle - this.rotateStartAngle);
        this.rotateStartAngle = angle;
        this.redraw();
      }
    }
  }

  /** Ends a drag/rotate gesture; commits once per gesture instead of per mousemove. */
  handleMouseUp() {
    const interacted = this.isDragging || this.isRotating;
    this.isDragging = false;
    this.isRotating = false;
    this.dragOffset = null;
    if (interacted) {
      this.onCommit();
    }
  }

  deleteSelected() {
    if (!this.selectedPolygonId) return;
    this.polygons = this.polygons.filter((p) => p.id !== this.selectedPolygonId);
    this.selectedPolygonId = null;
    this.redraw();
    this.onCommit();
  }

  clearCurrent() {
    this.currentPoints = [];
    this.redraw();
  }

  resize(newWidth: number, newHeight: number) {
    const scaleX = newWidth / Math.max(this.displayWidth, 1);
    const scaleY = newHeight / Math.max(this.displayHeight, 1);
    this.polygons = this.polygons.map((p) => ({
      ...p,
      points: scalePoints(p.points, scaleX, scaleY),
    }));
    this.currentPoints = scalePoints(this.currentPoints, scaleX, scaleY);
    this.setSize(newWidth, newHeight);
  }

  getDisplayWidth(): number {
    return this.displayWidth;
  }

  getDisplayHeight(): number {
    return this.displayHeight;
  }

  private selectedPolygon(): PolygonData | undefined {
    return this.polygons.find((p) => p.id === this.selectedPolygonId);
  }

  private closePolygon() {
    this.polygons.push({
      id: `poly-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      points: [...this.currentPoints],
    });
    this.currentPoints = [];
    this.redraw();
    this.onCommit();
  }

  private findPolygonAt(x: number, y: number): PolygonData | null {
    for (let i = this.polygons.length - 1; i >= 0; i--) {
      if (pointInPolygon({ x, y }, this.polygons[i].points)) {
        return this.polygons[i];
      }
    }
    return null;
  }

  redraw() {
    const width = this.displayWidth || this.canvas.clientWidth;
    const height = this.displayHeight || this.canvas.clientHeight;
    this.ctx.clearRect(0, 0, width, height);

    for (const poly of this.polygons) {
      this.drawPolygon(poly.points, poly.id === this.selectedPolygonId);
    }

    if (this.currentPoints.length > 0) {
      this.drawPolygon(this.currentPoints, false, true);
      for (const pt of this.currentPoints) {
        this.ctx.beginPath();
        this.ctx.arc(pt.x, pt.y, 5, 0, Math.PI * 2);
        this.ctx.fillStyle = '#f59e0b';
        this.ctx.fill();
      }
    }
  }

  private drawPolygon(points: Point[], selected: boolean, dashed = false) {
    if (points.length < 2) return;
    this.ctx.beginPath();
    this.ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      this.ctx.lineTo(points[i].x, points[i].y);
    }
    if (!dashed) this.ctx.closePath();

    this.ctx.strokeStyle = selected ? '#3b82f6' : '#10b981';
    this.ctx.lineWidth = selected ? 3 : 2;
    if (dashed) this.ctx.setLineDash([5, 5]);
    this.ctx.stroke();
    this.ctx.setLineDash([]);

    this.ctx.fillStyle = selected ? 'rgba(59, 130, 246, 0.2)' : 'rgba(16, 185, 129, 0.15)';
    if (!dashed) this.ctx.fill();

    if (selected) {
      const center = getCenter(points);
      this.ctx.beginPath();
      this.ctx.arc(center.x, center.y, 6, 0, Math.PI * 2);
      this.ctx.fillStyle = '#3b82f6';
      this.ctx.fill();
    }
  }
}
