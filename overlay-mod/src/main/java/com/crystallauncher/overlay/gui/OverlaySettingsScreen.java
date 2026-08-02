package com.crystallauncher.overlay.gui;

import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.components.AbstractSliderButton;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.network.chat.Component;
import com.crystallauncher.overlay.config.ConfigManager;
import com.crystallauncher.overlay.config.OverlayConfig;
import com.crystallauncher.overlay.hud.elements.*;

import java.util.function.Consumer;

public class OverlaySettingsScreen extends Screen {
    private final Screen parent;
    private OverlayConfig config;

    // Row 1: FPS
    private Button fpsToggle;
    private Button fpsColorBtn;
    private IntSlider fpsXSlider;
    private IntSlider fpsYSlider;
    private ScaleSlider fpsScaleSlider;

    // Row 2: Ping
    private Button pingToggle;
    private Button pingColorBtn;
    private IntSlider pingXSlider;
    private IntSlider pingYSlider;
    private ScaleSlider pingScaleSlider;

    // Row 3: CPS
    private Button cpsToggle;
    private Button cpsColorBtn;
    private IntSlider cpsXSlider;
    private IntSlider cpsYSlider;
    private ScaleSlider cpsScaleSlider;

    // Row 4: Coords
    private Button coordsToggle;
    private Button coordsColorBtn;
    private IntSlider coordsXSlider;
    private IntSlider coordsYSlider;
    private ScaleSlider coordsScaleSlider;

    // Row 5: Biome
    private Button biomeToggle;
    private Button biomeColorBtn;
    private IntSlider biomeXSlider;
    private IntSlider biomeYSlider;
    private ScaleSlider biomeScaleSlider;

    // Preview Renderers
    private final FPSElement fpsRenderer = new FPSElement();
    private final PingElement pingRenderer = new PingElement();
    private final CPSElement cpsRenderer = new CPSElement();
    private final CoordsElement coordsRenderer = new CoordsElement();
    private final BiomeElement biomeRenderer = new BiomeElement();

    public OverlaySettingsScreen(Screen parent) {
        super(Component.literal("Overlay Settings"));
        this.parent = parent;
    }

