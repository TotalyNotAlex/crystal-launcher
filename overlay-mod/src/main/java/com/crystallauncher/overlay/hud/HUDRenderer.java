package com.crystallauncher.overlay.hud;

import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;
import com.crystallauncher.overlay.config.ConfigManager;
import com.crystallauncher.overlay.config.OverlayConfig;
import com.crystallauncher.overlay.hud.elements.*;

public class HUDRenderer {
    private static final FPSElement fpsElement = new FPSElement();
    private static final PingElement pingElement = new PingElement();
    private static final CPSElement cpsElement = new CPSElement();
    private static final CoordsElement coordsElement = new CoordsElement();
    private static final BiomeElement biomeElement = new BiomeElement();

    public static void render(GuiGraphics graphics) {
        Minecraft mc = Minecraft.getInstance();
        if (mc.player == null || mc.options.hideGui) {
            return;
        }

        OverlayConfig cfg = ConfigManager.getConfig();
        if (!cfg.enabled) {
            return;
        }

        if (cfg.fps.enabled) {
            fpsElement.render(graphics, cfg.fps);
        }
        if (cfg.ping.enabled) {
            pingElement.render(graphics, cfg.ping);
        }
        if (cfg.cps.enabled) {
            cpsElement.render(graphics, cfg.cps);
        }
        if (cfg.coords.enabled) {
            coordsElement.render(graphics, cfg.coords);
        }
        if (cfg.biome.enabled) {
            biomeElement.render(graphics, cfg.biome);
        }
    }
}
