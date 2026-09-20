package com.example.hello;

import android.app.Activity;
import android.os.Bundle;
import android.os.Build;
import android.util.Base64;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;

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

        // Preenche a área do "notch" (entalhe da câmera) para tela 100% cheia em aparelhos modernos
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            getWindow().getAttributes().layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
        }

        getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
            | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
            | View.SYSTEM_UI_FLAG_FULLSCREEN
            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
            | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
        );

        webView = new WebView(this);
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);

        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setUserAgentString("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");

        final String cssCode = readAsset("theme.css");
        final String jsCode = readAsset("gamepad.js");

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);

                if (!cssCode.isEmpty()) {
                    String encodedCss = Base64.encodeToString(cssCode.getBytes(), Base64.NO_WRAP);
                    String injectCssJs = "(function() {" +
                                         "var style = document.createElement('style');" +
                                         "style.innerHTML = window.atob('" + encodedCss + "');" +
                                         "document.head.appendChild(style);" +
                                         "})();";
                    view.evaluateJavascript(injectCssJs, null);
                }

                if (!jsCode.isEmpty()) {
                    view.evaluateJavascript("(function(){ " + jsCode + " })();", null);
                }
            }
        });

        webView.loadUrl("https://cloud.boosteroid.com");
    }

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
