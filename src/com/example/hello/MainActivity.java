package com.example.hello;

import android.app.Activity;
import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.view.Window;
import android.view.WindowManager;

// Importações necessárias para leitura de arquivos (IO)
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.BufferedReader;

public class MainActivity extends Activity {
    private WebView webView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN, WindowManager.LayoutParams.FLAG_FULLSCREEN);

        webView = new WebView(this);
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        // Opcional: Para evitar que o sistema amplie/diminua a tela (zoom) ao tocar
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);

        // Função para ler o arquivo gamepad.js da pasta assets
        final String jsCode = readAsset("gamepad.js");

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                
                // Se a leitura deu certo, injetamos na página
                if (!jsCode.isEmpty()) {
                    view.evaluateJavascript("(function(){ " + jsCode + " })();", null);
                }
            }
        });

        webView.loadUrl("https://cloud.boosteroid.com");
    }

    // Método auxiliar para ler arquivos da pasta 'assets'
    private String readAsset(String filename) {
        StringBuilder sb = new StringBuilder();
        try {
            InputStream is = getAssets().open(filename);
            BufferedReader br = new BufferedReader(new InputStreamReader(is, "UTF-8"));
            String line;
            while ((line = br.readLine()) != null) {
                sb.append(line).append("\n");
            }
            br.close();
            is.close();
        } catch (Exception e) {
            e.printStackTrace();
            return "";
        }
        return sb.toString();
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }
}
