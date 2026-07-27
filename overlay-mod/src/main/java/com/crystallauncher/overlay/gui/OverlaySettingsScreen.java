package com.crystallauncher.overlay.gui;

import com.crystallauncher.overlay.config.ConfigManager;
import com.crystallauncher.overlay.config.OverlayConfig;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.gui.widget.ButtonWidget;

import net.minecraft.text.Text;

public class OverlaySettingsScreen extends Screen {
    private final Screen parent;
    private OverlayConfig config;
    private ButtonWidget fpsBtn, pingBtn, cpsBtn, coordsBtn, enabledBtn;

    public OverlaySettingsScreen(Screen parent) {
        super(Text.literal("Overlay Settings"));
        this.parent = parent;
    }

    @Override
    protected void init() {
        config = ConfigManager.getConfig().copy();

        enabledBtn = ButtonWidget.builder(
            Text.literal("Overlay: " + (config.enabled ? "ON" : "OFF")),
            b -> { config.enabled = !config.enabled; ((ButtonWidget)b).setMessage(Text.literal("Overlay: " + (config.enabled ? "ON" : "OFF"))); }
        ).dimensions(this.width / 2 - 100, 40, 200, 20).build();

        fpsBtn = ButtonWidget.builder(
            Text.literal("FPS: " + (config.fps.enabled ? "ON" : "OFF")),
            b -> { config.fps.enabled = !config.fps.enabled; ((ButtonWidget)b).setMessage(Text.literal("FPS: " + (config.fps.enabled ? "ON" : "OFF"))); }
        ).dimensions(this.width / 2 - 100, 70, 200, 20).build();

        pingBtn = ButtonWidget.builder(
            Text.literal("Ping: " + (config.ping.enabled ? "ON" : "OFF")),
            b -> { config.ping.enabled = !config.ping.enabled; ((ButtonWidget)b).setMessage(Text.literal("Ping: " + (config.ping.enabled ? "ON" : "OFF"))); }
        ).dimensions(this.width / 2 - 100, 100, 200, 20).build();

        cpsBtn = ButtonWidget.builder(
            Text.literal("CPS: " + (config.cps.enabled ? "ON" : "OFF")),
            b -> { config.cps.enabled = !config.cps.enabled; ((ButtonWidget)b).setMessage(Text.literal("CPS: " + (config.cps.enabled ? "ON" : "OFF"))); }
        ).dimensions(this.width / 2 - 100, 130, 200, 20).build();

        coordsBtn = ButtonWidget.builder(
            Text.literal("Coords: " + (config.coords.enabled ? "ON" : "OFF")),
            b -> { config.coords.enabled = !config.coords.enabled; ((ButtonWidget)b).setMessage(Text.literal("Coords: " + (config.coords.enabled ? "ON" : "OFF"))); }
        ).dimensions(this.width / 2 - 100, 160, 200, 20).build();

        addDrawableChild(enabledBtn);
        addDrawableChild(fpsBtn);
        addDrawableChild(pingBtn);
        addDrawableChild(cpsBtn);
        addDrawableChild(coordsBtn);

        addDrawableChild(ButtonWidget.builder(Text.translatable("gui.done"), btn -> {
            ConfigManager.apply(config);
            if (this.client != null) this.client.setScreen(parent);
        }).dimensions(this.width / 2 - 100, this.height - 40, 200, 20).build());
    }

    @Override
    public void render(DrawContext context, int mouseX, int mouseY, float delta) {
        this.renderBackground(context, mouseX, mouseY, delta);
        context.drawCenteredTextWithShadow(this.textRenderer, this.title, this.width / 2, 15, 0xFFFFFF);
        super.render(context, mouseX, mouseY, delta);
    }
}