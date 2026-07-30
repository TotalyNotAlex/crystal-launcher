package com.crystallauncher.overlay.config;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import net.fabricmc.loader.api.FabricLoader;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.FileReader;
import java.io.FileWriter;
import java.io.IOException;
import java.nio.file.Path;

public class ConfigManager {
    private static final Logger LOGGER = LoggerFactory.getLogger("crystallauncher-overlay-config");
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
    private static OverlayConfig config = null;
    private static Path configPath;

    public static OverlayConfig getConfig() {
        if (config == null) {
            config = OverlayConfig.createDefault();
        }
        return config;
    }

    public static void load() {
        configPath = FabricLoader.getInstance().getConfigDir().resolve("crystallauncher-overlay.json");
        if (configPath.toFile().exists()) {
            try (FileReader reader = new FileReader(configPath.toFile())) {
                config = GSON.fromJson(reader, OverlayConfig.class);
                if (config == null) {
                    config = OverlayConfig.createDefault();
                }
                LOGGER.info("Overlay config loaded from {}", configPath);
            } catch (Exception e) {
                // Catch any JsonSyntaxException, NumberFormatException or IOException
                LOGGER.error("Failed to parse overlay config due to old/incompatible format. Resetting to defaults.", e);
                
                // Safely delete the incompatible config file to avoid future crashes
                try {
                    configPath.toFile().delete();
                } catch (Exception ignored) {}
                
                config = OverlayConfig.createDefault();
                save();
            }
        } else {
            config = OverlayConfig.createDefault();
            save();
        }
    }

    public static void save() {
        if (configPath == null) {
            configPath = FabricLoader.getInstance().getConfigDir().resolve("crystallauncher-overlay.json");
        }
        try {
            if (!configPath.getParent().toFile().exists()) {
                configPath.getParent().toFile().mkdirs();
            }
            try (FileWriter writer = new FileWriter(configPath.toFile())) {
                GSON.toJson(getConfig(), writer);
            }
        } catch (IOException e) {
            LOGGER.error("Failed to save overlay config", e);
        }
    }

    public static void apply(OverlayConfig newConfig) {
        config = newConfig;
        save();
    }

    public static void resetToDefault() {
        config = OverlayConfig.createDefault();
        save();
    }
}
