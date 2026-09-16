package com.spellspeak.app;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import java.util.Calendar;

public final class ReminderScheduler {
    private ReminderScheduler() {}

    public static final String PREFS = "spellspeak_reminders";
    public static final String KEY_ENABLED = "enabled";
    public static final String KEY_INTERVAL = "interval";
    public static final String KEY_ALL_DAY = "all_day";
    public static final String KEY_START = "start_hour";
    public static final String KEY_END = "end_hour";
    public static final String KEY_SHOW_WORD = "show_word";
    public static final String KEY_MISTAKES = "mistakes_json";
    private static final int REQUEST_CODE = 4004;

    static PendingIntent pendingIntent(Context context) {
        Intent intent = new Intent(context, ReminderReceiver.class);
        return PendingIntent.getBroadcast(
            context,
            REQUEST_CODE,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }

    public static void cancel(Context context) {
        AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (am != null) am.cancel(pendingIntent(context));
    }

    public static void schedule(Context context) {
        SharedPreferences p = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        if (!p.getBoolean(KEY_ENABLED, false)) {
            cancel(context);
            return;
        }

        int interval = Math.max(10, p.getInt(KEY_INTERVAL, 30));
        boolean allDay = p.getBoolean(KEY_ALL_DAY, true);
        int start = p.getInt(KEY_START, 8);
        int end = p.getInt(KEY_END, 22);

        long trigger = System.currentTimeMillis() + interval * 60_000L;

        if (!allDay) {
            Calendar c = Calendar.getInstance();
            c.setTimeInMillis(trigger);
            int hour = c.get(Calendar.HOUR_OF_DAY);

            boolean wraps = end <= start;
            boolean active;
            if (!wraps) active = hour >= start && hour < end;
            else active = hour >= start || hour < end;

            if (!active) {
                Calendar next = Calendar.getInstance();
                next.setTimeInMillis(trigger);
                next.set(Calendar.MINUTE, 0);
                next.set(Calendar.SECOND, 0);
                next.set(Calendar.MILLISECOND, 0);

                if (!wraps) {
                    if (hour >= end) next.add(Calendar.DAY_OF_YEAR, 1);
                    next.set(Calendar.HOUR_OF_DAY, start);
                } else {
                    next.set(Calendar.HOUR_OF_DAY, start);
                    if (hour >= start) {
                        next.add(Calendar.DAY_OF_YEAR, 1);
                    }
                }
                trigger = next.getTimeInMillis();
            }
        }

        AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;

        PendingIntent pi = pendingIntent(context);
        am.cancel(pi);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, trigger, pi);
        } else {
            am.set(AlarmManager.RTC_WAKEUP, trigger, pi);
        }
    }
}
