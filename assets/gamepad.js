// ==UserScript==
// @name         Virtual Gamepad API (Zona Delimitada)
// @namespace    http://tampermonkey.net/
// @version      2.3
// @description  Emula controle XInput com analógico restrito ao canto inferior esquerdo
// @match        *://*/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  if (window.self !== window.top && !document.querySelector('canvas, video')) return;

  /* ==========================================================================
     1. ESTADO DO GAMEPAD
     ========================================================================== */
  let isGamepadEnabled = true;

  const state = {
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

  function createGamepadSnapshot() {
    return {
      id: "Xbox 360 Controller (XInput STANDARD GAMEPAD)",
      index: 0,
      connected: true,
      timestamp: performance.now(),
      mapping: "standard",
      axes: [...state.axes],
      buttons: state.buttons.map(b => ({ ...b }))
    };
  }

  navigator.getGamepads = function () {
    return [createGamepadSnapshot(), null, null, null];
  };

  function notifyConnected() {
    const event = new Event('gamepadconnected');
    Object.defineProperty(event, 'gamepad', {
      value: createGamepadSnapshot(),
      enumerable: true
    });
    window.dispatchEvent(event);
  }

  function resetInputs() {
    state.axes = [0.0, 0.0, 0.0, 0.0];
    state.buttons.forEach(b => {
      b.pressed = false;
      b.value = 0.0;
    });
  }

  function silenceEvent(e) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
  }

  /* ==========================================================================
     2. INTERFACE E ESTILOS AJUSTADOS
     ========================================================================== */
  function initUI() {
    if (document.getElementById('vpad-root')) return;

    const style = document.createElement('style');
    style.textContent = `
      #vpad-root {
        position: fixed;
        inset: 0px;
        width: 100%;
        height: 100%;
        z-index: 2147483647;
        pointer-events: none;
        user-select: none;
        -webkit-user-select: none;
        touch-action: none;
        overflow: hidden;
      }

      /* Barra de status superior */
      .vpad-top-bar-btn {
        position: absolute;
        top: calc(10px + env(safe-area-inset-top));
        padding: 6px 12px;
        background: rgba(0, 0, 0, 0.55);
        border: 1px solid rgba(255, 255, 255, 0.3);
        color: #fff;
        font-size: 11px;
        font-family: sans-serif;
        font-weight: bold;
        border-radius: 20px;
        pointer-events: auto;
        backdrop-filter: blur(4px);
      }
      .vpad-top-bar-btn:active {
        background: rgba(255, 255, 255, 0.3);
      }

      #vpad-toggle-btn {
        left: calc(10px + env(safe-area-inset-left));
      }
      #vpad-toggle-btn.is-off {
        opacity: 0.5;
        border-color: rgba(255, 100, 100, 0.6);
        background: rgba(40, 0, 0, 0.6);
      }

      #vpad-fullscreen-btn {
        right: calc(10px + env(safe-area-inset-right));
      }

      .vpad-hidden {
        display: none !important;
      }

      /* ZONA DO ANALÓGICO: Delimitada apenas ao quadrante inferior esquerdo */
      #vpad-touch-left {
        position: absolute;
        bottom: 0;
        left: 0;
        width: 42vw;
        max-width: 320px;
        height: 52vh;
        max-height: 280px;
        pointer-events: auto;
        touch-action: none;
      }

      /* Base do Analógico (Com posição de descanso visível) */
      #vpad-stick-base {
        position: absolute;
        width: 110px;
        height: 110px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.06);
        border: 2px solid rgba(255, 255, 255, 0.2);
        transform: translate(-50%, -50%);
        left: calc(75px + env(safe-area-inset-left));
        bottom: calc(25px + env(safe-area-inset-bottom));
        pointer-events: none;
        transition: opacity 0.2s ease;
      }

      #vpad-stick-knob {
        position: absolute;
        width: 46px;
        height: 46px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.4);
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        pointer-events: none;
      }

      /* Botões de Ação na Direita */
      #vpad-buttons-right {
        position: absolute;
        right: calc(15px + env(safe-area-inset-right));
        bottom: calc(15px + env(safe-area-inset-bottom));
        width: 180px;
        height: 180px;
        pointer-events: auto;
        touch-action: none;
      }
      .vpad-btn {
        position: absolute;
        width: 52px;
        height: 52px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.15);
        border: 2px solid rgba(255, 255, 255, 0.35);
        color: #fff;
        font-weight: bold;
        font-family: sans-serif;
        display: flex;
        align-items: center;
        justify-content: center;
        backdrop-filter: blur(4px);
        pointer-events: auto;
        touch-action: none;
      }
      .vpad-btn:active {
        background: rgba(255, 255, 255, 0.5);
      }
      #vpad-btn-a { bottom: 0px; left: 64px; }
      #vpad-btn-b { bottom: 64px; right: 0px; }
      #vpad-btn-x { bottom: 64px; left: 0px; }
      #vpad-btn-y { top: 0px; left: 64px; }
    `;
    document.head.appendChild(style);

    const root = document.createElement('div');
    root.id = 'vpad-root';
    root.innerHTML = `
      <div id="vpad-toggle-btn" class="vpad-top-bar-btn">🎮 CONTROLE: ON</div>
      <div id="vpad-fullscreen-btn" class="vpad-top-bar-btn">⛶ Tela Cheia</div>
      
      <div id="vpad-touch-left">
        <div id="vpad-stick-base">
          <div id="vpad-stick-knob"></div>
        </div>
      </div>
      
      <div id="vpad-buttons-right">
        <div class="vpad-btn" id="vpad-btn-a">A</div>
        <div class="vpad-btn" id="vpad-btn-b">B</div>
        <div class="vpad-btn" id="vpad-btn-x">X</div>
        <div class="vpad-btn" id="vpad-btn-y">Y</div>
      </div>
    `;
    document.body.appendChild(root);

    const toggleBtn = document.getElementById('vpad-toggle-btn');
    const leftTouch = document.getElementById('vpad-touch-left');
    const rightBtns = document.getElementById('vpad-buttons-right');

    /* --- Chave ON/OFF --- */
    toggleBtn.addEventListener('click', (e) => {
      silenceEvent(e);
      isGamepadEnabled = !isGamepadEnabled;

      if (isGamepadEnabled) {
        toggleBtn.textContent = "🎮 CONTROLE: ON";
        toggleBtn.classList.remove('is-off');
        leftTouch.classList.remove('vpad-hidden');
        rightBtns.classList.remove('vpad-hidden');
      } else {
        toggleBtn.textContent = "🎮 CONTROLE: OFF";
        toggleBtn.classList.add('is-off');
        leftTouch.classList.add('vpad-hidden');
        rightBtns.classList.add('vpad-hidden');
        resetInputs();
      }
    }, { capture: true });

    /* --- Botão Fullscreen --- */
    document.getElementById('vpad-fullscreen-btn').addEventListener('click', (e) => {
      silenceEvent(e);
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen();
      }
    }, { capture: true });

    /* --- Analógico com Delimitação Segura --- */
    const stickBase = document.getElementById('vpad-stick-base');
    const stickKnob = document.getElementById('vpad-stick-knob');
    const MAX_RADIUS = 45;
    let touchId = null;
    let originX = 0;
    let originY = 0;

    // Posição de repouso padrão da base
    function parkStickBase() {
      stickBase.style.left = `calc(75px + env(safe-area-inset-left))`;
      stickBase.style.top = ``;
      stickBase.style.bottom = `calc(25px + env(safe-area-inset-bottom))`;
      stickKnob.style.transform = `translate(-50%, -50%)`;
    }

    leftTouch.addEventListener('touchstart', (e) => {
      if (!isGamepadEnabled) return;
      silenceEvent(e);
      if (touchId !== null) return;

      const touch = e.changedTouches[0];
      touchId = touch.identifier;

      // Obtém coordenadas relativas à caixa delimitada
      const rect = leftTouch.getBoundingClientRect();
      originX = touch.clientX;
      originY = touch.clientY;

      stickBase.style.bottom = 'auto';
      stickBase.style.left = `${originX - rect.left}px`;
      stickBase.style.top = `${originY - rect.top}px`;
      stickKnob.style.transform = `translate(-50%, -50%)`;
    }, { passive: false, capture: true });

    leftTouch.addEventListener('touchmove', (e) => {
      if (!isGamepadEnabled) return;
      silenceEvent(e);
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === touchId) {
          const touch = e.changedTouches[i];
          let dx = touch.clientX - originX;
          let dy = touch.clientY - originY;
          const dist = Math.hypot(dx, dy);

          if (dist > MAX_RADIUS) {
            dx = (dx / dist) * MAX_RADIUS;
            dy = (dy / dist) * MAX_RADIUS;
          }

          stickKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;

          state.axes[0] = parseFloat((dx / MAX_RADIUS).toFixed(3));
          state.axes[1] = parseFloat((dy / MAX_RADIUS).toFixed(3));
          break;
        }
      }
    }, { passive: false, capture: true });

    const resetStick = (e) => {
      if (!isGamepadEnabled) return;
      silenceEvent(e);
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === touchId) {
          touchId = null;
          parkStickBase();
          state.axes[0] = 0.0;
          state.axes[1] = 0.0;
          break;
        }
      }
    };
    leftTouch.addEventListener('touchend', resetStick, { passive: false, capture: true });
    leftTouch.addEventListener('touchcancel', resetStick, { passive: false, capture: true });

    /* --- Botões Digitais --- */
    function bindBtn(id, buttonIndex) {
      const el = document.getElementById(id);
      const setBtn = (pressed) => {
        if (!isGamepadEnabled) return;
        state.buttons[buttonIndex].pressed = pressed;
        state.buttons[buttonIndex].value = pressed ? 1.0 : 0.0;
      };

      el.addEventListener('touchstart', (e) => {
        silenceEvent(e);
        setBtn(true);
      }, { passive: false, capture: true });

      el.addEventListener('touchend', (e) => {
        silenceEvent(e);
        setBtn(false);
      }, { passive: false, capture: true });

      el.addEventListener('touchcancel', (e) => {
        silenceEvent(e);
        setBtn(false);
      }, { passive: false, capture: true });
    }

    bindBtn('vpad-btn-a', GP.A);
    bindBtn('vpad-btn-b', GP.B);
    bindBtn('vpad-btn-x', GP.X);
    bindBtn('vpad-btn-y', GP.Y);

    setTimeout(notifyConnected, 400);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initUI);
  } else {
    initUI();
  }
})();
