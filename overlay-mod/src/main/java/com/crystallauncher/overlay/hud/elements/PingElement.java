package com.crystallauncher.overlay.hud.elements;

import com.crystallauncher.overlay.config.OverlayConfig.ElementConfig;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.network.ClientPlayNetworkHandler;
import net.minecraft.client.network.PlayerListEntry;

public class PingElement {
    public void render(DrawContext context, MinecraftClient client, ElementConfig cfg) {
        int ping = 0;
        ClientPlayNetworkHandler h = client.getNetworkHandler();
        if (h != null && client.player != null) {
            PlayerListEntry e = h.getPlayerListEntry(client.player.getUuid());
            if (e != null) ping = e.getLatency();
        }
        String text = "Ping: " + ping + "ms";
        int x = (int)(cfg.x * client.getWindow().getScaledWidth());
        int y = (int)(cfg.y * client.getWindow().getScaledHeight());
        context.fill(x - 2, y - 2, x + client.textRenderer.getWidth(text) + 2, y + 12, 0x80000000);
        context.drawText(client.textRenderer, text, x, y, cfg.color, false);
    }
}