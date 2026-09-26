  // --- INPUT: Analógicos, Botões Digitais e Emulação de Teclado Avançada ---
  
  function simulateKey(eventName, key, code, keyCode, shiftKey) {
    const target = document.querySelector('video, canvas, #game-stream, .stream-container') || document.body;
    
    const event = new KeyboardEvent(eventName, {
      key: key, code: code, keyCode: keyCode, which: keyCode,
      shiftKey: shiftKey, bubbles: true, cancelable: true, composed: true
    });
    
    Object.defineProperties(event, {
      keyCode: { get: () => keyCode },
      which: { get: () => keyCode }
    });
    
    target.dispatchEvent(event);
  }

  function setupStick(zoneId, baseId, knobId, axisX, axisY) {
    const zone = document.getElementById(zoneId); const base = document.getElementById(baseId); const knob = document.getElementById(knobId);
    const MAX_RADIUS = 45; let touchId = null; let originX = 0, originY = 0;

    function park() { base.style.left = '50%'; base.style.top = '50%'; base.style.transform = 'translate(-50%, -50%)'; knob.style.transform = 'translate(-50%, -50%)'; }
    park();

    zone.addEventListener('touchstart', (e) => {
      if (!isGamepadEnabled || isEditMode) return; silenceEvent(e); if (touchId !== null) return;
      const touch = e.changedTouches[0]; touchId = touch.identifier; originX = touch.clientX; originY = touch.clientY;
      const rect = zone.getBoundingClientRect();
      base.style.left = `${originX - rect.left}px`; base.style.top = `${originY - rect.top}px`;
      knob.style.transform = `translate(-50%, -50%)`;
    }, { passive: false, capture: true });

    zone.addEventListener('touchmove', (e) => {
      if (!isGamepadEnabled || isEditMode) return; silenceEvent(e);
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === touchId) {
          let dx = e.changedTouches[i].clientX - originX; let dy = e.changedTouches[i].clientY - originY;
          const dist = Math.hypot(dx, dy);
          if (dist > MAX_RADIUS) { dx = (dx/dist)*MAX_RADIUS; dy = (dy/dist)*MAX_RADIUS; }
          knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
          virtualGamepad.axes[axisX] = parseFloat((dx / MAX_RADIUS).toFixed(3)); virtualGamepad.axes[axisY] = parseFloat((dy / MAX_RADIUS).toFixed(3));
          break;
        }
      }
    }, { passive: false, capture: true });

    const reset = (e) => {
      if (!isGamepadEnabled || isEditMode) return; silenceEvent(e);
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === touchId) { touchId = null; park(); virtualGamepad.axes[axisX] = 0.0; virtualGamepad.axes[axisY] = 0.0; break; }
      }
    };
    zone.addEventListener('touchend', reset, { passive: false, capture: true });
    zone.addEventListener('touchcancel', reset, { passive: false, capture: true });
  }

  function bindBtn(id, gpIndex) {
    const el = document.getElementById(id); if (!el) return;
    const setBtn = (pressed) => {
      if (!isGamepadEnabled || isEditMode) return;

      // Interceptação do Botão Home (Virtual)
      if (gpIndex === GP.HOME && homeIsSteam) {
        if (pressed) {
          simulateKey('keydown', 'Shift', 'ShiftLeft', 16, true);
          simulateKey('keydown', 'Tab', 'Tab', 9, true);
        } else {
          simulateKey('keyup', 'Tab', 'Tab', 9, true);
          simulateKey('keyup', 'Shift', 'ShiftLeft', 16, false);
        }
      } else {
        virtualGamepad.buttons[gpIndex].pressed = pressed; 
        virtualGamepad.buttons[gpIndex].value = pressed ? 1.0 : 0.0;
      }

      if (pressed) el.classList.add('active-press'); else el.classList.remove('active-press');
    };

    el.addEventListener('touchstart', (e) => { if(!isEditMode){ silenceEvent(e); setBtn(true); } }, { passive: false, capture: true });
    el.addEventListener('touchend', (e) => { if(!isEditMode){ silenceEvent(e); setBtn(false); } }, { passive: false, capture: true });
    el.addEventListener('touchcancel', (e) => { if(!isEditMode){ silenceEvent(e); setBtn(false); } }, { passive: false, capture: true });
  }

  // 🚀 VIGILANTE DE HARDWARE REAL: Escuta o Controle Físico a 60FPS 🚀
  const lastPhysicalHomeStates = [false, false, false, false];

  function pollPhysicalGamepads() {
    const physicalPads = nativeGetGamepads() || [];
    for (let i = 0; i < 4; i++) {
      const pad = physicalPads[i];
      if (pad && pad.buttons && pad.buttons.length > 16) {
        const isPressed = pad.buttons[16].pressed;
        if (isPressed !== lastPhysicalHomeStates[i]) {
          lastPhysicalHomeStates[i] = isPressed;
          
          // Se "Teclado Mágico" estiver ativo, injeta Shift+Tab no lugar!
          if (homeIsSteam) {
            if (isPressed) {
              simulateKey('keydown', 'Shift', 'ShiftLeft', 16, true);
              simulateKey('keydown', 'Tab', 'Tab', 9, true);
            } else {
              simulateKey('keyup', 'Tab', 'Tab', 9, true);
              simulateKey('keyup', 'Shift', 'ShiftLeft', 16, false);
            }
          }
        }
      }
    }
    requestAnimationFrame(pollPhysicalGamepads);
  }

  function initInputs() {
    setupStick('vpad-el-touch-l', 'vpad-stick-base-l', 'vpad-stick-knob-l', 0, 1);
    setupStick('vpad-el-touch-r', 'vpad-stick-base-r', 'vpad-stick-knob-r', 2, 3);
    
    bindBtn('vpad-btn-a', GP.A); bindBtn('vpad-btn-b', GP.B); bindBtn('vpad-btn-x', GP.X); bindBtn('vpad-btn-y', GP.Y);
    bindBtn('vpad-btn-up', GP.UP); bindBtn('vpad-btn-down', GP.DOWN); bindBtn('vpad-btn-left', GP.LEFT); bindBtn('vpad-btn-right', GP.RIGHT);
    bindBtn('vpad-btn-lt', GP.LT); bindBtn('vpad-btn-rt', GP.RT); bindBtn('vpad-btn-lb', GP.LB); bindBtn('vpad-btn-rb', GP.RB);
    bindBtn('vpad-btn-select', GP.SELECT); bindBtn('vpad-btn-home', GP.HOME); bindBtn('vpad-btn-start', GP.START);
    bindBtn('vpad-btn-l3', GP.L3); bindBtn('vpad-btn-r3', GP.R3);

    // Inicia a escuta infinita dos gamepads USB/Bluetooth
    pollPhysicalGamepads();
  }
