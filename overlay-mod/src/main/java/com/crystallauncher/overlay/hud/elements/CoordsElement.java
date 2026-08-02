package com.crystallauncher.overlay.hud.elements;

import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.Font;
import net.minecraft.client.gui.GuiGraphics;
import com.crystallauncher.overlay.config.OverlayConfig.ElementConfig;

public class CoordsElement implements HUDElement {
    @Override
    public void render(GuiGraphics graphics, ElementConfig cfg) {
        Minecraft mc = Minecraft.getInstance();
        if (mc.player == null) return;
        
        long x = Math.round(mc.player.getX());
        long y = Math.round(mc.player.getY());
        long z = Math.round(mc.player.getZ());
        
        String text = String.format("XYZ: %d, %d, %d", x, y, z);
        Font font = mc.font;
        int width = font.width(text);

        // Ensure color has 100% opacity (alpha = 0xFF)
        int opaqueColor = 0xFF000000 | cfg.color;

        graphics.pose().pushMatrix();
        graphics.pose().translate((float) cfg.x, (float) cfg.y);
        graphics.pose().scale(cfg.scale, cfg.scale);
        
        // Draw modern background with left colored accent bar
        graphics.fill(-4, -2, width + 2, 10, 0x80000000);
        graphics.fill(-4, -2, -2, 10, opaqueColor);
        
        graphics.drawString(font, text, 0, 0, opaqueColor, true);
        graphics.pose().popMatrix();
    }
}
