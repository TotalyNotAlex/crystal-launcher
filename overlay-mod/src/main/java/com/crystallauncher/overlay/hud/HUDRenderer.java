package com.crystallauncher.overlay.hud;

import com.crystallauncher.overlay.config.ConfigManager;
import com.crystallauncher.overlay.config.OverlayConfig;
import com.crystallauncher.overlay.hud.elements.*;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;

public class HUDRenderer {
    private final MinecraftClient client;
    private final FPSElement fpsElement = new FPSElement();
    private final PingElement pingElement = new PingElement();
    private final CPSElement cpsElement = new CPSElement();
    private final CoordsElement coordsElement = new CoordsElement();

    public HUDRenderer(MinecraftClient client) {
        this.client = client;
    }

    public void render(DrawContext context, float tickDelta) {
        if (client.player == null || client.options.hudHidden) return;
        OverlayConfig cfg = ConfigManager.getConfig();
        if (!cfg.enabled) return;

        if (cfg.fps.enabled) fpsElement.render(context, client, cfg.fps);
        if (cfg.ping.enabled) pingElement.render(context, client, cfg.ping);
        if (cfg.cps.enabled) cpsElement.render(context, client, cfg.cps);
        if (cfg.coords.enabled) coordsElement.render(context, client, cfg.coords);
    }

    public void tick() {
        cpsElement.tick();
    }
}