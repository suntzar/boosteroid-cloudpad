// ==UserScript==
// @name         Virtual Gamepad API (XInput Completo)
// @namespace    http://tampermonkey.net/
// @version      4.0
// @description  Emula controle XInput 100% completo com Dual Sticks, D-Pad, Gatilhos e Bumpers
// @match        *://*/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  if (window.self !== window.top && !document.querySelector('canvas, video')) return;

  // Camuflagem anti-controle nativo
  try {
    Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 0 });
    Object.defineProperty(navigator, 'msMaxTouchPoints', { get: () => 0 });
  } catch (e) {}

  let isGamepadEnabled = true;

  const virtualGamepad = {
    id: "Xbox 360 Controller (XInput STANDARD GAMEPAD)",
    index: 0,
    connected: true,
    timestamp: performance.now(),
    mapping: "standard",
    axes: [0.0, 0.0, 0.0, 0.0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0.0 }))
  };

  const GP = {
    A: 0, B: 1, X: 2, Y: 3,
    LB: 4, RB: 5, LT: 6, RT: 7,
    SELECT: 8, START: 9,
    L3: 10, R3: 11,
    UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15,
    HOME: 16
  };

  navigator.getGamepads = function () {
    if (!isGamepadEnabled) return [null, null, null, null];
    virtualGamepad.timestamp = performance.now();
    return [virtualGamepad, null, null, null];
  };

  function notifyConnected() {
    virtualGamepad.connected = true;
    let event;
    try { event = new GamepadEvent('gamepadconnected', { gamepad: virtualGamepad }); } 
    catch (e) { event = new Event('gamepadconnected'); event.gamepad = virtualGamepad; }
    window.dispatchEvent(event);
  }

  function notifyDisconnected() {
    virtualGamepad.connected = false;
    let event;
    try { event = new GamepadEvent('gamepaddisconnected', { gamepad: virtualGamepad }); } 
    catch (e) { event = new Event('gamepaddisconnected'); event.gamepad = virtualGamepad; }
    window.dispatchEvent(event);
  }

  function resetInputs() {
    virtualGamepad.axes = [0.0, 0.0, 0.0, 0.0];
    virtualGamepad.buttons.forEach(b => {
      b.pressed = false;
      b.value = 0.0;
    });
  }

  function silenceEvent(e) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
  }

  function initUI() {
    if (document.getElementById('vpad-root')) return;

    const style = document.createElement('style');
    style.textContent = `
      #vpad-root {
        position: fixed; inset: 0; z-index: 2147483647;
        pointer-events: none; user-select: none; -webkit-user-select: none;
        touch-action: none; overflow: hidden; font-family: sans-serif;
      }
      .vpad-hidden { display: none !important; }

      /* Top Bar */
      #vpad-top-bar {
        position: absolute; top: calc(10px + env(safe-area-inset-top)); left: 50%;
        transform: translateX(-50%); display: flex; gap: 10px; pointer-events: auto;
      }
      .vpad-top-btn {
        padding: 6px 16px; background: rgba(0, 0, 0, 0.6);
        border: 1px solid rgba(255,255,255,0.3); color: #fff;
        font-size: 11px; font-weight: bold; border-radius: 20px; backdrop-filter: blur(4px);
      }
      .vpad-top-btn:active { background: rgba(255,255,255,0.3); }
      #vpad-toggle-btn.is-off { border-color: rgba(255,100,100,0.6); background: rgba(40,0,0,0.6); }

      /* Botões Genéricos */
      .vpad-btn-base {
        position: absolute; display: flex; align-items: center; justify-content: center;
        background: rgba(255, 255, 255, 0.15); border: 1px solid rgba(255, 255, 255, 0.3);
        color: #fff; font-weight: bold; pointer-events: auto; touch-action: none;
        backdrop-filter: blur(4px); z-index: 20; transition: background 0.1s;
      }
      .vpad-btn-base:active { background: rgba(255, 255, 255, 0.5); }
      
      .vpad-btn-round { width: 45px; height: 45px; border-radius: 50%; font-size: 14px; }
      .vpad-btn-rect { width: 70px; height: 45px; border-radius: 8px; font-size: 13px; }
      .vpad-btn-small { width: 45px; height: 35px; border-radius: 20px; font-size: 10px; }

      /* Gatilhos e Bumpers (Top Corners) */
      #vpad-btn-lt { top: 20px; left: calc(20px + env(safe-area-inset-left)); }
      #vpad-btn-lb { top: 75px; left: calc(20px + env(safe-area-inset-left)); }
      #vpad-btn-rt { top: 20px; right: calc(20px + env(safe-area-inset-right)); }
      #vpad-btn-rb { top: 75px; right: calc(20px + env(safe-area-inset-right)); }

      /* Botões de Menu (Bottom Center) */
      #vpad-menu-cluster {
        position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%);
        display: flex; gap: 15px; pointer-events: auto; z-index: 20;
      }
      #vpad-menu-cluster .vpad-btn-base { position: relative; }

      /* Clusters de Ação (D-Pad e ABXY) */
      .vpad-cluster {
        position: absolute; width: 125px; height: 125px; bottom: 150px; z-index: 20;
      }
      #vpad-dpad-cluster { left: calc(30px + env(safe-area-inset-left)); }
      #vpad-abxy-cluster { right: calc(30px + env(safe-area-inset-right)); }
      
      .vpad-cluster .vpad-btn-round { position: absolute; }
      .vpad-cluster .btn-top { top: 0; left: 40px; }
      .vpad-cluster .btn-bottom { bottom: 0; left: 40px; }
      .vpad-cluster .btn-left { top: 40px; left: 0; }
      .vpad-cluster .btn-right { top: 40px; right: 0; }

      /* L3 e R3 */
      #vpad-btn-l3 { bottom: 140px; left: calc(160px + env(safe-area-inset-left)); }
      #vpad-btn-r3 { bottom: 140px; right: calc(160px + env(safe-area-inset-right)); }

      /* Zonas de Toque dos Analógicos */
      .vpad-touch-zone {
        position: absolute; bottom: 0; width: 45vw; height: 60vh;
        pointer-events: auto; touch-action: none; z-index: 10;
      }
      #vpad-touch-left { left: 0; }
      #vpad-touch-right { right: 0; }

      .vpad-stick-base {
        position: absolute; width: 110px; height: 110px; border-radius: 50%;
        background: rgba(255, 255, 255, 0.06); border: 2px solid rgba(255, 255, 255, 0.2);
        transform: translate(-50%, -50%); pointer-events: none;
      }
      .vpad-stick-knob {
        position: absolute; width: 46px; height: 46px; border-radius: 50%;
        background: rgba(255, 255, 255, 0.4); top: 50%; left: 50%;
        transform: translate(-50%, -50%); pointer-events: none;
      }
    `;
    document.head.appendChild(style);

    const root = document.createElement('div');
    root.id = 'vpad-root';
    root.innerHTML = `
      <div id="vpad-top-bar">
        <div id="vpad-toggle-btn" class="vpad-top-btn">🎮 CONTROLE: ON</div>
        <div id="vpad-fullscreen-btn" class="vpad-top-btn">⛶ Tela Cheia</div>
      </div>

      <div id="vpad-controls-container">
        <!-- Gatilhos & Bumpers -->
        <div class="vpad-btn-base vpad-btn-rect" id="vpad-btn-lt">LT</div>
        <div class="vpad-btn-base vpad-btn-rect" id="vpad-btn-lb">LB</div>
        <div class="vpad-btn-base vpad-btn-rect" id="vpad-btn-rt">RT</div>
        <div class="vpad-btn-base vpad-btn-rect" id="vpad-btn-rb">RB</div>

        <!-- Menus -->
        <div id="vpad-menu-cluster">
          <div class="vpad-btn-base vpad-btn-small" id="vpad-btn-select">VIEW</div>
          <div class="vpad-btn-base vpad-btn-small" id="vpad-btn-home">HOME</div>
          <div class="vpad-btn-base vpad-btn-small" id="vpad-btn-start">MENU</div>
        </div>

        <!-- D-Pad -->
        <div id="vpad-dpad-cluster" class="vpad-cluster">
          <div class="vpad-btn-base vpad-btn-round btn-top" id="vpad-btn-up">▲</div>
          <div class="vpad-btn-base vpad-btn-round btn-bottom" id="vpad-btn-down">▼</div>
          <div class="vpad-btn-base vpad-btn-round btn-left" id="vpad-btn-left">◀</div>
          <div class="vpad-btn-base vpad-btn-round btn-right" id="vpad-btn-right">▶</div>
        </div>
        <div class="vpad-btn-base vpad-btn-small" id="vpad-btn-l3">L3</div>

        <!-- ABXY -->
        <div id="vpad-abxy-cluster" class="vpad-cluster">
          <div class="vpad-btn-base vpad-btn-round btn-top" id="vpad-btn-y">Y</div>
          <div class="vpad-btn-base vpad-btn-round btn-bottom" id="vpad-btn-a">A</div>
          <div class="vpad-btn-base vpad-btn-round btn-left" id="vpad-btn-x">X</div>
          <div class="vpad-btn-base vpad-btn-round btn-right" id="vpad-btn-b">B</div>
        </div>
        <div class="vpad-btn-base vpad-btn-small" id="vpad-btn-r3">R3</div>

        <!-- Analógicos -->
        <div id="vpad-touch-left" class="vpad-touch-zone">
          <div id="vpad-stick-base-l" class="vpad-stick-base"><div id="vpad-stick-knob-l" class="vpad-stick-knob"></div></div>
        </div>
        <div id="vpad-touch-right" class="vpad-touch-zone">
          <div id="vpad-stick-base-r" class="vpad-stick-base"><div id="vpad-stick-knob-r" class="vpad-stick-knob"></div></div>
        </div>
      </div>
    `;
    document.body.appendChild(root);

    const toggleBtn = document.getElementById('vpad-toggle-btn');
    const controlsContainer = document.getElementById('vpad-controls-container');

    toggleBtn.addEventListener('click', (e) => {
      silenceEvent(e);
      isGamepadEnabled = !isGamepadEnabled;
      if (isGamepadEnabled) {
        toggleBtn.textContent = "🎮 CONTROLE: ON";
        toggleBtn.classList.remove('is-off');
        controlsContainer.classList.remove('vpad-hidden');
        notifyConnected();
      } else {
        toggleBtn.textContent = "🎮 CONTROLE: OFF";
        toggleBtn.classList.add('is-off');
        controlsContainer.classList.add('vpad-hidden');
        resetInputs();
        notifyDisconnected();
      }
    }, { capture: true });

    document.getElementById('vpad-fullscreen-btn').addEventListener('click', (e) => {
      silenceEvent(e);
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen();
      }
    }, { capture: true });

    /* --- Lógica Unificada dos Analógicos --- */
    function setupStick(zoneId, baseId, knobId, axisX, axisY) {
      const zone = document.getElementById(zoneId);
      const base = document.getElementById(baseId);
      const knob = document.getElementById(knobId);
      const isLeft = zoneId.includes('left');
      const MAX_RADIUS = 45;
      let touchId = null;
      let originX = 0, originY = 0;

      function park() {
        base.style.top = ``;
        base.style.bottom = `calc(60px + env(safe-area-inset-bottom))`;
        if (isLeft) {
          base.style.left = `calc(80px + env(safe-area-inset-left))`;
          base.style.right = ``;
        } else {
          base.style.right = `calc(80px + env(safe-area-inset-right))`;
          base.style.left = ``;
        }
        knob.style.transform = `translate(-50%, -50%)`;
      }
      
      park(); // Posiciona inicialmente

      zone.addEventListener('touchstart', (e) => {
        if (!isGamepadEnabled) return;
        silenceEvent(e);
        if (touchId !== null) return;
        const touch = e.changedTouches[0];
        touchId = touch.identifier;
        const rect = zone.getBoundingClientRect();
        originX = touch.clientX; originY = touch.clientY;
        base.style.bottom = 'auto'; base.style.right = 'auto';
        base.style.left = `${originX - rect.left}px`;
        base.style.top = `${originY - rect.top}px`;
        knob.style.transform = `translate(-50%, -50%)`;
      }, { passive: false, capture: true });

      zone.addEventListener('touchmove', (e) => {
        if (!isGamepadEnabled) return;
        silenceEvent(e);
        for (let i = 0; i < e.changedTouches.length; i++) {
          if (e.changedTouches[i].identifier === touchId) {
            const touch = e.changedTouches[i];
            let dx = touch.clientX - originX; let dy = touch.clientY - originY;
            const dist = Math.hypot(dx, dy);
            if (dist > MAX_RADIUS) { dx = (dx/dist)*MAX_RADIUS; dy = (dy/dist)*MAX_RADIUS; }
            knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
            virtualGamepad.axes[axisX] = parseFloat((dx / MAX_RADIUS).toFixed(3));
            virtualGamepad.axes[axisY] = parseFloat((dy / MAX_RADIUS).toFixed(3));
            break;
          }
        }
      }, { passive: false, capture: true });

      const reset = (e) => {
        if (!isGamepadEnabled) return;
        silenceEvent(e);
        for (let i = 0; i < e.changedTouches.length; i++) {
          if (e.changedTouches[i].identifier === touchId) {
            touchId = null; park();
            virtualGamepad.axes[axisX] = 0.0; virtualGamepad.axes[axisY] = 0.0;
            break;
          }
        }
      };
      zone.addEventListener('touchend', reset, { passive: false, capture: true });
      zone.addEventListener('touchcancel', reset, { passive: false, capture: true });
    }

    setupStick('vpad-touch-left', 'vpad-stick-base-l', 'vpad-stick-knob-l', 0, 1);
    setupStick('vpad-touch-right', 'vpad-stick-base-r', 'vpad-stick-knob-r', 2, 3);

    /* --- Lógica Unificada dos Botões --- */
    function bindBtn(id, gpIndex) {
      const el = document.getElementById(id);
      if (!el) return;
      const setBtn = (pressed) => {
        if (!isGamepadEnabled) return;
        virtualGamepad.buttons[gpIndex].pressed = pressed;
        virtualGamepad.buttons[gpIndex].value = pressed ? 1.0 : 0.0;
      };
      el.addEventListener('touchstart', (e) => { silenceEvent(e); setBtn(true); }, { passive: false, capture: true });
      el.addEventListener('touchend', (e) => { silenceEvent(e); setBtn(false); }, { passive: false, capture: true });
      el.addEventListener('touchcancel', (e) => { silenceEvent(e); setBtn(false); }, { passive: false, capture: true });
    }

    // ABXY
    bindBtn('vpad-btn-a', GP.A); bindBtn('vpad-btn-b', GP.B);
    bindBtn('vpad-btn-x', GP.X); bindBtn('vpad-btn-y', GP.Y);
    // D-Pad
    bindBtn('vpad-btn-up', GP.UP); bindBtn('vpad-btn-down', GP.DOWN);
    bindBtn('vpad-btn-left', GP.LEFT); bindBtn('vpad-btn-right', GP.RIGHT);
    // Triggers & Bumpers
    bindBtn('vpad-btn-lt', GP.LT); bindBtn('vpad-btn-rt', GP.RT);
    bindBtn('vpad-btn-lb', GP.LB); bindBtn('vpad-btn-rb', GP.RB);
    // Menus
    bindBtn('vpad-btn-select', GP.SELECT); bindBtn('vpad-btn-home', GP.HOME);
    bindBtn('vpad-btn-start', GP.START);
    // Stick Clicks
    bindBtn('vpad-btn-l3', GP.L3); bindBtn('vpad-btn-r3', GP.R3);

    setTimeout(notifyConnected, 400);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initUI);
  } else {
    initUI();
  }
})();
