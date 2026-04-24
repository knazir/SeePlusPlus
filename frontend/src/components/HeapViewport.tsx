import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  type MutableRefObject,
  type ReactNode,
  type RefObject,
} from 'react';
import { useAppStore } from '../store';

const DRAG_THRESHOLD_PX = 4;

/**
 * Clipped viewport with a 2D-pannable world inside it. Wraps the heap canvas
 * so users can drag or scroll to move around structures that don't fit.
 *
 * Pan offset lives in refs and is applied imperatively via style.transform
 * so drags don't trigger React re-renders on every pointer move. EdgeLayer
 * picks up the transform because getBoundingClientRect() reflects it and
 * its MutationObserver sees the inline-style change.
 */

export interface HeapViewportHandle {
  /** Reset pan offset to (0, 0). Used by the "Recenter" button. */
  reset: () => void;
}

interface Props {
  children: ReactNode;
  /**
   * Optional caller-owned ref populated with the viewport DOM element on
   * mount. Lets sibling components (e.g. EdgeLayer's clip-check) reason
   * about what's visible without reaching into HeapViewport.
   */
  elRef?: RefObject<HTMLDivElement | null>;
}

export const HeapViewport = forwardRef<HeapViewportHandle, Props>(function HeapViewport(
  { children, elRef },
  handleRef,
) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const worldRef = useRef<HTMLDivElement | null>(null);
  const offsetRef = useRef({ x: 0, y: 0 });
  const dragRef = useRef<
    | {
        startX: number;
        startY: number;
        startOx: number;
        startOy: number;
        captured: boolean;
        pointerId: number;
      }
    | null
  >(null);

  const trace = useAppStore((s) => s.trace);

  const applyTransform = () => {
    const w = worldRef.current;
    if (w) w.style.transform = `translate(${offsetRef.current.x}px, ${offsetRef.current.y}px)`;
  };

  useImperativeHandle(
    handleRef,
    () => ({
      reset: () => {
        offsetRef.current = { x: 0, y: 0 };
        applyTransform();
      },
    }),
    [],
  );

  // Mirror the viewport element into the caller-owned ref if provided.
  const setViewportRef = (el: HTMLDivElement | null) => {
    viewportRef.current = el;
    if (elRef) (elRef as MutableRefObject<HTMLDivElement | null>).current = el;
  };

  // Recenter on a new run. Keeping pan stable within a run preserves the
  // user's spatial context as they scrub.
  useEffect(() => {
    offsetRef.current = { x: 0, y: 0 };
    applyTransform();
  }, [trace]);

  // React's onWheel is passive, so wheel-to-pan needs a non-passive listener
  // attached through the ref.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      offsetRef.current = {
        x: offsetRef.current.x - e.deltaX,
        y: offsetRef.current.y - e.deltaY,
      };
      applyTransform();
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startOx: offsetRef.current.x,
      startOy: offsetRef.current.y,
      captured: false,
      pointerId: e.pointerId,
    };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.captured) {
      // Below the threshold, stay in "potential click" mode so buttons and
      // hover-chips inside cards still receive their events.
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
      d.captured = true;
      e.currentTarget.setPointerCapture(d.pointerId);
    }
    offsetRef.current = { x: d.startOx + dx, y: d.startOy + dy };
    applyTransform();
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    dragRef.current = null;
    if (d?.captured) {
      try {
        e.currentTarget.releasePointerCapture(d.pointerId);
      } catch {
        // already released — fine
      }
    }
  };

  return (
    <div
      ref={setViewportRef}
      data-testid="heap-viewport"
      className="relative min-h-0 flex-1 cursor-grab touch-none overflow-hidden active:cursor-grabbing"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <div
        ref={worldRef}
        data-testid="heap-world"
        className="absolute left-0 top-0 min-h-full min-w-full px-3 pb-5 pt-2 will-change-transform"
        style={{ transform: 'translate(0px, 0px)' }}
      >
        {children}
      </div>
    </div>
  );
});
