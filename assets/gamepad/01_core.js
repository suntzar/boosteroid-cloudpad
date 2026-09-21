  // --- CORE: Anti-detecção e Estado do Gamepad ---
  try {
    Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 0 });
    Object.defineProperty(navigator, 'msMaxTouchPoints', { get: () => 0 });
  } catch (e) {}

  // 🚀 INTERCEPTAÇÃO DA ÁREA DE TRANSFERÊNCIA (CLIPBOARD) 🚀
  // Contorna a restrição do WebView injetando o texto lido nativamente pelo Java
  if (window.AndroidClipboard) {
    try {
      const nativeClipboard = {
        readText: async () => window.AndroidClipboard.getClipboardText(),
        writeText: async () => {} // Ignora envios indesejados
      };
      
      // Tenta sobrescrever a API inteira
      Object.defineProperty(navigator, 'clipboard', {
        value: nativeClipboard,
        configurable: true
      });
    } catch(e) {
      // Fallback caso o navegador proíba sobrescrever o objeto raiz
      if (navigator.clipboard) {
        navigator.clipboard.readText = async () => window.AndroidClipboard.getClipboardText();
      }
    }
  }

  let isGamepadEnabled = true;
  let isEditMode = false;

  const virtualGamepad = {
    id: "Xbox 360 Controller (XInput STANDARD GAMEPAD)",
    index: 0, connected: true, timestamp: performance.now(), mapping: "standard",
    axes: [0.0, 0.0, 0.0, 0.0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0.0 }))
  };

  const GP = {
    A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7,
    SELECT: 8, START: 9, L3: 10, R3: 11, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15, HOME: 16
  };

  navigator.getGamepads = function () {
    if (!isGamepadEnabled) return [null, null, null, null];
    virtualGamepad.timestamp = performance.now();
    return [virtualGamepad, null, null, null];
  };

  function notifyConnected() {
    virtualGamepad.connected = true;
    try { window.dispatchEvent(new GamepadEvent('gamepadconnected', { gamepad: virtualGamepad })); } 
    catch (e) { let ev = new Event('gamepadconnected'); ev.gamepad = virtualGamepad; window.dispatchEvent(ev); }
  }

  function notifyDisconnected() {
    virtualGamepad.connected = false;
    try { window.dispatchEvent(new GamepadEvent('gamepaddisconnected', { gamepad: virtualGamepad })); } 
    catch (e) { let ev = new Event('gamepaddisconnected'); ev.gamepad = virtualGamepad; window.dispatchEvent(ev); }
  }

  function resetInputs() {
    virtualGamepad.axes = [0.0, 0.0, 0.0, 0.0];
    virtualGamepad.buttons.forEach(b => { b.pressed = false; b.value = 0.0; });
  }
