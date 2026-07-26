package com.crystallauncher.overlay.hud;

import com.crystallauncher.overlay.config.ConfigManager;
import com.crystallauncher.overlay.config.OverlayConfig;
import com.crystallauncher.overlay.hud.elements.*;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;

public class HUDRenderer {
    public static void render(DrawContext context, float tickDelta) {
        OverlayConfig config = ConfigManager.getConfig();
        if (!config.enabled) return;

        MinecraftClient client = MinecraftClient.getInstance();
        if (client == null || client.player == null || client.getWindow() == null) return;

        int width = client.getWindow().getScaledWidth();
        int height = client.getWindow().getScaledHeight();

        if (config.fps.enabled) FPSElement.render(context, width, height, config.fps, client);
        if (config.ping.enabled) PingElement.render(context, width, height, config.ping, client);
        if (config.cps.enabled) CPSElement.render(context, width, height, config.cps, client);
        if (config.coords.enabled) CoordsElement.render(context, width, height, config.coords, client);
    }
}