    @Override
    protected void init() {
        config = ConfigManager.getConfig().copy();
        
        int centerX = this.width / 2;
        int startY = 35;
        int rowHeight = 25;

        // --- ROW 1: FPS ---
        fpsToggle = Button.builder(Component.literal(config.fps.enabled ? "ON" : "OFF"), btn -> {
            config.fps.enabled = !config.fps.enabled;
            btn.setMessage(Component.literal(config.fps.enabled ? "ON" : "OFF"));
        }).bounds(centerX - 160, startY, 40, 20).build();

        fpsColorBtn = Button.builder(Component.literal("Color"), btn -> {
            if (this.minecraft != null) {
                this.minecraft.setScreen(new ColorPickerScreen(this, config.fps.color, col -> config.fps.color = col));
            }
        }).bounds(centerX - 115, startY, 45, 20).build();

        fpsXSlider = new IntSlider(centerX - 65, startY, 70, 20, "X", config.fps.x, this.width, val -> config.fps.x = val);
        fpsYSlider = new IntSlider(centerX + 15, startY, 70, 20, "Y", config.fps.y, this.height, val -> config.fps.y = val);
        fpsScaleSlider = new ScaleSlider(centerX + 95, startY, 70, 20, "Scale", config.fps.scale, val -> config.fps.scale = val);

        this.addRenderableWidget(fpsToggle);
        this.addRenderableWidget(fpsColorBtn);
        this.addRenderableWidget(fpsXSlider);
        this.addRenderableWidget(fpsYSlider);
        this.addRenderableWidget(fpsScaleSlider);

        // --- ROW 2: PING ---
        int pingY = startY + rowHeight;
        pingToggle = Button.builder(Component.literal(config.ping.enabled ? "ON" : "OFF"), btn -> {
            config.ping.enabled = !config.ping.enabled;
            btn.setMessage(Component.literal(config.ping.enabled ? "ON" : "OFF"));
        }).bounds(centerX - 160, pingY, 40, 20).build();

        pingColorBtn = Button.builder(Component.literal("Color"), btn -> {
            if (this.minecraft != null) {
                this.minecraft.setScreen(new ColorPickerScreen(this, config.ping.color, col -> config.ping.color = col));
            }
        }).bounds(centerX - 115, pingY, 45, 20).build();

        pingXSlider = new IntSlider(centerX - 65, pingY, 70, 20, "X", config.ping.x, this.width, val -> config.ping.x = val);
        pingYSlider = new IntSlider(centerX + 15, pingY, 70, 20, "Y", config.ping.y, this.height, val -> config.ping.y = val);
        pingScaleSlider = new ScaleSlider(centerX + 95, pingY, 70, 20, "Scale", config.ping.scale, val -> config.ping.scale = val);

        this.addRenderableWidget(pingToggle);
        this.addRenderableWidget(pingColorBtn);
        this.addRenderableWidget(pingXSlider);
        this.addRenderableWidget(pingYSlider);
        this.addRenderableWidget(pingScaleSlider);

        // --- ROW 3: CPS ---
        int cpsY = pingY + rowHeight;
        cpsToggle = Button.builder(Component.literal(config.cps.enabled ? "ON" : "OFF"), btn -> {
            config.cps.enabled = !config.cps.enabled;
            btn.setMessage(Component.literal(config.cps.enabled ? "ON" : "OFF"));
        }).bounds(centerX - 160, cpsY, 40, 20).build();

        cpsColorBtn = Button.builder(Component.literal("Color"), btn -> {
            if (this.minecraft != null) {
                this.minecraft.setScreen(new ColorPickerScreen(this, config.cps.color, col -> config.cps.color = col));
            }
        }).bounds(centerX - 115, cpsY, 45, 20).build();

        cpsXSlider = new IntSlider(centerX - 65, cpsY, 70, 20, "X", config.cps.x, this.width, val -> config.cps.x = val);
        cpsYSlider = new IntSlider(centerX + 15, cpsY, 70, 20, "Y", config.cps.y, this.height, val -> config.cps.y = val);
        cpsScaleSlider = new ScaleSlider(centerX + 95, cpsY, 70, 20, "Scale", config.cps.scale, val -> config.cps.scale = val);

        this.addRenderableWidget(cpsToggle);
        this.addRenderableWidget(cpsColorBtn);
        this.addRenderableWidget(cpsXSlider);
        this.addRenderableWidget(cpsYSlider);
        this.addRenderableWidget(cpsScaleSlider);

        // --- ROW 4: COORDS ---
        int coordsY = cpsY + rowHeight;
        coordsToggle = Button.builder(Component.literal(config.coords.enabled ? "ON" : "OFF"), btn -> {
            config.coords.enabled = !config.coords.enabled;
            btn.setMessage(Component.literal(config.coords.enabled ? "ON" : "OFF"));
        }).bounds(centerX - 160, coordsY, 40, 20).build();

        coordsColorBtn = Button.builder(Component.literal("Color"), btn -> {
            if (this.minecraft != null) {
                this.minecraft.setScreen(new ColorPickerScreen(this, config.coords.color, col -> config.coords.color = col));
            }
        }).bounds(centerX - 115, coordsY, 45, 20).build();

        coordsXSlider = new IntSlider(centerX - 65, coordsY, 70, 20, "X", config.coords.x, this.width, val -> config.coords.x = val);
        coordsYSlider = new IntSlider(centerX + 15, coordsY, 70, 20, "Y", config.coords.y, this.height, val -> config.coords.y = val);
        coordsScaleSlider = new ScaleSlider(centerX + 95, coordsY, 70, 20, "Scale", config.coords.scale, val -> config.coords.scale = val);

        this.addRenderableWidget(coordsToggle);
        this.addRenderableWidget(coordsColorBtn);
        this.addRenderableWidget(coordsXSlider);
        this.addRenderableWidget(coordsYSlider);
        this.addRenderableWidget(coordsScaleSlider);

        // --- ROW 5: BIOME ---
        int biomeY = coordsY + rowHeight;
        biomeToggle = Button.builder(Component.literal(config.biome.enabled ? "ON" : "OFF"), btn -> {
            config.biome.enabled = !config.biome.enabled;
            btn.setMessage(Component.literal(config.biome.enabled ? "ON" : "OFF"));
        }).bounds(centerX - 160, biomeY, 40, 20).build();

        biomeColorBtn = Button.builder(Component.literal("Color"), btn -> {
            if (this.minecraft != null) {
                this.minecraft.setScreen(new ColorPickerScreen(this, config.biome.color, col -> config.biome.color = col));
            }
        }).bounds(centerX - 115, biomeY, 45, 20).build();

        biomeXSlider = new IntSlider(centerX - 65, biomeY, 70, 20, "X", config.biome.x, this.width, val -> config.biome.x = val);
        biomeYSlider = new IntSlider(centerX + 15, biomeY, 70, 20, "Y", config.biome.y, this.height, val -> config.biome.y = val);
        biomeScaleSlider = new ScaleSlider(centerX + 95, biomeY, 70, 20, "Scale", config.biome.scale, val -> config.biome.scale = val);

        this.addRenderableWidget(biomeToggle);
        this.addRenderableWidget(biomeColorBtn);
        this.addRenderableWidget(biomeXSlider);
        this.addRenderableWidget(biomeYSlider);
        this.addRenderableWidget(biomeScaleSlider);

        // --- PRESETS ---
        int presetY = biomeY + 28;
        this.addRenderableWidget(Button.builder(Component.literal("Top Left"), btn -> applyPreset(10, 10, 10, 25, 10, 40, 10, 55, 10, 70)).bounds(centerX - 200, presetY, 70, 20).build());
        this.addRenderableWidget(Button.builder(Component.literal("Top Right"), btn -> {
            int rx = this.width - 110;
            applyPreset(rx, 10, rx, 25, rx, 40, rx, 55, rx, 70);
        }).bounds(centerX - 125, presetY, 75, 20).build());
        this.addRenderableWidget(Button.builder(Component.literal("Bottom Left"), btn -> {
            int by = this.height - 90;
            applyPreset(10, by, 10, by + 15, 10, by + 30, 10, by + 45, 10, by + 60);
        }).bounds(centerX - 45, presetY, 80, 20).build());
        this.addRenderableWidget(Button.builder(Component.literal("Bottom Right"), btn -> {
            int rx = this.width - 110;
            int by = this.height - 90;
            applyPreset(rx, by, rx, by + 15, rx, by + 30, rx, by + 45, rx, by + 60);
        }).bounds(centerX + 40, presetY, 85, 20).build());
        this.addRenderableWidget(Button.builder(Component.literal("Reset Positions"), btn -> applyPreset(350, 10, 350, 25, 350, 40, 350, 55, 350, 70)).bounds(centerX + 130, presetY, 100, 20).build());

        // --- BOTTOM ACTIONS ---
        int bottomY = presetY + 26;
        this.addRenderableWidget(Button.builder(Component.literal("Save & Close"), btn -> {
            ConfigManager.apply(config);
            if (this.minecraft != null) {
                this.minecraft.setScreen(parent);
            }
        }).bounds(centerX - 105, bottomY, 100, 20).build());

        this.addRenderableWidget(Button.builder(Component.literal("Reset to Default"), btn -> {
            config = OverlayConfig.createDefault();
            refreshSliders();
            fpsToggle.setMessage(Component.literal(config.fps.enabled ? "ON" : "OFF"));
            pingToggle.setMessage(Component.literal(config.ping.enabled ? "ON" : "OFF"));
            cpsToggle.setMessage(Component.literal(config.cps.enabled ? "ON" : "OFF"));
            coordsToggle.setMessage(Component.literal(config.coords.enabled ? "ON" : "OFF"));
            biomeToggle.setMessage(Component.literal(config.biome.enabled ? "ON" : "OFF"));
        }).bounds(centerX + 5, bottomY, 100, 20).build());
    }

