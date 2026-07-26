package com.crystallauncher.overlay.hud.elements;

import com.crystallauncher.overlay.config.OverlayConfig.ElementConfig;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;

public class FPSElement {
    public static void render(DrawContext context, int width, int height, ElementConfig cfg, MinecraftClient client) {
        String text = "FPS: " + MinecraftClient.FPS_DEBUG_CURRENT;
        int x = (int)(cfg.x * width);
        int y = (int)(cfg.y * height);
        context.getMatrices().push();
        context.getMatrices().scale(cfg.scale, cfg.scale, 1.0f);
        context.drawText(client.textRenderer, text, (int)(x / cfg.scale), (int)(y / cfg.scale), cfg.color, true);
        context.getMatrices().pop();
    }
}
