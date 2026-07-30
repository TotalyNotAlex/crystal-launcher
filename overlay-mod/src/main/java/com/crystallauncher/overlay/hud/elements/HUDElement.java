package com.crystallauncher.overlay.hud.elements;

import net.minecraft.client.gui.GuiGraphics;
import com.crystallauncher.overlay.config.OverlayConfig.ElementConfig;

public interface HUDElement {
    void render(GuiGraphics graphics, ElementConfig cfg);
}