    private void applyPreset(int fx, int fy, int px, int py, int cx, int cy, int cox, int coy, int bx, int by) {
        config.fps.x = fx; config.fps.y = fy;
        config.ping.x = px; config.ping.y = py;
        config.cps.x = cx; config.cps.y = cy;
        config.coords.x = cox; config.coords.y = coy;
        config.biome.x = bx; config.biome.y = by;
        refreshSliders();
    }

    private void refreshSliders() {
        fpsXSlider.updateValue(config.fps.x);
        fpsYSlider.updateValue(config.fps.y);
        fpsScaleSlider.updateValue(config.fps.scale);

        pingXSlider.updateValue(config.ping.x);
        pingYSlider.updateValue(config.ping.y);
        pingScaleSlider.updateValue(config.ping.scale);

        cpsXSlider.updateValue(config.cps.x);
        cpsYSlider.updateValue(config.cps.y);
        cpsScaleSlider.updateValue(config.cps.scale);

        coordsXSlider.updateValue(config.coords.x);
        coordsYSlider.updateValue(config.coords.y);
        coordsScaleSlider.updateValue(config.coords.scale);

        biomeXSlider.updateValue(config.biome.x);
        biomeYSlider.updateValue(config.biome.y);
        biomeScaleSlider.updateValue(config.biome.scale);
    }

