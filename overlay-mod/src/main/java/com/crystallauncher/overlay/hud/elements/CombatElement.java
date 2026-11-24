package com.crystallauncher.overlay.hud.elements;

import com.crystallauncher.overlay.config.OverlayConfig.ElementConfig;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.Font;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.world.entity.EquipmentSlot;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.ItemStack;

import java.util.ArrayList;
import java.util.List;

/** Compact equipment icons and durability, anchored to the bottom-right. */
public class CombatElement implements HUDElement {
    private static final int ROW_HEIGHT = 18;
    private static final int PANEL_WIDTH = 62;
    private static final int ICON_X = 0;
    private static final int VALUE_X = 21;

    @Override
    public void render(GuiGraphics graphics, ElementConfig cfg) {
        Minecraft mc = Minecraft.getInstance();
        Player player = mc.player;
        if (player == null) return;

        List<ItemStack> equipment = new ArrayList<>(5);
        addIfEquipped(equipment, player.getItemBySlot(EquipmentSlot.HEAD));
        addIfEquipped(equipment, player.getItemBySlot(EquipmentSlot.CHEST));
        addIfEquipped(equipment, player.getItemBySlot(EquipmentSlot.LEGS));
        addIfEquipped(equipment, player.getItemBySlot(EquipmentSlot.FEET));
        addIfEquipped(equipment, player.getMainHandItem());
        if (equipment.isEmpty()) return;

        Font font = mc.font;
        int panelHeight = equipment.size() * ROW_HEIGHT + 4;
        int panelX = graphics.guiWidth() - cfg.x - (int)Math.ceil(PANEL_WIDTH * cfg.scale);
        int panelY = graphics.guiHeight() - cfg.y - (int)Math.ceil(panelHeight * cfg.scale);
        int configuredColor = 0xFF000000 | cfg.color;

        graphics.pose().pushMatrix();
        graphics.pose().translate((float)panelX, (float)panelY);
        graphics.pose().scale(cfg.scale, cfg.scale);

        // Same soft black background as the other HUD elements, with no accent rail.
        graphics.fill(-4, -2, PANEL_WIDTH + 2, panelHeight + 1, 0x80000000);

        for (int i = 0; i < equipment.size(); i++) {
            ItemStack stack = equipment.get(i);
            int y = 2 + i * ROW_HEIGHT;
            graphics.renderItem(stack, ICON_X, y);
            graphics.renderItemDecorations(font, stack, ICON_X, y);

            if (!stack.isDamageableItem()) continue;
            int maxDurability = stack.getMaxDamage();
            int currentDurability = Math.max(0, maxDurability - stack.getDamageValue());
            float ratio = currentDurability / (float)maxDurability;
            int color = ratio > 0.6f ? configuredColor
                    : ratio > 0.3f ? 0xFFFFC94F : 0xFFFF6262;
            graphics.drawString(font, currentDurability + "/" + maxDurability,
                    VALUE_X, y + 4, color, true);
        }

        graphics.pose().popMatrix();
    }

    private static void addIfEquipped(List<ItemStack> equipment, ItemStack stack) {
        if (!stack.isEmpty()) equipment.add(stack);
    }
}
