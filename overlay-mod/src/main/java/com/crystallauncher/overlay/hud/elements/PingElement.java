package com.crystallauncher.overlay.hud.elements;

import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.Font;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.multiplayer.ClientPacketListener;
import net.minecraft.client.multiplayer.PlayerInfo;
import com.crystallauncher.overlay.config.OverlayConfig.ElementConfig;

public class PingElement implements HUDElement {
    @Override
    public void render(GuiGraphics graphics, ElementConfig cfg) {
        Minecraft mc = Minecraft.getInstance();
        int ping = 0;
        if (mc.player != null) {
            ClientPacketListener connection = mc.player.connection;
            if (connection != null) {
                PlayerInfo playerInfo = connection.getPlayerInfo(mc.player.getUUID());
                if (playerInfo != null) {
                    ping = playerInfo.getLatency();
                }
            }
        }
        String text = "Ping: " + ping + "ms";
        Font font = mc.font;
        int width = font.width(text);

        // Ensure color has 100% opacity (alpha = 0xFF)
        int opaqueColor = 0xFF000000 | cfg.color;

        graphics.pose().pushMatrix();
        graphics.pose().translate((float) cfg.x, (float) cfg.y);
        graphics.pose().scale(cfg.scale, cfg.scale);
        graphics.fill(-2, -2, width + 2, 10, 0x80000000);
        graphics.drawString(font, text, 0, 0, opaqueColor, true);
        graphics.pose().popMatrix();
    }
}
