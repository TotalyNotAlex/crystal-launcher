package com.crystallauncher.overlay;

import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.keybinding.v1.KeyBindingHelper;
import net.minecraft.client.KeyMapping;
import org.lwjgl.glfw.GLFW;
import com.crystallauncher.overlay.config.ConfigManager;
import com.crystallauncher.overlay.gui.OverlaySettingsScreen;
import com.crystallauncher.overlay.hud.CPSHandler;

public class CrystalOverlayMod implements ClientModInitializer {
    public static final String MOD_ID = "crystallauncher-overlay";
    private static KeyMapping openSettingsKey;

    @Override
    public void onInitializeClient() {
        ConfigManager.load();

        openSettingsKey = KeyBindingHelper.registerKeyBinding(new KeyMapping(
            "key.crystallauncher.overlay.settings",
            GLFW.GLFW_KEY_RIGHT_SHIFT,
            KeyMapping.Category.MISC
        ));

        ClientTickEvents.END_CLIENT_TICK.register(client -> {
            // Tick the CPS Handler to clean up click timestamps older than 1 second
            CPSHandler.tick();

            if (openSettingsKey != null && openSettingsKey.consumeClick() && client.screen == null) {
                client.setScreen(new OverlaySettingsScreen(null));
            }
        });
    }
}
