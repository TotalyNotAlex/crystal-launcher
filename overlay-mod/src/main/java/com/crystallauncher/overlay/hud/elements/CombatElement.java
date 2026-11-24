package com.crystallauncher.overlay.hud.elements;

import com.crystallauncher.overlay.config.OverlayConfig.ElementConfig;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.Font;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.ItemStack;

import java.util.Locale;

/** Compact health, armor, and held-item card anchored to the bottom-right. */
public class CombatElement implements HUDElement {
    private static final int PANEL_HEIGHT = 46;
    private static final int LEFT_COLUMN_WIDTH = 94;
    private static final int ITEM_COLUMN_START = 106;
    private static final int MAX_NAME_WIDTH = 116;

    @Override
    public void render(GuiGraphics graphics, ElementConfig cfg) {
        Minecraft mc = Minecraft.getInstance();
        Player player = mc.player;
        if (player == null) return;

        Font font = mc.font;
        ItemStack heldItem = player.getMainHandItem();
        String itemName = heldItem.isEmpty() ? "Empty hand" : heldItem.getHoverName().getString();
        itemName = trimToWidth(font, itemName, MAX_NAME_WIDTH);

        int panelWidth = ITEM_COLUMN_START + 22 + font.width(itemName) + 10;
        int panelX = graphics.guiWidth() - cfg.x - (int)Math.ceil(panelWidth * cfg.scale);
        int panelY = graphics.guiHeight() - cfg.y - (int)Math.ceil(PANEL_HEIGHT * cfg.scale);
        int accent = 0xFF000000 | cfg.color;

        float health = Math.max(0.0f, player.getHealth());
        float maxHealth = Math.max(1.0f, player.getMaxHealth());
        String healthText = String.format(Locale.ROOT, "%.1f / %.0f", health, maxHealth);
        int healthColor = health / maxHealth > 0.6f ? 0xFF78D99A
                : health / maxHealth > 0.3f ? 0xFFFFC766 : 0xFFFF727A;
        String armorText = Integer.toString(player.getArmorValue());

        graphics.pose().pushMatrix();
        graphics.pose().translate((float)panelX, (float)panelY);
        graphics.pose().scale(cfg.scale, cfg.scale);

        graphics.fill(0, 0, panelWidth, PANEL_HEIGHT, 0xD9101722);
        graphics.fill(0, 0, 2, PANEL_HEIGHT, accent);
        graphics.fill(2, 0, panelWidth, 1, 0x553C5268);
        graphics.fill(LEFT_COLUMN_WIDTH, 7, LEFT_COLUMN_WIDTH + 1, PANEL_HEIGHT - 7, 0x553C5268);

        graphics.drawString(font, "HP", 10, 8, 0xFFB9C6D5, true);
        graphics.drawString(font, healthText, 32, 8, healthColor, true);
        graphics.drawString(font, "ARMOR", 10, 23, 0xFFB9C6D5, true);
        graphics.drawString(font, armorText, 48, 23, 0xFF8BD8FF, true);

        int itemX = ITEM_COLUMN_START;
        int itemY = 15;
        if (!heldItem.isEmpty()) {
            graphics.renderItem(heldItem, itemX, itemY);
            graphics.renderItemDecorations(font, heldItem, itemX, itemY);
        }
        graphics.drawString(font, itemName, itemX + 22, 19, 0xFFF0F5FA, true);
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
