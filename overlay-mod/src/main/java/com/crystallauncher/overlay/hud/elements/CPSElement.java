package com.crystallauncher.overlay.hud.elements;

import com.crystallauncher.overlay.config.OverlayConfig.ElementConfig;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;

public class CPSElement {
    private long[] clickTimes = new long[20];
    private int clickIndex = 0;
    private int clickCount = 0;

    public void onAttack() {
        clickTimes[clickIndex] = System.currentTimeMillis();
        clickIndex = (clickIndex + 1) % 20;
        if (clickCount < 20) clickCount++;
    }

    public void tick() {}

    public int getCPS() {
        long now = System.currentTimeMillis();
        long threshold = now - 1000;
        int count = 0;
        for (int i = 0; i < clickCount; i++) {
            if (clickTimes[i] >= threshold) count++;
        }
        return count;
    }

    public void render(DrawContext context, MinecraftClient client, ElementConfig cfg) {
        String text = "CPS: " + getCPS();
        int x = (int)(cfg.x * client.getWindow().getScaledWidth());
        int y = (int)(cfg.y * client.getWindow().getScaledHeight());
        context.fill(x - 2, y - 2, x + client.textRenderer.getWidth(text) + 2, y + 12, 0x80000000);
        context.drawText(client.textRenderer, text, x, y, cfg.color, false);
    }
}