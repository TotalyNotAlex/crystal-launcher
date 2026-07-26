package com.crystallauncher.overlay.gui;

import com.crystallauncher.overlay.config.ConfigManager;
import com.crystallauncher.overlay.config.OverlayConfig;
import com.crystallauncher.overlay.config.OverlayConfig.ElementConfig;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.gui.widget.*;
import net.minecraft.text.Text;
import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;

public class OverlaySettingsScreen extends Screen {
    private final Screen parent;
    private OverlayConfig config;
    private final List<ElementRow> rows = new ArrayList<>();

    private static class ElementRow {
        final String name;
        final ElementConfig cfg;
        ButtonWidget toggleBtn;
        TextFieldWidget colorField;
        SliderWidget xSlider;
        SliderWidget ySlider;
        SliderWidget scaleSlider;

        ElementRow(String name, ElementConfig cfg) { this.name = name; this.cfg = cfg; }
    }

    public OverlaySettingsScreen(Screen parent) {
        super(Text.literal("Overlay Settings"));
        this.parent = parent;
        this.config = ConfigManager.getConfig().copy();
    }

    @Override
    protected void init() {
        super.init();
        rows.clear();
        this.clearChildren();

        addDrawableChild(ButtonWidget.builder(
            Text.literal("< Back"),
            btn -> {
                ConfigManager.apply(config);
                MinecraftClient.getInstance().setScreen(parent);
            }
        ).position(4, 4).size(60, 20).build());

        int startY = 40;
        int rowHeight = 50;

        addElementRow("FPS", config.fps, startY);
        addElementRow("Ping", config.ping, startY + rowHeight);
        addElementRow("CPS", config.cps, startY + rowHeight * 2);
        addElementRow("Coords", config.coords, startY + rowHeight * 3);

        int btnY = startY + rowHeight * 4 + 10;
        addDrawableChild(ButtonWidget.builder(Text.literal("Top Left"), b -> applyPreset(0.01f, 0.01f)).position(10, btnY).size(60, 20).build());
        addDrawableChild(ButtonWidget.builder(Text.literal("Top Right"), b -> applyPreset(0.92f, 0.01f)).position(75, btnY).size(60, 20).build());
        addDrawableChild(ButtonWidget.builder(Text.literal("Bottom Left"), b -> applyPreset(0.01f, 0.92f)).position(140, btnY).size(60, 20).build());
        addDrawableChild(ButtonWidget.builder(Text.literal("Bottom Right"), b -> applyPreset(0.92f, 0.92f)).position(205, btnY).size(60, 20).build());

        addDrawableChild(ButtonWidget.builder(Text.literal("Reset to Default"), b -> { config = OverlayConfig.createDefault(); refreshWidgets(); }).position(10, btnY + 28).size(120, 20).build());
        addDrawableChild(ButtonWidget.builder(Text.literal("Save & Close"), b -> { saveAndClose(); }).position(width - 110, btnY + 28).size(100, 20).build());
    }

    private void addElementRow(String name, ElementConfig cfg, int y) {
        ElementRow row = new ElementRow(name, cfg);
        int col1 = 10, col2 = 100, col3 = 180, col4 = 260, col5 = 340;

        row.toggleBtn = addDrawableChild(ButtonWidget.builder(
            Text.literal(cfg.enabled ? "ON" : "OFF"),
            btn -> { cfg.enabled = !cfg.enabled; btn.setMessage(Text.literal(cfg.enabled ? "ON" : "OFF")); }
        ).position(col1, y + 12).size(40, 20).build());

        row.colorField = addDrawableChild(new TextFieldWidget(textRenderer, col2, y + 12, 60, 20, Text.literal("Color")));
        row.colorField.setText(String.format("%06X", cfg.color & 0xFFFFFF));
        row.colorField.setMaxLength(6);

        row.xSlider = addDrawableChild(new CustomSliderWidget(col3, y + 4, 70, 20, Text.literal("X"), cfg.x, 0.0, 1.0, v -> cfg.x = v.floatValue()));
        row.ySlider = addDrawableChild(new CustomSliderWidget(col3, y + 26, 70, 20, Text.literal("Y"), cfg.y, 0.0, 1.0, v -> cfg.y = v.floatValue()));
        row.scaleSlider = addDrawableChild(new CustomSliderWidget(col5, y + 12, 80, 20, Text.literal("Scale"), cfg.scale, 0.5, 2.0, v -> cfg.scale = v.floatValue()));

        rows.add(row);
    }

    private void refreshWidgets() {
        for (ElementRow row : rows) {
            row.toggleBtn.setMessage(Text.literal(row.cfg.enabled ? "ON" : "OFF"));
            row.colorField.setText(String.format("%06X", row.cfg.color & 0xFFFFFF));
            ((CustomSliderWidget)row.xSlider).setValue(row.cfg.x);
            ((CustomSliderWidget)row.ySlider).setValue(row.cfg.y);
            ((CustomSliderWidget)row.scaleSlider).setValue(row.cfg.scale);
        }
    }

    private void applyPreset(float x, float y) {
        for (ElementRow row : rows) { row.cfg.x = x; row.cfg.y = y; }
        refreshWidgets();
    }

    private void saveAndClose() {
        for (ElementRow row : rows) {
            try { row.cfg.color = Integer.parseUnsignedInt(row.colorField.getText(), 16) | 0xFF000000; } catch (Exception ignored) {}
        }
        ConfigManager.apply(config);
        MinecraftClient.getInstance().setScreen(parent);
    }

    @Override
    public void render(DrawContext context, int mouseX, int mouseY, float delta) {
        super.render(context, mouseX, mouseY, delta);
        int startY = 34;
        int rowHeight = 50;
        context.drawText(textRenderer, Text.literal("FPS"), 55, startY + 16, 0xAAAAAA, false);
        context.drawText(textRenderer, Text.literal("Ping"), 55, startY + rowHeight + 16, 0xAAAAAA, false);
        context.drawText(textRenderer, Text.literal("CPS"), 55, startY + rowHeight * 2 + 16, 0xAAAAAA, false);
        context.drawText(textRenderer, Text.literal("Coords"), 55, startY + rowHeight * 3 + 16, 0xAAAAAA, false);
        context.drawText(textRenderer, Text.literal("Presets:"), 10, startY + rowHeight * 4 - 5, 0xAAAAAA, false);
    }

    @Override
    public void close() { saveAndClose(); }

    public static class CustomSliderWidget extends SliderWidget {
        private final double min, max;
        private final Consumer<Double> onChanged;

        public CustomSliderWidget(int x, int y, int width, int height, Text text, double value, double min, double max, Consumer<Double> onChanged) {
            super(x, y, width, height, text, (value - min) / (max - min));
            this.min = min; this.max = max; this.onChanged = onChanged;
            updateMessage();
        }

        public void setValue(double val) { this.value = (val - min) / (max - min); updateMessage(); }

        @Override
        protected void updateMessage() {
            double actual = min + value * (max - min);
            setMessage(Text.literal(String.format("%.2f", actual)));
        }

        @Override
        protected void applyValue() {
            double actual = min + value * (max - min);
            onChanged.accept(actual);
        }
    }
}
