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

        graphics.pose().pushMatrix();
        graphics.pose().translate((float) cfg.x, (float) cfg.y);
        graphics.pose().scale(cfg.scale, cfg.scale);
        graphics.fill(-2, -2, width + 2, 10, 0x80000000);
        graphics.drawString(font, text, 0, 0, cfg.color, true);
        graphics.pose().popMatrix();
    }
}
