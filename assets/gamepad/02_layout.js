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
