package com.crystallauncher.overlay.hud.elements;

import com.crystallauncher.overlay.config.OverlayConfig.ElementConfig;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.Font;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.world.entity.EquipmentSlot;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.ItemStack;

import java.util.List;

/** Compact equipment durability list anchored to the bottom-right. */
public class CombatElement implements HUDElement {
    private static final int ROW_HEIGHT = 18;
    private static final int PANEL_WIDTH = 166;
    private static final int PANEL_HEIGHT = 102;
    private static final int NAME_X = 27;
    private static final int DURABILITY_X = 126;
    private static final int MAX_NAME_WIDTH = 91;

    private record EquipmentRow(String emptyLabel, ItemStack stack) {}

    @Override
    public void render(GuiGraphics graphics, ElementConfig cfg) {
        Minecraft mc = Minecraft.getInstance();
        Player player = mc.player;
        if (player == null) return;

        List<EquipmentRow> rows = List.of(
                new EquipmentRow("Helm", player.getItemBySlot(EquipmentSlot.HEAD)),
                new EquipmentRow("Brust", player.getItemBySlot(EquipmentSlot.CHEST)),
                new EquipmentRow("Beine", player.getItemBySlot(EquipmentSlot.LEGS)),
                new EquipmentRow("Stiefel", player.getItemBySlot(EquipmentSlot.FEET)),
                new EquipmentRow("Hand", player.getMainHandItem())
        );

        Font font = mc.font;
        int panelX = graphics.guiWidth() - cfg.x - (int)Math.ceil(PANEL_WIDTH * cfg.scale);
        int panelY = graphics.guiHeight() - cfg.y - (int)Math.ceil(PANEL_HEIGHT * cfg.scale);
        int accent = 0xFF000000 | cfg.color;

        graphics.pose().pushMatrix();
        graphics.pose().translate((float)panelX, (float)panelY);
        graphics.pose().scale(cfg.scale, cfg.scale);

        // Match the other overlay elements: subtle black glass with the user's accent color.
        graphics.fill(-4, -2, PANEL_WIDTH + 2, PANEL_HEIGHT + 1, 0x80000000);
        graphics.fill(-4, -2, -2, PANEL_HEIGHT + 1, accent);

        for (int i = 0; i < rows.size(); i++) {
            EquipmentRow row = rows.get(i);
            int y = 4 + i * ROW_HEIGHT;
            ItemStack stack = row.stack();
            boolean empty = stack.isEmpty();

            if (i == rows.size() - 1) {
                graphics.fill(3, y - 2, PANEL_WIDTH, y - 1, 0x553C5268);
            }

            String name = empty ? row.emptyLabel() : stack.getHoverName().getString();
            name = trimToWidth(font, name, MAX_NAME_WIDTH);
            int textColor = empty ? 0xFF777777 : 0xFFFFFFFF;

            if (!empty) {
                graphics.renderItem(stack, 5, y);
                graphics.renderItemDecorations(font, stack, 5, y);
            }
            graphics.drawString(font, name, NAME_X, y + 4, textColor, true);

            if (!empty && stack.isDamageableItem()) {
                int remaining = Math.max(0, stack.getMaxDamage() - stack.getDamageValue());
                int percent = Math.round(remaining * 100.0f / stack.getMaxDamage());
                int durabilityColor = percent > 60 ? 0xFF55DD75
                        : percent > 30 ? 0xFFFFC94F : 0xFFFF6262;
                String durability = percent + "%";
                graphics.drawString(font, durability, DURABILITY_X, y + 4, durabilityColor, true);
            }
        }

        graphics.pose().popMatrix();
    }

    private static String trimToWidth(Font font, String text, int maxWidth) {
        if (font.width(text) <= maxWidth) return text;
        String ellipsis = "…";
        int end = text.length();
        while (end > 0 && font.width(text.substring(0, end) + ellipsis) > maxWidth) {
            end--;
        }
        return end > 0 ? text.substring(0, end) + ellipsis : ellipsis;
    }
}
