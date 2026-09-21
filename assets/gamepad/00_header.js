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
