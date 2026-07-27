package com.crystallauncher.overlay.gui;

import com.crystallauncher.overlay.config.ConfigManager;
import com.crystallauncher.overlay.config.OverlayConfig;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.gui.widget.ButtonWidget;
import net.minecraft.client.gui.widget.CyclingButtonWidget;
import net.minecraft.screen.ScreenTexts;
import net.minecraft.text.Text;

public class OverlaySettingsScreen extends Screen {
    private final Screen parent;
    private OverlayConfig config;

    public OverlaySettingsScreen(Screen parent) {
        super(Text.literal("Overlay Settings"));
        this.parent = parent;
    }

    @Override
    protected void init() {
        config = ConfigManager.getConfig().copy();

        addDrawableChild(CyclingButtonWidget.onOffBuilder(config.enabled)
            .build(width / 2 - 100, 40, 200, 20, Text.literal("Overlay Enabled"),
                (btn, val) -> config.enabled = val));

        addDrawableChild(CyclingButtonWidget.onOffBuilder(config.fps.enabled)
            .build(width / 2 - 100, 70, 200, 20, Text.literal("FPS"),
                (btn, val) -> config.fps.enabled = val));

        addDrawableChild(CyclingButtonWidget.onOffBuilder(config.ping.enabled)
            .build(width / 2 - 100, 100, 200, 20, Text.literal("Ping"),
                (btn, val) -> config.ping.enabled = val));

        addDrawableChild(CyclingButtonWidget.onOffBuilder(config.cps.enabled)
            .build(width / 2 - 100, 130, 200, 20, Text.literal("CPS"),
                (btn, val) -> config.cps.enabled = val));

        addDrawableChild(CyclingButtonWidget.onOffBuilder(config.coords.enabled)
            .build(width / 2 - 100, 160, 200, 20, Text.literal("Coordinates"),
                (btn, val) -> config.coords.enabled = val));

        addDrawableChild(ButtonWidget.builder(ScreenTexts.DONE, btn -> {
            ConfigManager.apply(config);
            client.setScreen(parent);
        }).dimensions(width / 2 - 100, height - 40, 200, 20).build());
    }

    @Override
    public void render(DrawContext context, int mouseX, int mouseY, float delta) {
        renderBackground(context, mouseX, mouseY, delta);
        context.drawCenteredTextWithShadow(textRenderer, title, width / 2, 15, 0xFFFFFF);
        super.render(context, mouseX, mouseY, delta);
    }
}