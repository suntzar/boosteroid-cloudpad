// ==UserScript==
// @name         Boosteroid CloudPad
// @namespace    https://github.com/SEU_USUARIO/boosteroid-cloudpad
// @version      8.0
// @description  Controle Virtual XInput, HUD editável, Tema MD3 e Otimizações para o Boosteroid.
// @author       Seu Nome / Comunidade
// @match        ://cloud.boosteroid.com/
// @icon         https://cloud.boosteroid.com/favicon.ico
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  if (window.self !== window.top && !document.querySelector('canvas, video')) return;

  function silenceEvent(e) {
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
  }
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

  // 🔴 Alterado para iniciar desabilitado por padrão
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
    back: `<svg viewBox="0 0 24 24"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>`,
    clipboard: `<svg viewBox="0 0 24 24"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>`,
    mic: `<svg viewBox="0 0 24 24"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="8" y1="22" x2="16" y2="22"/></svg>`,
    micOff: `<svg viewBox="0 0 24 24"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V5a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="8" y1="22" x2="16" y2="22"/></svg>`,
    keyboardTop: `<svg viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="16" rx="2" ry="2"/><line x1="6" y1="8" x2="6" y2="8"/><line x1="10" y1="8" x2="10" y2="8"/><line x1="14" y1="8" x2="14" y2="8"/><line x1="18" y1="8" x2="18" y2="8"/><line x1="6" y1="12" x2="6" y2="12"/><line x1="10" y1="12" x2="10" y2="12"/><line x1="14" y1="12" x2="14" y2="12"/><line x1="18" y1="12" x2="18" y2="12"/><line x1="8" y1="16" x2="16" y2="16"/></svg>`,
    power: `<svg viewBox="0 0 24 24"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>`
  };

  function renderUI() {
    if (document.getElementById('vpad-root')) return;

    const style = document.createElement('style');
    style.textContent = `
      #vpad-root { position: fixed; inset: 0; z-index: 2147483647; pointer-events: none; user-select: none; -webkit-user-select: none; touch-action: none; overflow: hidden; font-family: system-ui, sans-serif; }
      
      .vpad-glass-btn { display: flex; align-items: center; justify-content: center; gap: 6px; background: rgba(255, 255, 255, 0.15); border: 2px solid rgba(255, 255, 255, 0.35); color: #fff; font-weight: 700; backdrop-filter: blur(var(--blur-val, 4px)); transition: background 0.1s, border-color 0.2s, color 0.2s; pointer-events: auto; touch-action: none; }
      .vpad-glass-btn:active, .vpad-glass-btn.active-press { background: rgba(255, 255, 255, 0.45); }
      .vpad-glass-btn svg { stroke: currentColor; fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; transition: inherit; }
      
      #vpad-top-bar { position: absolute; top: calc(10px + env(safe-area-inset-top)); left: 50%; transform: translateX(-50%); display: flex; gap: 8px; pointer-events: auto; flex-wrap: wrap; justify-content: center; width: max-content; max-width: 95vw; }
      .vpad-top-btn { padding: 6px 12px; font-size: 10px; border-radius: 24px; white-space: nowrap; }
      .vpad-top-btn svg { width: 14px; height: 14px; }
      .vpad-top-btn.is-off { border-color: rgba(255,100,100,0.6); color: #ffbaba; background: rgba(80,0,0,0.4); }
      .vpad-top-btn.is-edit { border-color: #ffeb3b; color: #ffeb3b; }
      .vpad-top-btn.is-danger { border-color: #ff6b6b; color: #ff6b6b; }
      
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
        <div id="vpad-exit-btn" class="vpad-glass-btn vpad-top-btn is-danger">${ICON.power} SAIR</div>
        <div id="vpad-clipboard-btn" class="vpad-glass-btn vpad-top-btn">${ICON.clipboard} COLAR</div>
        <div id="vpad-mic-btn" class="vpad-glass-btn vpad-top-btn">${ICON.micOff} MIC OFF</div>
        <div id="vpad-kb-btn" class="vpad-glass-btn vpad-top-btn">${ICON.keyboardTop} TECLADO</div>
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
  
  function clickNativeBoosteroidElement(id) {
    const el = document.getElementById(id);
    if (el) {
      el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
      el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
      el.click();
      el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true }));
      el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
    }
  }

  function setupMicSync() {
    const nativeMic = document.getElementById('mic-control');
    const vpadMic = document.getElementById('vpad-mic-btn');
    if (!vpadMic) return;

    if (nativeMic) {
      const updateMicUI = () => {
        const isEnabled = nativeMic.getAttribute('aria-pressed') === 'true';
        if (isEnabled) {
          vpadMic.innerHTML = `${ICON.mic} MIC ON`;
          vpadMic.style.borderColor = '#4caf50';
          vpadMic.style.color = '#4caf50';
        } else {
          vpadMic.innerHTML = `${ICON.micOff} MIC OFF`;
          vpadMic.style.borderColor = ''; 
          vpadMic.style.color = '';
        }
      };

      updateMicUI(); 
      const observer = new MutationObserver(updateMicUI);
      observer.observe(nativeMic, { attributes: true, attributeFilter: ['aria-pressed', 'class'] });
    } else {
      setTimeout(setupMicSync, 1000);
    }
  }

  function initGamepad() {
    renderUI();
    initEditLogic();
    initInputs();

    const toggleBtn = document.getElementById('vpad-toggle-btn');
    const controlsContainer = document.getElementById('vpad-controls-container');

    // Aplica o estado inicial da UI refletindo a inicialização "OFF"
    if (!isGamepadEnabled) {
      toggleBtn.innerHTML = `${ICON.pad} OFF`; 
      toggleBtn.classList.add('is-off'); 
      controlsContainer.classList.add('vpad-hidden');
    }

    document.getElementById('vpad-exit-btn').addEventListener('click', (e) => {
      silenceEvent(e); clickNativeBoosteroidElement('close-session-control');
    }, { capture: true });

    document.getElementById('vpad-clipboard-btn').addEventListener('click', (e) => {
      silenceEvent(e); clickNativeBoosteroidElement('paste-control');
    }, { capture: true });

    document.getElementById('vpad-mic-btn').addEventListener('click', (e) => {
      silenceEvent(e); clickNativeBoosteroidElement('mic-control');
    }, { capture: true });

    document.getElementById('vpad-kb-btn').addEventListener('click', (e) => {
      silenceEvent(e); clickNativeBoosteroidElement('keyboard-control');
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

    // 🚀 AUTO-TOGGLE INTELIGENTE BASEADO NA URL 🚀
    let wasInStream = false;
    
    function checkStreamState() {
      // Checa se a URL contém "streaming" indicando que a sessão do jogo foi aberta
      const isStream = window.location.href.includes('streaming');
      
      if (isStream && !wasInStream) {
        wasInStream = true;
        // O usuário acabou de entrar no jogo, liga o controle automaticamente
        if (!isGamepadEnabled && !isEditMode) {
          isGamepadEnabled = true;
          toggleBtn.innerHTML = `${ICON.pad} ON`; 
          toggleBtn.classList.remove('is-off'); 
          controlsContainer.classList.remove('vpad-hidden'); 
          notifyConnected();
        }
      } else if (!isStream && wasInStream) {
        wasInStream = false;
        // O usuário saiu do jogo e voltou pro catálogo, esconde o controle automaticamente
        if (isGamepadEnabled && !isEditMode) {
          isGamepadEnabled = false;
          toggleBtn.innerHTML = `${ICON.pad} OFF`; 
          toggleBtn.classList.add('is-off'); 
          controlsContainer.classList.add('vpad-hidden'); 
          resetInputs(); 
          notifyDisconnected();
        }
      }
    }
    
    // Roda a verificação a cada 1 segundo (a melhor prática para SPAs que não recarregam a página)
    setInterval(checkStreamState, 1000);
    checkStreamState();

    setupMicSync();
  }

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', initGamepad); } 
  else { initGamepad(); }
  // --- TAMPERMONKEY SPECIFIC: Injeção do Tema MD3 ---
  if (!window.AndroidClipboard) {
    const injectTheme = () => {
      if(document.getElementById('injected-md3-theme')) return;
      const style = document.createElement('style');
      style.id = 'injected-md3-theme';
      style.innerHTML = window.atob('LyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0NCiAgIFRFTUEgTUFURVJJQUwgWU9VIChNRDMpIFBBUkEgQk9PU1RFUk9JRCBDTE9VRFBBRA0KICAgRGVzY3Jpw6fDo286IEVzdGlsaXphw6fDo28gY29tcGxldGEgZGEgaW50ZXJmYWNlIHdlYiBkbyBCb29zdGVyb2lkLg0KICAgPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0gKi8NCg0KLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PQ0KICAgMS4gUkVTRVQgVklTVUFMIEUgQUpVU1RFUyBERSBFU1BBw4dBTUVOVE8gR0xPQkFMDQogICA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09ICovDQovKiBPY3VsdGEgb3MgYmFubmVycyBuYXRpdm9zIGRvIHBhaW5lbCBlIGFzIGFiYXMgZGEgbG9qYSBGYW5hdGljYWwgKi8NCmFwcC1kYXNoYm9hcmQtYmFubmVyLA0KZGFzaGJvYXJkLWJhbm5lci1uYXZpZ2F0aW9ucywNCi5kYXNoYm9hcmRfX2Jhbm5lci13cmFwcGVyLA0KYm9keSAudGFicy0tZmFuYXRpY2FsIHsNCiAgZGlzcGxheTogbm9uZSAhaW1wb3J0YW50Ow0KICBoZWlnaHQ6IDAgIWltcG9ydGFudDsNCiAgbWFyZ2luOiAwICFpbXBvcnRhbnQ7DQogIG9wYWNpdHk6IDAgIWltcG9ydGFudDsNCiAgcG9pbnRlci1ldmVudHM6IG5vbmUgIWltcG9ydGFudDsNCn0NCg0KLyogR2FyYW50ZSB1bSByZXNwaXJvIHN1cGVyaW9yIHBhcmEgYSBiaWJsaW90ZWNhIGRlIGpvZ29zLCBldml0YW5kbyBjb2xhciBubyB0b3BvICovDQpib2R5IC5kYXNoYm9hcmQgLmxpYnJhcnksDQpib2R5ICNkYXNoYm9hcmQtbGlicmFyeSwNCmJvZHkgbGlicmFyeSB7DQogIG1hcmdpbi10b3A6IDMwcHggIWltcG9ydGFudDsNCn0NCg0KLyogQ2VudHJhbGl6YSBlIGFsaW5oYSBwZXJmZWl0YW1lbnRlIGFzIGFiYXMgZGUgbmF2ZWdhw6fDo28gbmEgbWVzbWEgbGluaGEgKi8NCmJvZHkgZmlsdGVyLWxpc3QgdGFicy50YWJzLA0KYm9keSAudGFicy50YWJzLA0KYm9keSAudGFicy1pbm5lci50YWJzLWlubmVyIHsNCiAgYWxpZ24taXRlbXM6IGNlbnRlciAhaW1wb3J0YW50Ow0KfQ0KDQovKiBBZGljaW9uYSB1bSBwYWRkaW5nIGNvbmZvcnTDoXZlbCAocmVzcGlybykgbmEgYmFycmEgZGUgY29udHJvbGUgZGUgZmlsdHJvcyAqLw0KZmlsdGVyLWNvbnRyb2xsZXItd2lkZ2V0IHsNCiAgcGFkZGluZy10b3A6IDE2cHggIWltcG9ydGFudDsNCiAgcGFkZGluZy1ib3R0b206IDE2cHggIWltcG9ydGFudDsNCn0NCg0KLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PQ0KICAgMi4gUEFMRVRBIERFIENPUkVTIE1BVEVSSUFMIFlPVSAoR09MRCAmIERBUksgVEhFTUUpDQogICA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09ICovDQo6cm9vdCwNCiogew0KICAvKiBDb3JlcyBQcmluY2lwYWlzIChBbWFyZWxvIERvdXJhZG8gUHJlbWl1bSBlIE1hcnJvbSBFc2N1cm8pICovDQogIC0tbWQtc3lzLWNvbG9yLXByaW1hcnk6ICNmNWM4MDAgIWltcG9ydGFudDsNCiAgLS1tZC1zeXMtY29sb3Itb24tcHJpbWFyeTogIzUyMzQxMyAhaW1wb3J0YW50Ow0KICAtLW1kLXN5cy1jb2xvci1wcmltYXJ5LWNvbnRhaW5lcjogI2Y1YzgwMCAhaW1wb3J0YW50Ow0KICAtLW1kLXN5cy1jb2xvci1vbi1wcmltYXJ5LWNvbnRhaW5lcjogIzUyMzQxMyAhaW1wb3J0YW50Ow0KDQogIC8qIEZ1bmRvcyBlIFN1cGVyZsOtY2llcyAoR3JhZml0ZSBQcm9mdW5kbykgKi8NCiAgLS1tZC1zeXMtY29sb3ItYmFja2dyb3VuZDogIzFDMUIxRiAhaW1wb3J0YW50Ow0KICAtLW1kLXN5cy1jb2xvci1vbi1iYWNrZ3JvdW5kOiAjRTZFMUU1ICFpbXBvcnRhbnQ7DQogIC0tbWQtc3lzLWNvbG9yLXN1cmZhY2U6ICMxQzFCMUYgIWltcG9ydGFudDsNCiAgLS1tZC1zeXMtY29sb3Itc3VyZmFjZS12YXJpYW50OiAjNDk0NTRGICFpbXBvcnRhbnQ7DQoNCiAgLyogQ29udGFpbmVycyBlIENvbnRvcm5vcyAqLw0KICAtLW1kLXN5cy1jb2xvci1zdXJmYWNlLWNvbnRhaW5lcjogIzJCMjkzMCAhaW1wb3J0YW50Ow0KICAtLW1kLXN5cy1jb2xvci1zdXJmYWNlLWNvbnRhaW5lci1oaWdoOiAjMzYzNDNCICFpbXBvcnRhbnQ7DQogIC0tbWQtc3lzLWNvbG9yLW91dGxpbmU6ICM5MzhGOTkgIWltcG9ydGFudDsNCn0NCg0KLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PQ0KICAgMy4gRlVORE8sIENBQkXDh0FMSE8gRSBQQUlOw4lJUyBERSBJTkZPUk1Bw4fDg08NCiAgID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0gKi8NCi8qIEFwbGljYSBvIGZ1bmRvIGVzY3VybyBnbG9iYWwgZSBmb3LDp2EgYSBmb250ZSBwYWRyw6NvIGRvIHNpc3RlbWEgb3BlcmFjaW9uYWwgKi8NCmh0bWwsDQpib2R5LA0KYm9keSBhcHAtcm9vdCwNCmJvZHkgLm1haW4tYXBwLA0KYm9keSAud3JhcHBlciwNCmJvZHkgLmRhc2hib2FyZCB7DQogIGJhY2tncm91bmQ6IHZhcigtLW1kLXN5cy1jb2xvci1iYWNrZ3JvdW5kKSAhaW1wb3J0YW50Ow0KICBiYWNrZ3JvdW5kLWNvbG9yOiB2YXIoLS1tZC1zeXMtY29sb3ItYmFja2dyb3VuZCkgIWltcG9ydGFudDsNCiAgYmFja2dyb3VuZC1pbWFnZTogbm9uZSAhaW1wb3J0YW50Ow0KICBjb2xvcjogdmFyKC0tbWQtc3lzLWNvbG9yLW9uLWJhY2tncm91bmQpICFpbXBvcnRhbnQ7DQogIGZvbnQtZmFtaWx5OiBzeXN0ZW0tdWksIFJvYm90bywgc2Fucy1zZXJpZiAhaW1wb3J0YW50Ow0KfQ0KDQovKiBFc3RpbGl6YSBvIGNhYmXDp2FsaG8gc3VwZXJpb3IsIHJlbW92ZW5kbyBzb2JyYXMgZSBhZGljaW9uYW5kbyB1bWEgbGluaGEgZGl2aXPDs3JpYSBsaW1wYSAqLw0KYm9keSAuaGVhZGVyLmhlYWRlciB7DQogIGJhY2tncm91bmQ6IHZhcigtLW1kLXN5cy1jb2xvci1zdXJmYWNlKSAhaW1wb3J0YW50Ow0KICBiYWNrZ3JvdW5kLWltYWdlOiBub25lICFpbXBvcnRhbnQ7DQogIGJvcmRlci1ib3R0b206IDFweCBzb2xpZCB2YXIoLS1tZC1zeXMtY29sb3Itc3VyZmFjZS12YXJpYW50KSAhaW1wb3J0YW50Ow0KfQ0KDQpib2R5IC5oZWFkZXI6OmJlZm9yZSwNCmJvZHkgLmhlYWRlcjo6YWZ0ZXIgew0KICBkaXNwbGF5OiBub25lICFpbXBvcnRhbnQ7DQp9DQoNCi8qIFBhaW5lbCBkYSBiYXJyYSBkZSBwZXNxdWlzYSBlIG1lbnVzIGRyb3Bkb3duIChmdW5kbyBsaW1wbykgKi8NCmJvZHkgLmNvbW1hbmQtcGFsZXR0ZV9fcGFuZWwgew0KICBiYWNrZ3JvdW5kOiB2YXIoLS1tZC1zeXMtY29sb3Itc3VyZmFjZSkgIWltcG9ydGFudDsNCn0NCg0KLyogQ29ydGluYXMvQmFja2Ryb3BzIGRvcyBtZW51cyBkZSBmaWx0cm8gYWJlcnRvcyAqLw0KZmlsdGVyLWNvbnRyb2xsZXItd2lkZ2V0IHsNCiAgLS1maWx0ZXJzLWJhY2tkcm9wOiB2YXIoLS1tZC1zeXMtY29sb3ItYmFja2dyb3VuZCkgIWltcG9ydGFudDsNCn0NCg0KLyogUGFpbsOpaXMgY29tIGluZm9ybWHDp8O1ZXMgZG9zIGpvZ29zIChHcmFkaWVudGUgdHJhbnNsw7pjaWRvIHN1YXZlKSAqLw0KYXBwbGljYXRpb24taW5mbywNCmFwcGxpY2F0aW9uLXNob3J0LWluZm8gew0KICBiYWNrZ3JvdW5kOiBsaW5lYXItZ3JhZGllbnQoMTgwZGVnLCB2YXIoLS1hcHBsaWNhdGlvbi11bmRlci1ldWxhLXBhbmVsLXRvcCwgcmdiYSgyOCwgMjcsIDMxLCAuNykpIDAlLCB2YXIoLS1hcHBsaWNhdGlvbi11bmRlci1ldWxhLXBhbmVsLWJvdHRvbSwgcmdiYSgyOCwgMjcsIDMxLCAuNykpIDEwMCUpICFpbXBvcnRhbnQ7DQp9DQoNCi8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0NCiAgIDQuIEJPVMOVRVMsIEFCQVMsIFNFTEVDVFMgRSBGSUxUUk9TIChQSUxMIFNIQVBFUykNCiAgID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0gKi8NCi8qIEJvdMO1ZXMgUHJpbmNpcGFpcyBEZXN0YWNhZG9zIChFeDogSm9nYXIsIEFzc2luYXIpICovDQpib2R5IC5wcmltYXJ5LWJ1dHRvbi5wcmltYXJ5LWJ1dHRvbiwNCmJvZHkgLmJ1dHRvbi1wcmltYXJ5LmJ1dHRvbi1wcmltYXJ5IHsNCiAgYmFja2dyb3VuZDogdmFyKC0tbWQtc3lzLWNvbG9yLXByaW1hcnkpICFpbXBvcnRhbnQ7DQogIGJhY2tncm91bmQtaW1hZ2U6IG5vbmUgIWltcG9ydGFudDsNCiAgY29sb3I6IHZhcigtLW1kLXN5cy1jb2xvci1vbi1wcmltYXJ5KSAhaW1wb3J0YW50Ow0KICBib3JkZXItcmFkaXVzOiAxMDBweCAhaW1wb3J0YW50Ow0KICB0ZXh0LXRyYW5zZm9ybTogbm9uZSAhaW1wb3J0YW50Ow0KICBmb250LXdlaWdodDogNzAwICFpbXBvcnRhbnQ7DQogIGJveC1zaGFkb3c6IG5vbmUgIWltcG9ydGFudDsNCiAgYm9yZGVyOiBub25lICFpbXBvcnRhbnQ7DQp9DQoNCmJvZHkgLnByaW1hcnktYnV0dG9uOjpiZWZvcmUsDQpib2R5IC5idXR0b24tcHJpbWFyeTo6YmVmb3JlLA0KYm9keSAucHJpbWFyeS1idXR0b246OmFmdGVyLA0KYm9keSAuYnV0dG9uLXByaW1hcnk6OmFmdGVyIHsNCiAgZGlzcGxheTogbm9uZSAhaW1wb3J0YW50Ow0KfQ0KDQovKiBCYXJyYSBkZSBQZXNxdWlzYSAoSW5wdXQpICovDQpib2R5IC5jb21tYW5kLXBhbGV0dGVfX3RyaWdnZXIuY29tbWFuZC1wYWxldHRlX190cmlnZ2VyIHsNCiAgYmFja2dyb3VuZDogdmFyKC0tbWQtc3lzLWNvbG9yLXN1cmZhY2UtY29udGFpbmVyLWhpZ2gpICFpbXBvcnRhbnQ7DQogIGJvcmRlci1yYWRpdXM6IDEwMHB4ICFpbXBvcnRhbnQ7DQogIGJvcmRlcjogbm9uZSAhaW1wb3J0YW50Ow0KfQ0KDQovKiBCb3TDtWVzIFNlY3VuZMOhcmlvcywgQWJhcyAoQmlibGlvdGVjYS9Mb2phKSBlIEJvdMOjbyBkZSBMaW1wYXIgRmlsdHJvcyAqLw0KYm9keSAudGFiLWJ1dHRvbi50YWItYnV0dG9uLA0KYm9keSAuc2Vjb25kYXJ5LWJ1dHRvbiwNCmJvZHkgLmFwcGxpY2F0aW9uX19jb250cm9scy1zdG9yZSwNCmJvZHkgLmZpbHRlci1tZW51LWJ1dHRvbi5maWx0ZXItbWVudS1idXR0b24gew0KICBib3JkZXItcmFkaXVzOiAxMDBweCAhaW1wb3J0YW50Ow0KICBib3JkZXI6IDBweCBzb2xpZCB2YXIoLS1tZC1zeXMtY29sb3Itc3VyZmFjZS12YXJpYW50KSAhaW1wb3J0YW50Ow0KICBiYWNrZ3JvdW5kLWNvbG9yOiB2YXIoLS1tZC1zeXMtY29sb3Itc3VyZmFjZS1jb250YWluZXIpICFpbXBvcnRhbnQ7DQogIGNvbG9yOiB2YXIoLS1tZC1zeXMtY29sb3Itb24tYmFja2dyb3VuZCkgIWltcG9ydGFudDsNCiAgdGV4dC10cmFuc2Zvcm06IG5vbmUgIWltcG9ydGFudDsNCiAgZm9udC13ZWlnaHQ6IDUwMCAhaW1wb3J0YW50Ow0KICBkaXNwbGF5OiBmbGV4ICFpbXBvcnRhbnQ7DQogIGFsaWduLWl0ZW1zOiBjZW50ZXIgIWltcG9ydGFudDsNCiAganVzdGlmeS1jb250ZW50OiBjZW50ZXIgIWltcG9ydGFudDsNCiAgbWluLWhlaWdodDogNDBweCAhaW1wb3J0YW50Ow0KICBwYWRkaW5nOiAwIDIwcHggIWltcG9ydGFudDsNCiAgbWFyZ2luOiAwICFpbXBvcnRhbnQ7DQogIGJveC1zaGFkb3c6IG5vbmUgIWltcG9ydGFudDsNCn0NCg0KYm9keSAudGFiLWJ1dHRvbjo6YmVmb3JlLA0KYm9keSAudGFiLWJ1dHRvbjo6YWZ0ZXIgew0KICBkaXNwbGF5OiBub25lICFpbXBvcnRhbnQ7DQp9DQoNCi8qIEVzdGFkb3MgZGUgU2VsZcOnw6NvIChRdWFuZG8gdW1hIEFiYSBvdSBGaWx0cm8gZXN0w6EgYXRpdm8pICovDQpib2R5IC50YWItYnV0dG9uLS1hY3RpdmUudGFiLWJ1dHRvbi0tYWN0aXZlLA0KYm9keSAuZmlsdGVyLW1lbnUtYnV0dG9uLS1hY3RpdmUuZmlsdGVyLW1lbnUtYnV0dG9uLS1hY3RpdmUsDQpib2R5IC5maWx0ZXItbWVudS1idXR0b24tLWlzRGlydHkuZmlsdGVyLW1lbnUtYnV0dG9uLS1pc0RpcnR5IHsNCiAgYmFja2dyb3VuZDogdmFyKC0tbWQtc3lzLWNvbG9yLXByaW1hcnktY29udGFpbmVyKSAhaW1wb3J0YW50Ow0KICBjb2xvcjogdmFyKC0tbWQtc3lzLWNvbG9yLW9uLXByaW1hcnktY29udGFpbmVyKSAhaW1wb3J0YW50Ow0KICBib3JkZXItY29sb3I6IHRyYW5zcGFyZW50ICFpbXBvcnRhbnQ7DQp9DQoNCi8qIEZvcsOnYSDDrWNvbmVzIFNWRyBpbnRlcm5vcyBhIGhlcmRhcmVtIGEgY29yIGRvIHRleHRvIGNvcnJldGFtZW50ZSAqLw0KYm9keSAuZmlsdGVyLW1lbnUtYnV0dG9uLmZpbHRlci1tZW51LWJ1dHRvbiBwIHsNCiAgY29sb3I6IGluaGVyaXQgIWltcG9ydGFudDsNCn0NCg0KYm9keSAuZmlsdGVyLW1lbnUtYnV0dG9uLmZpbHRlci1tZW51LWJ1dHRvbiBzdmcgew0KICBmaWxsOiBjdXJyZW50Q29sb3IgIWltcG9ydGFudDsNCiAgY29sb3I6IGN1cnJlbnRDb2xvciAhaW1wb3J0YW50Ow0KfQ0KDQovKiBEcm9wZG93bnMgLyBTZWxlY3RzIChMaXN0YXMgZGUgUGxhdGFmb3JtYXMpICovDQpib2R5IC5zZWxlY3Quc2VsZWN0IHsNCiAgYmFja2dyb3VuZDogdHJhbnNwYXJlbnQgIWltcG9ydGFudDsNCiAgYm94LXNoYWRvdzogbm9uZSAhaW1wb3J0YW50Ow0KICBib3JkZXI6IG5vbmUgIWltcG9ydGFudDsNCn0NCg0KYm9keSAuc2VsZWN0X19tYWluLnNlbGVjdF9fbWFpbiB7DQogIGJhY2tncm91bmQ6IHZhcigtLW1kLXN5cy1jb2xvci1zdXJmYWNlLXZhcmlhbnQpICFpbXBvcnRhbnQ7DQogIGJvcmRlci1yYWRpdXM6IDEwMHB4ICFpbXBvcnRhbnQ7DQogIGJvcmRlcjogbm9uZSAhaW1wb3J0YW50Ow0KfQ0KDQovKiBGaWx0cm9zIGVtIENoZWNrYm94IChUcmFuc2Zvcm1hZG9zIGVtICJDaGlwcyIgZG8gTUQzKSAqLw0KYm9keSAuY2hlY2tib3gtYnV0dG9uLmNoZWNrYm94LWJ1dHRvbiB7DQogIGJhY2tncm91bmQtY29sb3I6IHZhcigtLW1kLXN5cy1jb2xvci1zdXJmYWNlLWNvbnRhaW5lcikgIWltcG9ydGFudDsNCiAgYm9yZGVyOiAwcHggc29saWQgdmFyKC0tbWQtc3lzLWNvbG9yLXN1cmZhY2UtdmFyaWFudCkgIWltcG9ydGFudDsNCiAgYm9yZGVyLXJhZGl1czogMTAwcHggIWltcG9ydGFudDsNCiAgYm94LXNoYWRvdzogbm9uZSAhaW1wb3J0YW50Ow0KICBwYWRkaW5nOiAwIDE2cHggIWltcG9ydGFudDsNCiAgaGVpZ2h0OiBhdXRvICFpbXBvcnRhbnQ7DQogIG1pbi1oZWlnaHQ6IDQwcHggIWltcG9ydGFudDsNCiAgZGlzcGxheTogZmxleCAhaW1wb3J0YW50Ow0KICBhbGlnbi1pdGVtczogY2VudGVyICFpbXBvcnRhbnQ7DQp9DQoNCmJvZHkgLmNoZWNrYm94LWJ1dHRvbi5hY3RpdmUuY2hlY2tib3gtYnV0dG9uIHsNCiAgYmFja2dyb3VuZDogdmFyKC0tbWQtc3lzLWNvbG9yLXByaW1hcnktY29udGFpbmVyKSAhaW1wb3J0YW50Ow0KICBib3JkZXItY29sb3I6IHRyYW5zcGFyZW50ICFpbXBvcnRhbnQ7DQp9DQoNCmJvZHkgLmNoZWNrYm94X19jaGVja21hcmsgew0KICBkaXNwbGF5OiBub25lICFpbXBvcnRhbnQ7DQogIC8qIEVzY29uZGUgbyBxdWFkcmFkbyBuYXRpdm8gZG8gY2hlY2tib3ggKi8NCn0NCg0KYm9keSAuY2hlY2tib3hfX2xhYmVsIHsNCiAgcGFkZGluZy1sZWZ0OiAwICFpbXBvcnRhbnQ7DQogIGNvbG9yOiB2YXIoLS1tZC1zeXMtY29sb3Itb24tYmFja2dyb3VuZCkgIWltcG9ydGFudDsNCiAgZm9udC13ZWlnaHQ6IDUwMCAhaW1wb3J0YW50Ow0KfQ0KDQpib2R5IC5jaGVja2JveC1idXR0b24uYWN0aXZlLmNoZWNrYm94LWJ1dHRvbiAuY2hlY2tib3hfX2xhYmVsIHsNCiAgY29sb3I6IHZhcigtLW1kLXN5cy1jb2xvci1vbi1wcmltYXJ5LWNvbnRhaW5lcikgIWltcG9ydGFudDsNCn0NCg0KLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PQ0KICAgNS4gQ0FSVMOVRVMgREUgSk9HT1MgRSBHQUxFUklBDQogICA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09ICovDQovKiBMaW1wYSBmdW5kb3MgZSBib3JkYXMgb3JpZ2luYWlzIGRhcyBjYXBhcyBkb3Mgam9nb3MgKi8NCmJvZHkgLnN0b3JlLWl0ZW1fX2ltYWdlLA0KYm9keSAuc3RvcmUtaXRlbV9fb3ZlcmxheSwNCmJvZHkgLnN0b3JlLWl0ZW1fX2luc3RhbGwtc2hvd2Nhc2Ugew0KICBiYWNrZ3JvdW5kOiB2YXIoLS1tZC1zeXMtY29sb3Itc3VyZmFjZS1jb250YWluZXIpICFpbXBvcnRhbnQ7DQogIGJhY2tncm91bmQtY29sb3I6IHZhcigtLW1kLXN5cy1jb2xvci1zdXJmYWNlLWNvbnRhaW5lcikgIWltcG9ydGFudDsNCiAgYmFja2dyb3VuZC1pbWFnZTogbm9uZSAhaW1wb3J0YW50Ow0KICBib3JkZXItcmFkaXVzOiAwICFpbXBvcnRhbnQ7DQogIGJveC1zaGFkb3c6IG5vbmUgIWltcG9ydGFudDsNCiAgYm9yZGVyOiBub25lICFpbXBvcnRhbnQ7DQp9DQoNCi8qIEFwbGljYSBhIGJvcmRhIGVzcGVzc2EgZSBjYW50b3MgYXJyZWRvbmRhZG9zIG5vIGNhcnTDo28gcHJpbmNpcGFsIGRvIGpvZ28gKi8NCmJvZHkgLnN0b3JlLWl0ZW1fX3N1cmZhY2Ugew0KICBiYWNrZ3JvdW5kOiB2YXIoLS1tZC1zeXMtY29sb3Itc3VyZmFjZS1jb250YWluZXIpICFpbXBvcnRhbnQ7DQogIGJvcmRlcjogM3B4IHNvbGlkIHZhcigtLW1kLXN5cy1jb2xvci1zdXJmYWNlLXZhcmlhbnQpICFpbXBvcnRhbnQ7DQogIGJvcmRlci1yYWRpdXM6IDI0cHggIWltcG9ydGFudDsNCiAgb3ZlcmZsb3c6IGhpZGRlbiAhaW1wb3J0YW50Ow0KfQ0KDQovKiBFc3RpbG8gZW0gZm9ybWF0byBkZSBww61sdWxhIHBhcmEgaXRlbnMgZGEgdmlzdWFsaXphw6fDo28gbW9iaWxlICovDQouc3RvcmUtaXRlbV9fbW9iaWxlIHsNCiAgYm9yZGVyLXJhZGl1czogMTAwcHggIWltcG9ydGFudDsNCn0NCg0KLyogUmVtb3ZlIGFydGVmYXRvcyBlIGJvdMO1ZXMgcmVkdW5kYW50ZXMgcG9yIGNpbWEgZGFzIGNhcGFzICovDQpib2R5IC5zdG9yZS1pdGVtX19pbnN0YWxsLXNob3djYXNlOjpiZWZvcmUsDQpib2R5IC5zdG9yZS1pdGVtX19pbnN0YWxsLXNob3djYXNlOjphZnRlciwNCmJvZHkgLnN0b3JlLWl0ZW1fX21vYmlsZS1saW5rcywNCmJvZHkgLml0ZW0tZ2FtZS1pbi0tYWRkIC5zdG9yZS1pdGVtX19zdXJmYWNlOjpiZWZvcmUgew0KICBkaXNwbGF5OiBub25lICFpbXBvcnRhbnQ7DQp9DQoNCi8qIEFuaW1hw6fDo28gc3VhdmUgZGUgZmx1dHVhw6fDo28gYW8gcGFzc2FyIG8gbW91c2Ugb3UgdG9jYXIgKi8NCmJvZHkgLnN0b3JlLWl0ZW0uc3RvcmUtaXRlbSB7DQogIHRyYW5zaXRpb246IHRyYW5zZm9ybSAwLjJzIGVhc2UgIWltcG9ydGFudDsNCn0NCg0KYm9keSAuc3RvcmUtaXRlbTpob3ZlciAuc3RvcmUtaXRlbV9fc3VyZmFjZSwNCmJvZHkgLnN0b3JlLWl0ZW0uc3RvcmUtaXRlbS0taG92ZXJlZCAuc3RvcmUtaXRlbV9fc3VyZmFjZSB7DQogIHRyYW5zZm9ybTogdHJhbnNsYXRlWSgtNHB4KSAhaW1wb3J0YW50Ow0KICBib3gtc2hhZG93OiAwIDhweCAxNnB4IHJnYmEoMCwgMCwgMCwgMC40KSAhaW1wb3J0YW50Ow0KICBiYWNrZ3JvdW5kOiB2YXIoLS1tZC1zeXMtY29sb3Itc3VyZmFjZS1jb250YWluZXItaGlnaCkgIWltcG9ydGFudDsNCiAgYmFja2dyb3VuZC1pbWFnZTogbm9uZSAhaW1wb3J0YW50Ow0KfQ0KDQovKiBFc2N1cmVjZSBhIGltYWdlbSBwYXJhIGRhciBjb250cmFzdGUgYW8gdMOtdHVsbyBxdWFuZG8gdG9jYWRvICovDQpib2R5IC5zdG9yZS1pdGVtX19vdmVybGF5IHsNCiAgYmFja2dyb3VuZDogcmdiYSgyOCwgMjcsIDMxLCAwLjUpICFpbXBvcnRhbnQ7DQp9DQoNCmJvZHkgLnN0b3JlLWl0ZW06aG92ZXIgLnN0b3JlLWl0ZW1fX292ZXJsYXkgew0KICBiYWNrZ3JvdW5kOiByZ2JhKDI4LCAyNywgMzEsIDAuODUpICFpbXBvcnRhbnQ7DQp9DQoNCi8qIFTDrXR1bG9zIGRvcyBqb2dvcyBtYWlzIGxlZ8OtdmVpcyBlIHNlbSBzb21icmFzIGNhZm9uYXMgKi8NCmJvZHkgLml0ZW0tZ2FtZS1pbl9fY29udGVudCBoNCB7DQogIGNvbG9yOiB2YXIoLS1tZC1zeXMtY29sb3Itb24tYmFja2dyb3VuZCkgIWltcG9ydGFudDsNCiAgZm9udC13ZWlnaHQ6IDYwMCAhaW1wb3J0YW50Ow0KICB0ZXh0LXNoYWRvdzogbm9uZSAhaW1wb3J0YW50Ow0KfQ0KDQovKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09DQogICA2LiBCQURHRVMsIEVUSVFVRVRBUyBFIFBMQVRBRk9STUFTDQogICA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09ICovDQovKiBQYWRyb25pemEgYXMgZXRpcXVldGFzIGRlICJOb3ZvIiwgIlN0ZWFtIiwgIkVwaWMiIGNvbSB2aXN1YWwgcMOtbHVsYSBlIGNvciBuZXV0cmEgKi8NCmJvZHkgLmFwcC1iYWRnZSwNCmJvZHkgLnN0b3JlLWl0ZW1fX25ldy1sYWJlbCwNCmJvZHkgLmhvcHBlcl9fYmFkZ2UsDQpib2R5IC5zdG9yZS1pdGVtX19wbGF0Zm9ybSwNCmJvZHkgLmJ1dHRvbi11bmRlci5idXR0b24tdW5kZXIgew0KICBiYWNrZ3JvdW5kOiB2YXIoLS1tZC1zeXMtY29sb3Itc3VyZmFjZS12YXJpYW50KSAhaW1wb3J0YW50Ow0KICBiYWNrZ3JvdW5kLWltYWdlOiBub25lICFpbXBvcnRhbnQ7DQogIGNvbG9yOiB2YXIoLS1tZC1zeXMtY29sb3Itb24tYmFja2dyb3VuZCkgIWltcG9ydGFudDsNCiAgYm9yZGVyOiBub25lICFpbXBvcnRhbnQ7DQogIGJvcmRlci1yYWRpdXM6IDEwMHB4ICFpbXBvcnRhbnQ7DQp9DQoNCmJvZHkgLmFwcC1iYWRnZSAuYXBwLWJhZGdlX190ZXh0IHsNCiAgY29sb3I6IHZhcigtLW1kLXN5cy1jb2xvci1vbi1iYWNrZ3JvdW5kKSAhaW1wb3J0YW50Ow0KfQ0KDQovKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09DQogICA3LiBMSU1QRVpBIERFIElOVEVSRkFDRSAoUkVNT8OHw4NPIERFIEJBTk5FUlMgRSBQT0xVScOHw4NPKQ0KICAgPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSAqLw0KLyogT2N1bHRhIG9zICJVcHN0cm9uYXV0cyIgKE1hc290ZXMpLCBQcm9tb8Onw7VlcyBlIFNlbG9zIGRlIERlc2NvbnRvICovDQpjbG91ZC1ob3BwZXItaXRlbSwNCi5ob3BwZXItaXRlbSwNCi5ob3BwZXIsDQpib2R5IGNhcmQtcHJvbW8sDQpib2R5IC5zdG9yZS1pdGVtX19wcm9tbywNCmJvZHkgLnN0b3JlLWl0ZW1fX3Byb21vLXRleHQsDQpib2R5IC5zdG9yZS1pdGVtX19kaXNjb3VudHMgew0KICBkaXNwbGF5OiBub25lICFpbXBvcnRhbnQ7DQogIG9wYWNpdHk6IDAgIWltcG9ydGFudDsNCiAgcG9pbnRlci1ldmVudHM6IG5vbmUgIWltcG9ydGFudDsNCiAgd2lkdGg6IDAgIWltcG9ydGFudDsNCiAgaGVpZ2h0OiAwICFpbXBvcnRhbnQ7DQogIG1hcmdpbjogMCAhaW1wb3J0YW50Ow0KICBwYWRkaW5nOiAwICFpbXBvcnRhbnQ7DQogIGJhY2tncm91bmQ6IHRyYW5zcGFyZW50ICFpbXBvcnRhbnQ7DQogIGJhY2tncm91bmQtaW1hZ2U6IG5vbmUgIWltcG9ydGFudDsNCn0NCg0KLyogT2N1bHRhIEJvdMOjbyBkbyBTdXBvcnRlIChDYW50byBkYSB0ZWxhKSAqLw0KI2JvdGJ1dHRvbiB7DQogIGRpc3BsYXk6IG5vbmUgIWltcG9ydGFudDsNCn0NCg0KLyogT2N1bHRhIEF2aXNvIEZsdXR1YW50ZSBkZSBDb29raWVzIChDb29raWVZZXMpICovDQouY2t5LWJ0bi1yZXZpc2l0LXdyYXBwZXIsDQouY2t5LXJldmlzaXQtYm90dG9tLWxlZnQgew0KICBkaXNwbGF5OiBub25lICFpbXBvcnRhbnQ7DQp9DQoNCi8qIE9jdWx0YSBCYXJyYSBTdXBlcmlvciBpbnNpc3RpbmRvIHBhcmEgYmFpeGFyIG8gYXBwIG5hdGl2byAqLw0KLmRvd25sb2FkX19hcHAgew0KICBkaXNwbGF5OiBub25lICFpbXBvcnRhbnQ7DQp9DQoNCi8qIExpbXBhIGVmZWl0b3MgZSBwYXJ0w61jdWxhcyBkZSBuZW9uIGRvIGJvdMOjbyAiTWFnaWMiICovDQpib2R5IC5tYWdpYy1idXR0b24ubWFnaWMtYnV0dG9uIHsNCiAgYmFja2dyb3VuZDogdmFyKC0tbWQtc3lzLWNvbG9yLXByaW1hcnkpICFpbXBvcnRhbnQ7DQogIGNvbG9yOiB2YXIoLS1tZC1zeXMtY29sb3Itb24tcHJpbWFyeSkgIWltcG9ydGFudDsNCiAgYm9yZGVyLXJhZGl1czogMTAwcHggIWltcG9ydGFudDsNCiAgYm94LXNoYWRvdzogbm9uZSAhaW1wb3J0YW50Ow0KfQ0KDQpib2R5IC5tYWdpYy1idXR0b25fX2dsb3csDQpib2R5IC5tYWdpYy1idXR0b25fX2ZpbGwsDQpib2R5IC5tYWdpYy1idXR0b25fX3NoaW1tZXIsDQpib2R5IC5tYWdpYy1idXR0b25fX3JpbmcsDQpib2R5IC5tYWdpYy1idXR0b25fX3NwYXJrcyB7DQogIGRpc3BsYXk6IG5vbmUgIWltcG9ydGFudDsNCn0NCg0KLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PQ0KICAgOC4gQ09OVFJPTEVTIERFIEhPVkVSIE5PUyBDQVJUw5VFUyAoSk9HQVIgRSBSRU1PVkVSKQ0KICAgPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSAqLw0KLyogQWp1c3RhIGEgYmFycmEgZGUgYm90w7VlcyBmbHV0dWFudGVzIHBhcmEgbsOjbyBlbmNvc3RhciBuYXMgYm9yZGFzIGRvIGNhcnTDo28gKi8NCmJvZHkgLnN0b3JlLWl0ZW1fX2J1dHRvbnMuc3RvcmUtaXRlbV9fYnV0dG9ucyB7DQogIGJvdHRvbTogMTZweCAhaW1wb3J0YW50Ow0KICBwYWRkaW5nOiAwIDE2cHggIWltcG9ydGFudDsNCiAgZ2FwOiA4cHggIWltcG9ydGFudDsNCiAganVzdGlmeS1jb250ZW50OiBjZW50ZXIgIWltcG9ydGFudDsNCiAgZmxleC13cmFwOiBub3dyYXAgIWltcG9ydGFudDsNCiAgd2lkdGg6IDEwMCUgIWltcG9ydGFudDsNCiAgYm94LXNpemluZzogYm9yZGVyLWJveCAhaW1wb3J0YW50Ow0KfQ0KDQovKiBGb3LDp2EgbyBCb3TDo28gZGUgSm9nYXIgYSBvY3VwYXIgbyBlc3Bhw6dvIHJlc3RhbnRlIChGbGV4IEdyb3cpICovDQpib2R5IC5zdG9yZS1pdGVtX19jb250cm9sLWJ1dHRvbi0tcGxheS5zdG9yZS1pdGVtX19jb250cm9sLWJ1dHRvbi0tcGxheSB7DQogIGZsZXgtZ3JvdzogMSAhaW1wb3J0YW50Ow0KICBtYXJnaW46IDAgIWltcG9ydGFudDsNCiAgd2lkdGg6IGF1dG8gIWltcG9ydGFudDsNCn0NCg0KLyogRm9ybWF0YSBvIEJvdMOjbyBkZSBSZW1vdmVyIGRhIEJpYmxpb3RlY2EgcGFyYSBzZXIgdW0gY8OtcmN1bG8gcGVyZmVpdG8gKi8NCmJvZHkgLnN0b3JlLWl0ZW1fX2NvbnRyb2wtYnV0dG9uLS1zZWNvbmRhcnkuc3RvcmUtaXRlbV9fY29udHJvbC1idXR0b24tLXNlY29uZGFyeSB7DQogIGZsZXg6IDAgMCA0MHB4ICFpbXBvcnRhbnQ7DQogIHdpZHRoOiA0MHB4ICFpbXBvcnRhbnQ7DQogIGhlaWdodDogNDBweCAhaW1wb3J0YW50Ow0KICBtYXJnaW46IDAgIWltcG9ydGFudDsNCn0NCg0KLyogSW5qZcOnw6NvIGRlIMONY29uZSBkZSBMaXhlaXJhIG5vIGJvdMOjbyBkZSByZW1vdmVyLCBvY3VsdGFuZG8gbyBoaWZlbiAoLSkgb3JpZ2luYWwgKi8NCmJvZHkgLnN0b3JlLWl0ZW1fX2NvbnRyb2wtYnV0dG9uLS1zZWNvbmRhcnkgLnNlY29uZGFyeS1idXR0b24gew0KICBiYWNrZ3JvdW5kOiB2YXIoLS1tZC1zeXMtY29sb3Itc3VyZmFjZS12YXJpYW50KSAhaW1wb3J0YW50Ow0KICBjb2xvcjogdHJhbnNwYXJlbnQgIWltcG9ydGFudDsNCiAgYm9yZGVyOiBub25lICFpbXBvcnRhbnQ7DQogIGJvcmRlci1yYWRpdXM6IDEwMHB4ICFpbXBvcnRhbnQ7DQogIHdpZHRoOiAxMDAlICFpbXBvcnRhbnQ7DQogIGhlaWdodDogMTAwJSAhaW1wb3J0YW50Ow0KICBwYWRkaW5nOiAwICFpbXBvcnRhbnQ7DQogIHBvc2l0aW9uOiByZWxhdGl2ZSAhaW1wb3J0YW50Ow0KICBib3gtc2hhZG93OiBub25lICFpbXBvcnRhbnQ7DQogIHRyYW5zaXRpb246IGJhY2tncm91bmQgMC4ycyBlYXNlICFpbXBvcnRhbnQ7DQp9DQoNCmJvZHkgLnN0b3JlLWl0ZW1fX2NvbnRyb2wtYnV0dG9uLS1zZWNvbmRhcnkgLnNlY29uZGFyeS1idXR0b246aG92ZXIgew0KICBiYWNrZ3JvdW5kOiB2YXIoLS1tZC1zeXMtY29sb3Itb3V0bGluZSkgIWltcG9ydGFudDsNCn0NCg0KYm9keSAuc3RvcmUtaXRlbV9fY29udHJvbC1idXR0b24tLXNlY29uZGFyeSAuc2Vjb25kYXJ5LWJ1dHRvbjo6YWZ0ZXIgew0KICBjb250ZW50OiAiIiAhaW1wb3J0YW50Ow0KICBwb3NpdGlvbjogYWJzb2x1dGUgIWltcG9ydGFudDsNCiAgaW5zZXQ6IDAgIWltcG9ydGFudDsNCiAgbWFyZ2luOiBhdXRvICFpbXBvcnRhbnQ7DQogIHdpZHRoOiAyMHB4ICFpbXBvcnRhbnQ7DQogIGhlaWdodDogMjBweCAhaW1wb3J0YW50Ow0KICBiYWNrZ3JvdW5kLWNvbG9yOiB2YXIoLS1tZC1zeXMtY29sb3Itb24tYmFja2dyb3VuZCkgIWltcG9ydGFudDsNCiAgLXdlYmtpdC1tYXNrOiB1cmwoImRhdGE6aW1hZ2Uvc3ZnK3htbCwlM0NzdmcgeG1sbnM9J2h0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnJyB2aWV3Qm94PScwIDAgMjQgMjQnJTNFJTNDcGF0aCBkPSdNNiAxOWMwIDEuMS45IDIgMiAyaDhjMS4xIDAgMi0uOSAyLTJWN0g2djEyek0xOSA0aC0zLjVsLTEtMWgtNWwtMSAxSDV2MmgxNFY0eicvJTNFJTNDL3N2ZyUzRSIpIG5vLXJlcGVhdCBjZW50ZXIgLyBjb250YWluICFpbXBvcnRhbnQ7DQogIG1hc2s6IHVybCgiZGF0YTppbWFnZS9zdmcreG1sLCUzQ3N2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHZpZXdCb3g9JzAgMCAyNCAyNCclM0UlM0NwYXRoIGQ9J002IDE5YzAgMS4xLjkgMiAyIDJoOGMxLjEgMCAyLS45IDItMlY3SDZ2MTJ6TTE5IDRoLTMuNWwtMS0xaC01bC0xIDFINXYyaDE0VjR6Jy8lM0UlM0Mvc3ZnJTNFIikgbm8tcmVwZWF0IGNlbnRlciAvIGNvbnRhaW4gIWltcG9ydGFudDsNCiAgZGlzcGxheTogYmxvY2sgIWltcG9ydGFudDsNCn0NCg0KLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PQ0KICAgOS4gT1ZFUkxBWVMgTkFUSVZPUyBEQSBTRVNTw4NPIERFIEpPR08NCiAgID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0gKi8NCi8qIE9jdWx0YSBvcyBib3TDtWVzIG1vYmlsZSBkbyBwcsOzcHJpbyBCb29zdGVyb2lkLCBsaWJlcmFuZG8gYSB0ZWxhIHBhcmEgbm9zc28gR2FtZXBhZCBWaXJ0dWFsICovDQojbWVudS5tX21lbnVfd3JhcHBlciB7DQogIG9wYWNpdHk6IDAgIWltcG9ydGFudDsNCiAgcG9pbnRlci1ldmVudHM6IG5vbmUgIWltcG9ydGFudDsNCiAgdHJhbnNmb3JtOiBzY2FsZSgwKSAhaW1wb3J0YW50Ow0KICB6LWluZGV4OiAtOTk5OSAhaW1wb3J0YW50Ow0KfQ0KDQovKiBPY3VsdGEgYWxlcnRhcyBuYXRpdm9zICgiVG9xdWUgbmEgdGVsYSIsICJBdmlzbyBkZSByZWRlIGZyYWNhIikgcXVlIHBvbHVlbSBhIFVJIGR1cmFudGUgbyBqb2dvICovDQouaXBob25lX3RhcF9tZXNzYWdlLA0KLm1fbGFuX3dyYXBwZXIgew0KICBkaXNwbGF5OiBub25lICFpbXBvcnRhbnQ7DQp9DQoNCi8qIFJlbW92ZSBhIHByb3ByaWVkYWRlIHN0aWNreSAocXVlIGNhdXNhIGJ1Z3MgdmlzdWFpcyBubyB0b3BvKSBkYSBiYXJyYSBkZSBmaWx0cm8gbmF0aXZhICovDQpmaWx0ZXItY29udHJvbGxlci13aWRnZXQuZWxlbWVudC1zdGlja3kgew0KICBwb3NpdGlvbjogc3RhdGljICFpbXBvcnRhbnQ7DQp9LyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0NCiAgIFRFTUEgTUFURVJJQUwgWU9VIChNRDMpIC0gUMOBR0lOQSBERSBQRVJGSUwgRSBDT05GSUdVUkHDh8OVRVMNCiAgIERlc2NyacOnw6NvOiBFc3RpbGl6YcOnw6NvIHByZW1pdW0gZSBjb3JyZcOnw6NvIHJlc3BvbnNpdmEgZGUgdG9kYXMgYXMgY29udGFzIGUgYWp1c3Rlcy4NCiAgID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09ICovDQoNCi8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0NCiAgIDEuIExBWU9VVCBHRVJBTCBFIE5BVkVHQcOHw4NPIFJFU1BPTlNJVkEgKFNJREVCQVIpDQogICA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09ICovDQpib2R5IC5wcm9maWxlIC53cmFwcGVyIHsNCiAgZGlzcGxheTogZmxleCAhaW1wb3J0YW50Ow0KICBtYXgtd2lkdGg6IDEwMCUgIWltcG9ydGFudDsNCiAgcGFkZGluZzogMCAhaW1wb3J0YW50Ow0KICBnYXA6IDI0cHggIWltcG9ydGFudDsNCiAgYm94LXNpemluZzogYm9yZGVyLWJveCAhaW1wb3J0YW50Ow0KfQ0KDQpib2R5IC5hY2NvdW50X19oZWFkaW5nIHsNCiAgY29sb3I6IHZhcigtLW1kLXN5cy1jb2xvci1vbi1iYWNrZ3JvdW5kKSAhaW1wb3J0YW50Ow0KICBmb250LXNpemU6IDI4cHggIWltcG9ydGFudDsNCiAgcGFkZGluZzogMjRweCAxMnB4IDE2cHggMTJweCAhaW1wb3J0YW50Ow0KICBmb250LXdlaWdodDogNzAwICFpbXBvcnRhbnQ7DQogIG1hcmdpbjogMCAhaW1wb3J0YW50Ow0KICBsZXR0ZXItc3BhY2luZzogLTAuNXB4ICFpbXBvcnRhbnQ7DQp9DQoNCi8qIE5hdmVnYcOnw6NvIEhvcml6b250YWwgTW9iaWxlICovDQpAbWVkaWEgKG1heC13aWR0aDogOTAwcHgpIHsNCiAgYm9keSAucHJvZmlsZSAud3JhcHBlciB7DQogICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbiAhaW1wb3J0YW50Ow0KICAgIGdhcDogMCAhaW1wb3J0YW50Ow0KICB9DQoNCiAgYm9keSBzaWRlYmFyIHsNCiAgICB3aWR0aDogMTAwJSAhaW1wb3J0YW50Ow0KICAgIGhlaWdodDogYXV0byAhaW1wb3J0YW50Ow0KICAgIHBvc2l0aW9uOiBzdGlja3kgIWltcG9ydGFudDsNCiAgICB0b3A6IDAgIWltcG9ydGFudDsNCiAgICB6LWluZGV4OiAxMDAgIWltcG9ydGFudDsNCiAgICBiYWNrZ3JvdW5kOiB2YXIoLS1tZC1zeXMtY29sb3ItYmFja2dyb3VuZCkgIWltcG9ydGFudDsNCiAgICBib3JkZXItYm90dG9tOiAxcHggc29saWQgdmFyKC0tbWQtc3lzLWNvbG9yLXN1cmZhY2UtdmFyaWFudCkgIWltcG9ydGFudDsNCiAgfQ0KDQogIGJvZHkgLnByb2ZpbGVfX25hdmlnYXRpb24gew0KICAgIHdpZHRoOiAxMDAlICFpbXBvcnRhbnQ7DQogICAgcGFkZGluZzogMCAhaW1wb3J0YW50Ow0KICB9DQoNCiAgYm9keSAucHJvZmlsZV9fbmF2aWdhdGlvbi1ncmFkaWVudCB7DQogICAgZGlzcGxheTogbm9uZSAhaW1wb3J0YW50Ow0KICB9DQoNCiAgYm9keSAucHJvZmlsZV9fbWFpbi1tZW51IHsNCiAgICBkaXNwbGF5OiBmbGV4ICFpbXBvcnRhbnQ7DQogICAgZmxleC1kaXJlY3Rpb246IHJvdyAhaW1wb3J0YW50Ow0KICAgIGp1c3RpZnktY29udGVudDogZmxleC1zdGFydCAhaW1wb3J0YW50Ow0KICAgIG92ZXJmbG93LXg6IGF1dG8gIWltcG9ydGFudDsNCiAgICBnYXA6IDhweCAhaW1wb3J0YW50Ow0KICAgIHBhZGRpbmc6IDEycHggMTZweCAhaW1wb3J0YW50Ow0KICAgIG1hcmdpbjogMCAhaW1wb3J0YW50Ow0KICAgIC13ZWJraXQtb3ZlcmZsb3ctc2Nyb2xsaW5nOiB0b3VjaCAhaW1wb3J0YW50Ow0KICB9DQoNCiAgYm9keSAucHJvZmlsZV9fbWFpbi1tZW51IGxpIHsNCiAgICBmbGV4OiAwIDAgYXV0byAhaW1wb3J0YW50Ow0KICAgIHdpZHRoOiBhdXRvICFpbXBvcnRhbnQ7DQogICAgbWFyZ2luOiAwICFpbXBvcnRhbnQ7DQogIH0NCg0KICBib2R5IC5wcm9maWxlX19tYWluLW1lbnUgYSB7DQogICAgZGlzcGxheTogZmxleCAhaW1wb3J0YW50Ow0KICAgIGFsaWduLWl0ZW1zOiBjZW50ZXIgIWltcG9ydGFudDsNCiAgICBwYWRkaW5nOiA4cHggMTZweCAhaW1wb3J0YW50Ow0KICAgIGJvcmRlci1yYWRpdXM6IDEwMHB4ICFpbXBvcnRhbnQ7DQogICAgYmFja2dyb3VuZDogdmFyKC0tbWQtc3lzLWNvbG9yLXN1cmZhY2UtY29udGFpbmVyKSAhaW1wb3J0YW50Ow0KICAgIGNvbG9yOiB2YXIoLS1tZC1zeXMtY29sb3Itb24tYmFja2dyb3VuZCkgIWltcG9ydGFudDsNCiAgICB3aGl0ZS1zcGFjZTogbm93cmFwICFpbXBvcnRhbnQ7DQogICAgZm9udC13ZWlnaHQ6IDUwMCAhaW1wb3J0YW50Ow0KICB9DQoNCiAgYm9keSAucHJvZmlsZV9fbWFpbi1tZW51IGEuYWN0aXZlIHsNCiAgICBiYWNrZ3JvdW5kOiB2YXIoLS1tZC1zeXMtY29sb3ItcHJpbWFyeS1jb250YWluZXIpICFpbXBvcnRhbnQ7DQogICAgY29sb3I6IHZhcigtLW1kLXN5cy1jb2xvci1vbi1wcmltYXJ5LWNvbnRhaW5lcikgIWltcG9ydGFudDsNCiAgfQ0KDQogIGJvZHkgLnByb2ZpbGVfX21haW4tbWVudSBhIHN2ZyB7DQogICAgbWFyZ2luLWJvdHRvbTogMCAhaW1wb3J0YW50Ow0KICAgIG1hcmdpbi1yaWdodDogOHB4ICFpbXBvcnRhbnQ7DQogIH0NCg0KICBib2R5IC5wcm9maWxlX19tYWluLW1lbnUgYS5hY3RpdmUgc3ZnIHBhdGgsDQogIGJvZHkgLnByb2ZpbGVfX21haW4tbWVudSBhLmFjdGl2ZSBzdmcgZWxsaXBzZSwNCiAgYm9keSAucHJvZmlsZV9fbWFpbi1tZW51IGEuYWN0aXZlIHN2ZyByZWN0IHsNCiAgICBmaWxsOiB2YXIoLS1tZC1zeXMtY29sb3Itb24tcHJpbWFyeS1jb250YWluZXIpICFpbXBvcnRhbnQ7DQogIH0NCn0NCg0KLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PQ0KICAgMi4gUEFEUk9OSVpBw4fDg08gREUgQ0FSRFMgRSBDT05UQUlORVJTIChNRDMpDQogICA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09ICovDQpib2R5IC5hY2NvdW50X19jb250ZW50LA0KYm9keSAuYWNjb3VudC1jb250ZW50X193cmFwIHsNCiAgbWF4LXdpZHRoOiAxMDAlICFpbXBvcnRhbnQ7DQogIHBhZGRpbmc6IDAgOHB4ICFpbXBvcnRhbnQ7DQogIGJveC1zaXppbmc6IGJvcmRlci1ib3ggIWltcG9ydGFudDsNCn0NCg0KYm9keSAuY29udGVudC1ib3hfX2NhcmQsDQpib2R5IC5zeW5jLXBsYXRmb3JtLA0KYm9keSAuaG90a2V5LXNldHRpbmcsDQpib2R5IC5hY2NvdW50LWRpc2NvcmQsDQpib2R5IC5ndWlkZS1jYXJkIHsNCiAgYmFja2dyb3VuZDogdmFyKC0tbWQtc3lzLWNvbG9yLXN1cmZhY2UtY29udGFpbmVyKSAhaW1wb3J0YW50Ow0KICBib3JkZXItcmFkaXVzOiAyNHB4ICFpbXBvcnRhbnQ7DQogIGJvcmRlcjogbm9uZSAhaW1wb3J0YW50Ow0KICBib3gtc2hhZG93OiBub25lICFpbXBvcnRhbnQ7DQogIHBhZGRpbmc6IDIwcHggIWltcG9ydGFudDsNCiAgbWFyZ2luLWJvdHRvbTogMTZweCAhaW1wb3J0YW50Ow0KICBib3gtc2l6aW5nOiBib3JkZXItYm94ICFpbXBvcnRhbnQ7DQp9DQoNCi8qIFJlbW92ZSBlc3RpbG9zIGRlIGNvbnRhaW5lcnMgcGFyYSBldml0YXIgZHVwbG8gcGFkZGluZyAqLw0KYm9keSAuY29ubmVjdC1hY2NvdW50X19jYXJkLA0KYm9keSAuZ3VpZGUtaW5uZXIgew0KICBiYWNrZ3JvdW5kOiB0cmFuc3BhcmVudCAhaW1wb3J0YW50Ow0KICBwYWRkaW5nOiAwICFpbXBvcnRhbnQ7DQogIG1hcmdpbjogMCAhaW1wb3J0YW50Ow0KICBib3gtc2hhZG93OiBub25lICFpbXBvcnRhbnQ7DQp9DQoNCi8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0NCiAgIDMuIENBQkXDh0FMSE9TLCBUw41UVUxPUyBFIEJPVMOVRVMgREUgQcOHw4NPIChFRElUQVIgUEVSRklMKQ0KICAgPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSAqLw0KYm9keSAuY29udGVudC1ib3hfX2hlYWQgew0KICBkaXNwbGF5OiBmbGV4ICFpbXBvcnRhbnQ7DQogIGZsZXgtZGlyZWN0aW9uOiByb3ctcmV2ZXJzZSAhaW1wb3J0YW50Ow0KICBmbGV4LXdyYXA6IHdyYXAgIWltcG9ydGFudDsNCiAganVzdGlmeS1jb250ZW50OiBmbGV4LWVuZCAhaW1wb3J0YW50Ow0KICBhbGlnbi1pdGVtczogY2VudGVyICFpbXBvcnRhbnQ7DQogIGdhcDogMTZweCAhaW1wb3J0YW50Ow0KICBtYXJnaW4tYm90dG9tOiAxNnB4ICFpbXBvcnRhbnQ7DQogIHdpZHRoOiAxMDAlICFpbXBvcnRhbnQ7DQp9DQoNCmJvZHkgLmNvbnRlbnQtYm94X19oZWFkLWluZm8gew0KICBkaXNwbGF5OiBmbGV4ICFpbXBvcnRhbnQ7DQogIGFsaWduLWl0ZW1zOiBjZW50ZXIgIWltcG9ydGFudDsNCiAgZmxleC13cmFwOiB3cmFwICFpbXBvcnRhbnQ7DQogIGdhcDogMTJweCAhaW1wb3J0YW50Ow0KICBmbGV4LWdyb3c6IDEgIWltcG9ydGFudDsNCn0NCg0KYm9keSAuY29udGVudC1ib3hfX2hlYWQtY29udHJvbHMgew0KICBkaXNwbGF5OiBmbGV4ICFpbXBvcnRhbnQ7DQogIGZsZXgtd3JhcDogd3JhcCAhaW1wb3J0YW50Ow0KICBnYXA6IDEycHggIWltcG9ydGFudDsNCn0NCg0KYm9keSAuY29udGVudC1ib3hfX2hlYWQtdGl0bGUsDQpib2R5IC5zeW5jLXBsYXRmb3JtX190aXRsZSwNCmJvZHkgLmFjY291bnQtY29udGVudF9fZGlzY29yZC10aXRsZSB7DQogIGNvbG9yOiB2YXIoLS1tZC1zeXMtY29sb3ItcHJpbWFyeSkgIWltcG9ydGFudDsNCiAgZm9udC13ZWlnaHQ6IDYwMCAhaW1wb3J0YW50Ow0KICBmb250LXNpemU6IDEzcHggIWltcG9ydGFudDsNCiAgdGV4dC10cmFuc2Zvcm06IHVwcGVyY2FzZSAhaW1wb3J0YW50Ow0KICBsZXR0ZXItc3BhY2luZzogMC41cHggIWltcG9ydGFudDsNCiAgbWFyZ2luLWJvdHRvbTogMCAhaW1wb3J0YW50Ow0KfQ0KDQpib2R5IC5jb250ZW50LWJveF9fdGV4dCwNCmJvZHkgLnByb2ZpbGUtZGF0YV9fb3RoZXItdGV4dCwNCmJvZHkgLmhvdGtleS1zZXR0aW5nX19kZXNjcmlwdGlvbiwNCmJvZHkgLmNvbm5lY3QtYWNjb3VudF9faW5mby10ZXh0LA0KYm9keSAuc3luYy1wbGF0Zm9ybV9fdG9wLWNhcHRpb24gew0KICBjb2xvcjogdmFyKC0tbWQtc3lzLWNvbG9yLW91dGxpbmUpICFpbXBvcnRhbnQ7DQogIGZvbnQtc2l6ZTogMTNweCAhaW1wb3J0YW50Ow0KICBsaW5lLWhlaWdodDogMS41ICFpbXBvcnRhbnQ7DQp9DQoNCmJvZHkgLmNvbm5lY3QtYWNjb3VudF9fdGV4dCwNCmJvZHkgLmNvbm5lY3QtYWNjb3VudF9faW5mbyB7DQogIHBhZGRpbmc6IDAgOHB4ICFpbXBvcnRhbnQ7DQp9DQoNCmJvZHkgLnByb2ZpbGUtZGF0YV9fbmFtZSwNCmJvZHkgLnN1YnNjcmlwdGlvbi1jYXJkX190aXRsZSwNCmJvZHkgLnN5bmMtcGxhdGZvcm1fX3VzZXJuYW1lIHAgew0KICBjb2xvcjogdmFyKC0tbWQtc3lzLWNvbG9yLW9uLWJhY2tncm91bmQpICFpbXBvcnRhbnQ7DQogIGZvbnQtd2VpZ2h0OiA2MDAgIWltcG9ydGFudDsNCn0NCg0KLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PQ0KICAgNC4gVE9HR0xFUyBNRDMgRSBCQURHRVMNCiAgID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0gKi8NCmJvZHkgYXBwLXN3aXRjaGVyIHsNCiAgZGlzcGxheTogaW5saW5lLWZsZXggIWltcG9ydGFudDsNCiAgYWxpZ24taXRlbXM6IGNlbnRlciAhaW1wb3J0YW50Ow0KICBjdXJzb3I6IHBvaW50ZXIgIWltcG9ydGFudDsNCn0NCg0KYm9keSBhcHAtc3dpdGNoZXIgc3ZnIHsNCiAgd2lkdGg6IDQ0cHggIWltcG9ydGFudDsNCiAgaGVpZ2h0OiAyNnB4ICFpbXBvcnRhbnQ7DQogIGRpc3BsYXk6IGJsb2NrICFpbXBvcnRhbnQ7DQp9DQoNCmJvZHkgYXBwLXN3aXRjaGVyIHN2ZyByZWN0LA0KYm9keSBhcHAtc3dpdGNoZXIgc3ZnIGNpcmNsZSB7DQogIHRyYW5zaXRpb246IGFsbCAwLjNzIGN1YmljLWJlemllcigwLjIsIDAuOCwgMC4yLCAxKSAhaW1wb3J0YW50Ow0KfQ0KDQpib2R5IGFwcC1zd2l0Y2hlciBzdmc6bm90KC5ub3QtYWN0aXZlKSByZWN0IHsNCiAgZmlsbDogdmFyKC0tbWQtc3lzLWNvbG9yLXByaW1hcnkpICFpbXBvcnRhbnQ7DQogIG9wYWNpdHk6IDAuNCAhaW1wb3J0YW50Ow0KfQ0KDQpib2R5IGFwcC1zd2l0Y2hlciBzdmc6bm90KC5ub3QtYWN0aXZlKSBjaXJjbGUgew0KICBmaWxsOiB2YXIoLS1tZC1zeXMtY29sb3ItcHJpbWFyeSkgIWltcG9ydGFudDsNCn0NCg0KYm9keSBhcHAtc3dpdGNoZXIgc3ZnLm5vdC1hY3RpdmUgcmVjdCB7DQogIGZpbGw6IHZhcigtLW1kLXN5cy1jb2xvci1zdXJmYWNlLXZhcmlhbnQpICFpbXBvcnRhbnQ7DQogIG9wYWNpdHk6IDEgIWltcG9ydGFudDsNCn0NCg0KYm9keSBhcHAtc3dpdGNoZXIgc3ZnLm5vdC1hY3RpdmUgY2lyY2xlIHsNCiAgZmlsbDogdmFyKC0tbWQtc3lzLWNvbG9yLW91dGxpbmUpICFpbXBvcnRhbnQ7DQp9DQoNCmJvZHkgLnBsYXktcG9zc2liaWxpdHktLXRydWUgew0KICBiYWNrZ3JvdW5kOiAjMEY1MjIzICFpbXBvcnRhbnQ7DQogIGNvbG9yOiAjNkRENThDICFpbXBvcnRhbnQ7DQogIHBhZGRpbmc6IDRweCAxMnB4ICFpbXBvcnRhbnQ7DQogIGJvcmRlci1yYWRpdXM6IDEwMHB4ICFpbXBvcnRhbnQ7DQogIGZvbnQtd2VpZ2h0OiA3MDAgIWltcG9ydGFudDsNCiAgZm9udC1zaXplOiAxMXB4ICFpbXBvcnRhbnQ7DQogIGxldHRlci1zcGFjaW5nOiAwLjVweCAhaW1wb3J0YW50Ow0KICB0ZXh0LXRyYW5zZm9ybTogdXBwZXJjYXNlICFpbXBvcnRhbnQ7DQogIG1hcmdpbjogMCAhaW1wb3J0YW50Ow0KfQ0KDQovKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09DQogICA1LiBBIE1JTkhBIFNVQlNDUknDh8ODTw0KICAgPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSAqLw0KYm9keSAuc3Vic2NyaXB0aW9uLWNhcmRfX2N1cnJlbnQgew0KICBkaXNwbGF5OiBmbGV4ICFpbXBvcnRhbnQ7DQogIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW4gIWltcG9ydGFudDsNCiAgZ2FwOiAxNnB4ICFpbXBvcnRhbnQ7DQp9DQoNCmJvZHkgLnN1YnNjcmlwdGlvbi1jYXJkX19oZWFkZXIgew0KICBkaXNwbGF5OiBmbGV4ICFpbXBvcnRhbnQ7DQogIGp1c3RpZnktY29udGVudDogc3BhY2UtYmV0d2VlbiAhaW1wb3J0YW50Ow0KICBhbGlnbi1pdGVtczogZmxleC1zdGFydCAhaW1wb3J0YW50Ow0KICBmbGV4LXdyYXA6IHdyYXAgIWltcG9ydGFudDsNCiAgZ2FwOiAxMnB4ICFpbXBvcnRhbnQ7DQp9DQoNCmJvZHkgLnN1YnNjcmlwdGlvbi1jYXJkX19zdGF0dXMgew0KICBiYWNrZ3JvdW5kOiB2YXIoLS1tZC1zeXMtY29sb3Itc3VyZmFjZS12YXJpYW50KSAhaW1wb3J0YW50Ow0KICBjb2xvcjogdmFyKC0tbWQtc3lzLWNvbG9yLW9uLWJhY2tncm91bmQpICFpbXBvcnRhbnQ7DQogIHBhZGRpbmc6IDRweCAxMnB4ICFpbXBvcnRhbnQ7DQogIGJvcmRlci1yYWRpdXM6IDEwMHB4ICFpbXBvcnRhbnQ7DQogIGZvbnQtc2l6ZTogMTFweCAhaW1wb3J0YW50Ow0KICBmb250LXdlaWdodDogNzAwICFpbXBvcnRhbnQ7DQogIGxldHRlci1zcGFjaW5nOiAwLjVweCAhaW1wb3J0YW50Ow0KICB0ZXh0LXRyYW5zZm9ybTogdXBwZXJjYXNlICFpbXBvcnRhbnQ7DQp9DQoNCmJvZHkgLnN1YnNjcmlwdGlvbi1jYXJkX19mb290ZXIgew0KICBkaXNwbGF5OiBmbGV4ICFpbXBvcnRhbnQ7DQogIGp1c3RpZnktY29udGVudDogc3BhY2UtYmV0d2VlbiAhaW1wb3J0YW50Ow0KICBhbGlnbi1pdGVtczogY2VudGVyICFpbXBvcnRhbnQ7DQogIGZsZXgtd3JhcDogd3JhcCAhaW1wb3J0YW50Ow0KICBnYXA6IDE2cHggIWltcG9ydGFudDsNCiAgYmFja2dyb3VuZDogdHJhbnNwYXJlbnQgIWltcG9ydGFudDsNCiAgcGFkZGluZzogMCAhaW1wb3J0YW50Ow0KICBib3JkZXI6IG5vbmUgIWltcG9ydGFudDsNCn0NCg0KLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PQ0KICAgNi4gTElHQcOHw5VFUyBFIFNUUkVBTUlORyAoQk9Uw5VFUyBFIExJTVBFWkEgREUgw41DT05FUykNCiAgID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0gKi8NCmJvZHkgLnN5bmMtcGxhdGZvcm0gew0KICBkaXNwbGF5OiBmbGV4ICFpbXBvcnRhbnQ7DQogIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW4gIWltcG9ydGFudDsNCiAgZ2FwOiAxNnB4ICFpbXBvcnRhbnQ7DQp9DQoNCmJvZHkgLnN5bmMtcGxhdGZvcm1fX2lubmVyIHsNCiAgcGFkZGluZy1sZWZ0OiBub25lICFpbXBvcnRhbnQ7DQogIHBhZGRpbmctcmlnaHQ6IG5vbmUgIWltcG9ydGFudDsNCiAgYmFja2dyb3VuZDogdHJhbnNwYXJlbnQgIWltcG9ydGFudDsNCiAgYm94LXNoYWRvdzogbm9uZSAhaW1wb3J0YW50Ow0KfQ0KDQpib2R5IC5zeW5jLXBsYXRmb3JtX19ib2R5LA0KYm9keSAuY29udGVudC1ib3hfX2ZsZXgtbGluZSB7DQogIGRpc3BsYXk6IGZsZXggIWltcG9ydGFudDsNCiAganVzdGlmeS1jb250ZW50OiBzcGFjZS1iZXR3ZWVuICFpbXBvcnRhbnQ7DQogIGFsaWduLWl0ZW1zOiBjZW50ZXIgIWltcG9ydGFudDsNCiAgZmxleC13cmFwOiB3cmFwICFpbXBvcnRhbnQ7DQogIGdhcDogMTZweCAhaW1wb3J0YW50Ow0KfQ0KDQpib2R5IC5zeW5jLXBsYXRmb3JtX19sZWZ0LXNpZGUgew0KICBkaXNwbGF5OiBmbGV4ICFpbXBvcnRhbnQ7DQogIGFsaWduLWl0ZW1zOiBjZW50ZXIgIWltcG9ydGFudDsNCiAgZ2FwOiAxMnB4ICFpbXBvcnRhbnQ7DQp9DQoNCi8qIEJvdMO1ZXMgVG9uYWwgTUQzIHBhZHJvbml6YWRvcyAqLw0KYm9keSAuc3luYy1wbGF0Zm9ybV9fYnV0dG9uLA0KYm9keSAuY29udGVudC1ib3hfX2NvbnRyb2wtYnRuLA0KYm9keSAuc3Vic2NyaXB0aW9uLWNhcmRfX2luZm8tYnV0dG9uLA0KYm9keSAuaG90a2V5LXNldHRpbmdfX3Jlc2V0LWJ0biB7DQogIGJhY2tncm91bmQ6IHZhcigtLW1kLXN5cy1jb2xvci1zdXJmYWNlLXZhcmlhbnQpICFpbXBvcnRhbnQ7DQogIGNvbG9yOiB2YXIoLS1tZC1zeXMtY29sb3Itb24tYmFja2dyb3VuZCkgIWltcG9ydGFudDsNCiAgYm9yZGVyLXJhZGl1czogMTAwcHggIWltcG9ydGFudDsNCiAgcGFkZGluZzogMTBweCAyMHB4ICFpbXBvcnRhbnQ7DQogIGZvbnQtd2VpZ2h0OiA2MDAgIWltcG9ydGFudDsNCiAgZm9udC1zaXplOiAxM3B4ICFpbXBvcnRhbnQ7DQogIGRpc3BsYXk6IGZsZXggIWltcG9ydGFudDsNCiAgYWxpZ24taXRlbXM6IGNlbnRlciAhaW1wb3J0YW50Ow0KICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlciAhaW1wb3J0YW50Ow0KICBnYXA6IDhweCAhaW1wb3J0YW50Ow0KICBib3JkZXI6IG5vbmUgIWltcG9ydGFudDsNCiAgYm94LXNoYWRvdzogbm9uZSAhaW1wb3J0YW50Ow0KICBoZWlnaHQ6IGF1dG8gIWltcG9ydGFudDsNCiAgbWFyZ2luOiAwICFpbXBvcnRhbnQ7DQogIHdpZHRoOiBtYXgtY29udGVudCAhaW1wb3J0YW50Ow0KICBmbGV4OiBub25lICFpbXBvcnRhbnQ7DQogIHRleHQtdHJhbnNmb3JtOiBub25lICFpbXBvcnRhbnQ7DQp9DQoNCmJvZHkgLnN5bmMtcGxhdGZvcm1fX2J1dHRvbnMgew0KICBkaXNwbGF5OiBmbGV4ICFpbXBvcnRhbnQ7DQogIGdhcDogMTJweCAhaW1wb3J0YW50Ow0KICBmbGV4LXdyYXA6IHdyYXAgIWltcG9ydGFudDsNCiAganVzdGlmeS1jb250ZW50OiBmbGV4LWVuZCAhaW1wb3J0YW50Ow0KfQ0KDQovKiBUZXh0byBkb3MgQm90w7VlcyAqLw0KYm9keSAuc3luYy1wbGF0Zm9ybV9fYnV0dG9uIHAsDQpib2R5IC5jb250ZW50LWJveF9fY29udHJvbC1idG4gc3BhbiB7DQogIGNvbG9yOiB2YXIoLS1tZC1zeXMtY29sb3Itb24tYmFja2dyb3VuZCkgIWltcG9ydGFudDsNCiAgbWFyZ2luOiAwICFpbXBvcnRhbnQ7DQogIHRleHQtdHJhbnNmb3JtOiBjYXBpdGFsaXplICFpbXBvcnRhbnQ7DQp9DQoNCi8qIFJFTU/Dh8ODTyBUT1RBTCBET1Mgw41DT05FUyBST1NBUy9RVUVCUkFET1MgTk9TIEJPVMOVRVMgREUgQcOHw4NPICovDQpib2R5IC5zeW5jLXBsYXRmb3JtX19idXR0b24gaW1nLA0KYm9keSAuc3luYy1wbGF0Zm9ybV9fYnV0dG9uIHN2Zy1pY29uLA0KYm9keSAuY29udGVudC1ib3hfX2NvbnRyb2xzLS1wYiAuY29udGVudC1ib3hfX2NvbnRyb2wtYnRuIGltZywNCmJvZHkgLmNvbnRlbnQtYm94X19jb250cm9scy0tcGIgLmNvbnRlbnQtYm94X19jb250cm9sLWJ0biBzdmctaWNvbiB7DQogIGRpc3BsYXk6IG5vbmUgIWltcG9ydGFudDsNCn0NCg0KLyogTWFudMOpbSBvcyDDrWNvbmVzIGZ1bmNpb25haXMgKEVkaXRhciBQZXJmaWwsIEFsdGVyYXIgU2VuaGEpIGNvbSBhIGNvciBjb3JyZXRhICovDQpib2R5IC5jb250ZW50LWJveF9fY29udHJvbC1idG4gc3ZnIHBhdGggew0KICBmaWxsOiB2YXIoLS1tZC1zeXMtY29sb3Itb24tYmFja2dyb3VuZCkgIWltcG9ydGFudDsNCn0NCg0KYm9keSAuc3luYy1wbGF0Zm9ybV9fdG9wIHsNCiAgZGlzcGxheTogZmxleCAhaW1wb3J0YW50Ow0KICBmbGV4LWRpcmVjdGlvbjogY29sdW1uICFpbXBvcnRhbnQ7DQogIGdhcDogNHB4ICFpbXBvcnRhbnQ7DQogIHBhZGRpbmctdG9wOiAxMnB4ICFpbXBvcnRhbnQ7DQogIGJvcmRlci10b3A6IDFweCBzb2xpZCB2YXIoLS1tZC1zeXMtY29sb3Itc3VyZmFjZS12YXJpYW50KSAhaW1wb3J0YW50Ow0KfQ0KDQovKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09DQogICA3LiBDT05Ww41WSU8gRSBST0RBUMOJDQogICA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09ICovDQpib2R5IC5hY2NvdW50LWRpc2NvcmQgew0KICBkaXNwbGF5OiBmbGV4ICFpbXBvcnRhbnQ7DQogIGp1c3RpZnktY29udGVudDogc3BhY2UtYmV0d2VlbiAhaW1wb3J0YW50Ow0KICBhbGlnbi1pdGVtczogY2VudGVyICFpbXBvcnRhbnQ7DQogIHRleHQtZGVjb3JhdGlvbjogbm9uZSAhaW1wb3J0YW50Ow0KICBwYWRkaW5nOiAxNnB4IDIwcHggIWltcG9ydGFudDsNCn0NCg0KYm9keSAuYWNjb3VudC1kaXNjb3JkOmhvdmVyIHsNCiAgYmFja2dyb3VuZDogdmFyKC0tbWQtc3lzLWNvbG9yLXN1cmZhY2UtY29udGFpbmVyLWhpZ2gpICFpbXBvcnRhbnQ7DQp9DQoNCmJvZHkgLmFjY291bnQtZGlzY29yZF9faW5uZXIgew0KICBkaXNwbGF5OiBmbGV4ICFpbXBvcnRhbnQ7DQogIGp1c3RpZnktY29udGVudDogc3BhY2UtYmV0d2VlbiAhaW1wb3J0YW50Ow0KICBhbGlnbi1pdGVtczogY2VudGVyICFpbXBvcnRhbnQ7DQogIHdpZHRoOiAxMDAlICFpbXBvcnRhbnQ7DQogIGdhcDogMTZweCAhaW1wb3J0YW50Ow0KfQ0KDQpib2R5IC5hY2NvdW50LWRpc2NvcmRfX2lubmVyIGgzIHsNCiAgY29sb3I6IHZhcigtLW1kLXN5cy1jb2xvci1vbi1iYWNrZ3JvdW5kKSAhaW1wb3J0YW50Ow0KICBmb250LXdlaWdodDogNjAwICFpbXBvcnRhbnQ7DQogIGZvbnQtc2l6ZTogMTRweCAhaW1wb3J0YW50Ow0KICBtYXJnaW46IDAgIWltcG9ydGFudDsNCn0NCg0KYm9keSAuYWNjb3VudC1kaXNjb3JkX19pbm5lciBpbWcgew0KICBoZWlnaHQ6IDMycHggIWltcG9ydGFudDsNCiAgd2lkdGg6IGF1dG8gIWltcG9ydGFudDsNCiAgb2JqZWN0LWZpdDogY29udGFpbiAhaW1wb3J0YW50Ow0KfQ0KDQpib2R5IC5mb290ZXIgew0KICBkaXNwbGF5OiBmbGV4ICFpbXBvcnRhbnQ7DQogIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW4gIWltcG9ydGFudDsNCiAgYWxpZ24taXRlbXM6IGNlbnRlciAhaW1wb3J0YW50Ow0KICBnYXA6IDI0cHggIWltcG9ydGFudDsNCiAgcGFkZGluZzogMjRweCAhaW1wb3J0YW50Ow0KfQ0KDQpib2R5IC5mb290ZXJfX21lbnUgew0KICBkaXNwbGF5OiBmbGV4ICFpbXBvcnRhbnQ7DQogIGdhcDogMTZweCAhaW1wb3J0YW50Ow0KICBmbGV4LXdyYXA6IHdyYXAgIWltcG9ydGFudDsNCiAganVzdGlmeS1jb250ZW50OiBjZW50ZXIgIWltcG9ydGFudDsNCiAgcGFkZGluZzogMCAhaW1wb3J0YW50Ow0KICBsaXN0LXN0eWxlOiBub25lICFpbXBvcnRhbnQ7DQp9DQoNCmJvZHkgLmZvb3Rlcl9fbWVudSBhIHsNCiAgY29sb3I6IHZhcigtLW1kLXN5cy1jb2xvci1vdXRsaW5lKSAhaW1wb3J0YW50Ow0KICB0ZXh0LWRlY29yYXRpb246IG5vbmUgIWltcG9ydGFudDsNCiAgZm9udC1zaXplOiAxM3B4ICFpbXBvcnRhbnQ7DQogIGZvbnQtd2VpZ2h0OiA1MDAgIWltcG9ydGFudDsNCiAgdHJhbnNpdGlvbjogY29sb3IgMC4ycyAhaW1wb3J0YW50Ow0KfQ0KDQpib2R5IC5mb290ZXJfX21lbnUgYTpob3ZlciB7DQogIGNvbG9yOiB2YXIoLS1tZC1zeXMtY29sb3ItcHJpbWFyeSkgIWltcG9ydGFudDsNCn0NCg0KYm9keSAuZm9vdGVyX19kZWxldGUtYWNjb3VudCB7DQogIGJhY2tncm91bmQ6ICNlNTJiMmIgIWltcG9ydGFudDsNCiAgY29sb3I6ICNmZmZiZmIgIWltcG9ydGFudDsNCiAgYm9yZGVyOiAzcHggc29saWQgIzZkMGQwMCAhaW1wb3J0YW50Ow0KICBib3JkZXItcmFkaXVzOiAxMDBweCAhaW1wb3J0YW50Ow0KICBwYWRkaW5nOiAxMHB4IDI0cHggIWltcG9ydGFudDsNCiAgZm9udC13ZWlnaHQ6IDYwMCAhaW1wb3J0YW50Ow0KICBmb250LXNpemU6IDE1cHggIWltcG9ydGFudDsNCiAgdGV4dC10cmFuc2Zvcm06IG5vbmUgIWltcG9ydGFudDsNCiAgY3Vyc29yOiBwb2ludGVyICFpbXBvcnRhbnQ7DQogIHRleHQtZGVjb3JhdGlvbi1saW5lOiB1bmRlcmxpbmUgIWltcG9ydGFudDsNCiAgbWFyZ2luLWJvdHRvbTogMTBweCAhaW1wb3J0YW50Ow0KICBtYXJnaW4tbGVmdDogMHB4ICFpbXBvcnRhbnQ7DQogIGxpbmUtaGVpZ2h0OiAxNHB4ICFpbXBvcnRhbnQ7DQp9DQoNCi8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0NCiAgIDguIERFVEFMSEVTIEdFUkFJUw0KICAgPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSAqLw0KYm9keSAuc2VsZWN0X19tYWluLnNlbGVjdF9fbWFpbiB7DQogIGJhY2tncm91bmQ6IHZhcigtLW1kLXN5cy1jb2xvci1zdXJmYWNlLXZhcmlhbnQpICFpbXBvcnRhbnQ7DQogIGJvcmRlci1yYWRpdXM6IDEwMHB4ICFpbXBvcnRhbnQ7DQogIHBhZGRpbmc6IDEwcHggMjBweCAhaW1wb3J0YW50Ow0KICBjb2xvcjogdmFyKC0tbWQtc3lzLWNvbG9yLW9uLWJhY2tncm91bmQpICFpbXBvcnRhbnQ7DQogIGZvbnQtd2VpZ2h0OiA1MDAgIWltcG9ydGFudDsNCn0NCg0KYm9keSBociB7DQogIGJvcmRlci1jb2xvcjogdmFyKC0tbWQtc3lzLWNvbG9yLXN1cmZhY2UtdmFyaWFudCkgIWltcG9ydGFudDsNCiAgbWFyZ2luOiAyNHB4IDAgIWltcG9ydGFudDsNCiAgb3BhY2l0eTogMC41ICFpbXBvcnRhbnQ7DQp9DQoNCmJvZHkgLndhcm5pbmcgew0KICBiYWNrZ3JvdW5kOiByZ2JhKDI0NSwgMjAwLCAwLCAwLjEpICFpbXBvcnRhbnQ7DQogIGJvcmRlcjogMXB4IHNvbGlkIHJnYmEoMjQ1LCAyMDAsIDAsIDAuMikgIWltcG9ydGFudDsNCiAgYm9yZGVyLXJhZGl1czogMTZweCAhaW1wb3J0YW50Ow0KICBwYWRkaW5nOiAxNnB4ICFpbXBvcnRhbnQ7DQogIG1hcmdpbi10b3A6IDE2cHggIWltcG9ydGFudDsNCiAgZGlzcGxheTogZmxleCAhaW1wb3J0YW50Ow0KICBhbGlnbi1pdGVtczogZmxleC1zdGFydCAhaW1wb3J0YW50Ow0KICBnYXA6IDEycHggIWltcG9ydGFudDsNCn0NCg0KYm9keSAud2FybmluZyBwIHsNCiAgbWFyZ2luOiAwICFpbXBvcnRhbnQ7DQogIGZvbnQtc2l6ZTogMTNweCAhaW1wb3J0YW50Ow0KICBjb2xvcjogdmFyKC0tbWQtc3lzLWNvbG9yLW9uLWJhY2tncm91bmQpICFpbXBvcnRhbnQ7DQogIGxpbmUtaGVpZ2h0OiAxLjUgIWltcG9ydGFudDsNCn0NCg0KYm9keSAud2FybmluZyBzdmcgcGF0aCB7DQogIGZpbGw6IHZhcigtLW1kLXN5cy1jb2xvci1wcmltYXJ5KSAhaW1wb3J0YW50Ow0KfQ0KDQovKiBDb3JyZcOnw7VlcyBlc3BlY8OtZmljYXMgcGFyYSBNb2JpbGUgKi8NCkBtZWRpYSAobWF4LXdpZHRoOiA2MDBweCkgew0KICBib2R5IC51c2VyLWluZm8gLmNvbnRlbnQtYm94X19jYXJkIHsNCiAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uICFpbXBvcnRhbnQ7DQogICAgYWxpZ24taXRlbXM6IGNlbnRlciAhaW1wb3J0YW50Ow0KICAgIHRleHQtYWxpZ246IGNlbnRlciAhaW1wb3J0YW50Ow0KICB9DQoNCiAgYm9keSAudXNlci1pbmZvX19wcm9maWxlLWltZyB7DQogICAgbWFyZ2luLXJpZ2h0OiAwICFpbXBvcnRhbnQ7DQogICAgbWFyZ2luLWJvdHRvbTogMTZweCAhaW1wb3J0YW50Ow0KICB9DQoNCiAgYm9keSAudXNlci1pbmZvX19wcm9maWxlLWRhdGEgew0KICAgIGFsaWduLWl0ZW1zOiBjZW50ZXIgIWltcG9ydGFudDsNCiAgICB3aWR0aDogMTAwJSAhaW1wb3J0YW50Ow0KICB9DQoNCiAgYm9keSAucHJvZmlsZS1kYXRhX19zb2NpYWxzLWl0ZW0sDQogIGJvZHkgLnByb2ZpbGUtZGF0YV9fb3RoZXItaXRlbSB7DQogICAganVzdGlmeS1jb250ZW50OiBjZW50ZXIgIWltcG9ydGFudDsNCiAgfQ0KDQogIGJvZHkgLnN5bmMtcGxhdGZvcm1fX2JvZHkgew0KICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW4gIWltcG9ydGFudDsNCiAgICBhbGlnbi1pdGVtczogZmxleC1zdGFydCAhaW1wb3J0YW50Ow0KICAgIGdhcDogMjBweCAhaW1wb3J0YW50Ow0KICB9DQoNCiAgYm9keSAuc3luYy1wbGF0Zm9ybV9fYnV0dG9ucyB7DQogICAgd2lkdGg6IDEwMCUgIWltcG9ydGFudDsNCiAgICBqdXN0aWZ5LWNvbnRlbnQ6IHNwYWNlLWJldHdlZW4gIWltcG9ydGFudDsNCiAgfQ0KDQogIGJvZHkgLnN5bmMtcGxhdGZvcm1fX2J1dHRvbiB7DQogICAgZmxleDogMSAhaW1wb3J0YW50Ow0KICAgIGp1c3RpZnktY29udGVudDogY2VudGVyICFpbXBvcnRhbnQ7DQogIH0NCn0=');
      document.head.appendChild(style);
    };
    if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', injectTheme); } 
    else { injectTheme(); }
  }
})();
