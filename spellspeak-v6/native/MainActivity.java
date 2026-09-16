package com.spellspeak.app;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.speech.tts.TextToSpeech;
import android.view.View;
import android.view.WindowInsets;
import android.widget.FrameLayout;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.util.Locale;

public class MainActivity extends Activity implements TextToSpeech.OnInitListener {

    private WebView webView;
    private FrameLayout rootView;
    private TextToSpeech tts;
    private boolean ttsReady = false;
    private boolean openMistakesAfterLoad = false;
    private static final int NOTIFICATION_REQ = 2204;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            getWindow().setDecorFitsSystemWindows(false);
        }
        openMistakesAfterLoad = getIntent() != null && getIntent().getBooleanExtra("openMistakes", false);

        rootView = new FrameLayout(this);
        webView = new WebView(this);
        rootView.addView(webView, new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        ));
        setContentView(rootView);
        installSystemBarInsets();
        applySystemTheme("dark");

        tts = new TextToSpeech(this, this);

        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setTextZoom(100);

        webView.setWebChromeClient(new WebChromeClient());
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                if (openMistakesAfterLoad) {
                    openMistakesAfterLoad = false;
                    view.evaluateJavascript(
                        "window.openMistakesFromNative && window.openMistakesFromNative();",
                        null
                    );
                }
            }
        });

        webView.addJavascriptInterface(new AppBridge(), "AndroidApp");
        webView.loadUrl("file:///android_asset/index.html");
        NotificationUtil.ensureChannel(this);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        if (intent != null && intent.getBooleanExtra("openMistakes", false) && webView != null) {
            webView.evaluateJavascript(
                "window.openMistakesFromNative && window.openMistakesFromNative();",
                null
            );
        }
    }

    @Override
    public void onInit(int status) {
        if (status == TextToSpeech.SUCCESS) {
            int result = tts.setLanguage(Locale.UK);
            if (result == TextToSpeech.LANG_MISSING_DATA ||
                result == TextToSpeech.LANG_NOT_SUPPORTED) {
                tts.setLanguage(Locale.US);
            }
            ttsReady = true;
        }
    }

    private void installSystemBarInsets() {
        if (rootView == null) return;

        rootView.setOnApplyWindowInsetsListener((view, insets) -> {
            int left;
            int top;
            int right;
            int bottom;

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                android.graphics.Insets bars = insets.getInsets(
                    WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout()
                );
                left = bars.left;
                top = bars.top;
                right = bars.right;
                bottom = bars.bottom;
            } else {
                left = insets.getSystemWindowInsetLeft();
                top = insets.getSystemWindowInsetTop();
                right = insets.getSystemWindowInsetRight();
                bottom = insets.getSystemWindowInsetBottom();
            }

            view.setPadding(left, top, right, bottom);
            return insets;
        });

        rootView.requestApplyInsets();
    }

    private void applySystemTheme(String theme) {
        boolean light = "light".equalsIgnoreCase(theme);
        int color = Color.parseColor(light ? "#F4F7FB" : "#081321");
        if (rootView != null) rootView.setBackgroundColor(color);
        if (webView != null) webView.setBackgroundColor(color);
        getWindow().setStatusBarColor(color);
        getWindow().setNavigationBarColor(color);

        int flags = 0;
        if (light && Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
        }
        if (light && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            flags |= View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
        }
        getWindow().getDecorView().setSystemUiVisibility(flags);
    }

    private void requestNotificationPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT >= 33 &&
            checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, NOTIFICATION_REQ);
        }
    }

    public class AppBridge {
        @JavascriptInterface
        public void speak(final String text, final float rate, final int repeat) {
            runOnUiThread(() -> {
                if (!ttsReady || text == null || text.trim().isEmpty()) return;
                tts.stop();
                tts.setSpeechRate(Math.max(0.35f, Math.min(rate, 1.5f)));
                int count = Math.max(1, Math.min(repeat, 3));
                for (int i = 0; i < count; i++) {
                    String id = "ss4_" + System.nanoTime() + "_" + i;
                    int mode = (i == 0) ? TextToSpeech.QUEUE_FLUSH : TextToSpeech.QUEUE_ADD;
                    tts.speak(text, mode, null, id);
                    if (i < count - 1) {
                        tts.playSilentUtterance(240, TextToSpeech.QUEUE_ADD, id + "_pause");
                    }
                }
            });
        }

        @JavascriptInterface
        public void stop() {
            runOnUiThread(() -> {
                if (tts != null) tts.stop();
            });
        }

        @JavascriptInterface
        public void setTheme(final String theme) {
            runOnUiThread(() -> applySystemTheme(theme));
        }

        @JavascriptInterface
        public void syncMistakes(final String json) {
            getSharedPreferences(ReminderScheduler.PREFS, MODE_PRIVATE)
                .edit()
                .putString(ReminderScheduler.KEY_MISTAKES, json == null ? "[]" : json)
                .apply();
        }

        @JavascriptInterface
        public void configureNotifications(
                final boolean enabled,
                final int intervalMinutes,
                final boolean allDay,
                final int startHour,
                final int endHour,
                final boolean showWord) {

            getSharedPreferences(ReminderScheduler.PREFS, MODE_PRIVATE)
                .edit()
                .putBoolean(ReminderScheduler.KEY_ENABLED, enabled)
                .putInt(ReminderScheduler.KEY_INTERVAL, Math.max(10, intervalMinutes))
                .putBoolean(ReminderScheduler.KEY_ALL_DAY, allDay)
                .putInt(ReminderScheduler.KEY_START, Math.max(0, Math.min(23, startHour)))
                .putInt(ReminderScheduler.KEY_END, Math.max(0, Math.min(23, endHour)))
                .putBoolean(ReminderScheduler.KEY_SHOW_WORD, showWord)
                .apply();

            runOnUiThread(() -> {
                if (enabled) requestNotificationPermissionIfNeeded();
                if (enabled) ReminderScheduler.schedule(MainActivity.this);
                else ReminderScheduler.cancel(MainActivity.this);
            });
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null) {
            webView.evaluateJavascript(
                "(function(){ if(window.ssNativeBack){ return window.ssNativeBack(); } return false; })();",
                value -> {
                    if (!"true".equals(value)) {
                        finish();
                    }
                }
            );
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.removeJavascriptInterface("AndroidApp");
            webView.destroy();
        }
        if (tts != null) {
            tts.stop();
            tts.shutdown();
        }
        super.onDestroy();
    }
}
