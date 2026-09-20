// ==UserScript==
// @name         Virtual Gamepad API (Layout Editável & HUD Ergonómico)
// @namespace    http://tampermonkey.net/
// @version      5.0
// @description  Emula controlo XInput com Modo Edição (Drag & Drop, Redimensionamento e Gravação)
// @match        *://*/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  if (window.self !== window.top && !document.querySelector('canvas, video')) return;

  // Camuflagem anti-controlo nativo do Boosteroid
  try {
    Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 0 });
    Object.defineProperty(navigator, 'msMaxTouchPoints', { get: () => 0 });
  } catch (e) {}

  let isGamepadEnabled = true;
  let isEditMode = false;
  let activeEditElement = null;
  let dragData = null;

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
    virtualGamepad.buttons.forEach(b => { b.pressed = false; b.value = 0.0; });
  }

  function silenceEvent(e) {
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
  }

  /* ==========================================================================
     GESTOR DE LAYOUT (GRAVAÇÃO E CARREGAMENTO)
     ========================================================================== */
  const defaultLayout = {
    'vpad-el-lt': { left: '4vw', top: '8vh', scale: 1 },
    'vpad-el-lb': { left: '16vw', top: '8vh', scale: 1 },
    'vpad-el-rt': { left: '86vw', top: '8vh', scale: 1 },
    'vpad-el-rb': { left: '74vw', top: '8vh', scale: 1 },
    'vpad-el-menus': { left: '40vw', top: '8vh', scale: 1 },
    'vpad-el-dpad': { left: '6vw', top: '50vh', scale: 1 },
    'vpad-el-abxy': { left: '78vw', top: '50vh', scale: 1 },
    'vpad-el-l3': { left: '22vw', top: '78vh', scale: 1 },
    'vpad-el-r3': { left: '65vw', top: '78vh', scale: 1 },
    'vpad-el-touch-l': { left: '3vw', top: '45vh', scale: 1 },
    'vpad-el-touch-r': { left: '62vw', top: '45vh', scale: 1 }
  };

  function saveLayout() {
    const layout = {};
    document.querySelectorAll('.vpad-element').forEach(el => {
      layout[el.id] = {
        left: el.style.left,
        top: el.style.top,
        scale: el.style.getPropertyValue('--scale') || 1
      };
    });
    localStorage.setItem('vpad-layout-v1', JSON.stringify(layout));
  }

  function loadLayout() {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem('vpad-layout-v1')); } catch (e) {}
    const layout = saved || defaultLayout;
    
    for (let id in layout) {
      const el = document.getElementById(id);
      if (el) {
        el.style.left = layout[id].left;
        el.style.top = layout[id].top;
        el.style.setProperty('--scale', layout[id].scale);
      }
    }
  }

  function resetLayout() {
    localStorage.removeItem('vpad-layout-v1');
    loadLayout();
  }

  /* ==========================================================================
     CONSTRUÇÃO DA INTERFACE (UI)
     ========================================================================== */
  function initUI() {
    if (document.getElementById('vpad-root')) return;

    const style = document.createElement('style');
    style.textContent = `
      #vpad-root {
        position: fixed; inset: 0; z-index: 2147483647;
        pointer-events: none; user-select: none; -webkit-user-select: none;
        touch-action: none; overflow: hidden; font-family: sans-serif;
      }
      
      /* Barras de Ferramentas */
      #vpad-top-bar, #vpad-edit-bar {
        position: absolute; left: 50%; transform: translateX(-50%);
        display: flex; gap: 8px; pointer-events: auto; z-index: 9999;
      }
      #vpad-top-bar { top: calc(10px + env(safe-area-inset-top)); }
      #vpad-edit-bar { top: calc(55px + env(safe-area-inset-top)); display: none; }
      #vpad-edit-bar.visible { display: flex; }

      .vpad-top-btn {
        padding: 8px 14px; background: rgba(0, 0, 0, 0.75);
        border: 1px solid rgba(255,255,255,0.4); color: #fff;
        font-size: 11px; font-weight: bold; border-radius: 20px; 
        backdrop-filter: blur(4px); white-space: nowrap; transition: background 0.2s;
      }
      .vpad-top-btn:active { background: rgba(255,255,255,0.4); }
      .vpad-top-btn.is-off { border-color: rgba(255,100,100,0.8); background: rgba(80,0,0,0.8); }
      .vpad-top-btn.is-edit { border-color: #ffeb3b; color: #ffeb3b; }

      .vpad-hidden { display: none !important; }

      /* Elementos Arrastáveis (Wrappers) */
      .vpad-element {
        position: absolute; 
        transform: scale(var(--scale, 1));
        transform-origin: center center;
        pointer-events: auto;
        touch-action: none;
      }
      .vpad-element.edit-mode-active {
        border: 2px dashed rgba(255, 255, 255, 0.3);
        background: rgba(255, 255, 255, 0.05);
        border-radius: 12px;
      }
      .vpad-element.edit-mode-active.selected {
        border-color: #ffeb3b;
        background: rgba(255, 235, 59, 0.2);
        z-index: 1000;
      }

      /* Estética dos Botões */
      .vpad-btn-base {
        position: relative; display: flex; align-items: center; justify-content: center;
        background: rgba(255, 255, 255, 0.15); border: 2px solid rgba(255, 255, 255, 0.35);
        color: #fff; font-weight: bold; backdrop-filter: blur(4px); transition: background 0.1s;
      }
      .vpad-btn-base.active-press { background: rgba(255, 255, 255, 0.5); }
      
      .vpad-btn-round { width: 48px; height: 48px; border-radius: 50%; font-size: 14px; }
      .vpad-btn-rect { width: 70px; height: 45px; border-radius: 8px; font-size: 13px; }
      .vpad-btn-small { width: 45px; height: 35px; border-radius: 20px; font-size: 10px; }

      /* Agrupamentos Específicos */
      #vpad-el-menus { display: flex; gap: 10px; }
      .vpad-cluster-grid { position: relative; width: 130px; height: 130px; }
      .vpad-cluster-grid .btn-top { position: absolute; top: 0; left: 41px; }
      .vpad-cluster-grid .btn-bottom { position: absolute; bottom: 0; left: 41px; }
      .vpad-cluster-grid .btn-left { position: absolute; top: 41px; left: 0; }
      .vpad-cluster-grid .btn-right { position: absolute; top: 41px; right: 0; }

      /* Zonas Analógicas */
      .vpad-touch-zone { width: 35vw; height: 50vh; }
      .vpad-stick-base {
        position: absolute; width: 110px; height: 110px; border-radius: 50%;
        background: rgba(255, 255, 255, 0.08); border: 2px solid rgba(255, 255, 255, 0.25);
        pointer-events: none; transition: opacity 0.2s;
      }
      .vpad-stick-knob {
        position: absolute; width: 46px; height: 46px; border-radius: 50%;
        background: rgba(255, 255, 255, 0.5); top: 50%; left: 50%;
        transform: translate(-50%, -50%); pointer-events: none;
      }
    `;
    document.head.appendChild(style);

    const root = document.createElement('div');
    root.id = 'vpad-root';
    root.innerHTML = `
      <!-- Toolbar Superior -->
      <div id="vpad-top-bar">
        <div id="vpad-toggle-btn" class="vpad-top-btn">🎮 JOGAR: ON</div>
        <div id="vpad-fullscreen-btn" class="vpad-top-btn">⛶ ECRÃ</div>
        <div id="vpad-edit-toggle-btn" class="vpad-top-btn">✏️ EDITAR</div>
      </div>
      
      <!-- Toolbar de Edição -->
      <div id="vpad-edit-bar">
        <div id="vpad-edit-minus" class="vpad-top-btn">➖ TAMANHO</div>
        <div id="vpad-edit-plus" class="vpad-top-btn">➕ TAMANHO</div>
        <div id="vpad-edit-reset" class="vpad-top-btn">↺ REPOR</div>
      </div>

      <div id="vpad-controls-container">
        <!-- Zonas Analógicas -->
        <div class="vpad-element vpad-touch-zone" id="vpad-el-touch-l">
          <div id="vpad-stick-base-l" class="vpad-stick-base"><div id="vpad-stick-knob-l" class="vpad-stick-knob"></div></div>
        </div>
        <div class="vpad-element vpad-touch-zone" id="vpad-el-touch-r">
          <div id="vpad-stick-base-r" class="vpad-stick-base"><div id="vpad-stick-knob-r" class="vpad-stick-knob"></div></div>
        </div>

        <!-- Triggers / Bumpers -->
        <div class="vpad-element" id="vpad-el-lt"><div class="vpad-btn-base vpad-btn-rect" id="vpad-btn-lt">LT</div></div>
        <div class="vpad-element" id="vpad-el-lb"><div class="vpad-btn-base vpad-btn-rect" id="vpad-btn-lb">LB</div></div>
        <div class="vpad-element" id="vpad-el-rt"><div class="vpad-btn-base vpad-btn-rect" id="vpad-btn-rt">RT</div></div>
        <div class="vpad-element" id="vpad-el-rb"><div class="vpad-btn-base vpad-btn-rect" id="vpad-btn-rb">RB</div></div>

        <!-- Menus Centrais -->
        <div class="vpad-element" id="vpad-el-menus">
          <div class="vpad-btn-base vpad-btn-small" id="vpad-btn-select">VIEW</div>
          <div class="vpad-btn-base vpad-btn-small" id="vpad-btn-home">HOME</div>
          <div class="vpad-btn-base vpad-btn-small" id="vpad-btn-start">MENU</div>
        </div>

        <!-- D-Pad Cluster -->
        <div class="vpad-element vpad-cluster-grid" id="vpad-el-dpad">
          <div class="vpad-btn-base vpad-btn-round btn-top" id="vpad-btn-up">▲</div>
          <div class="vpad-btn-base vpad-btn-round btn-bottom" id="vpad-btn-down">▼</div>
          <div class="vpad-btn-base vpad-btn-round btn-left" id="vpad-btn-left">◀</div>
          <div class="vpad-btn-base vpad-btn-round btn-right" id="vpad-btn-right">▶</div>
        </div>
        <div class="vpad-element" id="vpad-el-l3"><div class="vpad-btn-base vpad-btn-small" id="vpad-btn-l3">L3</div></div>

        <!-- ABXY Cluster -->
        <div class="vpad-element vpad-cluster-grid" id="vpad-el-abxy">
          <div class="vpad-btn-base vpad-btn-round btn-top" id="vpad-btn-y">Y</div>
          <div class="vpad-btn-base vpad-btn-round btn-bottom" id="vpad-btn-a">A</div>
          <div class="vpad-btn-base vpad-btn-round btn-left" id="vpad-btn-x">X</div>
          <div class="vpad-btn-base vpad-btn-round btn-right" id="vpad-btn-b">B</div>
        </div>
        <div class="vpad-element" id="vpad-el-r3"><div class="vpad-btn-base vpad-btn-small" id="vpad-btn-r3">R3</div></div>
      </div>
    `;
    document.body.appendChild(root);
    
    loadLayout();

    /* ==========================================================================
       LÓGICA DOS BOTÕES DA TOOLBAR
       ========================================================================== */
    const toggleBtn = document.getElementById('vpad-toggle-btn');
    const editToggleBtn = document.getElementById('vpad-edit-toggle-btn');
    const editBar = document.getElementById('vpad-edit-bar');
    const controlsContainer = document.getElementById('vpad-controls-container');

    toggleBtn.addEventListener('click', (e) => {
      silenceEvent(e);
      if (isEditMode) return; // Bloqueado se estiver a editar
      isGamepadEnabled = !isGamepadEnabled;
      if (isGamepadEnabled) {
        toggleBtn.textContent = "🎮 JOGAR: ON";
        toggleBtn.classList.remove('is-off');
        controlsContainer.classList.remove('vpad-hidden');
        notifyConnected();
      } else {
        toggleBtn.textContent = "🎮 JOGAR: OFF";
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
      } else { document.exitFullscreen(); }
    }, { capture: true });

    editToggleBtn.addEventListener('click', (e) => {
      silenceEvent(e);
      isEditMode = !isEditMode;
      const elements = document.querySelectorAll('.vpad-element');
      
      if (isEditMode) {
        editToggleBtn.classList.add('is-edit');
        editBar.classList.add('visible');
        resetInputs();
        elements.forEach(el => el.classList.add('edit-mode-active'));
      } else {
        editToggleBtn.classList.remove('is-edit');
        editBar.classList.remove('visible');
        if (activeEditElement) activeEditElement.classList.remove('selected');
        activeEditElement = null;
        elements.forEach(el => el.classList.remove('edit-mode-active'));
        saveLayout();
      }
    }, { capture: true });

    /* Controlos de Tamanho e Reset */
    document.getElementById('vpad-edit-plus').addEventListener('click', (e) => {
      silenceEvent(e);
      if (!activeEditElement) return;
      let s = parseFloat(activeEditElement.style.getPropertyValue('--scale')) || 1;
      activeEditElement.style.setProperty('--scale', Math.min(2.5, s + 0.1));
    });
    
    document.getElementById('vpad-edit-minus').addEventListener('click', (e) => {
      silenceEvent(e);
      if (!activeEditElement) return;
      let s = parseFloat(activeEditElement.style.getPropertyValue('--scale')) || 1;
      activeEditElement.style.setProperty('--scale', Math.max(0.4, s - 0.1));
    });

    document.getElementById('vpad-edit-reset').addEventListener('click', (e) => {
      silenceEvent(e);
      resetLayout();
    });

    /* ==========================================================================
       LÓGICA DE DRAG & DROP (MODO EDIÇÃO)
       ========================================================================== */
    document.addEventListener('touchstart', (e) => {
      if (!isEditMode) return;
      const el = e.target.closest('.vpad-element');
      
      if (activeEditElement) activeEditElement.classList.remove('selected');
      
      if (!el) {
        activeEditElement = null;
        return;
      }
      
      silenceEvent(e);
      activeEditElement = el;
      activeEditElement.classList.add('selected');

      const touch = e.touches[0];
      const rect = el.getBoundingClientRect();
      dragData = {
        id: touch.identifier,
        startX: touch.clientX,
        startY: touch.clientY,
        startLeft: rect.left,
        startTop: rect.top
      };
    }, { capture: true, passive: false });

    document.addEventListener('touchmove', (e) => {
      if (!isEditMode || !dragData || !activeEditElement) return;
      silenceEvent(e);
      for (let touch of e.changedTouches) {
        if (touch.identifier === dragData.id) {
          const dx = touch.clientX - dragData.startX;
          const dy = touch.clientY - dragData.startY;
          // Converte pixéis absolutos para vw/vh para suportar rotação perfeita
          const newLeft = ((dragData.startLeft + dx) / window.innerWidth) * 100;
          const newTop = ((dragData.startTop + dy) / window.innerHeight) * 100;
          
          activeEditElement.style.left = `${newLeft}vw`;
          activeEditElement.style.top = `${newTop}vh`;
        }
      }
    }, { capture: true, passive: false });

    document.addEventListener('touchend', (e) => {
      if (!isEditMode || !dragData) return;
      for (let touch of e.changedTouches) {
        if (touch.identifier === dragData.id) dragData = null;
      }
    }, { capture: true });

    /* ==========================================================================
       LÓGICA DOS ANALÓGICOS (ISOLADA POR ZONA)
       ========================================================================== */
    function setupStick(zoneId, baseId, knobId, axisX, axisY) {
      const zone = document.getElementById(zoneId);
      const base = document.getElementById(baseId);
      const knob = document.getElementById(knobId);
      const MAX_RADIUS = 45;
      let touchId = null;
      let originX = 0, originY = 0;

      function park() {
        base.style.left = '50%';
        base.style.top = '50%';
        base.style.transform = 'translate(-50%, -50%)';
        knob.style.transform = 'translate(-50%, -50%)';
      }
      park();

      zone.addEventListener('touchstart', (e) => {
        if (!isGamepadEnabled || isEditMode) return;
        silenceEvent(e);
        if (touchId !== null) return;
        
        const touch = e.changedTouches[0];
        touchId = touch.identifier;
        originX = touch.clientX; 
        originY = touch.clientY;
        
        const rect = zone.getBoundingClientRect();
        base.style.left = `${originX - rect.left}px`;
        base.style.top = `${originY - rect.top}px`;
        knob.style.transform = `translate(-50%, -50%)`;
      }, { passive: false, capture: true });

      zone.addEventListener('touchmove', (e) => {
        if (!isGamepadEnabled || isEditMode) return;
        silenceEvent(e);
        for (let i = 0; i < e.changedTouches.length; i++) {
          if (e.changedTouches[i].identifier === touchId) {
            const touch = e.changedTouches[i];
            let dx = touch.clientX - originX; 
            let dy = touch.clientY - originY;
            const dist = Math.hypot(dx, dy);
            
            if (dist > MAX_RADIUS) { 
              dx = (dx/dist)*MAX_RADIUS; 
              dy = (dy/dist)*MAX_RADIUS; 
            }
            knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
            virtualGamepad.axes[axisX] = parseFloat((dx / MAX_RADIUS).toFixed(3));
            virtualGamepad.axes[axisY] = parseFloat((dy / MAX_RADIUS).toFixed(3));
            break;
          }
        }
      }, { passive: false, capture: true });

      const reset = (e) => {
        if (!isGamepadEnabled || isEditMode) return;
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

    setupStick('vpad-el-touch-l', 'vpad-stick-base-l', 'vpad-stick-knob-l', 0, 1);
    setupStick('vpad-el-touch-r', 'vpad-stick-base-r', 'vpad-stick-knob-r', 2, 3);

    /* ==========================================================================
       LÓGICA DOS BOTÕES DIGITAIS
       ========================================================================== */
    function bindBtn(id, gpIndex) {
      const el = document.getElementById(id);
      if (!el) return;
      const setBtn = (pressed) => {
        if (!isGamepadEnabled || isEditMode) return;
        virtualGamepad.buttons[gpIndex].pressed = pressed;
        virtualGamepad.buttons[gpIndex].value = pressed ? 1.0 : 0.0;
        if (pressed) el.classList.add('active-press');
        else el.classList.remove('active-press');
      };
      el.addEventListener('touchstart', (e) => { if(!isEditMode){ silenceEvent(e); setBtn(true); } }, { passive: false, capture: true });
      el.addEventListener('touchend', (e) => { if(!isEditMode){ silenceEvent(e); setBtn(false); } }, { passive: false, capture: true });
      el.addEventListener('touchcancel', (e) => { if(!isEditMode){ silenceEvent(e); setBtn(false); } }, { passive: false, capture: true });
    }

    bindBtn('vpad-btn-a', GP.A); bindBtn('vpad-btn-b', GP.B);
    bindBtn('vpad-btn-x', GP.X); bindBtn('vpad-btn-y', GP.Y);
    bindBtn('vpad-btn-up', GP.UP); bindBtn('vpad-btn-down', GP.DOWN);
    bindBtn('vpad-btn-left', GP.LEFT); bindBtn('vpad-btn-right', GP.RIGHT);
    bindBtn('vpad-btn-lt', GP.LT); bindBtn('vpad-btn-rt', GP.RT);
    bindBtn('vpad-btn-lb', GP.LB); bindBtn('vpad-btn-rb', GP.RB);
    bindBtn('vpad-btn-select', GP.SELECT); bindBtn('vpad-btn-home', GP.HOME);
    bindBtn('vpad-btn-start', GP.START);
    bindBtn('vpad-btn-l3', GP.L3); bindBtn('vpad-btn-r3', GP.R3);

    setTimeout(notifyConnected, 400);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initUI);
  } else {
    initUI();
  }
})();
