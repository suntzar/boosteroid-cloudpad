// ==UserScript==
// @name         Virtual Gamepad API (Modular & Otimizado)
// @namespace    http://tampermonkey.net/
// @version      7.0
// @description  Emula controlo XInput com Painel de Edição Móvel (Versão Modular)
// @match        *://*/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  if (window.self !== window.top && !document.querySelector('canvas, video')) return;

  function silenceEvent(e) {
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
  }
  // --- CORE: Anti-detecção e Estado do Gamepad ---
  try {
    Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 0 });
    Object.defineProperty(navigator, 'msMaxTouchPoints', { get: () => 0 });
  } catch (e) {}

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
  // --- LAYOUT E CONFIGURAÇÕES: Posições e Comportamentos ---
  let homeIsSteam = true; // Estado global para o comportamento do botão HOME

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
        left: el.style.left, top: el.style.top,
        scale: el.style.getPropertyValue('--scale') || 1,
        opacity: el.style.getPropertyValue('--opacity') || 1,
        blur: el.style.getPropertyValue('--blur-val') || '4px'
      };
    });
    localStorage.setItem('vpad-layout-v1', JSON.stringify(layout));
    localStorage.setItem('vpad-config-v1', JSON.stringify({ homeIsSteam }));
  }

  function loadLayout() {
    let saved = null; let savedConfig = null;
    try { saved = JSON.parse(localStorage.getItem('vpad-layout-v1')); } catch (e) {}
    try { savedConfig = JSON.parse(localStorage.getItem('vpad-config-v1')); } catch (e) {}
    
    const layout = saved || defaultLayout;
    if (savedConfig && savedConfig.homeIsSteam !== undefined) homeIsSteam = savedConfig.homeIsSteam;
    
    for (let id in layout) {
      const el = document.getElementById(id);
      if (el) {
        el.style.left = layout[id].left; el.style.top = layout[id].top;
        el.style.setProperty('--scale', layout[id].scale !== undefined ? layout[id].scale : 1);
        el.style.setProperty('--opacity', layout[id].opacity !== undefined ? layout[id].opacity : 1);
        el.style.setProperty('--blur-val', layout[id].blur !== undefined ? layout[id].blur : '4px');
      }
    }
  }

  function resetLayout() {
    localStorage.removeItem('vpad-layout-v1');
    loadLayout();
  }
  // --- UI: Ícones, Estilos e Construção do DOM ---
  const ICON = {
    pad: `<svg viewBox="0 0 24 24"><rect x="2" y="6" width="20" height="12" rx="6"/><circle cx="6" cy="12" r="1"/><circle cx="18" cy="12" r="1"/><path d="M10 12h.01M14 12h.01"/></svg>`,
    screen: `<svg viewBox="0 0 24 24"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>`,
    edit: `<svg viewBox="0 0 24 24"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>`,
    plus: `<svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
    minus: `<svg viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
    reset: `<svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><polyline points="3 3 3 8 8 8"/></svg>`,
    eye: `<svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`,
    eyeOff: `<svg viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`,
    drop: `<svg viewBox="0 0 24 24"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>`,
    keyboard: `<svg viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="2" ry="2"/><line x1="6" y1="9" x2="6" y2="9"/><line x1="10" y1="9" x2="10" y2="9"/><line x1="14" y1="9" x2="14" y2="9"/><line x1="18" y1="9" x2="18" y2="9"/><line x1="6" y1="13" x2="6" y2="13"/><line x1="10" y1="13" x2="10" y2="13"/><line x1="14" y1="13" x2="14" y2="13"/><line x1="18" y1="13" x2="18" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/></svg>`,
    up: `<svg viewBox="0 0 24 24"><polyline points="18 15 12 9 6 15"/></svg>`,
    down: `<svg viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>`,
    left: `<svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>`,
    right: `<svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>`,
    menu: `<svg viewBox="0 0 24 24"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>`,
    view: `<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg>`,
    home: `<svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>`,
    back: `<svg viewBox="0 0 24 24"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>`
  };

  function renderUI() {
    if (document.getElementById('vpad-root')) return;

    const style = document.createElement('style');
    style.textContent = `
      #vpad-root { position: fixed; inset: 0; z-index: 2147483647; pointer-events: none; user-select: none; -webkit-user-select: none; touch-action: none; overflow: hidden; font-family: system-ui, sans-serif; }
      
      .vpad-glass-btn { display: flex; align-items: center; justify-content: center; gap: 6px; background: rgba(255, 255, 255, 0.15); border: 2px solid rgba(255, 255, 255, 0.35); color: #fff; font-weight: 700; backdrop-filter: blur(var(--blur-val, 4px)); transition: background 0.1s; pointer-events: auto; touch-action: none; }
      .vpad-glass-btn:active, .vpad-glass-btn.active-press { background: rgba(255, 255, 255, 0.45); }
      .vpad-glass-btn svg { stroke: currentColor; fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
      
      #vpad-top-bar { position: absolute; top: calc(10px + env(safe-area-inset-top)); left: 50%; transform: translateX(-50%); display: flex; gap: 10px; pointer-events: auto; }
      .vpad-top-btn { padding: 8px 16px; font-size: 11px; border-radius: 24px; transition: border-color 0.2s, color 0.2s, background 0.2s; }
      .vpad-top-btn svg { width: 14px; height: 14px; }
      .vpad-top-btn.is-off { border-color: rgba(255,100,100,0.6); color: #ffbaba; background: rgba(80,0,0,0.4); }
      .vpad-top-btn.is-edit { border-color: #ffeb3b; color: #ffeb3b; }
      
      #vpad-edit-panel { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); background: rgba(20, 20, 25, 0.85); border: 1px solid rgba(255,255,255,0.2); border-radius: 16px; padding: 0; display: none; flex-direction: column; pointer-events: auto; backdrop-filter: blur(8px); z-index: 9999; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
      #vpad-edit-panel.visible { display: flex; }
      #vpad-edit-header { background: rgba(255, 255, 255, 0.1); padding: 10px; text-align: center; font-size: 10px; font-weight: bold; color: #aaa; text-transform: uppercase; border-radius: 16px 16px 0 0; cursor: move; touch-action: none; border-bottom: 1px solid rgba(255,255,255,0.1); }
      
      .vpad-edit-body { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; padding: 16px; }
      .vpad-edit-btn { padding: 10px 8px; border-radius: 12px; font-size: 9px; flex-direction: column; gap: 4px; text-align: center; }
      .vpad-edit-btn svg { width: 16px; height: 16px; }
      .vpad-edit-btn.wide { grid-column: 1 / -1; flex-direction: row; font-size: 11px; padding: 10px; }
      
      .vpad-hidden { display: none !important; }
      .vpad-element { position: absolute; opacity: var(--opacity, 1); transform: scale(var(--scale, 1)); transform-origin: center center; pointer-events: auto; touch-action: none; }
      .vpad-element.edit-mode-active { border: 2px dashed rgba(255, 255, 255, 0.3); background: rgba(255, 255, 255, 0.05); border-radius: 12px; }
      .vpad-element.edit-mode-active.selected { border-color: #ffeb3b; background: rgba(255, 235, 59, 0.2); z-index: 1000; }
      
      .vpad-btn-round { width: 50px; height: 50px; border-radius: 50%; font-size: 16px; letter-spacing: 1px; }
      .vpad-btn-round svg { width: 22px; height: 22px; }
      .vpad-btn-rect { width: 75px; height: 45px; border-radius: 10px; font-size: 14px; }
      .vpad-btn-small { width: 45px; height: 35px; border-radius: 20px; font-size: 11px; }
      .vpad-btn-small svg { width: 14px; height: 14px; }
      
      #vpad-el-menus { display: flex; gap: 12px; }
      .vpad-cluster-grid { position: relative; width: 140px; height: 140px; }
      .vpad-cluster-grid .btn-top { position: absolute; top: 0; left: 45px; }
      .vpad-cluster-grid .btn-bottom { position: absolute; bottom: 0; left: 45px; }
      .vpad-cluster-grid .btn-left { position: absolute; top: 45px; left: 0; }
      .vpad-cluster-grid .btn-right { position: absolute; top: 45px; right: 0; }
      
      .vpad-touch-zone { width: 35vw; height: 50vh; }
      .vpad-stick-base { position: absolute; width: 110px; height: 110px; border-radius: 50%; background: rgba(255, 255, 255, 0.08); border: 2px solid rgba(255, 255, 255, 0.25); pointer-events: none; backdrop-filter: blur(var(--blur-val, 0px)); transition: opacity 0.2s; }
      .vpad-stick-knob { position: absolute; width: 46px; height: 46px; border-radius: 50%; background: rgba(255, 255, 255, 0.5); top: 50%; left: 50%; transform: translate(-50%, -50%); pointer-events: none; }
    `;
    document.head.appendChild(style);

    const root = document.createElement('div');
    root.id = 'vpad-root';
    root.innerHTML = `
      <div id="vpad-top-bar">
        <div id="vpad-back-btn" class="vpad-glass-btn vpad-top-btn">${ICON.back} SAIR</div>
        <div id="vpad-toggle-btn" class="vpad-glass-btn vpad-top-btn">${ICON.pad} ON</div>
        <div id="vpad-fullscreen-btn" class="vpad-glass-btn vpad-top-btn">${ICON.screen} ECRÃ</div>
        <div id="vpad-edit-toggle-btn" class="vpad-glass-btn vpad-top-btn">${ICON.edit} EDITAR</div>
      </div>
      
      <div id="vpad-edit-panel">
        <div id="vpad-edit-header">≡ ARRASTAR PAINEL</div>
        <div class="vpad-edit-body">
          <div id="vpad-edit-minus" class="vpad-glass-btn vpad-edit-btn">${ICON.minus} TAM -</div>
          <div id="vpad-edit-plus" class="vpad-glass-btn vpad-edit-btn">${ICON.plus} TAM +</div>
          <div id="vpad-edit-reset" class="vpad-glass-btn vpad-edit-btn">${ICON.reset} REPOR</div>
          <div id="vpad-edit-op-minus" class="vpad-glass-btn vpad-edit-btn">${ICON.eyeOff} OPAC -</div>
          <div id="vpad-edit-op-plus" class="vpad-glass-btn vpad-edit-btn">${ICON.eye} OPAC +</div>
          <div id="vpad-edit-blur" class="vpad-glass-btn vpad-edit-btn">${ICON.drop} BLUR ON</div>
          <div id="vpad-edit-home-mode" class="vpad-glass-btn vpad-edit-btn wide"></div>
        </div>
      </div>
      
      <div id="vpad-controls-container">
        <div class="vpad-element vpad-touch-zone" id="vpad-el-touch-l"><div id="vpad-stick-base-l" class="vpad-stick-base"><div id="vpad-stick-knob-l" class="vpad-stick-knob"></div></div></div>
        <div class="vpad-element vpad-touch-zone" id="vpad-el-touch-r"><div id="vpad-stick-base-r" class="vpad-stick-base"><div id="vpad-stick-knob-r" class="vpad-stick-knob"></div></div></div>
        <div class="vpad-element" id="vpad-el-lt"><div class="vpad-glass-btn vpad-btn-rect" id="vpad-btn-lt">LT</div></div>
        <div class="vpad-element" id="vpad-el-lb"><div class="vpad-glass-btn vpad-btn-rect" id="vpad-btn-lb">LB</div></div>
        <div class="vpad-element" id="vpad-el-rt"><div class="vpad-glass-btn vpad-btn-rect" id="vpad-btn-rt">RT</div></div>
        <div class="vpad-element" id="vpad-el-rb"><div class="vpad-glass-btn vpad-btn-rect" id="vpad-btn-rb">RB</div></div>
        <div class="vpad-element" id="vpad-el-menus">
          <div class="vpad-glass-btn vpad-btn-small" id="vpad-btn-select">${ICON.view}</div>
          <div class="vpad-glass-btn vpad-btn-small" id="vpad-btn-home">${ICON.home}</div>
          <div class="vpad-glass-btn vpad-btn-small" id="vpad-btn-start">${ICON.menu}</div>
        </div>
        <div class="vpad-element vpad-cluster-grid" id="vpad-el-dpad">
          <div class="vpad-glass-btn vpad-btn-round btn-top" id="vpad-btn-up">${ICON.up}</div>
          <div class="vpad-glass-btn vpad-btn-round btn-bottom" id="vpad-btn-down">${ICON.down}</div>
          <div class="vpad-glass-btn vpad-btn-round btn-left" id="vpad-btn-left">${ICON.left}</div>
          <div class="vpad-glass-btn vpad-btn-round btn-right" id="vpad-btn-right">${ICON.right}</div>
        </div>
        <div class="vpad-element" id="vpad-el-l3"><div class="vpad-glass-btn vpad-btn-small" id="vpad-btn-l3">L3</div></div>
        <div class="vpad-element vpad-cluster-grid" id="vpad-el-abxy">
          <div class="vpad-glass-btn vpad-btn-round btn-top" id="vpad-btn-y">Y</div>
          <div class="vpad-glass-btn vpad-btn-round btn-bottom" id="vpad-btn-a">A</div>
          <div class="vpad-glass-btn vpad-btn-round btn-left" id="vpad-btn-x">X</div>
          <div class="vpad-glass-btn vpad-btn-round btn-right" id="vpad-btn-b">B</div>
        </div>
        <div class="vpad-element" id="vpad-el-r3"><div class="vpad-glass-btn vpad-btn-small" id="vpad-btn-r3">R3</div></div>
      </div>
    `;
    document.body.appendChild(root);
    loadLayout();
  }
  // --- EDIT MODE: Drag & Drop, Redimensionamento, Opacidade, Blur e Modo Home ---
  let activeEditElement = null;
  let dragData = null;
  let panelDrag = null;

  function initEditLogic() {
    const editToggleBtn = document.getElementById('vpad-edit-toggle-btn');
    const editPanel = document.getElementById('vpad-edit-panel');
    const homeModeBtn = document.getElementById('vpad-edit-home-mode');

    homeModeBtn.innerHTML = homeIsSteam ? `${ICON.keyboard} HOME: SHIFT+TAB` : `${ICON.pad} HOME: NATIVO`;
    
    function updatePanelState() {
      if (!activeEditElement) return;
      let currentBlur = activeEditElement.style.getPropertyValue('--blur-val');
      let isBlurOn = currentBlur === '' || currentBlur === '4px';
      if (currentBlur === '0px') isBlurOn = false;
      document.getElementById('vpad-edit-blur').innerHTML = isBlurOn ? `${ICON.drop} BLUR ON` : `${ICON.drop} BLUR OFF`;
    }

    editToggleBtn.addEventListener('click', (e) => {
      silenceEvent(e);
      isEditMode = !isEditMode;
      const elements = document.querySelectorAll('.vpad-element');
      
      if (isEditMode) {
        editToggleBtn.classList.add('is-edit'); editPanel.classList.add('visible');
        resetInputs();
        elements.forEach(el => el.classList.add('edit-mode-active'));
      } else {
        editToggleBtn.classList.remove('is-edit'); editPanel.classList.remove('visible');
        if (activeEditElement) activeEditElement.classList.remove('selected');
        activeEditElement = null;
        elements.forEach(el => el.classList.remove('edit-mode-active'));
        saveLayout();
      }
    }, { capture: true });

    homeModeBtn.addEventListener('click', (e) => {
      silenceEvent(e);
      homeIsSteam = !homeIsSteam;
      homeModeBtn.innerHTML = homeIsSteam ? `${ICON.keyboard} HOME: SHIFT+TAB` : `${ICON.pad} HOME: NATIVO`;
      saveLayout();
    });

    document.getElementById('vpad-edit-plus').addEventListener('click', (e) => { silenceEvent(e); if (activeEditElement) { let s = parseFloat(activeEditElement.style.getPropertyValue('--scale')) || 1; activeEditElement.style.setProperty('--scale', Math.min(2.5, s + 0.1)); }});
    document.getElementById('vpad-edit-minus').addEventListener('click', (e) => { silenceEvent(e); if (activeEditElement) { let s = parseFloat(activeEditElement.style.getPropertyValue('--scale')) || 1; activeEditElement.style.setProperty('--scale', Math.max(0.4, s - 0.1)); }});
    document.getElementById('vpad-edit-op-plus').addEventListener('click', (e) => { silenceEvent(e); if (activeEditElement) { let o = parseFloat(activeEditElement.style.getPropertyValue('--opacity')); if (isNaN(o)) o = 1; activeEditElement.style.setProperty('--opacity', Math.min(1.0, o + 0.1).toFixed(1)); }});
    document.getElementById('vpad-edit-op-minus').addEventListener('click', (e) => { silenceEvent(e); if (activeEditElement) { let o = parseFloat(activeEditElement.style.getPropertyValue('--opacity')); if (isNaN(o)) o = 1; activeEditElement.style.setProperty('--opacity', Math.max(0.1, o - 0.1).toFixed(1)); }});

    document.getElementById('vpad-edit-blur').addEventListener('click', (e) => {
      silenceEvent(e);
      if (!activeEditElement) return;
      let currentBlur = activeEditElement.style.getPropertyValue('--blur-val');
      let isBlurOn = currentBlur === '' || currentBlur === '4px';
      if (currentBlur === '0px') isBlurOn = false;

      if (isBlurOn) {
        activeEditElement.style.setProperty('--blur-val', '0px');
        document.getElementById('vpad-edit-blur').innerHTML = `${ICON.drop} BLUR OFF`;
      } else {
        activeEditElement.style.setProperty('--blur-val', '4px');
        document.getElementById('vpad-edit-blur').innerHTML = `${ICON.drop} BLUR ON`;
      }
    });

    document.getElementById('vpad-edit-reset').addEventListener('click', (e) => { silenceEvent(e); resetLayout(); });

    /* --- CORREÇÃO DO TELETRANSPORTE (PAINEL FLUTUANTE) --- */
    const editHeader = document.getElementById('vpad-edit-header');
    editHeader.addEventListener('touchstart', (e) => {
      silenceEvent(e);
      const touch = e.touches[0]; 
      
      let currentLeft = parseFloat(editPanel.style.left);
      let currentTop = parseFloat(editPanel.style.top);
      
      // Se ainda não tiver left/top definidos (centralizado nativamente), pega o centro
      if (isNaN(currentLeft)) currentLeft = window.innerWidth / 2;
      if (isNaN(currentTop)) currentTop = window.innerHeight / 2;

      editPanel.style.left = `${currentLeft}px`; 
      editPanel.style.top = `${currentTop}px`; 
      editPanel.style.transform = 'none'; // Trava o transform
      
      panelDrag = { id: touch.identifier, startX: touch.clientX, startY: touch.clientY, startLeft: currentLeft, startTop: currentTop };
    }, { passive: false });

    editHeader.addEventListener('touchmove', (e) => {
      if (!panelDrag) return; silenceEvent(e);
      for (let touch of e.changedTouches) {
        if (touch.identifier === panelDrag.id) {
          editPanel.style.left = `${panelDrag.startLeft + (touch.clientX - panelDrag.startX)}px`;
          editPanel.style.top = `${panelDrag.startTop + (touch.clientY - panelDrag.startY)}px`;
        }
      }
    }, { passive: false });
    editHeader.addEventListener('touchend', () => { panelDrag = null; }, { capture: true });

    /* --- CORREÇÃO DO TELETRANSPORTE (BOTÕES DO GAMEPAD) --- */
    document.addEventListener('touchstart', (e) => {
      if (!isEditMode || e.target.closest('#vpad-edit-panel')) return;
      const el = e.target.closest('.vpad-element');
      if (activeEditElement && activeEditElement !== el) activeEditElement.classList.remove('selected');
      if (!el) { activeEditElement = null; return; }
      
      silenceEvent(e);
      activeEditElement = el; 
      activeEditElement.classList.add('selected');
      updatePanelState(); 

      const touch = e.touches[0]; 
      
      // Lemos o CSS inline real do elemento e convertemos, ignorando o bounding box que tem escala
      let startLeftVW = parseFloat(el.style.left) || 0;
      let startTopVH = parseFloat(el.style.top) || 0;
      
      dragData = { 
        id: touch.identifier, 
        startX: touch.clientX, 
        startY: touch.clientY, 
        startLeftVW: startLeftVW, 
        startTopVH: startTopVH 
      };
    }, { capture: true, passive: false });

    document.addEventListener('touchmove', (e) => {
      if (!isEditMode || !dragData || !activeEditElement) return; silenceEvent(e);
      for (let touch of e.changedTouches) {
        if (touch.identifier === dragData.id) {
          // Calcula o delta em px e converte direto para vw/vh
          const dxVW = ((touch.clientX - dragData.startX) / window.innerWidth) * 100;
          const dyVH = ((touch.clientY - dragData.startY) / window.innerHeight) * 100;
          activeEditElement.style.left = `${dragData.startLeftVW + dxVW}vw`; 
          activeEditElement.style.top = `${dragData.startTopVH + dyVH}vh`;
        }
      }
    }, { capture: true, passive: false });

    document.addEventListener('touchend', (e) => {
      if (!isEditMode || !dragData) return;
      for (let touch of e.changedTouches) { if (touch.identifier === dragData.id) dragData = null; }
    }, { capture: true });
  }
  // --- INPUT: Analógicos, Botões Digitais e Emulação de Teclado Avançada ---
  
  function simulateKey(eventName, key, code, keyCode, shiftKey) {
    // Procura elementos específicos de stream (Boosteroid usa video ou canvas em wrappers específicos)
    const target = document.querySelector('video, canvas, #game-stream, .stream-container') || document.body;
    
    const event = new KeyboardEvent(eventName, {
      key: key, code: code, keyCode: keyCode, which: keyCode,
      shiftKey: shiftKey, bubbles: true, cancelable: true, composed: true
    });
    
    // Hacks pesados para contornar a segurança de engines de cloud gaming que validam keyCode real
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

      // Interceptação do Botão Home para Shift+Tab no Boosteroid
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

  function initInputs() {
    setupStick('vpad-el-touch-l', 'vpad-stick-base-l', 'vpad-stick-knob-l', 0, 1);
    setupStick('vpad-el-touch-r', 'vpad-stick-base-r', 'vpad-stick-knob-r', 2, 3);
    
    bindBtn('vpad-btn-a', GP.A); bindBtn('vpad-btn-b', GP.B); bindBtn('vpad-btn-x', GP.X); bindBtn('vpad-btn-y', GP.Y);
    bindBtn('vpad-btn-up', GP.UP); bindBtn('vpad-btn-down', GP.DOWN); bindBtn('vpad-btn-left', GP.LEFT); bindBtn('vpad-btn-right', GP.RIGHT);
    bindBtn('vpad-btn-lt', GP.LT); bindBtn('vpad-btn-rt', GP.RT); bindBtn('vpad-btn-lb', GP.LB); bindBtn('vpad-btn-rb', GP.RB);
    bindBtn('vpad-btn-select', GP.SELECT); bindBtn('vpad-btn-home', GP.HOME); bindBtn('vpad-btn-start', GP.START);
    bindBtn('vpad-btn-l3', GP.L3); bindBtn('vpad-btn-r3', GP.R3);
  }
  // --- INIT: Inicialização e Eventos Globais ---
  function initGamepad() {
    renderUI();
    initEditLogic();
    initInputs();

    const toggleBtn = document.getElementById('vpad-toggle-btn');
    const controlsContainer = document.getElementById('vpad-controls-container');

    // Navegar de volta (Sair do jogo / Voltar para a Dashboard)
    document.getElementById('vpad-back-btn').addEventListener('click', (e) => {
      silenceEvent(e);
      window.history.back();
    }, { capture: true });

    toggleBtn.addEventListener('click', (e) => {
      silenceEvent(e);
      if (isEditMode) return;
      isGamepadEnabled = !isGamepadEnabled;
      if (isGamepadEnabled) {
        toggleBtn.innerHTML = `${ICON.pad} ON`; toggleBtn.classList.remove('is-off'); controlsContainer.classList.remove('vpad-hidden'); notifyConnected();
      } else {
        toggleBtn.innerHTML = `${ICON.pad} OFF`; toggleBtn.classList.add('is-off'); controlsContainer.classList.add('vpad-hidden'); resetInputs(); notifyDisconnected();
      }
    }, { capture: true });

    document.getElementById('vpad-fullscreen-btn').addEventListener('click', (e) => {
      silenceEvent(e);
      if (!document.fullscreenElement) { document.documentElement.requestFullscreen().catch(() => {}); } else { document.exitFullscreen(); }
    }, { capture: true });

    setTimeout(notifyConnected, 400);
  }

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', initGamepad); } 
  else { initGamepad(); }
})();