    @Override
    public void render(GuiGraphics graphics, int mouseX, int mouseY, float delta) {
        // Lightly darkened transparent background
        graphics.fillGradient(0, 0, this.width, this.height, 0x80101010, 0x90101010);
        
        graphics.drawCenteredString(this.font, this.title, this.width / 2, 8, 0xFFFFFF);

        int centerX = this.width / 2;
        graphics.drawString(this.font, "FPS", centerX - 200, 41, 0xFFFFFF, false);
        graphics.drawString(this.font, "Ping", centerX - 200, 66, 0xFFFFFF, false);
        graphics.drawString(this.font, "CPS", centerX - 200, 91, 0xFFFFFF, false);
        graphics.drawString(this.font, "Coords", centerX - 200, 116, 0xFFFFFF, false);
        graphics.drawString(this.font, "Biome", centerX - 200, 141, 0xFFFFFF, false);

        super.render(graphics, mouseX, mouseY, delta);

        // LIVE PREVIEW - Render elements on top!
        if (config.enabled) {
            if (config.fps.enabled) fpsRenderer.render(graphics, config.fps);
            if (config.ping.enabled) pingRenderer.render(graphics, config.ping);
            if (config.cps.enabled) cpsRenderer.render(graphics, config.cps);
            if (config.coords.enabled) coordsRenderer.render(graphics, config.coords);
            if (config.biome.enabled) biomeRenderer.render(graphics, config.biome);
        }
    }

    // --- INNER SLIDER CLASSES ---
    private static class IntSlider extends AbstractSliderButton {
        private final String prefix;
        private final int maxVal;
        private final Consumer<Integer> onChange;

        public IntSlider(int x, int y, int width, int height, String prefix, int currentVal, int maxVal, Consumer<Integer> onChange) {
            super(x, y, width, height, Component.literal(prefix + ": " + currentVal), (double)currentVal / maxVal);
            this.prefix = prefix;
            this.maxVal = Math.max(1, maxVal);
            this.onChange = onChange;
        }

        public void updateValue(int currentVal) {
            this.value = Math.max(0.0, Math.min(1.0, (double)currentVal / maxVal));
            this.updateMessage();
        }

        @Override
        protected void updateMessage() {
            this.setMessage(Component.literal(prefix + ": " + (int)(this.value * maxVal)));
        }

        @Override
        protected void applyValue() {
            onChange.accept((int)(this.value * maxVal));
        }
    }

    private static class ScaleSlider extends AbstractSliderButton {
        private final String prefix;
        private final Consumer<Float> onChange;

        public ScaleSlider(int x, int y, int width, int height, String prefix, float currentVal, Consumer<Float> onChange) {
            super(x, y, width, height, Component.literal(prefix + ": " + String.format("%.1f", currentVal)), (currentVal - 0.5) / 1.5);
            this.prefix = prefix;
            this.onChange = onChange;
        }

        public void updateValue(float currentVal) {
            this.value = Math.max(0.0, Math.min(1.0, (currentVal - 0.5) / 1.5));
            this.updateMessage();
        }

        @Override
        protected void updateMessage() {
            float scale = 0.5f + (float)(this.value * 1.5);
            scale = Math.round(scale * 10.0f) / 10.0f;
            this.setMessage(Component.literal(prefix + ": " + String.format("%.1f", scale)));
        }

        @Override
        protected void applyValue() {
            float scale = 0.5f + (float)(this.value * 1.5);
            scale = Math.round(scale * 10.0f) / 10.0f;
            onChange.accept(scale);
        }
    }
}
