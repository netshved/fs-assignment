import { AfterViewInit, Component, ElementRef, HostListener, Inject, OnDestroy, ViewChild, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Store } from '@ngrx/store';
import { take } from 'rxjs';
import { Character } from '../../models';
import { CanvasPolygonEngine, EngineMode } from './canvas-polygon.engine';
import { PolygonActions } from '../../store/polygon/polygon.actions';
import { selectPolygonsForCharacter } from '../../store';

const FALLBACK_ASPECT_RATIO = 1;

@Component({
  selector: 'app-character-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <div class="dialog-header">
      <div>
        <h2>{{ data.name }}</h2>
        <div class="chips">
          <span class="chip">
            <span class="dot" [class]="statusClass()"></span>{{ data.status }}
          </span>
          <span class="chip">{{ data.species }}</span>
          @if (data.type) {
            <span class="chip">{{ data.type }}</span>
          }
          <span class="chip"><mat-icon>place</mat-icon>{{ data.location.name }}</span>
        </div>
      </div>
      <button mat-icon-button class="close-btn" aria-label="Close dialog" (click)="close()"><mat-icon>close</mat-icon></button>
    </div>
    <div class="toolbar">
      <button mat-stroked-button [class.active]="mode === 'draw'" (click)="setMode('draw')"
              title="Draw a new polygon">
        <mat-icon>edit</mat-icon> Draw
      </button>
      <button mat-stroked-button [class.active]="mode === 'select'" (click)="setMode('select')"
              title="Select and drag a polygon">
        <mat-icon>pan_tool</mat-icon> Move
      </button>
      <button mat-stroked-button [class.active]="mode === 'rotate'" (click)="setMode('rotate')"
              title="Rotate a polygon around its center">
        <mat-icon>rotate_right</mat-icon> Rotate
      </button>
      <button mat-stroked-button class="delete-btn" [disabled]="!hasSelection()" (click)="deleteSelected()"
              title="Delete the selected polygon">
        <mat-icon>delete</mat-icon> Delete
      </button>
    </div>
    <p class="mode-hint">
      <mat-icon>info_outline</mat-icon>
      {{ modeHint }}
    </p>
    <mat-dialog-content class="dialog-body">
      <div class="canvas-container" #container>
        @if (imageFailed) {
          <div class="image-error">
            <mat-icon>broken_image</mat-icon>
            <span>Image failed to load — annotations are still editable</span>
          </div>
        }
        <img
          #imageEl
          [src]="data.image"
          [alt]="data.name"
          (load)="onImageLoad()"
          (error)="onImageError()"
        />
        <canvas #canvasEl
          (click)="onCanvasClick($event)"
          (pointerdown)="onPointerDown($event)"
          (pointermove)="onPointerMove($event)"
          (pointerup)="onPointerUp()"
          (pointerleave)="onPointerUp()"
          (pointercancel)="onPointerUp()"
        ></canvas>
      </div>
    </mat-dialog-content>
  `,
  styles: [`
    :host { display: block; }
    .dialog-header { display: flex; justify-content: space-between; align-items: flex-start; padding: 1rem 1.5rem 0; gap: 1rem; }
    h2 { margin: 0 0 0.5rem; font-size: 1.25rem; color: #f1f5f9; }
    .close-btn { color: #94a3b8; flex-shrink: 0; }
    .chips { display: flex; flex-wrap: wrap; gap: 0.4rem; }
    .chip {
      display: inline-flex; align-items: center; gap: 4px; padding: 2px 10px;
      border-radius: 999px; background: rgba(148, 163, 184, 0.12);
      color: #cbd5e1; font-size: 0.8rem;
    }
    .chip mat-icon { font-size: 14px; width: 14px; height: 14px; color: #64748b; }
    .dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
    .dot.alive { background: #22c55e; }
    .dot.dead { background: #ef4444; }
    .dot.unknown { background: #64748b; }
    .toolbar { display: flex; gap: 0.5rem; padding: 1rem 1.5rem 0.25rem; flex-wrap: wrap; }
    .toolbar button {
      --mdc-outlined-button-outline-color: #334155;
      --mdc-outlined-button-label-text-color: #cbd5e1;
    }
    .toolbar button.active {
      background: rgba(59, 130, 246, 0.2);
      --mdc-outlined-button-outline-color: #3b82f6;
      --mdc-outlined-button-label-text-color: #93c5fd;
    }
    .toolbar .delete-btn:not([disabled]) {
      --mdc-outlined-button-outline-color: rgba(239, 68, 68, 0.4);
      --mdc-outlined-button-label-text-color: #f87171;
    }
    .mode-hint {
      display: flex; align-items: center; gap: 0.4rem; margin: 0;
      padding: 0.25rem 1.5rem 0.75rem; font-size: 0.8rem; color: #64748b;
    }
    .mode-hint mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .dialog-body { max-height: calc(95vh - 230px); overflow-y: auto; padding: 0 1.5rem 1.5rem; margin: 0; }
    .canvas-container { position: relative; border-radius: 12px; overflow: hidden; background: #1e293b; }
    img { display: block; width: 100%; max-height: 70vh; object-fit: contain; visibility: hidden; }
    canvas { position: absolute; inset: 0; width: 100%; height: 100%; cursor: crosshair; touch-action: none; }
    .image-error {
      position: absolute; inset: 0; display: flex; flex-direction: column; gap: 0.5rem;
      align-items: center; justify-content: center; color: #94a3b8; font-size: 0.9rem;
    }
  `],
})
export class CharacterDialogComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvasEl') canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('imageEl') imageRef!: ElementRef<HTMLImageElement>;
  @ViewChild('container') containerRef!: ElementRef<HTMLDivElement>;

  private store = inject(Store);
  private dialogRef = inject(MatDialogRef<CharacterDialogComponent>);
  private engine?: CanvasPolygonEngine;
  private resizeObserver?: ResizeObserver;
  mode: EngineMode = 'draw';
  imageFailed = false;

  constructor(@Inject(MAT_DIALOG_DATA) public data: Character) {
    // The dialog opens with disableClose so Esc can cancel an in-progress
    // polygon; backdrop clicks should still close it as usual.
    this.dialogRef.backdropClick().subscribe(() => this.dialogRef.close());
  }

  /** Esc cancels an unfinished polygon first; a second Esc closes the dialog. */
  @HostListener('document:keydown.escape')
  onEscape() {
    if (this.engine?.hasCurrentDrawing()) {
      this.engine.clearCurrent();
    } else {
      this.dialogRef.close();
    }
  }

  get modeHint(): string {
    switch (this.mode) {
      case 'draw':
        return 'Click to place points; click the first point again to close the polygon. Esc cancels an unfinished polygon.';
      case 'select':
        return 'Click a polygon to select it, then drag to move it.';
      case 'rotate':
        return 'Press and drag inside a polygon to rotate it around its center.';
    }
  }

  statusClass(): 'alive' | 'dead' | 'unknown' {
    const status = this.data.status.toLowerCase();
    return status === 'alive' || status === 'dead' ? status : 'unknown';
  }

  hasSelection(): boolean {
    return this.engine?.hasSelection() ?? false;
  }

  ngAfterViewInit() {
    this.engine = new CanvasPolygonEngine(this.canvasRef.nativeElement, () => this.persist());
    this.syncCanvasSize();
    this.store
      .select(selectPolygonsForCharacter(this.data.id))
      .pipe(take(1))
      .subscribe((polygons) => this.engine?.loadPolygons(polygons));

    this.resizeObserver = new ResizeObserver(() => this.syncCanvasSize());
    this.resizeObserver.observe(this.containerRef.nativeElement);
  }

  ngOnDestroy() {
    this.resizeObserver?.disconnect();
  }

  onImageLoad() {
    this.imageFailed = false;
    this.syncCanvasSize();
  }

  onImageError() {
    this.imageFailed = true;
    this.syncCanvasSize();
  }

  syncCanvasSize() {
    if (!this.engine) return;
    const container = this.containerRef.nativeElement;
    const img = this.imageRef.nativeElement;
    img.style.visibility = this.imageFailed ? 'hidden' : 'visible';

    let width = img.clientWidth;
    let height = img.clientHeight;

    if (width === 0 || height === 0) {
      width = container.clientWidth;
      if (width === 0) return;
      height = Math.round(
        img.naturalWidth > 0 ? (img.naturalHeight / img.naturalWidth) * width : FALLBACK_ASPECT_RATIO * width,
      );
      container.style.height = `${height}px`;
    } else {
      container.style.height = `${height}px`;
    }

    if (width !== this.engine.getDisplayWidth() || height !== this.engine.getDisplayHeight()) {
      this.engine.resize(width, height);
    }
  }

  setMode(mode: EngineMode) {
    this.mode = mode;
    this.engine?.setMode(mode);
  }

  onCanvasClick(event: MouseEvent) {
    const point = this.point(event);
    this.engine?.handleClick(point.x, point.y);
  }

  onPointerDown(event: PointerEvent) {
    this.canvasRef.nativeElement.setPointerCapture(event.pointerId);
    const point = this.point(event);
    this.engine?.handleMouseDown(point.x, point.y);
  }

  onPointerMove(event: PointerEvent) {
    const point = this.point(event);
    this.engine?.handleMouseMove(point.x, point.y);
  }

  onPointerUp() {
    this.engine?.handleMouseUp();
  }

  deleteSelected() {
    this.engine?.deleteSelected();
  }

  close() {
    this.dialogRef.close();
  }

  /** Commits polygons to the store once per finished gesture (draw/drag/rotate/delete). */
  private persist() {
    if (!this.engine) return;
    this.store.dispatch(
      PolygonActions.saveForCharacter({
        characterId: this.data.id,
        polygons: this.engine.getPolygons(),
      }),
    );
  }

  private point(event: MouseEvent | PointerEvent) {
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }
}
