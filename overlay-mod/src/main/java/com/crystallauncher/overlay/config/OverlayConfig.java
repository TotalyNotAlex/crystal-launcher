package com.crystallauncher.overlay.config;

public class OverlayConfig {
    public boolean enabled = true;
    public ElementConfig fps = new ElementConfig(true, 0.92f, 0.01f, 0xFFFFFF, 1.0f);
    public ElementConfig ping = new ElementConfig(true, 0.92f, 0.05f, 0xFFFFFF, 1.0f);
    public ElementConfig cps = new ElementConfig(true, 0.92f, 0.09f, 0xFFFFFF, 1.0f);
    public ElementConfig coords = new ElementConfig(true, 0.01f, 0.92f, 0xFFFFFF, 1.0f);

    public static class ElementConfig {
        public boolean enabled;
        public float x;
        public float y;
        public int color;
        public float scale;

        public ElementConfig() {}

        public ElementConfig(boolean enabled, float x, float y, int color, float scale) {
            this.enabled = enabled;
            this.x = x;
            this.y = y;
            this.color = color;
            this.scale = scale;
        }

        public ElementConfig copy() {
            return new ElementConfig(enabled, x, y, color, scale);
        }
    }

    public OverlayConfig copy() {
        OverlayConfig c = new OverlayConfig();
        c.enabled = this.enabled;
        c.fps = this.fps.copy();
        c.ping = this.ping.copy();
        c.cps = this.cps.copy();
        c.coords = this.coords.copy();
        return c;
    }

    public static OverlayConfig createDefault() {
        return new OverlayConfig();
    }
}