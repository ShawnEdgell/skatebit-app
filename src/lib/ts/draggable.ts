// src/lib/actions/draggable.ts
export function draggable(node: HTMLElement) {
  let isDragging = false;
  let startX = 0;
  let scrollLeft = 0;

  function pointerDown(e: PointerEvent) {
    // Allow buttons OR anchor tags (or interactive elements) to intercept events
    // Check for both 'button' and 'a' tags
    if ((e.target as HTMLElement).closest("button, a")) {
      // <--- MODIFIED HERE
      return; // Let the button or link handle its own click
    }

    // Only prevent default and start dragging if the target wasn't interactive
    e.preventDefault();
    isDragging = true;
    node.style.cursor = "grabbing";
    node.style.userSelect = "none"; // Good practice to prevent text selection during drag
    node.setPointerCapture(e.pointerId);
    startX = e.clientX - node.offsetLeft;
    scrollLeft = node.scrollLeft;
  }

  function pointerMove(e: PointerEvent) {
    if (!isDragging) return;
    e.preventDefault(); // Prevent default during move to avoid scrolling page etc.
    const x = e.clientX - node.offsetLeft;
    node.scrollLeft = scrollLeft - (x - startX) * 1.5; // Adjust multiplier as needed
  }

  function pointerUp(e: PointerEvent) {
    if (!isDragging) return;
    isDragging = false;
    node.style.cursor = "grab";
    node.style.userSelect = ""; // Restore user select
    node.releasePointerCapture(e.pointerId);
  }

  // Initial cursor style
  node.style.cursor = "grab";

  node.addEventListener("pointerdown", pointerDown);
  node.addEventListener("pointermove", pointerMove);
  node.addEventListener("pointerup", pointerUp);
  node.addEventListener("pointercancel", pointerUp); // Handle cancellation (e.g., focus lost)

  return {
    destroy() {
      node.removeEventListener("pointerdown", pointerDown);
      node.removeEventListener("pointermove", pointerMove);
      node.removeEventListener("pointerup", pointerUp);
      node.removeEventListener("pointercancel", pointerUp);
      node.style.cursor = ""; // Clean up style
      node.style.userSelect = "";
    },
  };
}
