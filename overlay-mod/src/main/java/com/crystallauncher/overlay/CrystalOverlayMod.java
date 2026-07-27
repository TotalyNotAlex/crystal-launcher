package com.crystallauncher.overlay;

import net.fabricmc.api.ModInitializer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import com.crystallauncher.overlay.config.ConfigManager;

public class CrystalOverlayMod implements ModInitializer {
    public static final String MOD_ID = "crystallauncher-overlay";
    public static final Logger LOGGER = LoggerFactory.getLogger(MOD_ID);

    @Override
    public void onInitialize() {
        LOGGER.info("Crystal Launcher Overlay initializing...");
        ConfigManager.load();
        LOGGER.info("Crystal Launcher Overlay initialized!");
    }
}