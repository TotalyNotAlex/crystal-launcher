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
            .build(this.width / 2 - 100, 40, 200, 20, Text.literal("Overlay Enabled"),
                (btn, val) -> config.enabled = val));

        addDrawableChild(CyclingButtonWidget.onOffBuilder(config.fps.enabled)
            .build(this.width / 2 - 100, 70, 200, 20, Text.literal("FPS"),
                (btn, val) -> config.fps.enabled = val));

        addDrawableChild(CyclingButtonWidget.onOffBuilder(config.ping.enabled)
            .build(this.width / 2 - 100, 100, 200, 20, Text.literal("Ping"),
                (btn, val) -> config.ping.enabled = val));

        addDrawableChild(CyclingButtonWidget.onOffBuilder(config.cps.enabled)
            .build(this.width / 2 - 100, 130, 200, 20, Text.literal("CPS"),
                (btn, val) -> config.cps.enabled = val));

        addDrawableChild(CyclingButtonWidget.onOffBuilder(config.coords.enabled)
            .build(this.width / 2 - 100, 160, 200, 20, Text.literal("Coordinates"),
                (btn, val) -> config.coords.enabled = val));

        addDrawableChild(ButtonWidget.builder(ScreenTexts.DONE, btn -> {
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