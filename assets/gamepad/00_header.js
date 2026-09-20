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
