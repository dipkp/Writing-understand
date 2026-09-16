package com.spellspeak.app;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
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
    private boolean ttsStarting = false;
    private boolean openMistakesAfterLoad = false;
    private static final int NOTIFICATION_REQ = 2204;

    private String pendingText = null;
    private float pendingRate = 0.82f;
    private int pendingRepeat = 1;

    private AudioManager audioManager;
    private AudioFocusRequest focusRequest;

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

        audioManager = (AudioManager) getSystemService(AUDIO_SERVICE);
        initTts();

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
                    view.evaluateJavascript("window.openMistakesFromNative && window.openMistakesFromNative();", null);
                }
                notifyTtsState();
            }
        });

        webView.addJavascriptInterface(new AppBridge(), "AndroidApp");
        webView.loadUrl("file:///android_asset/index.html");
        NotificationUtil.ensureChannel(this);
    }

    private synchronized void initTts() {
        if (ttsStarting || ttsReady) return;
        ttsStarting = true;
        if (tts != null) {
            try { tts.stop(); tts.shutdown(); } catch (Exception ignored) {}
            tts = null;
        }
        tts = new TextToSpeech(getApplicationContext(), this);
    }

    @Override
    public synchronized void onInit(int status) {
        ttsStarting = false;
        ttsReady = false;
        if (status == TextToSpeech.SUCCESS && tts != null) {
            int result = tts.setLanguage(Locale.UK);
            if (result == TextToSpeech.LANG_MISSING_DATA || result == TextToSpeech.LANG_NOT_SUPPORTED) {
                result = tts.setLanguage(Locale.US);
            }
            if (result == TextToSpeech.LANG_MISSING_DATA || result == TextToSpeech.LANG_NOT_SUPPORTED) {
                result = tts.setLanguage(Locale.ENGLISH);
            }

            try {
                AudioAttributes attrs = new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ASSISTANCE_ACCESSIBILITY)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                    .build();
                tts.setAudioAttributes(attrs);
            } catch (Exception ignored) {}

            tts.setPitch(1.0f);
            ttsReady = result != TextToSpeech.LANG_MISSING_DATA && result != TextToSpeech.LANG_NOT_SUPPORTED;
        }

        notifyTtsState();
        if (ttsReady && pendingText != null && !pendingText.trim().isEmpty()) {
            String text = pendingText;
            float rate = pendingRate;
            int repeat = pendingRepeat;
            pendingText = null;
            speakNow(text, rate, repeat);
        }
    }

    private void notifyTtsState() {
        if (webView == null) return;
        final boolean ready = ttsReady;
        runOnUiThread(() -> webView.evaluateJavascript(
            "window.onNativeTtsState && window.onNativeTtsState(" + (ready ? "true" : "false") + ");",
            null
        ));
    }

    private void requestSpeechAudioFocus() {
        if (audioManager == null) return;
        try {
            AudioAttributes attrs = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ASSISTANCE_ACCESSIBILITY)
                .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                .build();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                focusRequest = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
                    .setAudioAttributes(attrs)
                    .setAcceptsDelayedFocusGain(false)
                    .setWillPauseWhenDucked(false)
                    .build();
                audioManager.requestAudioFocus(focusRequest);
            } else {
                audioManager.requestAudioFocus(null, AudioManager.STREAM_MUSIC, AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK);
            }
        } catch (Exception ignored) {}
    }

    private synchronized void queueOrSpeak(String text, float rate, int repeat) {
        if (text == null || text.trim().isEmpty()) return;
        float safeRate = Math.max(0.35f, Math.min(rate, 1.5f));
        int safeRepeat = Math.max(1, Math.min(repeat, 3));
        if (!ttsReady || tts == null) {
            pendingText = text;
            pendingRate = safeRate;
            pendingRepeat = safeRepeat;
            initTts();
            return;
        }
        speakNow(text, safeRate, safeRepeat);
    }

    private void speakNow(String text, float rate, int repeat) {
        runOnUiThread(() -> {
            if (tts == null || !ttsReady) {
                pendingText = text;
                pendingRate = rate;
                pendingRepeat = repeat;
                initTts();
                return;
            }
            requestSpeechAudioFocus();
            tts.stop();
            tts.setSpeechRate(rate);
            int lastResult = TextToSpeech.SUCCESS;
            for (int i = 0; i < repeat; i++) {
                String id = "ss9_" + System.nanoTime() + "_" + i;
                int mode = (i == 0) ? TextToSpeech.QUEUE_FLUSH : TextToSpeech.QUEUE_ADD;
                lastResult = tts.speak(text, mode, null, id);
                if (i < repeat - 1) {
                    tts.playSilentUtterance(260, TextToSpeech.QUEUE_ADD, id + "_pause");
                }
            }
            if (lastResult == TextToSpeech.ERROR) {
                ttsReady = false;
                pendingText = text;
                pendingRate = rate;
                pendingRepeat = repeat;
                initTts();
            }
        });
    }

    private void installSystemBarInsets() {
        if (rootView == null) return;
        rootView.setOnApplyWindowInsetsListener((view, insets) -> {
            int left, top, right, bottom;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                android.graphics.Insets bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                left = bars.left; top = bars.top; right = bars.right; bottom = bars.bottom;
            } else {
                left = insets.getSystemWindowInsetLeft(); top = insets.getSystemWindowInsetTop();
                right = insets.getSystemWindowInsetRight(); bottom = insets.getSystemWindowInsetBottom();
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
        if (light && Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) flags |= View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
        if (light && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) flags |= View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
        getWindow().getDecorView().setSystemUiVisibility(flags);
    }

    private void requestNotificationPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, NOTIFICATION_REQ);
        }
    }

    public class AppBridge {
        @JavascriptInterface
        public void speakText(final String text, final String rateText, final String repeatText) {
            float rate = 0.82f;
            int repeat = 1;
            try { rate = Float.parseFloat(rateText); } catch (Exception ignored) {}
            try { repeat = Integer.parseInt(repeatText); } catch (Exception ignored) {}
            final float finalRate = rate;
            final int finalRepeat = repeat;
            runOnUiThread(() -> queueOrSpeak(text, finalRate, finalRepeat));
        }

        @JavascriptInterface
        public void speak(final String text, final float rate, final int repeat) {
            runOnUiThread(() -> queueOrSpeak(text, rate, repeat));
        }

        @JavascriptInterface
        public boolean isTtsReady() { return ttsReady; }

        @JavascriptInterface
        public void retryTts() { runOnUiThread(() -> { ttsReady = false; initTts(); }); }

        @JavascriptInterface
        public void stop() {
            runOnUiThread(() -> { if (tts != null) tts.stop(); });
        }

        @JavascriptInterface
        public void setTheme(final String theme) { runOnUiThread(() -> applySystemTheme(theme)); }

        @JavascriptInterface
        public void syncMistakes(final String json) {
            getSharedPreferences(ReminderScheduler.PREFS, MODE_PRIVATE).edit()
                .putString(ReminderScheduler.KEY_MISTAKES, json == null ? "[]" : json).apply();
        }

        @JavascriptInterface
        public void configureNotifications(final boolean enabled, final int intervalMinutes, final boolean allDay,
                                           final int startHour, final int endHour, final boolean showWord) {
            getSharedPreferences(ReminderScheduler.PREFS, MODE_PRIVATE).edit()
                .putBoolean(ReminderScheduler.KEY_ENABLED, enabled)
                .putInt(ReminderScheduler.KEY_INTERVAL, Math.max(10, intervalMinutes))
                .putBoolean(ReminderScheduler.KEY_ALL_DAY, allDay)
                .putInt(ReminderScheduler.KEY_START, Math.max(0, Math.min(23, startHour)))
                .putInt(ReminderScheduler.KEY_END, Math.max(0, Math.min(23, endHour)))
                .putBoolean(ReminderScheduler.KEY_SHOW_WORD, showWord).apply();
            runOnUiThread(() -> {
                if (enabled) requestNotificationPermissionIfNeeded();
                if (enabled) ReminderScheduler.schedule(MainActivity.this); else ReminderScheduler.cancel(MainActivity.this);
            });
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (!ttsReady && !ttsStarting) initTts();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        if (intent != null && intent.getBooleanExtra("openMistakes", false) && webView != null) {
            webView.evaluateJavascript("window.openMistakesFromNative && window.openMistakesFromNative();", null);
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null) {
            webView.evaluateJavascript("(function(){ if(window.ssNativeBack){ return window.ssNativeBack(); } return false; })();",
                value -> { if (!"true".equals(value)) finish(); });
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
            try { tts.stop(); tts.shutdown(); } catch (Exception ignored) {}
        }
        super.onDestroy();
    }
}
