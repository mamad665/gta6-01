// Keyboard + mouse input. Tracks held keys and edge-triggered presses.

export function createInput() {
  const keys = {};
  const pressed = new Set();
  const mouse = { x: 0, y: 0, down: false, clicked: false };

  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
    if (!keys[k]) pressed.add(k);
    keys[k] = true;
  });
  window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });
  window.addEventListener('blur', () => { for (const k of Object.keys(keys)) keys[k] = false; });
  window.addEventListener('mousemove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; });
  window.addEventListener('mousedown', (e) => { if (e.button === 0) { mouse.down = true; mouse.clicked = true; } });
  window.addEventListener('mouseup', (e) => { if (e.button === 0) mouse.down = false; });

  return {
    held(k) { return !!keys[k]; },
    axis() {
      let x = 0, y = 0;
      if (keys['a'] || keys['arrowleft']) x -= 1;
      if (keys['d'] || keys['arrowright']) x += 1;
      if (keys['w'] || keys['arrowup']) y -= 1;
      if (keys['s'] || keys['arrowdown']) y += 1;
      return { x, y };
    },
    wasPressed(k) { return pressed.has(k); },
    mouse,
    endFrame() { pressed.clear(); mouse.clicked = false; },
  };
}
