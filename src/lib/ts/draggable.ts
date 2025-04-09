// src/lib/actions/draggable.ts
export function draggable(node: HTMLElement) {
  let isDragging = false;
  let startX = 0;
  let scrollLeft = 0;

  function pointerDown(e: PointerEvent) {
    // Allow buttons (or interactive elements) to intercept events
    if ((e.target as HTMLElement).closest("button")) return;
    e.preventDefault();
    isDragging = true;
    node.style.cursor = "grabbing";
    node.setPointerCapture(e.pointerId);
    startX = e.clientX - node.offsetLeft;
    scrollLeft = node.scrollLeft;
  }

  function pointerMove(e: PointerEvent) {
    if (!isDragging) return;
    e.preventDefault();
    const x = e.clientX - node.offsetLeft;
    node.scrollLeft = scrollLeft - (x - startX) * 1.5;
  }

  function pointerUp(e: PointerEvent) {
    if (!isDragging) return;
    isDragging = false;
    node.style.cursor = "grab";
    node.releasePointerCapture(e.pointerId);
  }

  node.addEventListener("pointerdown", pointerDown);
  node.addEventListener("pointermove", pointerMove);
  node.addEventListener("pointerup", pointerUp);
  node.addEventListener("pointercancel", pointerUp);

  return {
    destroy() {
      node.removeEventListener("pointerdown", pointerDown);
      node.removeEventListener("pointermove", pointerMove);
      node.removeEventListener("pointerup", pointerUp);
      node.removeEventListener("pointercancel", pointerUp);
    },
  };
}
