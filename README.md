# Boosteroid CloudPad 🎮

Uma aplicação Android nativa, extremamente leve e construída do zero para entregar a melhor experiência de Cloud Gaming no Boosteroid direto do seu smartphone. Sem distrações, com máxima performance.

Construído inteiramente via Termux (sem Android Studio, sem Gradle).

## 🚀 Recursos (Features)

*   **Controle Virtual XInput Completo:** Dual sticks virtuais precisos, D-Pad, Gatilhos (LT/RT), Bumpers (LB/RB) e cliques dos analógicos (L3/R3).
*   **Modo de Edição Drag & Drop:** Redimensione, reposicione, altere a opacidade e o desfoque de cada botão individualmente. O seu layout é salvo automaticamente no armazenamento local.
*   **Emulação de Teclado (Shift+Tab):** Converta o botão "HOME" do controle para acionar a interface da Steam nativamente na nuvem.
*   **Integração Nativa de Hardware:** Suporte completo à captação de Microfone (WebRTC) e leitura segura da Área de Transferência (Clipboard) para colar textos dentro do jogo.
*   **Tema Material You (MD3):** Interface limpa, cantos arredondados, remoção de banners e poluição visual da dashboard padrão do Boosteroid.
*   **Immersive Mode:** Bloqueio inteligente da barra de navegação e preenchimento total da tela para aproveitar 100% do display do celular.

## ⚠️ Nota Importante sobre o Login

Devido a rígidas políticas de segurança do Google contra ataques MITM, o serviço "Sign in with Google" (Login com o Google) bloqueia acessos originados de WebViews nativos de aplicativos. 

**Para utilizar este aplicativo, faça o seu login utilizando o E-mail e Senha diretamente na plataforma do Boosteroid.** Todo o código-fonte deste wrapper é aberto, transparente e livre de rastreadores ou interceptadores de cookies.

## 🛠️ Como Compilar Localmente (Via Termux)

Você pode compilar e instalar o seu próprio APK diretamente do celular.

1. Instale as dependências e faça o download do Android SDK:
   ```bash
   bash setup.sh
   ```
2. Conceda permissão de armazenamento (Necessário para salvar o APK na sua galeria/downloads):
   ```bash
   termux-setup-storage
   ```
3. Compile e construa o pacote:
   ```bash
   bash build.sh
   ```
4. O arquivo final estará disponível em `build/apk/boosteroid-pad.apk`.

## 📜 Licença

MIT License
