package com.crystallauncher.overlay;

import net.fabricmc.api.ModInitializer;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.keybinding.v1.KeyBindingHelper;
import net.minecraft.client.option.KeyBinding;
import net.minecraft.client.util.InputUtil;
import org.lwjgl.glfw.GLFW;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import com.crystallauncher.overlay.config.ConfigManager;

public class CrystalOverlayMod implements ModInitializer {
    public static final String MOD_ID = "crystallauncher-overlay";
    public static final Logger LOGGER = LoggerFactory.getLogger(MOD_ID);

    public static KeyBinding openSettingsKey;

    @Override
    public void onInitialize() {
        LOGGER.info("Crystal Launcher Overlay initializing...");
        ConfigManager.load();

        openSettingsKey = KeyBindingHelper.registerKeyBinding(new KeyBinding(
            "key.crystallauncher.overlay.settings",
            InputUtil.Type.KEYSYM,
            GLFW.GLFW_KEY_RIGHT_SHIFT,
            "category.crystallauncher.overlay"
        ));

        ClientTickEvents.END_CLIENT_TICK.register(client -> {
            if (openSettingsKey.wasPressed()) {
                if (client.currentScreen == null) {
                    client.setScreen(new com.crystallauncher.overlay.gui.OverlaySettingsScreen(null));
                }
            }
        });

        LOGGER.info("Crystal Launcher Overlay initialized! Press RSHIFT to open settings.");
    }
}