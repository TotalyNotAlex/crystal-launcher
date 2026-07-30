package com.crystallauncher.overlay.gui;

import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.components.AbstractSliderButton;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.components.EditBox;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.network.chat.Component;

import java.util.function.Consumer;

public class ColorPickerScreen extends Screen {
    private final Screen parent;
    private final Consumer<Integer> onColorSelected;
    private int currentColor;

    private ColorSlider redSlider;
    private ColorSlider greenSlider;
    private ColorSlider blueSlider;
    private EditBox hexInput;
    private boolean updatingFromSliders = false;
    private boolean updatingFromHex = false;

    public ColorPickerScreen(Screen parent, int initialColor, Consumer<Integer> onColorSelected) {
        super(Component.literal("Color Picker"));
        this.parent = parent;
        this.onColorSelected = onColorSelected;
        this.currentColor = initialColor & 0xFFFFFF; // Ignore alpha
    }

    @Override
    protected void init() {
        int r = (currentColor >> 16) & 0xFF;
        int g = (currentColor >> 8) & 0xFF;
        int b = currentColor & 0xFF;

        int centerX = this.width / 2;

        redSlider = new ColorSlider(centerX - 100, 50, 200, 20, "Red", r / 255.0, val -> {
            if (updatingFromHex) return;
            updatingFromSliders = true;
            updateColorFromSliders();
            updatingFromSliders = false;
        });

        greenSlider = new ColorSlider(centerX - 100, 80, 200, 20, "Green", g / 255.0, val -> {
            if (updatingFromHex) return;
            updatingFromSliders = true;
            updateColorFromSliders();
            updatingFromSliders = false;
        });

        blueSlider = new ColorSlider(centerX - 100, 110, 200, 20, "Blue", b / 255.0, val -> {
            if (updatingFromHex) return;
            updatingFromSliders = true;
            updateColorFromSliders();
            updatingFromSliders = false;
        });

        this.addRenderableWidget(redSlider);
        this.addRenderableWidget(greenSlider);
        this.addRenderableWidget(blueSlider);

        // Hex Input
        hexInput = new EditBox(this.font, centerX - 50, 140, 100, 20, Component.literal("Hex Color"));
        hexInput.setValue(String.format("#%06X", currentColor));
        hexInput.setResponder(val -> {
            if (updatingFromSliders) return;
            updatingFromHex = true;
            try {
                String clean = val.replace("#", "").trim();
                if (clean.length() == 6) {
                    int parsedColor = Integer.parseInt(clean, 16) & 0xFFFFFF;
                    currentColor = parsedColor;
                    syncSlidersToColor();
                }
            } catch (NumberFormatException ignored) {}
            updatingFromHex = false;
        });
        this.addRenderableWidget(hexInput);

        // Done / Cancel buttons
        this.addRenderableWidget(Button.builder(Component.translatable("gui.done"), btn -> {
            onColorSelected.accept(currentColor);
            if (this.minecraft != null) {
                this.minecraft.setScreen(parent);
            }
        }).bounds(centerX - 105, 180, 100, 20).build());

        this.addRenderableWidget(Button.builder(Component.literal("Cancel"), btn -> {
            if (this.minecraft != null) {
                this.minecraft.setScreen(parent);
            }
        }).bounds(centerX + 5, 180, 100, 20).build());
    }

    private void updateColorFromSliders() {
        int r = (int) (redSlider.getValue() * 255);
        int g = (int) (greenSlider.getValue() * 255);
        int b = (int) (blueSlider.getValue() * 255);
        currentColor = ((r & 0xFF) << 16) | ((g & 0xFF) << 8) | (b & 0xFF);
        hexInput.setValue(String.format("#%06X", currentColor));
    }

    private void syncSlidersToColor() {
        int r = (currentColor >> 16) & 0xFF;
        int g = (currentColor >> 8) & 0xFF;
        int b = currentColor & 0xFF;

        redSlider.setValue(r / 255.0);
        greenSlider.setValue(g / 255.0);
        blueSlider.setValue(b / 255.0);
    }

    @Override
    public void render(GuiGraphics graphics, int mouseX, int mouseY, float delta) {
        // Lightly darkened background (Feather-style, transparent overlay)
        graphics.fillGradient(0, 0, this.width, this.height, 0xC0101010, 0xD0101010);
        
        graphics.drawCenteredString(this.font, this.title, this.width / 2, 20, 0xFFFFFF);
        graphics.drawString(this.font, "Hex Code:", this.width / 2 - 110, 145, 0xFFFFFF, false);

        // Color Preview Box
        int previewX = this.width / 2 - 100;
        int previewY = 140;
        // Draw black border
        graphics.fill(previewX - 32, previewY - 2, previewX - 8, previewY + 22, 0xFF000000);
        // Draw current color box
        graphics.fill(previewX - 30, previewY, previewX - 10, previewY + 20, 0xFF000000 | currentColor);

        super.render(graphics, mouseX, mouseY, delta);
    }

    private static class ColorSlider extends AbstractSliderButton {
        private final String label;
        private final Consumer<Double> onChange;

        public ColorSlider(int x, int y, int width, int height, String label, double initialValue, Consumer<Double> onChange) {
            super(x, y, width, height, Component.literal(label + ": " + (int)(initialValue * 255)), initialValue);
            this.label = label;
            this.onChange = onChange;
        }

        public double getValue() {
            return this.value;
        }

        public void setValue(double val) {
            this.value = Math.max(0.0, Math.min(1.0, val));
            this.updateMessage();
        }

        @Override
        protected void updateMessage() {
            this.setMessage(Component.literal(label + ": " + (int)(this.value * 255)));
        }

        @Override
        protected void applyValue() {
            onChange.accept(this.value);
        }
    }
}
