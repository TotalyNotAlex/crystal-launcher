package com.crystallauncher.overlay.config;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.crystallauncher.overlay.CrystalOverlayMod;
import net.fabricmc.loader.api.FabricLoader;

import java.io.FileReader;
import java.io.FileWriter;
import java.io.IOException;
import java.nio.file.Path;

public class ConfigManager {
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
                CrystalOverlayMod.LOGGER.info("Config loaded from {}", configPath);
            } catch (IOException e) {
                CrystalOverlayMod.LOGGER.error("Failed to load config", e);
                config = OverlayConfig.createDefault();
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
        try (FileWriter writer = new FileWriter(configPath.toFile())) {
            GSON.toJson(config, writer);
            CrystalOverlayMod.LOGGER.info("Config saved to {}", configPath);
        } catch (IOException e) {
            CrystalOverlayMod.LOGGER.error("Failed to save config", e);
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