package com.crystallauncher.overlay.hud.elements;

import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.Font;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.core.Holder;
import net.minecraft.core.BlockPos;
import net.minecraft.world.level.biome.Biome;
import com.crystallauncher.overlay.config.OverlayConfig.ElementConfig;

public class BiomeElement implements HUDElement {
    @Override
    public void render(GuiGraphics graphics, ElementConfig cfg) {
        Minecraft mc = Minecraft.getInstance();
        if (mc.player == null || mc.level == null) return;

        BlockPos pos = mc.player.blockPosition();
        Holder<Biome> biome = mc.level.getBiome(pos);
        String biomeName = "Unknown";
        if (biome != null && biome.unwrapKey().isPresent()) {
            biomeName = biome.unwrapKey().get().identifier().getPath();
            biomeName = beautifyBiomeName(biomeName);
        }

        String text = "Biome: " + biomeName;
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

    private String beautifyBiomeName(String path) {
        if (path == null || path.isEmpty()) return "Unknown";
        String[] parts = path.split("_");
        StringBuilder sb = new StringBuilder();
        for (String part : parts) {
            if (!part.isEmpty()) {
                sb.append(Character.toUpperCase(part.charAt(0)))
                  .append(part.substring(1))
                  .append(" ");
            }
        }
        return sb.toString().trim();
    }
}
