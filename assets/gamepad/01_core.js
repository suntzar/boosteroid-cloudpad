  // --- CORE: Estado do Gamepad e Interceptação Segura ---

  // 🚀 INTERCEPTAÇÃO DA ÁREA DE TRANSFERÊNCIA (CLIPBOARD) 🚀
  if (window.AndroidClipboard) {
    try {
      const nativeClipboard = {
        readText: async () => window.AndroidClipboard.getClipboardText(),
        writeText: async () => {} 
      };
      Object.defineProperty(navigator, 'clipboard', { value: nativeClipboard, configurable: true });
    } catch(e) {
      if (navigator.clipboard) navigator.clipboard.readText = async () => window.AndroidClipboard.getClipboardText();
    }
  }

  let isGamepadEnabled = false;
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

  // 🚀 Salva a função nativa para ler o hardware real
  const nativeGetGamepads = navigator.getGamepads ? navigator.getGamepads.bind(navigator) : () => [];

  navigator.getGamepads = function () {
    const physicalPads = nativeGetGamepads() || [];
    const result = [null, null, null, null];
    
    // 1. Mantém os controles físicos reais, MAS mascara o botão HOME se o Teclado Mágico estiver ativo
    for (let i = 0; i < 4; i++) {
      if (physicalPads[i]) {
        if (homeIsSteam && physicalPads[i].buttons && physicalPads[i].buttons.length > 16) {
          // Cria um clone superficial do gamepad para interceptar e "cegar" o botão 16 para a nuvem
          const clonedButtons = [...physicalPads[i].buttons];
          clonedButtons[16] = { pressed: false, touched: false, value: 0.0 };
          
          result[i] = {
            id: physicalPads[i].id,
            index: physicalPads[i].index,
            connected: physicalPads[i].connected,
            timestamp: physicalPads[i].timestamp,
            mapping: physicalPads[i].mapping,
            axes: physicalPads[i].axes,
            vibrationActuator: physicalPads[i].vibrationActuator,
            buttons: clonedButtons
          };
        } else {
          // Se a opção estiver desligada, repassa o controle 100% puro
          result[i] = physicalPads[i];
        }
      }
    }

    // 2. Injeta o controle virtual apenas no primeiro slot vazio disponível
    if (isGamepadEnabled) {
      virtualGamepad.timestamp = performance.now();
      let emptySlot = result.findIndex(p => p === null);
      if (emptySlot !== -1) {
        virtualGamepad.index = emptySlot;
        result[emptySlot] = virtualGamepad;
      }
    }
    
    return result;
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
