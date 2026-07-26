package com.crystallauncher.overlay.hud.elements;

import com.crystallauncher.overlay.config.OverlayConfig.ElementConfig;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;

public class CPSElement {
    private static final long[] LEFT_CLICKS = new long[100];
    private static final long[] RIGHT_CLICKS = new long[100];
    private static int leftIndex = 0;
    private static int rightIndex = 0;

    public static void registerClick(int button) {
        long now = System.currentTimeMillis();
        if (button == 0) {
            LEFT_CLICKS[leftIndex % 100] = now;
            leftIndex++;
        } else if (button == 1) {
            RIGHT_CLICKS[rightIndex % 100] = now;
            rightIndex++;
        }
    }

    public static void render(DrawContext context, int width, int height, ElementConfig cfg, MinecraftClient client) {
        int leftCps = countClicks(LEFT_CLICKS, leftIndex);
        int rightCps = countClicks(RIGHT_CLICKS, rightIndex);
        String text = leftCps + " CPS | " + rightCps + " CPS";
        int x = (int)(cfg.x * width);
        int y = (int)(cfg.y * height);
        context.getMatrices().push();
        context.getMatrices().scale(cfg.scale, cfg.scale, 1.0f);
        context.drawText(client.textRenderer, text, (int)(x / cfg.scale), (int)(y / cfg.scale), cfg.color, true);
        context.getMatrices().pop();
    }

    private static int countClicks(long[] clicks, int index) {
        long threshold = System.currentTimeMillis() - 1000;
        int count = 0;
        int start = Math.max(0, index - 100);
        for (int i = start; i < index; i++) {
            if (clicks[i % 100] > threshold) count++;
        }
        return count;
    }
}
