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

  // 🚀 Salva a função nativa para ler o hardware real sem ser bloqueado
  const nativeGetGamepads = navigator.getGamepads ? navigator.getGamepads.bind(navigator) : () => [];
  
  // 🚀 CACHE DE IDENTIDADE: Mantém o controle mascarado vivo sem recriar objetos a cada frame
  const physicalPadsWrapper = [null, null, null, null];

  navigator.getGamepads = function () {
    const physicalPads = nativeGetGamepads() || [];
    const result = [null, null, null, null];
    
    // 1. Processa os controles físicos
    for (let i = 0; i < 4; i++) {
      const pad = physicalPads[i];
      if (pad) {
        if (homeIsSteam && pad.buttons && pad.buttons.length > 16) {
          
          // Se o Wrapper ainda não existe, cria herdando o DNA original do Gamepad (evita bloqueio por instanceof)
          if (!physicalPadsWrapper[i]) {
            physicalPadsWrapper[i] = Object.create(Object.getPrototypeOf(pad));
          }
          const wrapper = physicalPadsWrapper[i];
          
          // Atualiza as propriedades dinâmicas sem perder a referência da memória
          wrapper.id = pad.id;
          wrapper.index = pad.index;
          wrapper.connected = pad.connected;
          wrapper.timestamp = pad.timestamp;
          wrapper.mapping = pad.mapping;
          wrapper.axes = pad.axes;
          wrapper.vibrationActuator = pad.vibrationActuator;
          
          // Copia e mascara APENAS o botão 16 (HOME)
          const newButtons = new Array(pad.buttons.length);
          for (let b = 0; b < pad.buttons.length; b++) {
            if (b === 16) {
              newButtons[b] = { pressed: false, touched: false, value: 0.0 };
            } else {
              newButtons[b] = pad.buttons[b];
            }
          }
          wrapper.buttons = newButtons;
          result[i] = wrapper;

        } else {
          // Se a opção Shift+Tab for desligada, entrega o controle físico puramente e limpa o cache
          result[i] = pad;
          physicalPadsWrapper[i] = null;
        }
      } else {
        physicalPadsWrapper[i] = null;
      }
    }

    // 2. Injeta o controle virtual no primeiro slot vazio disponível
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
