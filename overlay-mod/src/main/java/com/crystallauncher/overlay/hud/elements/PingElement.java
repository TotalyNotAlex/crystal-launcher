package com.crystallauncher.overlay.hud.elements;

import com.crystallauncher.overlay.config.OverlayConfig.ElementConfig;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.network.ClientPlayNetworkHandler;
import net.minecraft.client.network.PlayerListEntry;

public class PingElement {
    public static void render(DrawContext context, int width, int height, ElementConfig cfg, MinecraftClient client) {
        int ping = 0;
        if (client.player != null) {
            ClientPlayNetworkHandler handler = client.player.networkHandler;
            if (handler != null) {
                PlayerListEntry entry = handler.getPlayerListEntry(client.player.getUuid());
                if (entry != null) ping = entry.getLatency();
            }
        }
        String text = "Ping: " + ping + "ms";
        int x = (int)(cfg.x * width);
        int y = (int)(cfg.y * height);
        context.getMatrices().push();
        context.getMatrices().scale(cfg.scale, cfg.scale, 1.0f);
        context.drawText(client.textRenderer, text, (int)(x / cfg.scale), (int)(y / cfg.scale), cfg.color, true);
        context.getMatrices().pop();
    }
}
