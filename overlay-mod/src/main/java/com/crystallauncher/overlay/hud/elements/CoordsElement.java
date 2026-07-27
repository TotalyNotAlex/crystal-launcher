package com.crystallauncher.overlay.hud.elements;

import com.crystallauncher.overlay.config.OverlayConfig.ElementConfig;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.util.math.BlockPos;

public class CoordsElement {
    public void render(DrawContext context, MinecraftClient client, ElementConfig cfg) {
        if (client.player == null) return;
        BlockPos pos = client.player.getBlockPos();
        String text = String.format("XYZ: %d, %d, %d", pos.getX(), pos.getY(), pos.getZ());
        int x = (int)(cfg.x * client.getWindow().getScaledWidth());
        int y = (int)(cfg.y * client.getWindow().getScaledHeight());
        context.fill(x - 2, y - 2, x + client.textRenderer.getWidth(text) + 2, y + 12, 0x80000000);
        context.drawText(client.textRenderer, text, x, y, cfg.color, false);
    }
}