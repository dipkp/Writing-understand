package com.spellspeak.app;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Random;

public final class NotificationUtil {
    private NotificationUtil() {}
    private static final String CHANNEL_ID = "wrong_word_review";
    private static final int NOTIFICATION_ID = 4411;

    public static void ensureChannel(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null) return;
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Wrong-word reminders",
                NotificationManager.IMPORTANCE_DEFAULT
            );
            channel.setDescription("Spelling reminders from your Mistake Vault");
            nm.createNotificationChannel(channel);
        }
    }

    public static void postReminder(Context context) {
        ensureChannel(context);

        if (Build.VERSION.SDK_INT >= 33 &&
            context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            return;
        }

        SharedPreferences p = context.getSharedPreferences(ReminderScheduler.PREFS, Context.MODE_PRIVATE);
        if (!p.getBoolean(ReminderScheduler.KEY_ENABLED, false)) return;

        String text = "Time to review your wrong-word list.";
        boolean showWord = p.getBoolean(ReminderScheduler.KEY_SHOW_WORD, true);

        if (showWord) {
            try {
                JSONArray arr = new JSONArray(p.getString(ReminderScheduler.KEY_MISTAKES, "[]"));
                if (arr.length() > 0) {
                    JSONObject item = arr.getJSONObject(new Random().nextInt(arr.length()));
                    String word = item.optString("word", "");
                    int wrong = item.optInt("wrong", 0);
                    if (!word.isEmpty()) {
                        text = "Review: " + word + (wrong > 0 ? " • " + wrong + "× wrong" : "");
                    }
                }
            } catch (Exception ignored) {}
        }

        Intent open = new Intent(context, MainActivity.class);
        open.putExtra("openMistakes", true);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent contentIntent = PendingIntent.getActivity(
            context,
            4412,
            open,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Notification.Builder builder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            ? new Notification.Builder(context, CHANNEL_ID)
            : new Notification.Builder(context);

        builder
            .setSmallIcon(com.spellspeak.app.R.drawable.ic_notification)
            .setContentTitle("SpellSpeak • Wrong-word review")
            .setContentText(text)
            .setStyle(new Notification.BigTextStyle().bigText(text))
            .setContentIntent(contentIntent)
            .setAutoCancel(true)
            .setCategory(Notification.CATEGORY_REMINDER)
            .setVisibility(Notification.VISIBILITY_PRIVATE);

        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.notify(NOTIFICATION_ID, builder.build());
    }
}
