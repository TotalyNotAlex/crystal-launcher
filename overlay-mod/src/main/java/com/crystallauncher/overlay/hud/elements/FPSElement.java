package com.crystallauncher.overlay.hud.elements;

import com.crystallauncher.overlay.config.OverlayConfig.ElementConfig;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;

public class FPSElement {
    private static long lastTime = System.currentTimeMillis();
    private static int frames = 0;
    private static int displayedFps = 0;

    public static void render(DrawContext context, int width, int height, ElementConfig cfg, MinecraftClient client) {
        frames++;
        long now = System.currentTimeMillis();
        if (now - lastTime > 1000) {
            displayedFps = frames;
            frames = 0;
            lastTime = now;
        }
        String text = "FPS: " + displayedFps;
        int x = (int)(cfg.x * width);
        int y = (int)(cfg.y * height);
        context.getMatrices().push();
        context.getMatrices().scale(cfg.scale, cfg.scale, 1.0f);
        context.drawText(client.textRenderer, text, (int)(x / cfg.scale), (int)(y / cfg.scale), cfg.color, true);
        context.getMatrices().pop();
    }
}
