package com.crystallauncher.overlay.hud;

import java.util.concurrent.ConcurrentLinkedQueue;

public class CPSHandler {
    private static final ConcurrentLinkedQueue<Long> leftClicks = new ConcurrentLinkedQueue<>();
    private static final ConcurrentLinkedQueue<Long> rightClicks = new ConcurrentLinkedQueue<>();

    public static void onLeftClick() {
        leftClicks.add(System.currentTimeMillis());
    }

    public static void onRightClick() {
        rightClicks.add(System.currentTimeMillis());
    }

    public static void tick() {
        long now = System.currentTimeMillis();
        long threshold = now - 1000;
        
        while (!leftClicks.isEmpty() && leftClicks.peek() < threshold) {
            leftClicks.poll();
        }
        
        while (!rightClicks.isEmpty() && rightClicks.peek() < threshold) {
            rightClicks.poll();
        }
    }

    public static int getLeftCPS() {
        return leftClicks.size();
    }

    public static int getRightCPS() {
        return rightClicks.size();
    }
}
