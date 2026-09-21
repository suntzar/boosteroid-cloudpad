#!/bin/bash
# Script para empacotar o projeto como um Userscript (Tampermonkey/Violentmonkey)

echo "=== Preparando o ambiente do Userscript ==="
mkdir -p dist

# 1. Converte o CSS nativo para Base64 (sem quebras de linha)
CSS_BASE64=$(base64 assets/theme.css | tr -d '\n')

# 2. Cria dinamicamente um módulo injetor de CSS exclusivo para o Tampermonkey
# Ele faz uma checagem de segurança (!window.AndroidClipboard) para ter 100% de certeza
# de que não vai rodar se por acaso for parar dentro do app Android.
cat <<EOF > assets/gamepad/07_tampermonkey_theme.js
  // --- TAMPERMONKEY SPECIFIC: Injeção do Tema MD3 ---
  if (!window.AndroidClipboard) {
    const injectTheme = () => {
      if(document.getElementById('injected-md3-theme')) return;
      const style = document.createElement('style');
      style.id = 'injected-md3-theme';
      style.innerHTML = window.atob('${CSS_BASE64}');
      document.head.appendChild(style);
    };
    if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', injectTheme); } 
    else { injectTheme(); }
  }
EOF

echo "=== Empacotando módulos JS ==="
# 3. Junta todos os módulos em um arquivo de distribuição (.user.js)
cat assets/gamepad/00_header.js \
    assets/gamepad/01_core.js \
    assets/gamepad/02_layout.js \
    assets/gamepad/03_ui.js \
    assets/gamepad/04_edit.js \
    assets/gamepad/05_input.js \
    assets/gamepad/06_init.js \
    assets/gamepad/07_tampermonkey_theme.js \
    assets/gamepad/99_footer.js > dist/boosteroid-cloudpad.user.js

# 4. Limpa o módulo temporário
rm assets/gamepad/07_tampermonkey_theme.js

echo "=== SUCESSO ==="
echo "Userscript gerado em: dist/boosteroid-cloudpad.user.js"
echo "Você pode copiar o conteúdo desse arquivo e colar direto no Tampermonkey!"
