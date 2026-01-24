/**
 * Utility function to play beep sound for POS system
 * Uses Browser Audio API to play a short beep sound
 */
export function playBeep() {
  try {
    const audio = new Audio("/sounds/beep.mp3");
    audio.volume = 0.6;
    audio.play().catch(() => {
      // Silently handle play errors (e.g., user interaction required, file not found)
    });
  } catch (error) {
    // Silently handle Audio creation errors
  }
}

/**
 * Utility function to play out-of-stock alert sound
 * Uses Browser Audio API to play a warning tone when product is out of stock
 */
export function playOutOfStockBeep() {
  try {
    const audio = new Audio("/sounds/out-of-stock.mp3");
    audio.volume = 0.7;
    audio.play().catch(() => {
      // Silently handle play errors (e.g., user interaction required, file not found)
    });
  } catch (error) {
    // Silently handle Audio creation errors
  }
}
